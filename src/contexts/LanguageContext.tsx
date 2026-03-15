import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { i18n } from '../../lib/i18n';

export type Language = 'pt-BR' | 'en-US';

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const defaultLanguage = (): Language => {
  if (typeof window === 'undefined') return 'pt-BR';
  const saved = localStorage.getItem('smartponto_language') as Language;
  return saved === 'pt-BR' || saved === 'en-US' ? saved : 'pt-BR';
};

const LanguageContext = createContext<LanguageContextValue>({
  language: defaultLanguage(),
  setLanguage: () => {},
});

/**
 * Provider que mantém o idioma em estado React para que a troca de idioma
 * re-renderize toda a árvore e o sistema alterne entre pt-BR e en-US.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    i18n.setLanguage(language);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    const next = lang === 'pt-BR' || lang === 'en-US' ? lang : 'pt-BR';
    setLanguageState(next);
    i18n.setLanguage(next);
    localStorage.setItem('smartponto_language', next);
  }, []);

  const value: LanguageContextValue = { language, setLanguage };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: defaultLanguage(),
      setLanguage: (lang: Language) => {
        i18n.setLanguage(lang);
        localStorage.setItem('smartponto_language', lang);
      },
    };
  }
  return ctx;
}
