/**
 * Cliente HTTPS de ativação / revalidação Professional → Master Cloud.
 * Não envia senhas, ponto, funcionários ou secrets de DB.
 */
import type { CloudLicenseAuthorizationDocument } from './cloudLicenseAuthorization.js';

export type CloudActivationResult =
  | { ok: true; authorization: CloudLicenseAuthorizationDocument }
  | {
      ok: false;
      kind: 'network' | 'revoked' | 'blocked' | 'rejected' | 'invalid';
      status?: number;
      message: string;
    };

function cloudBaseUrl(): string {
  return String(process.env.RC2_CLOUD_MASTER_URL || '')
    .trim()
    .replace(/\/+$/, '');
}

export function isCloudActivationConfigured(): boolean {
  const url = cloudBaseUrl();
  const token = String(process.env.RC2_ACTIVATION_TOKEN || '').trim();
  return Boolean(url && token.startsWith('pac_'));
}

async function postJson(
  pathSuffix: string,
  body: Record<string, unknown>,
  activationToken: string,
): Promise<{ status: number; json: Record<string, unknown> | null; networkError?: string }> {
  const base = cloudBaseUrl();
  if (!base.startsWith('https://') && !base.startsWith('http://127.0.0.1') && !base.startsWith('http://localhost')) {
    return { status: 0, json: null, networkError: 'RC2_CLOUD_MASTER_URL must be https (or localhost for lab)' };
  }
  try {
    const res = await fetch(`${base}${pathSuffix}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${activationToken}`,
      },
      body: JSON.stringify(body),
    });
    let json: Record<string, unknown> | null = null;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch (err) {
    return {
      status: 0,
      json: null,
      networkError: err instanceof Error ? err.message : String(err),
    };
  }
}

function mapResponse(
  status: number,
  json: Record<string, unknown> | null,
  machineId: string,
): CloudActivationResult {
  if (status === 0) {
    return { ok: false, kind: 'network', message: 'cloud unreachable' };
  }
  const message = String(json?.message || json?.error || `http_${status}`);
  if (status === 401 || status === 403) {
    return { ok: false, kind: 'rejected', status, message };
  }
  if (/revoked/i.test(message)) {
    return { ok: false, kind: 'revoked', status, message };
  }
  if (/blocked/i.test(message)) {
    return { ok: false, kind: 'blocked', status, message };
  }
  if (status >= 400 || !json || json.ok === false) {
    return { ok: false, kind: 'rejected', status, message };
  }
  const authorization: CloudLicenseAuthorizationDocument = {
    version: 1,
    tenantId: String(json.tenantId || ''),
    deploymentId: String(json.deploymentId || ''),
    companyLicenseId: String(json.companyLicenseId || ''),
    machineId: String(json.machineId || machineId),
    licenseStatus: String(json.licenseStatus || 'invalid'),
    expiresAt: json.expiresAt != null ? String(json.expiresAt) : null,
    offlineUntil: String(json.offlineUntil || ''),
    offlineGraceMs: Number(json.offlineGraceMs) || 0,
    plan: json.plan != null ? String(json.plan) : null,
    lastValidatedAt: new Date().toISOString(),
    cloudRevokedAt: null,
    cloudBlockReason: null,
  };
  if (!authorization.tenantId || !authorization.deploymentId) {
    return { ok: false, kind: 'invalid', status, message: 'incomplete activation response' };
  }
  return { ok: true, authorization };
}

export async function activateAgainstCloud(input: {
  activationToken: string;
  machineId: string;
  hardwareHash: string;
  version?: string;
}): Promise<CloudActivationResult> {
  const res = await postJson(
    '/api/master/licenses/professional/activate',
    {
      machineId: input.machineId,
      hardwareHash: input.hardwareHash,
      version: input.version ?? null,
    },
    input.activationToken,
  );
  if (res.networkError) {
    return { ok: false, kind: 'network', message: res.networkError };
  }
  return mapResponse(res.status, res.json, input.machineId);
}

export async function revalidateAgainstCloud(input: {
  activationToken: string;
  machineId: string;
  hardwareHash: string;
  version?: string;
}): Promise<CloudActivationResult> {
  const res = await postJson(
    '/api/master/licenses/professional/revalidate',
    {
      machineId: input.machineId,
      hardwareHash: input.hardwareHash,
      version: input.version ?? null,
    },
    input.activationToken,
  );
  if (res.networkError) {
    return { ok: false, kind: 'network', message: res.networkError };
  }
  return mapResponse(res.status, res.json, input.machineId);
}
