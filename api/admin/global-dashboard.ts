/**
 * GET /api/admin/global-dashboard
 *
 * Dashboard operacional master — visão consolidada de todas as empresas.
 * Auth: Bearer API_KEY (admin master)
 *
 * Retorna:
 * - empresas ativas (com métricas por tenant)
 * - filas por empresa
 * - erros globais
 * - status geral do sistema
 * - feature flags ativas
 * - compliance (retenção LGPD pendente)
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

async function getActiveCompanies(supabase: ReturnType<typeof createClient>) {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data, error } = await supabase
      .from('clock_event_logs')
      .select('company_id')
      .gte('created_at', since)
      .limit(500);

    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const r of data) {
      counts.set(r.company_id, (counts.get(r.company_id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([companyId, punchCount]) => ({ companyId, punchCount }))
      .sort((a, b) => b.punchCount - a.punchCount);
  } catch {
    return [];
  }
}

async function getUnpromotedCount(supabase: ReturnType<typeof createClient>) {
  try {
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count } = await supabase
      .from('clock_event_logs')
      .select('id', { count: 'exact', head: true })
      .is('promoted_at', null)
      .lt('created_at', cutoff);
    return count ?? 0;
  } catch {
    return -1;
  }
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

  // ── Dados do Supabase ────────────────────────────────────────────────────────
  let activeCompanies: unknown[] = [];
  let unpromotedCount = -1;
  let supabaseOk = false;

  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    try {
      const t0 = Date.now();
      const { error } = await supabase.from('clock_event_logs').select('id').limit(1);
      supabaseOk = !error;
      if (supabaseOk) {
        [activeCompanies, unpromotedCount] = await Promise.all([
          getActiveCompanies(supabase),
          getUnpromotedCount(supabase),
        ]);
      }
    } catch { /* ignore */ }
  }

  // ── Dados do SQLite local ────────────────────────────────────────────────────
  let queueMetrics: Record<string, unknown>  = {};
  let tenantMetrics: unknown[]               = [];
  let featureFlagsStatus: Record<string, unknown> = {};
  let retentionStatus: Record<string, unknown>    = {};
  let recentAlerts: unknown[]                = [];
  let auditIntegrity: Record<string, unknown>     = {};

  if (sqlitePath) {
    try {
      const [
        { SyncQueue },
        { TenantMetrics },
        { FeatureFlags },
        { RetentionPolicy },
        { AuditTrail },
      ] = await Promise.all([
        import('../../services/syncQueue.js' as string),
        import('../../services/tenantMetrics.js' as string),
        import('../../services/featureFlags.js' as string),
        import('../../services/retentionPolicy.js' as string),
        import('../../services/auditTrail.js' as string),
      ]);

      const q  = new SyncQueue(sqlitePath);
      const tm = new TenantMetrics({ db: q.db });
      const ff = new FeatureFlags();
      const at = new AuditTrail({ db: q.db });

      queueMetrics      = q.getMetrics();
      tenantMetrics     = tm.getAll({ limit: 20 });
      featureFlagsStatus = ff.getStatus();
      recentAlerts      = q.getLogs({ scope: 'alert', limit: 10 });
      auditIntegrity    = at.verifyIntegrity();

      // Retenção LGPD (apenas contagem, não executa)
      try {
        const rp = new RetentionPolicy({ db: q.db, queue: q });
        retentionStatus = rp.getPendingCount();
      } catch { retentionStatus = { error: 'não disponível' }; }

      q.close();
    } catch (err) {
      queueMetrics = { error: 'SQLite não acessível' };
    }
  }

  // ── Status geral ─────────────────────────────────────────────────────────────
  const pending    = (queueMetrics.pending    as number) ?? 0;
  const errorRate  = (queueMetrics.errorRate  as number) ?? 0;
  const delayMs    = (queueMetrics.processingDelayMs as number) ?? 0;

  const overallStatus =
    !supabaseOk                                    ? 'critical'  :
    pending > 5_000 || errorRate > 50              ? 'critical'  :
    pending > 1_000 || errorRate > 30 || delayMs > 120_000 ? 'degraded' :
    'normal';

  return Response.json(
    {
      timestamp:      new Date().toISOString(),
      status:         overallStatus,
      supabase:       { ok: supabaseOk },
      queue:          queueMetrics,
      activeCompanies,
      tenantMetrics,
      espelho: {
        unpromotedEvents: unpromotedCount,
        status: unpromotedCount > 100 ? 'stalled' : unpromotedCount > 0 ? 'lagging' : 'ok',
      },
      featureFlags:   featureFlagsStatus,
      compliance: {
        lgpdRetention:  retentionStatus,
        auditIntegrity,
      },
      recentAlerts,
    },
    { status: overallStatus === 'critical' ? 503 : 200, headers: corsHeaders }
  );
}
