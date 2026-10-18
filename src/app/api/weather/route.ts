import { connection, type NextRequest } from "next/server";
import { fail, ok, RequestMeta } from "@/lib/http";
import { getForecast } from "@/lib/integrations/weather";

// GET /api/weather?lat=&lng=&date= -> {card: WeatherCard}
// date: YYYY-MM-DD, "today", "tomorrow" or a weekday; defaults to today. No DB, so no mock.
export async function GET(req: NextRequest) {
  await connection();
  const meta = new RequestMeta();
  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat") ? Number(sp.get("lat")) : null;
  const lng = sp.get("lng") ? Number(sp.get("lng")) : null;
  if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) return fail(400, "lat/lng must be numbers");
  const card = await getForecast({ lat, lng, day: sp.get("date") ?? undefined }, meta);
  if (!card) {
    return meta.toMeta().fallback_used
      ? fail(503, "forecast service unavailable", { fallback_used: true })
      : fail(400, "no forecast for that date (only the next 7 days)");
  }
  return ok({ card }, meta, "/api/weather", { date: card.date });
}
