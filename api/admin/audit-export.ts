/**
 * GET /api/admin/audit/export
 *
 * Exportação completa da trilha de auditoria para auditores externos.
 * Auth: Bearer API_KEY
 *
 * Formatos:
 * - ?format=json  (default) — JSON estruturado com hash chain
 * - ?format=csv   — CSV para planilhas
 * - ?format=report — relatório de integridade completo
 *
 * Query params:
 * - format:     json | csv | report
 * - company_id: filtrar por empresa
 * - from:       data início (ISO)
 * - to:         data fim (ISO)
 * - limit:      máx registros (default 10000)
 *
 * Inclui:
 * - Todos os registros da trilha
 * - Hash chain para verificação independente
 * - Assinaturas HMAC
 * - Âncoras de timestamp (se disponíveis)
 * - Resultado da verificação de integridade
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

function toCSV(entries: unknown[]): string {
  if (!entries.length) return 'id,entity,entityId,action,performedBy,companyId,integrityHash,createdAt\n';
  const header = 'id,entity,entityId,action,performedBy,companyId,integrityHash,createdAt';
  const rows = (entries as Record<string, unknown>[]).map(e =>
    [e.id, e.entity, e.entityId ?? '', e.action, e.performedBy ?? '', e.companyId ?? '', e.integrityHash, e.createdAt]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\r\n');
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
    return Response.json({ error: 'CLOCK_AGENT_SQLITE_PATH não configurado.' }, { status: 503, headers: corsHeaders });
  }

  let SyncQueue: any, AuditTrail: any, TimestampAnchor: any, signRecord: any;
  try {
    [{ SyncQueue }, { AuditTrail }, { TimestampAnchor, signRecord }] = await Promise.all([
      import('../../services/syncQueue.js' as string),
      import('../../services/auditTrail.js' as string),
      import('../../services/timestampSigner.js' as string),
    ]);
  } catch {
    return Response.json({ error: 'Módulos não disponíveis.' }, { status: 503, headers: corsHeaders });
  }

  const url       = new URL(request.url);
  const format    = (url.searchParams.get('format') || 'json').toLowerCase();
  const companyId = url.searchParams.get('company_id') || undefined;
  const from      = url.searchParams.get('from') || undefined;
  const to        = url.searchParams.get('to')   || undefined;
  const limit     = Math.min(50_000, parseInt(url.searchParams.get('limit') || '10000', 10));

  const q  = new SyncQueue(sqlitePath);
  const at = new AuditTrail({ db: q.db });
  const ta = new TimestampAnchor({ db: q.db });

  try {
    // Buscar entradas com filtros de data
    let entries = at.query({ companyId, limit });
    if (from) entries = entries.filter((e: { createdAt: string }) => e.createdAt >= from);
    if (to)   entries = entries.filter((e: { createdAt: string }) => e.createdAt <= to);

    // Adicionar assinaturas HMAC
    const signed = entries.map((e: Record<string, unknown>) => ({
      ...e,
      signature: signRecord({
        integrityHash: e.integrityHash,
        createdAt:     e.createdAt,
        companyId:     e.companyId,
        action:        e.action,
      }),
    }));

    // Verificação de integridade
    const integrity = at.verifyIntegrity();

    if (format === 'csv') {
      const csv = toCSV(signed);
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit_trail_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (format === 'report') {
      // Relatório completo para auditor externo
      const report = {
        reportTitle:    'Relatório de Auditoria — PontoWebDesk',
        generatedAt:    new Date().toISOString(),
        generatedBy:    'api/admin/audit/export',
        system:         'PontoWebDesk Hybrid SaaS',
        version:        '1.0',
        integrity: {
          ...integrity,
          message: integrity.ok
            ? 'Trilha de auditoria íntegra. Nenhuma adulteração detectada.'
            : `ALERTA: ${integrity.tampered} registro(s) adulterado(s) detectado(s).`,
          verificationMethod: 'SHA-256 hash chain (cada registro encadeia o hash do anterior)',
        },
        filters:        { companyId, from, to, limit },
        totalRecords:   signed.length,
        hashChainStart: signed.length > 0 ? (signed[signed.length - 1] as Record<string, unknown>).integrityHash : null,
        hashChainEnd:   signed.length > 0 ? (signed[0] as Record<string, unknown>).integrityHash : null,
        entries:        signed,
        instructions: {
          verification: 'Para verificar independentemente: recalcule SHA-256(previousHash + JSON(entry)) para cada registro em ordem cronológica.',
          genesisHash:  'GENESIS',
          signatureKey: 'Assinaturas HMAC-SHA256 requerem a chave TIMESTAMP_SECRET_KEY do servidor.',
        },
      };

      return new Response(JSON.stringify(report, null, 2), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit_report_${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // JSON padrão
    return Response.json(
      {
        exportedAt:   new Date().toISOString(),
        totalRecords: signed.length,
        integrity,
        entries:      signed,
      },
      { status: 200, headers: corsHeaders }
    );

  } finally {
    q.close();
  }
}
