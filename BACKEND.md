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
`BASE_URL=http://localhost:3000 npm run test:contract` (every endpoint's contract) ·
`npm run test:integrations` (weather, Geoapify, Gmail, image-download guard; `-- --live` for real calls).

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
index, a $300 cap, a known store domain with an https product link (any store; no allowlist since 2026-10-18), a 10-minute TTL and an append-only
`purchase_intent_events` audit trail.

**Payment rails** (`PAYMENT_PROVIDER`, all behind `src/lib/integrations/payments.ts`):
`simulated` (default, zero setup) · `stripe` (real Stripe **test-mode** PaymentIntent,
charged off-session to a saved Visa test card •••• 4242 after the user's YES; live keys are
refused) · `visa_sandbox` (Visa Intelligent Commerce, needs Visa-issued credentials; **not in
use**: the team chose Stripe test mode, and the adapter's request bodies are unverified).
**After payment: demo receipt → wardrobe.** The paying request (only the one that wins the
`approved → paid` transition, or the webhook) builds an order confirmation styled for the
store the user bought from (`src/lib/pipelines/purchaseReceipt.ts`), emails it to the
connected Gmail (send-to-self, so it lands in the inbox the receipt sync reads), reads it back
and parses it with the same Gemini receipt parser as real order emails. The item enters the
wardrobe with `source: "purchase"` and a `receipt_id`. The email is labeled as a demo in its
subject, banner and footer, and is sent from the user's own address (the display name is
"<Store> via Dripy (demo)"). Without Gmail send it stays in-app (`fallbacks: ["gmail_send"]`);
if parsing fails the item is added directly (`purchase_receipt`). The `payment_confirmation`
card carries `receipt: {retailer, emailed, wardrobe_item_ids}` on the paying turn.

Stripe outcomes are also reconciled by a signed webhook at `POST /api/webhooks/stripe`
(it can only finish an already-approved payment). Check the rail with `npm run smoke:stripe`.
Local webhook: `stripe listen --forward-to localhost:3000/api/webhooks/stripe --events
payment_intent.succeeded,payment_intent.payment_failed` prints the `whsec_` for `.env.local`
(verified: signed events accepted, forged ones rejected); a deployed URL needs its own secret
from the Stripe dashboard.

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
| GET | `/api/weather` | `?lat=&lng=&date=` (YYYY-MM-DD, `today`, `tomorrow` or a weekday; next 7 days) | `{card: WeatherCard}`; 400 outside the week, 503 if Open-Meteo is down |
| GET | `/api/health` | — | which integrations are live |

Cards the chat can return: `reel_matches`, `verdict`, `purchase_intent`,
`payment_confirmation`, `places`, `outfit`, `weather`, `error`. Render `purchase_intent.prompt`
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

Over iMessage, send each photo **before** (or with) its question: iMessage delivers the photo
and the caption as two messages.

**Last full runs (2026-10-17):**
- Web chat (`/api/chat`, `gemini-3.5-flash`): all 7 beats passed, 5–11.5 s per reply, real
  Stripe test charge, blazer landed in the wardrobe.
- Real iMessage (Photon → worker → backend, `gemini-3.8-flash`, paid key) but with *non-demo*
  photos (a Celine leather bomber, a grey tuxedo): text replies 5–15 s end to end, photo
  replies 32–34 s (Lens timeout, see Known issues); the merchant allowlist correctly refused
  checkout at MensUSA, so nothing was charged. **The demo-photo path hasn't been run over
  iMessage yet.**

Honest labels: receipts come from a seeded inbox of five real-format order emails unless
Gmail is configured (parsing is live Gemini either way); payments are Stripe **test mode** on a Visa test card (or `simulated`); the
approval model mirrors Visa Intelligent Commerce, and `visa_sandbox` plugs into VIC when
credentials land; Instagram links ask for a screenshot (login wall).

## Optional integrations

- **Weather (Open-Meteo, no key):** the agent's `get_weather` tool runs before `build_outfit`
  for a specific day, and the chat returns a `weather` card.
- **Geoapify** (`GEOAPIFY_API_KEY`, free tier): replaces Overpass as the live donation source
  (same OpenStreetMap data; public Overpass timed out on every request tested); falls back to
  Overpass, then the seeded list. It only searches `commercial.second_hand`: Geoapify files
  charity shops (Goodwill etc.) under the generic `commercial` category, where name searches
  took ~8 s, so the big chains come from the seeded list.
- **Gmail** (`GOOGLE_CLIENT_ID/SECRET` + `GMAIL_REFRESH_TOKEN` from `npm run gmail:auth`):
  `/api/receipts/sync` reads up to 10 recent order emails instead of the seeded inbox; falls
  back to the seeded inbox if Gmail fails. Scopes are `gmail.readonly` + `gmail.send` (send is
  only used for the demo purchase receipt, to the account's own address); tokens made before
  the send scope was added must be re-created with `npm run gmail:auth`. The OAuth client is a Web client with redirect
  `http://localhost:3000/api/gmail/callback` (stop `npm run dev` while signing in), and your
  account must be a test user. Testing-mode refresh tokens expire after 7 days. The inbox
  connected so far has **no clothing orders**, and the parser hasn't been tested on
  non-clothing receipts, so don't run a real sync against it yet.

`npm run test:integrations` checks all three with mocked HTTP; add `-- --live` to hit the
real services whose keys are set.

## Known issues (found in the 2026-10-17 runs)

- **Photo replies ~30 s:** `lensMatches` (`src/lib/integrations/serpapi.ts`) waits 15 s for
  SerpAPI Google Lens, which timed out on every live photo; the Shopping fallback then works.
  A shorter Lens timeout, or running Lens and Shopping in parallel, should halve it.
- **Product search:** Channel3 (`CHANNEL3_API_KEY`) is the primary live source: one image
  search + one text search (for the price median) per photo, each result carrying the store's
  own product page, domain, price and stock; the first in-stock offer is used. SerpAPI is the fallback when Channel3 is unconfigured, fails or finds nothing.
  `DEMO_CATALOG=true` still short-circuits the black bomber / camel blazer to curated matches
  whose links are store *search* pages; set it to `false` for real product links.
- ~~Live matches have `merchant_domain: null`~~ Fixed (SerpAPI path): the top 3 live Shopping matches are
  resolved to the store's own product page (SerpAPI `google_immersive_product`, ~2–3 s in
  parallel, 3 extra SerpAPI searches per live photo), and known or one-word store names map to a
  domain before that. A failed lookup keeps the Google Shopping link.
- **Donations ranking:** open-now beats distance and kind, so late at night the real donation
  drop-off (Goodwill, 6.6 km) fell out of the top 5. "UW Surplus" (university furniture) comes
  back from Geoapify as second-hand, and the agent called it a "thrift drop-off".
- **Reply wording:** at checkout the model's own text said "via Visa" without "test mode" (the
  card prompt is labeled correctly); the outfit reply said ~50°F while the card showed 57/42.
- **The YES step takes ~5.4 s with no LLM** (database + Stripe calls).
- **Gemini resilience:** each call may wait 45 s and retry 3×, so an overloaded model makes
  replies hang. Option: shorter timeout + fall back to `gemini-3.5-flash` / `3.6-flash`
  (healthy on 2026-10-17 while 3.8 returned 503s).

## Not built yet (stretch, in order)

Photo upload auto-tag (`/api/wardrobe/upload`), Style DNA, closet cleanout, price-drop watch. Parked: swipe deck, avatar, group chat.
