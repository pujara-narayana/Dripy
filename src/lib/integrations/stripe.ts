import "server-only";
import Stripe from "stripe";
import { db, must } from "@/lib/db/client";
import { env } from "@/lib/env";
import type { PaymentAdapter, PaymentCard, PurchaseInstruction } from "@/lib/integrations/payments";

// Stripe TEST MODE only. The agent pays with a saved Visa test card (4242) attached to
// the user's Stripe customer, off-session, after the user's explicit YES.

let client: Stripe | null = null;
export function stripe(): Stripe {
  client ??= new Stripe(env.stripeSecretKey!, { maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

/** Refuse live keys outright: a hackathon demo must never move real money. */
export function stripeConfigured(): boolean {
  const key = env.stripeSecretKey ?? "";
  if (/^(sk|rk)_live_/.test(key)) {
    console.error("STRIPE_SECRET_KEY is a LIVE key; refusing to use it. Use an sk_test_ key.");
    return false;
  }
  return /^(sk|rk)_test_/.test(key);
}

interface StripeUser {
  id: string;
  name: string;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
}

/**
 * Lazily give the user a Stripe customer with a saved Visa test card. In production this
 * card would come from a SetupIntent the user completes in the app.
 */
async function ensureCustomer(userId: string): Promise<{ customer: string; paymentMethod: string }> {
  const user = must(
    await db().from("users").select("id,name,email,stripe_customer_id,stripe_payment_method_id").eq("id", userId).single(),
    "load user for stripe",
  ) as StripeUser;
  if (user.stripe_customer_id && user.stripe_payment_method_id) {
    try {
      // Saved ids may belong to a different Stripe account if the key changed.
      await stripe().paymentMethods.retrieve(user.stripe_payment_method_id);
      return { customer: user.stripe_customer_id, paymentMethod: user.stripe_payment_method_id };
    } catch (err) {
      if (!(err instanceof Stripe.errors.StripeInvalidRequestError)) throw err;
      user.stripe_customer_id = null;
    }
  }
  const customer =
    user.stripe_customer_id ??
    (
      await stripe().customers.create(
        { name: user.name, email: user.email ?? undefined, metadata: { dripy_user_id: user.id } },
        { idempotencyKey: `dripy-customer-${user.id}-${env.stripeSecretKey!.slice(-6)}` },
      )
    ).id;
  // pm_card_visa is Stripe's test token for a Visa card ending 4242.
  const pm = await stripe().paymentMethods.attach("pm_card_visa", { customer });
  await stripe().customers.update(customer, { invoice_settings: { default_payment_method: pm.id } });
  must(
    await db().from("users").update({ stripe_customer_id: customer, stripe_payment_method_id: pm.id }).eq("id", userId),
    "save stripe ids",
  );
  return { customer, paymentMethod: pm.id };
}

function cardOf(pi: Stripe.PaymentIntent): PaymentCard | undefined {
  const pm = pi.payment_method;
  if (pm && typeof pm === "object" && pm.card) return { brand: pm.card.brand, last4: pm.card.last4 };
  return undefined;
}

export const stripeAdapter: PaymentAdapter = {
  mode: () => "stripe_test",

  // "Instruction" = an unconfirmed PaymentIntent scoped to this exact amount and merchant.
  async createInstruction(i: PurchaseInstruction) {
    const { customer, paymentMethod } = await ensureCustomer(i.userId);
    const pi = await stripe().paymentIntents.create(
      {
        amount: i.amountCents,
        currency: i.currency.toLowerCase(),
        customer,
        payment_method: paymentMethod,
        allowed_payment_method_types: ["card"],
        description: `Dripy agent purchase: ${i.description} at ${i.merchantName}`,
        metadata: { dripy_intent_id: i.clientCorrelationId, merchant: i.merchantName, merchant_url: i.merchantUrl.slice(0, 450) },
      },
      { idempotencyKey: `dripy-pi-${i.clientCorrelationId}` },
    );
    return { instructionId: pi.id };
  },

  async retrieveCredentials(instructionId: string) {
    const pi = await stripe().paymentIntents.retrieve(instructionId);
    return { transactionId: pi.id, status: pi.status };
  },

  async confirm(instructionId: string, i: PurchaseInstruction) {
    let pi = await stripe().paymentIntents.retrieve(instructionId, { expand: ["payment_method"] });
    if (pi.status !== "succeeded") {
      try {
        pi = await stripe().paymentIntents.confirm(
          instructionId,
          { off_session: true, expand: ["payment_method"] },
          { idempotencyKey: `dripy-confirm-${i.clientCorrelationId}` },
        );
      } catch (err) {
        if (err instanceof Stripe.errors.StripeCardError) {
          return { transactionId: instructionId, status: "FAILED" as const, error: err.message };
        }
        throw err;
      }
    }
    const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
    return {
      transactionId: charge ?? pi.id,
      status: pi.status === "succeeded" ? ("COMPLETED" as const) : ("FAILED" as const),
      card: cardOf(pi),
      ...(pi.status !== "succeeded" ? { error: `payment ${pi.status}` } : {}),
    };
  },
};

/** Verify a Stripe webhook signature against the raw request body. */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event {
  if (!env.stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("missing stripe-signature header");
  return stripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
}
