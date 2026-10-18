// Demo data, designed backward from the two-beat demo:
//   Beat 1 (SKIP, "talks you out of it"): forward a black bomber screenshot. Alex
//          already owns two black jackets, so Dripy says skip and cites both.
//   Beat 2 (BUY): forward a camel blazer. Alex owns three jackets but none for
//          smart-casual, so it fills a gap at a good price; approve, pay with Visa.
// IDs are fixed so checked-in mocks reference real rows.

export const DEMO_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Alex Rivera",
  phone: process.env.DEMO_USER_PHONE || "+12065550123",
  email: "alex.rivera@example.com",
  home_lat: 47.6553,
  home_lng: -122.3035,
};

const wid = (n: number) => `00000000-0000-0000-0001-${String(n).padStart(12, "0")}`;
const rid = (n: number) => `00000000-0000-0000-0002-${String(n).padStart(12, "0")}`;
const img = (hex: string, label: string) =>
  `https://placehold.co/600x800/${hex}/ffffff/png?text=${encodeURIComponent(label)}`;

export interface SeedItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  color: string;
  size: string;
  price_cents: number;
  occasion_tags: string[];
  image_url: string;
  times_worn: number;
  last_worn_at: string | null;
}

// Items that arrive through receipts carry their receipt line.
export interface SeedReceipt {
  id: string;
  file: string; // supabase/seeds/receipts/<file>
  retailer: string;
  order_date: string;
  total_cents: number;
  lines: SeedItem[];
}

export const SEED_RECEIPTS: SeedReceipt[] = [
  {
    id: rid(1),
    file: "zara-2026-06-10.eml",
    retailer: "Zara",
    order_date: "2026-06-10",
    total_cents: 3990,
    lines: [
      {
        id: wid(14), name: "White Linen Shirt", brand: "Zara", category: "top", subcategory: "shirt",
        color: "white", size: "M", price_cents: 3990, occasion_tags: ["smart-casual", "casual"],
        image_url: img("e8e4dc", "White Linen Shirt"), times_worn: 9, last_worn_at: "2026-10-03T19:00:00Z",
      },
    ],
  },
  {
    id: rid(2),
    file: "zara-2026-08-14.eml",
    retailer: "Zara",
    order_date: "2026-08-14",
    total_cents: 10580,
    lines: [
      {
        id: wid(1), name: "Black Bomber Jacket", brand: "Zara", category: "outerwear", subcategory: "bomber",
        color: "black", size: "M", price_cents: 6990, occasion_tags: ["casual"],
        image_url: img("111111", "Black Bomber Jacket"), times_worn: 14, last_worn_at: "2026-10-15T17:00:00Z",
      },
      {
        id: wid(10), name: "Beige Chino Shorts", brand: "Zara", category: "bottom", subcategory: "shorts",
        color: "beige", size: "32", price_cents: 3590, occasion_tags: ["casual"],
        image_url: img("d8c8a8", "Beige Chino Shorts"), times_worn: 6, last_worn_at: "2026-09-01T18:00:00Z",
      },
    ],
  },
  {
    id: rid(3),
    file: "hm-2026-09-02.eml",
    retailer: "H&M",
    order_date: "2026-09-02",
    total_cents: 5498,
    lines: [
      {
        id: wid(4), name: "Grey Relaxed Hoodie", brand: "H&M", category: "top", subcategory: "hoodie",
        color: "grey", size: "M", price_cents: 2499, occasion_tags: ["casual", "athletic"],
        image_url: img("8a8a8a", "Grey Hoodie"), times_worn: 21, last_worn_at: "2026-10-16T08:00:00Z",
      },
      {
        id: wid(7), name: "Blue Oxford Shirt", brand: "H&M", category: "top", subcategory: "shirt",
        color: "blue", size: "M", price_cents: 2999, occasion_tags: ["smart-casual"],
        image_url: img("6f8fb8", "Blue Oxford Shirt"), times_worn: 4, last_worn_at: "2026-10-10T18:00:00Z",
      },
    ],
  },
  {
    id: rid(4),
    file: "asos-2026-09-20.eml",
    retailer: "ASOS",
    order_date: "2026-09-20",
    total_cents: 12500,
    lines: [
      {
        id: wid(6), name: "Black Crew Tee", brand: "ASOS DESIGN", category: "top", subcategory: "tee",
        color: "black", size: "M", price_cents: 1500, occasion_tags: ["casual"],
        image_url: img("1c1c1c", "Black Tee"), times_worn: 11, last_worn_at: "2026-10-14T08:00:00Z",
      },
      {
        id: wid(9), name: "Black Slim Chinos", brand: "ASOS DESIGN", category: "bottom", subcategory: "chinos",
        color: "black", size: "32", price_cents: 4000, occasion_tags: ["smart-casual"],
        image_url: img("222222", "Black Chinos"), times_worn: 5, last_worn_at: "2026-10-10T18:00:00Z",
      },
      {
        id: wid(12), name: "Brown Suede Chelsea Boots", brand: "ASOS DESIGN", category: "shoes", subcategory: "boots",
        color: "brown", size: "10", price_cents: 7000, occasion_tags: ["smart-casual"],
        image_url: img("6b4423", "Chelsea Boots"), times_worn: 7, last_worn_at: "2026-10-10T18:00:00Z",
      },
    ],
  },
  {
    id: rid(5),
    file: "hm-2026-10-01.eml",
    retailer: "H&M",
    order_date: "2026-10-01",
    total_cents: 2298,
    lines: [
      {
        id: wid(13), name: "Grey Rib Beanie", brand: "H&M", category: "accessory", subcategory: "beanie",
        color: "grey", size: "One Size", price_cents: 999, occasion_tags: ["casual"],
        image_url: img("7a7a7a", "Grey Beanie"), times_worn: 3, last_worn_at: "2026-10-12T08:00:00Z",
      },
      {
        id: wid(15), name: "Striped Crew Socks 3-Pack", brand: "H&M", category: "accessory", subcategory: "socks",
        color: "white", size: "One Size", price_cents: 1299, occasion_tags: ["casual"],
        image_url: img("dddddd", "Socks 3-Pack"), times_worn: 8, last_worn_at: "2026-10-16T08:00:00Z",
      },
    ],
  },
];

