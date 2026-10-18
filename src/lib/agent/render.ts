// Cards -> plain-text bubbles for iMessage/SMS/WhatsApp. Kept tight: one text bubble
// for the reply, one for card details, and at most one image (QA: too many bubbles).
// Product links are printed raw (iMessage makes them tappable), each URL at most once.

import { env } from "@/lib/env";
import { formatMoney } from "@/lib/http";
import type { Card } from "@/lib/types";

export type OutboundPart = { kind: "text"; text: string } | { kind: "image"; url: string };

const VERDICT_ICON = { BUY: "✅", SKIP: "🙅", CONSIDER: "🤔" } as const;

/** The URL once per reply: returns it the first time, null after. */
function link(url: string | null | undefined, shown: Set<string>): string | null {
  if (!url || shown.has(url)) return null;
  shown.add(url);
  return url;
}

function cardText(card: Card, shown: Set<string>): { text: string | null; image: string | null } {
  switch (card.type) {
    case "reel_matches": {
      if (!card.matches.length) {
        return { text: card.identified.length ? `Spotted: ${card.identified.map((g) => g.label).join(", ")}` : null, image: null };
      }
      const lines = card.matches.slice(0, 3).map((m, i) => {
        const url = link(m.url, shown);
        return `${i + 1}. ${m.name} — ${formatMoney(m.price_cents, m.currency)} at ${m.merchant_domain ?? m.merchant}${url ? `\n${url}` : ""}`;
      });
      return { text: `Spotted: ${card.identified[0]?.label ?? "this look"}\n${lines.join("\n")}`, image: card.matches[0].image_url ?? null };
    }
    case "verdict": {
      const reasons = card.reasons.slice(0, 3).map((r) => `• ${r}`);
      const url = link(card.item.url, shown);
      const price = card.item.price_cents != null ? ` — ${formatMoney(card.item.price_cents)}` : "";
      return {
        text: `${VERDICT_ICON[card.verdict]} ${card.verdict}: ${card.headline}\n(${card.item.name}${price})\n${reasons.join("\n")}${url ? `\n🛒 ${url}` : ""}`,
        image: null,
      };
    }
    case "purchase_intent": {
      // The reply already carries "Reply YES to pay…"; add the store link for buying it yourself.
      const url = card.status === "awaiting_approval" ? link(card.merchant_url, shown) : null;
      return { text: url ? `Rather check out yourself? ${url}` : null, image: null };
    }
    case "payment_confirmation":
      return { text: null, image: null }; // the reply already says paid + receipt; refs stay in the web card
    case "places": {
      const lines = card.places.slice(0, 3).map((p) => {
        const hours = p.open_now === true ? `open now, ${p.hours_today}` : p.hours_today ?? "hours unknown";
        return `📍 ${p.name} — ${p.distance_km} km, ${hours}\n${p.maps_url ?? p.address ?? ""}`;
      });
      return { text: lines.join("\n\n") || null, image: null };
    }
    case "outfit":
      return {
        text: `👕 ${card.title}: ${card.items.map((i) => i.name).join(" + ")}${card.note ? `\n${card.note}` : ""}`,
        image: card.items[0]?.image_url ?? null,
      };
    case "weather":
      return { text: `🌦 ${card.label}: ${card.summary}, ${card.high_f}°/${card.low_f}°F${card.precip_chance != null ? `, ${card.precip_chance}% rain` : ""}`, image: null };
    case "error":
      return { text: null, image: null };
  }
}

export function renderForMessaging(reply: string, cards: Card[]): OutboundPart[] {
  const parts: OutboundPart[] = [];
  if (reply.trim()) parts.push({ kind: "text", text: reply.trim() });
  // Links the model already wrote into its reply aren't repeated below it.
  const shown = new Set<string>(reply.match(/https?:\/\/\S+/g) ?? []);
  const rendered = cards.map((c) => cardText(c, shown));
  const details = rendered.map((r) => r.text).filter((t): t is string => !!t);
  if (details.length) parts.push({ kind: "text", text: details.join("\n\n") });
  const image = rendered.find((r) => r.image)?.image;
  // Catalog photos are stored as site paths ("/images/..."); the worker needs a full URL.
  if (image) parts.push({ kind: "image", url: image.startsWith("/") ? `${env.appUrl}${image}` : image });
  return parts;
}
