import "server-only";
import { env } from "@/lib/env";
import { stripeAdapter, stripeConfigured } from "@/lib/integrations/stripe";
import { visaConfigured, visaSandbox, visaSimulated } from "@/lib/integrations/visa";

// One payment interface, three rails. The purchase-intent state machine
// (payments/intents.ts) only talks to this; swapping rails never touches the
// approval logic.
//   simulated    – deterministic fake ids, zero setup (default)
//   stripe_test  – real Stripe test-mode PaymentIntent on a saved Visa test card
//   sandbox      – Visa Intelligent Commerce sandbox (needs Visa-issued credentials)

export type PaymentMode = "simulated" | "stripe_test" | "sandbox";

export interface PurchaseInstruction {
  clientCorrelationId: string; // our intent id; makes retries idempotent
  userId: string;
  amountCents: number;
  currency: string;
  merchantName: string;
  merchantUrl: string;
  description: string;
}

export interface PaymentCard {
  brand: string;
  last4: string;
}

export interface PaymentAdapter {
  mode(): PaymentMode;
  createInstruction(i: PurchaseInstruction): Promise<{ instructionId: string }>;
  retrieveCredentials(instructionId: string, i: PurchaseInstruction): Promise<{ transactionId: string; status: string }>;
  confirm(
    instructionId: string,
    i: PurchaseInstruction,
  ): Promise<{ transactionId: string; status: "COMPLETED" | "FAILED"; signedPayload?: string; card?: PaymentCard; error?: string }>;
}

export function paymentAdapter(): PaymentAdapter {
  if (env.forceFallback.includes("visa") || env.forceFallback.includes("payments")) return visaSimulated;
  if (env.paymentProvider === "stripe" && stripeConfigured()) return stripeAdapter;
  if (env.paymentProvider === "visa_sandbox" && visaConfigured()) return visaSandbox;
  return visaSimulated;
}

/** Human label used in chat replies and checkout prompts. */
export function paymentLabel(mode: PaymentMode): string {
  switch (mode) {
    case "stripe_test":
      return "Visa test card via Stripe test mode";
    case "sandbox":
      return "Visa Intelligent Commerce sandbox";
    default:
      return "Visa, simulated";
  }
}
