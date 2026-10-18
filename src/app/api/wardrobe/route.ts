import { connection, type NextRequest } from "next/server";
import { db, must } from "@/lib/db/client";
import { listWardrobe } from "@/lib/db/queries";
import { fail, mockResponse, ok, RequestMeta, fallbackToMock, requestUserId } from "@/lib/http";
import type { WardrobeItem } from "@/lib/types";

// GET /api/wardrobe?user_id=&category=&brand=&occasion=&source=&wishlist=true -> WardrobeResponse
// wishlist=true returns wishlist items in the same item shape (source "reel").
export async function GET(req: NextRequest) {
  await connection(); // always run at request time (never prerender the mock)
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("wardrobe", "/api/wardrobe", mockReason);
  const meta = new RequestMeta();
  try {
    const sp = req.nextUrl.searchParams;
    const userId = requestUserId(req, sp.get("user_id"));
    let items: WardrobeItem[];
    if (sp.get("wishlist") === "true") {
      const rows = must(
        await db().from("wishlist_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        "load wishlist",
      ) as { id: string; name: string; brand: string | null; image_url: string | null; price_cents: number | null; currency: string; created_at: string }[];
      items = rows.map((r) => ({
        id: r.id, name: r.name, brand: r.brand, category: "wishlist", subcategory: null, color: null, size: null,
        price_cents: r.price_cents, currency: r.currency, source: "reel", occasion_tags: [], image_url: r.image_url,
        times_worn: 0, last_worn_at: null, created_at: r.created_at,
      }));
    } else {
      items = await listWardrobe(userId, {
        category: sp.get("category"),
        brand: sp.get("brand"),
        occasion: sp.get("occasion"),
        source: sp.get("source"),
      });
    }
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
    const facets = {
      categories: uniq(items.map((i) => i.category)),
      brands: uniq(items.map((i) => i.brand)),
      occasions: uniq(items.flatMap((i) => i.occasion_tags)),
    };
    return ok({ items, facets }, meta, "/api/wardrobe", { count: items.length });
  } catch (err) {
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "wardrobe failed");
  }
}
