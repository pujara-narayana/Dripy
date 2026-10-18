// Integration tests with fetch mocked (no keys, no network):
//   npm run test:integrations
// Add --live to hit the real services instead (only those whose keys are set).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "../src/lib/env";
import { RequestMeta } from "../src/lib/http";
import { renderForMessaging } from "../src/lib/agent/render";
import { imageSearch, textSearch, toMatch } from "../src/lib/integrations/channel3";
import { fetchOrderEmails, gmailConfigured, messageToEmail, sendToSelf } from "../src/lib/integrations/gmail";
import { domainFromSource, resolveStoreLinks, type RawMatch } from "../src/lib/integrations/serpapi";
import { buildReceiptEmail, orderNumber, toInboxText, toMime } from "../src/lib/pipelines/purchaseReceipt";
import type { Card } from "../src/lib/types";
import { geoapifyPlaces } from "../src/lib/pipelines/donations";
import { emailToText } from "../src/lib/pipelines/receipts";
import { fetchImage, isPublicAddress } from "../src/lib/storage/ingestImage";
import { describeWeatherCode, getForecast, resolveDay } from "../src/lib/integrations/weather";

const LIVE = process.argv.includes("--live");
const realFetch = globalThis.fetch;

/** Replace fetch with a router of url-substring -> JSON response. Records every call. */
function mockFetch(routes: Record<string, unknown | ((init?: RequestInit) => unknown)>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("not mocked", { status: 404 });
    const value = routes[key];
    const body = typeof value === "function" ? (value as (i?: RequestInit) => unknown)(init) : value;
    if (body instanceof Response) return body;
    return Response.json(body);
  }) as typeof fetch;
  return calls;
}

async function weather() {
  const dates = ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]; // Sat..Fri
  assert.equal(resolveDay(undefined, dates), "2026-10-17");
  assert.equal(resolveDay("tomorrow", dates), "2026-10-18");
  assert.equal(resolveDay("Friday", dates), "2026-10-23");
  assert.equal(resolveDay("sat", dates), "2026-10-17");
  assert.equal(resolveDay("2026-10-30", dates), null);
  assert.equal(resolveDay("someday", dates), null);
  assert.equal(describeWeatherCode(63), "rain");
  assert.equal(describeWeatherCode(0), "clear");

  if (LIVE) {
    globalThis.fetch = realFetch;
    const meta = new RequestMeta();
    const card = await getForecast({ day: "tomorrow" }, meta);
    assert.ok(card, "live forecast returned a card");
    assert.ok(card.high_f >= card.low_f && card.high_f < 130, `sane temps ${card.high_f}/${card.low_f}`);
    assert.equal(meta.toMeta().fallback_used, false);
    console.log("weather (live):", card);
    return;
  }

  const calls = mockFetch({
    "open-meteo.com": {
      daily: {
        time: dates,
        weather_code: [63, 3, 3, 0, 61, 2, 95],
        temperature_2m_max: [60.1, 59.6, 59.1, 62, 55, 58, 54.4],
        temperature_2m_min: [46.6, 41.6, 45.2, 44, 43, 42, 40],
        precipitation_probability_max: [41, 1, 3, 0, 80, 10, 90],
      },
    },
  });
  let meta = new RequestMeta();
  const fri = await getForecast({ lat: 47.6, lng: -122.3, day: "friday" }, meta);
  assert.deepEqual(fri, { type: "weather", date: "2026-10-23", label: "Fri", summary: "thunderstorms", high_f: 54, low_f: 40, precip_chance: 90 });
  assert.ok(calls[0].url.includes("latitude=47.6") && calls[0].url.includes("temperature_unit=fahrenheit"));
  assert.equal((await getForecast({ day: "today" }, meta))?.label, "Today");
  assert.equal(meta.toMeta().fallback_used, false);

  // A failing upstream is a labeled fallback, never a throw.
  mockFetch({ "open-meteo.com": new Response("down", { status: 502 }) });
  meta = new RequestMeta();
  assert.equal(await getForecast({}, meta), null);
  assert.deepEqual(meta.toMeta().fallbacks, ["weather"]);
  console.log("weather (mocked): passed");
}

