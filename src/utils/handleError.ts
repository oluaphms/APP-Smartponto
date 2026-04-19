import { NavigatorLockAcquireTimeoutError } from '@supabase/auth-js';

function isAuthLockContention(error: unknown): boolean {
  if (error instanceof NavigatorLockAcquireTimeoutError) return true;
  const name = (error as { name?: string })?.name ?? '';
  const msg = String((error as { message?: string })?.message ?? error ?? '');
  return (
    name === 'NavigatorLockAcquireTimeoutError' ||
    /lock:sb-.*auth-token|another request stole it|LockAcquireTimeout/i.test(msg)
  );
}

/**
 * Log centralizado de erros (evita catch vazio e falha silenciosa).
 */
export function handleError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}] ` : '';
  if (isAuthLockContention(error)) {
    if (import.meta.env?.DEV) {
      console.debug(prefix + 'contenção de lock do Auth (use getSession serializado ou uma única chamada).', error);
    }
    return;
  }
  console.error(prefix, error);
}
