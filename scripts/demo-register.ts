// Re-key the cached demo analyses to the exact screenshots you'll forward in the demo,
// so those images return instantly and deterministically (meta.mode = "cached").
//   npm run demo:register -- ./demo/black-bomber.png ./demo/camel-blazer.png
//   npm run demo:register -- --url https://www.tiktok.com/@x/video/123 buy   (reel link)
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ANALYSIS = { skip: "00000000-0000-0000-0004-000000000001", buy: "00000000-0000-0000-0004-000000000002" };

function normalizeUrl(raw: string): string {
  // must match src/lib/pipelines/imageAnalysis.ts normalizeUrl
  const u = new URL(raw.trim());
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|is_|_r|_t|igsh|share)/i.test(k)) u.searchParams.delete(k);
  u.hostname = u.hostname.toLowerCase().replace(/^(www|m|vm)\./, "");
  return u.toString().replace(/\/$/, "");
}

async function rekey(which: "skip" | "buy", cacheKey: string, label: string) {
  // Free the key if a live analysis already claimed it.
  await db.from("reel_analyses").delete().eq("cache_key", cacheKey).neq("id", ANALYSIS[which]);
  const { error } = await db.from("reel_analyses").update({ cache_key: cacheKey }).eq("id", ANALYSIS[which]);
  if (error) throw new Error(error.message);
  console.log(`✓ ${which.toUpperCase()} beat <- ${label} (${cacheKey.slice(0, 12)}…)`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--url") {
    const [, url, which] = args;
    if (!url || (which !== "skip" && which !== "buy")) throw new Error("usage: --url <tiktok-url> skip|buy");
    await rekey(which, createHash("sha256").update(`url:${normalizeUrl(url)}`).digest("hex"), url);
    return;
  }
  const [skipPath, buyPath] = args;
  if (!skipPath) throw new Error("usage: demo:register <skip-screenshot> [buy-screenshot]");
  for (const [which, p] of [["skip", skipPath], ["buy", buyPath]] as const) {
    if (!p) continue;
    const hash = createHash("sha256").update(await readFile(p)).digest("hex");
    await rekey(which, hash, p);
  }
  console.log("Forward these exact files (iMessage may recompress photos — send as a file/screenshot, or re-register what arrives).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
