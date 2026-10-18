import "server-only";
import { env, isForced } from "@/lib/env";

// Gmail for the one demo user: a refresh token from `npm run gmail:auth` lives in .env.local,
// so there's no OAuth flow or token table in the app itself. Scopes: gmail.readonly (order
// emails) and gmail.send (Dripy emails the demo receipt of a purchase to the buyer).

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
// Order confirmations. Promotions ("…your order" marketing) and Gmail's Purchases category
// (subscription notices) were mostly noise on a real inbox. Non-orders that slip through are
// rejected by the receipt parser.
const QUERY = "subject:(order OR receipt OR purchase) -category:promotions -category:social newer_than:1y";

interface Part {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: Part[];
}

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.googleClientId!,
      client_secret: env.googleClientSecret!,
      refresh_token: env.gmailRefreshToken!,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`gmail token ${res.status}: ${body.error ?? ""} ${body.error_description ?? ""}`.trim());
  return body.access_token;
}

async function get<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`gmail ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** First text/html part (else text/plain), decoded. Gmail already undoes the transfer encoding. */
function findBody(part: Part, mime: string): string | null {
  if (part.mimeType === mime && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const p of part.parts ?? []) {
    const found = findBody(p, mime);
    if (found) return found;
  }
  return null;
}

/** Gmail message -> "From/Subject/Date headers, blank line, body", the shape emailToText reads. */
export function messageToEmail(payload: Part): string {
  const header = (name: string) => payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const body = findBody(payload, "text/html") ?? findBody(payload, "text/plain") ?? "";
  return `From: ${header("from")}\nSubject: ${header("subject")}\nDate: ${header("date")}\n\n${body}`;
}

export function gmailConfigured(): boolean {
  return !isForced("gmail");
}

/** Recent order-confirmation emails: [{id, raw}] with raw in emailToText's input shape. */
export async function fetchOrderEmails(max = 10): Promise<{ id: string; raw: string }[]> {
  const token = await accessToken();
  const list = await get<{ messages?: { id: string }[] }>(token, `/messages?q=${encodeURIComponent(QUERY)}&maxResults=${max}`);
  return Promise.all(
    (list.messages ?? []).map(async ({ id }) => {
      const msg = await get<{ id: string; payload: Part }>(token, `/messages/${id}?format=full`);
      return { id: `gmail:${msg.id}`, raw: messageToEmail(msg.payload) };
    }),
  );
}

/**
 * Send an email from the connected account (to itself or anyone), then read the sent copy back
 * the way the receipt sync does. `build` gets the account's address and returns the full
 * RFC 822 message. A refresh token from before gmail.send was added fails here with 403
 * (re-run gmail:auth).
 */
export async function sendAndReadBack(build: (address: string) => string): Promise<{ id: string; raw: string }> {
  const token = await accessToken();
  const { emailAddress } = await get<{ emailAddress: string }>(token, "/profile");
  const res = await fetch(`${API}/messages/send`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(build(emailAddress), "utf8").toString("base64url") }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const hint = res.status === 403 ? " (token lacks gmail.send: re-run npm run gmail:auth)" : "";
    throw new Error(`gmail send ${res.status}${hint}: ${(await res.text()).slice(0, 200)}`);
  }
  const { id } = (await res.json()) as { id: string };
  const msg = await get<{ id: string; payload: Part }>(token, `/messages/${id}?format=full`);
  return { id: `gmail:${msg.id}`, raw: messageToEmail(msg.payload) };
}
