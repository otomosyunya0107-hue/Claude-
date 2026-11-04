/** 決定論的風化テキストレンダラー（仕様書 §4.3） */
import { memo, useMemo } from 'react';
import { computeThresholds, renderGlyphs, splitChars, type CharState } from '../../core/decayEngine';

const STYLE: Record<CharState, string> = {
  INTACT: '',
  BLURRED: 'blur-[1.2px] opacity-65 select-none',
  FADING: 'blur-[0.5px] opacity-30 translate-y-[1px] inline-block select-none',
  ERODED: 'text-ink-faded opacity-55 select-none', // 紙の上で読める程度の残り滓
};

interface Props {
  content: string;
  seed: number;
  rVisual: number;
  className?: string;
}

function DecayedTextImpl({ content, seed, rVisual, className = '' }: Props) {
  const chars = useMemo(() => splitChars(content), [content]);
  const thresholds = useMemo(() => computeThresholds(chars, seed), [chars, seed]);

  // 同じ状態の連続文字を 1 つの span にまとめて DOM ノード数を抑える
  const runs = useMemo(() => {
    const glyphs = renderGlyphs(chars, thresholds, seed, rVisual);
    const out: { state: CharState; text: string }[] = [];
    for (const g of glyphs) {
      // FADING は translate のため 1 文字ずつ inline-block にする
      const last = out[out.length - 1];
      if (last && last.state === g.state && g.state !== 'FADING') last.text += g.display;
      else out.push({ state: g.state, text: g.display });
    }
    return out;
  }, [chars, thresholds, seed, rVisual]);

  return (
    <p data-testid="note-text" className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {runs.map((r, i) =>
        r.state === 'INTACT' ? (
          <span key={i}>{r.text}</span>
        ) : (
          <span key={i} className={STYLE[r.state]} aria-hidden={r.state === 'ERODED' ? true : undefined}>
            {r.text}
          </span>
        ),
      )}
    </p>
  );
}

export const DecayedText = memo(DecayedTextImpl);
