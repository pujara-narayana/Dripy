import { connection, type NextRequest } from "next/server";
import { fail, mockResponse, ok, RequestMeta, fallbackToMock, requestUserId } from "@/lib/http";
import { confirmationCard, expireStale, getIntent, intentCard } from "@/lib/payments/intents";
import { getSavedCard } from "@/lib/users";

// GET /api/purchase-intents/:id?user_id= -> PurchaseIntentResponse (card is the confirmation once paid/failed)
export async function GET(req: NextRequest, ctx: RouteContext<"/api/purchase-intents/[id]">) {
  await connection(); // always run at request time (never prerender the mock)
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("purchase-intents.get", "/api/purchase-intents/:id", mockReason);
  const meta = new RequestMeta();
  const { id } = await ctx.params;
  const userId = requestUserId(req, req.nextUrl.searchParams.get("user_id"));
  await expireStale(userId);
  const intent = await getIntent(id);
  if (!intent || intent.user_id !== userId) return fail(404, "purchase intent not found");
  if (intent.mode === "simulated") meta.markSimulated();
  const card = intent.status === "paid" || intent.status === "failed" ? confirmationCard(intent) : intentCard(intent, await getSavedCard(userId));
  return ok({ id: intent.id, status: intent.status, card }, meta, "/api/purchase-intents/:id");
}
