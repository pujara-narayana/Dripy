# Dripy

**The AI stylist in your iMessages that talks you out of buying, and pays when you say yes.**
DubHacks 2026 · Visa track

Dripy knows your closet. Send it a screenshot of something you saw on TikTok, or just describe
it ("a white trench coat for men under $300"), and it finds where to buy it (real product links,
any store). Ask "should I buy this?" and it tells you whether you actually need it (citing what
you already own). It checks out with a Visa test card only after you reply YES, emails you the
order receipt and adds the item to your closet, saves clothes you already own from a photo
("I have this, add it"), and finds places to donate what you don't wear.

- **Backend:** Next.js 16 API routes · Supabase (Postgres + Storage) · Google Gemini · Channel3 (product search) · SerpAPI (fallback) · Stripe (test mode) · Photon (iMessage) · Open-Meteo (weather) · Geoapify (donation places) · Gmail (receipts in and out)
- **Deployment:** only the website goes to Vercel; the iMessage worker runs on a laptop for demos.
- **API reference and architecture:** [`BACKEND.md`](BACKEND.md)
- **Response examples for every endpoint:** [`mocks/`](mocks) · TypeScript types: [`src/lib/types.ts`](src/lib/types.ts)

---

## 1. Get it running (5 minutes)

**You need:** Node.js 22+ (`node -v`) and git. On a Mac without Node: `brew install node`.

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
{ "model": "gemini-3.8-flash", "llm": "live (gemini)", "database": "live", "product_search": "channel3", "serpapi": "live", "geoapify": "live", "payments": "stripe_test", "photon_worker": "down" }
```

`photon_worker: "down"` is normal unless the iMessage worker is running (see section 4).

### The web app

The UI is served by the same Next.js app: with `npm run dev` running, open
**http://localhost:3000**. Signed-out visitors land on `/welcome` (sign up / log in); the app
pages (`/`, `/recommended`, `/donate`, `/dashboard`, `/settings`) need a session (`src/proxy.ts`).

Demo flow: sign up with name, Gmail, phone and **Girl / Boy** → set the fairy's budget (the
most it may spend on one purchase: $50 / $100 / $150 / $300 or a custom amount; Skip keeps the
$300 cap) → the page opens iMessage with the start code
(the "Open iMessage" button stays as a fallback) → Dripy greets you with a wardrobe link → buy
something (iMessage or the Recommended page): the first time you enter a Visa test card on
`/checkout/:id`, after that it's one tap → the store's order receipt is emailed to the Gmail you
signed up with and the item lands in your closet with its photo → donate pieces on `/donate`
and get the nearest drop-off in chat. iMessage and the web chat are one conversation, so the
web agent knows what you sent on iMessage ("buy the other one from the photo I texted you").

**Girl / Boy and the spending limit.** The sign-up choice picks the starter closet, the
Recommended shop and the Dashboard's sample stats: girl gets the women's Uniqlo pieces, boy
gets men's (no dresses, skirts or flats); a few unisex pieces (scarves, beanies, bags, canvas
sneakers) show up for both. All of it lives in `src/data/catalog.ts`. The spending limit applies
to every purchase (iMessage, web chat, Recommended): anything over it is refused before a
checkout is created, with "You can change that limit in Settings". `/settings` (in the header)
changes the limit and Girl / Boy; switching changes the shop and dashboard, not the closet.
`PURCHASE_CAP_CENTS` (default $300) stays the upper bound.

Extra setup for this: run `supabase/migrations/0003_demo_card.sql` and `0004_profile.sql`
(only needed on a database that doesn't have them yet; see section 1b; the team's shared
database has `0003` but **not `0004`** yet), and set
`DRIPY_IMESSAGE_HANDLE` (the Dripy line), `APP_URL` and `SESSION_SECRET` in `.env.local` (see
`.env.example`; keep the template itself blank).
The web chat takes photos too: the ＋ button, paste (⌘V a screenshot) or drag and drop, up to 3
per message (resized in the browser before upload). Links in replies are clickable.
If the chat API fails (no LLM key, Gemini quota used up) the web chat falls back to canned
replies labelled "offline". The dashboard still shows sample stats.

### Testing on your phone (iMessage + website)

The links Dripy texts (wardrobe login, Visa checkout) and shop photos use `APP_URL`, so your
phone has to reach the laptop. A Cloudflare quick tunnel is the simplest way:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000   # prints https://<random>.trycloudflare.com
```

