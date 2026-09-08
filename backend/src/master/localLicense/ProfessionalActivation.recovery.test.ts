/**
 * Recuperação consume→binding + revalidação (in-memory, política formal).
 */
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { LicenseManagerService } from '../licenseManager/LicenseManagerService.js';
import { TenantDeploymentManager } from '../deploymentManager/TenantDeploymentManager.js';
import { LocalLicenseManager } from './LocalLicenseManager.js';
import {
  ProfessionalActivationService,
  ProfessionalActivationUnauthorizedError,
} from './ProfessionalActivationService.js';
import { InMemoryProfessionalActivationTokenStore } from './professionalActivationToken.js';

async function setup() {
  const licenses = LicenseManagerService.createInMemory();
  const deployments = TenantDeploymentManager.createInMemory();
  const local = LocalLicenseManager.createInMemory(licenses);
  const tokens = new InMemoryProfessionalActivationTokenStore();

  const company = await licenses.create({
    tenantId: 'tn_rec',
    empresa: 'Rec Co',
    mode: 'LOCAL',
    status: 'Ativa',
    durationDays: 365,
  });
  const deployment = await deployments.create({
    tenantId: company.tenantId,
    empresa: company.empresa,
    mode: 'LOCAL',
  });
  const issued = tokens.issue({
    tenantId: company.tenantId,
    deploymentId: deployment.id,
    companyLicenseId: company.id,
  });

  const port = {
    peekForActivation: async (t: string) => tokens.peekActive(t),
    diagnose: async (t: string) => tokens.diagnose(t),
    consumeForActivation: (t: string, mid: string) => tokens.consume(t, mid),
    authenticateForRevalidate: async (t: string) => tokens.authenticateForRevalidate(t),
    compensateUnconsume: async (tokenId: string, machineId: string) => {
      const hasBinding = Boolean(await local.getByMachineId(machineId));
      return tokens.compensateUnconsume(tokenId, machineId, hasBinding);
    },
  };

  const svc = new ProfessionalActivationService(
    local,
    licenses,
    deployments,
    port,
    () => Date.now(),
  );

  return { svc, licenses, deployments, local, tokens, company, deployment, issued, port };
}

