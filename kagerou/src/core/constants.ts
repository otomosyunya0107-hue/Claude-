export const KAGEROU_CONSTANTS = {
  MAX_LIFESPAN_DAYS: 30,
  MAX_LIFESPAN_MS: 30 * 24 * 60 * 60 * 1000, // 2,592,000,000 ms
  MONUMENT_THRESHOLD: 5, // 石碑化に必要な手入れ回数
  POLISH_COOLDOWN_MS: 20 * 60 * 60 * 1000, // カウント加算の最短間隔 (20時間)
  MIN_DECAY_FOR_COUNT: 0.15, // または風化率15%以上でカウント加算許可
  MAX_NOTE_LENGTH: 1000, // 最大文字数制限
  HOLD_DURATION_MS: 1400, // 手入れ長押し完了までの所要時間 (1.4秒)
  /** ステータス境界（線形風化率）: 7日 / 24日 */
  WEATHERING_FROM: 7 / 30,
  CRITICAL_FROM: 24 / 30,
  /** 残り日数がこれ以下で警告色 */
  WARNING_DAYS: 5,
  /** 時計巻き戻しとみなす逆行幅 */
  CLOCK_ROLLBACK_TOLERANCE_MS: 60 * 1000,
  /** 墓標化走査の間隔 */
  GC_INTERVAL_MS: 60 * 1000,
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
