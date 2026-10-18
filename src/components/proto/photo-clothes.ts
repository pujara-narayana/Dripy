const shirt = "/images/clothing/shirt-clean.png";
const knit = "/images/clothing/knit-clean.png";
const dress = "/images/clothing/dress.png";
const jacket = "/images/clothing/jacket-flat.png";
const jeans = "/images/clothing/jeans.png";
const cardigan = "/images/clothing/cardigan.png";
const jacketLook = "/images/clothing/jacket.jpg";
const trouserLook = "/images/clothing/trousers.jpg";
const uq428855 = "/images/clothing/uq-428855.png";
const uq428858 = "/images/clothing/uq-428858.png";
const uq433651 = "/images/clothing/uq-433651.png";
const uq433775 = "/images/clothing/uq-433775.png";
const uq434989 = "/images/clothing/uq-434989.png";
const uq437388 = "/images/clothing/uq-437388.png";
const uq438831 = "/images/clothing/uq-438831.png";
const uq438876 = "/images/clothing/uq-438876.png";
const uq439162 = "/images/clothing/uq-439162.png";
const uq439695 = "/images/clothing/uq-439695.png";
const uq440022 = "/images/clothing/uq-440022.png";
const uq442233 = "/images/clothing/uq-442233.png";
const uq442432 = "/images/clothing/uq-442432.png";
const uq443411 = "/images/clothing/uq-443411.png";
const uq445041 = "/images/clothing/uq-445041.png";
const uq445287 = "/images/clothing/uq-445287.png";
const uq447450 = "/images/clothing/uq-447450.png";
const uq450311 = "/images/clothing/uq-450311.png";
const uq450336 = "/images/clothing/uq-450336.png";
const uq450509 = "/images/clothing/uq-450509.png";
const uq450510 = "/images/clothing/uq-450510.png";
const uq452138 = "/images/clothing/uq-452138.png";
const uq457012 = "/images/clothing/uq-457012.png";
const uq461514 = "/images/clothing/uq-461514.png";
const uq461664 = "/images/clothing/uq-461664.png";
const uq461665 = "/images/clothing/uq-461665.png";
const uq462738 = "/images/clothing/uq-462738.png";
const uq464788 = "/images/clothing/uq-464788.png";
const uq466623 = "/images/clothing/uq-466623.png";
const uq474177 = "/images/clothing/uq-474177.png";
const uq476945 = "/images/clothing/uq-476945.png";
const uq477526 = "/images/clothing/uq-477526.png";
const uq479250 = "/images/clothing/uq-479250.png";
const uq479880 = "/images/clothing/uq-479880.png";
const uq480879 = "/images/clothing/uq-480879.png";
const uq481537 = "/images/clothing/uq-481537.png";
const uq482815 = "/images/clothing/uq-482815.png";
const uq483300 = "/images/clothing/uq-483300.png";
const uq483802 = "/images/clothing/uq-483802.png";
const uq487883 = "/images/clothing/uq-487883.png";

