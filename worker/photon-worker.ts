// Photon bridge: a long-running process that holds the Spectrum (Photon) connection,
// forwards every inbound iMessage/SMS/WhatsApp to the Dripy backend, and sends the
// reply parts back. Run it on a laptop during the demo or on Railway/Fly:
//
//   npm run worker            (reads .env.local)
//
// Env: PHOTON_PROJECT_ID, PHOTON_PROJECT_SECRET, DRIPY_BACKEND_URL (e.g. https://dripy.vercel.app
// or http://localhost:3000), PHOTON_WORKER_SECRET (same value as the backend's).

import { createServer } from "node:http";
import { attachment, Spectrum, type Message, type Space } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

const BACKEND = (process.env.DRIPY_BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.PHOTON_WORKER_SECRET ?? "";
const PORT = Number(process.env.PORT ?? 8787);

type Part = { kind: "text"; text: string } | { kind: "image"; url: string };

function log(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...extra }));
}

async function toPayload(message: Message) {
  const c = message.content as { type: string; text?: string; mimeType?: string; read?: () => Promise<Buffer> };
  let text = "";
  const attachments: { type: "image"; data_url: string }[] = [];
  if (c.type === "text") text = c.text ?? "";
  else if (c.type === "attachment" && c.mimeType?.startsWith("image/") && c.read) {
    const bytes = await c.read();
    attachments.push({ type: "image", data_url: `data:${c.mimeType};base64,${bytes.toString("base64")}` });
  } else {
    return null; // reactions, typing, edits, etc.
  }
  return {
    external_id: message.id,
    sender: message.sender?.id ?? "",
    platform: message.platform,
    text,
    attachments,
  };
}

async function sendParts(space: Space, parts: Part[]) {
  for (const p of parts) {
    if (p.kind === "text") await space.send(p.text);
    else {
      try {
        const png = /\.png($|\?)|\/png\b/i.test(p.url);
        await space.send(
          attachment(new URL(p.url), { mimeType: png ? "image/png" : "image/jpeg", name: png ? "dripy.png" : "dripy.jpg" }),
        );
      } catch (err) {
        log("image_send_failed", { url: p.url, err: String(err) });
      }
    }
  }
}

// Serialize turns per conversation so "ok buy it" never races the reply before it.
const queues = new Map<string, Promise<void>>();
function enqueue(key: string, job: () => Promise<void>) {
  const next = (queues.get(key) ?? Promise.resolve()).then(job, job);
  queues.set(key, next.catch(() => undefined));
}

// The last conversation each sender used, so the backend can message them first
// (POST /send), e.g. after they pay on the web checkout page.
const spaces = new Map<string, Space>();

async function handle(space: Space, message: Message) {
  const payload = await toPayload(message);
  if (!payload) return;
  if (payload.sender) spaces.set(payload.sender, space);
  log("inbound", { id: payload.external_id, sender: payload.sender, hasImage: payload.attachments.length > 0 });
  await space.responding(async () => {
    let parts: Part[];
    try {
      const res = await fetch(`${BACKEND}/api/messages/inbound`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dripy-worker-secret": SECRET },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90_000),
      });
      const body = (await res.json()) as { parts?: Part[]; duplicate?: boolean };
      if (body.duplicate) return;
      parts = body.parts ?? [];
      if (!res.ok && !parts.length) parts = [{ kind: "text", text: "I'm having trouble reaching my brain. Try again in a minute?" }];
    } catch (err) {
      log("backend_unreachable", { err: String(err) });
      parts = [{ kind: "text", text: "I'm having trouble reaching my brain. Try again in a minute?" }];
    }
    await sendParts(space, parts);
    log("replied", { id: payload.external_id, parts: parts.length });
  });
}

async function main() {
  if (!process.env.PHOTON_PROJECT_ID || !process.env.PHOTON_PROJECT_SECRET) {
    throw new Error("PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET are required");
  }
  if (!SECRET) throw new Error("PHOTON_WORKER_SECRET is required");
  // Spectrum Cloud only accepts the UUID project id (not the "pho_prj_..." display id).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(process.env.PHOTON_PROJECT_ID)) {
    throw new Error(
      `PHOTON_PROJECT_ID must be the project's UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), got "${process.env.PHOTON_PROJECT_ID.slice(0, 12)}…". ` +
        "Copy the SDK project ID from app.photon.codes (not the pho_prj_ id).",
    );
  }

  // Health endpoint so /api/health can show whether the bridge is up.
  // The port doubles as a single-instance lock: two workers on one Photon project would
  // both reply to every message.
  await new Promise<void>((resolve, reject) => {
    createServer((req, res) => {
      const reply = (status: number, body: object) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.method === "POST" && req.url === "/send") {
        // Backend -> iMessage push: { to: sender id, parts }. Only reaches people who texted
        // this worker since it started (Photon needs an existing conversation).
        if (!SECRET || req.headers["x-dripy-worker-secret"] !== SECRET) return reply(401, { ok: false, error: "unauthorized" });
        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", async () => {
          try {
            const { to, parts } = JSON.parse(raw) as { to?: string; parts?: Part[] };
            const space = to ? spaces.get(to) : undefined;
            if (!space) return reply(404, { ok: false, error: "no conversation with that sender yet" });
            await sendParts(space, parts ?? []);
            log("pushed", { to, parts: parts?.length ?? 0 });
            reply(200, { ok: true });
          } catch (err) {
            log("push_failed", { err: String(err) });
            reply(500, { ok: false, error: String(err) });
          }
        });
        return;
      }
      reply(req.url === "/health" ? 200 : 404, { ok: req.url === "/health" });
    })
      .once("error", (err: NodeJS.ErrnoException) =>
        reject(
          err.code === "EADDRINUSE"
            ? new Error(
                `Another Dripy worker is already running (port ${PORT} is in use). Stop it first ` +
                  `(Ctrl+C in its terminal, or: kill $(lsof -t -iTCP:${PORT} -sTCP:LISTEN)) — two workers would double-reply.`,
              )
            : err,
        ),
      )
      .listen(PORT, () => {
        log("health_listening", { port: PORT });
        resolve();
      });
  });

  const app = await Spectrum({
    projectId: process.env.PHOTON_PROJECT_ID,
    projectSecret: process.env.PHOTON_PROJECT_SECRET,
    providers: [imessage.config()],
    options: { flattenGroups: true },
  });
  log("connected", { backend: BACKEND });

  for await (const [space, message] of app.messages) {
    if (message.direction !== "inbound") continue;
    const key = (space as unknown as { id?: string }).id ?? message.sender?.id ?? "default";
    enqueue(key, () => handle(space, message).catch((err) => log("handle_failed", { err: String(err) })));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
