import React, { createContext, useCallback, useState } from 'react';
import type { User } from '../../types';
import { getNavigationGroupsByRole, getFlatNavigationByRole } from './navigationSchema';
import type { NavigationGroupSchema, NavigationItemSchema } from './navigationSchema';
import { resolveRole } from './navigationSchema';

export interface SmartNavigationState {
  radialOpen: boolean;
  commandPaletteOpen: boolean;
  /** Grupo cujo submenu flutuante do dock está aberto (null = fechado) */
  dockFloatingGroupKey: string | null;
}

export interface SmartNavigationContextValue extends SmartNavigationState {
  user: User | null;
  role: 'admin' | 'employee';
  setRadialOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openDockGroup: (groupKey: string | null) => void;
  toggleCommandPalette: () => void;
  onLogout?: () => void | Promise<void>;
  /** Grupos filtrados pelo role do usuário */
  groups: Record<string, NavigationGroupSchema>;
  /** Lista plana de itens para command palette */
  flatItems: NavigationItemSchema[];
}

const SmartNavigationContext = createContext<SmartNavigationContextValue | null>(null);

export interface SmartNavigationProviderProps {
  user: User | null;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function SmartNavigationProvider({ user, onLogout, children }: SmartNavigationProviderProps) {
  const [radialOpen, setRadialOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [dockFloatingGroupKey, setDockFloatingGroupKey] = useState<string | null>(null);

  const role = resolveRole(user?.role ?? 'employee');
  const groups = getNavigationGroupsByRole(user?.role ?? 'employee');
  const flatItems = getFlatNavigationByRole(user?.role ?? 'employee');

  const openDockGroup = useCallback((groupKey: string | null) => {
    setDockFloatingGroupKey(groupKey);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((prev) => !prev);
  }, []);

  const value: SmartNavigationContextValue = {
    user,
    role,
    radialOpen,
    commandPaletteOpen,
    dockFloatingGroupKey,
    setRadialOpen,
    setCommandPaletteOpen,
    openDockGroup,
    toggleCommandPalette,
    onLogout,
    groups,
    flatItems,
  };

  return (
    <SmartNavigationContext.Provider value={value}>
      {children}
    </SmartNavigationContext.Provider>
  );
}

export { SmartNavigationContext };
