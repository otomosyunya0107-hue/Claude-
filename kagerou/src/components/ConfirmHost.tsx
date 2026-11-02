/** 画面内確認ダイアログ（window.confirm が使えない埋め込み環境でも動くように） */
import { useEffect, useState } from 'react';

interface Req { message: string; okLabel: string; resolve: (v: boolean) => void }
let push: ((r: Req) => void) | null = null;

export function askConfirm(message: string, okLabel = '削除する'): Promise<boolean> {
  return new Promise((resolve) => {
    if (push) push({ message, okLabel, resolve });
    else resolve(false);
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => { push = setReq; return () => { push = null; }; }, []);
  if (!req) return null;
  const done = (v: boolean) => { req.resolve(v); setReq(null); };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center" onClick={() => done(false)} role="alertdialog" aria-modal="true" aria-label="確認">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121418] p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm leading-relaxed text-ink">{req.message}</p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button type="button" autoFocus onClick={() => done(false)} className="rounded-lg px-4 py-2 text-dim hover:text-ink">キャンセル</button>
          <button type="button" onClick={() => done(true)} className="rounded-lg bg-rust px-4 py-2 font-medium text-void">{req.okLabel}</button>
        </div>
      </div>
    </div>
  );
}
