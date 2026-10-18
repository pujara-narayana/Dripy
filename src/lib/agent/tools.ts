import "server-only";
import { z } from "zod";
import { getUser, listWardrobe } from "@/lib/db/queries";
import { formatMoney, type RequestMeta } from "@/lib/http";
import { createIntent, intentCard, IntentRejected } from "@/lib/payments/intents";
import { buyCheck, BuyCheckError } from "@/lib/pipelines/buyCheck";
import { getForecast } from "@/lib/integrations/weather";
import { findDonationPlaces } from "@/lib/pipelines/donations";
import { addPhotoToWardrobe, lastSentPhotoUrl } from "@/lib/pipelines/closetPhoto";
import { analyzeImage, analyzeReelUrl, type Analysis, ReelUnsupportedError, searchProducts } from "@/lib/pipelines/imageAnalysis";
import { fetchImage, type IngestedImage } from "@/lib/storage/ingestImage";
import type { Card, Channel } from "@/lib/types";
import { getSavedCard } from "@/lib/users";

export interface ToolContext {
  userId: string;
  channel: Channel;
  meta: RequestMeta;
  /** Images attached to the current user message, already normalized + uploaded. */
  images: IngestedImage[];
  /** The user's message text this turn (hints which garment a closet photo means). */
  userText?: string;
  lat?: number | null;
  lng?: number | null;
  cards: Card[];
}

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the arguments (sent to Gemini as parametersJsonSchema). */
  input_schema: Record<string, unknown>;
}

// NOTE: there is deliberately no "execute/approve payment" tool. Payment approval is
// handled server-side from the user's own reply (see payments/approvalRouter.ts).
export const TOOLS: ToolDef[] = [
  {
    name: "search_wardrobe",
    description:
      "Search the user's owned wardrobe. Filters are optional and combine with AND. Returns matching items with ids.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "free text, e.g. 'black jacket'" },
        category: { type: "string", enum: ["outerwear", "top", "bottom", "dress", "shoes", "accessory"] },
        occasion: { type: "string", description: "e.g. casual, smart-casual, formal, going-out" },
        brand: { type: "string" },
      },
    },
  },
  {
    name: "build_outfit",
    description:
      "Show the user an outfit card built only from items they own. Pick 3-5 item ids from their wardrobe that work together for the occasion.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "e.g. 'Rooftop dinner, Friday'" },
        item_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
        note: { type: "string", description: "one short styling tip" },
      },
      required: ["title", "item_ids"],
    },
  },
  {
    name: "analyze_image",
    description:
      "Identify the clothing in a photo or screenshot the user sent in this message and find similar products to buy, with prices and stores. Use this when the user sends an image of something they want or are curious about. NOT for things they already own (use add_to_wardrobe).",
    input_schema: {
      type: "object",
      properties: {
        image_index: {
          type: "integer",
          description: "Which attached image (0 = first). Defaults to 0.",
          minimum: 0,
        },
      },
    },
  },
  {
    name: "search_products",
    description:
      "Find products to buy from a text description alone (no image needed), e.g. 'a white trench coat for men under $300'. Returns real store listings with prices and links, shown as a product card; each has a match_id for buy_check and create_purchase_intent.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "shopping query, e.g. \"men's white trench coat\"; include gender, color, material and style the user gave" },
        category: { type: "string", enum: ["outerwear", "top", "bottom", "dress", "shoes", "accessory"] },
        subcategory: { type: "string", description: "e.g. trench coat, jeans, sneakers" },
        color: { type: "string", description: "one basic color word, if the user gave one" },
        occasion: { type: "string", enum: ["casual", "smart-casual", "formal", "athletic", "going-out", "outdoor"] },
        max_price_usd: { type: "number", description: "budget ceiling, if the user gave one" },
        min_price_usd: { type: "number" },
        gender: { type: "string", enum: ["male", "female"], description: "only if the user said men's/women's" },
      },
      required: ["query", "category"],
    },
  },
  {
    name: "add_to_wardrobe",
    description:
      "Add clothes the user ALREADY OWNS to their wardrobe from a photo (\"I have this\", \"add this to my closet\"). Uses the image in this message, or the last photo they sent if this message has none. Does not search for products.",
    input_schema: {
      type: "object",
      properties: {
        image_index: { type: "integer", minimum: 0, description: "Which attached image (0 = first). Defaults to 0." },
        which: { type: "string", description: "which garment(s) they mean, in their words, e.g. 'the denim jacket' or 'all of them'" },
      },
    },
  },
  {
    name: "analyze_reel",
    description:
      "When the user sends a TikTok or Instagram Reels LINK (not an image), grab a frame and find the clothes in it. Prefer analyze_image when they sent an actual image.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "buy_check",
    description:
      "Wardrobe-aware verdict (BUY / SKIP / CONSIDER) for a product, citing similar items they already own. ONLY when the user asks for your opinion on buying it (\"should I buy this?\", \"is it worth it?\", \"do I need it?\"). Never after a plain search, a photo, or \"buy it\". Pass match_id from a previous result when available; otherwise describe the item.",
    input_schema: {
      type: "object",
      properties: {
        match_id: { type: "string" },
        item_desc: { type: "string", description: "free-text description incl. price if known" },
      },
    },
  },
  {
    name: "create_purchase_intent",
    description:
      "Prepare a Visa checkout for a matched product the user explicitly asked to buy. Does NOT pay: the user must reply YES. Pass the match_id of the product the user chose; omit it only when exactly one product is under discussion.",
    input_schema: {
      type: "object",
      properties: { match_id: { type: "string" } },
    },
  },
  {
    name: "find_donation_places",
    description: "Find nearby places to donate or resell clothes: thrift stores, consignment shops, donation drop-offs.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["thrift", "consignment", "donation_dropoff", "recycling"] },
      },
    },
  },
  {
    name: "get_weather",
    description:
      "Local forecast for a day in the next week (high/low °F, rain chance). Call it before build_outfit when the user asks what to wear on a specific day, so the outfit fits the weather.",
    input_schema: {
      type: "object",
      properties: {
        day: { type: "string", description: "'today', 'tomorrow', a weekday like 'friday', or YYYY-MM-DD. Defaults to today." },
      },
    },
  },
];

