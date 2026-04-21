/**
 * GET /api/admin/audit/daily-report
 *
 * Relatório de auditoria do dia anterior.
 * Auth: Bearer API_KEY
 *
 * Retorna:
 * - resultado da verificação de integridade
 * - status da âncora de timestamp
 * - eventos não promovidos
 * - overall: PASS | FAIL
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!authOk(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const sqlitePath  = (process.env.CLOCK_AGENT_SQLITE_PATH || '').trim();
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  // Tentar buscar relatório salvo no Supabase primeiro
  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('audit_daily_reports')
        .select('*')
        .eq('date', yesterday)
        .single();

      if (data) {
        return Response.json(
          { source: 'supabase', ...data },
          { status: 200, headers: corsHeaders }
        );
      }
    } catch { /* fallback para SQLite */ }
  }

  // Fallback: executar verificação em tempo real via SQLite
  if (!sqlitePath) {
    return Response.json(
      { error: 'Relatório não disponível. Configure CLOCK_AGENT_SQLITE_PATH.' },
      { status: 503, headers: corsHeaders }
    );
  }

  try {
    const [{ SyncQueue }, { AuditTrail }, { TimestampAnchor }] = await Promise.all([
      import('../../services/syncQueue.js' as string),
      import('../../services/auditTrail.js' as string),
      import('../../services/timestampSigner.js' as string),
    ]);

    const q       = new SyncQueue(sqlitePath);
    const audit   = new AuditTrail({ db: q.db });
    const anchor  = new TimestampAnchor({ db: q.db });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const integrity  = audit.verifyIntegrity();
    const lastHash   = (() => {
      try {
        const row = q.db.prepare(`
          SELECT integrity_hash FROM audit_trail
          WHERE created_at >= ? AND created_at < ?
          ORDER BY created_at DESC LIMIT 1
        `).get(`${yesterday}T00:00:00.000Z`, `${yesterday}T23:59:59.999Z`);
        return row?.integrity_hash ?? '';
      } catch { return ''; }
    })();
    const anchorCheck = anchor.verifyInAnchor(lastHash, yesterday);

    q.close();

    const report = {
      source:    'realtime',
      date:      new Date().toISOString(),
      period:    yesterday,
      integrity: { ok: integrity.ok, checked: integrity.checked, tampered: integrity.tampered },
      anchor:    { date: yesterday, found: anchorCheck.found, merkleRoot: anchorCheck.merkleRoot ?? null },
      overall:   integrity.ok && anchorCheck.found ? 'PASS' : 'FAIL',
    };

    return Response.json(report, {
      status: report.overall === 'PASS' ? 200 : 409,
      headers: corsHeaders,
    });

  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500, headers: corsHeaders }
    );
  }
}
