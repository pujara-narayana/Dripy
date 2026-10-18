// Server-only configuration. Every integration degrades to a labeled fallback when its
// keys are missing, so a half-configured .env still serves the frontend.

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  // Gemini 3.8 Flash: Google's recommended model for fast agentic tool use.
  model: process.env.GEMINI_MODEL || "gemini-3.8-flash",

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  serpapiKey: process.env.SERPAPI_KEY,
  channel3Key: process.env.CHANNEL3_API_KEY,

  photonWebhookSecret: process.env.PHOTON_WEBHOOK_SECRET,
  photonWorkerUrl: process.env.PHOTON_WORKER_URL,
  photonWorkerSecret: process.env.PHOTON_WORKER_SECRET,

  // simulated (default) | stripe | visa_sandbox. Legacy VISA_MODE=sandbox still works.
  paymentProvider: ((process.env.PAYMENT_PROVIDER || (process.env.VISA_MODE === "sandbox" ? "visa_sandbox" : "simulated")).toLowerCase()) as
    | "simulated"
    | "stripe"
    | "visa_sandbox",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  visaBaseUrl: process.env.VISA_BASE_URL || "https://apitest.visaacceptance.com",
  visaMerchantId: process.env.VISA_MERCHANT_ID,
  visaKeyId: process.env.VISA_SHARED_SECRET_KEY_ID,
  visaSharedSecret: process.env.VISA_SHARED_SECRET,
  visaTokenRequesterId: process.env.VISA_TOKEN_REQUESTER_ID,
  visaRelationshipId: process.env.VISA_RELATIONSHIP_ID,
  visaInstrumentId: process.env.VISA_INSTRUMENT_IDENTIFIER_ID,
  visaCustomerId: process.env.VISA_CUSTOMER_ID,

  forceFallback: list(process.env.FORCE_FALLBACK),
  purchaseCapCents: Number(process.env.PURCHASE_CAP_CENTS || 30000),
  approvalTtlMinutes: Number(process.env.APPROVAL_TTL_MINUTES || 10),

  // When vision identifies a garment that matches a curated demo analysis (same cut and
  // color family), serve the curated matches instead of live SerpAPI. Labeled "cached".
  demoCatalog: (process.env.DEMO_CATALOG ?? "true") !== "false",

  geoapifyKey: process.env.GEOAPIFY_API_KEY,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
  overpassUrl: process.env.OVERPASS_BASE_URL || "https://overpass-api.de/api/interpreter",
  openMeteoUrl: process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1/forecast",
  // Public URL of this app, used in links Dripy texts to people (checkout, wardrobe).
  appUrl: (process.env.APP_URL || process.env.DRIPY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, ""),
  // Signs session cookies and checkout/login links. Falls back to a key derived from the
  // service-role key so a half-configured .env still works; set SESSION_SECRET in production.
  sessionSecret: process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dripy-dev-session-secret",
  // The phone number or Apple ID people text to reach Dripy (the Photon line), e.g. +12065550123.
  imessageHandle: process.env.DRIPY_IMESSAGE_HANDLE || "",
  demoUserId: process.env.DEMO_USER_ID || "00000000-0000-0000-0000-000000000001",
  demoLat: Number(process.env.DEMO_LAT || 47.6553), // UW campus, Seattle
  demoLng: Number(process.env.DEMO_LNG || -122.3035),
};

export type Integration = "llm" | "db" | "serpapi" | "overpass" | "visa" | "photon" | "tiktok" | "weather" | "geoapify" | "gmail" | "channel3";

/** True when an integration should be skipped in favor of its fallback. */
export function isForced(integration: Integration): boolean {
  if (env.forceFallback.includes("all") || env.forceFallback.includes(integration)) return true;
  switch (integration) {
    case "llm":
      return !env.geminiApiKey;
    case "db":
      return !env.supabaseUrl || !env.supabaseServiceRoleKey;
    case "serpapi":
      return !env.serpapiKey;
    case "channel3":
      return !env.channel3Key;
    case "geoapify":
      return !env.geoapifyKey;
    case "gmail":
      return !env.googleClientId || !env.googleClientSecret || !env.gmailRefreshToken;
    case "photon":
      return !env.photonWorkerUrl || !env.photonWorkerSecret;
    default:
      return false;
  }
}
