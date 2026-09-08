/**
 * Gate local Professional: diferencia Cloud offline vs revoked explícito.
 * Só age se existir cloud-license-authorization.json (instalação ativada).
 * SaaS Cloud sem esse arquivo → no-op.
 */
import fs from 'node:fs';
import path from 'node:path';

export type ProfessionalLocalGateResult =
  | { enforced: false }
  | { enforced: true; allow: true; mode: string }
  | { enforced: true; allow: false; mode: string; message: string };

type AuthDoc = {
  licenseStatus?: string;
  expiresAt?: string | null;
  offlineUntil?: string;
  lastValidatedAt?: string;
  cloudRevokedAt?: string | null;
  cloudBlockReason?: string | null;
};

function defaultAuthPath(): string {
  const fromEnv = String(process.env.PROFESSIONAL_LICENSE_AUTH_PATH || '').trim();
  if (fromEnv) return fromEnv;
  const programData = process.env.PROGRAMDATA || process.env.RC2_PROGRAM_DATA_ROOT || '';
  if (!programData) return '';
  return path.join(programData, 'PontoWebDesk', 'Config', 'cloud-license-authorization.json');
}

/**
 * Avalia snapshot local (mesma política do bootstrap evaluateLocalCloudAuthorization).
 * Não chama rede.
 */
export function evaluateProfessionalLocalGate(nowMs = Date.now()): ProfessionalLocalGateResult {
  const file = defaultAuthPath();
  if (!file || !fs.existsSync(file)) return { enforced: false };
  let doc: AuthDoc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as AuthDoc;
  } catch {
    return { enforced: false };
  }

  if (doc.cloudRevokedAt) {
    return {
      enforced: true,
      allow: false,
      mode: 'revoked',
      message: doc.cloudBlockReason || 'license revoked by cloud',
    };
  }
  const status = String(doc.licenseStatus || '').toLowerCase();
  if (status === 'revoked') {
    return { enforced: true, allow: false, mode: 'revoked', message: 'license revoked' };
  }
  if (status === 'blocked') {
    return { enforced: true, allow: false, mode: 'blocked', message: 'license blocked' };
  }
  if (status === 'expired') {
    return { enforced: true, allow: false, mode: 'expired', message: 'license expired' };
  }
  if (doc.expiresAt) {
    const exp = Date.parse(doc.expiresAt);
    if (Number.isFinite(exp) && exp < nowMs) {
      return { enforced: true, allow: false, mode: 'expired', message: 'license expired' };
    }
  }
  const offlineUntil = Date.parse(String(doc.offlineUntil || ''));
  if (!Number.isFinite(offlineUntil)) {
    return { enforced: true, allow: false, mode: 'missing', message: 'offlineUntil missing' };
  }
  if (nowMs <= offlineUntil) {
    return { enforced: true, allow: true, mode: 'offline_grace' };
  }
  return {
    enforced: true,
    allow: false,
    mode: 'offline_exceeded',
    message: 'offline grace exceeded — revalidation required',
  };
}
