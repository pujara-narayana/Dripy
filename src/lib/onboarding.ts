import "server-only";
import type { OutboundPart } from "@/lib/agent/render";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { createToken } from "@/lib/tokens";
import { findByStartCode, linkSender, type AccountRow } from "@/lib/users";
import type { Channel } from "@/lib/types";

// The first iMessage after web sign-up carries a start code ("Hi Dripy! My code is 3FA21C").
// Dripy links that sender to the account and answers with a fixed greeting (no LLM call)
// that includes a one-tap login link to the wardrobe.

export function greetingParts(user: AccountRow): OutboundPart[] {
  const first = user.name.split(" ")[0] || "there";
  const link = `${env.appUrl}/auth/link?t=${createToken("login", user.id)}`;
  return [
    { kind: "text", text: `Hi ${first}, welcome to Dripy ✨ I've parsed your Gmail and your digital wardrobe is ready: ${link}` },
    { kind: "text", text: "Send me a screenshot of anything you're eyeing and I'll find it for you, and tell you honestly if you need it." },
  ];
}

/** Greet and link the account if this message carries a start code; null otherwise. */
export async function greetNewUser(input: {
  sender: string;
  text: string;
  channel: Channel;
  externalId: string | null;
}): Promise<{ userId: string; parts: OutboundPart[]; duplicate: boolean } | null> {
  const user = await findByStartCode(input.text);
  if (!user) return null;
  const inbound = await db()
    .from("chat_messages")
    .insert({ user_id: user.id, channel: input.channel, direction: "inbound", body: input.text, external_id: input.externalId })
    .select("id")
    .single();
  if (inbound.error?.code === "23505") return { userId: user.id, parts: [], duplicate: true }; // Photon retry
  if (inbound.error) throw new Error(`save greeting inbound: ${inbound.error.message}`);
  if (input.sender) await linkSender(user.id, input.sender);
  const parts = greetingParts(user);
  await db()
    .from("chat_messages")
    .insert({ user_id: user.id, channel: input.channel, direction: "outbound", body: parts.map((p) => (p.kind === "text" ? p.text : "")).join("\n\n") });
  return { userId: user.id, parts, duplicate: false };
}
