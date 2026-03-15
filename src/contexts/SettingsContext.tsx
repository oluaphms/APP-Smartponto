import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings } from '../services/settingsService';
import type { GlobalSettings } from '../types/settings';

export interface SettingsContextValue {
  settings: GlobalSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  loading: true,
  refreshSettings: async () => {},
});

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    const data = await getSettings();
    setSettings(data);
    return;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await getSettings();
      if (mounted) {
        setSettings(data);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const value: SettingsContextValue = {
    settings,
    loading,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
