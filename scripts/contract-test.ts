// Hits every endpoint the frontend uses and checks the response contract.
//   BASE_URL=http://localhost:3000 npm run test:contract
// With FORCE_FALLBACK=all (or no keys) every route must still return 2xx + meta.
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const U = "00000000-0000-0000-0000-000000000001";

type Check = { name: string; method?: string; path: string; body?: unknown; expect: (j: Record<string, unknown>) => void };

const has = (j: Record<string, unknown>, ...keys: string[]) => keys.forEach((k) => assert.ok(k in j, `missing "${k}"`));
const checks: Check[] = [
  { name: "chat", method: "POST", path: "/api/chat", body: { user_id: U, message: "what jackets do I own?" }, expect: (j) => has(j, "reply", "cards") },
  { name: "chat history", path: `/api/chat/history?user_id=${U}`, expect: (j) => has(j, "messages") },
  { name: "wardrobe", path: `/api/wardrobe?user_id=${U}`, expect: (j) => { has(j, "items", "facets"); assert.ok((j.items as unknown[]).length > 0); } },
  { name: "wardrobe filter", path: `/api/wardrobe?user_id=${U}&category=outerwear`, expect: (j) => has(j, "items") },
  { name: "donations", path: "/api/donations/nearby?lat=47.6553&lng=-122.3035", expect: (j) => { has(j, "places", "card"); assert.ok((j.places as unknown[]).length >= 3, "3+ places"); } },
  { name: "buy-check", method: "POST", path: "/api/buy-check", body: { user_id: U, match_id: "00000000-0000-0000-0003-000000000004" }, expect: (j) => has(j, "card") },
  { name: "reels analyze (url)", method: "POST", path: "/api/reels/analyze", body: { user_id: U, url: "https://www.tiktok.com/@demo/video/1" }, expect: () => {} },
  { name: "purchase intent", method: "POST", path: "/api/purchase-intents", body: { user_id: U, match_id: "00000000-0000-0000-0003-000000000004" }, expect: (j) => has(j, "id", "status", "card") },
  { name: "receipts sync", method: "POST", path: "/api/receipts/sync", body: { user_id: U }, expect: (j) => has(j, "added", "items") },
  { name: "health", path: "/api/health", expect: (j) => has(j, "payments", "database") },
];

async function main() {
let failed = 0;
for (const c of checks) {
  try {
    const res = await fetch(`${BASE}${c.path}`, {
      method: c.method ?? "GET",
      headers: c.body ? { "content-type": "application/json" } : undefined,
      body: c.body ? JSON.stringify(c.body) : undefined,
    });
    const json = (await res.json()) as Record<string, unknown>;
    // 4xx with {error} is an acceptable, typed outcome for user-input problems (e.g. unsupported reel)
    if (res.status >= 500) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    if (res.ok && c.name !== "health") has(json, "meta");
    if (res.ok) c.expect(json);
    else has(json, "error");
    const meta = json.meta as { mode?: string; fallbacks?: string[] } | undefined;
    console.log(`✓ ${c.name.padEnd(20)} ${res.status} ${meta ? `${meta.mode}${meta.fallbacks ? ` [${meta.fallbacks.join(",")}]` : ""}` : ""}`);
  } catch (err) {
    failed++;
    console.log(`✗ ${c.name.padEnd(20)} ${err instanceof Error ? err.message : err}`);
  }
}
if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall contract checks passed");
}

main();
