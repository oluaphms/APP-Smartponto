// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LicenseManagerService } from '../licenseManager/LicenseManagerService.js';
import { TenantDeploymentManager } from '../deploymentManager/TenantDeploymentManager.js';
import { LocalLicenseManager } from './LocalLicenseManager.js';
import {
  ProfessionalActivationService,
  ProfessionalActivationUnauthorizedError,
} from './ProfessionalActivationService.js';
import {
  InMemoryProfessionalActivationTokenStore,
  redactActivationSecrets,
  resolveProfessionalActivationTokenTtlMs,
  DEFAULT_PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS,
} from './professionalActivationToken.js';
import { LOCAL_LICENSE_OFFLINE_GRACE_MS } from './offlineGrace.js';

/** Espelho mínimo da política offline (mesma precedência do bootstrap). */
function evaluateOfflineSnapshot(
  doc: {
    licenseStatus: string;
    expiresAt: string | null;
    offlineUntil: string;
    cloudRevokedAt?: string | null;
  } | null,
  nowMs = Date.now(),
): { allow: boolean; mode?: string } {
  if (!doc) return { allow: false, mode: 'missing' };
  if (doc.cloudRevokedAt) return { allow: false, mode: 'revoked' };
  const status = String(doc.licenseStatus || '').toLowerCase();
  if (status === 'revoked') return { allow: false, mode: 'revoked' };
  if (status === 'blocked') return { allow: false, mode: 'blocked' };
  if (status === 'expired') return { allow: false, mode: 'expired' };
  if (doc.expiresAt && Date.parse(doc.expiresAt) < nowMs) return { allow: false, mode: 'expired' };
  const offlineUntil = Date.parse(doc.offlineUntil);
  if (!Number.isFinite(offlineUntil)) return { allow: false, mode: 'missing' };
  if (nowMs <= offlineUntil) return { allow: true, mode: 'offline_grace' };
  return { allow: false, mode: 'offline_exceeded' };
}

async function setup(opts?: { ttlMs?: number }) {
  const licenses = LicenseManagerService.createInMemory();
  const deployments = TenantDeploymentManager.createInMemory();
  const local = LocalLicenseManager.createInMemory(licenses);
  const tokens = new InMemoryProfessionalActivationTokenStore();

  const company = await licenses.create({
    tenantId: 'tn_pro_act',
    empresa: 'Cliente Pro',
    mode: 'LOCAL',
    status: 'Ativa',
    plan: 'ANNUAL',
    durationDays: 365,
  });
  const deployment = await deployments.create({
    tenantId: company.tenantId,
    empresa: company.empresa,
    mode: 'LOCAL',
    version: '1.0.0-rc2',
  });
  const issued = tokens.issue({
    tenantId: company.tenantId,
    deploymentId: deployment.id,
    companyLicenseId: company.id,
    ttlMs: opts?.ttlMs,
  });

  const svc = new ProfessionalActivationService(local, licenses, deployments, {
    peekForActivation: async (t) => tokens.peekActive(t),
    diagnose: async (t) => tokens.diagnose(t),
    consumeForActivation: (t, mid) => tokens.consume(t, mid),
    authenticateForRevalidate: async (t) => tokens.authenticateForRevalidate(t),
    compensateUnconsume: async (tokenId, machineId) => {
      const hasBinding = Boolean(await local.getByMachineId(machineId));
      return tokens.compensateUnconsume(tokenId, machineId, hasBinding);
    },
  });

  return { svc, licenses, deployments, local, tokens, company, deployment, issued };
}

