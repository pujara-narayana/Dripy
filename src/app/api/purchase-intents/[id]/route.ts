import { connection, type NextRequest } from "next/server";
import { fail, mockResponse, ok, RequestMeta, fallbackToMock, userIdFrom } from "@/lib/http";
import { confirmationCard, expireStale, getIntent, intentCard } from "@/lib/payments/intents";

// GET /api/purchase-intents/:id?user_id= -> PurchaseIntentResponse (card is the confirmation once paid/failed)
export async function GET(req: NextRequest, ctx: RouteContext<"/api/purchase-intents/[id]">) {
  await connection(); // always run at request time (never prerender the mock)
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("purchase-intents.get", "/api/purchase-intents/:id", mockReason);
  const meta = new RequestMeta();
  const { id } = await ctx.params;
  const userId = userIdFrom(req.nextUrl.searchParams.get("user_id"));
  await expireStale(userId);
  const intent = await getIntent(id);
  if (!intent || intent.user_id !== userId) return fail(404, "purchase intent not found");
  if (intent.mode === "simulated") meta.markSimulated();
  const card = intent.status === "paid" || intent.status === "failed" ? confirmationCard(intent) : intentCard(intent);
  return ok({ id: intent.id, status: intent.status, card }, meta, "/api/purchase-intents/:id");
}
