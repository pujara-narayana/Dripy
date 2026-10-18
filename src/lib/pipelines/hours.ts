// Pure geo/opening-hours helpers (no I/O), shared by the donation finder and tests.

export type Hours = Partial<Record<Day, [string, string][]>>;
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const OSM_DAYS: Record<string, Day> = { Mo: "mon", Tu: "tue", We: "wed", Th: "thu", Fr: "fri", Sa: "sat", Su: "sun" };
const OSM_ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Current weekday and HH:MM in Seattle, DST-aware. */
export function seattleNow(at = new Date()): { day: Day; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").slice(0, 3).toLowerCase() as Day;
  return { day: DAYS.includes(day) ? day : "mon", hhmm: `${get("hour")}:${get("minute")}` };
}

export function openNow(hours: Hours, at = new Date()): { open: boolean | null; today: string | null } {
  if (!hours || Object.keys(hours).length === 0) return { open: null, today: null };
  const { day, hhmm } = seattleNow(at);
  const spans = hours[day] ?? [];
  if (spans.length === 0) return { open: false, today: "Closed today" };
  return {
    open: spans.some(([o, c]) => hhmm >= o && hhmm < c),
    today: spans.map(([o, c]) => `${o}–${c}`).join(", "),
  };
}

/** Minimal OSM opening_hours parser: "Mo-Sa 10:00-20:00; Su 11:00-19:00". Unknown -> {}. */
export function parseOsmHours(spec: string | undefined): Hours {
  if (!spec) return {};
  if (spec.trim() === "24/7") return Object.fromEntries(DAYS.map((d) => [d, [["00:00", "23:59"]]])) as Hours;
  const out: Hours = {};
  for (const rule of spec.split(";").map((s) => s.trim()).filter(Boolean)) {
    const m = /^([A-Za-z,\- ]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(rule);
    if (!m) continue;
    for (const part of m[1].split(",").map((p) => p.trim())) {
      const [a, b] = part.split("-").map((p) => p.trim());
      const i = OSM_ORDER.indexOf(a);
      const j = b ? OSM_ORDER.indexOf(b) : i;
      if (i < 0 || j < 0) continue;
      for (let k = i; k <= j; k++) out[OSM_DAYS[OSM_ORDER[k]]] = [[m[2], m[3]]];
    }
  }
  return out;
}
