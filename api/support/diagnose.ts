/**
 * GET /api/support/diagnose?company_id=UUID
 *
 * Diagnóstico automático de suporte para um tenant.
 * Auth: Bearer API_KEY
 *
 * Retorna:
 * - status completo do tenant
 * - problemas detectados com severidade
 * - ações recomendadas
 * - links para runbooks relevantes
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

interface DiagnosticIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  code:     string;
  message:  string;
  action:   string;
  runbook?: string;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!authOk(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const url       = new URL(request.url);
  const companyId = url.searchParams.get('company_id');
  if (!companyId) {
    return Response.json({ error: 'company_id obrigatório.' }, { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const sqlitePath  = (process.env.CLOCK_AGENT_SQLITE_PATH || '').trim();

  const issues: DiagnosticIssue[] = [];
  const checks: Record<string, unknown> = {};

  // ── Check 1: Supabase acessível ───────────────────────────────────────────
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
      const t0 = Date.now();
      const { error } = await supabase.from('clock_event_logs').select('id').limit(1);
      const latency = Date.now() - t0;
      checks.supabase = { ok: !error, latencyMs: latency };

      if (error) {
        issues.push({
          severity: 'critical',
          code:     'SUPABASE_UNREACHABLE',
          message:  `Supabase inacessível: ${error.message}`,
          action:   'Verificar conectividade e credenciais do Supabase',
          runbook:  'docs/runbooks/supabase-fora.md',
        });
      }

      // ── Check 2: Dispositivos ativos ──────────────────────────────────────
      const { data: devices } = await supabase
        .from('devices')
        .select('id, name, brand, ip, last_sync, active')
        .eq('company_id', companyId)
        .eq('active', true);

      checks.devices = { count: devices?.length ?? 0, list: devices ?? [] };

      if (!devices?.length) {
        issues.push({
          severity: 'high',
          code:     'NO_ACTIVE_DEVICES',
          message:  'Nenhum dispositivo ativo cadastrado para esta empresa',
          action:   'Cadastrar relógio em /api/onboarding/start ou na tabela devices',
          runbook:  'docs/runbooks/relogio-sem-comunicacao.md',
        });
      } else {
        const staleThreshold = new Date(Date.now() - 15 * 60_000).toISOString();
        const staleDevices   = devices.filter(d => !d.last_sync || d.last_sync < staleThreshold);
        if (staleDevices.length) {
          issues.push({
            severity: 'high',
            code:     'DEVICE_SYNC_STALE',
            message:  `${staleDevices.length} dispositivo(s) sem sync há mais de 15 min: ${staleDevices.map(d => d.name ?? d.id).join(', ')}`,
            action:   'Verificar conectividade com o relógio',
            runbook:  'docs/runbooks/relogio-sem-comunicacao.md',
          });
        }
      }

      // ── Check 3: Eventos não promovidos ───────────────────────────────────
      const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count: unpromoted } = await supabase
        .from('clock_event_logs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('promoted_at', null)
        .lt('created_at', cutoff);

      checks.unpromotedEvents = unpromoted ?? 0;
      if ((unpromoted ?? 0) > 50) {
        issues.push({
          severity: 'medium',
          code:     'ESPELHO_STALLED',
          message:  `${unpromoted} evento(s) sem promoção para o espelho há mais de 10 min`,
          action:   'Verificar função promote_clock_events_to_espelho no Supabase',
          runbook:  'docs/runbooks/fila-travada.md',
        });
      }

      // ── Check 4: Batidas recentes ─────────────────────────────────────────
      const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const { count: recentPunches } = await supabase
        .from('clock_event_logs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', since24h);

      checks.punchesLast24h = recentPunches ?? 0;

    } catch (e) {
      checks.supabase = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    checks.supabase = { ok: false, error: 'Supabase não configurado' };
    issues.push({
      severity: 'critical',
      code:     'SUPABASE_NOT_CONFIGURED',
      message:  'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados',
      action:   'Configurar variáveis de ambiente',
    });
  }

  // ── Check 5: Fila local ───────────────────────────────────────────────────
  if (sqlitePath) {
    try {
      const { SyncQueue } = await import('../../services/syncQueue.js' as string);
      const q = new SyncQueue(sqlitePath);
      const metrics = q.getMetrics();
      checks.queue = metrics;

      if (metrics.pending > 1_000) {
        issues.push({
          severity: 'high',
          code:     'QUEUE_OVERFLOW',
          message:  `Fila com ${metrics.pending} jobs pendentes`,
          action:   'Verificar conectividade e processar fila',
          runbook:  'docs/runbooks/fila-travada.md',
        });
      }
      if (metrics.failed > 0) {
        issues.push({
          severity: 'medium',
          code:     'DEAD_LETTER_JOBS',
          message:  `${metrics.failed} job(s) na dead letter queue`,
          action:   'Inspecionar em /api/admin/sync-errors e reprocessar se aplicável',
          runbook:  'docs/runbooks/fila-travada.md',
        });
      }
      q.close();
    } catch {
      checks.queue = { error: 'SQLite não acessível' };
    }
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount     = issues.filter(i => i.severity === 'high').length;
  const overallStatus = criticalCount > 0 ? 'critical' : highCount > 0 ? 'degraded' : issues.length > 0 ? 'warning' : 'healthy';

  return Response.json(
    {
      timestamp:  new Date().toISOString(),
      companyId,
      status:     overallStatus,
      issueCount: issues.length,
      issues:     issues.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      }),
      checks,
      summary: issues.length === 0
        ? 'Sistema operando normalmente para este tenant.'
        : `${issues.length} problema(s) detectado(s). Verificar issues acima.`,
    },
    { status: overallStatus === 'critical' ? 503 : 200, headers: corsHeaders }
  );
}
