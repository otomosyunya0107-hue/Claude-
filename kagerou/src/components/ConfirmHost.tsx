/** 画面内の確認（window.confirm が使えない環境・ネイティブでも同じ見た目で動く） */
import { useEffect, useState } from 'react';

interface Req { message: string; okLabel: string; resolve: (v: boolean) => void }
let push: ((r: Req | null) => void) | null = null;
let current: Req | null = null;

export function askConfirm(message: string, okLabel = '捨てる'): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(false);
    current = { message, okLabel, resolve };
    push(current);
  });
}

/** 開いていれば閉じて true（Android 戻るボタン用） */
export function closeConfirm(): boolean {
  if (!current) return false;
  current.resolve(false);
  current = null;
  push?.(null);
  return true;
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => { push = setReq; return () => { push = null; }; }, []);
  if (!req) return null;
  const done = (v: boolean) => { req.resolve(v); current = null; setReq(null); };
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0b0a09]/75 px-5 sm:items-center"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      onClick={() => done(false)} role="alertdialog" aria-modal="true" aria-label="確認"
    >
      <div className="paper-wrap w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="paper px-6 pb-3 pt-6">
          <p className="font-mincho text-[15px] leading-[1.9]">{req.message}</p>
          <div className="mt-4 flex justify-end gap-6 font-mincho text-[13px] tracking-[0.15em]">
            <button type="button" autoFocus onClick={() => done(false)} className="py-2 text-ink/60">やめる</button>
            <button type="button" onClick={() => done(true)} className="border-b border-shu/60 py-2 text-shu">{req.okLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
