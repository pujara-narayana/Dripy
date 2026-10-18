import { fail, fallbackToMock, ok, readJson, RequestMeta, requestUserId } from "@/lib/http";
import { IntentRejected, intentCard } from "@/lib/payments/intents";
import { buyFromShop } from "@/lib/shop";
import { getSavedCard } from "@/lib/users";

// POST /api/shop/buy {product_id} -> {id, status, card, saved_card}. card.needs_card: send the user to
// card.checkout_url; otherwise approve with POST /api/checkout/:id (saved card).
export async function POST(req: Request) {
  if (fallbackToMock()) return fail(503, "Buying needs the database.");
  const meta = new RequestMeta();
  try {
    const body = await readJson(req);
    if (typeof body.product_id !== "string") return fail(400, "product_id is required");
    const userId = requestUserId(req, body.user_id);
    const intent = await buyFromShop(userId, body.product_id);
    if (intent.mode === "simulated") meta.markSimulated();
    const savedCard = await getSavedCard(userId);
    return ok({ id: intent.id, status: intent.status, card: intentCard(intent, savedCard), saved_card: savedCard }, meta, "/api/shop/buy");
  } catch (err) {
    if (err instanceof IntentRejected) return fail(422, err.message);
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "could not start checkout");
  }
}
