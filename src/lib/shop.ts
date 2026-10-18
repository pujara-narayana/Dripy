import "server-only";
import { BRAND, catalogById, MERCHANT_DOMAIN, shopItemsFor, type CatalogItem } from "@/data/catalog";
import { db, must } from "@/lib/db/client";
import { listWardrobe } from "@/lib/db/queries";
import { env } from "@/lib/env";
import { createIntent, IntentRejected, type IntentRow } from "@/lib/payments/intents";
import { getProfile } from "@/lib/users";

// The website's shop: catalog pieces the user doesn't own yet. Buying one goes through the
// same purchase-intent state machine as an iMessage purchase, so the agent sees it too.

export interface ShopItem {
  id: string;
  name: string;
  brand: string;
  type: CatalogItem["type"];
  price_cents: number;
  image_url: string;
  url: string;
  reason: string;
}

const toShopItem = (item: CatalogItem): ShopItem => ({
  id: item.id,
  name: item.name,
  brand: BRAND,
  type: item.type,
  price_cents: item.priceCents,
  image_url: item.image,
  url: item.link,
  reason: item.reason,
});

/** Shop pieces for the user's gender they don't own, in a fresh random order on every call. */
export async function listShop(userId: string): Promise<ShopItem[]> {
  const [wardrobe, { gender }] = await Promise.all([listWardrobe(userId), getProfile(userId)]);
  const owned = new Set(wardrobe.map((w) => w.name.toLowerCase()));
  const items = shopItemsFor(gender).filter((item) => !owned.has(item.name.toLowerCase())).map(toShopItem);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Store the shop piece as a product match the user owns (one "shop" analysis per user),
 * then propose the purchase. Amount and store come from the catalog, never the client.
 */
export async function buyFromShop(userId: string, productId: string): Promise<IntentRow> {
  const item = catalogById(productId);
  if (!item || item.owned) throw new IntentRejected("That piece isn't in the shop.");

  const cacheKey = `shop:${userId}`;
  const analysis = must(
    await db()
      .from("reel_analyses")
      .upsert({ user_id: userId, cache_key: cacheKey, identified: [], mode: "live" }, { onConflict: "cache_key" })
      .select("id")
      .single(),
    "shop analysis",
  ) as { id: string };

  const existing = must(
    await db().from("product_matches").select("id").eq("analysis_id", analysis.id).eq("url", item.link).maybeSingle(),
    "find shop match",
  ) as { id: string } | null;
  const match =
    existing ??
    (must(
      await db()
        .from("product_matches")
        .insert({
          analysis_id: analysis.id,
          name: item.name,
          brand: BRAND,
          category: item.category,
          color: item.color,
          occasion_tags: [],
          price_cents: item.priceCents,
          market_median_cents: item.priceCents,
          currency: "USD",
          merchant: BRAND,
          merchant_domain: MERCHANT_DOMAIN,
          url: item.link,
          // Full URL: it ends up in the receipt email and in iMessage, outside this site.
          image_url: `${env.appUrl}${item.image}`,
        })
        .select("id")
        .single(),
      "create shop match",
    ) as { id: string });

  return createIntent(userId, match.id);
}
