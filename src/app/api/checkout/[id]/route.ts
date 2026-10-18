import { connection, type NextRequest } from "next/server";
import { CardRejected, checkoutSummary, payIntent, validateVisa } from "@/lib/checkout";
import { fail, fallbackToMock, ok, readJson, RequestMeta } from "@/lib/http";
import { getIntent, IntentRejected } from "@/lib/payments/intents";
import { sessionUserFromCookieHeader, verifyToken } from "@/lib/tokens";

export const maxDuration = 30;

// The web checkout. Access: the signed link Dripy texted (?t= / body.t), or a session for
// the intent's owner.
//   GET  /api/checkout/:id?t=          -> {checkout: CheckoutSummary}
//   POST /api/checkout/:id {t?, card?} -> {status, card, reply}. card = {number, exp, cvc, name};
//        leave it out to pay with the card on file.

async function authorizedIntent(req: Request, id: string, token: unknown) {
  const intent = await getIntent(id);
  if (!intent) return null;
  const viaLink = verifyToken("checkout", typeof token === "string" ? token : null) === id;
  const viaSession = sessionUserFromCookieHeader(req.headers.get("cookie")) === intent.user_id;
  return viaLink || viaSession ? intent : null;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/checkout/[id]">) {
  await connection();
  if (fallbackToMock()) return fail(503, "Checkout needs the database.");
  const { id } = await ctx.params;
  const intent = await authorizedIntent(req, id, req.nextUrl.searchParams.get("t"));
  if (!intent) return fail(404, "This checkout link isn't valid (it may have expired).");
  return ok({ checkout: await checkoutSummary(intent) }, new RequestMeta(), "/api/checkout/:id");
}

export async function POST(req: Request, ctx: RouteContext<"/api/checkout/[id]">) {
  if (fallbackToMock()) return fail(503, "Checkout needs the database.");
  const meta = new RequestMeta();
  const { id } = await ctx.params;
  try {
    const body = await readJson(req);
    const intent = await authorizedIntent(req, id, body.t);
    if (!intent) return fail(404, "This checkout link isn't valid (it may have expired).");
    if (intent.status !== "awaiting_approval") return fail(409, `This checkout is already ${intent.status}.`);
    const card = body.card && typeof body.card === "object" ? validateVisa(body.card as Record<string, unknown>) : null;
    const result = await payIntent(intent, card, meta);
    if (result.intent.status === "expired" || result.intent.status === "cancelled") {
      return Response.json({ error: `This checkout is ${result.intent.status}; nothing was charged.`, status: result.intent.status }, { status: 409 });
    }
    return ok({ status: result.intent.status, card: result.card, reply: result.reply, imessaged: result.imessaged }, meta, "/api/checkout/:id", {
      status: result.intent.status,
    });
  } catch (err) {
    if (err instanceof CardRejected) return fail(422, err.message);
    if (err instanceof IntentRejected) return fail(404, err.message);
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "payment failed");
  }
}
