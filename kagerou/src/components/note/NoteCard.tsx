/** 紙片 / 石碑 / 過去帳の一行 */
import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { NoteEntity } from '../../db/types';
import { canEdit, decayOf, deriveStatus, remainingDays } from '../../core/stateMachine';
import { visualDecay } from '../../core/decayEngine';
import { KAGEROU_CONSTANTS as K } from '../../core/constants';
import { kanjiDate, kanjiNum } from '../../core/kanji';
import { paperClipPath, paperColor, paperStains, paperTilt } from '../../core/paperShape';
import { DecayedText } from './DecayedText';
import { PolishButton } from './PolishButton';
import { tombMessage } from './shareImage';
import { NoteEditor } from '../editor/NoteEditor';
import { askConfirm } from '../ConfirmHost';

export interface CardHandlers {
  onPolish: (id: string) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
  onShare: (note: NoteEntity) => void;
}

interface Props extends CardHandlers {
  note: NoteEntity;
  now: number;
  celebrate?: boolean;
  dissolving?: boolean;
}

export function NoteCard(props: Props) {
  const status = deriveStatus(props.note, props.now);
  if (status === 'TOMBSTONE') return <TombRow {...props} />;
  return (
    <motion.li
      layout
      layoutId={props.note.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
      transition={{ type: 'spring', stiffness: 220, damping: 30 }}
      className="list-none"
    >
      {status === 'MONUMENT' ? <Stele {...props} /> : <PaperSlip {...props} />}
    </motion.li>
  );
}

function TextAction({ children, onClick, tone = 'ink' }: { children: string; onClick: () => void; tone?: 'ink' | 'shu' | 'stone' }) {
  const color = tone === 'shu' ? 'text-shu' : tone === 'stone' ? 'text-[#20211f]' : 'text-ink/60';
  return (
    <button type="button" onClick={onClick} className={`py-2 font-mincho text-[12px] tracking-[0.15em] ${color} hover:underline`}>
      {children}
    </button>
  );
}

function confirmDelete(onDelete: () => void, message: string, okLabel: string) {
  void askConfirm(message, okLabel).then((ok) => ok && onDelete());
}

/** 朱印：消滅間近の紙片に押される */
function Seal({ days }: { days: number }) {
  return (
    <div
      aria-label={`消滅まであと${days}日`}
      className="absolute right-4 top-4 grid h-12 w-12 rotate-[8deg] place-items-center border-2 border-shu/80 font-mincho text-[11px] leading-[1.15] text-shu/85 mix-blend-multiply"
      style={{ borderRadius: '3px' }}
    >
      <span className="text-center">残<br />{kanjiNum(days)}日</span>
    </div>
  );
}

function PaperSlip({ note, now, onPolish, onEdit, onDelete, onShare }: Props) {
  const [hold, setHold] = useState(0);
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState(0);
  const rLinear = decayOf(note, now);
  // 長押し中は紙そのものも若返る
  const shown = rLinear * (1 - hold);
  const rVisual = visualDecay(rLinear) * (1 - hold);
  const days = remainingDays(note, now);
  const warn = days <= K.WARNING_DAYS;
  const editable = canEdit(note, now);
  const status = deriveStatus(note, now);

  const q = Math.round(shown * 20) / 20;
  const clip = useMemo(() => paperClipPath(note.seed, q), [note.seed, q]);
  const stains = useMemo(() => paperStains(note.seed, q), [note.seed, q]);
  const tilt = useMemo(() => paperTilt(note.seed), [note.seed]);

  const complete = useCallback(() => { setFlash((f) => f + 1); onPolish(note.id); }, [note.id, onPolish]);

  return (
    <div style={{ transform: `rotate(${tilt}deg)` }} className="paper-wrap">
      <article
        className="paper relative px-6 pb-3 pt-6"
        style={{ clipPath: clip, ['--paper' as string]: paperColor(shown), ['--stains' as string]: stains }}
        data-status={status}
        data-note-id={note.id}
        aria-label={`紙片 あと${days}日`}
      >
        {flash > 0 && (
          <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-[#f7f3ea]" initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} transition={{ duration: 1.1 }} />
        )}
        {warn && <Seal days={days} />}

        <p className="mb-4 pr-14 font-mincho text-[11px] tracking-[0.2em] text-ink/55" data-testid="days-badge">
          {kanjiDate(note.createdAt)}
          {!warn && <><span className="mx-2">·</span>残り{kanjiNum(days)}日</>}
          <span className="sr-only">風化度 {Math.round(rLinear * 100)}%</span>
        </p>

        {editing && editable ? (
          <NoteEditor
            initial={note.content ?? ''}
            submitLabel="書き直す"
            onSubmit={async (c) => { await onEdit(note.id, c); setEditing(false); }}
            onCancel={() => setEditing(false)}
            autoFocus
            onPaper
          />
        ) : (
          <DecayedText content={note.content ?? ''} seed={note.seed} rVisual={rVisual} className="font-mincho text-[16px] leading-[2]" />
        )}

        {!editing && (
          <footer className="mt-5 flex items-end justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-4">
              <span className="font-mincho text-[11px] tracking-[0.15em] text-ink/50" data-testid="polish-count">
                手入れ {kanjiNum(note.polishCount)}／{kanjiNum(K.MONUMENT_THRESHOLD)}
              </span>
              {editable && <TextAction onClick={() => setEditing(true)}>書き直す</TextAction>}
              <TextAction onClick={() => onShare(note)}>切り取る</TextAction>
              <TextAction tone="shu" onClick={() => confirmDelete(() => onDelete(note.id), 'この紙片を捨てますか。取り消せません。', '捨てる')}>捨てる</TextAction>
            </div>
            <PolishButton onProgress={setHold} onComplete={complete} />
          </footer>
        )}
      </article>
    </div>
  );
}

function Stele({ note, onDelete, onShare, celebrate }: Props) {
  return (
    <motion.article
      className="stele relative mx-auto max-w-[34rem] px-8 pb-5 pt-10"
      data-status="MONUMENT"
      data-note-id={note.id}
      aria-label="石碑"
      initial={celebrate ? { y: 24, opacity: 0 } : false}
      animate={celebrate ? { y: 0, opacity: 1 } : undefined}
      transition={{ duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {celebrate && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[#ebe5d8]"
          style={{ borderRadius: 'inherit' }}
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.4 }}
        />
      )}
      <p className="carved mb-6 text-center text-[11px] tracking-[0.5em]">石碑</p>
      <p className="carved engraved whitespace-pre-wrap break-words text-[17px] leading-[2.1]">{note.content}</p>
      <footer className="mt-8 space-y-1">
        <p className="carved text-[11px] leading-[1.9] tracking-[0.15em]">
          {kanjiDate(note.createdAt)} 記
          {note.monumentedAt && <><br />{kanjiDate(note.monumentedAt)} 刻</>}
        </p>
        <span className="flex justify-end gap-6 whitespace-nowrap">
          <TextAction tone="stone" onClick={() => onShare(note)}>拓本をとる</TextAction>
          <TextAction tone="stone" onClick={() => confirmDelete(() => onDelete(note.id), '石碑を砕きますか。取り消せません。', '砕く')}>砕く</TextAction>
        </span>
      </footer>
    </motion.article>
  );
}

function SandBurst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute h-[3px] w-[3px] rounded-full bg-[#b9a982]"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 60}%` }}
          initial={{ opacity: 0.9, y: 0 }}
          animate={{ opacity: 0, y: 40 + (i % 5) * 10, x: ((i % 7) - 3) * 6 }}
          transition={{ duration: 1.8, delay: (i % 9) * 0.05, ease: 'easeIn' }}
        />
      ))}
    </span>
  );
}

function TombRow({ note, onDelete, onShare, dissolving }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative list-none" data-status="TOMBSTONE" data-note-id={note.id}>
      {dissolving && <SandBurst />}
      <article aria-label="墓標">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-baseline gap-3 py-3 text-left font-mincho text-[13px] leading-relaxed text-dust"
        >
          <span className="shrink-0 tabular-nums text-dust-faint">{note.decayedAt ? kanjiDate(note.decayedAt) : ''}</span>
          <span className="min-w-0 flex-1">{tombMessage(note)}</span>
        </button>
        {open && (
          <div className="-mt-1 flex gap-5 pb-3 pl-1">
            <button type="button" onClick={() => onShare(note)} className="font-mincho text-[12px] tracking-[0.15em] text-dust hover:underline">墓標を切り取る</button>
            <button type="button" onClick={() => onDelete(note.id)} className="font-mincho text-[12px] tracking-[0.15em] text-dust-faint hover:underline">帳から消す</button>
          </div>
        )}
      </article>
    </li>
  );
}
