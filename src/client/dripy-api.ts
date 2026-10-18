// Browser client for the Dripy API routes in src/app/api (same origin, so relative URLs).
// The full contract lives in src/lib/types.ts and BACKEND.md; this file mirrors only what the
// web pages read.

export type Mode = "live" | "cached" | "simulated";

export interface Meta {
  mode: Mode;
  fallback_used: boolean;
  fallbacks?: string[];
}

type ItemRef = { id: string; name: string; brand?: string | null; image_url?: string | null };
type ProductMatch = ItemRef & { url: string; merchant?: string | null; merchant_domain?: string | null; price_cents?: number | null };

export type Card =
  | { type: "outfit"; title: string; items: ItemRef[]; note?: string }
  | { type: "reel_matches"; matches: ProductMatch[] }
  | {
      type: "verdict";
      verdict: "BUY" | "SKIP" | "CONSIDER";
      headline: string;
      item: { name: string; price_cents?: number | null; url?: string | null; image_url?: string | null };
      reasons: string[];
    }
  | { type: "purchase_intent"; item_name: string; prompt: string }
  | { type: "payment_confirmation"; status: "paid" | "failed"; item_name: string; amount_cents: number; reference?: string | null }
  | { type: "places"; places: { id: string; name: string; distance_km: number; hours_today: string | null; maps_url: string | null }[]; nudge?: string | null }
  | { type: "error"; message: string };

export interface ChatResponse {
  reply: string;
  cards: Card[];
  message_id: string | null;
  meta: Meta;
}

export async function sendChat(message: string, signal?: AbortSignal): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
    ...(signal ? { signal } : {}),
  });
  const body = (await res.json().catch(() => null)) as (ChatResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `Dripy API error ${res.status}`);
  return body;
}

/** A garment tile shown under a fairy message. */
export type ChatPick = { id: string; name: string; image?: string | undefined; link?: string | undefined; store: string };

const money = (cents: number | null | undefined) => (cents == null ? "" : `$${(cents / 100).toFixed(2)}`);

/** Garment tiles to show for the cards in a chat reply. */
export function picksFromCards(cards: Card[]): ChatPick[] {
  const picks: ChatPick[] = [];
  for (const card of cards) {
    if (card.type === "outfit") {
      for (const it of card.items) picks.push({ id: it.id, name: it.name, image: it.image_url ?? undefined, store: it.brand ?? "Your closet" });
    } else if (card.type === "reel_matches") {
      for (const m of card.matches)
        picks.push({ id: m.id, name: m.name, image: m.image_url ?? undefined, link: m.url, store: m.merchant ?? m.merchant_domain ?? m.brand ?? "Shop" });
    } else if (card.type === "verdict") {
      picks.push({ id: `verdict-${card.item.name}`, name: card.item.name, image: card.item.image_url ?? undefined, link: card.item.url ?? undefined, store: money(card.item.price_cents) || "Candidate" });
    }
  }
  return picks.slice(0, 6);
}

/** Extra lines of text the cards carry (checkout prompt, receipt, places). */
export function notesFromCards(cards: Card[]): string[] {
  const notes: string[] = [];
  for (const card of cards) {
    if (card.type === "verdict") notes.push(`${card.verdict}: ${card.headline}`);
    else if (card.type === "purchase_intent") notes.push(card.prompt);
    else if (card.type === "payment_confirmation")
      notes.push(card.status === "paid" ? `Paid ${money(card.amount_cents)} for ${card.item_name}${card.reference ? ` (ref ${card.reference})` : ""}` : `Payment for ${card.item_name} failed`);
    else if (card.type === "places") {
      for (const p of card.places.slice(0, 3)) notes.push(`${p.name}: ${p.distance_km.toFixed(1)} km${p.hours_today ? `, ${p.hours_today}` : ""}`);
    } else if (card.type === "error") notes.push(card.message);
  }
  return notes;
}