async function places() {
  if (LIVE) {
    if (!env.geoapifyKey) return console.log("geoapify (live): skipped, GEOAPIFY_API_KEY not set");
    globalThis.fetch = realFetch;
    const meta = new RequestMeta();
    const rows = await geoapifyPlaces(env.demoLat, env.demoLng, 5000, meta);
    assert.ok(rows && rows.length >= 3, `3+ live places, got ${rows?.length}`);
    assert.equal(meta.toMeta().fallback_used, false);
    console.log("geoapify (live):", rows.slice(0, 6).map((r) => `${r.name} [${r.kind}] ${Object.keys(r.hours_json).length}d hours`));
    return;
  }
  const savedKey = env.geoapifyKey;
  try {
    env.geoapifyKey = undefined;
    assert.equal(await geoapifyPlaces(47.6, -122.3, 5000, new RequestMeta()), null, "no key -> null (use Overpass)");

    env.geoapifyKey = "test-key";
    const feature = (id: string, name: string | undefined, raw: Record<string, string>, opening_hours?: string) => ({
      type: "Feature",
      properties: { place_id: id, name, formatted: `${id} Ave NE, Seattle, WA`, lat: 47.66, lon: -122.31, opening_hours, datasource: { sourcename: "openstreetmap", raw } },
      geometry: { type: "Point", coordinates: [-122.31, 47.66] },
    });
    const calls = mockFetch({
      "api.geoapify.com/v2/places": {
        type: "FeatureCollection",
        features: [
          feature("a1", "Value Village", { shop: "second_hand" }, "Mo-Sa 09:00-21:00; Su 10:00-19:00"),
          feature("b2", "Big Whale Consignment", { shop: "second_hand", opening_hours: "Mo-Su 10:00-20:00" }),
          feature("c3", undefined, { shop: "second_hand" }), // unnamed: dropped
        ],
      },
    });
    const meta = new RequestMeta();
    const rows = await geoapifyPlaces(47.6553, -122.3035, 5000, meta);
    assert.equal(calls.length, 1);
    const q = new URL(calls[0].url).searchParams;
    assert.equal(q.get("categories"), "commercial.second_hand");
    assert.equal(q.get("filter"), "circle:-122.3035,47.6553,5000", "Geoapify wants lon,lat order");
    assert.equal(q.get("apiKey"), "test-key");
    assert.deepEqual(rows?.map((r) => [r.id, r.kind]), [["geoapify-a1", "thrift"], ["geoapify-b2", "consignment"]]);
    assert.deepEqual(rows?.[0].hours_json.sun, [["10:00", "19:00"]], "top-level opening_hours");
    assert.deepEqual(rows?.[1].hours_json.wed, [["10:00", "20:00"]], "falls back to raw OSM opening_hours");
    assert.equal(rows?.[0].address, "a1 Ave NE, Seattle, WA");
    assert.equal(meta.toMeta().fallback_used, false);

    // A bad key / quota error falls back to Overpass, labeled.
    mockFetch({ "api.geoapify.com": new Response('{"statusCode":401,"message":"Invalid apiKey"}', { status: 401 }) });
    const failMeta = new RequestMeta();
    assert.equal(await geoapifyPlaces(47.6, -122.3, 5000, failMeta), null);
    assert.deepEqual(failMeta.toMeta().fallbacks, ["geoapify"]);
    console.log("geoapify (mocked): passed");
  } finally {
    env.geoapifyKey = savedKey;
  }
}

