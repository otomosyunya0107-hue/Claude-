/** CRUD・墓標化走査フック */
import { useCallback, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { NoteEntity } from '../db/types';
import * as repo from '../db/repository';
import { deriveStatus, remainingMs } from '../core/stateMachine';
import { KAGEROU_CONSTANTS as K } from '../core/constants';

/** 目の前で墓標化したノートを UI に通知（砂のエフェクト用） */
async function sweepAndNotify(now: number) {
  const changed = await repo.runSweep(db, now);
  const dead = changed.filter((n) => n.status === 'TOMBSTONE').map((n) => n.id);
  if (dead.length) window.dispatchEvent(new CustomEvent('kagerou:dissolve', { detail: dead }));
}

export function useNotes(now: number, ready: boolean, getNow: () => number) {
  const notes = useLiveQuery(() => db.notes.toArray(), [], undefined as NoteEntity[] | undefined);

  // 初回オンボーディング → 起動時走査
  useEffect(() => {
    if (!ready) return;
    void repo.ensureInitialized(db, getNow()).then(() => repo.runSweep(db, getNow()));
  }, [ready, getNow]);

  // 時刻が進む（タイムトラベル含む）たび、および 1 分ごとに走査
  useEffect(() => {
    if (!ready) return;
    void sweepAndNotify(now);
  }, [ready, now]);
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => void sweepAndNotify(getNow()), K.GC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ready, getNow]);

  const grouped = useMemo(() => {
    const living: NoteEntity[] = [];
    const monuments: NoteEntity[] = [];
    const tombs: NoteEntity[] = [];
    for (const n of notes ?? []) {
      const s = deriveStatus(n, now);
      if (s === 'MONUMENT') monuments.push(n);
      else if (s === 'TOMBSTONE') tombs.push(n);
      else living.push(n);
    }
    living.sort((a, b) => remainingMs(a, now) - remainingMs(b, now)); // 消滅が近い順
    monuments.sort((a, b) => (b.monumentedAt ?? 0) - (a.monumentedAt ?? 0));
    tombs.sort((a, b) => (b.decayedAt ?? 0) - (a.decayedAt ?? 0));
    return { living, monuments, tombs };
  }, [notes, now]);

  const add = useCallback((content: string) => repo.addNote(db, content, getNow()), [getNow]);
  const edit = useCallback((id: string, content: string) => repo.updateNoteContent(db, id, content, getNow()), [getNow]);
  const polish = useCallback((id: string) => repo.polishNote(db, id, getNow()), [getNow]);
  const remove = useCallback((id: string) => repo.deleteNote(db, id), []);

  return { loading: notes === undefined, ...grouped, add, edit, polish, remove };
}
