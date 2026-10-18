// Verifies the two demo beats against the seed wardrobe: SKIP for the black bomber,
// BUY for the camel blazer. Run: npx tsx scripts/test-buycheck.ts
import assert from "node:assert/strict";
import { ALL_SEED_ITEMS, SEED_ANALYSES } from "../supabase/seed-data";
import { scoreCandidate } from "../src/lib/pipelines/buyCheckScore";
import type { WardrobeItem } from "../src/lib/types";

const wardrobe: WardrobeItem[] = ALL_SEED_ITEMS.map((i) => ({
  ...i, currency: "USD", created_at: "2026-10-17T00:00:00Z",
}));
const asCandidate = (m: (typeof SEED_ANALYSES)[number]["matches"][number]) => ({ ...m, match_id: m.id });

const skip = scoreCandidate(asCandidate(SEED_ANALYSES[0].matches[0]), wardrobe);
console.log("SKIP beat:", skip.verdict, "|", skip.headline, "\n ", skip.reasons.join("\n  "), "\n  dupes:", skip.dupes.map((d) => `${d.name}=${d.similarity}`));
assert.equal(skip.verdict, "SKIP");
assert.equal(skip.dupes.length, 2);

const buy = scoreCandidate(asCandidate(SEED_ANALYSES[1].matches[0]), wardrobe);
console.log("BUY beat:", buy.verdict, "|", buy.headline, "\n ", buy.reasons.join("\n  "), "\n  cited:", buy.dupes.map((d) => `${d.name}=${d.similarity}`));
assert.equal(buy.verdict, "BUY");
assert.equal(buy.gap_filled, "smart-casual");

// Pricier blazer (COS, $175 vs $95 median) should not be a BUY.
const cos = scoreCandidate(asCandidate(SEED_ANALYSES[1].matches[1]), wardrobe);
assert.equal(cos.verdict, "CONSIDER");

// Empty wardrobe never auto-BUYs.
assert.equal(scoreCandidate(asCandidate(SEED_ANALYSES[1].matches[0]), []).verdict, "CONSIDER");

// Cited names in reasons[0] are exactly the dupes.
for (const d of skip.dupes) assert.ok(skip.reasons[0].includes(d.name), `reason cites ${d.name}`);
console.log("\nall buy-check assertions passed");