Set `APP_URL` to that URL in `.env.local`, restart `npm run dev`, and start the worker
(section 4). Keep `DRIPY_BACKEND_URL` and `PHOTON_WORKER_URL` on localhost. The quick-tunnel URL
changes every time cloudflared restarts. `next.config.ts` allows `*.trycloudflare.com` as a dev
origin; without that, pages opened through the tunnel load but their scripts are blocked (the
checkout form does nothing).

End-to-end test, in demo order (`DEMO_CATALOG=true` for the curated bomber/blazer; `false`
for live products):

1. On the iPhone, open `APP_URL/signup` and enter name, Gmail, phone and Girl / Boy, then pick
   a budget. Messages opens with "Hi Dripy! My code is XXXXXX"; send it from your **phone
   number** (see section 4).
2. Dripy replies with the greeting and a wardrobe link; the link signs you in to your closet.
3. The Recommended page shows shop pieces you don't own, for the gender you picked. With a $100
   limit, the $149.90 Balmacaan coat (boy) is refused and points you to Settings.
4. Text a photo: 3 matches with links (15–30 s), no verdict. Then "should I buy this?": the verdict.
   Or text "find me a white trench coat for men under $300" (no photo needed).
5. "buy the first one" → "add your Visa card here: <link>" → enter `4242 4242 4242 4242`, any
   future MM/YY, any CVC and a name → pay. iMessage gets "Done ✅ Paid".
6. Another photo → "buy it" → "Reply YES to pay … with VISA •••• 4242" → "yes" → paid.
7. After each purchase: a "Your <Store> order DRP-… is confirmed" email, and the item in the closet.
8. Text a photo of something you own + "I already have this, add it to my wardrobe" → it's in
   the closet with your photo (no product search, no verdict).
9. `/donate`: pick pieces → the nearest drop-off appears in the web chat and in iMessage.
10. Buy on Recommended (one tap with the saved card), then in the web chat: "buy the other one
   from the photo I texted you" → Approve & pay.

Sign up with a number that isn't in the database yet: an existing number signs you in to that
account and skips the new closet. Start over with `delete from users where phone = '+1XXXXXXXXXX';` in the Supabase SQL Editor.
It removes that account's closet, chat, purchases and saved card (cascade). Never run it for
the demo user.

### 1b. Your own Supabase project (instead of the team's)

1. In the new project: **Project Settings → Data API** for the Project URL (`SUPABASE_URL`),
   **Project Settings → API Keys** for the `sb_secret_…` secret key (`SUPABASE_SERVICE_ROLE_KEY`).
2. Create the tables: **SQL Editor → New query**, paste and run each file in
   `supabase/migrations/` in order (`0001` → `0004`). Or put the database connection string in
   `.env.local` as `DATABASE_URL` and run them with any Postgres client.
   Use the **Session pooler** string (**Connect** → Connection String → URI →
   `postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432`): the "Direct connection"
   (`db.<ref>.supabase.co`) is IPv6-only and fails on most home networks with
   `getaddrinfo ENOENT`. The app itself never uses `DATABASE_URL`.
3. `npm run seed`, then restart `npm run dev`.

