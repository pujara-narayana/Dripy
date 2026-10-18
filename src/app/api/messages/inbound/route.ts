import { timingSafeEqual } from "node:crypto";
import { handleTurn } from "@/lib/agent/conversation";
import { renderForMessaging } from "@/lib/agent/render";
import { getUserByPhone } from "@/lib/db/queries";
import { env, isForced } from "@/lib/env";
import { fail, ok, RequestMeta } from "@/lib/http";
import { ingestAttachments } from "@/lib/storage/attachments";
import type { Channel } from "@/lib/types";

export const maxDuration = 60;

// POST /api/messages/inbound — called by worker/photon-worker.ts (the Photon bridge),
// not by the frontend. Body:
//   { external_id, sender, platform, text, attachments: [{type:"image", data_url}] }
// Auth: header `x-dripy-worker-secret: $PHOTON_WORKER_SECRET`.
// Returns the reply split into iMessage-sized parts for the worker to send.

function authorized(req: Request): boolean {
  const given = Buffer.from(req.headers.get("x-dripy-worker-secret") ?? "");
  const expected = Buffer.from(env.photonWorkerSecret ?? "");
  return expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}

const CHANNELS: Record<string, Channel> = { imessage: "imessage", sms: "sms", whatsapp: "whatsapp", "whatsapp-business": "whatsapp", whatsapp_business: "whatsapp" };

export async function POST(req: Request) {
  if (!authorized(req)) return fail(401, "unauthorized");
  if (isForced("db") || isForced("llm")) {
    return Response.json({ parts: [{ kind: "text", text: "Dripy is in demo-offline mode right now — try the web app!" }], duplicate: false });
  }
  const meta = new RequestMeta();
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sender = typeof body.sender === "string" ? body.sender : "";
    // Shared-pool numbers can change per conversation; unknown senders map to the demo user.
    const user = sender ? await getUserByPhone(sender) : null;
    const userId = user?.id ?? env.demoUserId;
    const images = await ingestAttachments(body.attachments);
    const turn = await handleTurn(
      {
        userId,
        channel: CHANNELS[String(body.platform ?? "imessage")] ?? "imessage",
        text: typeof body.text === "string" ? body.text : "",
        images,
        externalId: typeof body.external_id === "string" ? body.external_id : null,
      },
      meta,
    );
    if (turn.duplicate) return ok({ parts: [], duplicate: true }, meta, "/api/messages/inbound");
    return ok({ parts: renderForMessaging(turn.reply, turn.cards), duplicate: false }, meta, "/api/messages/inbound", {
      route_taken: turn.route,
      tools: turn.toolCalls,
    });
  } catch (err) {
    console.error("/api/messages/inbound failed", err);
    return Response.json(
      { parts: [{ kind: "text", text: "Ugh, something broke on my end. Try that again in a sec?" }], error: String(err) },
      { status: 200 }, // the worker still relays a friendly message instead of going silent
    );
  }
}
