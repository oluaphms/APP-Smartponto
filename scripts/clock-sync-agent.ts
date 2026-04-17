/**
 * Agente local (Node.js): sincroniza relógios cadastrados em `devices` a cada 1 minuto.
 *
 * Variáveis: `.env` e `.env.local` na raiz (este script carrega os dois; `.env.local` sobrescreve).
 *   SUPABASE_URL (ou use VITE_SUPABASE_URL — o agente replica para SUPABASE_URL se faltar)
 *   SUPABASE_SERVICE_ROLE_KEY — obrigatória; Dashboard > API > service_role (não use anon no agente)
 *
 * Opcionais: SUPABASE_TIME_LOGS_TABLE, SUPABASE_DEVICES_TABLE, SUPABASE_SYNC_LOGS_TABLE
 *
 * Uso: npm run clock-sync-agent
 */

import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../.env.local') });

const _u = (process.env.SUPABASE_URL || '').trim();
const _v = (process.env.VITE_SUPABASE_URL || '').trim();
if (!_u && _v) {
  process.env.SUPABASE_URL = _v;
}

const { runSyncCycle } = await import('../src/services/sync.service.ts');

const INTERVAL_MS = 60_000;

function requireEnv(name: string): string {
  const v = (process.env[name] || '').trim();
  if (!v) {
    console.error(`[clock-sync-agent] Variável obrigatória ausente: ${name}`);
    process.exit(1);
  }
  return v;
}

async function tick(): Promise<void> {
  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const result = await runSyncCycle({
    supabase: { url, serviceKey },
  });

  if (result.devices.length === 0) {
    console.log(
      '[clock-sync-agent] Nenhum dispositivo para sincronizar (tabela `devices` vazia ou sem active=true / company_id+brand+ip válidos).'
    );
  } else {
    for (const d of result.devices) {
      if (d.ok) {
        console.log(`[clock-sync-agent] OK ${d.deviceId} importados=${d.imported} dup=${d.skippedDuplicates}`);
      } else {
        console.error(`[clock-sync-agent] ERRO ${d.deviceId}: ${d.error}`);
      }
    }
  }
  console.log(
    `[clock-sync-agent] Ciclo ${result.finishedAt} — ${result.devices.length} dispositivo(s) processado(s). Próximo em ${INTERVAL_MS / 1000}s (Ctrl+C encerra).`
  );
}

async function main(): Promise<void> {
  console.log('[clock-sync-agent] Iniciando (intervalo', INTERVAL_MS / 1000, 's)');
  await tick();
  setInterval(() => {
    tick().catch((e) => console.error('[clock-sync-agent] falha no ciclo:', e));
  }, INTERVAL_MS);
}

main().catch((e) => {
  console.error('[clock-sync-agent]', e);
  process.exit(1);
});
