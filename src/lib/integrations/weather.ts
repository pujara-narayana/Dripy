import "server-only";
import { env, isForced } from "@/lib/env";
import type { RequestMeta } from "@/lib/http";
import type { WeatherCard } from "@/lib/types";

// Open-Meteo daily forecast: free, no API key. Used for weather-aware outfit picks.

const TZ = "America/Los_Angeles";
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** WMO weather code -> short words. https://open-meteo.com/en/docs (WMO Weather interpretation codes) */
export function describeWeatherCode(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorms";
}

/** "today" | "tomorrow" | weekday name ("saturday", "sat") | YYYY-MM-DD -> one of `dates`, or null. */
export function resolveDay(day: string | undefined, dates: string[]): string | null {
  const d = (day ?? "today").trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return dates.includes(d) ? d : null;
  if (d === "today") return dates[0] ?? null;
  if (d === "tomorrow") return dates[1] ?? null;
  const idx = WEEKDAYS.indexOf(d.slice(0, 3));
  if (idx < 0) return null;
  // dates[0] is today in Seattle; the next date with that weekday (today counts).
  return dates.find((x) => new Date(`${x}T12:00:00Z`).getUTCDay() === idx) ?? null;
}

export async function getForecast(
  opts: { lat?: number | null; lng?: number | null; day?: string },
  meta: RequestMeta,
): Promise<WeatherCard | null> {
  if (isForced("weather")) {
    meta.fallback("weather");
    return null;
  }
  const lat = opts.lat ?? env.demoLat;
  const lng = opts.lng ?? env.demoLng;
  const url = new URL(env.openMeteoUrl);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone: TZ,
    forecast_days: "7",
  }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const body = (await res.json()) as {
      daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: (number | null)[];
      };
    };
    const daily = body.daily;
    const date = resolveDay(opts.day, daily.time);
    if (!date) return null;
    const i = daily.time.indexOf(date);
    return {
      type: "weather",
      date,
      label: date === daily.time[0] ? "Today" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      summary: describeWeatherCode(daily.weather_code[i]),
      high_f: Math.round(daily.temperature_2m_max[i]),
      low_f: Math.round(daily.temperature_2m_min[i]),
      precip_chance: daily.precipitation_probability_max[i] ?? null,
    };
  } catch (err) {
    console.error("open-meteo failed", err);
    meta.fallback("weather");
    return null;
  }
}
