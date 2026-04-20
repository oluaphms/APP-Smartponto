/**
 * Alinha-se a `filterPunchesToLocalToday` em repSyncJob: dia civil local do relógio do processo
 * (calendário do computador no browser / servidor Node com TZ local).
 */
export function getLocalCalendarDayBoundsIso(): { startIso: string; endIso: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d, 23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
