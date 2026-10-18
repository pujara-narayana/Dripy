import type Stripe from "stripe";
import { isForced } from "@/lib/env";
import { fail } from "@/lib/http";
import { stripeConfigured, verifyWebhook } from "@/lib/integrations/stripe";
import { reconcileProviderOutcome } from "@/lib/payments/intents";

// POST /api/webhooks/stripe — Stripe calls this, not the frontend.
// The chat/approve flow already records synchronous card results; this reconciles any
// outcome Stripe reports later (or that a crashed request missed). It can only finish
// payments the user already approved — it never approves anything.
// Local dev: stripe listen --forward-to localhost:3000/api/webhooks/stripe
export async function POST(req: Request) {
  if (!stripeConfigured() || isForced("db")) return fail(503, "stripe webhooks not configured");
  let event: Stripe.Event;
  try {
    event = verifyWebhook(await req.text(), req.headers.get("stripe-signature"));
  } catch (err) {
    return fail(400, `invalid webhook: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const intentId = pi.metadata?.dripy_intent_id;
    if (intentId) {
      const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : (pi.latest_charge?.id ?? null);
      const status = await reconcileProviderOutcome(
        intentId,
        event.type === "payment_intent.succeeded" ? "succeeded" : "failed",
        { reference: pi.id, transactionId: charge, error: pi.last_payment_error?.message },
      );
      console.log(JSON.stringify({ route: "/api/webhooks/stripe", event: event.type, intentId, status }));
    }
  }
  return Response.json({ received: true });
}