// Photographic Uniqlo samples, not the user's actual wardrobe. Retailer links
// are product/category destinations; no inventory or live price claims.
// Every item is unique — nothing repeats across wardrobe sections.
export const photoClothes = [
  { id: "jacket", name: "Utility jacket", type: "Outerwear", image: jacket, link: "https://www.uniqlo.com/us/en/products/E469775-000/00", reason: "A structured layer for your everyday neutrals" },
  { id: "cardigan", name: "Fine-knit cardigan", type: "Outerwear", image: cardigan, link: "https://www.uniqlo.com/us/en/women/knitwear", reason: "Easy layering with your white shirt" },
  { id: "down-parka", name: "Ultra light down parka", type: "Outerwear", image: uq450311, link: "https://www.uniqlo.com/us/en/products/E450311-000/00", reason: "The warmest thing you own, without the bulk" },
  { id: "rain-coat", name: "Water-repellent coat", type: "Outerwear", image: uq439695, link: "https://www.uniqlo.com/us/en/products/E439695-000/00", reason: "Blocks wind and drizzle on grey mornings" },
  { id: "coach-jacket", name: "Coach jacket", type: "Outerwear", image: uq445041, link: "https://www.uniqlo.com/us/en/products/E445041-000/00", reason: "Tosses over anything, packs down small" },
  { id: "utility-parka", name: "Cotton blend parka", type: "Outerwear", image: uq474177, link: "https://www.uniqlo.com/us/en/products/E474177-000/00", reason: "Utility pocketing with a soft, broken-in feel" },
  { id: "blazer", name: "Single-breasted blazer", type: "Outerwear", image: uq462738, link: "https://www.uniqlo.com/us/en/products/E462738-000/00", reason: "Sharpens jeans and knits in one move" },
  { id: "blouson", name: "Coated blouson", type: "Outerwear", image: uq487883, link: "https://www.uniqlo.com/us/en/products/E487883-000/00", reason: "A crisp layer with an easy rounded hem" },

  { id: "shirt", name: "Cotton stand-collar shirt", type: "Tops", image: shirt, link: "https://www.uniqlo.com/us/en/products/E448440-000/00", reason: "A clean silhouette, just your style" },
  { id: "knit", name: "Soft crew-neck knit", type: "Tops", image: knit, link: "https://www.uniqlo.com/us/en/women/knitwear", reason: "Soft texture to balance your tailored pieces" },
  { id: "merino-gray", name: "Merino crew-neck sweater", type: "Tops", image: uq428855, link: "https://www.uniqlo.com/us/en/products/E428855-000/00", reason: "Soft merino in a heathered grey" },
  { id: "merino-cardigan-navy", name: "Merino crew-neck cardigan", type: "Tops", image: uq428858, link: "https://www.uniqlo.com/us/en/products/E428858-000/00", reason: "Buttons up neatly over your white shirt" },
  { id: "merino-black", name: "Extra-fine merino sweater", type: "Tops", image: uq443411, link: "https://www.uniqlo.com/us/en/products/E443411-000/00", reason: "A black crew you'll reach for weekly" },
  { id: "merino-long", name: "Merino long-sleeve sweater", type: "Tops", image: uq450509, link: "https://www.uniqlo.com/us/en/products/E450509-001/00", reason: "Fine merino, quiet and polished" },
  { id: "merino-button", name: "Merino button-front cardigan", type: "Tops", image: uq450510, link: "https://www.uniqlo.com/us/en/products/E450510-000/00", reason: "A slim black layer for in-between days" },
  { id: "cashmere-crew", name: "Cashmere crew-neck sweater", type: "Tops", image: uq439162, link: "https://www.uniqlo.com/us/en/products/E439162-000/00", reason: "Pure cashmere for the coldest mornings" },

  { id: "dress", name: "Pleated midi dress", type: "Dresses", image: dress, link: "https://www.uniqlo.com/us/en/women/dresses-and-skirts", reason: "Understated, versatile, and easy to layer" },
  { id: "dress-rayon", name: "Rayon shirt dress", type: "Dresses", image: uq433651, link: "https://www.uniqlo.com/us/en/products/E433651-000/00", reason: "Wrinkle-proof and easy from desk to dinner" },
  { id: "dress-u-shirt", name: "U long-sleeve shirt dress", type: "Dresses", image: uq452138, link: "https://www.uniqlo.com/us/en/products/E452138-000/00", reason: "A mustard pop under a neutral coat" },
  { id: "dress-sleeveless", name: "Stretch sleeveless dress", type: "Dresses", image: uq457012, link: "https://www.uniqlo.com/us/en/products/E457012-000/00", reason: "Sleek lines for warmer days" },
  { id: "dress-flannel", name: "Brushed flannel shirt dress", type: "Dresses", image: uq461514, link: "https://www.uniqlo.com/us/en/products/E461514-000/00", reason: "Brushed flannel with a flare — winter-ready" },
  { id: "dress-mini", name: "Cotton mini dress", type: "Dresses", image: uq464788, link: "https://www.uniqlo.com/us/en/products/E464788-000/00", reason: "An A-line mini that moves with you" },
  { id: "dress-volume", name: "Volume sleeve dress", type: "Dresses", image: uq477526, link: "https://www.uniqlo.com/us/en/products/E477526-000/00", reason: "Sleeves that make the whole outfit" },

  { id: "jeans", name: "Relaxed straight jeans", type: "Bottoms", image: jeans, link: "https://www.uniqlo.com/us/en/women/bottoms/jeans", reason: "Relaxed denim for your off-duty looks" },
  { id: "denim-pants", name: "Denim straight pants", type: "Bottoms", image: uq461665, link: "https://www.uniqlo.com/us/en/products/E461665-000/00", reason: "Garment-dyed denim in a soft sand tone" },
  { id: "denim-skirt", name: "Denim easy skirt", type: "Bottoms", image: uq461664, link: "https://www.uniqlo.com/us/en/products/E461664-000/00", reason: "An easy elastic-waist denim skirt" },
  { id: "pleated-pants", name: "Pleated wide pants", type: "Bottoms", image: uq476945, link: "https://www.uniqlo.com/us/en/products/E476945-000/00", reason: "Tapered pleats that still feel relaxed" },
  { id: "skinny-jeans", name: "Stretch skinny jeans", type: "Bottoms", image: uq445287, link: "https://www.uniqlo.com/us/en/products/E445287-000/00", reason: "Light-wash denim that keeps its shape" },
  { id: "culotte-denim", name: "Soft denim culottes", type: "Bottoms", image: uq437388, link: "https://www.uniqlo.com/us/en/products/E437388-000/00", reason: "Culotte volume, denim ease" },
  { id: "jeans-wide", name: "Wide straight jeans", type: "Bottoms", image: uq480879, link: "https://www.uniqlo.com/us/en/products/E480879-000/00", reason: "Wide, long lines that dress up denim" },

  { id: "sneakers-knit", name: "Knit lace-up sneakers", type: "Shoes", image: uq433775, link: "https://www.uniqlo.com/us/en/products/E433775-000/00", reason: "Featherlight knits for long days out" },
  { id: "sneakers-canvas", name: "Cotton canvas sneakers", type: "Shoes", image: uq434989, link: "https://www.uniqlo.com/us/en/products/E434989-000/00", reason: "Clean canvas for every errand" },
  { id: "flats-pointed", name: "Pointed ballet flats", type: "Shoes", image: uq438876, link: "https://www.uniqlo.com/us/en/products/E438876-000/00", reason: "Pointed flats that still feel cushioned" },
  { id: "sneakers-suede", name: "Faux suede sneakers", type: "Shoes", image: uq442233, link: "https://www.uniqlo.com/us/en/products/E442233-000/00", reason: "Soft suede in a warm beige" },
  { id: "sneakers-u-knit", name: "U knitted sneakers", type: "Shoes", image: uq447450, link: "https://www.uniqlo.com/us/en/products/E447450-000/00", reason: "U-knit comfort, city-ready" },
  { id: "sneakers-leather", name: "Faux leather sneakers", type: "Shoes", image: uq466623, link: "https://www.uniqlo.com/us/en/products/E466623-000/00", reason: "Sleek leather look with a grippy sole" },
  { id: "flats-tstrap", name: "T-strap ballet shoes", type: "Shoes", image: uq479250, link: "https://www.uniqlo.com/us/en/products/E479250-000/00", reason: "A little charm for dressed-up days" },
  { id: "flats-square", name: "Square-toe flats", type: "Shoes", image: uq482815, link: "https://www.uniqlo.com/us/en/products/E482815-000/00", reason: "Square toes, soft steps" },

  { id: "scarf-cashmere", name: "Cashmere scarf", type: "Accessories", image: uq438831, link: "https://www.uniqlo.com/us/en/products/E438831-000/00", reason: "Wide black cashmere, endlessly wearable" },
  { id: "beanie-cashmere", name: "Cashmere knitted beanie", type: "Accessories", image: uq450336, link: "https://www.uniqlo.com/us/en/products/E450336-000/00", reason: "Cashmere ribs for cold ears" },
  { id: "beanie-pompom", name: "Pom-pom beanie", type: "Accessories", image: uq483300, link: "https://www.uniqlo.com/us/en/products/E483300-000/00", reason: "Cable knit with a playful pompom" },
  { id: "hooded-scarf", name: "Hooded scarf", type: "Accessories", image: uq481537, link: "https://www.uniqlo.com/us/en/products/E481537-000/00", reason: "Hood and scarf in one warm piece" },
  { id: "tote-leather", name: "Faux leather boat tote", type: "Accessories", image: uq440022, link: "https://www.uniqlo.com/us/en/products/E440022-000/00", reason: "Structured tote that fits a laptop" },
  { id: "tote-canvas", name: "Canvas tool tote", type: "Accessories", image: uq442432, link: "https://www.uniqlo.com/us/en/products/E442432-000/00", reason: "Water-resistant canvas with room to spare" },
  { id: "bag-utility", name: "2-way utility bag", type: "Accessories", image: uq479880, link: "https://www.uniqlo.com/us/en/products/E479880-000/00", reason: "A padded carryall with a luggage strap" },
  { id: "bag-shoulder", name: "Puffy shoulder bag", type: "Accessories", image: uq483802, link: "https://www.uniqlo.com/us/en/products/E483802-000/00", reason: "A soft puff of a shoulder bag" },
];

const suggestionIds = ["knit", "jeans", "jacket", "dress"];
export const photoSuggestions = suggestionIds
  .map((id) => photoClothes.find((item) => item.id === id))
  .filter((item) => item !== undefined);
export const photoLooks = { jacket: jacketLook, trousers: trouserLook };
