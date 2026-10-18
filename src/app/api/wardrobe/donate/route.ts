import { DonationRejected, donateItems } from "@/lib/donate";
import { fail, fallbackToMock, ok, readJson, RequestMeta, requestUserId } from "@/lib/http";

// POST /api/wardrobe/donate {item_ids[], lat?, lng?} -> {removed[], places[], reply, card}.
// Removes the pieces from the closet and posts the nearest drop-offs to the chat (web + iMessage).
export async function POST(req: Request) {
  if (fallbackToMock()) return fail(503, "Donating needs the database.");
  const meta = new RequestMeta();
  try {
    const body = await readJson(req);
    const ids = Array.isArray(body.item_ids) ? body.item_ids.filter((x): x is string => typeof x === "string") : [];
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const result = await donateItems(requestUserId(req, body.user_id), ids, { lat: num(body.lat), lng: num(body.lng) }, meta);
    return ok(result, meta, "/api/wardrobe/donate", { removed: result.removed.length });
  } catch (err) {
    if (err instanceof DonationRejected) return fail(422, err.message);
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "donation failed");
  }
}