describe('ProfessionalActivationService hardening', () => {
  it('1) somente licenseKey → rejeitado', async () => {
    const { svc, company } = await setup();
    const key = String(company.meta?.licenseKey || '');
    expect(key.startsWith('lloc_')).toBe(true);
    await expect(
      svc.activate({
        activationToken: key,
        machineId: 'mid_' + 'd'.repeat(24),
        hardwareHash: 'h',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);
  });

  it('2) pac inválido → rejeitado', async () => {
    const { svc } = await setup();
    await expect(
      svc.activate({
        activationToken: 'pac_deadbeefdeadbeefdeadbeef',
        machineId: 'mid_' + 'c'.repeat(24),
        hardwareHash: 'h',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);
  });

  it('3) pac expirado → rejeitado', async () => {
    const { svc, tokens, issued } = await setup({ ttlMs: 60_000 });
    tokens.expireByToken(issued.token);
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId: 'mid_' + 'e'.repeat(24),
        hardwareHash: 'h',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);
  });

  it('4) pac revogado → rejeitado', async () => {
    const { svc, tokens, issued } = await setup();
    tokens.revokeByToken(issued.token);
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId: 'mid_' + 'v'.repeat(24),
        hardwareHash: 'h',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);
  });

  it('5) pac já consumido → rejeitado na 2ª ativação', async () => {
    const { svc, issued } = await setup();
    const machineId = 'mid_' + '1'.repeat(24);
    await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'h1',
    });
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'h1',
      }),
    ).rejects.toThrow(/already consumed/i);
  });

  it('6) replay concorrente → somente uma ativação', async () => {
    const { svc, issued, local } = await setup();
    const machineA = 'mid_' + 'a'.repeat(24);
    const machineB = 'mid_' + 'b'.repeat(24);
    const results = await Promise.allSettled([
      svc.activate({
        activationToken: issued.token,
        machineId: machineA,
        hardwareHash: 'ha',
      }),
      svc.activate({
        activationToken: issued.token,
        machineId: machineB,
        hardwareHash: 'hb',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r) => r.status === 'rejected');
    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
    const bound = await local.getByMachineId(machineA);
    const other = await local.getByMachineId(machineB);
    expect(Boolean(bound) !== Boolean(other)).toBe(true);
  });

  it('7-9) tenant / deployment / license mismatch → rejeitado', async () => {
    const licenses = LicenseManagerService.createInMemory();
    const deployments = TenantDeploymentManager.createInMemory();
    const local = LocalLicenseManager.createInMemory(licenses);
    const tokens = new InMemoryProfessionalActivationTokenStore();

    const companyA = await licenses.create({
      tenantId: 'tn_a',
      mode: 'LOCAL',
      status: 'Ativa',
    });
    const companyB = await licenses.create({
      tenantId: 'tn_b',
      mode: 'LOCAL',
      status: 'Ativa',
    });
    const depA = await deployments.create({
      tenantId: 'tn_a',
      mode: 'LOCAL',
    });
    await deployments.create({
      tenantId: 'tn_b',
      mode: 'LOCAL',
    });

    // Token mente: companyLicenseId de B com tenant/deployment de A
    const issued = tokens.issue({
      tenantId: 'tn_a',
      deploymentId: depA.id,
      companyLicenseId: companyB.id,
    });
    const svc = new ProfessionalActivationService(local, licenses, deployments, {
      peekForActivation: async (t) => tokens.peekActive(t),
      diagnose: async (t) => tokens.diagnose(t),
      consumeForActivation: (t, mid) => tokens.consume(t, mid),
      authenticateForRevalidate: async (t) => tokens.authenticateForRevalidate(t),
      compensateUnconsume: async (tokenId, machineId) => {
        const hasBinding = Boolean(await local.getByMachineId(machineId));
        return tokens.compensateUnconsume(tokenId, machineId, hasBinding);
      },
    });
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId: 'mid_' + 'x'.repeat(24),
        hardwareHash: 'hx',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);

    // Token com deployment inexistente (escape)
    const issued2 = tokens.issue({
      tenantId: companyA.tenantId,
      deploymentId: 'dep_other',
      companyLicenseId: companyA.id,
    });
    await expect(
      svc.activate({
        activationToken: issued2.token,
        machineId: 'mid_' + 'y'.repeat(24),
        hardwareHash: 'hy',
      }),
    ).rejects.toThrow();
  });

  it('10) deployment revoked → rejeitado', async () => {
    const { svc, deployments, deployment, issued } = await setup();
    await deployments.update(deployment.id, {
      meta: { activationRevoked: true },
    });
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId: 'mid_' + 'q'.repeat(24),
        hardwareHash: 'hq',
      }),
    ).rejects.toThrow(/deployment activation revoked/i);
  });

  it('11) license revoked/blocked → rejeitado', async () => {
    const { svc, licenses, company, issued } = await setup();
    await licenses.action(company.id, 'block');
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId: 'mid_' + 'k'.repeat(24),
        hardwareHash: 'hk',
      }),
    ).rejects.toThrow(/blocked/i);
  });

  it('12) revalidate sem binding → rejeitado', async () => {
    const { svc, issued } = await setup();
    await expect(
      svc.revalidate({
        activationToken: issued.token,
        machineId: 'mid_' + 'n'.repeat(24),
        hardwareHash: 'hn',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);
  });

  it('13) revalidate não cria binding; activate cria uma vez', async () => {
    const { svc, issued, local } = await setup();
    const machineId = 'mid_' + 'r'.repeat(24);
    expect(await local.getByMachineId(machineId)).toBeNull();
    await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'href',
    });
    expect(await local.getByMachineId(machineId)).toBeTruthy();
    const again = await svc.revalidate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'href',
    });
    expect(again.activated).toBe(true);
    // segunda activate continua bloqueada
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'href',
      }),
    ).rejects.toThrow(/consumed/i);
  });

  it('14-17) offline grace vs revoked/blocked precedence', () => {
    const now = Date.now();
    const base = {
      licenseStatus: 'active',
      expiresAt: new Date(now + 86_400_000).toISOString(),
      offlineUntil: new Date(now + LOCAL_LICENSE_OFFLINE_GRACE_MS).toISOString(),
    };

    expect(evaluateOfflineSnapshot(base, now).allow).toBe(true);

    const expiredOffline = evaluateOfflineSnapshot(
      { ...base, offlineUntil: new Date(now - 1000).toISOString() },
      now,
    );
    expect(expiredOffline.allow).toBe(false);
    expect(expiredOffline.mode).toBe('offline_exceeded');

    const revoked = evaluateOfflineSnapshot(
      {
        ...base,
        cloudRevokedAt: new Date(now).toISOString(),
        licenseStatus: 'revoked',
      },
      now,
    );
    expect(revoked.allow).toBe(false);
    expect(revoked.mode).toBe('revoked');

    const blocked = evaluateOfflineSnapshot({ ...base, licenseStatus: 'blocked' }, now);
    expect(blocked.allow).toBe(false);
    expect(blocked.mode).toBe('blocked');
  });

  it('18-19) token não aparece em redaction / erros', async () => {
    const { svc, issued } = await setup();
    const leaked = `fail ${issued.token} end`;
    expect(redactActivationSecrets(leaked)).not.toContain(issued.token);
    expect(redactActivationSecrets(leaked)).toContain('pac_[REDACTED]');

    try {
      await svc.activate({
        activationToken: issued.token + '_tampered',
        machineId: 'mid_' + 't'.repeat(24),
        hardwareHash: 'ht',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).not.toMatch(/pac_[a-f0-9]{20,}/i);
    }
  });

  it('20) uag_* não pode ser usado como pac_*', async () => {
    const { svc } = await setup();
    await expect(
      svc.activate({
        activationToken: 'uag_' + 'ab'.repeat(24),
        machineId: 'mid_' + 'u'.repeat(24),
        hardwareHash: 'hu',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);
  });

  it('caso válido + TTL default configurável', async () => {
    expect(resolveProfessionalActivationTokenTtlMs({})).toBe(
      DEFAULT_PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS * 3_600_000,
    );
    expect(resolveProfessionalActivationTokenTtlMs({ PROFESSIONAL_ACTIVATION_TOKEN_TTL_HOURS: '24' })).toBe(
      24 * 3_600_000,
    );

    const { svc, issued } = await setup();
    const machineId = 'mid_' + 'z'.repeat(24);
    const result = await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'hz',
      version: '1.0.0',
    });
    expect(result.activated).toBe(true);
    expect(result.offlineGraceMs).toBe(LOCAL_LICENSE_OFFLINE_GRACE_MS);
  });

  it('revalidate blocked/revoked license mesmo após ativação', async () => {
    const { svc, licenses, company, issued } = await setup();
    const machineId = 'mid_' + 'w'.repeat(24);
    await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'hw',
    });
    await licenses.action(company.id, 'block');
    await expect(
      svc.revalidate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'hw',
      }),
    ).rejects.toThrow(/blocked/i);
  });

  it('MachineId diferente no revalidate → rejeitado', async () => {
    const { svc, issued } = await setup();
    const machineId = 'mid_' + 'm'.repeat(24);
    await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'hm',
    });
    await expect(
      svc.revalidate({
        activationToken: issued.token,
        machineId: 'mid_' + '9'.repeat(24),
        hardwareHash: 'hm',
      }),
    ).rejects.toThrow(/does not match/i);
  });

  it('hardwareHash mismatch na revalidate → rejeitado (política existente)', async () => {
    const { svc, issued } = await setup();
    const machineId = 'mid_' + 'h'.repeat(24);
    await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'hash_original',
    });
    await expect(
      svc.revalidate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'hash_other',
      }),
    ).rejects.toThrow(/hardware_mismatch/i);
  });
});
