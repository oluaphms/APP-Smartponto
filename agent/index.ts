/**
 * Ponto de entrada do agente local PontoWebDesk: fila offline + sync periódico → Supabase.
 *
 * PIPELINE ÚNICO (ARQUITETURA HÍBRIDA CORRIGIDA):
 * Relógio → Adapter → SQLite (time_records) → syncService.js → clock_event_logs → espelho
 *
 * Variáveis: `.env` / `.env.local` na raiz do projeto (ver `agent/config`).
 * Uso: npm run clock-sync-agent
 */

import { loadAgentConfig, type AgentConfig } from './config';
import { OfflineQueue } from './queue';
import { AgentLogger } from './services/agentLogger';
import { aggregateEspelhoCycle, runAgentTick } from './services/syncRunner.service';
import { startSyncService } from '../services/syncService.js';

async function tick(cfg: AgentConfig): Promise<void> {
  const queue = new OfflineQueue(cfg.sqliteDbPath);
  const log = new AgentLogger(cfg.jsonLogs);

  const result = await runAgentTick(cfg, queue, log);

  if (result.devices.length === 0) {
    log.info('Nenhum dispositivo ativo para sincronizar');
  }

  // Resumo do ciclo
  const espelhoCiclo = aggregateEspelhoCycle(result.devices);
  if (espelhoCiclo) {
    log.log('info', 'agent', `Ciclo completo: ${result.devices.length} device(s), ${espelhoCiclo.timeRecords} time_records`, {
      finishedAt: result.finishedAt,
      nextInSeconds: cfg.intervalMs / 1000,
      espelho: espelhoCiclo,
    });
  } else {
    log.log('info', 'agent', `Ciclo completo: ${result.devices.length} device(s)`, {
      finishedAt: result.finishedAt,
      nextInSeconds: cfg.intervalMs / 1000,
    });
  }
}

async function main(): Promise<void> {
  const cfg = loadAgentConfig();
  const log = new AgentLogger(cfg.jsonLogs);

  log.configLoaded({
    intervalSeconds: cfg.intervalMs / 1000,
    sqliteDbPath: cfg.sqliteDbPath,
    apiMode: !!cfg.apiBaseUrl,
    logMode: cfg.jsonLogs ? 'json' : 'text',
  });

  log.connOk(`Agente iniciado - próximo ciclo em ${cfg.intervalMs / 1000}s`);

  // Iniciar worker de sincronização local → Supabase (pipeline único via clock_event_logs)
  // Controlado por CLOCK_LOCAL_TIME_RECORDS_SYNC (default: '1' = ativo)
  if ((process.env.CLOCK_LOCAL_TIME_RECORDS_SYNC || '1').trim() !== '0') {
    const syncInterval = parseInt(process.env.LOCAL_TIME_RECORDS_SYNC_INTERVAL_MS || '15000', 10) || 15000;
    const effectiveInterval = Math.max(5000, syncInterval);

    if (!cfg.supabaseUrl || !cfg.serviceRoleKey) {
      log.warn('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes — worker de sync desativado. Configure as variáveis para habilitar.');
    } else {
      const worker = startSyncService({
        sqliteDbPath: cfg.sqliteDbPath,
        supabaseUrl: cfg.supabaseUrl,
        serviceRoleKey: cfg.serviceRoleKey,
        intervalMs: effectiveInterval,
      });
      log.connOk(`Worker sync local → clock_event_logs: intervalo ${effectiveInterval / 1000}s (desligar: CLOCK_LOCAL_TIME_RECORDS_SYNC=0)`);

      // Logar status do circuit breaker a cada 5 minutos
      setInterval(() => {
        const cbStatus = worker.cb.getStatus();
        if (cbStatus.state !== 'CLOSED') {
          log.warn(`Circuit breaker: ${cbStatus.state} (falhas: ${cbStatus.failureRate}%)`, cbStatus);
        }
        const metrics = worker.queue.getMetrics();
        if (metrics.pending > 0 || metrics.failed > 0) {
          log.log('info', 'queue', `Fila: ${metrics.pending} pendentes, ${metrics.failed} falhos, taxa erro: ${metrics.errorRate}%`, metrics);
        }
      }, 5 * 60_000);
    }
  } else {
    log.connOk('Worker sync local desativado (CLOCK_LOCAL_TIME_RECORDS_SYNC=0)');
  }

  await tick(cfg);
  setInterval(() => {
    tick(cfg).catch((e) => {
      const logErr = new AgentLogger(cfg.jsonLogs);
      logErr.error(`falha no ciclo: ${e instanceof Error ? e.message : String(e)}`, {
        stack: e instanceof Error ? e.stack : undefined,
      });
    });
  }, cfg.intervalMs);
}

main().catch((e) => {
  const log = new AgentLogger(false); // Force text mode for final error
  log.error(`FATAL: ${e instanceof Error ? e.message : String(e)}`, {
    stack: e instanceof Error ? e.stack : undefined,
  });
  process.exit(1);
});
