import "server-only";
import { db, must } from "@/lib/db/client";
import { getOwnedMatch, getUser, listWardrobe, type MatchRow, setCurrentMatch } from "@/lib/db/queries";
import { env } from "@/lib/env";
import { formatMoney, RequestMeta } from "@/lib/http";
import { paymentAdapter, paymentLabel, type PaymentMode } from "@/lib/integrations/payments";
import { deliverPurchaseReceipt } from "@/lib/pipelines/purchaseReceipt";
import { createToken } from "@/lib/tokens";
import { getSavedCard, type SavedCard } from "@/lib/users";
import type { IntentStatus, PaymentConfirmationCard, PurchaseIntentCard } from "@/lib/types";

// Purchase-intent state machine. The model can only PROPOSE (createIntent). Moving to
// approved/paid happens exclusively here, triggered by the user's own message or the
// approve button, never by a model tool. The DB enforces `paid => approved_by_message_id`.
//
//   proposed -> awaiting_approval -> approved -> paid
//                     |                  \-> failed
//                     +-> cancelled | expired

export interface IntentRow {
  id: string;
  user_id: string;
  match_id: string | null;
  item_name: string;
  merchant_url: string;
  merchant_domain: string;
  amount_cents: number;
  currency: string;
  status: IntentStatus;
  mode: PaymentMode;
  visa_instruction_id: string | null;
  visa_transaction_id: string | null;
  approved_by_message_id: string | null;
  approval_expires_at: string | null;
  confirmation_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// A payment stuck in "approved" longer than this is treated as crashed and resumed.
const RESUME_AFTER_MS = 30_000;

export class IntentRejected extends Error {}

async function event(
  intentId: string,
  from: IntentStatus | null,
  to: IntentStatus,
  trigger: string,
  actor: "user" | "system" | "agent",
  detail: Record<string, unknown> = {},
) {
  must(
    await db().from("purchase_intent_events").insert({ intent_id: intentId, from_status: from, to_status: to, trigger, actor, detail }),
    "write intent event",
  );
}

async function transition(
  intent: IntentRow,
  from: IntentStatus,
  to: IntentStatus,
  trigger: string,
  actor: "user" | "system" | "agent",
  patch: Record<string, unknown> = {},
  /** Extra audit detail that isn't a purchase_intents column. */
  detail: Record<string, unknown> = {},
): Promise<IntentRow | null> {
  const res = await db()
    .from("purchase_intents")
    .update({ status: to, updated_at: new Date().toISOString(), ...patch })
    .eq("id", intent.id)
    .eq("status", from) // compare-and-set: lose the race -> no row
    .select("*")
    .maybeSingle();
  const row = must(res, `transition ${from}->${to}`) as IntentRow | null;
  if (row) await event(intent.id, from, to, trigger, actor, { ...patch, ...detail });
  return row;
}

export async function getIntent(id: string): Promise<IntentRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return must(await db().from("purchase_intents").select("*").eq("id", id).maybeSingle(), "load intent") as IntentRow | null;
}

/** Lazily expire stale approvals so a dead intent never blocks the one-open slot. */
export async function expireStale(userId: string) {
  const stale = must(
    await db()
      .from("purchase_intents")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["proposed", "awaiting_approval"])
      .lt("approval_expires_at", new Date().toISOString()),
    "find stale intents",
  ) as IntentRow[];
  for (const s of stale) await transition(s, s.status, "expired", "ttl_expiry", "system");
}

export async function getOpenIntent(userId: string): Promise<IntentRow | null> {
  await expireStale(userId);
  return must(
    await db()
      .from("purchase_intents")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "awaiting_approval")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "load open intent",
  ) as IntentRow | null;
}

/**
 * Propose a purchase. Amount, currency and merchant come from the stored match,
 * never from model arguments. Guards: ownership, a known store + https link, cap, one open intent.
 */
