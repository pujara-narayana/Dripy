import "server-only";
import { decodeDataUrl, fetchImage, ingestImage, type IngestedImage } from "@/lib/storage/ingestImage";

/**
 * Web-chat attachment contract (JSON body):
 *   attachments: [{ type: "image", data_url: "data:image/heic;base64,..." }]
 *             or [{ type: "image", url: "https://..." }]
 * Multipart bodies use `image` file fields instead (see readChatRequest).
 */
export async function ingestAttachments(raw: unknown): Promise<IngestedImage[]> {
  if (!Array.isArray(raw)) return [];
  const out: IngestedImage[] = [];
  for (const a of raw.slice(0, 3)) {
    if (!a || typeof a !== "object") continue;
    const att = a as { data_url?: unknown; url?: unknown };
    if (typeof att.data_url === "string") {
      const decoded = decodeDataUrl(att.data_url);
      if (decoded) out.push(await ingestImage(decoded.bytes, decoded.mimeType));
    } else if (typeof att.url === "string" && /^https:\/\//.test(att.url)) {
      const img = await fetchImage(att.url);
      out.push(await ingestImage(img.bytes, img.mimeType));
    }
  }
  return out;
}

export interface ChatRequest {
  userId: unknown;
  message: string;
  images: IngestedImage[];
  lat: number | null;
  lng: number | null;
  extra: Record<string, unknown>;
}

/** Accepts JSON or multipart/form-data (fields: user_id, message, lat, lng, image[]). */
export async function readChatRequest(req: Request): Promise<ChatRequest> {
  const type = req.headers.get("content-type") ?? "";
  const num = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const images: IngestedImage[] = [];
    for (const f of form.getAll("image").slice(0, 3)) {
      if (f instanceof File && f.size > 0) images.push(await ingestImage(Buffer.from(await f.arrayBuffer()), f.type));
    }
    const extra = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    return {
      userId: form.get("user_id"),
      message: String(form.get("message") ?? ""),
      images,
      lat: num(form.get("lat")),
      lng: num(form.get("lng")),
      extra,
    };
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  return {
    userId: body.user_id,
    message: typeof body.message === "string" ? body.message.slice(0, 4000) : "",
    images: await ingestAttachments(body.attachments),
    lat: num(body.lat),
    lng: num(body.lng),
    extra: body,
  };
}
