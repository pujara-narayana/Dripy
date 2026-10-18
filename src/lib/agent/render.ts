// Cards -> plain-text bubbles for iMessage/SMS/WhatsApp. Kept tight: one text bubble
// for the reply, one for card details, and at most one image (QA: too many bubbles).

import { formatMoney } from "@/lib/http";
import type { Card } from "@/lib/types";

export type OutboundPart = { kind: "text"; text: string } | { kind: "image"; url: string };

const VERDICT_ICON = { BUY: "✅", SKIP: "🙅", CONSIDER: "🤔" } as const;

function cardText(card: Card): { text: string | null; image: string | null } {
  switch (card.type) {
    case "reel_matches": {
      if (!card.matches.length) {
        return { text: card.identified.length ? `Spotted: ${card.identified.map((g) => g.label).join(", ")}` : null, image: null };
      }
      const lines = card.matches
        .slice(0, 3)
        .map((m, i) => `${i + 1}. ${m.name} — ${formatMoney(m.price_cents, m.currency)} at ${m.merchant_domain ?? m.merchant}`);
      return { text: `Spotted: ${card.identified[0]?.label ?? "this look"}\n${lines.join("\n")}`, image: card.matches[0].image_url ?? null };
    }
    case "verdict": {
      const reasons = card.reasons.slice(0, 3).map((r) => `• ${r}`);
      return { text: `${VERDICT_ICON[card.verdict]} ${card.verdict}: ${card.headline}\n${reasons.join("\n")}`, image: null };
    }
    case "purchase_intent":
      return { text: null, image: null }; // the reply already carries "Reply YES to pay…"
    case "payment_confirmation":
      return card.status === "paid"
        ? { text: `🧾 Ref ${card.reference ?? card.visa_transaction_id ?? card.visa_instruction_id}${card.mode === "simulated" ? " (simulated)" : card.mode === "stripe_test" ? " (Stripe test mode)" : ""}`, image: null }
        : { text: null, image: null };
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
    case "error":
      return { text: null, image: null };
  }
}

export function renderForMessaging(reply: string, cards: Card[]): OutboundPart[] {
  const parts: OutboundPart[] = [];
  if (reply.trim()) parts.push({ kind: "text", text: reply.trim() });
  const rendered = cards.map(cardText);
  const details = rendered.map((r) => r.text).filter((t): t is string => !!t);
  if (details.length) parts.push({ kind: "text", text: details.join("\n\n") });
  const image = rendered.find((r) => r.image)?.image;
  if (image) parts.push({ kind: "image", url: image });
  return parts;
}
