import { connection, type NextRequest } from "next/server";
import { fail, fallbackToMock, ok, RequestMeta, requestUserId } from "@/lib/http";
import { listShop } from "@/lib/shop";

// GET /api/shop -> {items[]}: shop pieces the user doesn't own, randomly ordered.
export async function GET(req: NextRequest) {
  await connection();
  if (fallbackToMock()) return fail(503, "The shop needs the database.");
  const meta = new RequestMeta();
  try {
    const items = await listShop(requestUserId(req, req.nextUrl.searchParams.get("user_id")));
    return ok({ items }, meta, "/api/shop", { count: items.length });
  } catch (err) {
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "shop failed");
  }
}
