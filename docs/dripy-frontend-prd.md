# Dripy: Frontend PRD

**DubHacks 2026 - Visa track**

The frontend brief for Dripy. The backend workstream exposes the REST API contract below; build against the checked-in mock responses until each endpoint is live. The Overall PRD has the product story and rubric.

## 1. What the frontend owns

A fashion-forward web app (Next.js App Router, same repo as the backend) that demos like a real product: think Zamana and Phia polish, mobile-first. The chat channel is the hero of the demo, so chat UI quality matters most after the wardrobe grid.

## 2. Screens, in priority order

1. **Chat (hero):** clean iMessage-style thread with the agent. Renders text plus rich cards from the API cards[] payload: product match cards, verdict cards, donation place cards, purchase approval cards. This is the demo-safe channel if the real phone number stalls, so it must feel great.
2. **Wardrobe grid:** auto-tagged clothing grid with filters for occasion, daily wear, brand, category, and wishlist. Item tile: image, name, brand, tags. Empty state: "text your receipts or upload a photo."
3. **Item detail:** photo, tags, source (receipt, upload, or reel), price, and a "find a home for this" donation shortcut.
4. **Reel results:** identified items from a forwarded reel with similar matches (image, name, price, merchant link) and a per-item "should I buy this?" button.
5. **Verdict card:** the buy-check answer - verdict, reasons, dupes you already own - styled like a confident friend, not a spreadsheet.
6. **Purchase approval card:** item, merchant, amount, approve and decline. Approve posts to the backend; show confirmation with order details.
7. **Donation finder:** list plus simple map (or list-only with distance and hours) of nearby thrift stores, consignment, and donation drop-offs. "Get directions" opens Google Maps.
8. **Wishlist:** saved items from chat, reels, and swipes with price and merchant link.

**Approved stretch tier** - overnight, after the core loop is stable and before the parked items:

- Wishlist price-drop badges and a drops view: "down from $89 to $64" with the merchant link.
- Cleanout view: unworn and dupe items in a grid with a one-tap "plan my donation run" that opens the donation finder preloaded with the nearest places.
- Style DNA card: brands, colors, and occasions rendered as a shareable card. The Devpost screenshot.
- Weather strip on outfit answers: a small forecast line ("Sat: rain, 54F") above the picks.

**Parked nice-to-haves** - overnight only, after the stretch tier: swipe deck (Tinder-style like/dislike), avatar and outfit board view, group shared-cart view.

## 3. Design direction

- Mobile-first; most demoing happens on a phone. Card-based, generous spacing, big type for verdicts.
- Palette: warm neutrals (sand, ecru) with one confident accent. Avoid the generic purple-gradient AI look.
- Typography: a display serif for headlines and a clean sans for body; system fonts are fine under time pressure.
- Every mocked integration gets a small honest label, like "Instagram connection simulated."
- Loading states matter: reel analysis and buy-check take seconds. Use skeleton cards with personality ("checking your closet...").

## 4. API contract

The backend serves these; mocks are checked in until each is live.

- POST /api/chat {user_id, message, attachments[]} -> {reply, cards[]}
- GET /api/chat/history?user_id=
- GET /api/wardrobe?user_id=&occasion=&brand=&category=&wishlist= -> items[]
- POST /api/wardrobe/upload (multipart) -> item with auto-tags
- POST /api/reels/analyze {user_id, url} -> {identified[], matches[]}
- POST /api/buy-check {user_id, item_url | item_desc} -> {verdict, reasons[], dupes[]}
- GET /api/donations/nearby?lat=&lng=&kind= -> places[] {name, address, distance, hours, maps_url}
- POST /api/purchase-intents {user_id, item, amount, merchant_url} -> intent
- POST /api/purchase-intents/:id/approve -> {status, confirmation}
- GET /api/style-profile?user_id= (nice-to-have)
- POST /api/price-watches {user_id, wishlist_item_id, target_price?} -> watch; GET /api/price-watches?user_id= (stretch)
- POST /api/cleanout {user_id} -> {unworn[], dupes[], donation_places[]} (stretch)
- GET /api/style-dna?user_id= -> {brands[], colors[], occasions[], summary} (stretch)
- GET /api/weather?lat=&lng=&date= -> forecast (stretch)

**Card types to render from cards[]:**

- product_match: {name, price, merchant, url, image}
- verdict: {verdict, reasons[], dupes[]}
- donation_place: {name, address, distance, hours, maps_url}
- purchase_approval: {intent_id, item, amount, merchant}
- price_drop: {item, old_price, new_price, merchant, url} (stretch)
- cleanout_summary: {unworn_count, dupes[], donation_places[]} (stretch)
- style_dna: {brands[], colors[], occasions[], summary} (stretch)
- weather: {date, summary, temp, precip} (stretch)

## 5. Frontend milestones

1. **Sat 1:00-3:00 PM** - App shell, chat UI against mock /api/chat, wardrobe grid against mock data.
2. **Sat 3:00-5:30 PM** - Wardrobe filters and item detail; upload flow UI.
3. **Sat 5:30-7:30 PM** - Reel results, verdict card, donation finder (list first, map if time).
4. **Sat 7:30-9:30 PM** - Purchase approval card; wire to live endpoints as they land; visual polish pass.
5. **Sat 9:30-10:15 PM** - Demo seeding support, rehearsal, backup video.
6. **Sat 10:30 PM** - Devpost draft. Overnight: stretch tier (price-drop badges, cleanout view, Style DNA card, weather strip), then swipe deck, outfit board, group shared-cart view if the parked backend items lift.

## 6. Acceptance criteria

1. The full demo script runs in the web chat alone (fallback proof): outfit answer, reel matches, verdict, approve-to-pay confirmation, donation places.
2. Wardrobe grid renders 30+ seeded items smoothly on a phone with working filters.
3. No dead buttons: anything not wired by 9:30 PM either gets a mock or is hidden.
4. No console errors on the demo path; loading states on every async action.

---

Pair this with the Overall PRD for the story and the Backend PRD for endpoint details.
