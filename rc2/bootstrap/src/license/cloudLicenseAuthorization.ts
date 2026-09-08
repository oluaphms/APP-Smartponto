/**
 * Snapshot local da autorização Cloud (sem senhas / JWT / pac_* em texto no arquivo público).
 * O activationToken fica em SecretsStore.
 */
import fs from 'node:fs';
import path from 'node:path';

export type CloudLicenseAuthorizationDocument = {
  version: 1;
  tenantId: string;
  deploymentId: string;
  companyLicenseId: string;
  machineId: string;
  licenseStatus: string;
  expiresAt: string | null;
  offlineUntil: string;
  offlineGraceMs: number;
  plan: string | null;
  lastValidatedAt: string;
  /** Quando Cloud respondeu revoked/blocked explicitamente. */
  cloudRevokedAt?: string | null;
  cloudBlockReason?: string | null;
};

export class CloudLicenseAuthorizationStore {
  constructor(private readonly filePath: string) {}

  load(): CloudLicenseAuthorizationDocument | null {
    if (!fs.existsSync(this.filePath)) return null;
    const raw = fs.readFileSync(this.filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw) as CloudLicenseAuthorizationDocument;
  }

  save(doc: CloudLicenseAuthorizationDocument): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  }
}