// Items that came from photo uploads or onboarding, not receipts.
export const SEED_DIRECT_ITEMS: (SeedItem & { source: "upload" | "seed" })[] = [
  {
    id: wid(2), name: "Black Faux-Leather Biker Jacket", brand: "Mango", category: "outerwear", subcategory: "biker jacket",
    color: "black", size: "M", price_cents: 8999, occasion_tags: ["casual", "going-out"],
    image_url: img("0d0d0d", "Black Biker Jacket"), times_worn: 3, last_worn_at: "2026-03-14T03:00:00Z", source: "upload",
  },
  {
    id: wid(3), name: "Light-Wash Denim Jacket", brand: "Levi's", category: "outerwear", subcategory: "denim jacket",
    color: "blue", size: "M", price_cents: 9800, occasion_tags: ["casual"],
    image_url: img("7ea1c4", "Denim Jacket"), times_worn: 0, last_worn_at: null, source: "seed",
  },
  {
    id: wid(5), name: "White Essential Tee", brand: "Uniqlo", category: "top", subcategory: "tee",
    color: "white", size: "M", price_cents: 1490, occasion_tags: ["casual"],
    image_url: img("f4f4f4", "White Tee"), times_worn: 18, last_worn_at: "2026-10-15T08:00:00Z", source: "upload",
  },
  {
    id: wid(8), name: "Blue Slim Jeans", brand: "Levi's", category: "bottom", subcategory: "jeans",
    color: "blue", size: "32", price_cents: 6950, occasion_tags: ["casual"],
    image_url: img("3b5b8c", "Blue Slim Jeans"), times_worn: 30, last_worn_at: "2026-10-16T08:00:00Z", source: "seed",
  },
  {
    id: wid(11), name: "White Leather Sneakers", brand: "Nike", category: "shoes", subcategory: "sneakers",
    color: "white", size: "10", price_cents: 11000, occasion_tags: ["casual"],
    image_url: img("fafafa", "White Sneakers"), times_worn: 40, last_worn_at: "2026-10-16T08:00:00Z", source: "seed",
  },
];

// ---- Cached demo analyses -------------------------------------------------------
// Keyed by "demo:skip" / "demo:buy". `npm run demo:register` re-keys them to the
// sha256 of the actual screenshot you'll forward, so the demo is deterministic.

const mid = (n: number) => `00000000-0000-0000-0003-${String(n).padStart(12, "0")}`;
const aid = (n: number) => `00000000-0000-0000-0004-${String(n).padStart(12, "0")}`;

export interface SeedMatch {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  color: string;
  occasion_tags: string[];
  price_cents: number;
  market_median_cents: number;
  merchant: string;
  merchant_domain: string;
  url: string;
  image_url: string;
}

export interface SeedAnalysis {
  id: string;
  cache_key: string;
  image_url: string;
  identified: { label: string; category: string; subcategory: string; color: string; occasion_tags: string[] }[];
  matches: SeedMatch[];
}

