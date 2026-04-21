/**
 * GET /api/admin/metrics
 *
 * Métricas da fila de sincronização e do sistema.
 * Auth: Bearer API_KEY
 *
 * Retorna:
 * - pending, processing, done, failed (contagens da fila)
 * - errorRate (% de falhas nos últimos 5 min)
 * - oldestPendingAt, lastDoneAt
 * - circuit breaker status (via header X-CB-State se disponível)
 * - logs recentes de erro
 */

import path from 'node:path';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function authOk(request: Request): boolean {
  const apiKey = (process.env.CLOCK_AGENT_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey) return false;
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const xKey = request.headers.get('x-api-key') || '';
  return token === apiKey || xKey === apiKey;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!authOk(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  // Métricas da fila SQLite local (apenas disponível no agente, não na Vercel)
  // Em ambiente serverless retornamos métricas básicas do Supabase.
  const sqlitePath = (process.env.CLOCK_AGENT_SQLITE_PATH || '').trim();

  let queueMetrics: Record<string, unknown> = {
    note: 'Métricas da fila local disponíveis apenas no agente (não em serverless)',
  };

  if (sqlitePath) {
    try {
      // Importação dinâmica para não quebrar em ambientes sem better-sqlite3
      const { SyncQueue } = await import('../../services/syncQueue.js' as string);
      const q = new SyncQueue(sqlitePath);
      const metrics = q.getMetrics();
      const recentErrors = q.getLogs({ level: 'error', limit: 5 });
      q.close();

      queueMetrics = {
        ...metrics,
        sla: {
          ingestMs: 2_000,
          syncMs:   5_000,
          note: 'Violações registradas em system_logs com scope=sla',
        },
        recentErrors: recentErrors.map((l: { message: string; createdAt: string; context: unknown }) => ({
          message:   l.message,
          createdAt: l.createdAt,
          context:   l.context,
        })),
      };
    } catch {
      queueMetrics = { error: 'Fila local não acessível neste ambiente' };
    }
  }

  return Response.json(
    {
      timestamp: new Date().toISOString(),
      queue: queueMetrics,
      environment: {
        supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        apiKeyConfigured:   !!(process.env.CLOCK_AGENT_API_KEY || process.env.API_KEY),
        sqlitePathConfigured: !!sqlitePath,
        alertWebhookConfigured: !!(process.env.ALERT_WEBHOOK_URL),
      },
    },
    { status: 200, headers: corsHeaders }
  );
}