describe('ProfessionalActivation recovery + state transitions', () => {
  it('A) consume OK + binding OK → sucesso', async () => {
    const { svc, issued, local, tokens } = await setup();
    const machineId = 'mid_' + 'a'.repeat(24);
    const result = await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'h-ok',
    });
    expect(result.activated).toBe(true);
    expect(await local.getByMachineId(machineId)).toBeTruthy();
    expect(tokens.diagnose(issued.token)).toBe('consumed');
  });

  it('B) consume OK + binding falha → compensação reabre token sem binding', async () => {
    const { issued, local, tokens, licenses, deployments, company, deployment, port } =
      await setup();
    const machineId = 'mid_' + 'b'.repeat(24);

    const flakyLocal = LocalLicenseManager.createInMemory(licenses);
    vi.spyOn(flakyLocal, 'applyCloudBinding').mockRejectedValueOnce(new Error('bind_boom'));

    const svc = new ProfessionalActivationService(
      flakyLocal,
      licenses,
      deployments,
      {
        ...port,
        compensateUnconsume: async (tokenId, mid) => {
          const hasBinding = Boolean(await flakyLocal.getByMachineId(mid));
          return tokens.compensateUnconsume(tokenId, mid, hasBinding);
        },
      },
    );

    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'h-fail',
      }),
    ).rejects.toThrow(/bind_boom/);

    expect(await flakyLocal.getByMachineId(machineId)).toBeNull();
    expect(tokens.diagnose(issued.token)).toBe('active');
    expect(tokens.peekActive(issued.token)?.deploymentId).toBe(deployment.id);
    expect(company.id).toBeTruthy();

    // Retry após compensação deve funcionar (mesmo token)
    const svc2 = new ProfessionalActivationService(local, licenses, deployments, port);
    const ok = await svc2.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'h-fail',
    });
    expect(ok.activated).toBe(true);
    expect(tokens.diagnose(issued.token)).toBe('consumed');
  });

  it('C) duas ativações simultâneas → somente uma vence', async () => {
    const { svc, issued, local } = await setup();
    const results = await Promise.allSettled([
      svc.activate({
        activationToken: issued.token,
        machineId: 'mid_' + '1'.repeat(24),
        hardwareHash: 'h1',
      }),
      svc.activate({
        activationToken: issued.token,
        machineId: 'mid_' + '2'.repeat(24),
        hardwareHash: 'h2',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(results.filter((r) => r.status === 'rejected').length).toBe(1);
    const boundCount = [await local.getByMachineId('mid_' + '1'.repeat(24)), await local.getByMachineId('mid_' + '2'.repeat(24))].filter(
      Boolean,
    ).length;
    expect(boundCount).toBe(1);
  });

  it('D/E) retry após timeout / erro cliente com Cloud já concluído → não cria segundo binding', async () => {
    const { svc, issued, local } = await setup();
    const machineId = 'mid_' + 'e'.repeat(24);
    await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'he',
    });
    // Cliente “não viu” sucesso e tenta activate de novo
    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'he',
      }),
    ).rejects.toThrow(/consumed/i);

    // Revalidate é o caminho correto
    const re = await svc.revalidate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'he',
    });
    expect(re.activated).toBe(true);
    expect(await local.getByLicenseKey(`depbind_${re.deploymentId}`)).toBeTruthy();
  });

  it('revalidation isolation: active ativa; consumed não ativa; consumed+binding revalida; consumed sem binding não cria', async () => {
    const { svc, issued, tokens, local } = await setup();
    const machineId = 'mid_' + 'v'.repeat(24);

    expect(tokens.diagnose(issued.token)).toBe('active');
    await expect(
      svc.revalidate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'hv',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);

    await svc.activate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'hv',
    });
    expect(tokens.diagnose(issued.token)).toBe('consumed');

    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'hv',
      }),
    ).rejects.toThrow(/consumed/i);

    const re = await svc.revalidate({
      activationToken: issued.token,
      machineId,
      hardwareHash: 'hv',
    });
    expect(re.machineId).toBe(machineId);

    // Simula consumed sem binding (apagando local) → revalidate rejeita; activate também
    const row = await local.getByMachineId(machineId);
    expect(row).toBeTruthy();
    // LocalLicenseStore in-memory: delete via save overwrite não remove — use store delete
    await (local as unknown as { store: { delete: (id: string) => Promise<boolean> } }).store.delete(
      machineId,
    );
    expect(await local.getByMachineId(machineId)).toBeNull();

    await expect(
      svc.revalidate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'hv',
      }),
    ).rejects.toThrow(/not activated/i);

    await expect(
      svc.activate({
        activationToken: issued.token,
        machineId,
        hardwareHash: 'hv',
      }),
    ).rejects.toThrow(/consumed/i);
  });

  it('expired / revoked não ativam', async () => {
    const { svc, tokens, company, deployment, licenses, deployments, local, port } = await setup();
    const expired = tokens.issue({
      tenantId: company.tenantId,
      deploymentId: deployment.id,
      companyLicenseId: company.id,
      ttlMs: 1000,
    });
    tokens.expireByToken(expired.token);
    const svcExp = new ProfessionalActivationService(local, licenses, deployments, port);
    await expect(
      svcExp.activate({
        activationToken: expired.token,
        machineId: 'mid_' + 'x'.repeat(24),
        hardwareHash: 'hx',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);

    const revoked = tokens.issue({
      tenantId: company.tenantId,
      deploymentId: deployment.id,
      companyLicenseId: company.id,
    });
    tokens.revokeByToken(revoked.token);
    await expect(
      svc.activate({
        activationToken: revoked.token,
        machineId: 'mid_' + 'y'.repeat(24),
        hardwareHash: 'hy',
      }),
    ).rejects.toBeInstanceOf(ProfessionalActivationUnauthorizedError);
  });
});
