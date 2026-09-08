/**
 * first_run — identificação da instalação + ativação Cloud (se configurada).
 *
 * Internet obrigatória na PRIMEIRA ativação quando RC2_ACTIVATION_TOKEN está presente.
 * Se já ativado: tenta revalidar; falha de rede usa autorização local (offline grace).
 */
import path from 'node:path';
import type { Logger } from '../Logger.js';
import type { BootstrapPaths } from '../types.js';
import { SecretsStore } from '../postgres/SecretsStore.js';
import { MachineIdentityStore } from './machineIdentity.js';
import { CloudLicenseAuthorizationStore } from './cloudLicenseAuthorization.js';
import {
  activateAgainstCloud,
  isCloudActivationConfigured,
  revalidateAgainstCloud,
} from './cloudActivationClient.js';
import { evaluateLocalCloudAuthorization } from './evaluateLocalCloudAuthorization.js';

function activationRequired(): boolean {
  const v = String(process.env.RC2_ACTIVATION_REQUIRED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export async function runProfessionalCloudActivation(input: {
  paths: BootstrapPaths;
  log: Logger;
}): Promise<void> {
  const identityPath = path.join(input.paths.configDir, 'machine-identity.json');
  const authPath = path.join(input.paths.configDir, 'cloud-license-authorization.json');
  const identity = new MachineIdentityStore(identityPath).loadOrCreate();
  input.log.info('machine identity ready', {
    machineId: identity.machineId,
    // não logar hardwareHash completo se sensível demais — ok (não é secret)
  });

  const secretsStore = new SecretsStore(input.paths.secretsFile);
  let secrets = secretsStore.loadOrCreate(55432);
  const envUrl = String(process.env.RC2_CLOUD_MASTER_URL || '').trim();
  const envToken = String(process.env.RC2_ACTIVATION_TOKEN || '').trim();
  secrets = secretsStore.upsertCloudActivation(secrets, {
    cloudMasterUrl: envUrl || secrets.cloudMasterUrl,
    cloudActivationToken: envToken || secrets.cloudActivationToken,
  });

  // Propaga para o cliente HTTP (env do processo).
  if (secrets.cloudMasterUrl) process.env.RC2_CLOUD_MASTER_URL = secrets.cloudMasterUrl;
  if (secrets.cloudActivationToken) process.env.RC2_ACTIVATION_TOKEN = secrets.cloudActivationToken;

  const authStore = new CloudLicenseAuthorizationStore(authPath);
  const existing = authStore.load();

  if (!isCloudActivationConfigured()) {
    if (existing) {
      const decision = evaluateLocalCloudAuthorization(existing);
      input.log.info('cloud activation skipped — using local authorization', {
        mode: decision.allow ? decision.mode : decision.mode,
      });
      return;
    }
    if (activationRequired()) {
      throw new Error(
        'ACTIVATION_REQUIRED: defina RC2_CLOUD_MASTER_URL (https) e RC2_ACTIVATION_TOKEN (pac_*)',
      );
    }
    input.log.warn(
      'cloud activation not configured — Professional segue sem vínculo Cloud (compat)',
    );
    return;
  }

  const token = String(process.env.RC2_ACTIVATION_TOKEN || '').trim();
  const version = String(process.env.RC2_PROFESSIONAL_VERSION || 'professional').trim();

  if (existing && existing.machineId === identity.machineId) {
    input.log.info('license revalidation started', { machineId: identity.machineId });
    const result = await revalidateAgainstCloud({
      activationToken: token,
      machineId: identity.machineId,
      hardwareHash: identity.hardwareHash,
      version,
    });
    if (result.ok) {
      authStore.save(result.authorization);
      input.log.info('license validation succeeded', {
        tenantId: result.authorization.tenantId,
        licenseStatus: result.authorization.licenseStatus,
      });
      return;
    }
    if (result.kind === 'network') {
      const decision = evaluateLocalCloudAuthorization(existing);
      if (decision.allow) {
        input.log.warn('offline mode — cloud unreachable, local grace valid', {
          mode: decision.mode,
        });
        return;
      }
      throw new Error(`ACTIVATION_OFFLINE_EXCEEDED: ${decision.message}`);
    }
    if (result.kind === 'revoked' || result.kind === 'blocked') {
      authStore.save({
        ...existing,
        licenseStatus: result.kind,
        cloudRevokedAt: new Date().toISOString(),
        cloudBlockReason: result.message,
      });
      input.log.warn('license revoked', { kind: result.kind });
      throw new Error(`LICENSE_${result.kind.toUpperCase()}: ${result.message}`);
    }
    throw new Error(`REVALIDATION_FAILED: ${result.message}`);
  }

  input.log.info('activation started', { machineId: identity.machineId });
  const activated = await activateAgainstCloud({
    activationToken: token,
    machineId: identity.machineId,
    hardwareHash: identity.hardwareHash,
    version,
  });
  if (!activated.ok) {
    if (activated.kind === 'network') {
      throw new Error(
        `ACTIVATION_NETWORK: primeira ativação exige internet — ${activated.message}`,
      );
    }
    input.log.warn('activation failed', { kind: activated.kind, message: activated.message });
    throw new Error(`ACTIVATION_FAILED: ${activated.message}`);
  }
  authStore.save(activated.authorization);
  input.log.info('activation succeeded', {
    tenantId: activated.authorization.tenantId,
    deploymentId: activated.authorization.deploymentId,
    licenseStatus: activated.authorization.licenseStatus,
  });
}
