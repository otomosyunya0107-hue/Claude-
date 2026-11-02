/** 風化カードの PNG 生成（仕様書 §5.5）。HTML5 Canvas で直接描画する */
import { decayText, type CharState } from '../../core/decayEngine';
import { decayOf, deriveStatus, remainingDays } from '../../core/stateMachine';
import { visualDecay } from '../../core/decayEngine';
import type { NoteEntity } from '../../db/types';
import { formatDate } from './format';

export type ShareFormat = 'square' | 'portrait';
export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Noto Serif CJK JP", serif';

const CHAR_STYLE: Record<CharState, { alpha: number; blur: number; dy: number; color?: string }> = {
  INTACT: { alpha: 1, blur: 0, dy: 0 },
  BLURRED: { alpha: 0.65, blur: 2.4, dy: 0 },
  FADING: { alpha: 0.3, blur: 1, dy: 2 },
  ERODED: { alpha: 0.25, blur: 0, dy: 0, color: '#525252' },
};

export function shareFooter(note: NoteEntity, now: number): string {
  const s = deriveStatus(note, now);
  if (s === 'MONUMENT') return 'KAGEROU — 石碑 (永久保存)';
  if (s === 'TOMBSTONE') return 'KAGEROU — 砂に還った言葉';
  return `KAGEROU — 消滅まであと ${remainingDays(note, now)} 日 (風化度 ${Math.round(decayOf(note, now) * 100)}%)`;
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

export function renderShareCanvas(note: NoteEntity, now: number, format: ShareFormat): HTMLCanvasElement {
  const { w, h } = SHARE_SIZES[format];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const status = deriveStatus(note, now);
  const isStone = status === 'MONUMENT';
  const isTomb = status === 'TOMBSTONE';

  // 背景
  ctx.fillStyle = '#0B0C0E';
  ctx.fillRect(0, 0, w, h);
  const pad = 72;
  const cardX = pad, cardY = pad, cardW = w - pad * 2, cardH = h - pad * 2 - 120;
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  if (isTomb) {
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = '#2A2E37';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.fillStyle = isStone ? '#1F242D' : '#16181D';
    ctx.fill();
    ctx.strokeStyle = isStone ? '#4C566A' : `rgba(76,86,106,${0.6 * (1 - decayOf(note, now))})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 紙のざらつき
    ctx.clip();
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`;
      ctx.fillRect(cardX + Math.random() * cardW, cardY + Math.random() * cardH, 2, 2);
    }
  }
  ctx.restore();

  const inner = 64;
  const tx = cardX + inner, ty = cardY + inner, tw = cardW - inner * 2, th = cardH - inner * 2;

  if (isTomb) {
    ctx.fillStyle = '#8B93A3';
    ctx.font = `44px ${MINCHO}`;
    ctx.textAlign = 'center';
    ctx.fillText('墓標', w / 2, ty + 80);
    ctx.font = `36px ${MINCHO}`;
    const msg = tombMessage(note);
    const lines = layout(ctx, Array.from(msg).map((d) => ({ display: d, state: 'INTACT' as CharState })), tw);
    lines.forEach((l, i) => ctx.fillText(l.glyphs.map((g) => g.ch).join(''), w / 2, ty + 200 + i * 60));
    ctx.textAlign = 'left';
  } else {
    const rVisual = isStone ? 0 : visualDecay(decayOf(note, now));
    const glyphs = decayText(note.content ?? '', note.seed, rVisual);
    const family = isStone ? MINCHO : SANS;
    // 収まる最大フォントサイズを探す
    let size = 64, lines: Line[] = [];
    for (; size >= 26; size -= 2) {
      ctx.font = `${size}px ${family}`;
      lines = layout(ctx, glyphs, tw);
      if (lines.length * size * 1.7 <= th) break;
    }
    const lh = size * 1.7;
    const maxLines = Math.floor(th / lh);
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
        if (isStone) {
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.fillText(g.ch, x, ty + li * lh - 1);
          ctx.fillStyle = '#D8DEE9';
        } else {
          ctx.fillStyle = st.color ?? '#E5E9F0';
        }
        ctx.fillText(g.ch, x, ty + li * lh + st.dy);
        ctx.restore();
        x += ctx.measureText(g.ch).width;
      }
    });
    ctx.textBaseline = 'alphabetic';
  }

  // フッター
  ctx.fillStyle = isStone ? '#88C0D0' : status === 'CRITICAL' ? '#BF616A' : '#A3BE8C';
  ctx.fillRect(pad, h - pad - 84, 6, 84);
  ctx.fillStyle = '#E5E9F0';
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText(shareFooter(note, now), pad + 28, h - pad - 42);
  ctx.fillStyle = '#5c6370';
  ctx.font = `24px ${SANS}`;
  ctx.fillText(`${formatDate(note.createdAt)} に刻まれた言葉`, pad + 28, h - pad - 4);
  return c;
}

export function tombMessage(note: NoteEntity): string {
  return `${formatDate(note.createdAt)} に刻まれた ${note.originalLength}文字の思考は、30日の時を経て砂に還りました。`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('画像生成に失敗しました'))), 'image/png'));
}
