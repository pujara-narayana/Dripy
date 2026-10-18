// Seed the demo user, wardrobe, receipts, cached demo analyses and Seattle donation places.
// Idempotent: safe to re-run before every rehearsal (resets chat + purchases too).
//   npm run seed            reset + seed everything
//   npm run seed -- --keep-chat   keep chat history and purchases
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER, SEED_ANALYSES, SEED_DIRECT_ITEMS, SEED_PLACES, SEED_RECEIPTS } from "../supabase/seed-data";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local)");
const db = createClient(url, key, { auth: { persistSession: false } });
const keepChat = process.argv.includes("--keep-chat");

async function run(label: string, p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  console.log(`✓ ${label}`);
}

async function main() {
  const uid = DEMO_USER.id;
  await run("upsert demo user", db.from("users").upsert({ ...DEMO_USER, current_match_id: null }));
  await run("clear current match", db.from("users").update({ current_match_id: null }).eq("id", uid));

  if (!keepChat) {
    await run("clear purchase intents", db.from("purchase_intents").delete().eq("user_id", uid));
    await run("clear chat", db.from("chat_messages").delete().eq("user_id", uid));
  }
  // Fresh wardrobe: drop purchases/uploads and all receipts (cascades to receipt lines).
  await run("clear wardrobe", db.from("wardrobe_items").delete().eq("user_id", uid));
  await run("clear receipts", db.from("receipts").delete().eq("user_id", uid));

  await run(
    "insert direct wardrobe items",
    db.from("wardrobe_items").insert(SEED_DIRECT_ITEMS.map((i) => ({ ...i, user_id: uid, currency: "USD" }))),
  );
  for (const r of SEED_RECEIPTS) {
    await run(
      `receipt ${r.file}`,
      db.from("receipts").insert({
        id: r.id,
        user_id: uid,
        source_message_id: r.file,
        retailer: r.retailer,
        order_date: r.order_date,
        total_cents: r.total_cents,
        parsed_json: { seeded: true, items: r.lines.map((l) => l.name) },
      }),
    );
    await run(
      `  ${r.lines.length} item(s)`,
      db.from("wardrobe_items").insert(
        r.lines.map((l, idx) => ({ ...l, user_id: uid, currency: "USD", source: "receipt", receipt_id: r.id, receipt_line: idx + 1 })),
      ),
    );
  }

  // Cached demo analyses (keys "demo:skip"/"demo:buy" until `npm run demo:register`).
  for (const a of SEED_ANALYSES) {
    await run(`clear analysis ${a.id}`, db.from("reel_analyses").delete().eq("id", a.id));
    await run(
      `analysis ${a.cache_key}`,
      db.from("reel_analyses").insert({ id: a.id, user_id: uid, cache_key: a.cache_key, image_url: a.image_url, identified: a.identified, mode: "cached" }),
    );
    await run(`  ${a.matches.length} matches`, db.from("product_matches").insert(a.matches.map((m, rank) => ({ ...m, rank, analysis_id: a.id }))));
  }

  await run("donation places", db.from("donation_places").upsert(SEED_PLACES.map((p) => ({ ...p, is_seed: true }))));
  console.log("\nSeeded. Next: npm run demo:register -- <skip-screenshot> <buy-screenshot>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
