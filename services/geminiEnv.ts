/**
 * Chave da API Gemini no cliente Vite: use VITE_GEMINI_API_KEY.
 * Em Node/scripts: GEMINI_API_KEY ou API_KEY.
 *
 * Modelo: use VITE_GEMINI_MODEL. Padrão `gemini-1.5-flash` (amplamente disponível na v1beta).
 * Modelos experimentais (ex. gemini-2.0-flash-exp) podem retornar 404 quando descontinuados.
 * NOTA: A API v1beta requer nomes de modelo específicos. Evite usar 'models/' prefix no VITE_GEMINI_MODEL.
 */
export function getGeminiModelId(): string {
  try {
    const m = import.meta.env?.VITE_GEMINI_MODEL;
    if (m && String(m).trim()) return String(m).trim();
  } catch {
    /* import.meta indisponível */
  }
  if (typeof process !== 'undefined' && process.env) {
    const m = process.env.VITE_GEMINI_MODEL;
    if (m && String(m).trim()) return String(m).trim();
  }
  return 'gemini-1.5-flash';
}

/**
 * Insights automáticos no dashboard (App.tsx): **desligado por padrão**.
 * Defina `VITE_ENABLE_AI_INSIGHTS=true` para habilitar uma única chamada quando houver registros.
 * IA continua disponível em telas sob demanda (ex.: chat RH) quando a chave existe.
 */
export function isAiDashboardInsightsAutoEnabled(): boolean {
  try {
    return String(import.meta.env?.VITE_ENABLE_AI_INSIGHTS || '').toLowerCase() === 'true';
  } catch {
    return false;
  }
}

/** Verifica se a chave parece ser um placeholder ou inválida */
function isPlaceholderKey(key: string): boolean {
  const k = key.toLowerCase().trim();
  const placeholderPatterns = [
    'placeholder',
    'your_key_here',
    'your_api_key',
    'yourkey',
    'example',
    'test',
    'demo',
    'fake',
    'invalid',
    'xxx',
    'yyy',
    'zzz',
    '123456',
    'changeme',
    'not_set',
    'undefined',
    'null',
    'none',
  ];

  // Verifica padrões de placeholder
  if (placeholderPatterns.some(p => k.includes(p))) return true;

  // Chaves Gemini devem começar com "AIza" e ter ~39 caracteres
  if (!k.startsWith('aiza') && key.length < 30) return true;

  return false;
}

/**
 * Verifica se a chave da API Gemini é válida.
 * Retorna um objeto com status e mensagem de erro se inválida.
 */
export function validateGeminiApiKey(key: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!key) {
    return { valid: false, error: 'Chave da API não configurada' };
  }

  if (isPlaceholderKey(key)) {
    return {
      valid: false,
      error: 'Chave da API parece ser um placeholder. Obtenha uma chave válida em https://aistudio.google.com/apikey',
    };
  }

  // Verifica formato básico da chave Gemini (começa com AIza)
  if (!key.startsWith('AIza')) {
    return {
      valid: false,
      error: 'Formato de chave inválido. Chaves Gemini devem começar com "AIza". Verifique sua chave em https://aistudio.google.com/apikey',
    };
  }

  return { valid: true };
}

export function getGeminiApiKey(): string | undefined {
  try {
    const viteKey = import.meta.env?.VITE_GEMINI_API_KEY;
    if (viteKey && String(viteKey).trim()) return String(viteKey).trim();
  } catch {
    /* import.meta indisponível */
  }
  if (typeof process !== 'undefined' && process.env) {
    const k =
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY;
    if (k && String(k).trim()) return String(k).trim();
  }
  return undefined;
}
