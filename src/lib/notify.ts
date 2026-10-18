import "server-only";
import type { OutboundPart } from "@/lib/agent/render";
import { getUser } from "@/lib/db/queries";
import { env } from "@/lib/env";

/**
 * Best-effort iMessage push through the Photon worker (POST /send). Used when something
 * happens on the website that the user should also see in their Dripy chat. Returns
 * whether it was delivered; never throws.
 */
export async function pushToImessage(userId: string, parts: OutboundPart[]): Promise<boolean> {
  if (!env.photonWorkerUrl || !env.photonWorkerSecret || parts.length === 0) return false;
  try {
    const user = await getUser(userId);
    if (!user?.phone) return false;
    const res = await fetch(`${env.photonWorkerUrl.replace(/\/$/, "")}/send`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dripy-worker-secret": env.photonWorkerSecret },
      body: JSON.stringify({ to: user.phone, parts }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.warn("iMessage push failed", err);
    return false;
  }
}
