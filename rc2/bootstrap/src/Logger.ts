import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  logDir: string;
  component: string;
}

/**
 * Remove credenciais de strings de log (pac_*, uag_*, JWT, senhas, connection strings).
 */
export function redactSecrets(text: string): string {
  let out = String(text ?? '');
  out = out.replace(/\bpac_[A-Za-z0-9_-]+\b/g, 'pac_[REDACTED]');
  out = out.replace(/\buag_[A-Za-z0-9_-]+\b/g, 'uag_[REDACTED]');
  out = out.replace(/\bBearer\s+[A-Za-z0-9._\-+=/]+/gi, 'Bearer [REDACTED]');
  out = out.replace(
    /\b(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._\-+=/]+)/g,
    '[JWT_REDACTED]',
  );
  out = out.replace(
    /(postgres(?:ql)?:\/\/)([^:@\s\/]+):([^@\s\/]+)@/gi,
    '$1$2:[REDACTED]@',
  );
  out = out.replace(
    /("?(?:password|passwd|secret|token|api[_-]?key|jwtSecret|masterJwtSecret|cloudActivationToken|postgresSuperuserPassword|pontowebAppPassword|pontowebMigratePassword|masterOwner\dPassword)"?\s*[:=]\s*)("?)([^"\s,}\\]+)\2/gi,
    '$1$2[REDACTED]$2',
  );
  return out;
}

function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/password|secret|token|authorization|connectionstring|jwt/i.test(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (typeof v === 'string') out[k] = redactSecrets(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactMeta(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

/**
 * Log estruturado em arquivo (instalador). Sem dados de negócio / secrets.
 */
export class Logger {
  private readonly logFile: string;

  constructor(private readonly options: LoggerOptions) {
    fs.mkdirSync(options.logDir, { recursive: true });
    this.logFile = path.join(options.logDir, 'install.log');
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      component: this.options.component,
      message: redactSecrets(message),
      ...(meta ? { meta: redactMeta(meta) } : {}),
    });
    fs.appendFileSync(this.logFile, `${line}\n`, 'utf8');
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }
}
