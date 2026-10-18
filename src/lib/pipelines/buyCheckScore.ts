// Pure buy-check scoring. No I/O, so it is unit-testable and deterministic.
//
// Three signals, deliberately decoupled (QA 1.1):
//   similarity  same subcategory/color as something you own   -> drives SKIP
//   gap         nothing you own in this category covers its
//               primary occasion                               -> drives BUY
//   price       candidate vs market median                     -> tips the balance
// The cited items in `reasons` are always exactly the items in `dupes`.

import type { Verdict, VerdictCard, WardrobeItem } from "@/lib/types";

export interface Candidate {
  name: string;
  category: string;
  subcategory?: string | null;
  color?: string | null;
  occasion_tags?: string[];
  price_cents?: number | null;
  market_median_cents?: number | null;
  url?: string | null;
  image_url?: string | null;
  match_id?: string | null;
}

const COLOR_FAMILIES: string[][] = [
  ["black", "charcoal", "jet"],
  ["navy", "dark blue", "indigo"],
  ["blue", "light blue", "denim", "sky blue"],
  ["grey", "gray", "heather grey", "silver"],
  ["white", "off-white", "ivory", "cream", "ecru"],
  ["beige", "tan", "camel", "khaki", "sand", "stone"],
  ["brown", "chocolate", "cognac", "rust", "camel", "tan"],
  ["green", "olive", "sage", "khaki green"],
  ["red", "burgundy", "maroon", "wine"],
  ["pink", "blush", "rose"],
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function colorSimilarity(a?: string | null, b?: string | null): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // A color can sit in two families (camel is both beige-ish and brown-ish).
  const fams = (c: string) => COLOR_FAMILIES.flatMap((f, i) => (f.some((name) => c.includes(name)) ? [i] : []));
  const fy = new Set(fams(y));
  return fams(x).some((i) => fy.has(i)) ? 0.5 : 0;
}

// Words for the same cut ("linen pants" vs "trousers").
const SYNONYMS: [RegExp, string][] = [
  [/\b(pants|slacks)\b/g, "trousers"],
  [/\b(trainers?|sneaker)\b/g, "sneakers"],
  [/\b(tee|t-shirt)\b/g, "tee"],
];
// Garment types that never stand in for the rest of their category: shorts don't replace
// trousers, a skirt doesn't replace jeans.
const DISTINCT_TYPES = [/\bshorts\b/, /\bskirt\b/];

function cut(s: string | null | undefined): string {
  return SYNONYMS.reduce((acc, [re, to]) => acc.replace(re, to), norm(s));
}

export function subcategorySimilarity(c: Candidate, item: WardrobeItem): number {
  if (norm(c.category) !== norm(item.category)) return 0;
  const a = cut(c.subcategory);
  const b = cut(item.subcategory);
  if (a && b && (a === b || a.includes(b) || b.includes(a))) return 1;
  if (DISTINCT_TYPES.some((t) => t.test(a) !== t.test(b))) return 0; // shorts vs trousers
  return 0.5; // same category, different cut
}

/** 0..1 — 1.0 is "basically the same piece". */
export function similarity(c: Candidate, item: WardrobeItem): number {
  if (norm(c.category) !== norm(item.category)) return 0;
  const sub = subcategorySimilarity(c, item);
  if (sub === 0) return 0; // a different kind of garment is never a dupe, whatever the color
  return 0.5 * sub + 0.5 * colorSimilarity(c.color, item.color);
}

export const NEAR_DUPE = 0.75;

export interface Score {
  verdict: Verdict;
  headline: string;
  reasons: string[];
  dupes: VerdictCard["dupes"];
  gap_filled: string | null;
  good_price: boolean | null;
  same_category: WardrobeItem[];
  near: { item: WardrobeItem; s: number }[];
}

