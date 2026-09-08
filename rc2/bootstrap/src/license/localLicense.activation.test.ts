// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { evaluateLocalCloudAuthorization } from './evaluateLocalCloudAuthorization.js';
import type { CloudLicenseAuthorizationDocument } from './cloudLicenseAuthorization.js';
import { MachineIdentityStore, deriveMachineId, deriveHardwareHash } from './machineIdentity.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function auth(partial: Partial<CloudLicenseAuthorizationDocument>): CloudLicenseAuthorizationDocument {
  const now = Date.now();
  return {
    version: 1,
    tenantId: 'tn_x',
    deploymentId: 'dep_x',
    companyLicenseId: 'lic_x',
    machineId: 'mid_x',
    licenseStatus: 'active',
    expiresAt: new Date(now + 86_400_000).toISOString(),
    offlineUntil: new Date(now + 7 * 86_400_000).toISOString(),
    offlineGraceMs: 7 * 86_400_000,
    plan: 'ANNUAL',
    lastValidatedAt: new Date(now).toISOString(),
    ...partial,
  };
}

describe('evaluateLocalCloudAuthorization', () => {
  it('permite dentro da tolerância offline', () => {
    const d = evaluateLocalCloudAuthorization(auth({}));
    expect(d.allow).toBe(true);
  });

  it('Cloud revoked explícito → bloqueia (≠ network)', () => {
    const d = evaluateLocalCloudAuthorization(
      auth({ cloudRevokedAt: new Date().toISOString(), cloudBlockReason: 'revoked by master' }),
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.mode).toBe('revoked');
  });

  it('offlineUntil expirado → offline_exceeded', () => {
    const d = evaluateLocalCloudAuthorization(
      auth({ offlineUntil: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.mode).toBe('offline_exceeded');
  });
});

describe('MachineIdentityStore', () => {
  it('persiste MachineId estável entre loadOrCreate', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwd-mid-'));
    const file = path.join(dir, 'machine-identity.json');
    const a = new MachineIdentityStore(file).loadOrCreate();
    const b = new MachineIdentityStore(file).loadOrCreate();
    expect(a.machineId).toBe(b.machineId);
    expect(a.machineId.startsWith('mid_')).toBe(true);
    expect(deriveMachineId(['seed:abc']).startsWith('mid_')).toBe(true);
    expect(deriveHardwareHash(['seed:abc']).length).toBe(64);
  });
});
