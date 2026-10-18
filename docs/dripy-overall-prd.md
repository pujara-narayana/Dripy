# Dripy: Overall PRD

**DubHacks 2026 - Visa track**

Dripy is a personal agent with a real phone number that knows your wardrobe, shops with you, and pays when you say yes. This is the master document: hand it to Claude Code together with the Backend PRD.

## The pitch

Dripy is Instinct, but for fashion: an agent in your iMessage that knows your closet, finds what you saw on a reel, tells you whether to buy it, finds where to donate what you don't wear, and pays when you approve.

- **Event:** DubHacks 2026, Visa track
- **Build window:** 21 hours, from Sat ~1 PM PT
- **Devpost draft:** Sat 10:30 PM PT
- **Core loop:** Text agent, forward reel, get verdict, approve to pay

Reference products: Zamana (personal shopping assistant on iMessage with shared carts), Phia (AI shopping and best-price comparison, founded by Phoebe Gates and Sophia Kianni), and Instinct (an autonomous personal agent that manages tasks for you).

## Judging rubric

1. **Functionality (30%)** - The end-to-end loop works live on a phone, not on slides.
2. **Track applicability (30%)** - Visa agentic payments are the spine of the demo, not a bolt-on.
3. **Design (20%)** - Wardrobe grid, chat, and verdict cards feel like a real product: Zamana/Phia polish.
4. **Creativity (20%)** - An agent with its own phone number that manages your closet and your clothing lifecycle, including donating what you don't wear.

## Must-have features

1. **iMessage agent on a real phone number via Photon:** the agent lives in your messages, on iMessage with SMS/RCS fallback and WhatsApp from the same number.
2. **Gmail receipt parsing into a wardrobe:** read order-confirmation emails (Zara, H&M, ASOS style), extract items, prices, brands, sizes, and auto-tag each one.
3. **Forward a reel or TikTok link:** pull frames from the video, identify clothing items with a vision model, return similar items with prices and links.
4. **Wardrobe-aware "should I buy this" check:** the agent looks at what you already own before recommending anything, flagging dupes and gaps.
5. **Nearby thrift stores and donation places:** "where can I donate these?" returns nearby thrift stores, consignment shops, and donation drop-offs with distance and hours, so old clothes get a second life.
6. **Approve-to-pay checkout:** the agent prepares a purchase, you say yes in chat, and payment runs through Visa agentic payments in the sandbox.

## Stretch tier (approved)

Approved additions, built after the core loop is stable, ahead of the parked nice-to-haves. Rubric mapping: price-drop watch and cleanout deepen functionality (30%), the Style DNA card is design candy (20%), and weather-aware picks show the agent reasoning over real context, which feeds creativity (20%).

1. **Price-drop watch on wishlist items:** the agent tracks prices on wishlisted pieces and pings you when one drops. Phia made this their signature move; it deepens the wishlist that already exists.
2. **Closet cleanout mode:** flags items you never wear and dupes, then bundles a donation run through the thrift finder, so cleanout to drop-off is one flow.
3. **Style DNA card:** a shareable card of your brands, colors, and occasions derived from your real wardrobe. Strong Devpost screenshot.
4. **Weather-aware outfit picks:** outfit answers factor in the local forecast (Open-Meteo, free, no API key), so "what do I wear Saturday" accounts for rain.

## Supporting features

The agent is not a chatbot bolted onto a store. It autonomously manages fashion tasks, which is what makes it an agent product and not a search bar.

- **Digital wardrobe planning:** "what do I wear to the finals" answered from what you own, with occasion tags.
- **Shopping:** find, compare, and queue items for your approval instead of browsing tabs.
- **Subscription cancellations and scheduling:** spot retail subscriptions, manage them, and put fashion errands on your calendar.
- **Auto-categorization:** every item lands under occasions, daily wear, brands, and wishlist buckets without manual filing.

**Nice-to-have, parked:** build these only if the core loop and the stretch tier are done and stable. They are demo candy, not the spine.

- **Tinder-style swipe deck:** bored users swipe like/dislike on clothing items, training the style profile for better recommendations.
- **2D/3D avatar dressing:** dress an avatar so the user sees how items look on them. For a demo wow shot, use flat-lay outfit boards or a simple spinning closet render instead of real try-on.
- **Group-chat agent:** add the agent to a friend group chat for a group gift, trip, or "help me pick an outfit for Saturday's party." It collects everyone's input, proposes a shared cart or outfit picks, then lets each person approve and pay their own share with per-person Visa purchase intents.

## Scope constraints

Agreed for a 21-hour build. These keep the demo honest and shippable.

- No real Zara/H&M account connections (no public APIs): wardrobe ingestion comes from order-confirmation email parsing plus photo upload with auto-tagging.
- No real Instagram/TikTok API (locked down): a paste-a-link flow with a mocked "connected" state demos the same idea honestly.
- No real 3D try-on: flat-lay outfits on a simple avatar, or a three.js spinning closet for the wow shot.
- Fallback channels: the built-in web chat if Photon approval stalls; WhatsApp via Twilio sandbox only if it is faster than Photon.

## Team split

- **Narayana:** backend and agentic layer - agent loop, ingestion pipelines, integrations, Visa payments. Build brief: Backend PRD.
- **Frontend teammate:** web app - chat UI, wardrobe grid, verdict and approval cards, donation finder. Build brief: Frontend PRD.
- **Shared contract:** the REST API surface in the Backend PRD. The frontend builds against checked-in mock responses until each endpoint is live.

## High-level architecture

