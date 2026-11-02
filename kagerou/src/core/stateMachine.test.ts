import { describe, expect, it } from 'vitest';
import {
  applyPolish, canEdit, createNote, deriveStatus, editNote, remainingDays, resolveBaseTime, sweep,
} from './stateMachine';
import { DAY_MS, KAGEROU_CONSTANTS as K } from './constants';

const T0 = Date.UTC(2026, 10, 2);
const mk = () => createNote('テストのメモ', T0, 123, 'id-1');

describe('deriveStatus', () => {
  it.each([
    [0, 'FRESH'], [6.99, 'FRESH'], [7, 'WEATHERING'], [23.99, 'WEATHERING'],
    [24, 'CRITICAL'], [29.99, 'CRITICAL'], [30, 'TOMBSTONE'],
  ])('day %f -> %s', (d, s) => {
    expect(deriveStatus(mk(), T0 + d * DAY_MS)).toBe(s);
  });
});

describe('editing', () => {
  it('allowed only while FRESH', () => {
    const n = mk();
    expect(canEdit(n, T0 + 6 * DAY_MS)).toBe(true);
    expect(canEdit(n, T0 + 8 * DAY_MS)).toBe(false);
    expect(() => editNote(n, 'x', T0 + 8 * DAY_MS)).toThrow();
    const e = editNote(n, '書き直し', T0 + DAY_MS);
    expect(e.content).toBe('書き直し');
    expect(e.originalLength).toBe(4);
    expect(e.lastPolishedAt).toBe(T0); // 編集は風化を戻さない
  });
  it('rejects >1000 chars and blank', () => {
    expect(() => createNote('あ'.repeat(1001), T0, 1, 'x')).toThrow();
    expect(() => createNote('   ', T0, 1, 'x')).toThrow();
    expect(() => createNote('あ'.repeat(1000), T0, 1, 'x')).not.toThrow();
  });
});

describe('polish', () => {
  it('rapid repeated polishing right after creation does not count (anti-cheat)', () => {
    let n = mk();
    for (let i = 1; i <= 10; i++) n = applyPolish(n, T0 + i * 1000).note;
    expect(n.polishCount).toBe(1);
    expect(n.status).toBe('FRESH');
  });
  it('counts after cooldown, resets decay; 5th count -> MONUMENT', () => {
    let n = mk();
    let t = T0;
    for (let i = 2; i <= 4; i++) {
      t += K.POLISH_COOLDOWN_MS;
      const r = applyPolish(n, t);
      expect(r.counted).toBe(true);
      expect(r.monumented).toBe(false);
      n = r.note;
      expect(n.polishCount).toBe(i);
      expect(n.lastPolishedAt).toBe(t);
    }
    t += K.POLISH_COOLDOWN_MS;
    const r = applyPolish(n, t);
    expect(r.monumented).toBe(true);
    expect(r.note.status).toBe('MONUMENT');
    expect(r.note.monumentedAt).toBe(t);
    // 石碑は +30日でも風化しない・掃除対象にならない
    expect(deriveStatus(r.note, t + 365 * DAY_MS)).toBe('MONUMENT');
    expect(sweep([r.note], t + 365 * DAY_MS)).toEqual([]);
    expect(() => applyPolish(r.note, t + DAY_MS)).toThrow();
  });
  it('rescues a CRITICAL note back to FRESH', () => {
    const n = mk();
    const t = T0 + 27 * DAY_MS;
    expect(deriveStatus(n, t)).toBe('CRITICAL');
    const r = applyPolish(n, t);
    expect(deriveStatus(r.note, t)).toBe('FRESH');
    expect(remainingDays(r.note, t)).toBe(30);
  });
  it('cannot polish a dead note', () => {
    expect(() => applyPolish(mk(), T0 + 30 * DAY_MS)).toThrow();
  });
});

describe('sweep / tombstone', () => {
  it('erases content at 30 days and records death time', () => {
    const n = mk();
    const [t] = sweep([n], T0 + 45 * DAY_MS);
    expect(t.status).toBe('TOMBSTONE');
    expect(t.content).toBeNull();
    expect(t.decayedAt).toBe(T0 + 30 * DAY_MS);
    expect(t.originalLength).toBe(6);
  });
  it('syncs intermediate statuses only when changed', () => {
    const n = mk();
    expect(sweep([n], T0 + DAY_MS)).toEqual([]);
    expect(sweep([n], T0 + 10 * DAY_MS)[0].status).toBe('WEATHERING');
  });
});

describe('clock rollback', () => {
  it('uses lastKnownTime when clock goes back > 1 min', () => {
    expect(resolveBaseTime(1000_000, 1000_000 + 30_000)).toEqual({ base: 1000_000, rolledBack: false });
    expect(resolveBaseTime(1000_000, 1000_000 + 120_000)).toEqual({ base: 1120_000, rolledBack: true });
  });
});
