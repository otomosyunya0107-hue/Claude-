/** 0〜99 を漢数字に（残り日数・手入れ回数の表示用） */
const D = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function kanjiNum(n: number): string {
  n = Math.max(0, Math.floor(n));
  if (n < 10) return D[n];
  if (n >= 100) return String(n);
  const t = Math.floor(n / 10), o = n % 10;
  return `${t === 1 ? '' : D[t]}十${o ? D[o] : ''}`;
}
/** 2026/11/02 → 二〇二六年十一月二日 */
export function kanjiDate(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getFullYear()).split('').map((c) => D[+c]).join('');
  return `${y}年${kanjiNum(d.getMonth() + 1)}月${kanjiNum(d.getDate())}日`;
}