- Next.js (App Router) on Vercel: frontend, API routes, and webhook endpoints in one repo.
- Supabase Postgres: wardrobe, receipts, wishlist, style profile, purchase intents, chat log, groups.
- Claude API as the agent brain: tool use for wardrobe search, product search, donations, and purchase intents; vision for reel frames and receipt auto-tagging.
- Photon for messaging: webhook into /api/messages/inbound, replies back out over iMessage/SMS/WhatsApp.
- Gmail API (read-only) for order confirmations, or a seeded sample inbox if OAuth review eats time.
- yt-dlp + ffmpeg to pull frames from a pasted reel/TikTok link.
- SerpAPI (Google Lens / Google Shopping) for similar-item matches.
- Google Places API for thrift/donation places; no-key fallback: OpenStreetMap Overpass or a seeded Seattle list.
- Open-Meteo for weather-aware outfit picks: free forecast API, no key (stretch tier).
- Visa Intelligent Commerce sandbox for purchase intents and tokenized payment, with the Visa Developer MCP server plugged into Claude Code for API discovery.

## Integrations: verified and unverified

Checked October 17, 2026. Build against the fallbacks first, then upgrade to the real service when access lands.

**Photon: verified.** photon.codes gives agents a real phone number with native iMessage (blue bubble), automatic SMS/RCS fallback, and WhatsApp on the same number through Meta's official Cloud API. It integrates through a cloud project ID and secret, with a TypeScript Chat SDK adapter. Unverified: account signup and approval terms, so request access at hour zero and keep the web chat as the demo-safe channel.

**Visa Developer MCP: verified.** Visa runs an official MCP server at developer.visa.com/mcp. It is a read-only interface to Visa API docs, schemas, and code generation, with OAuth, and it works inside Claude Code. Plug it in so Claude Code discovers the real Visa API shapes while building.

**Visa Intelligent Commerce: verified, sandbox gated.** Visa's agentic payments API on the Visa Acceptance Platform covers the exact approve-to-pay flow: enroll a card, authenticate with a passkey, create tokenized credentials, then initiate, update, or cancel a purchase intent and retrieve payment credentials. Sandbox use is free but requires evaluation registration at developer.visaacceptance.com, so sign up at hour zero. If approval lags, ship the mock purchase-intent endpoint shaped like this API and say so in the demo.

## Data model overview

- Core: users, wardrobe_items, receipts, wishlist_items, purchase_intents, chat_messages, style_profile, donation_saved_places.
- Stretch tier: price_watches (wishlist item, target price, last price, status). Style DNA derives from style_profile plus wardrobe_items; cleanout reads wardrobe_items.times_worn and last_worn_at.
- Parked for nice-to-haves: group_chats, group_members, shared_carts (group agent), swipe_events (swipe deck).
- Full schema with columns lives in the Backend PRD, section 3.

## Build milestones

Times in Pacific, from about 1 PM Saturday against the 10:30 PM Devpost draft deadline.

1. **Sat 1:00-3:00 PM** - Repo scaffold, DB schema, web chat UI, Claude agent loop with tool use on dummy data. Hour-zero external signups: Photon access, Visa sandbox, optional Google Places key.
2. **Sat 3:00-5:30 PM** - Wardrobe ingestion (receipt parser or seeded inbox; photo upload auto-tag). Wardrobe grid page with occasion, brand, category, wishlist filters.
3. **Sat 5:30-7:30 PM** - Reel pipeline (link, frames, vision, similar matches). Buy-check verdict flow. Donation-place finder endpoint and UI.
4. **Sat 7:30-9:30 PM** - Photon number live and inbound webhook connected (fallback: web chat). Visa purchase-intent sandbox flow (or shaped mock).
5. **Sat 9:30-10:15 PM** - Seed demo data, rehearse twice, record a backup video of the full loop.
6. **Sat 10:30 PM** - Devpost draft submitted. Overnight: design polish, subscription and scheduling talking points, final write-up. Stretch tier first (price-drop watch, cleanout, Style DNA card, weather-aware picks), then parked nice-to-haves.

## Mock vs real

- **REAL:** chat agent loop, wardrobe database, receipt parsing, vision tagging, reel frame extraction, buy-check verdicts, donation lookup, chat approvals.
- **REAL IF ACCESS LANDS:** Photon phone number, Visa Intelligent Commerce sandbox, Gmail OAuth inbox, Google Places key.
- **MOCKED (honestly labeled in the UI):** Instagram/TikTok "connected" state behind the paste-a-link flow, retailer account connections (no public Zara/H&M APIs), subscription list for the cancellation story.
- **FALLBACKS:** seeded inbox of 5 receipts; the built-in web chat if Photon stalls; a mock purchase-intent endpoint shaped like the Visa API; Overpass/OSM or a seeded Seattle list if the Places key is missing.

## Demo script (3 minutes)

1. Open iMessage live on screen. Text the agent: "going to a rooftop dinner Friday, what should I wear?" It answers with an outfit built from your real parsed wardrobe.
2. Forward a TikTok fashion reel into the thread. The agent replies with the items it spotted and similar pieces with prices and links.
3. Tap one: "should I buy this jacket?" The agent checks your wardrobe, calls out that you own two similar jackets, and gives a verdict with reasoning.
4. Say "ok, buy it." The agent prepares the Visa purchase intent, you approve in chat, and the confirmation lands with order details.
5. Then: "I never wear half of this. Where can I donate?" The agent lists nearby thrift stores and donation drop-offs with distance and hours.
6. Switch to the web app: wardrobe grid auto-sorted by occasion, brand, daily wear, and wishlist. Close on: "Dripy - Instinct, but for fashion."
7. Optional stretch beats if built: pull up the Style DNA card for a screenshot, then ask "what do I wear tomorrow?" with rain in the forecast to show weather-aware picks.

---

Integration facts verified October 17, 2026 against photon.codes and developer.visa.com. Photon signup terms and Visa sandbox approval timing are unverified; the fallbacks above cover both.
