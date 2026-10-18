// The demo clothing catalog, shared by the web pages and the backend.
// Photos are Uniqlo product shots (public/images/clothing); links go to the matching Uniqlo
// product or category page. Prices are demo prices, not live Uniqlo prices.
// `owned: true` items make up every new user's starter closet; the rest is the shop that
// the Recommended page sells from.

export type CatalogType = "Outerwear" | "Tops" | "Dresses" | "Bottoms" | "Shoes" | "Accessories";

export interface CatalogItem {
  id: string;
  name: string;
  type: CatalogType;
  /** wardrobe_items.category: outerwear | top | dress | bottom | shoes | accessory */
  category: string;
  color: string | null;
  priceCents: number;
  image: string;
  link: string;
  reason: string;
  owned: boolean;
}

export const catalog: CatalogItem[] = [
  { id: "jacket", name: "Utility jacket", type: "Outerwear", category: "outerwear", color: "black", priceCents: 7990, image: "/images/clothing/jacket-flat.png", link: "https://www.uniqlo.com/us/en/products/E469775-000/00", reason: "A structured layer for your everyday neutrals", owned: true },
  { id: "cardigan", name: "Fine-knit cardigan", type: "Outerwear", category: "outerwear", color: "black", priceCents: 7990, image: "/images/clothing/cardigan.png", link: "https://www.uniqlo.com/us/en/women/knitwear", reason: "Easy layering with your white shirt", owned: true },
  { id: "down-parka", name: "Ultra light down parka", type: "Outerwear", category: "outerwear", color: "black", priceCents: 9990, image: "/images/clothing/uq-450311.png", link: "https://www.uniqlo.com/us/en/products/E450311-000/00", reason: "The warmest thing you own, without the bulk", owned: true },
  { id: "rain-coat", name: "Water-repellent coat", type: "Outerwear", category: "outerwear", color: null, priceCents: 7990, image: "/images/clothing/uq-439695.png", link: "https://www.uniqlo.com/us/en/products/E439695-000/00", reason: "Blocks wind and drizzle on grey mornings", owned: false },
  { id: "coach-jacket", name: "Coach jacket", type: "Outerwear", category: "outerwear", color: null, priceCents: 5990, image: "/images/clothing/uq-445041.png", link: "https://www.uniqlo.com/us/en/products/E445041-000/00", reason: "Tosses over anything, packs down small", owned: true },
  { id: "utility-parka", name: "Cotton blend parka", type: "Outerwear", category: "outerwear", color: null, priceCents: 7990, image: "/images/clothing/uq-474177.png", link: "https://www.uniqlo.com/us/en/products/E474177-000/00", reason: "Utility pocketing with a soft, broken-in feel", owned: false },
  { id: "blazer", name: "Single-breasted blazer", type: "Outerwear", category: "outerwear", color: null, priceCents: 8990, image: "/images/clothing/uq-462738.png", link: "https://www.uniqlo.com/us/en/products/E462738-000/00", reason: "Sharpens jeans and knits in one move", owned: false },
  { id: "blouson", name: "Coated blouson", type: "Outerwear", category: "outerwear", color: null, priceCents: 7990, image: "/images/clothing/uq-487883.png", link: "https://www.uniqlo.com/us/en/products/E487883-000/00", reason: "A crisp layer with an easy rounded hem", owned: false },
  { id: "shirt", name: "Cotton stand-collar shirt", type: "Tops", category: "top", color: "white", priceCents: 3990, image: "/images/clothing/shirt-clean.png", link: "https://www.uniqlo.com/us/en/products/E448440-000/00", reason: "A clean silhouette, just your style", owned: true },
  { id: "knit", name: "Soft crew-neck knit", type: "Tops", category: "top", color: "white", priceCents: 3990, image: "/images/clothing/knit-clean.png", link: "https://www.uniqlo.com/us/en/women/knitwear", reason: "Soft texture to balance your tailored pieces", owned: true },
  { id: "merino-gray", name: "Merino crew-neck sweater", type: "Tops", category: "top", color: "grey", priceCents: 3990, image: "/images/clothing/uq-428855.png", link: "https://www.uniqlo.com/us/en/products/E428855-000/00", reason: "Soft merino in a heathered grey", owned: true },
  { id: "merino-cardigan-navy", name: "Merino crew-neck cardigan", type: "Tops", category: "top", color: "navy", priceCents: 3990, image: "/images/clothing/uq-428858.png", link: "https://www.uniqlo.com/us/en/products/E428858-000/00", reason: "Buttons up neatly over your white shirt", owned: false },
  { id: "merino-black", name: "Extra-fine merino sweater", type: "Tops", category: "top", color: "black", priceCents: 3990, image: "/images/clothing/uq-443411.png", link: "https://www.uniqlo.com/us/en/products/E443411-000/00", reason: "A black crew you'll reach for weekly", owned: true },
  { id: "merino-long", name: "Merino long-sleeve sweater", type: "Tops", category: "top", color: null, priceCents: 3990, image: "/images/clothing/uq-450509.png", link: "https://www.uniqlo.com/us/en/products/E450509-001/00", reason: "Fine merino, quiet and polished", owned: false },
  { id: "merino-button", name: "Merino button-front cardigan", type: "Tops", category: "top", color: "black", priceCents: 3990, image: "/images/clothing/uq-450510.png", link: "https://www.uniqlo.com/us/en/products/E450510-000/00", reason: "A slim black layer for in-between days", owned: false },
  { id: "cashmere-crew", name: "Cashmere crew-neck sweater", type: "Tops", category: "top", color: null, priceCents: 9990, image: "/images/clothing/uq-439162.png", link: "https://www.uniqlo.com/us/en/products/E439162-000/00", reason: "Pure cashmere for the coldest mornings", owned: false },
  { id: "dress", name: "Pleated midi dress", type: "Dresses", category: "dress", color: null, priceCents: 4990, image: "/images/clothing/dress.png", link: "https://www.uniqlo.com/us/en/women/dresses-and-skirts", reason: "Understated, versatile, and easy to layer", owned: true },
  { id: "dress-rayon", name: "Rayon shirt dress", type: "Dresses", category: "dress", color: null, priceCents: 4990, image: "/images/clothing/uq-433651.png", link: "https://www.uniqlo.com/us/en/products/E433651-000/00", reason: "Wrinkle-proof and easy from desk to dinner", owned: true },
  { id: "dress-u-shirt", name: "U long-sleeve shirt dress", type: "Dresses", category: "dress", color: "yellow", priceCents: 4990, image: "/images/clothing/uq-452138.png", link: "https://www.uniqlo.com/us/en/products/E452138-000/00", reason: "A mustard pop under a neutral coat", owned: false },
  { id: "dress-sleeveless", name: "Stretch sleeveless dress", type: "Dresses", category: "dress", color: null, priceCents: 4990, image: "/images/clothing/uq-457012.png", link: "https://www.uniqlo.com/us/en/products/E457012-000/00", reason: "Sleek lines for warmer days", owned: false },
  { id: "dress-flannel", name: "Brushed flannel shirt dress", type: "Dresses", category: "dress", color: null, priceCents: 4990, image: "/images/clothing/uq-461514.png", link: "https://www.uniqlo.com/us/en/products/E461514-000/00", reason: "Brushed flannel with a flare \u2014 winter-ready", owned: true },
  { id: "dress-mini", name: "Cotton mini dress", type: "Dresses", category: "dress", color: null, priceCents: 4990, image: "/images/clothing/uq-464788.png", link: "https://www.uniqlo.com/us/en/products/E464788-000/00", reason: "An A-line mini that moves with you", owned: false },
  { id: "dress-volume", name: "Volume sleeve dress", type: "Dresses", category: "dress", color: null, priceCents: 4990, image: "/images/clothing/uq-477526.png", link: "https://www.uniqlo.com/us/en/products/E477526-000/00", reason: "Sleeves that make the whole outfit", owned: false },
  { id: "jeans", name: "Relaxed straight jeans", type: "Bottoms", category: "bottom", color: "blue", priceCents: 4990, image: "/images/clothing/jeans.png", link: "https://www.uniqlo.com/us/en/women/bottoms/jeans", reason: "Relaxed denim for your off-duty looks", owned: true },
  { id: "denim-pants", name: "Denim straight pants", type: "Bottoms", category: "bottom", color: "beige", priceCents: 4990, image: "/images/clothing/uq-461665.png", link: "https://www.uniqlo.com/us/en/products/E461665-000/00", reason: "Garment-dyed denim in a soft sand tone", owned: true },
  { id: "denim-skirt", name: "Denim easy skirt", type: "Bottoms", category: "bottom", color: "blue", priceCents: 4990, image: "/images/clothing/uq-461664.png", link: "https://www.uniqlo.com/us/en/products/E461664-000/00", reason: "An easy elastic-waist denim skirt", owned: false },
  { id: "pleated-pants", name: "Pleated wide pants", type: "Bottoms", category: "bottom", color: null, priceCents: 4990, image: "/images/clothing/uq-476945.png", link: "https://www.uniqlo.com/us/en/products/E476945-000/00", reason: "Tapered pleats that still feel relaxed", owned: true },
  { id: "skinny-jeans", name: "Stretch skinny jeans", type: "Bottoms", category: "bottom", color: "blue", priceCents: 4990, image: "/images/clothing/uq-445287.png", link: "https://www.uniqlo.com/us/en/products/E445287-000/00", reason: "Light-wash denim that keeps its shape", owned: true },
  { id: "culotte-denim", name: "Soft denim culottes", type: "Bottoms", category: "bottom", color: "blue", priceCents: 4990, image: "/images/clothing/uq-437388.png", link: "https://www.uniqlo.com/us/en/products/E437388-000/00", reason: "Culotte volume, denim ease", owned: false },
  { id: "jeans-wide", name: "Wide straight jeans", type: "Bottoms", category: "bottom", color: "blue", priceCents: 4990, image: "/images/clothing/uq-480879.png", link: "https://www.uniqlo.com/us/en/products/E480879-000/00", reason: "Wide, long lines that dress up denim", owned: false },
  { id: "sneakers-knit", name: "Knit lace-up sneakers", type: "Shoes", category: "shoes", color: null, priceCents: 3990, image: "/images/clothing/uq-433775.png", link: "https://www.uniqlo.com/us/en/products/E433775-000/00", reason: "Featherlight knits for long days out", owned: true },
  { id: "sneakers-canvas", name: "Cotton canvas sneakers", type: "Shoes", category: "shoes", color: null, priceCents: 3990, image: "/images/clothing/uq-434989.png", link: "https://www.uniqlo.com/us/en/products/E434989-000/00", reason: "Clean canvas for every errand", owned: true },
  { id: "flats-pointed", name: "Pointed ballet flats", type: "Shoes", category: "shoes", color: null, priceCents: 3990, image: "/images/clothing/uq-438876.png", link: "https://www.uniqlo.com/us/en/products/E438876-000/00", reason: "Pointed flats that still feel cushioned", owned: true },
  { id: "sneakers-suede", name: "Faux suede sneakers", type: "Shoes", category: "shoes", color: "beige", priceCents: 3990, image: "/images/clothing/uq-442233.png", link: "https://www.uniqlo.com/us/en/products/E442233-000/00", reason: "Soft suede in a warm beige", owned: true },
  { id: "sneakers-u-knit", name: "U knitted sneakers", type: "Shoes", category: "shoes", color: null, priceCents: 3990, image: "/images/clothing/uq-447450.png", link: "https://www.uniqlo.com/us/en/products/E447450-000/00", reason: "U-knit comfort, city-ready", owned: false },
  { id: "sneakers-leather", name: "Faux leather sneakers", type: "Shoes", category: "shoes", color: null, priceCents: 4990, image: "/images/clothing/uq-466623.png", link: "https://www.uniqlo.com/us/en/products/E466623-000/00", reason: "Sleek leather look with a grippy sole", owned: false },
  { id: "flats-tstrap", name: "T-strap ballet shoes", type: "Shoes", category: "shoes", color: null, priceCents: 3990, image: "/images/clothing/uq-479250.png", link: "https://www.uniqlo.com/us/en/products/E479250-000/00", reason: "A little charm for dressed-up days", owned: false },
  { id: "flats-square", name: "Square-toe flats", type: "Shoes", category: "shoes", color: null, priceCents: 3990, image: "/images/clothing/uq-482815.png", link: "https://www.uniqlo.com/us/en/products/E482815-000/00", reason: "Square toes, soft steps", owned: false },
  { id: "scarf-cashmere", name: "Cashmere scarf", type: "Accessories", category: "accessory", color: "black", priceCents: 5990, image: "/images/clothing/uq-438831.png", link: "https://www.uniqlo.com/us/en/products/E438831-000/00", reason: "Wide black cashmere, endlessly wearable", owned: true },
  { id: "beanie-cashmere", name: "Cashmere knitted beanie", type: "Accessories", category: "accessory", color: null, priceCents: 3990, image: "/images/clothing/uq-450336.png", link: "https://www.uniqlo.com/us/en/products/E450336-000/00", reason: "Cashmere ribs for cold ears", owned: true },
  { id: "beanie-pompom", name: "Pom-pom beanie", type: "Accessories", category: "accessory", color: null, priceCents: 2990, image: "/images/clothing/uq-483300.png", link: "https://www.uniqlo.com/us/en/products/E483300-000/00", reason: "Cable knit with a playful pompom", owned: false },
  { id: "hooded-scarf", name: "Hooded scarf", type: "Accessories", category: "accessory", color: null, priceCents: 2990, image: "/images/clothing/uq-481537.png", link: "https://www.uniqlo.com/us/en/products/E481537-000/00", reason: "Hood and scarf in one warm piece", owned: false },
  { id: "tote-leather", name: "Faux leather boat tote", type: "Accessories", category: "accessory", color: null, priceCents: 3990, image: "/images/clothing/uq-440022.png", link: "https://www.uniqlo.com/us/en/products/E440022-000/00", reason: "Structured tote that fits a laptop", owned: false },
  { id: "tote-canvas", name: "Canvas tool tote", type: "Accessories", category: "accessory", color: null, priceCents: 2490, image: "/images/clothing/uq-442432.png", link: "https://www.uniqlo.com/us/en/products/E442432-000/00", reason: "Water-resistant canvas with room to spare", owned: true },
  { id: "bag-utility", name: "2-way utility bag", type: "Accessories", category: "accessory", color: null, priceCents: 3990, image: "/images/clothing/uq-479880.png", link: "https://www.uniqlo.com/us/en/products/E479880-000/00", reason: "A padded carryall with a luggage strap", owned: false },
  { id: "bag-shoulder", name: "Puffy shoulder bag", type: "Accessories", category: "accessory", color: null, priceCents: 2990, image: "/images/clothing/uq-483802.png", link: "https://www.uniqlo.com/us/en/products/E483802-000/00", reason: "A soft puff of a shoulder bag", owned: false },
];

export const BRAND = "Uniqlo";
export const MERCHANT_DOMAIN = "uniqlo.com";

export const starterCloset = catalog.filter((item) => item.owned);
export const shopItems = catalog.filter((item) => !item.owned);
export const catalogById = (id: string) => catalog.find((item) => item.id === id);