export async function createIntent(userId: string, matchId: string): Promise<IntentRow> {
  const match = await getOwnedMatch(userId, matchId);
  if (!match) throw new IntentRejected("I couldn't find that product anymore — send the photo again?");
  if (match.price_cents == null || match.price_cents <= 0) {
    throw new IntentRejected("I couldn't confirm a price for that one, so I won't set up a payment.");
  }
  // Any store is fine, but we must know which one we're paying and link to it securely.
  if (!match.merchant_domain || !/^https:\/\//.test(match.url)) {
    throw new IntentRejected(
      "I couldn't tell which store sells that one, so I won't set up a payment. Try another match, or use its link to buy it yourself.",
    );
  }
  if (match.price_cents > env.purchaseCapCents) {
    throw new IntentRejected(`That's over your ${formatMoney(env.purchaseCapCents)} per-purchase limit, so I won't queue it.`);
  }

  const open = await getOpenIntent(userId);
  if (open) {
    if (open.match_id === match.id) return open; // idempotent "buy it" twice
    // Switching products: retire the old pending intent so "yes" can't approve the wrong item (QA #7).
    await transition(open, "awaiting_approval", "cancelled", "superseded", "system", {}, { superseded_by_match: match.id });
  }

  const inserted = must(
    await db()
      .from("purchase_intents")
      .insert({
        user_id: userId,
        match_id: match.id,
        item_name: match.brand ? `${match.brand} ${match.name}` : match.name,
        merchant_url: match.url,
        merchant_domain: match.merchant_domain,
        amount_cents: match.price_cents,
        currency: match.currency,
        status: "proposed",
        mode: paymentAdapter().mode(),
        approval_expires_at: new Date(Date.now() + env.approvalTtlMinutes * 60_000).toISOString(),
      })
      .select("*")
      .single(),
    "create intent",
  ) as IntentRow;
  await event(inserted.id, null, "proposed", "model_tool", "agent", { match_id: match.id, amount_cents: match.price_cents });
  await setCurrentMatch(userId, match.id);
  const awaiting = await transition(inserted, "proposed", "awaiting_approval", "model_tool", "system");
  return awaiting ?? inserted;
}

export async function cancelIntent(intent: IntentRow, trigger: string, actor: "user" | "system") {
  return transition(intent, intent.status, "cancelled", trigger, actor);
}

export interface PaymentResult {
  intent: IntentRow;
  card: PaymentConfirmationCard | PurchaseIntentCard;
  nudge: string | null;
}

/**
 * Approve (atomically) and pay. `approvalMessageId` is the user's own chat message,
 * or a synthesized row for a button click, so the DB invariant always has a proof.
 */
export async function approveAndPay(
  intentId: string,
  approvalMessageId: string,
  trigger: "chat_affirmative" | "approve_endpoint",
  meta: RequestMeta,
): Promise<PaymentResult> {
  const current = await getIntent(intentId);
  if (!current) throw new IntentRejected("That purchase doesn't exist.");
  await expireStale(current.user_id);

  // Atomic compare-and-set in Postgres: a racing button + "yes" can't both win (QA #4).
  const won = must(
    await db().rpc("approve_intent", { p_intent_id: intentId, p_message_id: approvalMessageId }),
    "approve intent",
  ) as IntentRow[];
  if (won.length === 1) {
    await event(intentId, "awaiting_approval", "approved", trigger, "user", { message_id: approvalMessageId });
    return runPayment(won[0], meta);
  }

  // Lost the race or not approvable: report the current state instead of paying twice.
  const latest = (await getIntent(intentId))!;
  // Resume only a payment that crashed mid-flight, never one another request is running
  // right now (a racing "yes" + button tap), so Visa is never called twice (QA H2).
  if (latest.status === "approved" && Date.now() - new Date(latest.updated_at).getTime() > RESUME_AFTER_MS) {
    return runPayment(latest, meta);
  }
  return { intent: latest, card: latest.status === "paid" || latest.status === "failed" ? confirmationCard(latest) : intentCard(latest), nudge: null };
}

