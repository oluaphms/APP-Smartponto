import { describe, it, expect } from 'vitest';
import { normalizeRecordTypeForMirror, recordMirrorInstant, type TimeRecord } from './timesheetMirror';

function tr(p: Partial<TimeRecord> & Pick<TimeRecord, 'id' | 'user_id' | 'created_at' | 'type'>): TimeRecord {
  return {
    id: p.id,
    user_id: p.user_id,
    created_at: p.created_at,
    timestamp: p.timestamp ?? null,
    type: p.type,
    manual_reason: p.manual_reason ?? null,
  };
}

describe('normalizeRecordTypeForMirror', () => {
  it('trata saída (PostgreSQL) como saida', () => {
    expect(normalizeRecordTypeForMirror('saída')).toBe('saida');
    expect(normalizeRecordTypeForMirror('SAÍDA')).toBe('saida');
  });

  it('mapeia pausa para intervalo de saída', () => {
    expect(normalizeRecordTypeForMirror('pausa')).toBe('intervalo_saida');
  });
});

describe('recordMirrorInstant', () => {
  it('prioriza timestamp sobre created_at', () => {
    const r = tr({
      id: '1',
      user_id: 'u',
      created_at: '2026-04-04T10:00:00.000Z',
      timestamp: '2026-04-04T08:00:00.000-03:00',
      type: 'entrada',
    });
    expect(recordMirrorInstant(r)).toBe('2026-04-04T08:00:00.000-03:00');
  });
});
