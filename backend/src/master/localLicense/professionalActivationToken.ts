/**
 * Credencial de ativação Professional (pac_*).
 * Domínio licenciamento — NÃO misturar com UpdateAgent (uag_*).
 *
 * Transições de estado (formais):
 *   (issue)     → ACTIVE (+ expires_at)
 *   ACTIVE      → CONSUMED  (consumo atômico na 1ª ativação + bound_machine_id)
 *   ACTIVE      → REVOKED   (rotação / revoke administrativo)
 *   CONSUMED    → ACTIVE    (SOMENTE compensação: sem row em master_local_licenses
 *                            para o machineId bound — falha pós-consume no binding)
 *   CONSUMED    → REVOKED   (revoke administrativo)
 *   REVOKED     → (terminal; não volta a ACTIVE)
 *   CONSUMED    ↛ novo binding via activate (one-shot)
 *   Revalidate  → exige CONSUMED + bound_machine_id + binding local
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { pool } from '../../db/index.js';
import { runMasterDomainTransaction } from '../../db/index.js';
import type { QueryResult, QueryResultRow } from 'pg';

export type ActivationSqlQuery = <R extends QueryResultRow = QueryResultRow>(
  queryText: string,
  values?: unknown[],
) => Promise<QueryResult<R>>;

const defaultSql: ActivationSqlQuery = (queryText, values) =>
  pool.queryMaster(queryText, values);

export type ProfessionalActivationTokenStatus = 'active' | 'consumed' | 'revoked';

export type ProfessionalActivationTokenIdentity = {
  tokenId: string;
  tenantId: string;
  deploymentId: string;
  companyLicenseId: string;
  boundMachineId: string | null;
  status: ProfessionalActivationTokenStatus;
  expiresAt: string | null;
};

/** Default produção: 72h para janela de instalação. Override: PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS */
export const DEFAULT_PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS = 72;

export function resolveProfessionalActivationTokenTtlMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = String(env.PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS || '').trim();
  const hours = raw ? Number(raw) : DEFAULT_PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS * 3_600_000;
  }
  // Cap de segurança: 30 dias
  const capped = Math.min(hours, 24 * 30);
  return Math.floor(capped * 3_600_000);
}

export function hashProfessionalActivationToken(token: string): string {
  return createHash('sha256').update(String(token || '').trim()).digest('hex');
}

export function generateProfessionalActivationToken(): string {
  return `pac_${randomBytes(32).toString('hex')}`;
}

/** Remove plaintext pac_ / uag_ de strings (logs / erros HTTP). */
export function redactActivationSecrets(text: string): string {
  return String(text || '')
    .replace(/\bpac_[a-f0-9]{16,}\b/gi, 'pac_[REDACTED]')
    .replace(/\buag_[a-f0-9]{16,}\b/gi, 'uag_[REDACTED]');
}

