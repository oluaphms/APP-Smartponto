/** Preferência compartilhada com Admin → Relógios REP → Opções */
export const LS_TIMESHEET_SPECIAL_BARS = 'chrono_timesheet_special_bars';

export function readSpecialBarsPref(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LS_TIMESHEET_SPECIAL_BARS) === '1';
}

export const SPECIAL_BARS_CHANGED = 'chrono_timesheet_special_bars_changed';
