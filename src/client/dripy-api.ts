// Browser client for the Dripy API routes in src/app/api (same origin, so relative URLs;
// the session cookie rides along). Types come from the shared contract in src/lib/types.ts.

import type {
  Card,
  ChatHistoryResponse,
  ChatResponse,
  Mode,
  PaymentConfirmationCard,
  Place,
  PlacesCard,
  PurchaseIntentCard,
  WardrobeItem,
  WardrobeResponse,
} from "@/lib/types";

export type { Card, Mode, Place, PurchaseIntentCard, WardrobeItem };

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    ...(json !== undefined ? { method: rest.method ?? "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) } : {}),
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `Dripy API error ${res.status}`);
  return body;
}

// ---- account ----------------------------------------------------------------------

export interface Account {
  user: { id: string; name: string; email: string | null; phone: string | null };
  imessage: { handle: string | null; body: string; url: string | null };
}

export type Gender = "women" | "men";

export const signUp = (input: { name: string; email: string; phone: string; gender: Gender }) => call<Account & { created: boolean }>("/api/auth/signup", { json: input });
export const logIn = (phone: string) => call<Account>("/api/auth/login", { json: { phone } });
export const logOut = () => call<{ ok: true }>("/api/auth/logout", { method: "POST" });
export const getAccount = () => call<Account>("/api/auth/me");

export interface Settings {
  gender: Gender;
  /** Most the agent may spend on one purchase; null = the server cap. */
  spend_limit_cents: number | null;
  max_spend_limit_cents: number;
}
export const getSettings = () => call<Settings>("/api/account/settings");
export const saveSettings = (patch: { gender?: Gender; spend_limit_cents?: number | null }) => call<Settings>("/api/account/settings", { json: patch });

// ---- chat -------------------------------------------------------------------------

/** `images`: data: URLs of attached photos (see src/client/images.ts), up to 3. */
export const sendChat = (message: string, images: string[] = [], signal?: AbortSignal) =>
  call<ChatResponse>("/api/chat", {
    json: { message, ...(images.length ? { attachments: images.map((data_url) => ({ type: "image", data_url })) } : {}) },
    ...(signal ? { signal } : {}),
  });

/** Image URLs stored on a past chat message (photos sent on iMessage or the web). */
export function attachmentUrls(m: HistoryMessage): string[] {
  return m.attachments
    .map((a) => (a && typeof a === "object" && typeof (a as { url?: unknown }).url === "string" ? (a as { url: string }).url : null))
    .filter((u): u is string => !!u);
}

export type HistoryMessage = ChatHistoryResponse["messages"][number];
export const getChatHistory = () => call<ChatHistoryResponse>("/api/chat/history?limit=50").then((r) => r.messages);

// ---- wardrobe, shop, checkout, donations ----------------------------------------------

export const getWardrobe = () => call<WardrobeResponse>("/api/wardrobe").then((r) => r.items);

export interface ShopItem {
  id: string;
  name: string;
  brand: string;
  type: string;
  price_cents: number;
  image_url: string;
  url: string;
  reason: string;
}
export const getShop = () => call<{ items: ShopItem[] }>("/api/shop").then((r) => r.items);

export interface SavedCard {
  brand: string;
  last4: string;
}
export const buyFromShop = (productId: string) =>
  call<{ id: string; card: PurchaseIntentCard; saved_card: SavedCard | null }>("/api/shop/buy", { json: { product_id: productId } });

export interface CheckoutSummary {
  id: string;
  status: string;
  item_name: string;
  amount_cents: number;
  currency: string;
  merchant_domain: string;
  merchant_url: string;
  image_url: string | null;
  mode: string;
  saved_card: SavedCard | null;
}
export const getCheckout = (id: string, token: string | null) =>
  call<{ checkout: CheckoutSummary }>(`/api/checkout/${id}${token ? `?t=${encodeURIComponent(token)}` : ""}`).then((r) => r.checkout);

export type CardInput = { number: string; exp: string; cvc: string; name: string };
export const payCheckout = (id: string, input: { t?: string | null; card?: CardInput }) =>
  call<{ status: string; card: PaymentConfirmationCard | PurchaseIntentCard; reply: string; imessaged: boolean }>(`/api/checkout/${id}`, { json: input });

export const donateItems = (itemIds: string[], where?: { lat: number; lng: number }) =>
  call<{ removed: { id: string; name: string }[]; places: Place[]; reply: string; card: PlacesCard; imessaged: boolean }>("/api/wardrobe/donate", {
    json: { item_ids: itemIds, ...where },
  });

// ---- helpers ----------------------------------------------------------------------

export const money = (cents: number | null | undefined) => (cents == null ? "" : `$${(cents / 100).toFixed(2)}`);

/** Same-site path for a checkout link (the API returns a full URL built from APP_URL). */
export function checkoutPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** A garment tile shown under a fairy message. */
export type ChatPick = { id: string; name: string; image?: string | undefined; link?: string | undefined; store: string };

/** Garment tiles to show for the cards in a chat reply. */
export function picksFromCards(cards: Card[]): ChatPick[] {
  const picks: ChatPick[] = [];
  for (const card of cards) {
    if (card.type === "outfit") {
      for (const it of card.items) picks.push({ id: it.id, name: it.name, image: it.image_url ?? undefined, store: it.brand ?? "Your closet" });
    } else if (card.type === "reel_matches") {
      for (const m of card.matches)
        picks.push({ id: m.id, name: m.name, image: m.image_url ?? undefined, link: m.url, store: m.merchant ?? m.merchant_domain ?? m.brand ?? "Shop" });
    } else if (card.type === "verdict") {
      picks.push({ id: `verdict-${card.item.name}`, name: card.item.name, image: card.item.image_url ?? undefined, link: card.item.url ?? undefined, store: money(card.item.price_cents) || "Candidate" });
    }
  }
  return picks.slice(0, 6);
}

/** Extra lines of text the cards carry (receipt, places). Purchase cards get their own UI. */
export function notesFromCards(cards: Card[]): string[] {
  const notes: string[] = [];
  for (const card of cards) {
    if (card.type === "verdict") notes.push(`${card.verdict}: ${card.headline}`);
    else if (card.type === "payment_confirmation")
      notes.push(
        card.status === "paid"
          ? `Paid ${money(card.amount_cents)} at ${card.merchant_domain}${card.card ? ` with ${card.card.brand.toUpperCase()} •••• ${card.card.last4}` : ""}${card.reference ? ` (ref ${card.reference})` : ""}`
          : `Payment for ${card.item_name} failed`,
      );
    else if (card.type === "places") {
      for (const p of card.places.slice(0, 3)) notes.push(`📍 ${p.name}: ${p.distance_km.toFixed(1)} km${p.hours_today ? `, ${p.hours_today}` : ""}`);
    } else if (card.type === "error") notes.push(card.message);
  }
  return notes;
}
