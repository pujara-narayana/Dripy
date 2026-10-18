import { db } from "@/lib/db/client";
import { fail, mockResponse, ok, readJson, RequestMeta, fallbackToMock, userIdFrom } from "@/lib/http";
import { buyCheck, BuyCheckError } from "@/lib/pipelines/buyCheck";

export const maxDuration = 30;

// POST /api/buy-check {user_id, match_id? | item_url? | item_desc?} -> BuyCheckResponse
export async function POST(req: Request) {
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("buy-check", "/api/buy-check", mockReason);
  const meta = new RequestMeta();
  try {
    const body = await readJson(req);
    const userId = userIdFrom(body.user_id);
    let matchId = typeof body.match_id === "string" ? body.match_id : null;
    let itemDesc = typeof body.item_desc === "string" ? body.item_desc : null;
    if (!matchId && typeof body.item_url === "string") {
      // A product URL we've already matched resolves to its stored match.
      const { data } = await db().from("product_matches").select("id").eq("url", body.item_url).limit(1).maybeSingle();
      matchId = (data as { id: string } | null)?.id ?? null;
      itemDesc ??= matchId ? null : `the product at ${body.item_url}`;
    }
    const card = await buyCheck(userId, { matchId, itemDesc }, meta);
    return ok({ card }, meta, "/api/buy-check", { verdict: card.verdict });
  } catch (err) {
    if (err instanceof BuyCheckError) return fail(400, err.message);
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "buy check failed");
  }
}