const str = z.string().trim().min(1).max(200);
const Schemas = {
  search_wardrobe: z.object({ query: str.optional(), category: str.optional(), occasion: str.optional(), brand: str.optional() }),
  build_outfit: z.object({ title: str, item_ids: z.array(z.string()).min(1).max(8), note: z.string().max(300).optional() }),
  analyze_image: z.object({ image_index: z.number().int().min(0).optional() }),
  analyze_reel: z.object({ url: z.string().url() }),
  search_products: z.object({
    query: str,
    category: z.enum(["outerwear", "top", "bottom", "dress", "shoes", "accessory"]),
    subcategory: str.optional(),
    color: str.optional(),
    occasion: z.enum(["casual", "smart-casual", "formal", "athletic", "going-out", "outdoor"]).optional(),
    max_price_usd: z.number().positive().max(100_000).optional(),
    min_price_usd: z.number().min(0).max(100_000).optional(),
    gender: z.enum(["male", "female"]).optional(),
  }),
  add_to_wardrobe: z.object({ image_index: z.number().int().min(0).optional(), which: z.string().max(300).optional() }),
  buy_check: z.object({ match_id: z.string().optional(), item_desc: z.string().max(500).optional() }),
  create_purchase_intent: z.object({ match_id: z.string().optional() }),
  find_donation_places: z.object({ kind: z.enum(["thrift", "consignment", "donation_dropoff", "recycling"]).optional() }),
  get_weather: z.object({ day: z.string().max(20).optional() }),
};

export interface ToolOutcome {
  content: string; // what the model sees (JSON text with ids)
  isError?: boolean;
}

