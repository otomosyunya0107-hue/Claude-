/** 風化した紙片の PNG を Canvas で描く（仕様書 §5.5） */
import { decayText, visualDecay, type CharState } from '../../core/decayEngine';
import { decayOf, deriveStatus, remainingDays } from '../../core/stateMachine';
import { paperColor } from '../../core/paperShape';
import { seededRandom } from '../../core/decayEngine';
import { kanjiDate } from '../../core/kanji';
import type { NoteEntity } from '../../db/types';
import { formatDate } from './format';

export type ShareFormat = 'square' | 'portrait';
export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

const MINCHO = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif';
const SUMI = '#151311';
const INK = '#1e1b17';

const CHAR_STYLE: Record<CharState, { alpha: number; blur: number; dy: number; color?: string }> = {
  INTACT: { alpha: 1, blur: 0, dy: 0 },
  BLURRED: { alpha: 0.65, blur: 2.4, dy: 0 },
  FADING: { alpha: 0.3, blur: 1, dy: 2 },
  ERODED: { alpha: 0.55, blur: 0, dy: 0, color: '#7b705f' },
};

export function shareFooter(note: NoteEntity, now: number): string {
  const s = deriveStatus(note, now);
  if (s === 'MONUMENT') return 'KAGEROU — 石碑 (永久保存)';
  if (s === 'TOMBSTONE') return 'KAGEROU — 砂に還った言葉';
  return `KAGEROU — 消滅まであと ${remainingDays(note, now)} 日 (風化度 ${Math.round(decayOf(note, now) * 100)}%)`;
}

export function tombMessage(note: NoteEntity): string {
  return `${formatDate(note.createdAt)} に刻まれた ${note.originalLength}文字の思考は、30日の時を経て砂に還りました。`;
}

/** 明朝体は文字範囲ごとに分割配信されるため、描く文字を先に読み込ませる */
export async function shareFontsReady(note: NoteEntity, now: number) {
  const text = (note.content ?? tombMessage(note)) + shareFooter(note, now) + '石碑過去帳〇一二三四五六七八九十年月日記刻';
  try {
    await Promise.all([document.fonts.load(`40px "Shippori Mincho"`, text), document.fonts.load(`600 40px "Shippori Mincho"`, text)]);
  } catch { /* 代替書体で描く */ }
}

interface Line { glyphs: { ch: string; state: CharState }[] }

function layout(ctx: CanvasRenderingContext2D, glyphs: { display: string; state: CharState }[], maxW: number): Line[] {
  const lines: Line[] = [{ glyphs: [] }];
  let w = 0;
  for (const g of glyphs) {
    if (g.display === '\n') { lines.push({ glyphs: [] }); w = 0; continue; }
    const cw = ctx.measureText(g.display).width;
    if (w + cw > maxW && lines[lines.length - 1].glyphs.length) { lines.push({ glyphs: [] }); w = 0; }
    lines[lines.length - 1].glyphs.push({ ch: g.display, state: g.state });
    w += cw;
  }
  return lines;
}

/** 不揃いな縁の紙片の輪郭 */
function paperPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, decay: number) {
  const rough = 3 + decay * 22;
  const r = (i: number) => seededRandom(seed ^ 0x51ed27, i) * rough;
  const N = 30;
  ctx.beginPath();
  ctx.moveTo(x, y + r(0));
  for (let i = 1; i <= N; i++) ctx.lineTo(x + (w * i) / N, y + r(i));
  for (let i = 1; i <= N; i++) ctx.lineTo(x + w - r(100 + i) * 0.6, y + (h * i) / N);
  for (let i = N - 1; i >= 0; i--) ctx.lineTo(x + (w * i) / N, y + h - r(200 + i));
  for (let i = N - 1; i >= 1; i--) ctx.lineTo(x + r(500 + i) * 0.6, y + (h * i) / N);
  ctx.closePath();
}

function grain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, rgba: (a: number) => string) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rgba(Math.random() * 0.06);
    ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1 + Math.random() * 3, 1);
  }
}

