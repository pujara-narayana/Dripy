import "server-only";
import { approveFromButton } from "@/lib/agent/conversation";
import { renderForMessaging } from "@/lib/agent/render";
import { db, must } from "@/lib/db/client";
import type { RequestMeta } from "@/lib/http";
import { pushToImessage } from "@/lib/notify";
import { expireStale, getIntent, type IntentRow } from "@/lib/payments/intents";
import { getSavedCard, saveCard, type SavedCard } from "@/lib/users";

// The web checkout page behind the link Dripy texts for a first purchase: enter a (demo)
// Visa card, then pay. Only brand + last 4 are kept. The payment itself is the normal
// approve path (approveFromButton), so every safety rule of the state machine still applies.

export class CardRejected extends Error {}

export interface CheckoutSummary {
  id: string;
  status: IntentRow["status"];
  item_name: string;
  amount_cents: number;
  currency: string;
  merchant_domain: string;
  merchant_url: string;
  image_url: string | null;
  mode: IntentRow["mode"];
  saved_card: SavedCard | null;
}

export async function checkoutSummary(intent: IntentRow): Promise<CheckoutSummary> {
  await expireStale(intent.user_id);
  const fresh = (await getIntent(intent.id)) ?? intent;
  const match = fresh.match_id
    ? (must(await db().from("product_matches").select("image_url").eq("id", fresh.match_id).maybeSingle(), "load match image") as { image_url: string | null } | null)
    : null;
  return {
    id: fresh.id,
    status: fresh.status,
    item_name: fresh.item_name,
    amount_cents: fresh.amount_cents,
    currency: fresh.currency,
    merchant_domain: fresh.merchant_domain,
    merchant_url: fresh.merchant_url,
    image_url: match?.image_url ?? null,
    mode: fresh.mode,
    saved_card: await getSavedCard(fresh.user_id),
  };
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

/** Validate a Visa card (number, MM/YY expiry, CVC, name) and return what we keep. */
export function validateVisa(card: { number?: unknown; exp?: unknown; cvc?: unknown; name?: unknown }): SavedCard {
  const number = String(card.number ?? "").replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(number) || !luhn(number)) throw new CardRejected("That card number isn't valid.");
  if (!number.startsWith("4")) throw new CardRejected("Dripy pays with Visa. Use a Visa card (it starts with 4).");
  const exp = String(card.exp ?? "").match(/^\s*(\d{1,2})\s*\/\s*(\d{2})\s*$/);
  const month = Number(exp?.[1]);
  const year = 2000 + Number(exp?.[2]);
  const now = new Date();
  if (!exp || month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    throw new CardRejected("Check the expiry date (MM/YY).");
  }
  if (!/^\d{3}$/.test(String(card.cvc ?? "").trim())) throw new CardRejected("The CVC is the 3 digits on the back.");
  if (!String(card.name ?? "").trim()) throw new CardRejected("Enter the name on the card.");
  return { brand: "visa", last4: number.slice(-4) };
}

/** Save the card (when one is given) and pay. Tells the user in iMessage too, best effort. */
export async function payIntent(intent: IntentRow, card: SavedCard | null, meta: RequestMeta) {
  if (card) await saveCard(intent.user_id, card);
  else if (!(await getSavedCard(intent.user_id))) throw new CardRejected("Add a Visa card to pay.");
  const result = await approveFromButton(intent.user_id, intent.id, meta);
  const imessaged = await pushToImessage(intent.user_id, renderForMessaging(result.reply, [result.card]));
  return { ...result, imessaged };
}
