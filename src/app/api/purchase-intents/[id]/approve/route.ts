import { approveFromButton } from "@/lib/agent/conversation";
import { fail, mockResponse, ok, readJson, RequestMeta, fallbackToMock, userIdFrom } from "@/lib/http";
import { IntentRejected } from "@/lib/payments/intents";

export const maxDuration = 30;

// POST /api/purchase-intents/:id/approve {user_id} -> ApproveResponse
// The web "Approve" button. Atomic: racing a chat "yes" can never double-charge.
export async function POST(req: Request, ctx: RouteContext<"/api/purchase-intents/[id]/approve">) {
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("purchase-intents.approve", "/api/purchase-intents/:id/approve", mockReason);
  const meta = new RequestMeta();
  const { id } = await ctx.params;
  try {
    const body = await readJson(req);
    const result = await approveFromButton(userIdFrom(body.user_id), id, meta);
    if (result.intent.status === "expired" || result.intent.status === "cancelled") {
      return Response.json(
        { error: `This checkout is ${result.intent.status}; nothing was charged.`, status: result.intent.status, card: result.card },
        { status: 409 },
      );
    }
    return ok({ status: result.intent.status, card: result.card, reply: result.reply, nudge: result.nudge }, meta, "/api/purchase-intents/:id/approve", {
      status: result.intent.status,
    });
  } catch (err) {
    if (err instanceof IntentRejected) return fail(404, err.message);
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "approval failed");
  }
}
