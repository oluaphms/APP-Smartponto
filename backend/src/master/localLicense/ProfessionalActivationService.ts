/**
 * Ativação / revalidação Professional Local ↔ Master Cloud (hardened).
 *
 * Autorização real no domain layer:
 *   consume/authenticate pac_* → validar tenant/deployment/license do TOKEN
 *   → binding (activate) ou heartbeat (revalidate)
 *
 * MachineId / hardwareHash / licenseKey comercial NÃO autenticam.
 * Política hardware: 1ª ativação grava hash; revalidate rejeita mismatch
 * (LocalLicenseManager.validateOffline).
 */
import { conflict, invalid, notFound } from '../errors.js';
import type { LicenseManagerService } from '../licenseManager/LicenseManagerService.js';
import type { CompanyLicense, LicenseStatus } from '../licenseManager/types.js';
import type { TenantDeploymentManager } from '../deploymentManager/TenantDeploymentManager.js';
import type { TenantDeployment } from '../deploymentManager/types.js';
import type { LocalLicenseManager } from './LocalLicenseManager.js';
import { LOCAL_LICENSE_OFFLINE_GRACE_MS, offlineUntilIso } from './offlineGrace.js';
import type {
  ProfessionalActivationRequest,
  ProfessionalActivationResponse,
  ProfessionalLicenseCloudStatus,
  ProfessionalRevalidateRequest,
} from './professionalActivation.types.js';
import type { ProfessionalActivationTokenIdentity } from './professionalActivationToken.js';
import {
  ProfessionalActivationTokenError,
  redactActivationSecrets,
} from './professionalActivationToken.js';

export type ProfessionalActivationTokenPort = {
  peekForActivation(token: string): Promise<ProfessionalActivationTokenIdentity | null>;
  diagnose(
    token: string,
  ): Promise<'invalid' | 'expired' | 'revoked' | 'consumed' | 'active'>;
  consumeForActivation(
    token: string,
    machineId: string,
  ): Promise<ProfessionalActivationTokenIdentity>;
  authenticateForRevalidate(
    token: string,
  ): Promise<ProfessionalActivationTokenIdentity | null>;
  /**
   * Compensação CONSUMED→ACTIVE apenas se não houver binding.
   * Retorna true se reabriu o token.
   */
  compensateUnconsume?(tokenId: string, machineId: string): Promise<boolean>;
};

export type ProfessionalActivationServiceOptions = {
  /**
   * Quando presente (Cloud/PG), consume+binding+touch entram na mesma TX Master.
   * Rollback automático se applyCloudBinding falhar.
   */
  runInTransaction?: <T>(fn: () => Promise<T>) => Promise<T>;
};

function mapCommercialStatus(status: LicenseStatus, revoked: boolean): ProfessionalLicenseCloudStatus {
  if (revoked) return 'revoked';
  if (status === 'Bloqueada') return 'blocked';
  if (status === 'Expirada') return 'expired';
  if (status === 'Trial') return 'trial';
  if (status === 'Ativa') return 'active';
  return 'invalid';
}

function assertActivationEligible(lic: CompanyLicense): void {
  if (lic.mode !== 'LOCAL' && lic.mode !== 'HYBRID') {
    throw invalid('license mode must be LOCAL or HYBRID for Professional activation');
  }
  if (lic.status === 'Bloqueada') {
    throw conflict('license is blocked');
  }
  if (lic.status === 'Expirada') {
    throw conflict('license is expired');
  }
  if (lic.status !== 'Ativa' && lic.status !== 'Trial') {
    throw conflict(`license status not eligible for activation: ${lic.status}`);
  }
}

function assertDeploymentEligible(deployment: TenantDeployment): void {
  if (deployment.meta && deployment.meta.activationRevoked === true) {
    throw conflict('deployment activation revoked');
  }
}

/**
 * Isolamento: identidade do token é a única fonte de tenant/deployment/license.
 * Qualquer divergência com o estado persistido → unauthorized (sem vazar IDs).
 */