async function gmail() {
  if (LIVE) {
    if (!gmailConfigured()) return console.log("gmail (live): skipped, GOOGLE_CLIENT_ID/SECRET + GMAIL_REFRESH_TOKEN not set");
    globalThis.fetch = realFetch;
    const emails = await fetchOrderEmails(5);
    console.log(`gmail (live): ${emails.length} emails`, emails.map((e) => emailToText(e.raw).split("\n").find((l) => l.startsWith("Subject:"))));
    return;
  }
  // A seeded receipt reshaped the way the Gmail API returns it: multipart/alternative,
  // headers on the payload, base64url bodies. The parser must see exactly the same text.
  const eml = readFileSync(path.join("supabase", "seeds", "receipts", "zara-2026-08-14.eml"), "utf8").replace(/\r\n/g, "\n");
  const split = eml.indexOf("\n\n");
  const headers = eml
    .slice(0, split)
    .split("\n")
    .map((l) => ({ name: l.slice(0, l.indexOf(":")), value: l.slice(l.indexOf(":") + 1).trim() }));
  const html = eml.slice(split + 2);
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  const payload = {
    mimeType: "multipart/alternative",
    headers,
    parts: [
      { mimeType: "text/plain", body: { data: b64("plain fallback") } },
      { mimeType: "text/html", body: { data: b64(html) } },
    ],
  };
  assert.equal(emailToText(messageToEmail(payload)), emailToText(eml), "Gmail message reads like the .eml");
  assert.ok(messageToEmail({ headers: [], mimeType: "text/plain", body: { data: b64("just text") } }).endsWith("just text"));

  const saved = { id: env.googleClientId, secret: env.googleClientSecret, token: env.gmailRefreshToken };
  try {
    Object.assign(env, { googleClientId: undefined });
    assert.equal(gmailConfigured(), false);
    Object.assign(env, { googleClientId: "cid", googleClientSecret: "secret", gmailRefreshToken: "refresh" });
    assert.equal(gmailConfigured(), true);

    const calls = mockFetch({
      "oauth2.googleapis.com/token": { access_token: "at-1", expires_in: 3599 },
      "/messages?": { messages: [{ id: "abc" }, { id: "def" }] },
      "/messages/abc": { id: "abc", payload },
      "/messages/def": { id: "def", payload: { ...payload, headers: [{ name: "Subject", value: "Your H&M order" }] } },
    });
    const emails = await fetchOrderEmails(5);
    assert.deepEqual(emails.map((e) => e.id), ["gmail:abc", "gmail:def"]);
    assert.ok(emails[1].raw.startsWith("From: \nSubject: Your H&M order"));
    const tokenBody = new URLSearchParams(String(calls[0].init?.body));
    assert.equal(tokenBody.get("grant_type"), "refresh_token");
    assert.equal(tokenBody.get("refresh_token"), "refresh");
    assert.equal((calls[1].init?.headers as Record<string, string>).authorization, "Bearer at-1");
    assert.ok(decodeURIComponent(calls[1].url).includes("-category:promotions") && calls[1].url.includes("maxResults=5"));
    assert.ok(calls[2].url.endsWith("format=full"));

    // A revoked token surfaces as an error; syncReceipts catches it and uses the seeded inbox.
    mockFetch({ "oauth2.googleapis.com/token": new Response('{"error":"invalid_grant","error_description":"Token has been expired or revoked."}', { status: 400 }) });
    await assert.rejects(fetchOrderEmails(), /invalid_grant/);
    console.log("gmail (mocked): passed");
  } finally {
    Object.assign(env, { googleClientId: saved.id, googleClientSecret: saved.secret, gmailRefreshToken: saved.token });
  }
}

async function imageFetch() {
  for (const a of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00::1", "::ffff:10.0.0.1", "::ffff:a00:1", "64:ff9b::a00:1", "not-an-ip"]) {
    assert.equal(isPublicAddress(a), false, `${a} must be blocked`);
  }
  for (const a of ["8.8.8.8", "142.250.72.14", "2607:f8b0:4005:80c::200e"]) assert.equal(isPublicAddress(a), true, `${a} is public`);

  const blocked: [string, RegExp][] = [
    ["http://example.com/a.jpg", /must be https/],
    ["https://user:pw@example.com/a.jpg", /credentials/],
    ["https://example.com:8443/a.jpg", /default port/],
    ["https://127.0.0.1/a.jpg", /non-public/],
    ["https://[::1]/a.jpg", /non-public/],
    ["https://169.254.169.254/latest/meta-data", /non-public/],
    ["https://[::ffff:10.0.0.1]/a.jpg", /non-public/],
    ["https://localhost/a.jpg", /non-public/], // hostname -> 127.0.0.1, caught at connect-time lookup
  ];
  for (const [url, err] of blocked) await assert.rejects(fetchImage(url), err, url);

  if (LIVE) {
    const logo = "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png";
    const img = await fetchImage(logo);
    assert.ok(img.bytes.length > 1000 && img.mimeType?.startsWith("image/"), "public image downloads");
    await assert.rejects(fetchImage(logo, 500), /too large/, "byte cap enforced while streaming");
    // A public URL that redirects to a private one must be refused at the redirect hop.
    await assert.rejects(fetchImage(`https://httpbin.org/redirect-to?url=${encodeURIComponent("https://127.0.0.1/x.jpg")}`), /non-public/);
    console.log(`image fetch (live): passed (logo ${img.bytes.length} bytes, redirect to 127.0.0.1 blocked)`);
  } else {
    console.log("image fetch (offline): passed");
  }
}

