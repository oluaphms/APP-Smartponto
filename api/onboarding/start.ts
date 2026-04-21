/**
 * POST /api/onboarding/start
 *
 * Onboarding automatizado de novo tenant.
 *
 * FLUXO:
 * 1. Criar empresa (companies)
 * 2. Criar usuário admin
 * 3. Registrar relógio (devices)
 * 4. Validar conectividade com o relógio
 * 5. Ativar coleta
 *
 * Auth: Bearer API_KEY (master)
 *
 * Body:
 * {
 *   company: { name, cnpj, timezone? },
 *   admin:   { email, name },
 *   device?: { brand, ip, port?, username?, password?, name? }
 * }
 */

import { createClient } from '@supabase/supabase-js';
import { z }            from 'zod';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const OnboardingSchema = z.object({
  company: z.object({
    name:     z.string().min(2).max(200),
    cnpj:     z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos').optional(),
    timezone: z.string().default('America/Sao_Paulo'),
  }),
  admin: z.object({
    email: z.string().email(),
    name:  z.string().min(2).max(200),
  }),
  device: z.object({
    brand:    z.enum(['controlid', 'dimep', 'henry', 'topdata']),
    ip:       z.string().min(7),
    port:     z.number().int().min(1).max(65535).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    name:     z.string().optional(),
  }).optional(),
});

function authOk(request: Request): boolean {
  const apiKey = (process.env.CLOCK_AGENT_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey) return false;
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return token === apiKey;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  if (!authOk(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Supabase não configurado.' }, { status: 503, headers: corsHeaders });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Body JSON inválido.' }, { status: 400, headers: corsHeaders }); }

  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Schema inválido.', details: parsed.error.format() }, { status: 400, headers: corsHeaders });
  }

  const { company, admin, device } = parsed.data;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const steps: Array<{ step: string; status: 'ok' | 'error' | 'skipped'; detail?: string }> = [];

  // ── Step 1: Criar empresa ─────────────────────────────────────────────────
  let companyId: string | null = null;
  try {
    const { data, error } = await supabase
      .from('companies')
      .insert({ name: company.name, cnpj: company.cnpj ?? null, timezone: company.timezone })
      .select('id')
      .single();

    if (error) throw error;
    companyId = data.id;
    steps.push({ step: 'create_company', status: 'ok', detail: `company_id: ${companyId}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: 'create_company', status: 'error', detail: msg });
    return Response.json({ success: false, steps, error: 'Falha ao criar empresa.' }, { status: 500, headers: corsHeaders });
  }

  // ── Step 2: Criar usuário admin ───────────────────────────────────────────
  let adminUserId: string | null = null;
  try {
    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email:         admin.email,
      email_confirm: true,
      user_metadata: { name: admin.name, company_id: companyId, role: 'admin' },
    });

    if (authError) throw authError;
    adminUserId = authData.user?.id ?? null;

    // Criar perfil na tabela users
    if (adminUserId) {
      await supabase.from('users').upsert({
        id:         adminUserId,
        email:      admin.email,
        name:       admin.name,
        company_id: companyId,
        role:       'admin',
      }, { onConflict: 'id' });
    }

    steps.push({ step: 'create_admin', status: 'ok', detail: `user_id: ${adminUserId}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: 'create_admin', status: 'error', detail: msg });
    // Não fatal — empresa criada, admin pode ser criado depois
  }

  // ── Step 3: Registrar relógio ─────────────────────────────────────────────
  let deviceId: string | null = null;
  if (device) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .insert({
          company_id: companyId,
          brand:      device.brand,
          ip:         device.ip,
          port:       device.port ?? null,
          username:   device.username ?? null,
          password:   device.password ?? null,
          name:       device.name ?? `${device.brand}-${device.ip}`,
          active:     true,
        })
        .select('id')
        .single();

      if (error) throw error;
      deviceId = data.id;
      steps.push({ step: 'register_device', status: 'ok', detail: `device_id: ${deviceId}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ step: 'register_device', status: 'error', detail: msg });
    }

    // ── Step 4: Validar conectividade ─────────────────────────────────────
    if (deviceId && device.brand === 'controlid') {
      try {
        const ctrl = new AbortController();
        const t    = setTimeout(() => ctrl.abort(), 5_000);
        const res  = await fetch(`http://${device.ip}:${device.port ?? 80}/load_objects`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ object: 'access_logs' }),
          signal:  ctrl.signal,
        });
        clearTimeout(t);
        steps.push({ step: 'validate_device_connectivity', status: res.ok ? 'ok' : 'error', detail: `HTTP ${res.status}` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        steps.push({ step: 'validate_device_connectivity', status: 'error', detail: msg });
      }
    } else if (!deviceId) {
      steps.push({ step: 'validate_device_connectivity', status: 'skipped', detail: 'device não registrado' });
    } else {
      steps.push({ step: 'validate_device_connectivity', status: 'skipped', detail: `validação automática não disponível para ${device.brand}` });
    }
  } else {
    steps.push({ step: 'register_device',               status: 'skipped', detail: 'nenhum device fornecido' });
    steps.push({ step: 'validate_device_connectivity',  status: 'skipped', detail: 'nenhum device fornecido' });
  }

  // ── Step 5: Ativar coleta ─────────────────────────────────────────────────
  steps.push({
    step:   'activate_collection',
    status: 'ok',
    detail: 'O agente coletará automaticamente no próximo ciclo (15s)',
  });

  const allOk = steps.every(s => s.status !== 'error');

  return Response.json(
    {
      success:   allOk,
      companyId,
      adminUserId,
      deviceId,
      steps,
      nextSteps: allOk ? [
        'Aguardar primeiro ciclo de coleta (15s)',
        'Verificar batidas em /api/admin/metrics',
        `Acessar dashboard: /dashboard?company=${companyId}`,
      ] : [
        'Corrigir erros reportados nos steps',
        'Reexecutar onboarding ou corrigir manualmente',
      ],
    },
    { status: allOk ? 201 : 207, headers: corsHeaders }
  );
}
