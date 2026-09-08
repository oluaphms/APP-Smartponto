/**
 * Política única de tolerância offline (licença Professional).
 * Fonte canônica — não espalhar magic numbers.
 */

/** 7 dias — alinhado ao default histórico de LocalLicenseManager.validateOffline. */
export const LOCAL_LICENSE_OFFLINE_GRACE_MS = 7 * 86_400_000;

export function offlineUntilIso(fromMs = Date.now(), graceMs = LOCAL_LICENSE_OFFLINE_GRACE_MS): string {
  return new Date(fromMs + graceMs).toISOString();
}
