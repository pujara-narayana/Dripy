import { fail, mockResponse, ok, readJson, RequestMeta, fallbackToMock, requestUserId } from "@/lib/http";
import { createIntent, intentCard, IntentRejected } from "@/lib/payments/intents";
import { getSavedCard } from "@/lib/users";

// POST /api/purchase-intents {user_id, match_id} -> PurchaseIntentResponse
// Amount and merchant are derived server-side from the match; any amount sent is ignored.
export async function POST(req: Request) {
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("purchase-intents.create", "/api/purchase-intents", mockReason);
  const meta = new RequestMeta();
  try {
    const body = await readJson(req);
    if (typeof body.match_id !== "string") return fail(400, "match_id is required (amounts come from the matched product)");
    const userId = requestUserId(req, body.user_id);
    const intent = await createIntent(userId, body.match_id);
    if (intent.mode === "simulated") meta.markSimulated();
    return ok({ id: intent.id, status: intent.status, card: intentCard(intent, await getSavedCard(userId)) }, meta, "/api/purchase-intents");
  } catch (err) {
    if (err instanceof IntentRejected) return fail(422, err.message);
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "could not create intent");
  }
}