async function storeLinks() {
  assert.equal(domainFromSource("Zara"), "zara.com");
  assert.equal(domainFromSource("H&M"), "hm.com");
  assert.equal(domainFromSource("Levi's"), "levi.com");
  assert.equal(domainFromSource("Quince"), "quince.com");
  assert.equal(domainFromSource("Macy's"), "macys.com");
  assert.equal(domainFromSource("eBay - somethingwithsole"), null, "multi-word names aren't guessed");
  assert.equal(domainFromSource("Perfect Tux"), null);
  if (LIVE) return console.log("store links: live run skipped (costs SerpAPI credits)");

  const savedKey = env.serpapiKey;
  try {
    env.serpapiKey = "test-key";
    const google = (q: string) => `https://www.google.com/search?ibp=oshop&q=${q}`;
    const m = (name: string, merchant: string, url: string, token: string | null): RawMatch => ({
      name, merchant, merchant_domain: null, url, image_url: null, price_cents: 5000, currency: "USD", token,
    });
    const calls = mockFetch({
      "page_token=tok-zara": { product_results: { stores: [
        { name: "Nordstrom", link: "https://www.nordstrom.com/s/blazer/1", extracted_price: 99 },
        { name: "Zara", link: "https://www.zara.com/us/en/blazer-p1.html", extracted_price: 79.9 },
      ] } },
      "page_token=tok-google-only": { product_results: { stores: [{ name: "x", link: "https://www.google.com/aclk?x" }] } },
      "page_token=tok-down": new Response("boom", { status: 500 }),
    });
    const meta = new RequestMeta();
    const out = await resolveStoreLinks([
      m("Blazer", "Zara", google("a"), "tok-zara"),
      m("Direct", "ASOS", "https://www.asos.com/p/1", "tok-unused"), // already a store link: no lookup
      m("Odd", "x", google("b"), "tok-google-only"),
      m("Down", "y", google("c"), "tok-down"),
    ], meta);
    assert.equal(calls.length, 3, "only Google links are looked up");
    assert.ok(calls[0].url.includes("engine=google_immersive_product"));
    assert.deepEqual([out[0].url, out[0].merchant_domain, out[0].price_cents], ["https://www.zara.com/us/en/blazer-p1.html", "zara.com", 7990], "prefers the listed store");
    assert.equal(out[1].url, "https://www.asos.com/p/1");
    assert.equal(out[2].url, google("b"), "never swaps in another Google link");
    assert.equal(out[3].url, google("c"), "failure keeps the Google link");
    assert.deepEqual(meta.toMeta().fallbacks, ["serpapi_store_link"]);
    console.log("store links (mocked): passed");
  } finally {
    env.serpapiKey = savedKey;
  }
}

