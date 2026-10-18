# Dripy: Backend PRD

**Owner: Narayana - DubHacks 2026**

This document plus the Overall PRD is the complete brief for Claude Code to build Dripy's backend and agentic layer. The frontend workstream builds against the API contract in section 6.

## 1. What the backend owns

- The agent brain: Claude API with tool use, reachable over iMessage/SMS/WhatsApp (Photon) and the built-in web chat.
- Wardrobe ingestion: Gmail receipt parsing plus photo upload auto-tagging.
- Reel pipeline: link in, frames out, vision identification, similar-item matches.
- Buy-check verdicts against the wardrobe.
- Thrift and donation place lookup.
- Visa approve-to-pay purchase intents.
- Stretch tier: price-drop watches on wishlist items, closet cleanout analysis, Style DNA derivation, weather-aware outfit picks.
- All persistence (Supabase Postgres) and the REST API the frontend consumes.

## 2. Stack

- Next.js App Router on Vercel: API routes and webhooks in the same repo as the frontend.
- Supabase Postgres with supabase-js (or Prisma if faster).
- Claude API (Anthropic): tool-use agent loop; vision for frames and uploads.
- Photon Chat SDK adapter for messaging (project ID + secret).
- Gmail API read-only, or a seeded inbox of sample receipts.
- yt-dlp + ffmpeg for reel frames. If ffmpeg is painful on serverless, pre-extract frames for the demo URLs or run a small Railway/Fly worker.
- SerpAPI (Google Lens / Google Shopping) for similar items and wishlist price checks.
- Open-Meteo for forecast lookups: free, no API key (stretch).
- Google Places Nearby Search + Details for thrift/donation. No-key fallback: OpenStreetMap Overpass (shop=charity, clothes recycling), then a seeded Seattle list.
- Visa Intelligent Commerce (Visa Acceptance Platform sandbox) for purchase intents; Visa Developer MCP inside Claude Code for API discovery.

## 3. Data model (Supabase)

- users: id, name, phone, email, style_profile_id
- wardrobe_items: id, user_id, name, brand, category, color, size, price, source (receipt | upload | reel), occasion_tags[], image_url, times_worn, last_worn_at, created_at
- receipts: id, user_id, gmail_message_id, retailer, order_date, parsed_json, total
- wishlist_items: id, user_id, name, brand, url, image_url, price, added_from (chat | reel | swipe)
- purchase_intents: id, user_id, item, merchant_url, amount, currency, visa_intent_id, status (proposed | approved | paid | cancelled)
- chat_messages: id, user_id, channel (imessage | sms | whatsapp | web), direction, body, attachments, created_at
- style_profile: id, user_id, liked_brands[], disliked[], color_affinity[], notes
- donation_saved_places: id, user_id, place_name, address, lat, lng, kind (thrift | consignment | donation_dropoff), saved_at
- price_watches: id, user_id, wishlist_item_id, target_price, last_price, last_checked_at, status (watching | dropped | bought)
- Style DNA is derived from style_profile plus wardrobe_items (brand counts, color affinity, occasion tags): no new table.
- Parked (nice-to-have): group_chats (id, photon_group_id, topic), group_members (group_id, user_id, share_amount, paid_status), shared_carts (id, group_id, items_json, status), swipe_events (id, user_id, item_ref, liked, created_at)

## 4. Agent loop

Claude with tool use. System prompt: you are the user's fashion agent. You know their wardrobe, shop for them, and never buy without explicit approval. Tools exposed to the model:

- search_wardrobe(query, filters): semantic + tag search over wardrobe_items.
- add_wardrobe_items(items[]): from receipt parse or upload tagging.
- parse_receipts(): trigger the Gmail scan, return newly added items.
- analyze_reel(url): run the reel pipeline, return identified items and similar matches.
- buy_check(item): compare against the wardrobe (dupes, gaps, cost context), return verdict and reasoning.
- find_donation_places(lat, lng, kind): nearby thrift, consignment, and donation drop-offs.
- create_purchase_intent(item, merchant_url, amount): Visa sandbox intent; always requires user approval in chat before execution.
- execute_purchase_intent(id): only after an explicit "yes" from the user in the same conversation.
- manage_subscription(action, vendor) and schedule_event(title, when): thin stubs for the autonomy story; mocked data is fine.
- watch_price(wishlist_item_id, target_price?) and check_price_drops(): track wishlist prices via SerpAPI Shopping, alert in chat on a drop (stretch).
- closet_cleanout(): finds items with times_worn = 0 or stale last_worn_at plus dupes, and bundles donation places from find_donation_places so the run is one message (stretch).
- style_dna(): derives brands, colors, and occasions from the wardrobe and style profile for the DNA card (stretch).
- weather_outfit(occasion, date, lat, lng): Open-Meteo forecast plus wardrobe retrieval for forecast-aware outfit picks (stretch).
- Parked: group tools (collect_group_input, propose_shared_cart, request_group_approvals) with per-member purchase intents so each person approves and pays their own share.

**Rules to encode:**

- Never execute a payment without an explicit approval message.
- Always cite wardrobe evidence in a buy_check.
- Label mocked integrations honestly when asked.

## 5. Pipelines

