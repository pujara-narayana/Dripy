// Live smoke test for the Gemini brain. Needs GEMINI_API_KEY in .env.local.
//   npm run smoke:gemini
// Checks: (1) structured output incl. nullable fields, (2) a function-call round trip
// with thought signatures echoed back, (3) vision on an image.
import assert from "node:assert/strict";
import sharp from "sharp";
import { z } from "zod";
import { env } from "../src/lib/env";
import { extract, gemini, textOf, THINKING } from "../src/lib/llm";

async function main() {
  assert.ok(env.geminiApiKey, "set GEMINI_API_KEY in .env.local");
  console.log(`model: ${env.model}`);

  // 1. structured output
  let t = Date.now();
  const item = await extract({
    schema: z.object({
      name: z.string(),
      category: z.enum(["outerwear", "top", "bottom", "dress", "shoes", "accessory"]),
      color: z.string(),
      price_usd: z.number().nullable(),
    }),
    system: "Normalize the clothing item. price_usd is null unless a price is stated.",
    parts: [{ text: "a black leather biker jacket" }],
  });
  assert.equal(item.category, "outerwear");
  assert.equal(item.price_usd, null);
  console.log(`✓ structured output (${Date.now() - t} ms)`, item);

  // 2. tool round trip (thought signatures must survive)
  t = Date.now();
  const contents: Parameters<ReturnType<typeof gemini>["models"]["generateContent"]>[0]["contents"] = [
    { role: "user", parts: [{ text: "What jackets do I own? Use the tool." }] },
  ];
  const config = {
    systemInstruction: "You are a wardrobe assistant. Always use tools for wardrobe questions.",
    tools: [{ functionDeclarations: [{ name: "search_wardrobe", description: "Search owned clothes", parametersJsonSchema: { type: "object", properties: { category: { type: "string" } } } }] }],
    thinkingConfig: { thinkingLevel: THINKING.low },
  };
  const first = await gemini().models.generateContent({ model: env.model, contents, config });
  const c1 = first.candidates?.[0]?.content;
  const call = c1?.parts?.find((p) => p.functionCall)?.functionCall;
  assert.ok(call, "expected a function call");
  (contents as unknown[]).push(c1, {
    role: "user",
    parts: [{ functionResponse: { id: call.id, name: call.name, response: { output: '{"items":["Zara Black Bomber Jacket","Levi\'s Denim Jacket"]}' } } }],
  });
  const second = await gemini().models.generateContent({ model: env.model, contents, config });
  const reply = textOf(second.candidates?.[0]?.content);
  assert.ok(/bomber|denim/i.test(reply), `reply should cite the tool result: ${reply}`);
  console.log(`✓ tool round trip (${Date.now() - t} ms): ${reply}`);

  // 3. vision: a solid-color square is "no clothing"
  t = Date.now();
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#3366cc" } }).jpeg().toBuffer();
  const v = await extract({
    schema: z.object({ contains_clothing: z.boolean() }),
    system: "Say whether the image contains clothing.",
    parts: [{ image: { base64: png.toString("base64"), mimeType: "image/jpeg" } }, { text: "Any clothing?" }],
  });
  assert.equal(v.contains_clothing, false);
  console.log(`✓ vision (${Date.now() - t} ms)`);
  console.log("\nGemini smoke test passed");
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
