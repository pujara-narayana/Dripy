-- Stripe test-mode payments (PAYMENT_PROVIDER=stripe). Run after 0001_init.sql.
-- purchase_intents.visa_instruction_id / visa_transaction_id hold the provider's ids:
-- for Stripe, the PaymentIntent id (pi_...) and the Charge id (ch_...).
alter type intent_mode add value if not exists 'stripe_test';

alter table users add column if not exists stripe_customer_id text;
alter table users add column if not exists stripe_payment_method_id text;
