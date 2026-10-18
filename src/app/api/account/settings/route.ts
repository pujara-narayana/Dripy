import { connection, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { fail, fallbackToMock, readJson } from "@/lib/http";
import { sessionUserFromCookieHeader } from "@/lib/tokens";
import { getProfile, isGender, updateProfile } from "@/lib/users";

// The signed-in user's settings: which closet/shop they get and how much the agent may spend.
// GET  -> {gender, spend_limit_cents (null = the cap), max_spend_limit_cents}
// POST {gender?, spend_limit_cents?: number | null} -> the same, after saving.

async function settings(userId: string) {
  const profile = await getProfile(userId);
  return { gender: profile.gender, spend_limit_cents: profile.spendLimitCents, max_spend_limit_cents: env.purchaseCapCents };
}

function signedInUser(req: Request): string | null {
  return sessionUserFromCookieHeader(req.headers.get("cookie"));
}

export async function GET(req: Request) {
  await connection();
  const userId = signedInUser(req);
  if (!userId) return fail(401, "not signed in");
  if (fallbackToMock()) return fail(503, "Settings need the database.");
  return NextResponse.json(await settings(userId));
}

export async function POST(req: Request) {
  const userId = signedInUser(req);
  if (!userId) return fail(401, "not signed in");
  if (fallbackToMock()) return fail(503, "Settings need the database.");
  const body = await readJson(req);
  const patch: Parameters<typeof updateProfile>[1] = {};
  if (body.gender !== undefined) {
    if (!isGender(body.gender)) return fail(422, "gender must be women or men");
    patch.gender = body.gender;
  }
  if (body.spend_limit_cents !== undefined) {
    const cents = body.spend_limit_cents;
    if (cents !== null && !(Number.isInteger(cents) && (cents as number) >= 100 && (cents as number) <= env.purchaseCapCents)) {
      return fail(422, `The limit has to be between $1 and $${env.purchaseCapCents / 100}.`);
    }
    patch.spendLimitCents = cents as number | null;
  }
  try {
    await updateProfile(userId, patch);
    return NextResponse.json(await settings(userId));
  } catch (err) {
    console.error(err);
    return fail(500, "Couldn't save your settings. Try again in a moment.");
  }
}
