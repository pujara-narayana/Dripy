import { connection, type NextRequest } from "next/server";
import { fail, mockResponse, ok, RequestMeta , fallbackToMock } from "@/lib/http";
import { findDonationPlaces } from "@/lib/pipelines/donations";

const KINDS = ["thrift", "consignment", "donation_dropoff", "recycling"];

// GET /api/donations/nearby?lat=&lng=&kind=&limit= -> DonationsResponse
export async function GET(req: NextRequest) {
  await connection(); // always run at request time (never prerender the mock)
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("donations-nearby", "/api/donations/nearby", mockReason);
  const meta = new RequestMeta();
  try {
    const sp = req.nextUrl.searchParams;
    const lat = sp.get("lat") ? Number(sp.get("lat")) : null;
    const lng = sp.get("lng") ? Number(sp.get("lng")) : null;
    if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) return fail(400, "lat/lng must be numbers");
    const kind = sp.get("kind");
    if (kind && !KINDS.includes(kind)) return fail(400, `kind must be one of ${KINDS.join(", ")}`);
    const places = await findDonationPlaces({ lat, lng, kind, limit: Math.min(Number(sp.get("limit") ?? 5) || 5, 20) }, meta);
    return ok({ places, card: { type: "places", places, nudge: null } }, meta, "/api/donations/nearby", { count: places.length });
  } catch (err) {
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "donations failed");
  }
}
