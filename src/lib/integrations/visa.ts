import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { env } from "@/lib/env";

import type { PaymentAdapter, PurchaseInstruction } from "@/lib/integrations/payments";

// Visa Intelligent Commerce (Visa Acceptance Platform, /acp/v1). Two adapters with
// identical shapes: `simulated` (default, always works) and `sandbox` (real HTTP
// Signature calls, enabled with PAYMENT_PROVIDER=visa_sandbox once Visa credentials land).

// ---- simulated ---------------------------------------------------------------------

export const visaSimulated: PaymentAdapter = {
  mode: () => "simulated",
  async createInstruction(i) {
    return { instructionId: `sim_instr_${stableId(i.clientCorrelationId, "instr")}` };
  },
  async retrieveCredentials(_id, i) {
    return { transactionId: `sim_txn_${stableId(i.clientCorrelationId, "txn")}`, status: "AUTHORIZED" };
  },
  async confirm(_id, i) {
    return {
      transactionId: `sim_txn_${stableId(i.clientCorrelationId, "txn")}`,
      status: "COMPLETED",
      signedPayload: "SIMULATED",
    };
  },
};

/** Same intent -> same ids, so a retried payment maps to the same "instruction". */
function stableId(seed: string, salt: string) {
  return createHash("sha256").update(`${salt}:${seed}`).digest("hex").slice(0, 12);
}

// ---- sandbox (HTTP Signature, shared-secret key) ----------------------------------
// Signing follows the Visa Acceptance / CyberSource HTTP Signature scheme. Request
// body field names are taken from the public /acp/v1 docs; verify against the Visa
// Developer MCP before the first live call (UNVERIFIED until a sandbox call succeeds).

function signedHeaders(method: string, path: string, body: string): Record<string, string> {
  const host = new URL(env.visaBaseUrl).host;
  const date = new Date().toUTCString();
  const digest = `SHA-256=${createHash("sha256").update(body).digest("base64")}`;
  const merchantId = env.visaMerchantId ?? "";
  const signingString = [
    `host: ${host}`,
    `date: ${date}`,
    `request-target: ${method.toLowerCase()} ${path}`,
    `digest: ${digest}`,
    `v-c-merchant-id: ${merchantId}`,
  ].join("\n");
  const signature = createHmac("sha256", Buffer.from(env.visaSharedSecret ?? "", "base64"))
    .update(signingString)
    .digest("base64");
  return {
    host,
    date,
    digest,
    "v-c-merchant-id": merchantId,
    "content-type": "application/json",
    signature: `keyid="${env.visaKeyId}", algorithm="HmacSHA256", headers="host date request-target digest v-c-merchant-id", signature="${signature}"`,
  };
}

async function visaPost<T>(path: string, payload: unknown): Promise<T> {
  const body = JSON.stringify(payload);
  const res = await fetch(`${env.visaBaseUrl}${path}`, {
    method: "POST",
    headers: signedHeaders("POST", path, body),
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`visa ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

function instructionBody(i: PurchaseInstruction) {
  return {
    clientReferenceInformation: { code: i.clientCorrelationId },
    tokenRequesterId: env.visaTokenRequesterId,
    relationshipId: env.visaRelationshipId,
    paymentInformation: {
      customer: { id: env.visaCustomerId },
      instrumentIdentifier: { id: env.visaInstrumentId },
    },
    mandates: [
      {
        type: "PURCHASE",
        description: i.description,
        amount: { totalAmount: (i.amountCents / 100).toFixed(2), currency: i.currency },
        merchant: { name: i.merchantName, url: i.merchantUrl },
      },
    ],
  };
}

export const visaSandbox: PaymentAdapter = {
  mode: () => "sandbox",
  async createInstruction(i) {
    const r = await visaPost<{ instructionId?: string; id?: string }>("/acp/v1/instructions", instructionBody(i));
    const instructionId = r.instructionId ?? r.id;
    if (!instructionId) throw new Error("visa: no instructionId in response");
    return { instructionId };
  },
  async retrieveCredentials(instructionId, i) {
    const r = await visaPost<{ transactionId?: string; status?: string }>(
      `/acp/v1/instructions/${instructionId}/credentials`,
      {
        clientReferenceInformation: { code: i.clientCorrelationId },
        orderInformation: { amountDetails: { totalAmount: (i.amountCents / 100).toFixed(2), currency: i.currency } },
      },
    );
    return { transactionId: r.transactionId ?? randomUUID(), status: r.status ?? "UNKNOWN" };
  },
  async confirm(instructionId, i) {
    const r = await visaPost<{ transactionId?: string; status?: string; signedPayload?: string }>(
      `/acp/v1/instructions/${instructionId}/confirmations`,
      { clientReferenceInformation: { code: i.clientCorrelationId }, status: "COMPLETED" },
    );
    return {
      transactionId: r.transactionId ?? "",
      status: r.status === "COMPLETED" ? "COMPLETED" : "FAILED",
      signedPayload: r.signedPayload,
    };
  },
};

export function visaConfigured(): boolean {
  return !!(env.visaMerchantId && env.visaKeyId && env.visaSharedSecret);
}
