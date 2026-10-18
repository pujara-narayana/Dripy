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
}

const SERP = "https://serpapi.com/search.json";

async function serp(params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, api_key: env.serpapiKey ?? "" });
  const res = await fetch(`${SERP}?${qs}`, { signal: AbortSignal.timeout(15_000) });
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
      const link = String(r.link ?? r.product_link ?? "");
      return {
        name: String(r.title ?? "Item"),
        merchant: (r.source as string) ?? null,
        merchant_domain: merchantDomain(r.link as string) ?? null,
        url: link,
        image_url: (r.thumbnail as string) ?? null,
        price_cents: cents(r.extracted_price ?? r.price),
        currency: "USD",
      };
    });
  } catch (err) {
    console.error("shopping failed", err);
    meta.fallback("serpapi");
    return [];
  }
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
