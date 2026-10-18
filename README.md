# Dripy

**The AI stylist in your iMessages that talks you out of buying, and pays when you say yes.**
DubHacks 2026 · Visa track

Dripy knows your closet. Send it a screenshot of something you saw on TikTok and it finds where
to buy it, tells you whether you actually need it (citing what you already own), checks out
with a Visa card only after you reply YES, and finds places to donate what you don't wear.

- **Backend:** Next.js 16 API routes · Supabase (Postgres + Storage) · Google Gemini · SerpAPI · Stripe (test mode) · Photon (iMessage) · Open-Meteo (weather) · Geoapify (donation places) · Gmail (optional)
- **API reference and architecture:** [`BACKEND.md`](BACKEND.md)
- **Response examples for every endpoint:** [`mocks/`](mocks) · TypeScript types: [`src/lib/types.ts`](src/lib/types.ts)

---

## 1. Get it running (5 minutes)

**You need:** Node.js 22+ (`node -v`) and git.

```bash
git clone https://github.com/pujara-narayana/Dripy.git
cd Dripy
npm install
```

**Get the env file.** Ask Narayana for the team's `.env.local` (sent privately, never through
git or Slack channels), and save it in the project root as `Dripy/.env.local`.
Template with every variable explained: [`.env.example`](.env.example).

> **Frontend only? You can skip the env file.** With no keys, every endpoint returns the
> checked-in mock JSON (`meta.mode: "simulated"`), so you can build the UI against the real
> contract without any accounts.

```bash
npm run dev
```

Open **http://localhost:3000/api/health**. With the team env file you should see:

```json
{ "model": "gemini-3.8-flash", "llm": "live (gemini)", "database": "live", "serpapi": "live", "geoapify": "live", "payments": "stripe_test", "photon_worker": "down" }
```

`photon_worker: "down"` is normal unless the iMessage worker is running (see section 4).

## 2. Try the agent from the terminal

The web chat endpoint is the same brain as iMessage. With `npm run dev` running:

```bash
# Outfit from your closet
curl -s localhost:3000/api/chat -H 'content-type: application/json' \
  -d '{"message":"going to a rooftop dinner friday, what should I wear?"}'

# Send a screenshot. A black bomber and a camel blazer hit the curated demo matches (~10 s);
# any other garment takes the live product-search path (~30 s, see Troubleshooting)
curl -s localhost:3000/api/chat -F "message=should I buy this?" -F "image=@bomber.png"   # → SKIP
curl -s localhost:3000/api/chat -F "message=what about this one?" -F "image=@blazer.png" # → BUY

# Checkout: proposes a purchase, then a real Stripe test-mode charge on a Visa test card.
# After YES, a demo receipt from the store is emailed to the connected Gmail and parsed into the wardrobe
curl -s localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"ok buy it"}'
curl -s localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"yes"}'

# Donation spots near UW
curl -s localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"where can I donate?"}'
```

Each response is `{ reply, cards[], meta }`. `cards` drive the UI (`reel_matches`, `verdict`,
`purchase_intent`, `payment_confirmation`, `places`, `outfit`, `weather`); see `BACKEND.md`.

Other useful endpoints: `GET /api/wardrobe`, `GET /api/chat/history`,
`GET /api/donations/nearby?lat=47.6553&lng=-122.3035`, `GET /api/weather?date=friday`.

**Reset the demo** (fresh closet, clears chat and purchases):

```bash
npm run seed
```

⚠️ The team shares **one** Supabase database and one demo user ("Alex"). Running `seed`
wipes everyone's chat history, so give the team a heads-up first.

## 3. Tests

| Command | What it checks | Needs keys? |
|---|---|---|
| `npm test` | Buy-check verdicts for the demo, payment-approval rules (31 cases), opening hours | No |
| `npm run typecheck` / `npm run lint` | Types and lint | No |
| `BASE_URL=http://localhost:3000 npm run test:contract` | Every endpoint returns the documented shape (run with `npm run dev` up) | No |
| `npm run smoke:gemini` | Live Gemini: JSON output, tool calling, vision | Gemini |
| `npm run smoke:stripe` | Live Stripe test charge ($1.00, test mode only) | Stripe |
| `npm run test:integrations` | Weather, Geoapify, Gmail (read + receipt send), store links, iMessage link rendering and the image-download guard, with HTTP mocked | No |
| `npm run test:integrations -- --live` | The same against the real services (read-only; skips any without keys) | The ones you have |

