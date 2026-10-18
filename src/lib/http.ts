import "server-only";
import { randomUUID } from "node:crypto";
import type { Meta, Mode } from "@/lib/types";
import { env, isForced } from "@/lib/env";

/**
 * Tracks which integrations fell back during one request, so `meta` is honest about
 * what was live, cached, or simulated.
 */
export class RequestMeta {
  readonly reqId = randomUUID().slice(0, 8);
  private readonly started = Date.now();
  private fallbacks = new Set<string>();
  private cached = false;
  private simulated = false;

  fallback(name: string) {
    this.fallbacks.add(name);
  }
  markCached() {
    this.cached = true;
  }
  markSimulated() {
    this.simulated = true;
  }
  get ms() {
    return Date.now() - this.started;
  }
  toMeta(): Meta {
    const mode: Mode = this.simulated ? "simulated" : this.cached ? "cached" : "live";
    const fallbacks = [...this.fallbacks];
    return { mode, fallback_used: fallbacks.length > 0 || mode !== "live", ...(fallbacks.length ? { fallbacks } : {}) };
  }
}

export function log(route: string, meta: RequestMeta, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ reqId: meta.reqId, route, ms: meta.ms, ...meta.toMeta(), ...extra }));
}

export function ok<T extends object>(body: T, meta: RequestMeta, route: string, extra?: Record<string, unknown>) {
  log(route, meta, extra);
  return Response.json({ ...body, meta: meta.toMeta() });
}

export function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}

/**
 * Serve the checked-in mock when the database (or another hard dependency) is
 * unavailable, so the frontend never hard-blocks on the backend.
 */
export async function mockResponse(name: string, route: string, reason: string) {
  const mock = (await import(`../../mocks/${name}.json`)).default;
  console.log(JSON.stringify({ route, served: "mock", reason }));
  return Response.json({ ...mock, meta: { mode: "simulated", fallback_used: true, fallbacks: ["mock", reason] } });
}

/** Should this route skip the DB and serve its mock? */
export function fallbackToMock(): string | null {
  if (env.forceFallback.includes("all") || env.forceFallback.includes("mock")) return "forced";
  if (isForced("db")) return "db_unconfigured";
  return null;
}

export function userIdFrom(value: unknown): string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : env.demoUserId;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "price unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
