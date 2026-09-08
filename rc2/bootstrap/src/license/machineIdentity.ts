/**
 * Identidade estável da instalação Professional.
 * Algoritmo alinhado a backend/.../localLicense.fingerprint.ts (deriveMachineId / deriveHardwareHash).
 * MachineId NÃO é segredo.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export type MachineIdentityDocument = {
  version: 1;
  machineId: string;
  hardwareHash: string;
  /** Componentes usados (sem PII desnecessária). */
  components: string[];
  createdAt: string;
};

function sha256Hex(material: string): string {
  return crypto.createHash('sha256').update(material).digest('hex');
}

/** Espelha deriveMachineId do backend. */
export function deriveMachineId(components: string[]): string {
  const parts = components.map((p) => String(p).trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) {
    return `mid_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `mid_${sha256Hex(parts.join('|')).slice(0, 24)}`;
}

/** Espelha deriveHardwareHash do backend. */
export function deriveHardwareHash(components: string[]): string {
  const parts = components.map((p) => String(p).trim().toLowerCase()).filter(Boolean);
  const material = parts.length > 0 ? parts.join('|') : `anon_${crypto.randomUUID()}`;
  return sha256Hex(material);
}

/**
 * Componentes estáveis preferindo MachineGuid Windows (não IP / hostname mutável).
 * Fallback: UUID persistido no próprio documento na 1ª criação.
 */
export function collectStableComponents(persistedSeed?: string): string[] {
  const parts: string[] = [`platform:${os.platform()}`, `arch:${os.arch()}`];
  if (process.platform === 'win32') {
    try {
      const out = execFileSync(
        'reg',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
        { encoding: 'utf8', windowsHide: true },
      );
      const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(out);
      if (m?.[1]) parts.push(`machineguid:${m[1].trim().toLowerCase()}`);
    } catch {
      /* best-effort */
    }
  }
  if (persistedSeed) parts.push(`seed:${persistedSeed}`);
  return parts;
}

export class MachineIdentityStore {
  constructor(private readonly filePath: string) {}

  load(): MachineIdentityDocument | null {
    if (!fs.existsSync(this.filePath)) return null;
    const raw = fs.readFileSync(this.filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw) as MachineIdentityDocument;
  }

  /** Idempotente: reutiliza arquivo existente (estável entre reboots). */
  loadOrCreate(): MachineIdentityDocument {
    const existing = this.load();
    if (existing?.machineId?.startsWith('mid_') && existing.hardwareHash) {
      return existing;
    }
    const seed = crypto.randomBytes(16).toString('hex');
    const components = collectStableComponents(seed);
    const doc: MachineIdentityDocument = {
      version: 1,
      machineId: deriveMachineId(components),
      hardwareHash: deriveHardwareHash(components),
      components,
      createdAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return doc;
  }
}
