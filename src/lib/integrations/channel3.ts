import "server-only";
import { env, isForced } from "@/lib/env";
import type { RequestMeta } from "@/lib/http";
import { merchantDomain, type RawMatch } from "@/lib/integrations/serpapi";

// Channel3 product search (https://docs.trychannel3.com): a catalog of retailer products where
// every result carries offers with the store's own product URL, domain, price and stock, so
// one call replaces SerpAPI's Lens + Shopping + store-link lookups. 1 credit per call.

const API = "https://api.trychannel3.com/v1";

interface Offer {
  url?: string;
  domain?: string;
  // The docs show both {price, currency} and {amount, currency}; accept either.
  price?: { price?: number; amount?: number; currency?: string } | null;
  availability?: string;
}
interface Product {
  id: string;
  title?: string;
  brands?: { name?: string }[];
  images?: { url?: string; is_main_image?: boolean }[];
  offers?: Offer[];
}

async function post(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<Product[]> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "x-api-key": env.channel3Key ?? "", "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`channel3 ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { products?: Product[] }).products ?? [];
}

/** www.zara.com -> "Zara" for display; Channel3 offers name the store only by domain. */
function storeName(domain: string): string {
  const base = domain.split(".")[0];
  return base.length <= 3 ? base.toUpperCase() : base[0].toUpperCase() + base.slice(1);
}

/** One product -> one match: its first in-stock offer (else the first offer). */
export function toMatch(p: Product): RawMatch | null {
  const offers = (p.offers ?? []).filter((o) => o.url && /^https:\/\//.test(o.url));
  const inStock = offers.filter((o) => o.availability !== "OutOfStock");
  // Prefer the offer's domain: its url may be an attributed (affiliate) redirect.
  const domainOf = (o: Offer) => (o.domain ? merchantDomain(`https://${o.domain}`) : null) ?? merchantDomain(o.url);
  const offer = inStock.find((o) => domainOf(o) != null) ?? inStock[0] ?? offers[0];
  if (!offer?.url) return null;
  const domain = domainOf(offer);
  const amount = offer.price?.price ?? offer.price?.amount;
  const image = p.images?.find((i) => i.is_main_image)?.url ?? p.images?.[0]?.url ?? null;
  return {
    name: p.title ?? "Item",
    brand: p.brands?.[0]?.name ?? null,
    merchant: domain ? storeName(domain) : null,
    merchant_domain: domain,
    url: offer.url,
    image_url: image,
    price_cents: typeof amount === "number" && amount > 0 ? Math.round(amount * 100) : null,
    currency: offer.price?.currency ?? "USD",
  };
}

export function channel3Configured(): boolean {
  return !isForced("channel3");
}

/** Visually similar products for a photo (base64 JPEG bytes, no data: prefix). */
export async function imageSearch(base64Jpeg: string, meta: RequestMeta): Promise<RawMatch[]> {
  try {
    const products = await post("/image-search", { base64_image: base64Jpeg, limit: 20 }, 15_000);
    return products.map(toMatch).filter((m): m is RawMatch => m != null);
  } catch (err) {
    console.error("channel3 image search failed", err);
    meta.fallback("channel3");
    return [];
  }
}

/** Text search, used for the market price median and as a backup to the image search. */
export async function textSearch(query: string, meta: RequestMeta): Promise<RawMatch[]> {
  try {
    const products = await post("/search", { query, limit: 20 }, 10_000);
    return products.map(toMatch).filter((m): m is RawMatch => m != null);
  } catch (err) {
    console.error("channel3 search failed", err);
    meta.fallback("channel3");
    return [];
  }
}
