/** 検証用タイムトラベル操作バー */
import { DAY_MS } from '../../core/constants';

interface Props {
  offset: number;
  onChange: (ms: number) => void;
  onClose: () => void;
}

const STEPS = [1, 7, 15, 30];

export function TimeMachine({ offset, onChange, onClose }: Props) {
  const days = offset / DAY_MS;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0f1114]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur" role="region" aria-label="タイムマシン（デバッグ）">
      <div className="mx-auto flex max-w-2xl items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs">
        <span className="mr-1 font-mono text-dim">⏳</span>
        <span className="mr-auto font-mono text-relic" data-testid="time-offset">
          {days === 0 ? '現在' : `+${Number.isInteger(days) ? days : days.toFixed(2)}日`}
        </span>
        {STEPS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(offset + d * DAY_MS)}
            className="rounded-md border border-white/10 px-2.5 py-1.5 font-mono text-ink hover:border-relic/60"
          >
            +{d}日
          </button>
        ))}
        <button type="button" onClick={() => onChange(0)} className="rounded-md px-2.5 py-1.5 text-dim hover:text-ink">
          リセット
        </button>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1.5 text-dim hover:text-ink" aria-label="タイムマシンを閉じる">
          ✕
        </button>
      </div>
    </div>
  );
}