- Receipts: Gmail search for order-confirmation subjects, parse with Claude into {retailer, items[{name, brand, size, price}], total, date}, upsert wardrobe_items (source=receipt). Fallback: 5 seeded sample emails checked into the repo.
- Photo upload: image to Claude vision, returns {name, brand guess, category, color, occasion_tags[]}, saved as wardrobe_items (source=upload).
- Reel: url to yt-dlp download, ffmpeg frames (1 per second, max 8), Claude vision identifies clothing items, SerpAPI Lens/Shopping per item, return matches {name, price, merchant, url, image}.
- Buy-check: retrieve wardrobe by category and brand similarity, Claude returns a verdict with reasoning (dupe count, gap fill, price sanity).
- Donations: Google Places Nearby Search (keywords thrift store, consignment, donation center, ranked by distance) plus Details for hours. Fallback chain: Overpass API around lat/lng, then the seeded Seattle list (Goodwill, Salvation Army, Buffalo Exchange, Crossroads Trading, Value Village).
- Price watch (stretch): Vercel cron hourly over price_watches, SerpAPI Shopping price lookup per item, on a drop push a chat message with old and new price and the merchant link.
- Cleanout (stretch): query wardrobe_items for times_worn = 0 or last_worn_at older than 6 months, group dupes by category and brand similarity, attach the 3 nearest donation places so the whole run lands in one reply.

## 6. API contract

What the frontend consumes. All endpoints return JSON, errors as {error, fallback_used?}. Until each is live, return the checked-in mock JSON so the frontend never blocks.

- POST /api/chat {user_id, message, attachments[]} -> {reply, cards[]} - web chat; cards drive the verdict, product, and donation UI.
- GET /api/chat/history?user_id=
- POST /api/messages/inbound - Photon webhook (not used by the frontend).
- GET /api/wardrobe?user_id=&occasion=&brand=&category=&wishlist= -> items[]
- POST /api/wardrobe/upload (multipart image) -> created item with auto-tags
- POST /api/receipts/sync {user_id} -> {added, items[]}
- POST /api/reels/analyze {user_id, url} -> {identified[], matches[]}
- POST /api/buy-check {user_id, item_url | item_desc} -> {verdict, reasons[], dupes[]}
- GET /api/donations/nearby?lat=&lng=&kind= -> places[] {name, address, distance, hours, maps_url}
- POST /api/purchase-intents {user_id, item, amount, merchant_url} -> intent {id, status}
- POST /api/purchase-intents/:id/approve -> {status, confirmation}
- GET /api/style-profile?user_id= (nice-to-have, feeds the swipe deck later)
- POST /api/price-watches {user_id, wishlist_item_id, target_price?} -> watch; GET /api/price-watches?user_id= -> watches with current prices (stretch)
- POST /api/cleanout {user_id} -> {unworn[], dupes[], donation_places[]} (stretch)
- GET /api/style-dna?user_id= -> {brands[], colors[], occasions[], summary} (stretch)
- GET /api/weather?lat=&lng=&date= -> forecast, or fold it into the outfit answer as a card in /api/chat (stretch)

## 7. Integrations: verified and unverified

Checked October 17, 2026.

**Photon: verified.** Real phone number, native iMessage with SMS/RCS fallback, WhatsApp via Meta's official Cloud API, cloud project ID and secret, TypeScript Chat SDK adapter. Unverified: signup and approval terms. Request at hour zero; the web chat is the demo-safe fallback.

**Visa Developer MCP: verified.** Official server at developer.visa.com/mcp: read-only docs, schemas, and code generation, OAuth, runs inside Claude Code.

**Visa Intelligent Commerce: verified, sandbox gated.** Enroll a card, passkey auth, tokenized credentials, create/update/cancel purchase intents, retrieve payment credentials. Free sandbox needs evaluation registration at developer.visaacceptance.com: hour zero. Fallback: mock purchase-intent endpoint with the same shapes.

**Places vs Overpass.** Google Places needs a key with billing (free tier). OpenStreetMap Overpass needs no key. Seed the Seattle list regardless so the demo never depends on either.

## 8. Backend milestones

1. **Sat 1:00-3:00 PM** - Schema, seed data, agent loop with tools on dummy data, /api/chat working. Hour zero: request Photon access, register the Visa sandbox, optional Places key.
2. **Sat 3:00-5:30 PM** - Receipt parser plus upload auto-tag plus /api/wardrobe.
3. **Sat 5:30-7:30 PM** - Reel pipeline, buy-check, and /api/donations/nearby.
4. **Sat 7:30-9:30 PM** - Photon webhook live (fallback: web chat). Visa purchase intents (fallback: shaped mock).
5. **Sat 9:30-10:15 PM** - Demo seeding, two rehearsals, backup video of the full loop.
6. **Sat 10:30 PM** - Devpost draft. Overnight: stretch tier (price-watch cron, cleanout, Style DNA, weather-aware picks), then group-chat agent and swipe events.

## 9. Env vars

- ANTHROPIC_API_KEY: Claude agent brain and vision.
- PHOTON_PROJECT_ID + PHOTON_SECRET: from photon.codes once approved.
- DATABASE_URL: Supabase Postgres.
- GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET: Gmail read-only scope, or skip and seed receipts.
- SERPAPI_KEY: visual and shopping search for similar items.
- GOOGLE_PLACES_KEY: optional; Overpass or seeded list without it.
- OPEN_METEO_BASE_URL: no key needed, just api.open-meteo.com (stretch).
- VISA sandbox credentials: from developer.visaacceptance.com after evaluation registration.

## 10. Acceptance criteria

1. From one iMessage thread: an outfit question answered from real wardrobe data; a reel link returns matches; a buy-check cites owned dupes; "where can I donate?" returns 3+ nearby places with hours; "buy it" produces a Visa sandbox confirmation.
2. Every endpoint returns real or checked-in-mock JSON; no frontend screen ever hard-blocks on the backend.
3. Every mocked integration is labeled as mocked in the UI and demo.
4. Stretch: a price drop triggers a chat alert; cleanout returns unworn items with donation places; /api/style-dna returns real wardrobe-derived data; an outfit answer cites the forecast.

---

Integration facts verified October 17, 2026. Photon signup terms and Visa sandbox approval timing are unverified; both have fallbacks.
