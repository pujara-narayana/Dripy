import "server-only";
import { z } from "zod";
import { extract } from "@/lib/llm";
import { getOwnedMatch, listWardrobe, setCurrentMatch, type MatchRow } from "@/lib/db/queries";
import { isForced } from "@/lib/env";
import type { RequestMeta } from "@/lib/http";
import { shoppingMedianCents } from "@/lib/integrations/serpapi";
import { type Candidate, scoreCandidate, toVerdictCard } from "@/lib/pipelines/buyCheckScore";
import type { VerdictCard } from "@/lib/types";

const DescribedItem = z.object({
  name: z.string(),
  category: z.enum(["outerwear", "top", "bottom", "dress", "shoes", "accessory"]),
  subcategory: z.string(),
  color: z.string(),
  occasion_tags: z.array(z.enum(["casual", "smart-casual", "formal", "athletic", "going-out", "outdoor"])),
  price_usd: z.number().nullable(),
});

export class BuyCheckError extends Error {}

export function matchToCandidate(m: MatchRow): Candidate {
  return {
    name: m.brand ? `${m.brand} ${m.name}` : m.name,
    category: m.category ?? "outerwear",
    subcategory: m.subcategory,
    color: m.color,
    occasion_tags: m.occasion_tags,
    price_cents: m.price_cents,
    market_median_cents: m.market_median_cents,
    url: m.url,
    image_url: m.image_url,
    match_id: m.id,
  };
}

/** Free-text ("a $120 black leather jacket") -> candidate, via structured output. */
async function describeToCandidate(desc: string): Promise<Candidate> {
  const item = await extract({
    schema: DescribedItem,
    system:
      "Normalize a clothing item the user is considering into structured fields. Use a basic color word. " +
      "occasion_tags[0] must be the item's primary occasion. price_usd is null unless the user stated a price.",
    parts: [{ text: desc }],
  });
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    occasion_tags: item.occasion_tags,
    price_cents: item.price_usd != null ? Math.round(item.price_usd * 100) : null,
  };
}

export async function buyCheck(
  userId: string,
  input: { matchId?: string | null; itemDesc?: string | null },
  meta: RequestMeta,
): Promise<VerdictCard> {
  let candidate: Candidate;
  if (input.matchId) {
    const match = await getOwnedMatch(userId, input.matchId);
    if (!match) throw new BuyCheckError(`match ${input.matchId} not found for this user`);
    candidate = matchToCandidate(match);
    await setCurrentMatch(userId, match.id);
  } else if (input.itemDesc) {
    if (isForced("llm")) throw new BuyCheckError("free-text buy checks need the Gemini API; send a photo or pick a match");
    candidate = await describeToCandidate(input.itemDesc);
  } else {
    throw new BuyCheckError("buy_check needs a match_id or an item description");
  }

  // Seeded demo matches carry a stored median so the verdict is deterministic.
  if (candidate.market_median_cents == null && candidate.price_cents != null) {
    candidate.market_median_cents = await shoppingMedianCents(
      [candidate.color, candidate.subcategory ?? candidate.name].filter(Boolean).join(" "),
      meta,
    );
  }

  const wardrobe = await listWardrobe(userId);
  const score = scoreCandidate(candidate, wardrobe);

  // Invariant: every cited dupe is a real wardrobe row of this user.
  const owned = new Set(wardrobe.map((w) => w.id));
  for (const d of score.dupes) {
    if (!owned.has(d.item_id)) throw new Error(`buy_check cited a non-owned item ${d.item_id}`);
  }
  return toVerdictCard(candidate, score);
}