async function runPayment(intent: IntentRow, meta: RequestMeta): Promise<PaymentResult> {
  if (intent.status === "paid") return { intent, card: confirmationCard(intent), nudge: null };
  if (!intent.approved_by_message_id) throw new Error("refusing to pay an intent without an approval message");

  const visa = paymentAdapter();
  if (visa.mode() === "simulated") meta.markSimulated();
  const instruction = {
    clientCorrelationId: intent.id,
    userId: intent.user_id,
    amountCents: intent.amount_cents,
    currency: intent.currency,
    merchantName: intent.merchant_domain,
    merchantUrl: intent.merchant_url,
    description: intent.item_name,
  };

  try {
    // Pay on the rail the user was quoted; if the config changed since, fail cleanly.
    if (visa.mode() !== intent.mode) {
      throw new Error(`payment setup changed since checkout (${intent.mode} -> ${visa.mode()}); please say "buy it" again`);
    }
    let instructionId = intent.visa_instruction_id;
    if (!instructionId) {
      instructionId = (await visa.createInstruction(instruction)).instructionId;
      // Persist immediately so a crash after this point resumes instead of re-creating.
      must(await db().from("purchase_intents").update({ visa_instruction_id: instructionId }).eq("id", intent.id), "save instruction");
    }
    const creds = await visa.retrieveCredentials(instructionId, instruction);
    const confirmation = await visa.confirm(instructionId, instruction);
    if (confirmation.status !== "COMPLETED") throw new Error(confirmation.error ?? `payment status ${confirmation.status}`);

    const paid = await transition(intent, "approved", "paid", "visa_adapter", "system", {
      visa_instruction_id: instructionId,
      visa_transaction_id: confirmation.transactionId || creds.transactionId,
      mode: visa.mode(),
      // Rails that don't report a card (simulated) show the demo card saved on the checkout page.
      confirmation_json: { credentials_status: creds.status, card: (await getSavedCard(intent.user_id)) ?? undefined, ...confirmation },
    });
    const final = paid ?? (await getIntent(intent.id))!;
    // Only the request that won the approved->paid transition adds the item to the closet.
    const added = paid ? await addPurchaseToWardrobe(paid, meta) : null;
    return { intent: final, card: { ...confirmationCard(final), receipt: added?.receipt ?? null }, nudge: added?.nudge ?? null };
  } catch (err) {
    console.error("payment failed", err);
    const failed = await transition(intent, "approved", "failed", "visa_adapter", "system", {
      confirmation_json: { error: String(err instanceof Error ? err.message : err) },
    });
    const final = failed ?? (await getIntent(intent.id))!;
    return { intent: final, card: confirmationCard(final), nudge: null };
  }
}

/**
 * Reconcile a provider-side outcome (Stripe webhook). Only moves an intent that is
 * already user-approved; never approves anything itself. Idempotent: replays no-op.
 */
export async function reconcileProviderOutcome(
  intentId: string,
  outcome: "succeeded" | "failed",
  ids: { reference: string; transactionId: string | null; error?: string },
): Promise<IntentStatus | null> {
  const intent = await getIntent(intentId);
  if (!intent) return null;
  if (intent.status !== "approved") return intent.status; // paid/failed already, or never approved
  if (outcome === "succeeded") {
    const paid = await transition(intent, "approved", "paid", "stripe_webhook", "system", {
      visa_instruction_id: ids.reference,
      visa_transaction_id: ids.transactionId,
    });
    if (paid) await addPurchaseToWardrobe(paid, new RequestMeta());
    return paid?.status ?? (await getIntent(intentId))?.status ?? null;
  }
  const failed = await transition(intent, "approved", "failed", "stripe_webhook", "system", {
    confirmation_json: { error: ids.error ?? "payment failed" },
  });
  return failed?.status ?? null;
}

/**
 * Close the lifecycle: the store's (demo) receipt is emailed and parsed into the closet, then
 * nudge one-in-one-out. If the email or the parser fails, the item is added directly.
 */
async function addPurchaseToWardrobe(
  intent: IntentRow,
  meta: RequestMeta,
): Promise<{ nudge: string | null; receipt: PaymentConfirmationCard["receipt"] }> {
  if (!intent.match_id) return { nudge: null, receipt: null };
  const match = await getOwnedMatch(intent.user_id, intent.match_id);
  if (!match) return { nudge: null, receipt: null };

  let receipt: PaymentConfirmationCard["receipt"] = null;
  try {
    const user = await getUser(intent.user_id);
    const card = (intent.confirmation_json?.card as PaymentConfirmationCard["card"]) ?? null;
    const r = await deliverPurchaseReceipt(
      {
        intentId: intent.id,
        userId: intent.user_id,
        customerName: user?.name ?? "there",
        // Signed-up accounts get it at their sign-up address; the seeded demo user's address is
        // fake, so its receipt stays in the connected inbox.
        customerEmail: intent.user_id === env.demoUserId ? null : (user?.email ?? null),
        merchantName: match.merchant ?? intent.merchant_domain,
        merchantDomain: intent.merchant_domain,
        merchantUrl: intent.merchant_url,
        item: { name: match.name, brand: match.brand, color: match.color, imageUrl: match.image_url },
        amountCents: intent.amount_cents,
        currency: intent.currency,
        paidAt: new Date(intent.updated_at),
        reference: intent.visa_transaction_id ?? intent.visa_instruction_id,
        card,
        mode: intent.mode,
      },
      meta,
    );
    receipt = { retailer: r.retailer, emailed: r.emailed, wardrobe_item_ids: r.items.map((i) => i.id) };
  } catch (err) {
    console.error("purchase receipt failed; adding the item directly", err);
    meta.fallback("purchase_receipt");
    await insertPurchase(intent.user_id, match);
  }
  await setCurrentMatch(intent.user_id, null);
  return { nudge: await oneInOneOut(intent.user_id, match), receipt };
}