## 4. iMessage (only one person runs this)

Dripy's iMessage bridge is a separate process that holds the Photon connection:

```bash
npm run dev      # terminal 1: backend
npm run worker   # terminal 2: iMessage bridge → should print "event":"connected"
```

- **Only one worker may run at a time** for the whole team. Two workers would both reply to
  every text. The built-in lock only checks port 8787 on the same machine, so a second worker
  on another laptop will NOT be stopped: check with the team before starting one.
- **Only registered numbers can text it** (Photon Free plan). To be added, send Narayana your
  iPhone number in `+1XXXXXXXXXX` format. Photon assigns each user a number to text, so check
  with him which one is yours.
- Your iPhone must have iMessage on; Google Voice / virtual numbers don't work.
- iMessage delivers a photo and its caption as **two separate messages**. In the demo, send
  the photo first (or together), otherwise Dripy answers the text alone ("send me a photo").
- iMessage only: WhatsApp Business isn't enabled on the Photon project (Photon returns 403).
  Enabling it later also needs the worker renamed to `.mts`, because the WhatsApp provider
  package is ESM-only and fails to load from the CommonJS worker.

## 5. Project map

```
src/app/api/          REST endpoints (chat, wardrobe, reels/analyze, buy-check, purchase-intents, donations, receipts, webhooks)
src/lib/agent/        Gemini agent loop, tools, system prompt, iMessage text renderer
src/lib/payments/     Purchase state machine + YES/NO approval router (the "can't spend without you" logic)
src/lib/pipelines/    Buy-check scoring, image analysis, receipts, donations
src/lib/integrations/ Stripe, Visa, SerpAPI, Gmail, Open-Meteo weather, payment-rail switch
worker/               Photon iMessage bridge
supabase/             SQL migrations, seed data, sample receipt emails
mocks/                Example response for every endpoint
scripts/              Seed, tests, smoke tests
```

Frontend work goes in `src/app/` (pages/components). Please don't edit `src/lib` or
`src/app/api` without pinging Narayana; the API contract is shared.

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Every response has `"mode":"simulated"` and `fallbacks: ["mock", "db_unconfigured"]` | `.env.local` is missing or not in the project root. Restart `npm run dev` after adding it. |
| `Could not find the table … in the schema cache` | Database not set up. In Supabase → SQL Editor run `supabase/migrations/0001_init.sql`, then `0002_stripe.sql`, then `npm run seed`. |
| `Port 3000 is in use` / `Another Dripy worker is already running` | An old copy is still running. Ctrl+C it, or `kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)` (8787 for the worker). |
| iMessage replies "Ugh, something broke on my end" | The backend caught an error; read the `npm run dev` terminal. On 2026-10-17 it was always Gemini **429 quota**: a free-tier key allows 20 requests/day per model, about one demo run. Use a key whose Google Cloud project has billing on. |
| Photo replies take ~30 s | Live product search: SerpAPI Google Lens hit its 15 s timeout on every photo tested, then fell back to Shopping search. The demo photos (black bomber, camel blazer) skip that and answer in ~10 s. Fix pending, see `docs/whats_left.txt`. |
| Gemini `503 UNAVAILABLE` ("high demand") | Google-side overload, worst on free-tier keys. Retry, or temporarily set `GEMINI_MODEL=gemini-3.5-flash`. |
| Gmail sign-in: "Access blocked … access_denied" | Add your Google account as a **test user** on the OAuth consent screen (Google Auth Platform → Audience). |
| Purchase works but no receipt email arrives (`fallbacks` has `gmail_send`) | The Gmail token is read-only. Stop `npm run dev`, run `npm run gmail:auth`, approve both permissions, and replace `GMAIL_REFRESH_TOKEN`. The item is still added to the wardrobe. |
| `npm install -g` fails with `reading 'edgesOut'` | npm bug; add `--legacy-peer-deps`. |
| Worker: `PHOTON_PROJECT_ID must be the project's UUID` | You have a Photon **beta** (`pho_prj_…`) id. Use the stable project from app.photon.codes. |

**Never commit `.env.local` or paste keys into chat/issues.** It's gitignored; keep it that way.
