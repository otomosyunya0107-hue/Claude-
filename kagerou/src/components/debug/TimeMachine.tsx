/** 検証用：時間を進める */
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
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-dust-faint/40 bg-[#100e0c]/95 backdrop-blur"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
      }}
      role="region" aria-label="時を進める（検証用）"
    >
      <div className="mx-auto flex max-w-xl items-center gap-4 overflow-x-auto whitespace-nowrap pt-2.5 font-mincho text-[12px] tracking-[0.08em] text-dust">
        <span className="tabular-nums text-[#cfc6b6]" data-testid="time-offset">
          {days === 0 ? '今日' : `${Number.isInteger(days) ? days : days.toFixed(2)}日後`}
        </span>
        {STEPS.map((d) => (
          <button key={d} type="button" onClick={() => onChange(offset + d * DAY_MS)} className="py-2 hover:text-[#e6dfd2]">
            +{d}日
          </button>
        ))}
        <button type="button" onClick={() => onChange(0)} className="py-2 text-dust-faint hover:text-[#e6dfd2]">今日に戻る</button>
        <button type="button" onClick={onClose} className="ml-auto py-2 text-dust-faint hover:text-[#e6dfd2]" aria-label="閉じる">閉じる</button>
      </div>
    </div>
  );
}