async function channel3() {
  const product = (offers: object[]) => ({ id: "p1", title: "Wool Blazer", brands: [{ name: "Mango" }], images: [{ url: "https://img/2" }, { url: "https://img/1", is_main_image: true }], offers });
  const m = toMatch(product([
    { url: "https://shop.example/blazer", domain: "shop.example", price: { price: 120, currency: "USD" }, availability: "InStock" },
    { url: "https://buy.trychannel3.com/r/abc", domain: "www.zara.com", price: { amount: 89.9, currency: "USD" }, availability: "InStock" },
    { url: "https://www.asos.com/p/1", domain: "asos.com", price: { price: 50, currency: "USD" }, availability: "OutOfStock" },
  ]));
  assert.deepEqual(m, {
    name: "Wool Blazer", brand: "Mango", merchant: "Shop", merchant_domain: "shop.example",
    url: "https://shop.example/blazer", image_url: "https://img/1", price_cents: 12000, currency: "USD",
  }, "first in-stock offer wins (any store)");
  const redirect = toMatch(product([
    { url: "https://www.asos.com/p/1", domain: "asos.com", price: { price: 50 }, availability: "OutOfStock" },
    { url: "https://buy.trychannel3.com/r/abc", domain: "www.zara.com", price: { amount: 89.9, currency: "USD" }, availability: "InStock" },
  ]));
  assert.deepEqual([redirect?.merchant_domain, redirect?.merchant, redirect?.price_cents], ["zara.com", "Zara", 8990], "skips out of stock; domain from offer.domain, not the redirect url");
  assert.equal(toMatch(product([{ url: "https://x.example/a", domain: "x.example", availability: "InStock" }]))?.merchant_domain, "x.example");
  assert.equal(toMatch(product([])), null, "no offers -> no match");
  if (LIVE) return console.log("channel3: live run skipped");

  const saved = env.channel3Key;
  try {
    env.channel3Key = "c3-key";
    const calls = mockFetch({
      "/v1/image-search": { products: [product([{ url: "https://www.cos.com/p/9", domain: "cos.com", price: { price: 175 }, availability: "InStock" }])] },
      "/v1/search": { products: [] },
    });
    const meta = new RequestMeta();
    const rows = await imageSearch("QUJD", meta);
    assert.equal(rows[0].url, "https://www.cos.com/p/9");
    assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], "c3-key");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { base64_image: "QUJD", limit: 20 });
    assert.deepEqual(await textSearch("camel blazer", meta), []);
    assert.equal(meta.toMeta().fallback_used, false);

    mockFetch({ "/v1/image-search": new Response('{"detail":"Invalid API key"}', { status: 401 }) });
    const failMeta = new RequestMeta();
    assert.deepEqual(await imageSearch("QUJD", failMeta), [], "errors fall back (SerpAPI path)");
    assert.deepEqual(failMeta.toMeta().fallbacks, ["channel3"]);
    console.log("channel3 (mocked): passed");
  } finally {
    env.channel3Key = saved;
  }
}

function messagingLinks() {
  const match = (id: string, url: string) => ({ id, name: `Item ${id}`, currency: "USD", price_cents: 5000, merchant_domain: "zara.com", url });
  const cards: Card[] = [
    { type: "reel_matches", analysis_id: "a", identified: [{ label: "camel blazer", category: "outerwear" }], matches: [match("1", "https://zara.com/1"), match("2", "https://cos.com/2"), match("3", "https://asos.com/3"), match("4", "https://hm.com/4")] },
    { type: "verdict", verdict: "BUY", headline: "Fills a gap", item: { name: "Item 1", url: "https://zara.com/1" }, reasons: ["r"], dupes: [], gap_filled: null, price: null },
  ];
  const parts = renderForMessaging("Love it — see https://cos.com/2", cards);
  const details = parts[1].kind === "text" ? parts[1].text : "";
  assert.ok(details.includes("1. Item 1 — $50.00 at zara.com\nhttps://zara.com/1"), details);
  assert.ok(details.includes("https://asos.com/3") && !details.includes("https://hm.com/4"), "top 3 only");
  assert.ok(!details.includes("https://cos.com/2"), "link already in the reply isn't repeated");
  assert.equal(details.split("https://zara.com/1").length, 2, "verdict doesn't repeat the match link");

  const intent: Card = { type: "purchase_intent", intent_id: "i", item_name: "Item 1", amount_cents: 5000, currency: "USD", merchant_domain: "zara.com", merchant_url: "https://zara.com/1", status: "awaiting_approval", approval_expires_at: null, mode: "stripe_test", prompt: "Reply YES" };
  assert.ok(renderForMessaging("Reply YES to pay", [intent]).some((p) => p.kind === "text" && p.text.includes("Rather check out yourself? https://zara.com/1")));
  const paid: Card = { type: "payment_confirmation", intent_id: "i", status: "paid", item_name: "Item 1", amount_cents: 5000, currency: "USD", merchant_domain: "zara.com", reference: "pi_1", mode: "stripe_test", receipt: { retailer: "Zara", emailed: true, wardrobe_item_ids: ["w"] } };
  assert.deepEqual(renderForMessaging("Done ✅ Paid", [paid]), [{ kind: "text", text: "Done ✅ Paid" }], "no ref/receipt bubble after paying");
  console.log("messaging links: passed");
}

