/**
 * 決定論的風化エンジン（仕様書 §4）
 * ノート固有の seed と文字位置 index のみから各文字の劣化状態を算出する。
 * 同じ (content, seed, 風化率) からは常に同じ描画結果が得られる。
 */
import { KAGEROU_CONSTANTS } from './constants';

export type CharState = 'INTACT' | 'BLURRED' | 'FADING' | 'ERODED';

export interface Glyph {
  /** DOM / Canvas に出力してよい文字（ERODED のときは置換文字） */
  display: string;
  state: CharState;
  /** 空白・改行など、風化対象外の文字 */
  isSpace: boolean;
}

/** Mulberry32 系の決定論的乱数 (0.0 〜 1.0) — 仕様書 §4.2 のまま */
export function seededRandom(seed: number, index: number): number {
  let t = (seed + index * 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const HIRAGANA_PUNCT = /[぀-ゟ、。，．・！？「」『』（）]/;
const KATAKANA_ALNUM = /[゠-ヿa-zA-Z0-9０-９]/;
const WHITESPACE = /^\s$/u;

/** 文字種別バイアス付き耐久値 H_i ∈ [0.15, 0.98] */
export function getCharThreshold(char: string, seed: number, index: number): number {
  const rand = seededRandom(seed, index);
  if (HIRAGANA_PUNCT.test(char)) return 0.15 + rand * 0.6; // 15%〜75%
  if (KATAKANA_ALNUM.test(char)) return 0.3 + rand * 0.6; // 30%〜90%
  return 0.48 + rand * 0.5; // 48%〜98%
}

/** 線形風化率 R_linear ∈ [0, 1] */
export function linearDecay(lastPolishedAt: number, now: number): number {
  const r = (now - lastPolishedAt) / KAGEROU_CONSTANTS.MAX_LIFESPAN_MS;
  return Math.min(1, Math.max(0, r));
}

/** 視覚的風化率 R_visual = R_linear ^ 1.6 */
export function visualDecay(rLinear: number): number {
  return Math.pow(Math.min(1, Math.max(0, rLinear)), 1.6);
}

/**
 * 滲み開始点の下限。仕様書 §4.3 の表をそのまま適用すると H < 0.20 の文字は
 * 風化率 0%（作成直後）でも BLURRED になってしまうため、開始点を 0.02
 * （線形換算で約 2.6 日）以上にクランプする。
 */
export const MIN_BLUR_START = 0.02;

/** 文字単位の状態判定テーブル（仕様書 §4.3） */
export function charState(rVisual: number, threshold: number): CharState {
  if (rVisual >= threshold) return 'ERODED';
  if (rVisual >= threshold - 0.08) return 'FADING';
  if (rVisual >= Math.max(threshold - 0.2, MIN_BLUR_START)) return 'BLURRED';
  return 'INTACT';
}

/** 置換文字の抽選は閾値とは別系列の乱数を使う（相関を避ける） */
const GLYPH_STREAM_SALT = 0x9e3779b9;

/** 欠落時の置換文字: '＿' 35% / '░' 20% / '·' 25% / '　' 20% */
export function erodedGlyph(seed: number, index: number): string {
  const r = seededRandom(seed ^ GLYPH_STREAM_SALT, index);
  if (r < 0.35) return '＿';
  if (r < 0.55) return '░';
  if (r < 0.8) return '·';
  return '　';
}

/** content を書記素（コードポイント）単位に分割。サロゲートペアを壊さない */
export function splitChars(content: string): string[] {
  return Array.from(content);
}

/** 文字ごとの耐久値を事前計算（風化率が変わっても再利用できる） */
export function computeThresholds(chars: string[], seed: number): number[] {
  return chars.map((c, i) => (WHITESPACE.test(c) ? Infinity : getCharThreshold(c, seed, i)));
}

export function renderGlyphs(
  chars: string[],
  thresholds: number[],
  seed: number,
  rVisual: number,
): Glyph[] {
  return chars.map((c, i) => {
    const h = thresholds[i];
    if (h === Infinity) return { display: c, state: 'INTACT', isSpace: true };
    const state = charState(rVisual, h);
    return {
      display: state === 'ERODED' ? erodedGlyph(seed, i) : c,
      state,
      isSpace: false,
    };
  });
}

/** 便利関数: content / seed / rVisual から一括で描画結果を得る */
export function decayText(content: string, seed: number, rVisual: number): Glyph[] {
  const chars = splitChars(content);
  return renderGlyphs(chars, computeThresholds(chars, seed), seed, rVisual);
}

/** 32bit 整数シードの生成 */
export function generateSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] | 0;
}
