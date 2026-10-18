import { isForced } from "@/lib/env";
import { fail, mockResponse, ok, readJson, RequestMeta, fallbackToMock, userIdFrom } from "@/lib/http";
import { syncReceipts } from "@/lib/pipelines/receipts";

export const maxDuration = 60;

// POST /api/receipts/sync {user_id, reparse?: boolean} -> ReceiptsSyncResponse
// Parses the seeded order-confirmation inbox with Gemini. Already-synced emails are
// skipped; reparse=true re-parses them live (useful to demo the parser).
export async function POST(req: Request) {
  const mockReason = fallbackToMock() ?? (isForced("llm") ? "llm_unconfigured" : null);
  if (mockReason) return mockResponse("receipts-sync", "/api/receipts/sync", mockReason);
  const meta = new RequestMeta();
  try {
    const body = await readJson(req);
    const result = await syncReceipts(userIdFrom(body.user_id), { reparse: body.reparse === true }, meta);
    return ok(
      { added: result.added.length, receipts_parsed: result.parsed, skipped: result.skipped, items: result.added, errors: result.errors },
      meta,
      "/api/receipts/sync",
      { added: result.added.length },
    );
  } catch (err) {
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "receipt sync failed");
  }
}
