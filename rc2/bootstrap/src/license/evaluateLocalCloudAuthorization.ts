/**
 * Decisão local de autorização Professional.
 * Reutiliza a política de tolerância offline (offlineUntil / offlineGraceMs do Cloud,
 * alinhada a LOCAL_LICENSE_OFFLINE_GRACE_MS / validateOffline).
 *
 * Diferencia:
 * - Cloud indisponível + offline válido → allow
 * - Cloud respondeu revoked/blocked → deny
 */
import type { CloudLicenseAuthorizationDocument } from './cloudLicenseAuthorization.js';

export type LocalAuthDecision =
  | { allow: true; mode: 'active' | 'offline_grace' }
  | {
      allow: false;
      mode: 'revoked' | 'blocked' | 'expired' | 'offline_exceeded' | 'missing';
      message: string;
    };

export function evaluateLocalCloudAuthorization(
  doc: CloudLicenseAuthorizationDocument | null,
  nowMs = Date.now(),
): LocalAuthDecision {
  if (!doc) {
    return { allow: false, mode: 'missing', message: 'cloud license authorization missing' };
  }
  if (doc.cloudRevokedAt) {
    return {
      allow: false,
      mode: 'revoked',
      message: doc.cloudBlockReason || 'license revoked by cloud',
    };
  }
  const status = String(doc.licenseStatus || '').toLowerCase();
  if (status === 'revoked') {
    return { allow: false, mode: 'revoked', message: 'license revoked' };
  }
  if (status === 'blocked') {
    return { allow: false, mode: 'blocked', message: 'license blocked' };
  }
  if (status === 'expired') {
    return { allow: false, mode: 'expired', message: 'license expired' };
  }
  if (doc.expiresAt) {
    const exp = Date.parse(doc.expiresAt);
    if (Number.isFinite(exp) && exp < nowMs) {
      return { allow: false, mode: 'expired', message: 'license expired' };
    }
  }
  const offlineUntil = Date.parse(doc.offlineUntil);
  if (!Number.isFinite(offlineUntil)) {
    return { allow: false, mode: 'missing', message: 'offlineUntil missing' };
  }
  if (nowMs <= offlineUntil) {
    const fresh = Date.parse(doc.lastValidatedAt);
    if (Number.isFinite(fresh) && nowMs - fresh < 60_000) {
      return { allow: true, mode: 'active' };
    }
    return { allow: true, mode: 'offline_grace' };
  }
  return {
    allow: false,
    mode: 'offline_exceeded',
    message: 'offline grace exceeded — revalidation required',
  };
}