function assertTokenContextIsolation(
  identity: ProfessionalActivationTokenIdentity,
  company: CompanyLicense,
  deployment: TenantDeployment,
): void {
  if (company.id !== identity.companyLicenseId) {
    throw new ProfessionalActivationUnauthorizedError('token license mismatch');
  }
  if (company.tenantId !== identity.tenantId) {
    throw new ProfessionalActivationUnauthorizedError('token tenant mismatch');
  }
  if (deployment.id !== identity.deploymentId) {
    throw new ProfessionalActivationUnauthorizedError('token deployment mismatch');
  }
  if (deployment.tenantId !== identity.tenantId) {
    throw new ProfessionalActivationUnauthorizedError('token deployment tenant mismatch');
  }
  if (deployment.tenantId !== company.tenantId) {
    throw new ProfessionalActivationUnauthorizedError('tenant context mismatch');
  }
}

export class ProfessionalActivationUnauthorizedError extends Error {
  readonly code = 'PROFESSIONAL_ACTIVATION_UNAUTHORIZED';
  constructor(message = 'invalid or missing activation token') {
    super(redactActivationSecrets(message));
    this.name = 'ProfessionalActivationUnauthorizedError';
  }
}

function mapTokenError(err: ProfessionalActivationTokenError): Error {
  if (err.reason === 'invalid') {
    return new ProfessionalActivationUnauthorizedError();
  }
  if (err.reason === 'expired') {
    return new ProfessionalActivationUnauthorizedError('activation token expired');
  }
  if (err.reason === 'revoked') {
    return new ProfessionalActivationUnauthorizedError('activation token revoked');
  }
  if (err.reason === 'consumed') {
    return conflict('activation token already consumed');
  }
  if (err.reason === 'bound_other_machine') {
    return conflict('activation token already bound to another machineId');
  }
  return new ProfessionalActivationUnauthorizedError();
}

function mapDiagnose(
  d: 'invalid' | 'expired' | 'revoked' | 'consumed' | 'active',
): Error {
  if (d === 'expired') return new ProfessionalActivationUnauthorizedError('activation token expired');
  if (d === 'revoked') return new ProfessionalActivationUnauthorizedError('activation token revoked');
  if (d === 'consumed') return conflict('activation token already consumed');
  return new ProfessionalActivationUnauthorizedError();
}

export class ProfessionalActivationService {
  constructor(
    private readonly localLicenses: LocalLicenseManager,
    private readonly companyLicenses: LicenseManagerService,
    private readonly deployments: TenantDeploymentManager,
    private readonly tokens: ProfessionalActivationTokenPort,
    private readonly clock: () => number = () => Date.now(),
    private readonly options: ProfessionalActivationServiceOptions = {},
  ) {}

  private buildResponse(input: {
    company: CompanyLicense;
    deploymentId: string;
    machineId: string;
    revoked: boolean;
  }): ProfessionalActivationResponse {
    const now = this.clock();
    return {
      activated: true,
      licenseStatus: mapCommercialStatus(input.company.status, input.revoked),
      tenantId: input.company.tenantId,
      deploymentId: input.deploymentId,
      companyLicenseId: input.company.id,
      machineId: input.machineId,
      expiresAt: input.company.expiresAt,
      offlineUntil: offlineUntilIso(now),
      offlineGraceMs: LOCAL_LICENSE_OFFLINE_GRACE_MS,
      plan: input.company.plan ?? null,
    };
  }

  private async loadTrustedContext(identity: ProfessionalActivationTokenIdentity): Promise<{
    company: CompanyLicense;
    deployment: TenantDeployment;
  }> {
    let company: CompanyLicense;
    try {
      company = await this.companyLicenses.get(identity.companyLicenseId);
    } catch {
      throw new ProfessionalActivationUnauthorizedError('token license mismatch');
    }

    let deployment: TenantDeployment;
    try {
      deployment = await this.deployments.get(identity.deploymentId);
    } catch {
      throw notFound('tenant_deployment', identity.deploymentId);
    }

    assertTokenContextIsolation(identity, company, deployment);
    return { company, deployment };
  }

