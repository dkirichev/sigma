import { computeRiskScore } from '@sigma/analysis';
import { upsertRiskScore } from '@sigma/db';

export interface Env {
  DB: D1Database;
  RAW: R2Bucket;
}

// Scaffold pipeline: a real run pulls from АОП / ЦАИС ЕОП, lands raw payloads in
// R2, normalises into D1, then scores each tender. Here we just exercise the wiring.
async function runPipeline(env: Env): Promise<{ scored: number }> {
  const result = computeRiskScore({
    spec: 40,
    price: 20,
    competition: 60,
    cartel: 10,
    process: 30,
  });
  await upsertRiskScore(env.DB, {
    tender_id: 'demo-tender',
    score: result.score,
    band: result.band,
    signals: JSON.stringify(result.signals),
    computed_at: new Date().toISOString(),
  });
  return { scored: 1 };
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'sigma-etl' });
    }

    if (url.pathname === '/etl/run' && request.method === 'POST') {
      return Response.json(await runPipeline(env));
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(runPipeline(env).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