function names(items: WardrobeItem[]): string {
  const labels = items.map((i) => (i.brand ? `${i.brand} ${i.name}` : i.name));
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export function scoreCandidate(c: Candidate, wardrobe: WardrobeItem[]): Score {
  const sameCategory = wardrobe.filter((w) => norm(w.category) === norm(c.category));
  const near = sameCategory
    .map((item) => ({ item, s: similarity(c, item) }))
    .filter((x) => x.s >= NEAR_DUPE)
    .sort((a, b) => b.s - a.s);

  const occasion = norm(c.occasion_tags?.[0]) || null;
  const gap = occasion ? !sameCategory.some((w) => w.occasion_tags.map(norm).includes(occasion)) : false;

  const price = c.price_cents ?? null;
  const median = c.market_median_cents ?? null;
  const goodPrice = price != null && median != null ? price <= median : null;

  const priceLine =
    price != null && median != null
      ? goodPrice
        ? `${money(price)} vs ~${money(median)} typical — a fair price.`
        : `${money(price)} is above the ~${money(median)} it usually goes for.`
      : null;

  const reasons: string[] = [];
  let cited: { item: WardrobeItem; s: number }[] = [];
  let verdict: Verdict;
  let headline: string;

  if (wardrobe.length === 0) {
    verdict = "CONSIDER";
    headline = "I don't know your closet yet";
    reasons.push("Sync your receipts or send me a few closet photos so I can check this against what you own.");
    if (priceLine) reasons.push(priceLine);
  } else if (!gap && near.length >= 2) {
    verdict = "SKIP";
    cited = near.slice(0, 3);
    headline = `Skip it — you already have ${near.length === 2 ? "two" : near.length}`;
    reasons.push(
      `You already own ${names(cited.map((x) => x.item))}. This would be ${ordinal(sameCategory.length + 1)} ${c.category === "outerwear" ? "jacket" : c.category}.`,
    );
    if (priceLine) reasons.push(priceLine);
    const leastWorn = [...cited].sort((a, b) => a.item.times_worn - b.item.times_worn)[0]?.item;
    if (leastWorn) reasons.push(`You've worn your ${leastWorn.name} ${wornText(leastWorn.times_worn)}.`);
  } else if (!gap && near.length === 1 && goodPrice === false) {
    verdict = "SKIP";
    cited = near;
    headline = "Skip it — you own something close, for less";
    reasons.push(`You already own ${names(cited.map((x) => x.item))}, which covers the same look.`);
    if (priceLine) reasons.push(priceLine);
  } else if (gap && goodPrice !== false && near.length <= 1) {
    verdict = "BUY";
    cited = sameCategory.slice(0, 3).map((item) => ({ item, s: similarity(c, item) }));
    headline = "Buy it — it fills a real gap";
    if (cited.length) {
      reasons.push(
        `You own ${names(cited.map((x) => x.item))}, but none of them work for ${occasion}.`,
      );
    } else {
      reasons.push(`You don't own anything in ${c.category} for ${occasion} yet.`);
    }
    reasons.push(`Fills your ${occasion} ${c.category} gap.`);
    if (priceLine) reasons.push(priceLine);
    else reasons.push("I couldn't confirm the market price, so double-check before paying.");
  } else if (gap && goodPrice === false) {
    verdict = "CONSIDER";
    cited = near;
    headline = "Fills a gap, but it's pricey";
    reasons.push(`It covers ${occasion}, which your closet is missing.`);
    if (priceLine) reasons.push(priceLine);
  } else {
    verdict = "CONSIDER";
    cited = near.length ? near : [];
    // Owning other things for the same occasion is not a reason to skip: SKIP needs real dupes.
    headline = cited.length ? "Your call" : "Your call — nothing like it in your closet";
    if (cited.length) reasons.push(`It's close to your ${names(cited.map((x) => x.item))}.`);
    else {
      const kind = [c.color, c.subcategory ?? c.category].filter(Boolean).join(" ");
      reasons.push(`Nothing you own is like it; it'd be your first ${kind}.`);
      if (occasion) reasons.push(`You're already covered for ${occasion} ${c.category}s, so it's a want, not a need.`);
    }
    if (priceLine) reasons.push(priceLine);
  }

  return {
    verdict,
    headline,
    reasons,
    dupes: cited.map(({ item, s }) => ({
      item_id: item.id,
      name: item.brand ? `${item.brand} ${item.name}` : item.name,
      image_url: item.image_url,
      similarity: Math.round(s * 100) / 100,
    })),
    gap_filled: verdict === "BUY" || (gap && verdict === "CONSIDER") ? occasion : null,
    good_price: goodPrice,
    same_category: sameCategory,
    near,
  };
}

function ordinal(n: number): string {
  return ["", "a first", "a second", "a third", "a fourth", "a fifth"][n] ?? `number ${n}`;
}

function wornText(n: number): string {
  if (n === 0) return "zero times";
  if (n === 1) return "once";
  return `${n} times`;
}

export function toVerdictCard(c: Candidate, s: Score): VerdictCard {
  return {
    type: "verdict",
    verdict: s.verdict,
    headline: s.headline,
    item: { name: c.name, price_cents: c.price_cents ?? null, url: c.url ?? null, image_url: c.image_url ?? null },
    match_id: c.match_id ?? null,
    reasons: s.reasons,
    dupes: s.dupes,
    gap_filled: s.gap_filled,
    price:
      c.price_cents != null || c.market_median_cents != null
        ? {
            candidate_cents: c.price_cents ?? null,
            market_median_cents: c.market_median_cents ?? null,
            good_price: s.good_price,
          }
        : null,
  };
}
