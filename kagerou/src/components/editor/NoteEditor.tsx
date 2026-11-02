/** 新規メモ作成・追記フォーム */
import { useState } from 'react';
import { KAGEROU_CONSTANTS as K } from '../../core/constants';
import { validateContent } from '../../core/stateMachine';

interface Props {
  initial?: string;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}

export function NoteEditor({ initial = '', submitLabel = '刻む', placeholder, autoFocus, onSubmit, onCancel }: Props) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const len = Array.from(text).length;
  const over = len > K.MAX_NOTE_LENGTH;

  const submit = async () => {
    const err = validateContent(text);
    if (err) { setError(err); return; }
    setBusy(true);
    try {
      await onSubmit(text);
      if (!initial) setText('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-2">
      <textarea
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
        placeholder={placeholder}
        rows={initial ? Math.min(10, Math.max(3, text.split('\n').length + 1)) : 3}
        aria-label="メモ本文"
        className="block w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-dim/60 focus:border-moss/50 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={over ? 'text-rust' : 'text-dim'} aria-live="polite">
          {error ?? `${len} / ${K.MAX_NOTE_LENGTH}`}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-dim hover:text-ink">
              キャンセル
            </button>
          )}
          <button
            type="submit"
            disabled={busy || over || text.trim().length === 0}
            className="rounded-lg bg-ink px-4 py-2 font-medium text-void transition hover:bg-white disabled:opacity-30"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
