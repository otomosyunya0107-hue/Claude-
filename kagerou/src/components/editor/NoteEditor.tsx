/** 書き留める欄。新規は墨の地の上に、書き直しは紙片の上に置かれる */
import { useState } from 'react';
import { KAGEROU_CONSTANTS as K } from '../../core/constants';
import { validateContent } from '../../core/stateMachine';

interface Props {
  initial?: string;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onPaper?: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}

export function NoteEditor({ initial = '', submitLabel = '書き留める', placeholder, autoFocus, onPaper, onSubmit, onCancel }: Props) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const len = Array.from(text).length;
  const over = len > K.MAX_NOTE_LENGTH;
  const empty = text.trim().length === 0;

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

  const fg = onPaper ? 'text-ink placeholder:text-ink/35' : 'text-[#e6dfd2] placeholder:text-dust-faint';
  const sub = onPaper ? 'text-ink/50' : 'text-dust-faint';

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <textarea
        id={onPaper ? 'edit-note' : 'new-note'}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
        placeholder={placeholder}
        rows={onPaper ? Math.min(12, Math.max(3, text.split('\n').length + 1)) : Math.min(8, Math.max(2, text.split('\n').length))}
        aria-label="メモ本文"
        className={`block w-full resize-none border-0 bg-transparent p-0 font-mincho text-[16px] leading-[2] focus:outline-none ${fg}`}
      />
      {(!empty || onPaper) && (
        <div className={`mt-3 flex items-center justify-between gap-3 font-mincho text-[12px] tracking-[0.1em] ${sub}`}>
          <span className={over || error ? 'text-shu' : ''} aria-live="polite">
            {error ?? `${len}／${K.MAX_NOTE_LENGTH}字`}
          </span>
          <span className="flex items-center gap-5">
            {onCancel && <button type="button" onClick={onCancel} className="py-2 hover:underline">やめる</button>}
            <button
              type="submit"
              disabled={busy || over || empty}
              className={`py-2 tracking-[0.2em] disabled:opacity-30 ${onPaper ? 'text-ink' : 'text-[#e6dfd2]'} border-b ${onPaper ? 'border-ink/40' : 'border-[#e6dfd2]/50'}`}
            >
              {submitLabel}
            </button>
          </span>
        </div>
      )}
    </form>
  );
}
