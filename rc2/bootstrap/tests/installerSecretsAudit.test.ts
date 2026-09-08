/**
 * Logger redaction + SecretsStore cloud upsert (installer gate).
 */
// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Logger, redactSecrets } from '../src/Logger.js';
import { SecretsStore } from '../src/postgres/SecretsStore.js';

describe('redactSecrets (installer audit)', () => {
  it('mascara pac_*, uag_*, Bearer, JWT e connection string', () => {
    const sample =
      'token=pac_abcDEF123_secret Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig ' +
      'uag_xyz987 postgresql://user:s3cret@127.0.0.1:55432/db';
    const out = redactSecrets(sample);
    expect(out).not.toMatch(/pac_abcDEF/);
    expect(out).not.toMatch(/uag_xyz/);
    expect(out).not.toMatch(/s3cret/);
    expect(out).toMatch(/pac_\[REDACTED\]|token=\[REDACTED\]/);
    expect(out).toContain('uag_[REDACTED]');
    expect(out).toContain('Bearer [REDACTED]');
    expect(out).toContain('[REDACTED]@');
  });

  it('Logger nao grava plaintext pac_* no arquivo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwd-log-'));
    const log = new Logger({ logDir: dir, component: 'test' });
    log.info('activation with pac_SuperSecretToken99', {
      cloudActivationToken: 'pac_SuperSecretToken99',
    });
    const body = fs.readFileSync(path.join(dir, 'install.log'), 'utf8');
    expect(body).not.toContain('pac_SuperSecretToken99');
    expect(body).toContain('pac_[REDACTED]');
    expect(body).toContain('[REDACTED]');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('SecretsStore cloud activation fields', () => {
  it('upsertCloudActivation persiste pac_* sem aceitar licenseKey', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwd-sec-'));
    const file = path.join(dir, 'secrets.json');
    const store = new SecretsStore(file);
    let doc = store.loadOrCreate(55432);
    doc = store.upsertCloudActivation(doc, {
      cloudMasterUrl: 'https://master.example.com',
      cloudActivationToken: 'not_a_pac_token',
    });
    expect(doc.cloudActivationToken).toBeUndefined();
    doc = store.upsertCloudActivation(doc, {
      cloudMasterUrl: 'https://master.example.com',
      cloudActivationToken: 'pac_validTokenExample',
    });
    expect(doc.cloudActivationToken).toBe('pac_validTokenExample');
    expect(doc.cloudMasterUrl).toBe('https://master.example.com');
    const reloaded = store.load()!;
    expect(reloaded.cloudActivationToken).toBe('pac_validTokenExample');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