export function renderShareCanvas(note: NoteEntity, now: number, format: ShareFormat): HTMLCanvasElement {
  const { w, h } = SHARE_SIZES[format];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const status = deriveStatus(note, now);
  const isStone = status === 'MONUMENT';
  const isTomb = status === 'TOMBSTONE';
  const decay = decayOf(note, now);

  ctx.fillStyle = SUMI;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, 0, 0, w, h, 5000, (a) => `rgba(160,150,135,${a})`);

  const pad = 84;
  const footerH = 150;
  const cx = pad, cy = pad, cw = w - pad * 2, ch = h - pad * 2 - footerH;
  const inner = 70;
  const tx = cx + inner, ty = cy + inner, tw = cw - inner * 2, th = ch - inner * 2;

  if (isTomb) {
    ctx.fillStyle = '#9a9184';
    ctx.font = `600 40px ${MINCHO}`;
    ctx.fillText('過去帳', cx, cy + 60);
    ctx.font = `38px ${MINCHO}`;
    const lines = layout(ctx, Array.from(tombMessage(note)).map((d) => ({ display: d, state: 'INTACT' as CharState })), cw);
    lines.forEach((l, i) => ctx.fillText(l.glyphs.map((g) => g.ch).join(''), cx, cy + 180 + i * 70));
  } else {
    ctx.save();
    if (isStone) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 60);
      ctx.quadraticCurveTo(cx + cw / 2, cy - 30, cx + cw, cy + 60);
      ctx.lineTo(cx + cw, cy + ch);
      ctx.lineTo(cx, cy + ch);
      ctx.closePath();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 16;
      ctx.fillStyle = '#3b3c3a';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.clip();
      grain(ctx, cx, cy, cw, ch, 9000, (a) => `rgba(220,220,215,${a * 1.6})`);
    } else {
      ctx.translate(w / 2, cy + ch / 2);
      ctx.rotate(((seededRandom(note.seed ^ 0x1234, 0) - 0.5) * 1.4 * Math.PI) / 180);
      ctx.translate(-w / 2, -(cy + ch / 2));
      paperPath(ctx, cx, cy, cw, ch, note.seed, decay);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = paperColor(decay);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.clip();
      // 繊維と染み
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = `rgba(90,75,50,${Math.random() * 0.07})`;
        ctx.fillRect(cx + Math.random() * cw, cy + Math.random() * ch, 4 + Math.random() * 14, 1);
      }
      for (let i = 0; i < Math.floor(decay * 5); i++) {
        const sx = cx + seededRandom(note.seed ^ 0x777, i) * cw, sy = cy + seededRandom(note.seed ^ 0x999, i) * ch;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 120 + 160 * seededRandom(note.seed ^ 0x555, i));
        g.addColorStop(0, `rgba(120,90,40,${0.06 + decay * 0.08})`);
        g.addColorStop(1, 'rgba(120,90,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx, cy, cw, ch);
      }
    }

    const rVisual = isStone ? 0 : visualDecay(decay);
    const glyphs = decayText(note.content ?? '', note.seed, rVisual);
    const top = isStone ? ty + 50 : ty;
    const avail = isStone ? th - 50 : th;
    let size = 60, lines: Line[] = [];
    for (; size >= 26; size -= 2) {
      ctx.font = `${size}px ${MINCHO}`;
      lines = layout(ctx, glyphs, tw);
      if (lines.length * size * 1.9 <= avail) break;
    }
    const lh = size * 1.9;
    const maxLines = Math.max(1, Math.floor(avail / lh));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1].glyphs.push({ ch: '…', state: 'INTACT' });
    }
    ctx.textBaseline = 'top';
    lines.forEach((line, li) => {
      let x = tx;
      for (const g of line.glyphs) {
        const st = CHAR_STYLE[g.state];
        ctx.save();
        ctx.globalAlpha = st.alpha;
        if (st.blur) ctx.filter = `blur(${st.blur}px)`;
        const y = top + li * lh + st.dy;
        if (isStone) {
          ctx.fillStyle = '#6c6d69';
          ctx.fillText(g.ch, x, y + 1.5);
          ctx.fillStyle = '#232422';
        } else {
          ctx.fillStyle = st.color ?? INK;
        }
        ctx.fillText(g.ch, x, y);
        ctx.restore();
        x += ctx.measureText(g.ch).width;
      }
    });
    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    // 消滅間近の朱印
    if (!isStone && remainingDays(note, now) <= 5) {
      ctx.save();
      ctx.translate(cx + cw - 120, cy + 110);
      ctx.rotate((8 * Math.PI) / 180);
      ctx.strokeStyle = 'rgba(155,63,44,0.85)';
      ctx.lineWidth = 5;
      ctx.strokeRect(-48, -48, 96, 96);
      ctx.fillStyle = 'rgba(155,63,44,0.85)';
      ctx.font = `600 30px ${MINCHO}`;
      ctx.textAlign = 'center';
      ctx.fillText('残', 0, -6);
      ctx.fillText(`${remainingDays(note, now)}日`, 0, 32);
      ctx.restore();
    }
  }

  // フッター（仕様の文言はそのまま）
  ctx.fillStyle = '#e6dfd2';
  ctx.font = `600 34px ${MINCHO}`;
  ctx.fillText(shareFooter(note, now), pad, h - pad - 40);
  ctx.fillStyle = '#5f584f';
  ctx.font = `24px ${MINCHO}`;
  ctx.fillText(`${kanjiDate(note.createdAt)} に書かれた言葉`, pad, h - pad + 4);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('画像生成に失敗しました'))), 'image/png'));
}
