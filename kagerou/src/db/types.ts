export type NoteStatus = 'FRESH' | 'WEATHERING' | 'CRITICAL' | 'TOMBSTONE' | 'MONUMENT';

export interface NoteEntity {
  id: string; // UUID v4
  content: string | null; // 本文（TOMBSTONE遷移時に null で上書きし完全抹消）
  originalLength: number; // 作成・最終編集時の文字数（墓標ログ表示用）

  createdAt: number;
  updatedAt: number;
  lastPolishedAt: number; // 風化計算の起算点
  lastCountedPolishAt: number; // クールダウン判定用
  decayedAt: number | null;
  monumentedAt: number | null;

  polishCount: number; // 初期値 1, 5 到達で MONUMENT
  status: NoteStatus;
  seed: number;
  isTutorial?: boolean;
}

export interface SystemConfig {
  id: 'app_config';
  lastKnownTime: number; // 時計巻き戻し検知用の最終記録時刻（実時刻）
  debugTimeOffsetMs: number; // デバッグ用時間オフセット (本番初期値: 0)
  isInitialized: boolean;
}