function tokenRowId(): string {
  return `pat_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export type IssueProfessionalActivationTokenInput = {
  tenantId: string;
  deploymentId: string;
  companyLicenseId: string;
  createdBy?: string | null;
  /** Override TTL (ms). Default: resolveProfessionalActivationTokenTtlMs(). */
  ttlMs?: number;
};

export type ConsumeActivationFailureReason =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'consumed'
  | 'bound_other_machine';

export class ProfessionalActivationTokenError extends Error {
  readonly code = 'PROFESSIONAL_ACTIVATION_TOKEN';
  readonly reason: ConsumeActivationFailureReason;

  constructor(reason: ConsumeActivationFailureReason, message?: string) {
    super(message || reason);
    this.name = 'ProfessionalActivationTokenError';
    this.reason = reason;
  }
}

function mapRow(row: {
  id: string;
  tenant_id: string;
  deployment_id: string;
  company_license_id: string;
  bound_machine_id: string | null;
  status: string;
  expires_at: Date | string | null;
}): ProfessionalActivationTokenIdentity {
  return {
    tokenId: row.id,
    tenantId: row.tenant_id,
    deploymentId: row.deployment_id,
    companyLicenseId: row.company_license_id,
    boundMachineId: row.bound_machine_id,
    status: row.status as ProfessionalActivationTokenStatus,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

/**
 * Emite token. Revoga active anteriores do mesmo deployment (rotação).
 * Plaintext retornado uma vez — nunca gravado.
 */
export async function issueProfessionalActivationToken(
  input: IssueProfessionalActivationTokenInput,
  sql: ActivationSqlQuery = defaultSql,
): Promise<{ token: string; tokenId: string; expiresAt: string }> {
  const tenantId = String(input.tenantId || '').trim();
  const deploymentId = String(input.deploymentId || '').trim();
  const companyLicenseId = String(input.companyLicenseId || '').trim();
  if (!tenantId || !deploymentId || !companyLicenseId) {
    throw new Error('tenantId, deploymentId and companyLicenseId are required');
  }

  const token = generateProfessionalActivationToken();
  const hash = hashProfessionalActivationToken(token);
  const id = tokenRowId();
  const ttlMs = input.ttlMs ?? resolveProfessionalActivationTokenTtlMs();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const run = async () => {
    await sql(
      `UPDATE public.master_professional_activation_tokens
          SET status = 'revoked', revoked_at = now()
        WHERE deployment_id = $1 AND status = 'active'`,
      [deploymentId],
    );

    await sql(
      `INSERT INTO public.master_professional_activation_tokens (
         id, tenant_id, deployment_id, company_license_id, token_hash, status,
         created_by, expires_at
       ) VALUES ($1,$2,$3,$4,$5,'active',$6,$7)`,
      [id, tenantId, deploymentId, companyLicenseId, hash, input.createdBy ?? null, expiresAt],
    );
  };

  if (sql === defaultSql) {
    await runMasterDomainTransaction(async () => run());
  } else {
    await run();
  }

  return { token, tokenId: id, expiresAt };
}

export async function diagnoseProfessionalActivationToken(
  presented: string,
): Promise<'invalid' | 'expired' | 'revoked' | 'consumed' | 'active'> {
  const token = String(presented || '').trim();
  if (!token.startsWith('pac_')) return 'invalid';
  const hash = hashProfessionalActivationToken(token);
  const existing = await pool.queryMaster<{
    status: string;
    expires_at: Date | string | null;
  }>(
    `SELECT status, expires_at
       FROM public.master_professional_activation_tokens
      WHERE token_hash = $1
      LIMIT 1`,
    [hash],
  );
  const row = existing.rows[0];
  if (!row) return 'invalid';
  if (row.status === 'revoked') return 'revoked';
  if (row.status === 'consumed') return 'consumed';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  if (row.status === 'active') return 'active';
  return 'invalid';
}

/**
 * Peek sem consumir — active + não expirado.
 */
export async function peekProfessionalActivationToken(
  presented: string,
): Promise<ProfessionalActivationTokenIdentity | null> {
  const token = String(presented || '').trim();
  if (!token.startsWith('pac_')) return null;
  const hash = hashProfessionalActivationToken(token);
  const result = await pool.queryMaster<{
    id: string;
    tenant_id: string;
    deployment_id: string;
    company_license_id: string;
    bound_machine_id: string | null;
    status: string;
    expires_at: Date | string | null;
    token_hash: string;
  }>(
    `SELECT id, tenant_id, deployment_id, company_license_id, bound_machine_id,
            status, expires_at, token_hash
       FROM public.master_professional_activation_tokens
      WHERE token_hash = $1
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1`,
    [hash],
  );
  const row = result.rows[0];
  if (!row) return null;
  const a = Buffer.from(hash);
  const b = Buffer.from(String(row.token_hash));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return mapRow(row);
}

/**
 * Consumo atômico: active → consumed + bound_machine_id.
 * Duas corridas: apenas uma vence (RETURNING).
 */
export async function consumeProfessionalActivationToken(
  presented: string,
  machineId: string,
  sql: ActivationSqlQuery = defaultSql,
): Promise<ProfessionalActivationTokenIdentity> {
  const token = String(presented || '').trim();
  const mid = String(machineId || '').trim();
  if (!token.startsWith('pac_') || !mid) {
    throw new ProfessionalActivationTokenError('invalid');
  }
  const hash = hashProfessionalActivationToken(token);

  const result = await sql<{
    id: string;
    tenant_id: string;
    deployment_id: string;
    company_license_id: string;
    bound_machine_id: string | null;
    status: string;
    expires_at: Date | string | null;
  }>(
    `UPDATE public.master_professional_activation_tokens
        SET status = 'consumed',
            bound_machine_id = $2,
            consumed_at = now(),
            last_used_at = now()
      WHERE token_hash = $1
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
        AND bound_machine_id IS NULL
      RETURNING id, tenant_id, deployment_id, company_license_id, bound_machine_id, status, expires_at`,
    [hash, mid],
  );

  if (result.rows[0]) {
    return mapRow(result.rows[0]);
  }

  const existing = await sql<{
    status: string;
    expires_at: Date | string | null;
    bound_machine_id: string | null;
  }>(
    `SELECT status, expires_at, bound_machine_id
       FROM public.master_professional_activation_tokens
      WHERE token_hash = $1
      LIMIT 1`,
    [hash],
  );
  const row = existing.rows[0];
  if (!row) throw new ProfessionalActivationTokenError('invalid');
  if (row.status === 'revoked') throw new ProfessionalActivationTokenError('revoked');
  if (row.status === 'consumed') throw new ProfessionalActivationTokenError('consumed');
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ProfessionalActivationTokenError('expired');
  }
  if (row.bound_machine_id && row.bound_machine_id !== mid) {
    throw new ProfessionalActivationTokenError('bound_other_machine');
  }
  throw new ProfessionalActivationTokenError('invalid');
}

/**
 * Compensação controlada: CONSUMED → ACTIVE somente se:
 * - status=consumed
 * - bound_machine_id = machineId informado
 * - NÃO existe binding em master_local_licenses para esse machineId
 *
 * Nunca reabre token se já houver binding (evita double-bind).
 * Transição documentada: CONSUMED→ACTIVE (compensação pós-falha de binding).
 */
export async function compensateUnconsumeActivationToken(input: {
  tokenId: string;
  machineId: string;
  sql?: ActivationSqlQuery;
}): Promise<boolean> {
  const sql = input.sql ?? defaultSql;
  const tokenId = String(input.tokenId || '').trim();
  const machineId = String(input.machineId || '').trim();
  if (!tokenId || !machineId) return false;

  const result = await sql<{ id: string }>(
    `UPDATE public.master_professional_activation_tokens t
        SET status = 'active',
            bound_machine_id = NULL,
            consumed_at = NULL,
            last_used_at = now()
      WHERE t.id = $1
        AND t.status = 'consumed'
        AND t.bound_machine_id = $2
        AND NOT EXISTS (
          SELECT 1 FROM public.master_local_licenses l
           WHERE l.machine_id = $2
        )
      RETURNING t.id`,
    [tokenId, machineId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Revalidação: token já consumido + MachineId bound.
 * TTL de emissão NÃO invalida pós-consumo; revoke sim.
 */
export async function authenticateProfessionalActivationTokenForRevalidate(
  presented: string,
): Promise<ProfessionalActivationTokenIdentity | null> {
  const token = String(presented || '').trim();
  if (!token.startsWith('pac_')) return null;
  const hash = hashProfessionalActivationToken(token);
  const result = await pool.queryMaster<{
    id: string;
    tenant_id: string;
    deployment_id: string;
    company_license_id: string;
    bound_machine_id: string | null;
    status: string;
    expires_at: Date | string | null;
    token_hash: string;
  }>(
    `SELECT id, tenant_id, deployment_id, company_license_id, bound_machine_id,
            status, expires_at, token_hash
       FROM public.master_professional_activation_tokens
      WHERE token_hash = $1
        AND status = 'consumed'
        AND bound_machine_id IS NOT NULL
      LIMIT 1`,
    [hash],
  );
  const row = result.rows[0];
  if (!row) return null;
  const a = Buffer.from(hash);
  const b = Buffer.from(String(row.token_hash));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await pool.queryMaster(
    `UPDATE public.master_professional_activation_tokens SET last_used_at = now() WHERE id = $1`,
    [row.id],
  );
  return mapRow(row);
}

/** @deprecated Prefer consume / authenticateForRevalidate — mantido só se algum caller legado. */
export async function authenticateProfessionalActivationToken(
  presented: string,
): Promise<ProfessionalActivationTokenIdentity | null> {
  return authenticateProfessionalActivationTokenForRevalidate(presented);
}

export async function bindProfessionalActivationTokenMachine(
  tokenId: string,
  machineId: string,
): Promise<void> {
  await pool.queryMaster(
    `UPDATE public.master_professional_activation_tokens
        SET bound_machine_id = $2, last_used_at = now()
      WHERE id = $1 AND status IN ('active', 'consumed')`,
    [tokenId, machineId],
  );
}

type MemRow = ProfessionalActivationTokenIdentity & {
  hash: string;
};

/**
 * Store em memória para testes — espelha semântica PG (TTL + consume atômico).
 * Nunca guarda plaintext do pac_*.
 */
export class InMemoryProfessionalActivationTokenStore {
  private readonly byHash = new Map<string, MemRow>();
  private readonly lockChains = new Map<string, Promise<unknown>>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  issue(
    input: IssueProfessionalActivationTokenInput,
  ): { token: string; tokenId: string; expiresAt: string } {
    for (const [h, row] of this.byHash) {
      if (row.deploymentId === input.deploymentId && row.status === 'active') {
        this.byHash.set(h, { ...row, status: 'revoked' });
      }
    }
    const token = generateProfessionalActivationToken();
    const hash = hashProfessionalActivationToken(token);
    const id = tokenRowId();
    const ttlMs = input.ttlMs ?? resolveProfessionalActivationTokenTtlMs();
    const expiresAt = new Date(this.clock() + ttlMs).toISOString();
    this.byHash.set(hash, {
      tokenId: id,
      tenantId: input.tenantId,
      deploymentId: input.deploymentId,
      companyLicenseId: input.companyLicenseId,
      boundMachineId: null,
      status: 'active',
      expiresAt,
      hash,
    });
    return { token, tokenId: id, expiresAt };
  }

  private withHashLock<T>(hash: string, fn: () => T | Promise<T>): Promise<T> {
    const prev = this.lockChains.get(hash) ?? Promise.resolve();
    const next = prev.then(() => fn(), () => fn());
    this.lockChains.set(
      hash,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }

  /**
   * Classifica falha sem consumir (expired/revoked/consumed/invalid).
   */
  diagnose(presented: string): 'invalid' | 'expired' | 'revoked' | 'consumed' | 'active' {
    const token = String(presented || '').trim();
    if (!token.startsWith('pac_')) return 'invalid';
    const hash = hashProfessionalActivationToken(token);
    const row = this.byHash.get(hash);
    if (!row) return 'invalid';
    if (row.status === 'revoked') return 'revoked';
    if (row.status === 'consumed') return 'consumed';
    if (row.expiresAt && Date.parse(row.expiresAt) <= this.clock()) return 'expired';
    if (row.status === 'active') return 'active';
    return 'invalid';
  }

  /**
   * Lê token active (não consome). Usado para validar contexto antes do consume.
   */
  peekActive(presented: string): ProfessionalActivationTokenIdentity | null {
    const token = String(presented || '').trim();
    if (!token.startsWith('pac_')) return null;
    const hash = hashProfessionalActivationToken(token);
    const row = this.byHash.get(hash);
    if (!row || row.status !== 'active') return null;
    if (row.expiresAt && Date.parse(row.expiresAt) <= this.clock()) return null;
    return {
      tokenId: row.tokenId,
      tenantId: row.tenantId,
      deploymentId: row.deploymentId,
      companyLicenseId: row.companyLicenseId,
      boundMachineId: row.boundMachineId,
      status: row.status,
      expiresAt: row.expiresAt,
    };
  }

  async consume(presented: string, machineId: string): Promise<ProfessionalActivationTokenIdentity> {
    const token = String(presented || '').trim();
    const mid = String(machineId || '').trim();
    if (!token.startsWith('pac_') || !mid) {
      throw new ProfessionalActivationTokenError('invalid');
    }
    const hash = hashProfessionalActivationToken(token);

    return this.withHashLock(hash, () => {
      const row = this.byHash.get(hash);
      if (!row) throw new ProfessionalActivationTokenError('invalid');
      if (row.status === 'revoked') throw new ProfessionalActivationTokenError('revoked');
      if (row.status === 'consumed') throw new ProfessionalActivationTokenError('consumed');
      if (row.expiresAt && Date.parse(row.expiresAt) <= this.clock()) {
        throw new ProfessionalActivationTokenError('expired');
      }
      if (row.boundMachineId) throw new ProfessionalActivationTokenError('bound_other_machine');

      const next: MemRow = {
        ...row,
        status: 'consumed',
        boundMachineId: mid,
      };
      this.byHash.set(hash, next);
      return {
        tokenId: next.tokenId,
        tenantId: next.tenantId,
        deploymentId: next.deploymentId,
        companyLicenseId: next.companyLicenseId,
        boundMachineId: next.boundMachineId,
        status: next.status,
        expiresAt: next.expiresAt,
      };
    });
  }

  authenticateForRevalidate(presented: string): ProfessionalActivationTokenIdentity | null {
    const token = String(presented || '').trim();
    if (!token.startsWith('pac_')) return null;
    const hash = hashProfessionalActivationToken(token);
    const row = this.byHash.get(hash);
    if (!row || row.status !== 'consumed' || !row.boundMachineId) return null;
    return {
      tokenId: row.tokenId,
      tenantId: row.tenantId,
      deploymentId: row.deploymentId,
      companyLicenseId: row.companyLicenseId,
      boundMachineId: row.boundMachineId,
      status: row.status,
      expiresAt: row.expiresAt,
    };
  }

  /** Compensação in-memory: CONSUMED→ACTIVE se sem binding externo marcado. */
  compensateUnconsume(tokenId: string, machineId: string, hasBinding: boolean): boolean {
    if (hasBinding) return false;
    for (const [h, row] of this.byHash) {
      if (row.tokenId === tokenId && row.status === 'consumed' && row.boundMachineId === machineId) {
        this.byHash.set(h, {
          ...row,
          status: 'active',
          boundMachineId: null,
        });
        return true;
      }
    }
    return false;
  }

  /** Força revoke (testes). */
  revokeByToken(presented: string): void {
    const hash = hashProfessionalActivationToken(String(presented || '').trim());
    const row = this.byHash.get(hash);
    if (row) this.byHash.set(hash, { ...row, status: 'revoked' });
  }

  /** Força expiração (testes). */
  expireByToken(presented: string): void {
    const hash = hashProfessionalActivationToken(String(presented || '').trim());
    const row = this.byHash.get(hash);
    if (row) {
      this.byHash.set(hash, {
        ...row,
        expiresAt: new Date(this.clock() - 1000).toISOString(),
      });
    }
  }
}
