import "server-only";
import { env, isForced } from "@/lib/env";
import type { RequestMeta } from "@/lib/http";

export interface RawMatch {
  name: string;
  merchant: string | null;
  merchant_domain: string | null;
  url: string;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  /** Google Shopping's handle for the product page, used to look up the store's own link. */
  token?: string | null;
}

const SERP = "https://serpapi.com/search.json";

async function serp(params: Record<string, string>, timeoutMs = 15_000): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, api_key: env.serpapiKey ?? "" });
  const res = await fetch(`${SERP}?${qs}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`serpapi ${params.engine} ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  if (typeof body.error === "string" && !/hasn't returned any results/i.test(body.error)) {
    throw new Error(`serpapi ${params.engine}: ${body.error}`);
  }
  return body;
}

/** www2.hm.com -> hm.com, us.shop.mango.com -> mango.com */
export function merchantDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const parts = host.split(".");
    const twoLevelTld = parts.length > 2 && ["co", "com"].includes(parts[parts.length - 2]) && parts.at(-1)!.length === 2;
    return parts.slice(twoLevelTld ? -3 : -2).join(".");
  } catch {
    return null;
  }
}

// Store names Google Shopping reports that don't map to "<name>.com".
const SOURCE_DOMAINS: Record<string, string> = { "levi's": "levi.com", levis: "levi.com", "h&m": "hm.com", "j.crew": "jcrew.com" };

/**
 * Best guess at a Shopping result's store domain from its store name ("Zara" -> zara.com),
 * used only until the real store link is resolved. Only allowlisted guesses are kept, so a
 * name like "eBay - seller" never turns into a made-up domain.
 */
export function domainFromSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const s = source.trim().toLowerCase();
  const guess = SOURCE_DOMAINS[s] ?? (/^[a-z0-9.&' -]+$/.test(s) ? `${s.replace(/[^a-z0-9]/g, "")}.com` : null);
  return guess && env.merchantAllowlist.includes(guess) ? guess : null;
}

function cents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value * 100);
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  }
  return null;
}

/** Google Lens visual matches for a public image URL. */
export async function lensMatches(imageUrl: string, meta: RequestMeta): Promise<RawMatch[]> {
  if (isForced("serpapi")) {
    meta.fallback("serpapi");
    return [];
  }
  try {
    const body = await serp({ engine: "google_lens", url: imageUrl, hl: "en", country: "us" });
    const visual = (body.visual_matches as Record<string, unknown>[] | undefined) ?? [];
    return visual.slice(0, 20).map((v) => {
      const price = v.price as { extracted_value?: number; currency?: string } | undefined;
      const link = String(v.link ?? "");
      return {
        name: String(v.title ?? "Similar item"),
        merchant: (v.source as string) ?? null,
        merchant_domain: merchantDomain(link),
        url: link,
        image_url: (v.thumbnail as string) ?? null,
        price_cents: cents(price?.extracted_value),
        currency: price?.currency === "$" || !price?.currency ? "USD" : String(price.currency),
      };
    });
  } catch (err) {
    console.error("lens failed", err);
    meta.fallback("serpapi");
    return [];
  }
}

/** Google Shopping results for a text query. */
export async function shoppingResults(query: string, meta: RequestMeta): Promise<RawMatch[]> {
  if (isForced("serpapi")) {
    meta.fallback("serpapi");
    return [];
  }
  try {
    const body = await serp({ engine: "google_shopping", q: query, gl: "us", hl: "en", location: "Seattle, Washington, United States" });
    const results = (body.shopping_results as Record<string, unknown>[] | undefined) ?? [];
    return results.slice(0, 20).map((r) => {
      // Shopping results usually carry only a google.com product link (no `link`); the
      // store's own page is resolved later for the few matches we show (resolveStoreLinks).
      const link = String(r.link ?? r.product_link ?? "");
      return {
        name: String(r.title ?? "Item"),
        merchant: (r.source as string) ?? null,
        merchant_domain: (r.link ? merchantDomain(r.link as string) : null) ?? domainFromSource(r.source as string),
        url: link,
        image_url: (r.thumbnail as string) ?? null,
        price_cents: cents(r.extracted_price ?? r.price),
        currency: "USD",
        token: (r.immersive_product_page_token as string) ?? null,
      };
    });
  } catch (err) {
    console.error("shopping failed", err);
    meta.fallback("serpapi");
    return [];
  }
}

function isGoogleLink(url: string): boolean {
  return /^https:\/\/(www\.)?google\.[a-z.]+\//i.test(url);
}

/**
 * Swap Google Shopping links for the store's own product page, so the user gets a link they
 * can actually buy from. One SerpAPI immersive-product lookup per match (~2-3 s, run in
 * parallel); prefers the store Shopping listed, else the first store. Failures keep the
 * Google link.
 */
export async function resolveStoreLinks(matches: RawMatch[], meta: RequestMeta): Promise<RawMatch[]> {
  if (isForced("serpapi")) return matches;
  return Promise.all(
    matches.map(async (m) => {
      if (!m.token || !isGoogleLink(m.url)) return m;
      try {
        const body = await serp({ engine: "google_immersive_product", page_token: m.token }, 8_000);
        const stores = ((body.product_results as { stores?: Record<string, unknown>[] } | undefined)?.stores ?? []).filter(
          (s) => typeof s.link === "string" && /^https:\/\//.test(s.link as string) && !isGoogleLink(s.link as string),
        );
        const norm = (x: unknown) => String(x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const store = stores.find((s) => norm(s.name) === norm(m.merchant)) ?? stores[0];
        if (!store) return m;
        const url = store.link as string;
        return {
          ...m,
          url,
          merchant: (store.name as string) ?? m.merchant,
          merchant_domain: merchantDomain(url),
          price_cents: cents(store.extracted_price) ?? m.price_cents,
        };
      } catch (err) {
        console.error("store link lookup failed", err);
        meta.fallback("serpapi_store_link");
        return m;
      }
    }),
  );
}

export function medianCents(prices: (number | null)[]): number | null {
  const xs = prices.filter((p): p is number => p != null).sort((a, b) => a - b);
  if (xs.length < 3) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

export async function shoppingMedianCents(query: string, meta: RequestMeta): Promise<number | null> {
  return medianCents((await shoppingResults(query, meta)).map((r) => r.price_cents));
}
