/** 長押し充填（Hold to Polish）インタラクション（仕様書 §5.2） */
import { useCallback, useEffect, useRef, useState } from 'react';
import { KAGEROU_CONSTANTS as K } from '../../core/constants';
import { sound } from '../../core/soundEngine';

interface Props {
  onProgress: (p: number) => void;
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
}

const R = 20;
const CIRC = 2 * Math.PI * R;

export function PolishButton({ onProgress, onComplete, disabled, label = '手入れする' }: Props) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const sweep = useRef<ReturnType<typeof sound.startSweep> | null>(null);
  const done = useRef(false);

  const set = useCallback((v: number) => { setP(v); onProgress(v); }, [onProgress]);

  const cancel = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    sweep.current?.stop();
    sweep.current = null;
    if (!done.current) set(0); // 途中で離したら風化状態へ逆戻り
  }, [set]);

  const begin = useCallback(() => {
    if (disabled || raf.current !== null) return;
    done.current = false;
    start.current = performance.now();
    sweep.current = sound.startSweep();
    const step = (t: number) => {
      const v = Math.min(1, (t - start.current) / K.HOLD_DURATION_MS);
      set(v);
      sweep.current?.update(v);
      if (v >= 1) {
        done.current = true;
        raf.current = null;
        sweep.current?.stop();
        sweep.current = null;
        onComplete();
        set(0);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [disabled, set, onComplete]);

  useEffect(() => () => cancel(), [cancel]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}（長押し）`}
      className="group relative flex shrink-0 whitespace-nowrap select-none touch-none items-center gap-2 rounded-full border border-moss/40 bg-black/30 py-1.5 pl-1.5 pr-4 text-sm text-moss transition hover:border-moss/80 active:scale-[0.98] disabled:opacity-40"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); begin(); }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') cancel(); }}
      onBlur={cancel}
    >
      <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden className="-rotate-90">
        <circle cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - p)} className="hold-ring"
        />
      </svg>
      <span>{p > 0 ? '砂を払っています…' : label}</span>
    </button>
  );
}