async function purchaseReceipt() {
  const order = {
    intentId: "4f9c2a1e-0000-4000-8000-000000000abc", userId: "u", customerName: "Alex Rivera",
    merchantName: "H&M", merchantDomain: "hm.com", merchantUrl: "https://www2.hm.com/en_us/p1.html",
    item: { name: "Relaxed <Wool> Blazer", brand: null, color: "camel", imageUrl: "https://img.example/b.jpg" },
    amountCents: 7990, currency: "USD", paidAt: new Date("2026-10-18T07:00:00Z"), reference: "pi_3Test", card: { brand: "visa", last4: "4242" }, mode: "stripe_test" as const,
  };
  const e = buildReceiptEmail(order);
  assert.equal(orderNumber(order.intentId), "DRP-4F9C2A1E");
  assert.ok(e.subject.includes("H&M order DRP-4F9C2A1E") && e.subject.includes("demo"));
  assert.ok(e.html.includes("Relaxed &lt;Wool&gt; Blazer"), "item names are HTML-escaped");
  for (const body of [e.text, e.html]) {
    assert.ok(body.includes("DEMO RECEIPT") && body.includes("no real order was placed with H&") && body.includes("$79.90"), "labeled demo + amount");
  }
  const mime = toMime(e, "alex@example.com");
  assert.ok(mime.startsWith('From: "H&M via Dripy (demo)" <alex@example.com>\r\nTo: <alex@example.com>'));
  assert.ok(mime.includes("Content-Type: multipart/alternative") && mime.trimEnd().endsWith("--"));
  assert.ok(emailToText(toInboxText(e)).includes("Order total | $79.90"), "parser sees the order table");

  const saved = { id: env.googleClientId, secret: env.googleClientSecret, token: env.gmailRefreshToken };
  try {
    Object.assign(env, { googleClientId: "cid", googleClientSecret: "secret", gmailRefreshToken: "refresh" });
    let sentRaw = "";
    const b64 = (x: string) => Buffer.from(x, "utf8").toString("base64url");
    const calls = mockFetch({
      "oauth2.googleapis.com/token": { access_token: "at-1" },
      "/profile": { emailAddress: "alex@example.com" },
      "/messages/send": (init?: RequestInit) => {
        sentRaw = Buffer.from(JSON.parse(String(init?.body)).raw, "base64url").toString("utf8");
        return { id: "sent1" };
      },
      "/messages/sent1": { id: "sent1", payload: { mimeType: "multipart/alternative", headers: [{ name: "Subject", value: e.subject }], parts: [{ mimeType: "text/html", body: { data: b64(e.html) } }] } },
    });
    const sent = await sendToSelf((addr) => toMime(e, addr));
    assert.equal(sent.id, "gmail:sent1");
    assert.ok(sentRaw.includes("<alex@example.com>") && sentRaw.includes(e.subject));
    assert.ok(calls.some((c) => c.url.endsWith("/messages/send") && c.init?.method === "POST"));
    assert.ok(emailToText(sent.raw).includes("Order total | $79.90"), "read-back is what the parser gets");

    mockFetch({
      "oauth2.googleapis.com/token": { access_token: "at-1" },
      "/profile": { emailAddress: "alex@example.com" },
      "/messages/send": new Response('{"error":{"code":403,"message":"Request had insufficient authentication scopes."}}', { status: 403 }),
    });
    await assert.rejects(sendToSelf((addr) => toMime(e, addr)), /re-run npm run gmail:auth/);
    console.log("purchase receipt (mocked): passed");
  } finally {
    Object.assign(env, { googleClientId: saved.id, googleClientSecret: saved.secret, gmailRefreshToken: saved.token });
  }
}

async function main() {
  const origError = console.error;
  console.error = () => {}; // expected fallback logs
  try {
    await weather();
    await places();
    await gmail();
    await imageFetch();
    await storeLinks();
    await channel3();
    messagingLinks();
    await purchaseReceipt();
  } finally {
    console.error = origError;
    globalThis.fetch = realFetch;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
