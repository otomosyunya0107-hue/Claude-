/** 初回起動オンボーディング用プリセット（仕様書 §7.1） */
import { DAY_MS } from '../core/constants';
import { generateSeed } from '../core/decayEngine';
import type { NoteEntity } from './types';
import { uuid } from './uuid';

export const TUTORIAL_TEXTS = {
  critical:
    '大事な言葉も、読み返さなければやがて砂に還ります。右下のボタンを長押しして、この言葉を救い出してください。',
  monumentReach:
    '5回手入れされた言葉だけは『石碑』となり、永遠に風化しなくなります。あと1回手入れして、石碑に刻んでみてください。',
} as const;

export function buildTutorialNotes(now: number): NoteEntity[] {
  const base = (content: string | null, ageDays: number): NoteEntity => {
    const t = now - ageDays * DAY_MS;
    return {
      id: uuid(),
      content,
      originalLength: content ? Array.from(content).length : 0,
      createdAt: t,
      updatedAt: t,
      lastPolishedAt: t,
      lastCountedPolishAt: t,
      decayedAt: null,
      monumentedAt: null,
      polishCount: 1,
      status: 'FRESH',
      seed: generateSeed(),
      isTutorial: true,
    };
  };

  // 1. 消滅寸前（経過27日相当）
  const critical: NoteEntity = { ...base(TUTORIAL_TEXTS.critical, 27), status: 'CRITICAL' };

  // 2. 石碑化リーチ（経過12日 / 手入れ 4/5、最終カウントは24時間以上前）
  const reach: NoteEntity = {
    ...base(TUTORIAL_TEXTS.monumentReach, 12),
    createdAt: now - 40 * DAY_MS,
    polishCount: 4,
    lastCountedPolishAt: now - 12 * DAY_MS,
    status: 'WEATHERING',
  };

  // 3. 墓標サンプル（本文 null / 84文字）
  const createdAt = now - 33 * DAY_MS;
  const tomb: NoteEntity = {
    ...base(null, 33),
    createdAt,
    originalLength: 84,
    status: 'TOMBSTONE',
    decayedAt: createdAt + 30 * DAY_MS,
  };

  return [critical, reach, tomb];
}
