import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { type LookupAddress, lookup } from "node:dns";
import { get as httpsGet } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
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

// ---- Remote image fetch (SSRF-safe) ------------------------------------------------
// URLs come from users (chat attachments) and third parties (TikTok thumbnails), so the
// server must never be steered at itself or the private network: https only, every
// resolved address must be public (checked at connect time, so DNS rebinding can't swap
// in a private IP after the check), redirects re-checked hop by hop, and the body capped.

// Separate lists: one BlockList also matches IPv4 addresses against IPv4-mapped IPv6 rules.
const PRIVATE4 = new BlockList();
const PRIVATE6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) PRIVATE4.addSubnet(net, prefix, "ipv4");
// IPv4-mapped (::ffff:0:0/96) and NAT64 (64:ff9b::/96) can smuggle any IPv4 address; block them whole.
for (const [net, prefix] of [["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) {
  PRIVATE6.addSubnet(net, prefix, "ipv6");
}

/** True for a routable public IP; false for loopback, private, link-local, metadata, etc. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return family === 4 ? !PRIVATE4.check(address, "ipv4") : !PRIVATE6.check(address, "ipv6");
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const blocked = addresses.find((a) => !isPublicAddress(a.address));
    if (blocked || addresses.length === 0) {
      return callback(Object.assign(new Error(`blocked non-public address for ${hostname}`), { code: "EBLOCKED" }), "", 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

function checkUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("image URL must be https");
  if (url.username || url.password) throw new Error("image URL must not contain credentials");
  if (url.port && url.port !== "443") throw new Error("image URL must use the default port");
  // Node skips the DNS lookup (and so safeLookup) for IP-literal hosts; check those here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new Error(`blocked non-public address ${host}`);
  return url;
}

function getOnce(url: URL, maxBytes: number): Promise<{ status: number; location: string | null; bytes: Buffer; mimeType: string | null }> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, { lookup: safeLookup, timeout: 10_000, headers: { "user-agent": "Dripy/0.1" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ status, location: res.headers.location ?? null, bytes: Buffer.alloc(0), mimeType: null });
      }
      if (Number(res.headers["content-length"] ?? 0) > maxBytes) {
        req.destroy();
        return reject(new Error("remote image too large"));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) return req.destroy(new Error("remote image too large"));
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status, location: null, bytes: Buffer.concat(chunks), mimeType: res.headers["content-type"] ?? null }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("image fetch timed out")));
    req.on("error", reject);
  });
}

/** Download a remote image (e.g. a TikTok oEmbed thumbnail), refusing non-public hosts. */
export async function fetchImage(raw: string, maxBytes = MAX_INPUT_BYTES): Promise<{ bytes: Buffer; mimeType: string | null }> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= 3; hop++) {
    const res = await getOnce(url, maxBytes);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`image fetch ${res.status} without location`);
      url = checkUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`image fetch ${res.status}`);
    return { bytes: res.bytes, mimeType: res.mimeType };
  }
  throw new Error("image fetch: too many redirects");
}
