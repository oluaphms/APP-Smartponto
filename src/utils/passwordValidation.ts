import type { GlobalSettings } from '../types/settings';

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Valida senha conforme as configurações globais (password_min_length, require_numbers, require_special_chars).
 */
export function validatePassword(
  password: string,
  settings: Pick<GlobalSettings, 'password_min_length' | 'require_numbers' | 'require_special_chars'> | null
): PasswordValidationResult {
  const minLength = settings?.password_min_length ?? 8;
  const requireNumbers = settings?.require_numbers ?? false;
  const requireSpecialChars = settings?.require_special_chars ?? false;

  if (!password || password.length < minLength) {
    return { valid: false, message: `A senha deve ter no mínimo ${minLength} caracteres.` };
  }
  if (requireNumbers && !/\d/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos um número.' };
  }
  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos um caractere especial (!@#$%^&*(), etc.).' };
  }
  return { valid: true };
}
