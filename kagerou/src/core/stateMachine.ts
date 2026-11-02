/**
 * ステータス遷移・クールダウン判定（仕様書 §3, §5）
 * すべて純粋関数。永続化は db/ 層が担う。
 */
import { KAGEROU_CONSTANTS as K, DAY_MS } from './constants';
import { linearDecay } from './decayEngine';
import type { NoteEntity, NoteStatus } from '../db/types';

export const isTerminal = (s: NoteStatus) => s === 'TOMBSTONE' || s === 'MONUMENT';

/**
 * 現在時刻における実効ステータス。
 * MONUMENT / TOMBSTONE は不可逆なので保存値をそのまま返す。
 * それ以外は線形風化率から導出する（FRESH < 7日 ≤ WEATHERING < 24日 ≤ CRITICAL < 30日）。
 */
export function deriveStatus(note: NoteEntity, now: number): NoteStatus {
  if (isTerminal(note.status)) return note.status;
  const r = linearDecay(note.lastPolishedAt, now);
  if (r >= 1) return 'TOMBSTONE';
  if (r >= K.CRITICAL_FROM) return 'CRITICAL';
  if (r >= K.WEATHERING_FROM) return 'WEATHERING';
  return 'FRESH';
}

export function decayOf(note: NoteEntity, now: number): number {
  if (note.status === 'MONUMENT') return 0;
  if (note.status === 'TOMBSTONE') return 1;
  return linearDecay(note.lastPolishedAt, now);
}

/** 消滅までの残りミリ秒（石碑は Infinity、墓標は 0） */
export function remainingMs(note: NoteEntity, now: number): number {
  if (note.status === 'MONUMENT') return Infinity;
  if (note.status === 'TOMBSTONE') return 0;
  return Math.max(0, note.lastPolishedAt + K.MAX_LIFESPAN_MS - now);
}

export function remainingDays(note: NoteEntity, now: number): number {
  return Math.ceil(remainingMs(note, now) / DAY_MS);
}

/** FR-01-2: 編集は FRESH のときのみ */
export function canEdit(note: NoteEntity, now: number): boolean {
  return deriveStatus(note, now) === 'FRESH';
}

export function canPolish(note: NoteEntity, now: number): boolean {
  return !isTerminal(deriveStatus(note, now));
}

export function validateContent(content: string): string | null {
  const len = Array.from(content).length;
  if (content.trim().length === 0) return '何か書いてください。';
  if (len > K.MAX_NOTE_LENGTH) return `${K.MAX_NOTE_LENGTH}文字以内で書いてください（現在 ${len} 文字）。`;
  return null;
}

export function createNote(content: string, now: number, seed: number, id: string): NoteEntity {
  const err = validateContent(content);
  if (err) throw new Error(err);
  return {
    id,
    content,
    originalLength: Array.from(content).length,
    createdAt: now,
    updatedAt: now,
    lastPolishedAt: now,
    lastCountedPolishAt: now,
    decayedAt: null,
    monumentedAt: null,
    polishCount: 1,
    status: 'FRESH',
    seed,
  };
}

/** 編集は風化の起算点を動かさない（編集を「無料の手入れ」にしないため） */
export function editNote(note: NoteEntity, content: string, now: number): NoteEntity {
  if (!canEdit(note, now)) throw new Error('このノートは現在編集できません。先に手入れしてください。');
  const err = validateContent(content);
  if (err) throw new Error(err);
  return { ...note, content, originalLength: Array.from(content).length, updatedAt: now };
}

export interface PolishResult {
  note: NoteEntity;
  counted: boolean;
  monumented: boolean;
}

/** FR-02 / FR-03: 手入れ完了時の状態更新 */
export function applyPolish(note: NoteEntity, now: number): PolishResult {
  if (!canPolish(note, now)) throw new Error('このノートは手入れできません。');
  const decay = linearDecay(note.lastPolishedAt, now);
  const counted =
    now - note.lastCountedPolishAt >= K.POLISH_COOLDOWN_MS || decay >= K.MIN_DECAY_FOR_COUNT;
  const polishCount = note.polishCount + (counted ? 1 : 0);
  const monumented = polishCount >= K.MONUMENT_THRESHOLD;
  return {
    counted,
    monumented,
    note: {
      ...note,
      lastPolishedAt: now,
      lastCountedPolishAt: counted ? now : note.lastCountedPolishAt,
      polishCount,
      status: monumented ? 'MONUMENT' : 'FRESH',
      monumentedAt: monumented ? now : null,
    },
  };
}

/**
 * FR-04: 墓標化。本文を null で完全抹消する。
 * decayedAt は「実際に寿命が尽きた時刻」を記録する（アプリを長期間開かなかった場合でも正確な没日になる）。
 */
export function applyTombstone(note: NoteEntity, now: number): NoteEntity {
  return {
    ...note,
    content: null,
    status: 'TOMBSTONE',
    decayedAt: Math.min(now, note.lastPolishedAt + K.MAX_LIFESPAN_MS),
  };
}

/**
 * 走査（GC）: 保存すべき変更があるノートだけを返す。
 * - 寿命到達 → TOMBSTONE（本文抹消）
 * - FRESH/WEATHERING/CRITICAL 間のステータス変化 → status を同期
 */
export function sweep(notes: NoteEntity[], now: number): NoteEntity[] {
  const changed: NoteEntity[] = [];
  for (const n of notes) {
    const s = deriveStatus(n, now);
    if (s === 'TOMBSTONE' && n.status !== 'TOMBSTONE') changed.push(applyTombstone(n, now));
    else if (s !== n.status) changed.push({ ...n, status: s });
  }
  return changed;
}

/** 時計巻き戻し検知（仕様書 §7.2）。実時刻ベースで判定し、オフセットは別途加算する */
export function resolveBaseTime(realNow: number, lastKnownTime: number): { base: number; rolledBack: boolean } {
  if (realNow < lastKnownTime - K.CLOCK_ROLLBACK_TOLERANCE_MS) return { base: lastKnownTime, rolledBack: true };
  return { base: realNow, rolledBack: false };
}
