import { useContext } from 'react';
import { SmartNavigationContext } from './SmartNavigationProvider';

export function useSmartNavigation() {
  const ctx = useContext(SmartNavigationContext);
  if (!ctx) {
    throw new Error('useSmartNavigation must be used within SmartNavigationProvider');
  }
  return ctx;
}
