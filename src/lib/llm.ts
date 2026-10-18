import "server-only";
import { type Content, GoogleGenAI, type Part, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";

// The AI brain: Google Gemini (agent loop, vision, structured extraction).

let client: GoogleGenAI | null = null;
export function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({
    apiKey: env.geminiApiKey,
    httpOptions: { timeout: 45_000, retryOptions: { attempts: 3, initialDelay: 1 } },
  });
  return client;
}

/** Provider-neutral message parts used across the pipelines. */
export type LlmPart = { text: string } | { image: { base64: string; mimeType: string } };

export function toGeminiParts(parts: LlmPart[]): Part[] {
  return parts.map((p) => ("text" in p ? { text: p.text } : { inlineData: { data: p.image.base64, mimeType: p.image.mimeType } }));
}

export type Thinking = "minimal" | "low" | "medium" | "high";
export const THINKING: Record<Thinking, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Visible text of a model turn (thought parts excluded). */
export function textOf(content: Content | undefined): string {
  return (content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}

const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);
export function isBlocked(finishReason: string | undefined, blockReason: string | undefined): boolean {
  return !!blockReason || (!!finishReason && BLOCKED.has(finishReason));
}

/** JSON Schema for Gemini's responseJsonSchema (drop the $schema meta key). */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _meta, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _meta;
  return rest;
}

/** One structured-output call (receipt parsing, garment identification). */
export async function extract<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  parts: LlmPart[];
  thinking?: Thinking;
}): Promise<z.infer<T>> {
  const response = await gemini().models.generateContent({
    model: env.model,
    contents: [{ role: "user", parts: toGeminiParts(opts.parts) }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchemaOf(opts.schema),
      thinkingConfig: { thinkingLevel: THINKING[opts.thinking ?? "low"] },
    },
  });
  const candidate = response.candidates?.[0];
  if (isBlocked(candidate?.finishReason, response.promptFeedback?.blockReason)) {
    throw new Error("model declined the request");
  }
  const raw = textOf(candidate?.content);
  if (!raw) throw new Error(`empty structured output (finishReason=${candidate?.finishReason})`);
  // Validate: the schema is a request to the model, not a guarantee.
  return opts.schema.parse(JSON.parse(raw)) as z.infer<T>;
}