function analysisForModel(a: Analysis) {
  if (a.identified.length === 0) {
    return { found_clothing: false, note: "No clothing found in the image. Ask the user for a clearer shot of the outfit." };
  }
  return {
    analysis_id: a.analysis_id,
    cached: a.cached,
    identified: a.identified,
    matches: a.matches.map((m) => ({
      match_id: m.id,
      name: m.name,
      store: m.merchant_domain ?? m.merchant,
      price: formatMoney(m.price_cents, m.currency),
      link: m.url,
    })),
    note: a.matches.length
      ? "Shown to the user as a product card. The first match is now the product under discussion."
      : "Identified the clothes but couldn't find shoppable matches right now (product search unavailable).",
  };
}

export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const schema = Schemas[name as keyof typeof Schemas];
  if (!schema) return { content: `Unknown tool ${name}`, isError: true };
  const parsed = schema.safeParse(rawInput ?? {});
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.message}`, isError: true };
  const input = parsed.data as Record<string, unknown>;

  try {
    switch (name) {
      case "search_wardrobe": {
        const { query, category, occasion, brand } = input as z.infer<typeof Schemas.search_wardrobe>;
        let items = await listWardrobe(ctx.userId, { category, occasion, brand });
        if (query) {
          const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
          items = items.filter((i) => {
            const hay = `${i.name} ${i.brand} ${i.category} ${i.subcategory} ${i.color} ${i.occasion_tags.join(" ")}`.toLowerCase();
            return words.some((w) => hay.includes(w.replace(/s$/, "")));
          });
        }
        return {
          content: JSON.stringify({
            count: items.length,
            items: items.slice(0, 25).map((i) => ({
              id: i.id,
              name: i.brand ? `${i.brand} ${i.name}` : i.name,
              category: i.category,
              color: i.color,
              occasions: i.occasion_tags,
              times_worn: i.times_worn,
            })),
          }),
        };
      }

      case "build_outfit": {
        const { title, item_ids, note } = input as z.infer<typeof Schemas.build_outfit>;
        const owned = new Map((await listWardrobe(ctx.userId)).map((i) => [i.id, i]));
        const items = item_ids.map((id) => owned.get(id)).filter((i) => i != null);
        if (items.length < 2) return { content: "Those item ids aren't in the user's wardrobe. Use ids from the wardrobe list.", isError: true };
        ctx.cards.push({
          type: "outfit",
          title,
          note,
          items: items.map((i) => ({ id: i.id, name: i.name, brand: i.brand, category: i.category, image_url: i.image_url })),
        });
        return { content: JSON.stringify({ shown: items.map((i) => i.name), rejected_ids: item_ids.filter((id) => !owned.has(id)) }) };
      }

      case "analyze_image": {
        const idx = (input.image_index as number | undefined) ?? 0;
        const image = ctx.images[idx] ?? ctx.images[0];
        if (!image) return { content: "The user didn't attach an image in this message. Ask them to send a screenshot.", isError: true };
        const a = await analyzeImage(ctx.userId, image, ctx.meta);
        if (a.identified.length) ctx.cards.push(a.card);
        return { content: JSON.stringify(analysisForModel(a)) };
      }

      case "search_products": {
        const q = input as z.infer<typeof Schemas.search_products>;
        const a = await searchProducts(
          ctx.userId,
          {
            query: q.query,
            category: q.category,
            subcategory: q.subcategory ?? null,
            color: q.color ?? null,
            occasion_tags: q.occasion ? [q.occasion] : [],
            max_price_usd: q.max_price_usd ?? null,
            min_price_usd: q.min_price_usd ?? null,
            gender: q.gender ?? null,
          },
          ctx.meta,
        );
        if (a.matches.length) ctx.cards.push(a.card);
        const out = analysisForModel(a);
        return {
          content: JSON.stringify(
            a.matches.length ? out : { ...out, note: "No listings matched that search (and budget). Say so and suggest loosening it." },
          ),
        };
      }

      case "add_to_wardrobe": {
        const { image_index, which } = input as z.infer<typeof Schemas.add_to_wardrobe>;
        let image: { bytes: Buffer; publicUrl: string } | undefined = ctx.images[image_index ?? 0] ?? ctx.images[0];
        if (!image) {
          const url = await lastSentPhotoUrl(ctx.userId);
          if (!url) return { content: "No photo to add. Ask the user to send a photo of the piece they own.", isError: true };
          image = { bytes: (await fetchImage(url)).bytes, publicUrl: url };
        }
        const items = await addPhotoToWardrobe(ctx.userId, image, which ?? ctx.userText ?? "");
        if (!items.length) return { content: JSON.stringify({ added: [], note: "No clothing found in that photo. Ask for a clearer shot." }) };
        return {
          content: JSON.stringify({
            added: items.map((i) => ({ id: i.id, name: i.brand ? `${i.brand} ${i.name}` : i.name, category: i.category, color: i.color })),
            note: "Saved to the user's wardrobe with their photo. Confirm in a few words; no verdict or shopping unless asked.",
          }),
        };
      }

      case "analyze_reel": {
        const a = await analyzeReelUrl(ctx.userId, input.url as string, ctx.meta);
        if (a.identified.length) ctx.cards.push(a.card);
        return { content: JSON.stringify(analysisForModel(a)) };
      }

      case "buy_check": {
        const user = await getUser(ctx.userId);
        const matchId = (input.match_id as string | undefined) ?? (input.item_desc ? undefined : user?.current_match_id ?? undefined);
        const card = await buyCheck(ctx.userId, { matchId, itemDesc: input.item_desc as string | undefined }, ctx.meta);
        ctx.cards.push(card);
        return {
          content: JSON.stringify({
            verdict: card.verdict,
            headline: card.headline,
            reasons: card.reasons,
            owned_items_cited: card.dupes.map((d) => d.name),
            match_id: card.match_id,
          }),
        };
      }

      case "create_purchase_intent": {
        const user = await getUser(ctx.userId);
        const matchId = (input.match_id as string | undefined) ?? user?.current_match_id;
        if (!matchId) return { content: "No product is under discussion. Ask which item they want.", isError: true };
        const intent = await createIntent(ctx.userId, matchId);
        const card = intentCard(intent, await getSavedCard(ctx.userId));
        ctx.cards.push(card);
        return {
          content: JSON.stringify({
            status: intent.status,
            item: intent.item_name,
            amount: formatMoney(intent.amount_cents, intent.currency),
            store: intent.merchant_domain,
            link: intent.merchant_url,
            payment_mode: intent.mode,
            tell_user: card.prompt,
          }),
        };
      }

      case "find_donation_places": {
        const user = await getUser(ctx.userId);
        const places = await findDonationPlaces(
          { lat: ctx.lat ?? user?.home_lat, lng: ctx.lng ?? user?.home_lng, kind: input.kind as string | undefined },
          ctx.meta,
        );
        ctx.cards.push({ type: "places", places, nudge: null });
        return {
          content: JSON.stringify({
            count: places.length,
            places: places.map((p) => ({ name: p.name, km: p.distance_km, open_now: p.open_now, kind: p.kind })),
          }),
        };
      }

      case "get_weather": {
        const user = await getUser(ctx.userId);
        const card = await getForecast(
          { lat: ctx.lat ?? user?.home_lat, lng: ctx.lng ?? user?.home_lng, day: input.day as string | undefined },
          ctx.meta,
        );
        if (!card) return { content: "Forecast unavailable for that day (only the next 7 days are known). Pick an outfit without it and say so briefly.", isError: true };
        ctx.cards.push(card);
        return { content: JSON.stringify(card) };
      }
    }
    return { content: `Unhandled tool ${name}`, isError: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Expected, user-facing refusals are returned as normal results the model can relay.
    if (err instanceof IntentRejected || err instanceof ReelUnsupportedError || err instanceof BuyCheckError) {
      return { content: JSON.stringify({ ok: false, message }), isError: true };
    }
    console.error(`tool ${name} failed`, err);
    return { content: `Tool failed: ${message}. Tell the user briefly and offer an alternative; do not invent results.`, isError: true };
  }
}
