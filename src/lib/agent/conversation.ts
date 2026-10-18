import "server-only";
import { type HistoryMessage, runAgent } from "@/lib/agent/loop";
import type { ToolContext } from "@/lib/agent/tools";
import { db, must } from "@/lib/db/client";
import { getUser, listWardrobe } from "@/lib/db/queries";
import { formatMoney, type RequestMeta } from "@/lib/http";
import { paymentLabel } from "@/lib/integrations/payments";
import type { LlmPart } from "@/lib/llm";
import { classifyApproval } from "@/lib/payments/approvalRouter";
import { approveAndPay, cancelIntent, getIntent, getOpenIntent, IntentRejected, intentCard } from "@/lib/payments/intents";
import type { IngestedImage } from "@/lib/storage/ingestImage";
import type { Card, Channel, PaymentConfirmationCard } from "@/lib/types";
import { getSavedCard } from "@/lib/users";

export interface TurnInput {
  userId: string;
  channel: Channel;
  text: string;
  images: IngestedImage[];
  /** Photon message id, for webhook-retry dedupe. */
  externalId?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface TurnResult {
  reply: string;
  cards: Card[];
  messageId: string | null;
  duplicate?: boolean;
  route: "approval" | "agent";
  toolCalls: string[];
}

async function saveMessage(row: {
  user_id: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  body: string | null;
  external_id?: string | null;
  attachments?: unknown[];
  cards?: Card[];
}): Promise<{ id: string } | null> {
  const res = await db().from("chat_messages").insert(row).select("id").single();
  if (res.error?.code === "23505") return null; // duplicate external_id: already processed
  return must(res, "save chat message") as { id: string };
}

async function loadHistory(userId: string, limit = 12): Promise<HistoryMessage[]> {
  const rows = must(
    await db()
      .from("chat_messages")
      .select("direction,body,cards,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    "load history",
  ) as (HistoryMessage & { created_at: string })[];
  return rows.reverse();
}

function paymentReply(card: Card, nudge: string | null): string {
  if (card.type === "payment_confirmation") {
    const c = card as PaymentConfirmationCard;
    if (c.status === "paid") {
      const card = c.card ? `${c.card.brand.toUpperCase()} •••• ${c.card.last4}, ` : "";
      const closet = c.receipt?.emailed
        ? `Your ${c.receipt.retailer} receipt (demo) just landed in your inbox, and it's in your closet now.`
        : "It's in your closet now.";
      return [`Done ✅ Paid ${formatMoney(c.amount_cents, c.currency)} at ${c.merchant_domain} (${card}${paymentLabel(c.mode)}). ${closet}`, nudge]
        .filter(Boolean)
        .join("\n\n");
    }
    return `That payment didn't go through (${c.error ?? "Visa declined it"}). No money moved — want me to try again?`;
  }
  if (card.type === "purchase_intent") {
    if (card.status === "expired") return "That checkout expired, so nothing was charged. Say \"buy it\" again if you still want it.";
    if (card.status === "cancelled") return "That checkout was already cancelled — nothing was charged.";
    return card.prompt;
  }
  return "";
}

/**
 * One user turn, channel-agnostic. Order matters:
 *  1. persist the inbound message (dedupes Photon retries),
 *  2. deterministic approval router (no LLM) if a checkout is waiting,
 *  3. otherwise the agent loop.
 */
export async function handleTurn(input: TurnInput, meta: RequestMeta): Promise<TurnResult> {
  const inbound = await saveMessage({
    user_id: input.userId,
    channel: input.channel,
    direction: "inbound",
    body: input.text || null,
    external_id: input.externalId ?? null,
    attachments: input.images.map((i) => ({ type: "image", url: i.publicUrl })),
  });
  if (!inbound) return { reply: "", cards: [], messageId: null, duplicate: true, route: "agent", toolCalls: [] };

  const [user, open] = await Promise.all([getUser(input.userId), getOpenIntent(input.userId)]);

  // ---- 2. approval router ------------------------------------------------------
  if (open && input.images.length === 0) {
    const cls = classifyApproval(input.text);
    // Only approve the checkout for the product still under discussion (QA #7).
    const sameProduct = !user?.current_match_id || user.current_match_id === open.match_id;
    if (cls === "AFFIRMATIVE" && sameProduct && !(await getSavedCard(input.userId))) {
      // First purchase: no card on file yet, so "yes" points to the web checkout instead of paying.
      const card = intentCard(open, null);
      const reply = `Almost there! ${card.prompt}`;
      const out = await saveMessage({ user_id: input.userId, channel: input.channel, direction: "outbound", body: reply, cards: [card] });
      return { reply, cards: [card], messageId: out?.id ?? null, route: "approval", toolCalls: [] };
    }
    if (cls === "AFFIRMATIVE" && sameProduct) {
      const result = await approveAndPay(open.id, inbound.id, "chat_affirmative", meta);
      const reply = paymentReply(result.card, result.nudge);
      const out = await saveMessage({ user_id: input.userId, channel: input.channel, direction: "outbound", body: reply, cards: [result.card] });
      return { reply, cards: [result.card], messageId: out?.id ?? null, route: "approval", toolCalls: [] };
    }
    if (cls === "NEGATIVE") {
      await cancelIntent(open, "chat_negative", "user");
      const reply = "Cancelled — nothing was charged. Honestly, a solid call.";
      const out = await saveMessage({ user_id: input.userId, channel: input.channel, direction: "outbound", body: reply });
      return { reply, cards: [], messageId: out?.id ?? null, route: "approval", toolCalls: [] };
    }
  }

  // ---- 3. agent ------------------------------------------------------------------
  const [wardrobe, history] = await Promise.all([listWardrobe(input.userId), loadHistory(input.userId)]);
  const priorHistory = history.slice(0, -1); // the inbound message we just saved is sent separately

  const userParts: LlmPart[] = [
    ...input.images.map((img): LlmPart => ({ image: { base64: img.bytes.toString("base64"), mimeType: "image/jpeg" } })),
    { text: input.text || (input.images.length ? "(sent an image with no text)" : "(empty message)") },
  ];

  const now = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  const serverContext = [
    `Server context for this turn (from Dripy, not the user). Now: ${now} (Seattle). Channel: ${input.channel}.`,
    input.images.length ? `The user attached ${input.images.length} image(s) to this message; analyze_image can read them.` : "No image attached to this message.",
    user?.current_match_id ? `Product currently under discussion: match_id ${user.current_match_id}.` : "No product is currently under discussion.",
    open
      ? `A checkout is waiting for the user's YES: ${open.item_name}, ${formatMoney(open.amount_cents)} at ${open.merchant_domain}. If they ask to buy a different product, create a new intent (it replaces this one).`
      : "No checkout is pending.",
  ].join("\n");

  const ctx: ToolContext = {
    userId: input.userId,
    channel: input.channel,
    meta,
    images: input.images,
    lat: input.lat,
    lng: input.lng,
    cards: [],
  };
  const { text, toolCalls } = await runAgent({ ctx, wardrobe, history: priorHistory, userParts, serverContext });

  // The approval instruction must reach the user even if the model's text omits it.
  let reply = text || "Hmm, I blanked on that — mind sending it again?";
  const intent = ctx.cards.find((c) => c.type === "purchase_intent");
  if (intent && intent.type === "purchase_intent") {
    const said = intent.needs_card && intent.checkout_url ? reply.includes(intent.checkout_url) : /reply yes/i.test(reply);
    if (!said) reply = `${reply}\n\n${intent.prompt}`;
  }

  const out = await saveMessage({ user_id: input.userId, channel: input.channel, direction: "outbound", body: reply, cards: ctx.cards });
  return { reply, cards: ctx.cards, messageId: out?.id ?? null, route: "agent", toolCalls };
}

/** Approve from the web button: synthesize an inbound message as the approval proof (QA #6). */
export async function approveFromButton(userId: string, intentId: string, meta: RequestMeta) {
  const intent = await getIntent(intentId);
  if (!intent || intent.user_id !== userId) throw new IntentRejected("purchase intent not found");
  const proof = await saveMessage({ user_id: userId, channel: "web", direction: "inbound", body: "[approved via Approve button]" });
  if (!proof) throw new Error("could not record approval");
  const result = await approveAndPay(intentId, proof.id, "approve_endpoint", meta);
  const reply = paymentReply(result.card, result.nudge);
  await saveMessage({ user_id: userId, channel: "web", direction: "outbound", body: reply, cards: [result.card] });
  return { ...result, reply };
}

export { intentCard };
