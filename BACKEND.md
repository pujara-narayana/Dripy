# Dripy backend

The agent that talks you out of buying — and pays with Visa when you say yes.

Next.js 16 route handlers + Supabase + Gemini (`gemini-3.8-flash`, set `GEMINI_MODEL` to change). Everything lives in
`src/lib` and `src/app/api`. The frontend never talks to Supabase directly.

## Setup (10 minutes)

1. `cp .env.example .env.local` and fill in the keys you have. Missing keys fall back to
   labeled mocks/simulations; nothing hard-fails.
2. Supabase → SQL editor → paste and run `supabase/migrations/0001_init.sql`
   (creates tables, the atomic `approve_intent` function and public storage buckets),
   then `supabase/migrations/0002_stripe.sql`.
3. `npm run seed` — demo user Alex, 15-item wardrobe, 5 receipts, 2 curated demo
   analyses, 5 Seattle donation places. Re-run before every rehearsal (it resets chat).
4. `npm run dev`, then check `GET /api/health` to see which integrations are live.
5. iMessage: `npm run worker` (needs `PHOTON_PROJECT_ID/SECRET`, `PHOTON_WORKER_SECRET`,
   `DRIPY_BACKEND_URL`). Keep it running on a laptop during the demo, or deploy to Railway/Fly.

Tests: `npm test` (buy-check demo beats, approval classifier, hours/geo) ·
`npm run smoke:gemini` (live Gemini check: JSON output, tool round trip, vision) ·
`BASE_URL=http://localhost:3000 npm run test:contract` (every endpoint's contract).

## How a message flows

```
iMessage ─▶ Photon ─▶ worker/photon-worker.ts ─▶ POST /api/messages/inbound ─┐
web chat ─────────────────────────────────────▶ POST /api/chat ──────────────┤
                                                                             ▼
                          src/lib/agent/conversation.ts  handleTurn()
                           1. save inbound message (dedupes Photon retries)
                           2. checkout pending? → approvalRouter (regex, NO LLM)
                                YES → approve_intent() (atomic) → payment rail → paid
                                NO  → cancel
                           3. otherwise → Gemini tool loop (agent/loop.ts)
```

**Payment safety (the Visa-track story):** the model has no "pay" tool. It can only
*propose* a checkout (`create_purchase_intent(match_id)`); the amount and store come from
the stored product match, never from the model. Payment runs only when the user's own
message says yes (deterministic classifier) or they tap Approve. Postgres enforces it:
`check (status <> 'paid' or approved_by_message_id is not null)`, approval is a
compare-and-set (a racing button + "yes" can't double-charge), there's a one-open-checkout
index, a $300 cap, a merchant allowlist, a 10-minute TTL and an append-only
`purchase_intent_events` audit trail.

**Payment rails** (`PAYMENT_PROVIDER`, all behind `src/lib/integrations/payments.ts`):
`simulated` (default, zero setup) · `stripe` (real Stripe **test-mode** PaymentIntent,
charged off-session to a saved Visa test card •••• 4242 after the user's YES; live keys are
refused) · `visa_sandbox` (Visa Intelligent Commerce, needs Visa-issued credentials).
Stripe outcomes are also reconciled by a signed webhook at `POST /api/webhooks/stripe`
(it can only finish an already-approved payment). Check the rail with `npm run smoke:stripe`.

## API contract (for the frontend)

Types: `src/lib/types.ts` (`Card` union, every response type). Every success response
has `meta: { mode: "live" | "cached" | "simulated", fallback_used, fallbacks? }` — show a
small "simulated" / "cached" badge when it isn't `live`. Errors are `{ error }` with 4xx/5xx.
Checked-in examples of every response: `mocks/*.json`. `user_id` defaults to the demo user.

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/api/chat` | `{user_id, message, attachments?: [{type:"image", data_url}], lat?, lng?}` or multipart (`message`, `image` files) | `ChatResponse {reply, cards[], message_id}` |
| GET | `/api/chat/history` | `?user_id=&limit=50` | `{messages[]}` oldest first, each with `cards` |
| GET | `/api/wardrobe` | `?user_id=&category=&brand=&occasion=&source=&wishlist=true` | `{items[], facets}` |
| POST | `/api/reels/analyze` | `{user_id, attachments:[{type:"image", data_url}]}` or `{user_id, url}` | `{analysis_id, identified[], matches[], card}` |
| POST | `/api/buy-check` | `{user_id, match_id}` or `{user_id, item_desc}` or `{user_id, item_url}` | `{card: VerdictCard}` |
| POST | `/api/purchase-intents` | `{user_id, match_id}` | `{id, status, card}` (amount is server-derived) |
| GET | `/api/purchase-intents/:id` | `?user_id=` | `{id, status, card}` — poll after showing the checkout card |
| POST | `/api/purchase-intents/:id/approve` | `{user_id}` | `{status, card: PaymentConfirmationCard, reply, nudge}`; 409 if expired/cancelled |
| GET | `/api/donations/nearby` | `?lat=&lng=&kind=thrift\|consignment\|donation_dropoff\|recycling` | `{places[], card}` |
| POST | `/api/receipts/sync` | `{user_id, reparse?: true}` | `{added, receipts_parsed, items[]}` |
| GET | `/api/health` | — | which integrations are live |

Cards the chat can return: `reel_matches`, `verdict`, `purchase_intent`,
`payment_confirmation`, `places`, `outfit`, `error`. Render `purchase_intent.prompt`
verbatim near the Approve button (it carries the "simulated" label).

## Demo runbook

1. `npm run seed`. Prepare two screenshots: a **black bomber** (SKIP beat) and a **camel
   blazer** (BUY beat). With `DEMO_CATALOG=true`, Gemini identifies the garment live and,
   if it's a demo garment, serves the curated matches (`meta.mode: "cached"`), so results
   are deterministic even if iMessage recompresses the photo. Optional exact match:
   `npm run demo:register -- bomber.png blazer.png`.
2. Text: *"going to a rooftop dinner Friday, what should I wear?"* → outfit card from the closet.
3. Forward the bomber → matches → *"should I buy it?"* → **SKIP**: "you already own the
   Zara Black Bomber Jacket and the Mango Black Faux-Leather Biker Jacket".
4. Forward the blazer → *"should I buy this one?"* → **BUY**: fills the smart-casual gap,
   $79.90 vs ~$95 typical.
5. *"ok buy it"* → checkout card "Reply YES to pay $79.90 at zara.com" → *"yes"* → paid
   (receipt ref, e.g. Stripe `ch_…`) → nudge: "you've never worn your Levi's Light-Wash Denim Jacket, donate it?"
6. *"yes, where?"* → 3+ nearby places with distance and hours.
7. Web grid: the blazer now shows with `source: "purchase"`.

Honest labels: Gmail is a seeded inbox of five real-format order emails (parsing is
live Gemini); payments are Stripe **test mode** on a Visa test card (or `simulated`); the
approval model mirrors Visa Intelligent Commerce, and `visa_sandbox` plugs into VIC when
credentials land; Instagram links ask for a screenshot (login wall).

## Not built yet (stretch, in order)

Photo upload auto-tag (`/api/wardrobe/upload`), Style DNA, weather-aware outfits,
closet cleanout, price-drop watch. Parked: swipe deck, avatar, group chat.
