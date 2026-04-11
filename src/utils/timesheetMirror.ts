/**
 * Espelho de ponto: quatro marcações típicas do dia
 * Entrada (início) → Pausa (início intervalo) → Entrada (retorno) → Saída (final).
 */

export type PunchKind = 'entrada' | 'saída' | 'pausa' | 'other';

export function normalizePunchType(type: string | undefined | null): PunchKind {
  const x = String(type || '').toLowerCase().trim();
  if (x === 'saida' || x === 'saída') return 'saída';
  if (x === 'entrada') return 'entrada';
  if (x === 'pausa') return 'pausa';
  return 'other';
}

export function formatMirrorTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export interface DayMirrorSummary {
  /** Primeira entrada do dia (início da jornada) */
  entradaInicio: string;
  /** Início do intervalo (marcação tipo pausa) */
  saidaIntervalo: string;
  /** Primeira entrada após a pausa (retorno) */
  voltaIntervalo: string;
  /** Última saída do dia (encerramento) */
  saidaFinal: string;
  workedHours: string;
  status: string;
  hasLateEntry?: boolean;
  hasAbsence?: boolean;
}

type MirrorRecord = { type: string; created_at: string };

/**
 * Interpreta marcações do dia em ordem cronológica (não sobrescreve entradas).
 */
export function buildDayMirrorSummary(records: MirrorRecord[]): DayMirrorSummary {
  const sorted = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let entradaInicio = '';
  let saidaIntervalo = '';
  let voltaIntervalo = '';
  let saidaFinal = '';

  let firstEntradaIdx = -1;
  let firstPausaIdx = -1;

  for (let i = 0; i < sorted.length; i++) {
    const ty = normalizePunchType(sorted[i].type);
    if (ty === 'entrada' && firstEntradaIdx < 0) {
      firstEntradaIdx = i;
      entradaInicio = formatMirrorTime(sorted[i].created_at);
    }
    if (ty === 'pausa' && firstPausaIdx < 0) {
      firstPausaIdx = i;
      saidaIntervalo = formatMirrorTime(sorted[i].created_at);
    }
  }

  if (firstPausaIdx >= 0) {
    for (let i = firstPausaIdx + 1; i < sorted.length; i++) {
      if (normalizePunchType(sorted[i].type) === 'entrada') {
        voltaIntervalo = formatMirrorTime(sorted[i].created_at);
        break;
      }
    }
  }

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (normalizePunchType(sorted[i].type) === 'saída') {
      saidaFinal = formatMirrorTime(sorted[i].created_at);
      break;
    }
  }

  const workedHours = computeWorkedHours(sorted, firstEntradaIdx, firstPausaIdx);

  // Detectar falta (sem batida de entrada)
  const hasAbsence = firstEntradaIdx < 0;

  // Detectar batida fora do horário (entrada após 09:00 ou saída antes de 17:00)
  let hasLateEntry = false;
  if (firstEntradaIdx >= 0) {
    const entradaTime = new Date(sorted[firstEntradaIdx].created_at);
    const entradaHour = entradaTime.getHours();
    const entradaMin = entradaTime.getMinutes();
    // Considerar fora do horário se entrada após 09:00
    if (entradaHour > 9 || (entradaHour === 9 && entradaMin > 0)) {
      hasLateEntry = true;
    }
  }

  return {
    entradaInicio,
    saidaIntervalo,
    voltaIntervalo,
    saidaFinal,
    workedHours,
    status: 'OK',
    hasLateEntry,
    hasAbsence,
  };
}

function computeWorkedHours(
  sorted: MirrorRecord[],
  firstEntradaIdx: number,
  firstPausaIdx: number,
): string {
  if (firstEntradaIdx < 0) return '';
  const firstEnt = new Date(sorted[firstEntradaIdx].created_at);
  let lastSaida: Date | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (normalizePunchType(sorted[i].type) === 'saída') {
      lastSaida = new Date(sorted[i].created_at);
      break;
    }
  }
  if (!lastSaida) return '';
  let mins = (lastSaida.getTime() - firstEnt.getTime()) / 60000;

  if (firstPausaIdx >= 0) {
    let retornoIdx = -1;
    for (let i = firstPausaIdx + 1; i < sorted.length; i++) {
      if (normalizePunchType(sorted[i].type) === 'entrada') {
        retornoIdx = i;
        break;
      }
    }
    if (retornoIdx >= 0) {
      const tPausa = new Date(sorted[firstPausaIdx].created_at);
      const tRetorno = new Date(sorted[retornoIdx].created_at);
      mins -= (tRetorno.getTime() - tPausa.getTime()) / 60000;
    }
  }

  const h = Math.floor(Math.max(0, mins) / 60);
  const m = Math.round(Math.max(0, mins) % 60);
  return `${h}h ${m}m`;
}
