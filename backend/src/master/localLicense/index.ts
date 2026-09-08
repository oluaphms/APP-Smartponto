export type {
  MachineId,
  LicenseKey,
  HardwareHash,
  LocalLicenseRecord,
  LocalLicenseValidationStatus,
  LocalLicenseValidationResult,
  IssueLocalLicenseInput,
  BindLocalLicenseInput,
} from './localLicense.types.js';

export type { LocalLicenseStore } from './ports/LocalLicenseStore.js';
export { InMemoryLocalLicenseStore } from './adapters/InMemoryLocalLicenseStore.js';
export {
  deriveMachineId,
  deriveHardwareHash,
  generateLicenseKey,
  type HardwareFingerprintInput,
} from './localLicense.fingerprint.js';
export { validateOffline } from './localLicense.validator.js';
export { LocalLicenseManager } from './LocalLicenseManager.js';
export { LOCAL_LICENSE_OFFLINE_GRACE_MS, offlineUntilIso } from './offlineGrace.js';
export {
  ProfessionalActivationService,
  ProfessionalActivationUnauthorizedError,
} from './ProfessionalActivationService.js';
export type {
  ProfessionalActivationRequest,
  ProfessionalActivationResponse,
  ProfessionalRevalidateRequest,
} from './professionalActivation.types.js';
export {
  hashProfessionalActivationToken,
  generateProfessionalActivationToken,
  redactActivationSecrets,
  resolveProfessionalActivationTokenTtlMs,
  DEFAULT_PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS,
  ProfessionalActivationTokenError,
  InMemoryProfessionalActivationTokenStore,
  consumeProfessionalActivationToken,
  compensateUnconsumeActivationToken,
  authenticateProfessionalActivationTokenForRevalidate,
  issueProfessionalActivationToken,
} from './professionalActivationToken.js';
