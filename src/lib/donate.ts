import "server-only";
import { renderForMessaging } from "@/lib/agent/render";
import { db, must } from "@/lib/db/client";
import { getUser } from "@/lib/db/queries";
import type { RequestMeta } from "@/lib/http";
import { pushToImessage } from "@/lib/notify";
import { findDonationPlaces } from "@/lib/pipelines/donations";
import type { PlacesCard } from "@/lib/types";

// Donate pieces from the website: they leave the closet, and Dripy answers in the chat
// (web history + iMessage) with the nearest donation drop-offs.

export class DonationRejected extends Error {}

export async function donateItems(
  userId: string,
  itemIds: string[],
  where: { lat?: number | null; lng?: number | null },
  meta: RequestMeta,
) {
  const ids = itemIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length) throw new DonationRejected("Pick at least one piece to donate.");
  const items = must(
    await db().from("wardrobe_items").select("id,name,brand").eq("user_id", userId).in("id", ids),
    "load donated items",
  ) as { id: string; name: string; brand: string | null }[];
  if (!items.length) throw new DonationRejected("Those pieces aren't in your closet.");

  const user = await getUser(userId);
  const places = await findDonationPlaces({ lat: where.lat ?? user?.home_lat, lng: where.lng ?? user?.home_lng, kind: "donation_dropoff" }, meta);
  const names = items.map((i) => i.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const nearest = places[0];
  const reply = nearest
    ? `Love that 💛 Your ${list} ${names.length === 1 ? "is" : "are"} out of your closet. The nearest drop-off is ${nearest.name}, ${nearest.distance_km} km away${nearest.hours_today ? ` (${nearest.hours_today} today)` : ""}.${places.length > 1 ? " Here are a few options:" : ""}`
    : `Love that 💛 Your ${list} ${names.length === 1 ? "is" : "are"} out of your closet. I couldn't find a drop-off nearby right now.`;
  const card: PlacesCard = { type: "places", places, nudge: null };

  must(
    await db().from("chat_messages").insert([
      { user_id: userId, channel: "web", direction: "inbound", body: `[donating from the website: ${list}]`, cards: [] },
      { user_id: userId, channel: "web", direction: "outbound", body: reply, cards: [card] },
    ]),
    "save donation messages",
  );
  must(await db().from("wardrobe_items").delete().eq("user_id", userId).in("id", items.map((i) => i.id)), "remove donated items");
  const imessaged = await pushToImessage(userId, renderForMessaging(reply, [card]));
  return { removed: items, places, reply, card, imessaged };
}
