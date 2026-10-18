import "server-only";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { SYSTEM_PROMPT, wardrobeBlock } from "@/lib/agent/systemPrompt";
import { runTool, TOOLS, type ToolContext } from "@/lib/agent/tools";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/http";
import { gemini, isBlocked, type LlmPart, textOf, THINKING, toGeminiParts } from "@/lib/llm";
import type { Card, WardrobeItem } from "@/lib/types";

const MAX_ITERATIONS = 6;

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

export interface HistoryMessage {
  direction: "inbound" | "outbound";
  body: string | null;
  cards: Card[];
}

/** Compact, text-only rendering of a past card so the model keeps ids across turns. */
function cardSummary(c: Card): string {
  switch (c.type) {
    case "reel_matches":
      return `[product card: ${c.matches.map((m) => `${m.name} at ${m.merchant_domain ?? m.merchant} ${formatMoney(m.price_cents)} (match_id ${m.id})`).join("; ")}]`;
    case "verdict":
      return `[verdict card: ${c.verdict} for ${c.item.name}${c.match_id ? ` (match_id ${c.match_id})` : ""}]`;
    case "purchase_intent":
      return `[checkout card: ${c.item_name} ${formatMoney(c.amount_cents)} at ${c.merchant_domain}, status ${c.status}]`;
    case "payment_confirmation":
      return `[payment ${c.status}: ${c.item_name} ${formatMoney(c.amount_cents)} (${c.mode})]`;
    case "places":
      return `[donation places card: ${c.places.map((p) => p.name).join(", ")}]`;
    case "outfit":
      return `[outfit card "${c.title}": ${c.items.map((i) => i.name).join(", ")}]`;
    case "weather":
      return `[weather card: ${c.date} ${c.summary}, ${c.high_f}/${c.low_f}F]`;
    default:
      return "";
  }
}

/** Build alternating user/model history (text only), oldest first, starting with user. */
export function historyToContents(history: HistoryMessage[]): Content[] {
  const out: Content[] = [];
  for (const h of history) {
    const role = h.direction === "inbound" ? "user" : "model";
    const text = [h.body ?? "", ...h.cards.map(cardSummary)].filter(Boolean).join("\n").trim() || "(sent an image)";
    const last = out.at(-1);
    if (last && last.role === role) last.parts = [{ text: `${last.parts?.[0]?.text ?? ""}\n${text}` }];
    else out.push({ role, parts: [{ text }] });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export async function runAgent(opts: {
  ctx: ToolContext;
  wardrobe: WardrobeItem[];
  history: HistoryMessage[];
  userParts: LlmPart[];
  serverContext: string;
}): Promise<{ text: string; toolCalls: string[] }> {
  const { ctx } = opts;
  const contents = historyToContents(opts.history);
  let userParts: Part[] = toGeminiParts(opts.userParts);
  // A previous inbound message with no reply (e.g. a failed turn) would leave two user
  // turns in a row; fold it into this one.
  if (contents.at(-1)?.role === "user") userParts = [...(contents.pop()!.parts ?? []), ...userParts];
  contents.push({ role: "user", parts: userParts });

  // Stable prefix first (system prompt, wardrobe) so Gemini's implicit prompt caching can
  // reuse it; the per-turn server context goes last.
  const systemInstruction = `${SYSTEM_PROMPT}\n\n${wardrobeBlock(opts.wardrobe)}\n\n${opts.serverContext}`;

  const toolCalls: string[] = [];
  const texts: string[] = [];
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await gemini().models.generateContent({
      model: env.model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
        // Chat over iMessage is latency-sensitive; low thinking keeps turns snappy.
        thinkingConfig: { thinkingLevel: THINKING.low },
      },
    });

    const candidate = response.candidates?.[0];
    if (isBlocked(candidate?.finishReason, response.promptFeedback?.blockReason)) {
      return { text: "I can't help with that one — want to send me an outfit to look at instead?", toolCalls };
    }
    const turnText = textOf(candidate?.content);
    if (turnText) texts.push(turnText);

    const calls = (candidate?.content?.parts ?? []).filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (calls.length === 0 || !candidate?.content) break;

    // Echo the model turn exactly as received: thought signatures must be returned
    // unchanged for multi-turn function calling.
    contents.push(candidate.content);
    const responses: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      toolCalls.push(name);
      const outcome = await runTool(name, call.args ?? {}, ctx); // sequential: tools mutate state
      responses.push({
        functionResponse: {
          id: call.id,
          name,
          response: outcome.isError ? { error: outcome.content } : { output: outcome.content },
        },
      });
    }
    // All function responses for one model turn go back in a single user turn.
    contents.push({ role: "user", parts: responses });
  }

  // Prefer the final turn's text; earlier preambles ("let me check…") are dropped.
  return { text: texts.at(-1) ?? "", toolCalls };
}
