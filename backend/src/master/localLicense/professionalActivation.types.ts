/**
 * Contratos de ativação / revalidação Professional ↔ Master Cloud.
 * Autorização = pac_* (activation token). MachineId NÃO é segredo.
 * licenseKey comercial NÃO autentica.
 */

export type ProfessionalActivationRequest = {
  /** Credencial de instalação (pac_*). Obrigatória. */
  activationToken: string;
  machineId: string;
  hardwareHash: string;
  version?: string | null;
};

export type ProfessionalLicenseCloudStatus =
  | 'active'
  | 'trial'
  | 'expired'
  | 'revoked'
  | 'blocked'
  | 'invalid';

export type ProfessionalActivationResponse = {
  activated: boolean;
  licenseStatus: ProfessionalLicenseCloudStatus;
  tenantId: string;
  deploymentId: string;
  companyLicenseId: string;
  machineId: string;
  expiresAt: string | null;
  offlineUntil: string;
  offlineGraceMs: number;
  plan: string | null;
};

export type ProfessionalRevalidateRequest = {
  activationToken: string;
  machineId: string;
  hardwareHash: string;
  version?: string | null;
};
