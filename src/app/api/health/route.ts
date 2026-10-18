import { connection } from "next/server";
import { env, isForced } from "@/lib/env";
import { paymentAdapter } from "@/lib/integrations/payments";

// GET /api/health -> which integrations are live vs falling back. Handy before a demo.
export async function GET() {
  await connection();
  let photonWorker: string = isForced("photon") ? "unconfigured" : "unknown";
  if (!isForced("photon")) {
    try {
      const r = await fetch(`${env.photonWorkerUrl}/health`, { signal: AbortSignal.timeout(2000) });
      photonWorker = r.ok ? "up" : `http ${r.status}`;
    } catch {
      photonWorker = "down";
    }
  }
  return Response.json({
    model: env.model,
    llm: isForced("llm") ? "fallback" : "live (gemini)",
    database: isForced("db") ? "mock" : "live",
    serpapi: isForced("serpapi") ? "fallback" : "live",
    geoapify: isForced("geoapify") ? "unconfigured (overpass)" : "live",
    overpass: isForced("overpass") ? "fallback(seeded)" : "live+seeded",
    payments: paymentAdapter().mode(),
    photon_worker: photonWorker,
    force_fallback: env.forceFallback,
  });
}
