// Live check of Stripe test mode, without touching the database.
//   npm run smoke:stripe        (needs STRIPE_SECRET_KEY=sk_test_... in .env.local)
// Creates a throwaway test customer, saves a Visa test card, and charges $1.00 off-session
// exactly the way the Dripy adapter does after a user's YES.
import assert from "node:assert/strict";
import Stripe from "stripe";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  assert.ok(/^(sk|rk)_test_/.test(key), "STRIPE_SECRET_KEY must be a TEST key (sk_test_...)");
  const stripe = new Stripe(key);

  const customer = await stripe.customers.create({ name: "Dripy smoke test", metadata: { dripy_smoke: "1" } });
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  console.log(`✓ customer ${customer.id} with ${pm.card?.brand} •••• ${pm.card?.last4}`);

  const pi = await stripe.paymentIntents.create({
    amount: 100,
    currency: "usd",
    customer: customer.id,
    payment_method: pm.id,
    allowed_payment_method_types: ["card"],
    description: "Dripy smoke test",
  });
  const confirmed = await stripe.paymentIntents.confirm(pi.id, { off_session: true });
  assert.equal(confirmed.status, "succeeded", `expected succeeded, got ${confirmed.status}`);
  console.log(`✓ PaymentIntent ${confirmed.id} ${confirmed.status} (charge ${confirmed.latest_charge})`);

  await stripe.customers.del(customer.id);
  console.log("\nStripe test mode works. See it under Payments in the Stripe dashboard (test mode).");
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