async function insertPurchase(userId: string, match: MatchRow) {
  must(
    await db().from("wardrobe_items").insert({
      user_id: userId,
      name: match.name,
      brand: match.brand,
      category: match.category ?? "outerwear",
      subcategory: match.subcategory,
      color: match.color,
      price_cents: match.price_cents,
      currency: match.currency,
      source: "purchase",
      occasion_tags: match.occasion_tags,
      image_url: match.image_url,
    }),
    "add purchase to wardrobe",
  );
}

async function oneInOneOut(userId: string, match: MatchRow): Promise<string | null> {
  const sameCategory = (await listWardrobe(userId, { category: match.category })).filter((w) => w.source !== "purchase");
  const leastWorn = [...sameCategory].sort((a, b) => a.times_worn - b.times_worn)[0];
  if (!leastWorn || leastWorn.times_worn > 2) return null;
  const count = sameCategory.length + 1;
  const noun = match.category === "outerwear" ? "jackets" : `${match.category ?? "item"}s`;
  const worn = leastWorn.times_worn === 0 ? "you've never worn it" : `you've worn it ${leastWorn.times_worn === 1 ? "once" : `${leastWorn.times_worn} times`}`;
  return `One in, one out? You now have ${count} ${noun}, and your ${leastWorn.brand ? `${leastWorn.brand} ` : ""}${leastWorn.name} — ${worn}. Want me to find a place to donate it?`;
}

/** The web checkout page for an intent, signed so it opens from a text without logging in. */
export function checkoutUrl(intentId: string): string {
  return `${env.appUrl}/checkout/${intentId}?t=${createToken("checkout", intentId)}`;
}

/**
 * `savedCard`: pass the user's card on file (or null for none) to get the card-aware prompt:
 * no card -> "add your Visa card here: <link>"; card -> "Reply YES to pay with VISA •••• 1234".
 * Leave it out for the plain "Reply YES" prompt.
 */
export function intentCard(i: IntentRow, savedCard?: SavedCard | null): PurchaseIntentCard {
  const label = paymentLabel(i.mode);
  const price = formatMoney(i.amount_cents, i.currency);
  const awaiting = i.status === "awaiting_approval";
  const needsCard = awaiting && savedCard === null;
  const url = awaiting ? checkoutUrl(i.id) : null;
  const prompt = !awaiting
    ? `This purchase is ${i.status}.`
    : needsCard
      ? `To pay ${price} at ${i.merchant_domain} (${label}), add your Visa card here: ${url}`
      : savedCard
        ? `Reply YES to pay ${price} at ${i.merchant_domain} with ${savedCard.brand.toUpperCase()} •••• ${savedCard.last4} (${label}), or NO to cancel.`
        : `Reply YES to pay ${price} at ${i.merchant_domain} (${label}), or NO to cancel.`;
  return {
    type: "purchase_intent",
    intent_id: i.id,
    item_name: i.item_name,
    amount_cents: i.amount_cents,
    currency: i.currency,
    merchant_domain: i.merchant_domain,
    merchant_url: i.merchant_url,
    status: i.status,
    approval_expires_at: i.approval_expires_at,
    mode: i.mode,
    prompt,
    checkout_url: url,
    needs_card: needsCard,
  };
}

export function confirmationCard(i: IntentRow): PaymentConfirmationCard {
  return {
    type: "payment_confirmation",
    intent_id: i.id,
    status: i.status === "paid" ? "paid" : "failed",
    item_name: i.item_name,
    amount_cents: i.amount_cents,
    currency: i.currency,
    merchant_domain: i.merchant_domain,
    visa_instruction_id: i.visa_instruction_id,
    visa_transaction_id: i.visa_transaction_id,
    reference: i.visa_transaction_id ?? i.visa_instruction_id,
    card: (i.confirmation_json?.card as PaymentConfirmationCard["card"]) ?? null,
    mode: i.mode,
    ...(i.status === "failed" ? { error: String(i.confirmation_json?.error ?? "payment failed") } : {}),
  };
}
