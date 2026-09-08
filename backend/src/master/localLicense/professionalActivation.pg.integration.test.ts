/**
 * Integração PostgreSQL real — concorrência pac_*.
 *
 * Usa o PG Professional local (ProgramData\secrets.json → :55432) quando disponível.
 * Aplica DDL 044/045 idempotente no setup.
 *
 * NÃO usa mocks. Se PG indisponível → testes skipped com motivo explícito.
 */
// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  consumeProfessionalActivationToken,
  issueProfessionalActivationToken,
  ProfessionalActivationTokenError,
  hashProfessionalActivationToken,
  type ActivationSqlQuery,
} from './professionalActivationToken.js';

type SecretsDoc = {
  port?: number;
  postgresSuperuserPassword?: string;
};

function resolveLocalProfessionalConnection(): {
  connectionString: string;
  port: number;
} | null {
  const secretsPath = 'C:\\ProgramData\\PontoWebDesk\\Config\\secrets.json';
  if (!fs.existsSync(secretsPath)) return null;
  try {
    const secrets = JSON.parse(
      fs.readFileSync(secretsPath, 'utf8').replace(/^\uFEFF/, ''),
    ) as SecretsDoc;
    const port = Number(secrets.port) || 55432;
    const password = String(secrets.postgresSuperuserPassword || '');
    if (!password) return null;
    const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/pontowebdesk`;
    return { connectionString, port };
  } catch {
    return null;
  }
}

const localPg = resolveLocalProfessionalConnection();
const describePg = localPg ? describe : describe.skip;

describePg('ProfessionalActivation pac_* PostgreSQL concurrency', () => {
  let pool: pg.Pool;
  let sql: ActivationSqlQuery;

  beforeAll(async () => {
    if (!localPg) return;
    pool = new pg.Pool({ connectionString: localPg.connectionString, max: 8 });
    sql = (queryText, values) => pool.query(queryText, values);

    const mig044 = fs.readFileSync(
      path.join(process.cwd(), 'db/migrations/044_master_professional_activation_tokens.sql'),
      'utf8',
    );
    const mig045 = fs.readFileSync(
      path.join(process.cwd(), 'db/migrations/045_master_professional_activation_token_hardening.sql'),
      'utf8',
    );
    await pool.query(mig044);
    await pool.query(mig045);

    // Binding table required for compensate guard (já existe no Professional local).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.master_local_licenses (
        machine_id       text PRIMARY KEY,
        license_key      text NOT NULL,
        hardware_hash    text NOT NULL,
        activation_date  timestamptz NOT NULL,
        expiration_date  timestamptz,
        heartbeat        timestamptz NOT NULL,
        plan             text,
        meta             jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      );
    `);
  }, 60_000);

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('duas ativações concorrentes → exatamente uma consome; estado consistente', async () => {
    const tenantId = `tn_pg_${Date.now()}`;
    const deploymentId = `dep_pg_${Date.now()}`;
    const companyLicenseId = `lic_pg_${Date.now()}`;

    const issued = await issueProfessionalActivationToken(
      {
        tenantId,
        deploymentId,
        companyLicenseId,
        ttlMs: 3_600_000,
      },
      sql,
    );

    const machineA = `mid_${'a'.repeat(24)}`;
    const machineB = `mid_${'b'.repeat(24)}`;

    const results = await Promise.allSettled([
      consumeProfessionalActivationToken(issued.token, machineA, sql),
      consumeProfessionalActivationToken(issued.token, machineB, sql),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ machineId?: string; boundMachineId: string | null }>).value;
    expect(winner.boundMachineId === machineA || winner.boundMachineId === machineB).toBe(true);

    const loser = rejected[0] as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(ProfessionalActivationTokenError);
    expect((loser.reason as ProfessionalActivationTokenError).reason).toBe('consumed');

    const hash = hashProfessionalActivationToken(issued.token);
    const row = await sql<{
      status: string;
      bound_machine_id: string | null;
      cnt: string;
    }>(
      `SELECT status, bound_machine_id, 1::text as cnt
         FROM public.master_professional_activation_tokens
        WHERE token_hash = $1`,
      [hash],
    );
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].status).toBe('consumed');
    expect(row.rows[0].bound_machine_id).toBe(winner.boundMachineId);

    // Sem segundo binding no token store
    const consumedCount = await sql<{ n: string }>(
      `SELECT count(*)::text as n FROM public.master_professional_activation_tokens
        WHERE deployment_id = $1 AND status = 'consumed'`,
      [deploymentId],
    );
    expect(Number(consumedCount.rows[0].n)).toBe(1);
  });

  it('replay após consumo → rejeitado; sem segundo binding', async () => {
    const issued = await issueProfessionalActivationToken(
      {
        tenantId: `tn_replay_${Date.now()}`,
        deploymentId: `dep_replay_${Date.now()}`,
        companyLicenseId: `lic_replay_${Date.now()}`,
      },
      sql,
    );
    const machineId = `mid_${'r'.repeat(24)}`;
    await consumeProfessionalActivationToken(issued.token, machineId, sql);
    await expect(
      consumeProfessionalActivationToken(issued.token, machineId, sql),
    ).rejects.toMatchObject({ reason: 'consumed' });

    const hash = hashProfessionalActivationToken(issued.token);
    const row = await sql<{ status: string; bound_machine_id: string }>(
      `SELECT status, bound_machine_id FROM public.master_professional_activation_tokens WHERE token_hash = $1`,
      [hash],
    );
    expect(row.rows[0].status).toBe('consumed');
    expect(row.rows[0].bound_machine_id).toBe(machineId);
  });
});

describe('ProfessionalActivation PG infra gate', () => {
  it('documenta disponibilidade do PostgreSQL real', () => {
    if (!localPg) {
      console.warn(
        'BLOCKED_BY_TEST_INFRA: ProgramData PontoWebDesk secrets/PG :55432 indisponível — concurrency PG skipped',
      );
    }
    // Sempre passa: o describePg acima já skipa se necessário.
    expect(true).toBe(true);
  });
});
