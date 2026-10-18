import "server-only";
import { db, must } from "@/lib/db/client";
import type { WardrobeItem } from "@/lib/types";

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  home_lat: number | null;
  home_lng: number | null;
  current_match_id: string | null;
}

export interface MatchRow {
  id: string;
  analysis_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  occasion_tags: string[];
  price_cents: number | null;
  market_median_cents: number | null;
  currency: string;
  merchant: string | null;
  merchant_domain: string | null;
  url: string;
  image_url: string | null;
}

export async function getUser(userId: string): Promise<UserRow | null> {
  const res = await db().from("users").select("*").eq("id", userId).maybeSingle();
  return must(res, "load user");
}

export async function getUserByPhone(phone: string): Promise<UserRow | null> {
  const res = await db().from("users").select("*").eq("phone", phone).maybeSingle();
  return must(res, "load user by phone");
}

export interface WardrobeFilters {
  category?: string | null;
  brand?: string | null;
  occasion?: string | null;
  source?: string | null;
}

export async function listWardrobe(userId: string, f: WardrobeFilters = {}): Promise<WardrobeItem[]> {
  let q = db()
    .from("wardrobe_items")
    .select(
      "id,name,brand,category,subcategory,color,size,price_cents,currency,source,occasion_tags,image_url,times_worn,last_worn_at,created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (f.category) q = q.ilike("category", f.category);
  if (f.brand) q = q.ilike("brand", f.brand);
  if (f.occasion) q = q.contains("occasion_tags", [f.occasion.toLowerCase()]);
  if (f.source) q = q.eq("source", f.source);
  return must(await q, "list wardrobe") ?? [];
}

/**
 * Load a product match, but only if it belongs to an analysis owned by this user.
 * Stops the model from passing a hallucinated or someone else's match_id (QA 1.4).
 */
export async function getOwnedMatch(userId: string, matchId: string): Promise<MatchRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return null;
  const res = await db()
    .from("product_matches")
    .select("*, reel_analyses!inner(user_id)")
    .eq("id", matchId)
    .maybeSingle();
  const row = must(res, "load match") as (MatchRow & { reel_analyses: { user_id: string | null } }) | null;
  if (!row || row.reel_analyses.user_id !== userId) return null;
  const { reel_analyses: owner, ...match } = row;
  void owner;
  return match;
}

export async function setCurrentMatch(userId: string, matchId: string | null) {
  must(await db().from("users").update({ current_match_id: matchId }).eq("id", userId), "set current match");
}
