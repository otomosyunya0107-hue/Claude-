/**
 * 紙片の輪郭（clip-path）と経年色を、seed と風化率から決定論的に作る。
 * 風化が進むほど縁が欠け、紙は黄ばみ、染みが増える。
 */
import { seededRandom } from './decayEngine';

const SALT = 0x51ed27;

export function paperClipPath(seed: number, decay: number): string {
  const q = Math.round(decay * 20) / 20; // 5% 刻みで形を変える（再計算を抑える）
  const rough = 0.25 + q * 2.4; // 縁の凹凸（%）
  const bite = q > 0.5 ? (q - 0.5) * 6 : 0; // 欠け
  const pts: string[] = [];
  const N = 18;
  const r = (i: number) => seededRandom(seed ^ SALT, i);
  const j = (i: number, amp: number) => (r(i) * amp).toFixed(2);
  // 上辺 → 右辺 → 下辺 → 左辺
  for (let i = 0; i <= N; i++) pts.push(`${((i / N) * 100).toFixed(2)}% ${j(i, rough)}%`);
  for (let i = 1; i <= N; i++) pts.push(`${(100 - +j(100 + i, rough * 0.6)).toFixed(2)}% ${((i / N) * 100).toFixed(2)}%`);
  for (let i = N - 1; i >= 0; i--) {
    const deep = r(300 + i) < 0.18 ? +j(400 + i, bite * 2) : 0;
    pts.push(`${((i / N) * 100).toFixed(2)}% ${(100 - +j(200 + i, rough) - deep).toFixed(2)}%`);
  }
  for (let i = N - 1; i >= 1; i--) pts.push(`${j(500 + i, rough * 0.6)}% ${((i / N) * 100).toFixed(2)}%`);
  return `polygon(${pts.join(',')})`;
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function paperColor(decay: number): string {
  const a = hex('#ebe5d8'), b = hex('#c9b996');
  const t = Math.min(1, decay * 1.15);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

export function paperStains(seed: number, decay: number): string {
  const n = Math.floor(decay * 5);
  const s: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(seededRandom(seed ^ 0x777, i) * 100);
    const y = Math.round(seededRandom(seed ^ 0x999, i) * 100);
    const size = 18 + Math.round(seededRandom(seed ^ 0x555, i) * 30);
    s.push(`radial-gradient(${size}% ${size * 0.7}% at ${x}% ${y}%, rgba(120,90,40,${(0.06 + decay * 0.08).toFixed(3)}), transparent 70%)`);
  }
  return s.length ? s.join(',') : 'none';
}

/** 紙片ごとのわずかな傾き（-0.7〜0.7度） */
export function paperTilt(seed: number): number {
  return (seededRandom(seed ^ 0x1234, 0) - 0.5) * 1.4;
}