Switching projects signs everyone out of the website (the session cookie is signed with
`SESSION_SECRET`, or the Supabase key when that's empty): just sign up again.

## 2. Try the agent from the terminal

The web chat endpoint is the same brain as iMessage. With `npm run dev` running:

```bash
# Outfit from your closet
curl -s localhost:3000/api/chat -H 'content-type: application/json' \
  -d '{"message":"going to a rooftop dinner friday, what should I wear?"}'

# Search by description, no photo: real listings under the budget, with store links.
curl -s localhost:3000/api/chat -H 'content-type: application/json' \
  -d '{"message":"can you find a white trench coat for men under $300?"}'

# Send a screenshot. Live search (Channel3) returns 3 real products with store links. Verdicts
# only come when asked ("should I buy this?"): SKIP only if you own a near-duplicate of the same
# cut (black bomber → SKIP), BUY if it fills a gap (camel blazer → BUY), otherwise CONSIDER. ~15–30 s.
curl -s localhost:3000/api/chat -F "message=should I buy this?" -F "image=@bomber.png"   # → SKIP
curl -s localhost:3000/api/chat -F "message=what about this one?" -F "image=@blazer.png" # → BUY

# Checkout at any store: proposes a purchase ("Reply YES to pay…"), then a real Stripe
# test-mode charge on the Visa test card. If several products were discussed, Dripy asks which.
curl -s localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"ok buy the first one"}'
curl -s localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"yes"}'
# After YES: an order confirmation from that store lands in the connected Gmail, is parsed
# by the receipt parser, and the item shows up in GET /api/wardrobe with source "purchase".

# Donation spots near UW
curl -s localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"where can I donate?"}'
```

Each response is `{ reply, cards[], meta }`. `cards` drive the UI (`reel_matches`, `verdict`,
`purchase_intent`, `payment_confirmation`, `places`, `outfit`, `weather`); see `BACKEND.md`.
For the website: every product in `reel_matches.matches[]` has a `url` to show as a **Buy**
link, and on the paying turn `payment_confirmation.receipt` is
`{retailer, emailed, wardrobe_item_ids}` ("receipt emailed to your inbox").

**Demo catalog switch:** `DEMO_CATALOG=true` pins the black bomber and camel blazer to curated
matches (same products and verdict every run, but their links are store *search* pages);
`false` (the team default now) uses live Channel3 results for every photo.

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
| `npm run typecheck` / `npm run lint` | Types and lint. On a fresh clone run `npx next typegen` (or start `npm run dev`) once first: it generates the `LayoutProps` / `RouteContext` types | No |
| `BASE_URL=http://localhost:3000 npm run test:contract` | Every endpoint returns the documented shape. Start the server with `FORCE_FALLBACK=all npm run dev` to check the mocks without side effects; against live keys it writes to the shared demo user, runs a real Gmail receipt sync and uses ~12 Gemini requests | No |
| `npm run smoke:gemini` | Live Gemini: JSON output, tool calling, vision | Gemini |
| `npm run smoke:stripe` | Live Stripe test charge ($1.00, test mode only) | Stripe |
| `npm run test:integrations` | Weather, Geoapify, Gmail (read + receipt send), Channel3, SerpAPI store links, iMessage link rendering and the image-download guard, with HTTP mocked | No |
| `npm run test:integrations -- --live` | The same against the real services (read-only; skips any without keys) | The ones you have |

Last run 2026-10-18 on the `frontend` branch: everything above passed (contract test in mock
mode; lint has only `<img>` warnings).

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
- **Text from your phone number, not your Apple ID email.** The shared Photon number rejects
  email senders with an automatic "we can't route it to the right agent" reply, and the
  backend never sees the message. On the iPhone: Settings → Apps → Messages → Send & Receive →
  "Start New Conversations From" → your number, then start a *new* conversation. A Mac only
  works if your number shows up under Messages → Settings → iMessage ("You can be reached
  at"); if it doesn't, use the iPhone.
- iMessage delivers a photo and its caption as **two separate messages**. In the demo, send
  the photo first (or together), otherwise Dripy answers the text alone ("send me a photo").
- What a photo reply looks like: Dripy's take, then the 3 products with price, store and link,
  the verdict (naming the product it judged), and the product photo. After "buy it" you get
  "Reply YES to pay…" plus the store link if you'd rather buy it yourself; after YES, only the
  "Done ✅ Paid …" reply (the receipt goes to Gmail, not to iMessage).
- iMessage only: WhatsApp Business isn't enabled on the Photon project (Photon returns 403).
  Enabling it later also needs the worker renamed to `.mts`, because the WhatsApp provider
  package is ESM-only and fails to load from the CommonJS worker.

## 5. Gmail (receipts in and out, one-time setup)

Dripy uses one connected Gmail account (in the team `.env.local` it's Narayana's): it reads
order emails into the wardrobe (`POST /api/receipts/sync`) and, after each purchase, sends the
store's order receipt from that account to the buyer's sign-up address (to itself for the demo
user Alex). For the demo, sign up with the connected address to show the receipt in that
inbox, or with your own Gmail to get it there.

1. In `.env.local`: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (ask Narayana).
2. Stop `npm run dev` (the sign-in borrows port 3000), run `npm run gmail:auth`, open the link,
   sign in with a Google account that's a **test user** on the OAuth consent screen, and
   approve **both** permissions (read and send).
3. Paste the printed `GMAIL_REFRESH_TOKEN=…` into `.env.local` and restart `npm run dev`.

Without Gmail, receipts come from 5 sample emails in `supabase/seeds/receipts/` and the
purchase receipt stays in the app (it's still parsed into the wardrobe).

## 6. Project map

```
src/app/(app)/        Signed-in pages; src/app/(public)/ welcome, sign-up, log-in, checkout, about
src/data/catalog.ts   Clothing catalog: women's / men's / unisex starter closets + shops (shared by pages and backend)
src/components/       UI: proto/ (Dripy screens and pieces), ui/ (shadcn primitives)
src/client/           Browser-side helpers: API client (dripy-api.ts), cn()
public/images/        Garment photos and fairy mascots
src/app/api/          REST endpoints (chat, wardrobe, reels/analyze, buy-check, purchase-intents, donations, receipts, webhooks)
src/lib/agent/        Gemini agent loop, tools, system prompt, iMessage text renderer
src/lib/payments/     Purchase state machine + YES/NO approval router (the "can't spend without you" logic)
src/lib/pipelines/    Buy-check scoring, image analysis, receipts (in + demo purchase receipts), donations
src/lib/integrations/ Stripe, Visa, Channel3, SerpAPI, Gmail, Open-Meteo weather, payment-rail switch
worker/               Photon iMessage bridge
supabase/             SQL migrations, seed data, sample receipt emails
mocks/                Example response for every endpoint (keep it at the root: the mock fallback imports it)
scripts/              Seed, tests, smoke tests
```

Frontend work goes in `src/app/` (pages), `src/components/` and `src/client/`. Add shadcn
components with `npx shadcn add <name>`. Please don't edit `src/lib` or
`src/app/api` without pinging Narayana; the API contract is shared.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| Every response has `"mode":"simulated"` and `fallbacks: ["mock", "db_unconfigured"]` | `.env.local` is missing or not in the project root. Restart `npm run dev` after adding it. |
| `Could not find the table … in the schema cache` | Database not set up. In Supabase → SQL Editor run `supabase/migrations/0001_init.sql` through `0004_profile.sql` in order, then `npm run seed` (section 1b). |
| Everyone gets the girl's closet; saving Settings fails with "update profile (run supabase/migrations/0004_profile.sql …)" | Run `0004_profile.sql`. Until then sign-up still works (without gender) and the limit is the $300 cap. |
| "over the $X I'm allowed to spend for you per purchase" | The user's spending limit. Raise it in `/settings` (max `PURCHASE_CAP_CENTS`, default $300). |
| A dev-server page keeps reloading while a test browser (Playwright MCP) is open | The tool writes its console log into `.playwright-mcp/` in the project, which `next dev` watches, so every reload logs, which triggers another rebuild. Close the test browser; normal browsers aren't affected. `.playwright-mcp/` is safe to delete. |
| `Port 3000 is in use` / `Another Dripy worker is already running` | An old copy is still running. Ctrl+C it, or `kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)` (8787 for the worker). |
| iMessage replies "Ugh, something broke on my end" | The backend caught an error; read the `npm run dev` terminal. On 2026-10-17 it was always Gemini **429 quota**: a free-tier key allows 20 requests/day per model, about one demo run. Use a key whose Google Cloud project has billing on. |
| Photo replies take 15–30 s | Expected for now (several Gemini calls plus product search); speed isn't a priority. Slowest when Channel3 is missing or failing and it falls back to SerpAPI (Lens often times out at 15 s). |
| `fallbacks` contains `channel3` | `CHANNEL3_API_KEY` is missing or wrong, or the free 1,000 calls/month ran out; SerpAPI is used instead. |
| Product links go to a store **search** page | `DEMO_CATALOG=true` and you sent the black bomber or camel blazer. Set it to `false` for real product pages. |
| "I couldn't tell which store sells that one" | The match has no known store (only on the SerpAPI fallback path). Pick another match, or use its link to buy it yourself. |
| Dripy bought a different item than you meant | Say which one ("buy the Zara one"). If more than one product was just mentioned, Dripy should ask; tell Narayana if it didn't. |
| Gemini `503 UNAVAILABLE` ("high demand") | Google-side overload, worst on free-tier keys. Retry, or temporarily set `GEMINI_MODEL=gemini-3.5-flash`. |
| Gmail sign-in: "Access blocked … access_denied" | Add your Google account as a **test user** on the OAuth consent screen (Google Auth Platform → Audience). |
| Purchase works but no receipt email arrives (`fallbacks` has `gmail_send`) | The Gmail token is read-only. Stop `npm run dev`, run `npm run gmail:auth`, approve both permissions, and replace `GMAIL_REFRESH_TOKEN`. The item is still added to the wardrobe. |
| `npm install -g` fails with `reading 'edgesOut'` | npm bug; add `--legacy-peer-deps`. |
| Worker: `PHOTON_PROJECT_ID must be the project's UUID` | You have a Photon **beta** (`pho_prj_…`) id. Use the stable project from app.photon.codes. |
| iMessage auto-reply: "we can't route it to the right agent … email-based iMessage handle" | You texted from your Apple ID email. Send from your phone number in a new conversation (section 4). |
| Sign-up says Dripy's iMessage number isn't configured | Set `DRIPY_IMESSAGE_HANDLE` in `.env.local` (not `.env.example`) and restart `npm run dev`. |
| Card page fails with "save card (run supabase/migrations/0003_demo_card.sql …)" | Run that migration in the Supabase SQL Editor. |
| Links Dripy texts don't open on the phone, or the checkout page loads but the form does nothing | `APP_URL` is `localhost` or an old tunnel URL. Set it to the current tunnel URL and restart `npm run dev` (see "Testing on your phone"). |
| Every API route returns an HTML error page; the log says `Can't resolve '../../mocks/'` | The `mocks/` folder was moved or deleted. Restore it at the repo root: `git checkout -- mocks`. |
| `tsc`: `Cannot find name 'LayoutProps'` / `'RouteContext'` | Generated types are missing on a fresh clone: `npx next typegen` (or start `npm run dev` once). |
| `npm ci` warns `install scripts … not yet covered by allowScripts` | npm 11 skips dependency install scripts by default; the app and all tests work without them. |
| `npm: command not found` after `brew install node` | Run `eval "$(/opt/homebrew/bin/brew shellenv)"`, or add that line to `~/.zprofile`. |

**Never commit `.env.local` or paste keys into chat/issues.** It's gitignored; keep it that way.
