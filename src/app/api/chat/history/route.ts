import { connection, type NextRequest } from "next/server";
import { db, must } from "@/lib/db/client";
import { fail, mockResponse, ok, RequestMeta, fallbackToMock, userIdFrom } from "@/lib/http";
import type { ChatHistoryResponse } from "@/lib/types";

// GET /api/chat/history?user_id=&limit=50 -> ChatHistoryResponse (oldest first)
export async function GET(req: NextRequest) {
  await connection(); // always run at request time (never prerender the mock)
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("chat-history", "/api/chat/history", mockReason);
  const meta = new RequestMeta();
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 200);
    const rows = must(
      await db()
        .from("chat_messages")
        .select("id,channel,direction,body,attachments,cards,created_at")
        .eq("user_id", userIdFrom(sp.get("user_id")))
        .order("created_at", { ascending: false })
        .limit(limit),
      "load history",
    ) as ChatHistoryResponse["messages"];
    return ok({ messages: rows.reverse() }, meta, "/api/chat/history");
  } catch (err) {
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "history failed");
  }
}
