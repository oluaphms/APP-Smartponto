/**
 * Controllers públicos + emissão Master de ativação Professional.
 * Isolados do UpdateAgent. Não logam nem devolvem plaintext de pac_* em erros.
 */
import type { Request, Response } from 'express';
import { MasterError } from '../../errors.js';
import type { MasterApiRequest } from '../middlewares/requireMasterLogin.js';
import { MasterPlatformService } from '../../../services/master/masterPlatformService.js';
import {
  ProfessionalActivationService,
  ProfessionalActivationUnauthorizedError,
} from '../../localLicense/ProfessionalActivationService.js';
import {
  authenticateProfessionalActivationTokenForRevalidate,
  compensateUnconsumeActivationToken,
  consumeProfessionalActivationToken,
  diagnoseProfessionalActivationToken,
  issueProfessionalActivationToken,
  peekProfessionalActivationToken,
  redactActivationSecrets,
} from '../../localLicense/professionalActivationToken.js';
import { runMasterDomainTransaction } from '../../../db/index.js';
import { logger } from '../../../logger/logger.js';

function pgTokenPort() {
  return {
    peekForActivation: peekProfessionalActivationToken,
    diagnose: diagnoseProfessionalActivationToken,
    consumeForActivation: consumeProfessionalActivationToken,
    authenticateForRevalidate: authenticateProfessionalActivationTokenForRevalidate,
    compensateUnconsume: (tokenId: string, machineId: string) =>
      compensateUnconsumeActivationToken({ tokenId, machineId }),
  };
}

function activationService(): ProfessionalActivationService {
  return new ProfessionalActivationService(
    MasterPlatformService.getLocalLicense(),
    MasterPlatformService.getLicenseManager(),
    MasterPlatformService.getTenantDeployments(),
    pgTokenPort(),
    () => Date.now(),
    { runInTransaction: (fn) => runMasterDomainTransaction(fn) },
  );
}

function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'activation failed';
  return redactActivationSecrets(raw);
}

function sendActivationError(res: Response, error: unknown): void {
  if (error instanceof ProfessionalActivationUnauthorizedError) {
    res.status(401).json({
      ok: false,
      error: error.code,
      message: safeMessage(error),
    });
    return;
  }
  if (error instanceof MasterError) {
    const status =
      error.code === 'MASTER_NOT_FOUND'
        ? 404
        : error.code === 'MASTER_CONFLICT'
          ? 409
          : error.code === 'MASTER_INVALID'
            ? 400
            : 500;
    res.status(status).json({
      ok: false,
      error: error.code,
      message: safeMessage(error),
    });
    return;
  }
  logger.error({
    module: 'master.professionalActivation',
    action: 'ACTIVATION_ERROR',
    message: 'activation failed',
    meta: { safeMessage: safeMessage(error) },
  });
  res.status(500).json({
    ok: false,
    error: 'professional_activation_failed',
    message: 'activation failed',
  });
}

function readActivationToken(req: Request): string {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  return String(body.activationToken ?? '').trim();
}

/** POST /api/master/licenses/professional/activate */
export async function postProfessionalActivate(req: Request, res: Response): Promise<void> {
  try {
    const hasToken = Boolean(readActivationToken(req));
    logger.info({
      module: 'master.professionalActivation',
      action: 'ACTIVATION_STARTED',
      message: 'activation started',
      meta: { hasToken },
    });
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    // Ignorar tenantId/deploymentId/companyLicenseId do body — contexto só do pac_*.
    const result = await activationService().activate({
      activationToken: readActivationToken(req),
      machineId: String(body.machineId ?? ''),
      hardwareHash: String(body.hardwareHash ?? ''),
      version: body.version != null ? String(body.version) : null,
    });
    logger.info({
      module: 'master.professionalActivation',
      action: 'ACTIVATION_SUCCEEDED',
      message: 'activation succeeded',
      meta: {
        tenantId: result.tenantId,
        deploymentId: result.deploymentId,
        machineId: result.machineId,
        licenseStatus: result.licenseStatus,
      },
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.warn({
      module: 'master.professionalActivation',
      action: 'ACTIVATION_FAILED',
      message: 'activation failed',
      meta: {
        code: error instanceof MasterError ? error.code : (error as { code?: string }).code,
        safeMessage: safeMessage(error),
      },
    });
    sendActivationError(res, error);
  }
}

/** POST /api/master/licenses/professional/revalidate */
export async function postProfessionalRevalidate(req: Request, res: Response): Promise<void> {
  try {
    logger.info({
      module: 'master.professionalActivation',
      action: 'LICENSE_VALIDATION_STARTED',
      message: 'license validation started',
      meta: { hasToken: Boolean(readActivationToken(req)) },
    });
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const result = await activationService().revalidate({
      activationToken: readActivationToken(req),
      machineId: String(body.machineId ?? ''),
      hardwareHash: String(body.hardwareHash ?? ''),
      version: body.version != null ? String(body.version) : null,
    });
    logger.info({
      module: 'master.professionalActivation',
      action: 'LICENSE_VALIDATION_SUCCEEDED',
      message: 'license validation succeeded',
      meta: {
        tenantId: result.tenantId,
        deploymentId: result.deploymentId,
        machineId: result.machineId,
        licenseStatus: result.licenseStatus,
      },
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    const msg = safeMessage(error);
    logger.warn({
      module: 'master.professionalActivation',
      action: /revoked|blocked/i.test(msg)
        ? 'LICENSE_REVOKED_OR_BLOCKED'
        : 'LICENSE_VALIDATION_FAILED',
      message: msg,
    });
    sendActivationError(res, error);
  }
}

/** POST /api/master/deployments/:id/activation-token — Master autenticado. */
export async function postIssueProfessionalActivationToken(
  req: MasterApiRequest,
  res: Response,
): Promise<void> {
  try {
    const deploymentId = String(req.params.id || '').trim();
    if (!deploymentId) {
      res.status(400).json({ ok: false, error: 'invalid_id', message: 'deployment id required' });
      return;
    }

    const deployment = await MasterPlatformService.getTenantDeployments().get(deploymentId);
    const license = await MasterPlatformService.getLicenseManager().getByTenantId(
      deployment.tenantId,
    );
    if (!license) {
      res.status(404).json({
        ok: false,
        error: 'MASTER_NOT_FOUND',
        message: 'company license not found for tenant',
      });
      return;
    }
    if (license.mode !== 'LOCAL' && license.mode !== 'HYBRID') {
      res.status(400).json({
        ok: false,
        error: 'MASTER_INVALID',
        message: 'activation token requires LOCAL or HYBRID license',
      });
      return;
    }

    const issued = await issueProfessionalActivationToken({
      tenantId: deployment.tenantId,
      deploymentId: deployment.id,
      companyLicenseId: license.id,
      createdBy: req.masterAuth?.userId ?? null,
    });

    logger.info({
      module: 'master.professionalActivation',
      action: 'ACTIVATION_TOKEN_ISSUED',
      message: 'activation token issued',
      meta: {
        deploymentId: deployment.id,
        tenantId: deployment.tenantId,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      },
    });

    res.status(201).json({
      ok: true,
      tokenId: issued.tokenId,
      activationToken: issued.token,
      expiresAt: issued.expiresAt,
      tenantId: deployment.tenantId,
      deploymentId: deployment.id,
      companyLicenseId: license.id,
    });
  } catch (error) {
    sendActivationError(res, error);
  }
}
