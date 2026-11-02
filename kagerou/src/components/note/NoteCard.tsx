/** 状態別カードコンテナ (Paper / Stone / Tombstone) */
import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import type { NoteEntity } from '../../db/types';
import { canEdit, decayOf, deriveStatus, remainingDays } from '../../core/stateMachine';
import { visualDecay } from '../../core/decayEngine';
import { KAGEROU_CONSTANTS as K } from '../../core/constants';
import { DecayedText } from './DecayedText';
import { PolishButton } from './PolishButton';
import { formatDate } from './format';
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

const STATUS_LABEL = { FRESH: '鮮明', WEATHERING: '風化進行', CRITICAL: '消滅寸前', TOMBSTONE: '墓標', MONUMENT: '石碑' } as const;

export function NoteCard(props: Props) {
  const status = deriveStatus(props.note, props.now);
  return (
    <motion.li
      layout
      layoutId={props.note.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="list-none"
    >
      {status === 'MONUMENT' ? <StoneCard {...props} /> : status === 'TOMBSTONE' ? <TombCard {...props} /> : <PaperCard {...props} />}
    </motion.li>
  );
}

function Menu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="メニュー"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-2 py-1 text-lg leading-none text-dim hover:bg-white/5 hover:text-ink"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-white/10 bg-[#1b1e24] py-1 text-sm shadow-xl">
            {items.map((it) => (
              <li key={it.label}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); it.onClick(); }}
                  className={`block w-full px-4 py-2.5 text-left hover:bg-white/5 ${it.danger ? 'text-rust' : 'text-ink'}`}
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function confirmDelete(onDelete: () => void, message = 'このノートを削除しますか？この操作は取り消せません。', okLabel = '削除する') {
  void askConfirm(message, okLabel).then((ok) => ok && onDelete());
}

function PaperCard({ note, now, onPolish, onEdit, onDelete, onShare }: Props) {
  const [hold, setHold] = useState(0);
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState(0);
  const status = deriveStatus(note, now);
  const rLinear = decayOf(note, now);
  const rVisual = visualDecay(rLinear);
  const rEffective = rVisual * (1 - hold);
  const days = remainingDays(note, now);
  const warn = days <= K.WARNING_DAYS;
  const editable = canEdit(note, now);

  const complete = useCallback(() => {
    setFlash((f) => f + 1);
    onPolish(note.id);
  }, [note.id, onPolish]);

  // 風化に伴い境界線が薄れる
  const borderAlpha = 0.55 * (1 - rLinear);

  return (
    <article
      className="relative overflow-hidden rounded-2xl bg-paper p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]"
      style={{ border: `1px solid rgba(76,86,106,${borderAlpha.toFixed(3)})` }}
      aria-label={`ノート（${STATUS_LABEL[status]}）`}
      data-status={status}
      data-note-id={note.id}
    >
      {flash > 0 && (
        <motion.div
          key={flash}
          className="pointer-events-none absolute inset-0 bg-moss/15"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
        />
      )}
      <header className="mb-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${warn ? 'bg-rust/15 text-rust' : 'bg-white/5 text-dim'}`}
            data-testid="days-badge"
          >
            {warn ? `消滅まであと ${days} 日` : `あと ${days} 日`}
          </span>
          <span className="text-dim">風化度 {Math.round(rLinear * 100)}%</span>
          <span className="text-dim" data-testid="polish-count">手入れ {note.polishCount}/{K.MONUMENT_THRESHOLD}</span>
          {note.isTutorial && <span className="text-relic/80">チュートリアル</span>}
        </div>
        <Menu
          items={[
            ...(editable ? [{ label: '編集する', onClick: () => setEditing(true) }] : []),
            { label: '風化状態を画像で切り取る', onClick: () => onShare(note) },
            { label: '削除する', danger: true, onClick: () => confirmDelete(() => onDelete(note.id)) },
          ]}
        />
      </header>

      {editing && editable ? (
        <NoteEditor
          initial={note.content ?? ''}
          submitLabel="保存"
          onSubmit={async (c) => { await onEdit(note.id, c); setEditing(false); }}
          onCancel={() => setEditing(false)}
          autoFocus
        />
      ) : (
        <DecayedText content={note.content ?? ''} seed={note.seed} rVisual={rEffective} className="text-[15px] text-ink" />
      )}

      <footer className="mt-4 flex items-end justify-between gap-3">
        <div className="text-[11px] text-dim/80">
          {formatDate(note.createdAt)}
          {!editable && !editing && <span className="ml-2">· 編集するには先に手入れが必要です</span>}
        </div>
        {!editing && <PolishButton onProgress={setHold} onComplete={complete} />}
      </footer>
    </article>
  );
}

function StoneCard({ note, onDelete, onShare, celebrate }: Props) {
  return (
    <motion.article
      className="stone-surface relative overflow-hidden rounded-2xl p-6"
      data-status="MONUMENT"
      data-note-id={note.id}
      aria-label="ノート（石碑）"
      initial={celebrate ? { scale: 1.06, boxShadow: '0 0 0px rgba(136,192,208,0)' } : false}
      animate={celebrate ? { scale: 1, boxShadow: ['0 0 0px rgba(136,192,208,0)', '0 0 48px rgba(136,192,208,0.55)', '0 0 0px rgba(136,192,208,0)'] } : undefined}
      transition={{ duration: 2.2, ease: 'easeOut' }}
    >
      {celebrate && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-relic/25 to-transparent"
          initial={{ y: '-100%' }}
          animate={{ y: '100%' }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />
      )}
      <header className="mb-4 flex items-center justify-between text-xs">
        <span className="rounded-full border border-relic/40 px-2.5 py-0.5 tracking-[0.2em] text-relic">石碑</span>
        <Menu
          items={[
            { label: '画像で切り取る', onClick: () => onShare(note) },
            { label: '削除する', danger: true, onClick: () => confirmDelete(() => onDelete(note.id), '石碑を砕きますか？この操作は取り消せません。', '砕く') },
          ]}
        />
      </header>
      <p className="engraved whitespace-pre-wrap break-words text-[17px] leading-loose">{note.content}</p>
      <footer className="mt-5 text-right text-[11px] tracking-wider text-relic/70">
        {formatDate(note.createdAt)} 刻 · {note.monumentedAt ? `${formatDate(note.monumentedAt)} 石碑化` : ''}
      </footer>
    </motion.article>
  );
}

function SandBurst() {
  const grains = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {grains.map((i) => {
        const x = (i * 37) % 100;
        const delay = (i % 9) * 0.06;
        return (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-[#b8a888]"
            style={{ left: `${x}%`, top: `${20 + ((i * 53) % 50)}%` }}
            initial={{ opacity: 0.9, y: 0, x: 0 }}
            animate={{ opacity: 0, y: 60 + (i % 5) * 14, x: ((i % 7) - 3) * 8 }}
            transition={{ duration: 1.8, delay, ease: 'easeIn' }}
          />
        );
      })}
    </div>
  );
}

function TombCard({ note, onDelete, onShare, dissolving }: Props) {
  return (
    <article
      className="relative rounded-2xl border border-dashed border-tombline bg-transparent px-5 py-4"
      data-status="TOMBSTONE"
      data-note-id={note.id}
      aria-label="墓標"
    >
      {dissolving && <SandBurst />}
      <div className="flex items-start justify-between gap-3">
        <p className="font-mincho text-sm leading-relaxed text-dim">
          <span className="mr-2 text-dim/60">墓標</span>
          {tombMessage(note)}
        </p>
        <Menu
          items={[
            { label: '墓標を画像で切り取る', onClick: () => onShare(note) },
            { label: '墓標を片付ける', danger: true, onClick: () => onDelete(note.id) },
          ]}
        />
      </div>
    </article>
  );
}
