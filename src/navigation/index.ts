export { navigationGroups, getNavigationGroupsByRole, getFlatNavigationByRole, filterGroupItemsByRole, resolveRole } from './navigationSchema';
export type { NavigationGroupSchema, NavigationItemSchema, NavRole, ResolvedRole } from './navigationSchema';
export { SmartNavigationProvider, SmartNavigationContext } from './SmartNavigationProvider';
export type { SmartNavigationState, SmartNavigationContextValue } from './SmartNavigationProvider';
export { useSmartNavigation } from './useSmartNavigation';
export { default as SmartDock } from './SmartDock';
export { default as RadialMenu } from './RadialMenu';
export { default as CommandPalette } from './CommandPalette';
export { getNavIcon } from './iconMap';
