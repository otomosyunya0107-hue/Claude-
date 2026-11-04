/** 長押し充填（Hold to Polish）。紙片の下端に沿って苔色の線が伸びる */
import { useCallback, useEffect, useRef, useState } from 'react';
import { KAGEROU_CONSTANTS as K } from '../../core/constants';
import { sound } from '../../core/soundEngine';
import { haptic } from '../../platform/native';

interface Props {
  onProgress: (p: number) => void;
  onComplete: () => void;
  disabled?: boolean;
}

export function PolishButton({ onProgress, onComplete, disabled }: Props) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const sweep = useRef<ReturnType<typeof sound.startSweep> | null>(null);
  const done = useRef(false);
  const ticks = useRef(0);

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
    ticks.current = 0;
    start.current = performance.now();
    sweep.current = sound.startSweep();
    void haptic('light');
    const step = (t: number) => {
      const v = Math.min(1, (t - start.current) / K.HOLD_DURATION_MS);
      set(v);
      sweep.current?.update(v);
      // 進捗 25% ごとに軽い手応え
      const tick = Math.floor(v * 4);
      if (tick > ticks.current && v < 1) { ticks.current = tick; void haptic('light'); }
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
      aria-label="手入れする（長押し）"
      className="relative shrink-0 touch-none select-none whitespace-nowrap py-2 pl-3 font-mincho text-[13px] tracking-[0.12em] text-ink disabled:opacity-40"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); begin(); }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') cancel(); }}
      onBlur={cancel}
    >
      {p > 0 ? '払っています' : '長押しで手入れ'}
      <span aria-hidden className="absolute bottom-1 left-3 right-0 h-px bg-ink/25" />
      <span aria-hidden className="absolute bottom-1 left-3 h-[2px] bg-moss" style={{ width: `calc((100% - 0.75rem) * ${p})` }} />
    </button>
  );
}
