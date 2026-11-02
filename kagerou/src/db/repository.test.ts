import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { KagerouDB } from './schema';
import { addNote, ensureInitialized, getConfig, polishNote, runSweep } from './repository';
import { DAY_MS } from '../core/constants';
import { deriveStatus } from '../core/stateMachine';

let db: KagerouDB;
const T0 = Date.UTC(2026, 10, 2);

beforeEach(async () => {
  db = new KagerouDB(`test-${Math.random()}`);
  await db.open();
});

describe('repository', () => {
  it('seeds tutorial notes exactly once', async () => {
    expect(await ensureInitialized(db, T0)).toBe(true);
    expect(await ensureInitialized(db, T0)).toBe(false);
    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(3);
    expect((await getConfig(db)).isInitialized).toBe(true);
    const statuses = notes.map((n) => deriveStatus(n, T0)).sort();
    expect(statuses).toEqual(['CRITICAL', 'TOMBSTONE', 'WEATHERING']);
    const tomb = notes.find((n) => n.status === 'TOMBSTONE')!;
    expect(tomb.content).toBeNull();
    expect(tomb.originalLength).toBe(84);
  });

  it('tutorial reach note becomes MONUMENT with one polish', async () => {
    await ensureInitialized(db, T0);
    const reach = (await db.notes.toArray()).find((n) => n.polishCount === 4)!;
    const r = await polishNote(db, reach.id, T0);
    expect(r.monumented).toBe(true);
    expect((await db.notes.get(reach.id))!.status).toBe('MONUMENT');
  });

  it('persists, and sweep erases content in IndexedDB after 30 days', async () => {
    const n = await addNote(db, '消えゆく言葉', T0);
    expect((await db.notes.get(n.id))!.content).toBe('消えゆく言葉');
    await runSweep(db, T0 + 30 * DAY_MS);
    const after = await db.notes.get(n.id);
    expect(after!.status).toBe('TOMBSTONE');
    expect(after!.content).toBeNull();
  });
});
