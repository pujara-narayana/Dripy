// Shared contract between the backend and the frontend teammate.
// Every API response carries `meta`; every chat turn returns `cards`, which are
// built from real tool output — the model never writes a card itself.

export type Mode = "live" | "cached" | "simulated";
export interface Meta {
  mode: Mode;
  fallback_used: boolean;
  /** Integrations that fell back during this request, e.g. ["serpapi", "visa"]. */
  fallbacks?: string[];
}

export type Channel = "imessage" | "sms" | "whatsapp" | "web";
export type IntentStatus =
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";
export type Verdict = "BUY" | "SKIP" | "CONSIDER";
/** Which payment rail ran: simulated ids, Stripe test mode, or the Visa IC sandbox. */
export type PaymentMode = "simulated" | "stripe_test" | "sandbox";

export interface WardrobeItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  color: string | null;
  size: string | null;
  price_cents: number | null;
  currency: string;
  source: "receipt" | "upload" | "reel" | "purchase" | "seed";
  occasion_tags: string[];
  image_url: string | null;
  times_worn: number;
  last_worn_at: string | null;
  created_at: string;
}

export interface WardrobeItemRef {
  id: string;
  name: string;
  brand?: string | null;
  category: string;
  image_url?: string | null;
}

export interface ProductMatch {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  color?: string | null;
  price_cents?: number | null;
  currency: string;
  merchant?: string | null;
  merchant_domain?: string | null;
  url: string;
  image_url?: string | null;
}

export interface IdentifiedGarment {
  label: string;
  category: string;
  subcategory?: string;
  color?: string;
  occasion_tags?: string[];
}

// ---- Cards ---------------------------------------------------------------

export interface OutfitCard {
  type: "outfit";
  title: string;
  items: WardrobeItemRef[];
  note?: string;
}

export interface ReelMatchesCard {
  type: "reel_matches";
  analysis_id: string;
  source_image_url?: string | null;
  identified: IdentifiedGarment[];
  matches: ProductMatch[];
}

export interface VerdictCard {
  type: "verdict";
  verdict: Verdict;
  headline: string;
  item: { name: string; price_cents?: number | null; url?: string | null; image_url?: string | null };
  match_id?: string | null;
  reasons: string[];
  /** Owned items cited in the reasons — always real wardrobe rows. */
  dupes: { item_id: string; name: string; image_url?: string | null; similarity: number }[];
  gap_filled: string | null;
  price: { candidate_cents: number | null; market_median_cents: number | null; good_price: boolean | null } | null;
}

export interface PurchaseIntentCard {
  type: "purchase_intent";
  intent_id: string;
  item_name: string;
  amount_cents: number;
  currency: string;
  merchant_domain: string;
  merchant_url: string;
  status: IntentStatus;
  approval_expires_at: string | null;
  mode: PaymentMode;
  /** Exactly what the user has to reply, e.g. "Reply YES to pay $68.00 at zara.com". */
  prompt: string;
}

export interface PaymentConfirmationCard {
  type: "payment_confirmation";
  intent_id: string;
  status: "paid" | "failed";
  item_name: string;
  amount_cents: number;
  currency: string;
  merchant_domain: string;
  /** Provider ids. Visa: instruction/transaction ids. Stripe: PaymentIntent (pi_) / Charge (ch_). */
  visa_instruction_id?: string | null;
  visa_transaction_id?: string | null;
  /** The id to show the user as a receipt reference. */
  reference?: string | null;
  /** Card that was charged, e.g. {brand: "visa", last4: "4242"} (Stripe mode). */
  card?: { brand: string; last4: string } | null;
  mode: PaymentMode;
  error?: string;
}

export interface Place {
  id: string;
  name: string;
  address: string | null;
  kind: string;
  distance_km: number;
  open_now: boolean | null;
  hours_today: string | null;
  maps_url: string | null;
}

export interface PlacesCard {
  type: "places";
  places: Place[];
  nudge?: string | null;
}

export interface ErrorCard {
  type: "error";
  message: string;
}

export type Card =
  | OutfitCard
  | ReelMatchesCard
  | VerdictCard
  | PurchaseIntentCard
  | PaymentConfirmationCard
  | PlacesCard
  | ErrorCard;

// ---- API responses ---------------------------------------------------------

export interface ChatResponse {
  reply: string;
  cards: Card[];
  message_id: string | null;
  meta: Meta;
}

export interface ChatHistoryResponse {
  messages: {
    id: string;
    channel: Channel;
    direction: "inbound" | "outbound";
    body: string | null;
    attachments: unknown[];
    cards: Card[];
    created_at: string;
  }[];
  meta: Meta;
}

export interface WardrobeResponse {
  items: WardrobeItem[];
  facets: { categories: string[]; brands: string[]; occasions: string[] };
  meta: Meta;
}

export interface ReelAnalyzeResponse {
  analysis_id: string;
  identified: IdentifiedGarment[];
  matches: ProductMatch[];
  card: ReelMatchesCard;
  meta: Meta;
}

export interface BuyCheckResponse {
  card: VerdictCard;
  meta: Meta;
}

export interface DonationsResponse {
  places: Place[];
  card: PlacesCard;
  meta: Meta;
}

export interface PurchaseIntentResponse {
  id: string;
  status: IntentStatus;
  card: PurchaseIntentCard;
  meta: Meta;
}

export interface ApproveResponse {
  status: IntentStatus;
  card: PaymentConfirmationCard | PurchaseIntentCard;
  meta: Meta;
}

export interface ReceiptsSyncResponse {
  added: number;
  receipts_parsed: number;
  items: WardrobeItem[];
  meta: Meta;
}

export interface ApiError {
  error: string;
  fallback_used?: boolean;
}
