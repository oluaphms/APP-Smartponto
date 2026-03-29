/**
 * Chave da API Gemini no cliente Vite: use VITE_GEMINI_API_KEY.
 * Em Node/scripts: GEMINI_API_KEY ou API_KEY.
 */
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
