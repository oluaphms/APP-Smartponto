/**
 * GET /api/admin/system-status
 *
 * Painel de operação completo do sistema híbrido.
 * Auth: Bearer API_KEY
 *
 * Retorna:
 * - status geral (normal | degraded | critical)
 * - estado da fila (pending, failed, errorRate, delay)
 * - circuit breaker (state, failureRate, openedAt)
 * - latência ponta-a-ponta (avg, p95, max)
 * - modo atual (normal | degraded)
 * - checkpoint (última sincronização, última reconciliação)
 * - alertas recentes
 * - SLA compliance
 */

import { createClient } from '@supabase/supabase-js';

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

async function getSupabaseStatus(url: string, key: string) {
  try {
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const t0 = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    const { error } = await supabase.from('clock_event_logs').select('id').limit(1).abortSignal(controller.signal);
    clearTimeout(timeout);
    return { ok: !error, latencyMs: Date.now() - t0, error: error?.message };
  } catch (e) {
    return { ok: false, latencyMs: -1, error: e instanceof Error ? e.message : String(e) };
  }
}

function deriveOverallStatus(
  queueMetrics: Record<string, unknown>,
  supabaseOk: boolean,
  degraded: boolean
): 'normal' | 'degraded' | 'critical' {
  if (!supabaseOk) return 'critical';
  if (degraded) return 'degraded';
  const pending = (queueMetrics.pending as number) ?? 0;
  const errorRate = (queueMetrics.errorRate as number) ?? 0;
  const delayMs = (queueMetrics.processingDelayMs as number) ?? 0;
  if (pending > 5_000 || errorRate > 50 || delayMs > 5 * 60_000) return 'critical';
  if (pending > 1_000 || errorRate > 30 || delayMs > 2 * 60_000) return 'degraded';
  return 'normal';
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!authOk(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const sqlitePath  = (process.env.CLOCK_AGENT_SQLITE_PATH || '').trim();

  // ── Supabase status ──────────────────────────────────────────────────────────
  const supabaseStatus = supabaseUrl && serviceKey
    ? await getSupabaseStatus(supabaseUrl, serviceKey)
    : { ok: false, latencyMs: -1, error: 'credenciais não configuradas' };

  // ── Fila local (SQLite) ──────────────────────────────────────────────────────
  let queueMetrics: Record<string, unknown> = { note: 'SQLite não acessível neste ambiente' };
  let checkpoint: Record<string, unknown>   = {};
  let recentAlerts: unknown[]               = [];
  let recentErrors: unknown[]               = [];

  if (sqlitePath) {
    try {
      const { SyncQueue } = await import('../../services/syncQueue.js' as string);
      const q = new SyncQueue(sqlitePath);

      queueMetrics  = q.getMetrics();
      checkpoint    = q.getCheckpoint('worker') ?? {};
      recentAlerts  = q.getLogs({ scope: 'alert', limit: 5 });
      recentErrors  = q.getLogs({ level: 'error', limit: 5 });

      q.close();
    } catch {
      queueMetrics = { error: 'Fila não acessível' };
    }
  }

  // ── Status geral ─────────────────────────────────────────────────────────────
  const overallStatus = deriveOverallStatus(queueMetrics, supabaseStatus.ok, !supabaseStatus.ok);

  // ── SLA compliance ───────────────────────────────────────────────────────────
  const delayMs = (queueMetrics.processingDelayMs as number) ?? 0;
  const sla = {
    ingest:    { target: '< 2s',  status: delayMs < 2_000  ? 'ok' : 'violated' },
    sync:      { target: '< 5s',  status: delayMs < 5_000  ? 'ok' : 'violated' },
    dashboard: { target: 'realtime', status: supabaseStatus.ok ? 'ok' : 'degraded' },
  };

  const httpStatus = overallStatus === 'critical' ? 503 : 200;

  return Response.json(
    {
      timestamp:     new Date().toISOString(),
      status:        overallStatus,
      mode:          supabaseStatus.ok ? 'normal' : 'degraded',
      supabase:      supabaseStatus,
      queue:         queueMetrics,
      checkpoint,
      sla,
      recentAlerts,
      recentErrors,
      environment: {
        supabaseConfigured:     !!(supabaseUrl && serviceKey),
        apiKeyConfigured:       !!(process.env.CLOCK_AGENT_API_KEY || process.env.API_KEY),
        sqliteConfigured:       !!sqlitePath,
        alertWebhookConfigured: !!(process.env.ALERT_WEBHOOK_URL),
        snapshotEnabled:        process.env.SNAPSHOT_ENABLED !== '0',
      },
    },
    { status: httpStatus, headers: corsHeaders }
  );
}
