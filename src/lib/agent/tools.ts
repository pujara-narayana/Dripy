import "server-only";
import { z } from "zod";
import { getUser, listWardrobe } from "@/lib/db/queries";
import { formatMoney, type RequestMeta } from "@/lib/http";
import { createIntent, intentCard, IntentRejected } from "@/lib/payments/intents";
import { buyCheck, BuyCheckError } from "@/lib/pipelines/buyCheck";
import { getForecast } from "@/lib/integrations/weather";
import { findDonationPlaces } from "@/lib/pipelines/donations";
import { analyzeImage, analyzeReelUrl, type Analysis, ReelUnsupportedError } from "@/lib/pipelines/imageAnalysis";
import type { IngestedImage } from "@/lib/storage/ingestImage";
import type { Card, Channel } from "@/lib/types";
import { getSavedCard } from "@/lib/users";

export interface ToolContext {
  userId: string;
  channel: Channel;
  meta: RequestMeta;
  /** Images attached to the current user message, already normalized + uploaded. */
  images: IngestedImage[];
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
      "Identify the clothing in a photo or screenshot the user sent in this message and find similar products to buy, with prices and stores. Use this whenever the user sends an image.",
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
      "Wardrobe-aware verdict (BUY / SKIP / CONSIDER) for a product the user is considering, citing similar items they already own. Pass match_id from a previous analyze result when available; otherwise describe the item.",
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
