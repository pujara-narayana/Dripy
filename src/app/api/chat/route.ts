import { handleTurn } from "@/lib/agent/conversation";
import { isForced } from "@/lib/env";
import { fail, mockResponse, ok, RequestMeta, fallbackToMock, requestUserId } from "@/lib/http";
import { readChatRequest } from "@/lib/storage/attachments";
import type { ChatResponse } from "@/lib/types";

export const maxDuration = 60;

// POST /api/chat  {user_id, message, attachments?: [{type:"image", data_url|url}], lat?, lng?}
// or multipart/form-data with `image` file fields. -> ChatResponse
export async function POST(req: Request) {
  const mockReason = fallbackToMock() ?? (isForced("llm") ? "llm_unconfigured" : null);
  if (mockReason) return mockResponse("chat", "/api/chat", mockReason);

  const meta = new RequestMeta();
  try {
    const input = await readChatRequest(req);
    if (!input.message.trim() && input.images.length === 0) return fail(400, "message or an image attachment is required");
    const turn = await handleTurn(
      { userId: requestUserId(req, input.userId), channel: "web", text: input.message, images: input.images, lat: input.lat, lng: input.lng },
      meta,
    );
    const body: Omit<ChatResponse, "meta"> = { reply: turn.reply, cards: turn.cards, message_id: turn.messageId };
    return ok(body, meta, "/api/chat", { route_taken: turn.route, tools: turn.toolCalls });
  } catch (err) {
    console.error("/api/chat failed", err);
    return fail(500, err instanceof Error ? err.message : "chat failed", { fallback_used: false });
  }
}
