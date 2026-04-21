/**
 * GET /api/admin/logs
 *
 * Logs estruturados do sistema (system_logs do SQLite local).
 * Auth: Bearer API_KEY
 *
 * Query params:
 * - level:  debug | info | warn | error
 * - scope:  sync | enqueue | collect | circuit_breaker | alert | espelho | ...
 * - limit:  número de registros (default 200, max 1000)
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function authOk(request: Request): boolean {
  const apiKey = (process.env.CLOCK_AGENT_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey) return false;
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const xKey  = request.headers.get('x-api-key') || '';
  return token === apiKey || xKey === apiKey;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!authOk(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const sqlitePath = (process.env.CLOCK_AGENT_SQLITE_PATH || '').trim();
  if (!sqlitePath) {
    return Response.json(
      { error: 'CLOCK_AGENT_SQLITE_PATH não configurado.' },
      { status: 503, headers: corsHeaders }
    );
  }

  let SyncQueue: any;
  try {
    const mod = await import('../../services/syncQueue.js' as string);
    SyncQueue = mod.SyncQueue;
  } catch {
    return Response.json({ error: 'Módulo de fila não disponível.' }, { status: 503, headers: corsHeaders });
  }

  const url   = new URL(request.url);
  const level = url.searchParams.get('level') || undefined;
  const scope = url.searchParams.get('scope') || undefined;
  const limit = Math.min(1_000, parseInt(url.searchParams.get('limit') || '200', 10));

  const q = new SyncQueue(sqlitePath);
  try {
    const logs = q.getLogs({ level, scope, limit });
    return Response.json(
      { timestamp: new Date().toISOString(), count: logs.length, logs },
      { status: 200, headers: corsHeaders }
    );
  } finally {
    q.close();
  }
}
