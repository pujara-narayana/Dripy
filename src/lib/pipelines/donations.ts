import "server-only";
import { db, must } from "@/lib/db/client";
import { env, isForced } from "@/lib/env";
import type { RequestMeta } from "@/lib/http";
import { type Hours, haversineKm, openNow, parseOsmHours } from "@/lib/pipelines/hours";
import type { Place } from "@/lib/types";

interface PlaceRow {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  kind: string;
  hours_json: Hours;
  maps_url: string | null;
}

async function overpassPlaces(lat: number, lng: number, radiusM: number, meta: RequestMeta): Promise<PlaceRow[]> {
  if (isForced("overpass")) {
    meta.fallback("overpass");
    return [];
  }
  const around = `(around:${radiusM},${lat},${lng})`;
  const query = `[out:json][timeout:8];(nwr["shop"="charity"]${around};nwr["shop"="second_hand"]${around};nwr["amenity"="recycling"]["recycling:clothes"="yes"]${around};);out center tags 40;`;
  try {
    const res = await fetch(env.overpassUrl, {
      method: "POST",
      // Overpass's usage policy rejects requests without an identifying User-Agent.
      headers: { "user-agent": "Dripy/0.1 (DubHacks 2026 hackathon project)", accept: "application/json" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    const body = (await res.json()) as {
      elements: { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
    };
    return body.elements
      .filter((e) => e.tags?.name)
      .map((e) => {
        const t = e.tags!;
        const plat = e.lat ?? e.center?.lat ?? lat;
        const plng = e.lon ?? e.center?.lon ?? lng;
        const address = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || null;
        return {
          id: `osm-${e.id}`,
          name: t.name,
          address: address ? `${address}${t["addr:city"] ? `, ${t["addr:city"]}` : ""}` : null,
          lat: plat,
          lng: plng,
          kind: t.amenity === "recycling" ? "recycling" : t.shop === "charity" ? "donation_dropoff" : "thrift",
          hours_json: parseOsmHours(t.opening_hours),
          maps_url: `https://www.google.com/maps/search/?api=1&query=${plat},${plng}`,
        };
      });
  } catch (err) {
    console.error("overpass failed", err);
    meta.fallback("overpass");
    return [];
  }
}

type GeoapifyPlace = {
  place_id: string;
  name?: string;
  formatted?: string;
  lat: number;
  lon: number;
  opening_hours?: string;
  datasource?: { raw?: Record<string, string | number> };
};

/** Geoapify Places (OSM data, free tier). Returns null when unconfigured or failing, so the caller uses Overpass. */
export async function geoapifyPlaces(lat: number, lng: number, radiusM: number, meta: RequestMeta): Promise<PlaceRow[] | null> {
  if (isForced("geoapify")) return null;
  const url = new URL("https://api.geoapify.com/v2/places");
  url.search = new URLSearchParams({
    // OSM shop=second_hand. Charity chains (Goodwill etc.) sit only under the generic
    // "commercial" category, where a name search takes ~8 s; the seeded list covers them.
    categories: "commercial.second_hand",
    filter: `circle:${lng},${lat},${radiusM}`,
    bias: `proximity:${lng},${lat}`,
    limit: "20",
    apiKey: env.geoapifyKey!,
  }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) throw new Error(`geoapify ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { features?: { properties: GeoapifyPlace }[] };
    return (body.features ?? [])
      .map((f) => f.properties)
      .filter((p) => p.name)
      .map((p) => ({
        id: `geoapify-${p.place_id}`,
        name: p.name!,
        address: p.formatted ?? null,
        lat: p.lat,
        lng: p.lon,
        kind: /consignment/i.test(p.name!) ? "consignment" : "thrift",
        hours_json: parseOsmHours(p.opening_hours ?? (p.datasource?.raw?.opening_hours as string | undefined)),
        maps_url: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`,
      }));
  } catch (err) {
    console.error("geoapify failed", err);
    meta.fallback("geoapify");
    return null;
  }
}

/**
 * Nearby thrift / consignment / donation drop-offs. The seeded Seattle list is always
 * included (so the demo never depends on a live source); Geoapify results are merged in,
 * or OSM via Overpass when Geoapify is unconfigured or down.
 */
export async function findDonationPlaces(
  opts: { lat?: number | null; lng?: number | null; kind?: string | null; limit?: number },
  meta: RequestMeta,
): Promise<Place[]> {
  const lat = opts.lat ?? env.demoLat;
  const lng = opts.lng ?? env.demoLng;
  const seeded = must(await db().from("donation_places").select("*"), "load donation places") as PlaceRow[];
  const live = (await geoapifyPlaces(lat, lng, 5000, meta)) ?? (await overpassPlaces(lat, lng, 5000, meta));

  // De-dupe live entries that are the same store as a seeded one (same name prefix, <300 m).
  const merged = [...seeded];
  for (const p of live) {
    const dup = merged.some(
      (s) => s.name.toLowerCase().slice(0, 8) === p.name.toLowerCase().slice(0, 8) && haversineKm(s.lat, s.lng, p.lat, p.lng) < 0.3,
    );
    if (!dup) merged.push(p);
  }

  const places = merged
    .filter((p) => !opts.kind || p.kind === opts.kind)
    .map((p) => {
      const h = openNow(p.hours_json);
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        kind: p.kind,
        distance_km: Math.round(haversineKm(lat, lng, p.lat, p.lng) * 10) / 10,
        open_now: h.open,
        hours_today: h.today,
        maps_url: p.maps_url,
      } satisfies Place;
    })
    .filter((p) => p.distance_km <= 15)
    // Open places first, then ones with known hours, then unknown hours; nearest within each.
    .sort((a, b) => rank(a) - rank(b) || a.distance_km - b.distance_km);

  return places.slice(0, opts.limit ?? 5);
}

function rank(p: Place) {
  return p.open_now === true ? 0 : p.open_now === false ? 1 : 2;
}
