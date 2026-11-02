/** IndexedDB への読み書き。ドメインロジックは core/stateMachine に委譲する */
import { applyPolish, createNote, editNote, sweep, type PolishResult } from '../core/stateMachine';
import { generateSeed } from '../core/decayEngine';
import { DEFAULT_CONFIG, type KagerouDB } from './schema';
import type { NoteEntity, SystemConfig } from './types';
import { buildTutorialNotes } from './seed';
import { uuid } from './uuid';

export async function getConfig(db: KagerouDB): Promise<SystemConfig> {
  return (await db.config.get('app_config')) ?? { ...DEFAULT_CONFIG };
}

export async function patchConfig(db: KagerouDB, patch: Partial<Omit<SystemConfig, 'id'>>) {
  await db.transaction('rw', db.config, async () => {
    const cur = await getConfig(db);
    await db.config.put({ ...cur, ...patch, id: 'app_config' });
  });
}

/** 初回起動時のみチュートリアルを投入（多重起動でも一度だけ） */
export async function ensureInitialized(db: KagerouDB, now: number): Promise<boolean> {
  return db.transaction('rw', db.notes, db.config, async () => {
    const cfg = await getConfig(db);
    if (cfg.isInitialized) return false;
    await db.notes.bulkPut(buildTutorialNotes(now));
    await db.config.put({ ...cfg, isInitialized: true });
    return true;
  });
}

export async function addNote(db: KagerouDB, content: string, now: number): Promise<NoteEntity> {
  const note = createNote(content, now, generateSeed(), uuid());
  await db.notes.add(note);
  return note;
}

async function mutate<T>(db: KagerouDB, id: string, fn: (n: NoteEntity) => { note: NoteEntity; result: T }) {
  return db.transaction('rw', db.notes, async () => {
    const n = await db.notes.get(id);
    if (!n) throw new Error('ノートが見つかりません。');
    const { note, result } = fn(n);
    await db.notes.put(note);
    return result;
  });
}

export function updateNoteContent(db: KagerouDB, id: string, content: string, now: number) {
  return mutate(db, id, (n) => ({ note: editNote(n, content, now), result: undefined }));
}

export function polishNote(db: KagerouDB, id: string, now: number): Promise<PolishResult> {
  return mutate(db, id, (n) => {
    const r = applyPolish(n, now);
    return { note: r.note, result: r };
  });
}

export async function deleteNote(db: KagerouDB, id: string) {
  await db.notes.delete(id);
}

/** FR-04: 墓標化走査。変更件数を返す */
export async function runSweep(db: KagerouDB, now: number): Promise<NoteEntity[]> {
  return db.transaction('rw', db.notes, async () => {
    const changed = sweep(await db.notes.toArray(), now);
    if (changed.length) await db.notes.bulkPut(changed);
    return changed;
  });
}
