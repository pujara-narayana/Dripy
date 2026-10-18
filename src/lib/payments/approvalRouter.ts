// Deterministic approval classifier. Runs on the user's own inbound message BEFORE the
// model sees it, and only when an intent is awaiting approval. No LLM is involved, so
// nothing in a screenshot, caption or email can approve a payment.

export type Classification = "AFFIRMATIVE" | "NEGATIVE" | "UNRELATED";

const AFFIRMATIVE =
  /^(yes|yep|yeah|yup|ya|ok|okay|k|confirm(ed)?|do it|buy it|go( ahead)?|approve(d)?|sure|pay( now| it)?|let'?s do it|send it)$/i;
const NEGATIVE = /^(no|nope|nah|cancel( it)?|stop|don'?t|wait|hold on|never ?mind|not now)$/i;
// "yes, but the black one" / "ok actually the other one" is NOT an approval (QA #7).
const CONTRAST = /\b(but|except|instead|actually|other|different|not|rather|wait|cheaper|which)\b/i;
const EMOJI_YES = /^(👍|✅|👌|💳)+$/u;

export function classifyApproval(raw: string | null | undefined): Classification {
  const text = (raw ?? "").trim();
  if (!text) return "UNRELATED";
  if (EMOJI_YES.test(text.replace(/\s|️/g, ""))) return "AFFIRMATIVE";

  // Normalize: lowercase, drop trailing punctuation/emoji, collapse spaces.
  const t = text
    .toLowerCase()
    .replace(/[!.?,👍✅🙌🔥]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.split(" ").length > 6) return "UNRELATED"; // long messages go to the agent
  if (CONTRAST.test(t) && !NEGATIVE.test(t)) return "UNRELATED";

  // Allow polite padding: "yes please", "ok buy it", "yes pay", "yes do it thanks".
  const core = t
    .replace(/\b(please|pls|plz|thanks|thank you|ty|dripy|lol|haha)\b/g, "")
    .replace(/^(ok|okay|yes|yeah|yep|sure)\s+(?=(buy it|do it|go ahead|pay|confirm|send it|let'?s do it))/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (AFFIRMATIVE.test(core)) return "AFFIRMATIVE";
  if (NEGATIVE.test(core)) return "NEGATIVE";
  return "UNRELATED";
}