  private async touchDeployment(
    deploymentId: string,
    company: CompanyLicense,
    machineId: string,
    version: string | null | undefined,
    kind: 'activation' | 'revalidate',
  ): Promise<void> {
    const nowIso = new Date(this.clock()).toISOString();
    await this.deployments.update(deploymentId, {
      mode: 'LOCAL',
      status: 'healthy',
      version: version?.trim() || undefined,
      license: {
        bound: true,
        tier: company.plan,
        expiresAt: company.expiresAt,
      },
      server: {
        host: null,
        environment: 'local',
        lastSeenAt: nowIso,
      },
      meta: {
        machineId,
        companyLicenseId: company.id,
        tenantId: company.tenantId,
        ...(kind === 'activation'
          ? { lastActivationAt: nowIso }
          : { lastRevalidateAt: nowIso }),
      },
    });
  }

  /**
   * Primeira ativação — consumo atômico do pac_* (one-shot).
   * Replay / segundo activate → rejeitado.
   * Contexto (tenant/deployment/license) vem só do token.
   */
  async activate(input: ProfessionalActivationRequest): Promise<ProfessionalActivationResponse> {
    const activationToken = String(input.activationToken || '').trim();
    const machineId = String(input.machineId || '').trim();
    const hardwareHash = String(input.hardwareHash || '').trim();
    if (!activationToken) throw new ProfessionalActivationUnauthorizedError();
    if (activationToken.startsWith('uag_')) {
      throw new ProfessionalActivationUnauthorizedError();
    }
    if (!machineId) throw invalid('machineId is required');
    if (!hardwareHash) throw invalid('hardwareHash is required');
    if (!machineId.startsWith('mid_')) throw invalid('machineId format invalid');

    const peeked = await this.tokens.peekForActivation(activationToken);
    if (!peeked) {
      throw mapDiagnose(await this.tokens.diagnose(activationToken));
    }

    const { company, deployment } = await this.loadTrustedContext(peeked);
    assertActivationEligible(company);
    assertDeploymentEligible(deployment);

    const bindingKey = `depbind_${peeked.deploymentId}`;
    const existingByKey = await this.localLicenses.getByLicenseKey(bindingKey);
    if (existingByKey && existingByKey.machineId !== machineId) {
      throw conflict('deployment already bound to another machineId');
    }

    const runBind = async (): Promise<ProfessionalActivationResponse> => {
      let identity: ProfessionalActivationTokenIdentity;
      try {
        identity = await this.tokens.consumeForActivation(activationToken, machineId);
      } catch (err) {
        if (err instanceof ProfessionalActivationTokenError) throw mapTokenError(err);
        throw err;
      }

      assertTokenContextIsolation(identity, company, deployment);

      try {
        const saved = await this.localLicenses.applyCloudBinding({
          machineId,
          licenseKey: bindingKey,
          hardwareHash,
          expirationDate: company.expiresAt,
          plan: company.plan,
          meta: {
            tenantId: company.tenantId,
            companyLicenseId: company.id,
            deploymentId: identity.deploymentId,
            activationTokenId: identity.tokenId,
            empresa: company.empresa,
          },
        });

        await this.touchDeployment(
          identity.deploymentId,
          company,
          machineId,
          input.version,
          'activation',
        );

        const latestCompany = await this.companyLicenses.get(company.id);
        return this.buildResponse({
          company: latestCompany,
          deploymentId: identity.deploymentId,
          machineId,
          revoked: this.localLicenses.isRevoked(saved),
        });
      } catch (bindErr) {
        // Compensação: só se não houver binding criado (evita reabrir token com binding).
        const bound =
          (await this.localLicenses.getByMachineId(machineId)) ||
          (await this.localLicenses.getByLicenseKey(bindingKey));
        if (!bound && this.tokens.compensateUnconsume) {
          await this.tokens.compensateUnconsume(identity.tokenId, machineId);
        }
        throw bindErr;
      }
    };

    if (this.options.runInTransaction) {
      return this.options.runInTransaction(runBind);
    }
    return runBind();
  }

