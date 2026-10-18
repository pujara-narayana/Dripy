import "server-only";
import { createHmac } from "node:crypto";
import { starterCloset, BRAND } from "@/data/catalog";
import { db, must } from "@/lib/db/client";
import { env } from "@/lib/env";

// Web accounts for the demo: sign up with name, email and phone (no password). The phone
// links the account to iMessage; a start code in the first text covers senders whose
// iMessage id isn't that phone number (an Apple ID email, a different format).

export interface AccountRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
}

export class SignupRejected extends Error {}

/** E.164 for US-style input ("(206) 555-0123" -> "+12065550123"); null if it isn't a phone number. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findByPhone(phone: string): Promise<AccountRow | null> {
  return must(await db().from("users").select("id,name,email,phone").eq("phone", phone).maybeSingle(), "find user by phone") as AccountRow | null;
}

/** Create the account (or return the existing one for this phone) and give it a starter closet. */
export async function signUp(input: { name: string; email: string; phone: string }): Promise<{ user: AccountRow; created: boolean }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  if (!name) throw new SignupRejected("Tell us your name.");
  if (!EMAIL_RE.test(email)) throw new SignupRejected("That email doesn't look right.");
  if (!phone) throw new SignupRejected("Enter a phone number with area code, e.g. (206) 555-0123.");

  const existing = await findByPhone(phone);
  if (existing) return { user: existing, created: false };

  const user = must(
    await db()
      .from("users")
      .insert({ name, email, phone, home_lat: env.demoLat, home_lng: env.demoLng })
      .select("id,name,email,phone")
      .single(),
    "create user",
  ) as AccountRow;
  // "Parsed from your Gmail": every new account starts with the demo closet (see src/data/catalog.ts).
  must(
    await db()
      .from("wardrobe_items")
      .insert(
        starterCloset.map((item, i) => ({
          user_id: user.id,
          name: item.name,
          brand: BRAND,
          category: item.category,
          color: item.color,
          price_cents: item.priceCents,
          currency: "USD",
          source: "seed",
          occasion_tags: [],
          image_url: item.image,
          // A believable spread of wear counts, so stats and "never worn" nudges have something to say.
          times_worn: (i * 7) % 19,
        })),
      ),
    "add starter closet",
  );
  return { user, created: true };
}

export async function logIn(phoneInput: string): Promise<AccountRow> {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new SignupRejected("Enter the phone number you signed up with.");
  const user = await findByPhone(phone);
  if (!user) throw new SignupRejected("No account with that number yet. Sign up first.");
  return user;
}

export async function getAccount(userId: string): Promise<AccountRow | null> {
  return must(await db().from("users").select("id,name,email,phone").eq("id", userId).maybeSingle(), "load account") as AccountRow | null;
}

// ---- demo card on file (migration 0003) ------------------------------------------------

export interface SavedCard {
  brand: string;
  last4: string;
}

export async function getSavedCard(userId: string): Promise<SavedCard | null> {
  const res = await db().from("users").select("card_brand,card_last4").eq("id", userId).maybeSingle();
  if (res.error) {
    // Migration 0003 not applied yet: behave as "no card", so checkout asks for one.
    console.warn("saved card lookup failed (run supabase/migrations/0003_demo_card.sql)", res.error.message);
    return null;
  }
  const row = res.data as { card_brand: string | null; card_last4: string | null } | null;
  return row?.card_brand && row.card_last4 ? { brand: row.card_brand, last4: row.card_last4 } : null;
}

export async function saveCard(userId: string, card: SavedCard) {
  must(
    await db().from("users").update({ card_brand: card.brand, card_last4: card.last4 }).eq("id", userId),
    "save card (run supabase/migrations/0003_demo_card.sql if this fails)",
  );
}

// ---- iMessage start code -------------------------------------------------------------------

/** Six characters that tie someone's first iMessage to their web account. */
export function startCode(userId: string): string {
  return createHmac("sha256", env.sessionSecret).update(`start:${userId}`).digest("hex").slice(0, 6).toUpperCase();
}

/** The first text the web app pre-fills in iMessage. */
export function startMessage(userId: string): string {
  return `Hi Dripy! My code is ${startCode(userId)}`;
}

/** Find a recent account by the start code in a message, e.g. "Hi Dripy! My code is 3FA21C". */
export async function findByStartCode(text: string): Promise<AccountRow | null> {
  const code = text.toUpperCase().match(/\bCODE(?: IS)?:?\s*([0-9A-F]{6})\b/)?.[1];
  if (!code) return null;
  const recent = must(
    await db().from("users").select("id,name,email,phone").order("created_at", { ascending: false }).limit(500),
    "load recent users",
  ) as AccountRow[];
  return recent.find((u) => startCode(u.id) === code) ?? null;
}

/**
 * Point the account at the phone number it texted from (it may differ in format from the
 * signup number), unless another account has it. Apple ID (email) senders aren't stored:
 * log-in is by phone, so those later messages fall back to the demo user.
 */
export async function linkSender(userId: string, sender: string) {
  if (!/^\+\d{8,15}$/.test(sender)) return;
  const owner = await findByPhone(sender);
  if (owner && owner.id !== userId) return;
  must(await db().from("users").update({ phone: sender }).eq("id", userId), "link iMessage sender");
}
