import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db/client";

export const UPLOAD_BUCKET = "user-uploads";
const MAX_EDGE = 1568; // plenty for garment ID; keeps vision and Lens fast
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export interface IngestedImage {
  publicUrl: string;
  /** sha256 of the original bytes — the analysis cache key for screenshots. */
  contentHash: string;
  bytes: Buffer; // normalized JPEG
}

function looksLikeHeic(buf: Buffer, mimeType?: string | null): boolean {
  if (mimeType && /hei[cf]/i.test(mimeType)) return true;
  const brand = buf.subarray(4, 12).toString("latin1");
  return /^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(brand);
}

/**
 * Normalize any phone image (HEIC, huge PNG screenshots, rotated JPEGs) into a
 * <=1568px JPEG and store it in a public bucket. SerpAPI Lens needs a public URL
 * and vision models are most reliable on JPEG, so every image goes through here first (QA #3).
 */
export async function ingestImage(input: Buffer, mimeType?: string | null): Promise<IngestedImage> {
  if (input.byteLength === 0) throw new Error("empty image");
  if (input.byteLength > MAX_INPUT_BYTES) throw new Error("image is larger than 25 MB");

  const contentHash = createHash("sha256").update(input).digest("hex");
  let source = input;
  if (looksLikeHeic(input, mimeType)) {
    // sharp's prebuilt libvips has no HEVC decoder; heic-convert is pure JS.
    const { default: convert } = await import("heic-convert");
    source = Buffer.from(await convert({ buffer: input, format: "JPEG", quality: 0.9 }));
  }

  const bytes = await sharp(source)
    .rotate() // respect EXIF orientation
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const path = `${new Date().toISOString().slice(0, 10)}/${contentHash.slice(0, 16)}-${randomUUID().slice(0, 8)}.jpg`;
  const up = await db().storage.from(UPLOAD_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const { data } = db().storage.from(UPLOAD_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, contentHash, bytes };
}

/** data:image/png;base64,.... -> bytes */
export function decodeDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m || !m[2]) return null;
  return { mimeType: m[1] ?? "application/octet-stream", bytes: Buffer.from(m[3], "base64") };
}

/** Download a remote image (e.g. a TikTok oEmbed thumbnail) with a size cap. */
export async function fetchImage(url: string): Promise<{ bytes: Buffer; mimeType: string | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_INPUT_BYTES) throw new Error("remote image too large");
  return { bytes: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get("content-type") };
}