  /**
   * Revalidação — NÃO cria binding novo; NÃO troca tenant/deployment/license.
   * Exige pac_* consumed + MachineId já associado.
   *
   * Política hardwareHash (existente): mismatch → reject.
   */
  async revalidate(input: ProfessionalRevalidateRequest): Promise<ProfessionalActivationResponse> {
    const activationToken = String(input.activationToken || '').trim();
    const machineId = String(input.machineId || '').trim();
    const hardwareHash = String(input.hardwareHash || '').trim();
    if (!activationToken) throw new ProfessionalActivationUnauthorizedError();
    if (activationToken.startsWith('uag_')) {
      throw new ProfessionalActivationUnauthorizedError();
    }
    if (!machineId) throw invalid('machineId is required');
    if (!hardwareHash) throw invalid('hardwareHash is required');

    const identity = await this.tokens.authenticateForRevalidate(activationToken);
    if (!identity) {
      throw new ProfessionalActivationUnauthorizedError();
    }

    if (!identity.boundMachineId) {
      throw conflict('installation not activated yet');
    }
    if (identity.boundMachineId !== machineId) {
      throw conflict('machineId does not match activation binding');
    }

    const { company, deployment } = await this.loadTrustedContext(identity);
    assertDeploymentEligible(deployment);

    const localRow = await this.localLicenses.getByMachineId(machineId);
    if (!localRow) {
      throw conflict('installation not activated yet');
    }
    if (this.localLicenses.isRevoked(localRow)) {
      throw conflict('license is revoked');
    }

    // Não permitir troca de contexto no registro local
    const metaTenant = localRow.meta?.tenantId;
    const metaDep = localRow.meta?.deploymentId;
    const metaLic = localRow.meta?.companyLicenseId;
    if (typeof metaTenant === 'string' && metaTenant && metaTenant !== identity.tenantId) {
      throw new ProfessionalActivationUnauthorizedError('token tenant mismatch');
    }
    if (typeof metaDep === 'string' && metaDep && metaDep !== identity.deploymentId) {
      throw new ProfessionalActivationUnauthorizedError('token deployment mismatch');
    }
    if (typeof metaLic === 'string' && metaLic && metaLic !== identity.companyLicenseId) {
      throw new ProfessionalActivationUnauthorizedError('token license mismatch');
    }

    if (company.status === 'Bloqueada') throw conflict('license is blocked');
    if (company.status === 'Expirada') throw conflict('license is expired');
    if (company.status !== 'Ativa' && company.status !== 'Trial') {
      throw conflict(`license status not eligible: ${company.status}`);
    }

    const offline = await this.localLicenses.validateOffline(machineId, hardwareHash, {
      heartbeatMaxAgeMs: null,
      now: this.clock(),
    });
    if (!offline.ok && offline.status === 'hardware_mismatch') {
      throw conflict('hardware_mismatch');
    }
    if (!offline.ok && offline.status === 'missing') {
      throw conflict('installation not activated yet');
    }

    await this.localLicenses.heartbeat(machineId);
    await this.touchDeployment(
      identity.deploymentId,
      company,
      machineId,
      input.version,
      'revalidate',
    );

    await this.localLicenses.applyCloudBinding({
      machineId,
      licenseKey: localRow.licenseKey,
      hardwareHash,
      expirationDate: company.expiresAt,
      plan: company.plan,
      meta: {
        ...(localRow.meta || {}),
        tenantId: company.tenantId,
        companyLicenseId: company.id,
        deploymentId: identity.deploymentId,
      },
    });

    return this.buildResponse({
      company,
      deploymentId: identity.deploymentId,
      machineId,
      revoked: false,
    });
  }
}