export const SEED_ANALYSES: SeedAnalysis[] = [
  {
    id: aid(1),
    cache_key: "demo:skip",
    image_url: img("101010", "Reel: black bomber"),
    identified: [
      { label: "black nylon bomber jacket", category: "outerwear", subcategory: "bomber", color: "black", occasion_tags: ["casual"] },
    ],
    matches: [
      {
        id: mid(1), name: "Oversized Nylon Bomber Jacket", brand: "ASOS DESIGN", category: "outerwear", subcategory: "bomber",
        color: "black", occasion_tags: ["casual"], price_cents: 5800, market_median_cents: 6500,
        merchant: "ASOS", merchant_domain: "asos.com", url: "https://www.asos.com/us/search/?q=black+nylon+bomber+jacket",
        image_url: img("151515", "ASOS Nylon Bomber"),
      },
      {
        id: mid(2), name: "Technical Bomber Jacket", brand: "Zara", category: "outerwear", subcategory: "bomber",
        color: "black", occasion_tags: ["casual"], price_cents: 6990, market_median_cents: 6500,
        merchant: "Zara", merchant_domain: "zara.com", url: "https://www.zara.com/us/en/search?searchTerm=black%20bomber%20jacket",
        image_url: img("181818", "Zara Bomber"),
      },
      {
        id: mid(3), name: "Padded Bomber Jacket", brand: "H&M", category: "outerwear", subcategory: "bomber",
        color: "black", occasion_tags: ["casual"], price_cents: 4999, market_median_cents: 6500,
        merchant: "H&M", merchant_domain: "hm.com", url: "https://www2.hm.com/en_us/search-results.html?q=black+bomber",
        image_url: img("1a1a1a", "H&M Bomber"),
      },
    ],
  },
  {
    id: aid(2),
    cache_key: "demo:buy",
    image_url: img("b08a5b", "Reel: camel blazer"),
    identified: [
      { label: "camel unstructured blazer", category: "outerwear", subcategory: "blazer", color: "camel", occasion_tags: ["smart-casual"] },
    ],
    matches: [
      {
        id: mid(4), name: "Unstructured Wool-Blend Blazer", brand: "Zara", category: "outerwear", subcategory: "blazer",
        color: "camel", occasion_tags: ["smart-casual"], price_cents: 7990, market_median_cents: 9500,
        merchant: "Zara", merchant_domain: "zara.com", url: "https://www.zara.com/us/en/search?searchTerm=camel%20blazer",
        image_url: img("b08a5b", "Zara Camel Blazer"),
      },
      {
        id: mid(5), name: "Relaxed Camel Blazer", brand: "COS", category: "outerwear", subcategory: "blazer",
        color: "camel", occasion_tags: ["smart-casual"], price_cents: 17500, market_median_cents: 9500,
        merchant: "COS", merchant_domain: "cos.com", url: "https://www.cos.com/en-us/search?q=camel+blazer",
        image_url: img("a67c52", "COS Blazer"),
      },
      {
        id: mid(6), name: "Slim Blazer in Camel", brand: "ASOS DESIGN", category: "outerwear", subcategory: "blazer",
        color: "camel", occasion_tags: ["smart-casual"], price_cents: 6500, market_median_cents: 9500,
        merchant: "ASOS", merchant_domain: "asos.com", url: "https://www.asos.com/us/search/?q=camel+blazer",
        image_url: img("c19a6b", "ASOS Camel Blazer"),
      },
    ],
  },
];

// ---- Seattle donation places (real businesses; coordinates approximate) ---------

const week = (open: string, close: string, sunOpen = "11:00", sunClose = "19:00") => ({
  mon: [[open, close]], tue: [[open, close]], wed: [[open, close]], thu: [[open, close]],
  fri: [[open, close]], sat: [[open, close]], sun: [[sunOpen, sunClose]],
});
const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const SEED_PLACES = [
  {
    id: "00000000-0000-0000-0005-000000000001",
    name: "Buffalo Exchange", address: "4530 University Way NE, Seattle, WA 98105",
    lat: 47.6618, lng: -122.3131, kind: "consignment", hours_json: week("10:00", "20:00"),
    maps_url: maps("Buffalo Exchange 4530 University Way NE Seattle"),
  },
  {
    id: "00000000-0000-0000-0005-000000000002",
    name: "Crossroads Trading", address: "325 Broadway E, Seattle, WA 98102",
    lat: 47.6215, lng: -122.3208, kind: "consignment", hours_json: week("11:00", "19:00"),
    maps_url: maps("Crossroads Trading 325 Broadway E Seattle"),
  },
  {
    id: "00000000-0000-0000-0005-000000000003",
    name: "Value Village (Savers) Capitol Hill", address: "1525 11th Ave, Seattle, WA 98122",
    lat: 47.6146, lng: -122.3176, kind: "thrift", hours_json: week("09:00", "21:00", "10:00", "20:00"),
    maps_url: maps("Value Village 1525 11th Ave Seattle"),
  },
  {
    id: "00000000-0000-0000-0005-000000000004",
    name: "Goodwill Seattle Store & Donation Center", address: "1400 S Lane St, Seattle, WA 98144",
    lat: 47.5967, lng: -122.3146, kind: "donation_dropoff", hours_json: week("09:00", "21:00", "10:00", "19:00"),
    maps_url: maps("Goodwill 1400 S Lane St Seattle"),
  },
  {
    id: "00000000-0000-0000-0005-000000000005",
    name: "The Salvation Army Thrift Store", address: "1010 4th Ave S, Seattle, WA 98134",
    lat: 47.5932, lng: -122.3290, kind: "thrift", hours_json: week("10:00", "19:00", "10:00", "18:00"),
    maps_url: maps("Salvation Army Thrift Store 1010 4th Ave S Seattle"),
  },
];

export const ALL_SEED_ITEMS = [
  ...SEED_DIRECT_ITEMS,
  ...SEED_RECEIPTS.flatMap((r) => r.lines.map((l) => ({ ...l, source: "receipt" as const }))),
];
