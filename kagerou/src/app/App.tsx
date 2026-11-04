import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTimeOffset } from '../hooks/useTimeOffset';
import { useNotes } from '../hooks/useNotes';
import { NoteEditor } from '../components/editor/NoteEditor';
import { NoteCard } from '../components/note/NoteCard';
import { ShareModal } from '../components/note/ShareModal';
import { TimeMachine } from '../components/debug/TimeMachine';
import { sound } from '../core/soundEngine';
import { haptic, initNative } from '../platform/native';
import type { NoteEntity } from '../db/types';
import { db } from '../db/schema';
import { ConfirmHost, askConfirm, closeConfirm } from '../components/ConfirmHost';
import { kanjiNum } from '../core/kanji';

const DEBUG_KEY = 'kagerou:debug';
// 開発時と体験版ビルド（VITE_DEBUG_DEFAULT=1）ではタイムマシンを既定で有効にする
const DEBUG_DEFAULT = import.meta.env.DEV || import.meta.env.VITE_DEBUG_DEFAULT === '1';

function initialDebug(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === '1') localStorage.setItem(DEBUG_KEY, '1');
    if (q === '0') localStorage.removeItem(DEBUG_KEY);
    return DEBUG_DEFAULT || localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return DEBUG_DEFAULT;
  }
}

export function App() {
  const time = useTimeOffset();
  const notes = useNotes(time.now, time.ready, time.getNow);
  const [muted, setMuted] = useState(sound.muted);
  const [debug, setDebug] = useState(initialDebug);
  const [showTM, setShowTM] = useState(debug);
  const [sharing, setSharing] = useState<NoteEntity | null>(null);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [dissolving, setDissolving] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;

  // Android の戻るボタン: 確認 → 共有シートの順に閉じる
  useEffect(() => {
    void initNative(() => {
      if (closeConfirm()) return true;
      if (sharingRef.current) { setSharing(null); return true; }
      return false;
    });
  }, []);

  useEffect(() => {
    const onDissolve = (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail;
      setDissolving((s) => new Set([...s, ...ids]));
      window.setTimeout(() => setDissolving((s) => { const n = new Set(s); ids.forEach((i) => n.delete(i)); return n; }), 2500);
    };
    window.addEventListener('kagerou:dissolve', onDissolve);
    return () => window.removeEventListener('kagerou:dissolve', onDissolve);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const onPolish = useCallback(async (id: string) => {
    try {
      const r = await notes.polish(id);
      if (r.monumented) {
        sound.playMonument();
        void haptic('heavy');
        setCelebrateId(id);
        setToast('石に刻まれました。もう風化しません。');
      } else {
        sound.playPolishComplete();
        void haptic('success');
        setToast(r.counted ? `手入れ ${kanjiNum(r.note.polishCount)}／五` : '手入れしました。二十時間以内の手入れは回数に数えません。');
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : '手入れできませんでした');
    }
  }, [notes]);

  const onEdit = useCallback(async (id: string, c: string) => { await notes.edit(id, c); }, [notes]);
  const onDelete = useCallback((id: string) => void notes.remove(id), [notes]);

  const toggleMute = () => { sound.setMuted(!muted); setMuted(!muted); };

  const resetAll = async () => {
    if (!(await askConfirm('すべての紙片と石碑、過去帳を消して、初めての状態に戻しますか。', '初期化する'))) return;
    await db.delete();
    location.reload();
  };

  const handlers = { onPolish, onEdit, onDelete, onShare: setSharing };
  const empty = !notes.loading && notes.living.length + notes.monuments.length + notes.tombs.length === 0;

  return (
    <div
      className="mx-auto min-h-screen max-w-xl"
      style={{
        paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)',
        paddingBottom: showTM ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)' : 'calc(env(safe-area-inset-bottom, 0px) + 48px)',
      }}
    >
      <header className="mb-10 flex items-start justify-between gap-4">
        <h1 className="font-mincho text-[22px] font-semibold tracking-[0.35em] text-[#e6dfd2]">カゲロウ</h1>
        <nav className="flex items-center gap-5 pt-1 font-mincho text-[12px] tracking-[0.15em] text-dust">
          {debug && !showTM && <button type="button" onClick={() => setShowTM(true)} className="py-1 hover:text-[#e6dfd2]">時を進める</button>}
          <button type="button" onClick={toggleMute} aria-pressed={muted} className="py-1 hover:text-[#e6dfd2]">
            {muted ? '音なし' : '音あり'}
          </button>
        </nav>
      </header>

      {time.rolledBack && (
        <p role="alert" className="mb-6 font-mincho text-[12px] leading-relaxed text-shu">
          端末の時計が巻き戻されています。風化は最後に記録された時刻から数えます。
        </p>
      )}

      <section className="mb-14 border-l border-dust-faint/60 pl-4">
        <NoteEditor placeholder="いま考えていることを、ここに。" onSubmit={async (c) => { await notes.add(c); }} />
      </section>

      <LayoutGroup>
        {notes.living.length > 0 && (
          <Section title="紙片" note={`${kanjiNum(notes.living.length)}枚`}>
            <ul className="space-y-7">
              <AnimatePresence initial={false}>
                {notes.living.map((n) => <NoteCard key={n.id} note={n} now={time.now} {...handlers} />)}
              </AnimatePresence>
            </ul>
          </Section>
        )}
        {notes.monuments.length > 0 && (
          <Section title="石碑" note={`${kanjiNum(notes.monuments.length)}基`}>
            <ul className="space-y-8">
              <AnimatePresence initial={false}>
                {notes.monuments.map((n) => <NoteCard key={n.id} note={n} now={time.now} celebrate={celebrateId === n.id} {...handlers} />)}
              </AnimatePresence>
            </ul>
          </Section>
        )}
        {notes.tombs.length > 0 && (
          <Section title="過去帳" note={`${kanjiNum(notes.tombs.length)}件`}>
            <ul className="divide-y divide-dust-faint/25 border-y border-dust-faint/25">
              {notes.tombs.map((n) => <NoteCard key={n.id} note={n} now={time.now} dissolving={dissolving.has(n.id)} {...handlers} />)}
            </ul>
          </Section>
        )}
      </LayoutGroup>

      {empty && <p className="py-16 text-center font-mincho text-[13px] text-dust-faint">まだ何も書かれていません。</p>}

      <footer className="mt-16 flex items-center justify-between font-mincho text-[11px] leading-relaxed text-dust-faint">
        <span>書いたものは、この端末の中にだけ残ります。</span>
        {debug ? (
          <button type="button" onClick={() => void resetAll()} className="py-1 hover:underline">初期化</button>
        ) : (
          <button type="button" onClick={() => { setDebug(true); setShowTM(true); try { localStorage.setItem(DEBUG_KEY, '1'); } catch { /* noop */ } }} className="opacity-0 focus:opacity-100" aria-label="検証モード">·</button>
        )}
      </footer>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-5"
            style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${showTM ? 84 : 24}px)` }}
          >
            <p role="status" className="paper px-5 py-2.5 font-mincho text-[13px] tracking-[0.08em] shadow-[0_8px_20px_rgba(0,0,0,0.5)]">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmHost />
      {showTM && debug && <TimeMachine offset={time.offset} onChange={(ms) => void time.setDebugOffset(ms)} onClose={() => setShowTM(false)} />}
      {sharing && <ShareModal note={sharing} now={time.now} onClose={() => setSharing(null)} />}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="mb-6 flex items-baseline gap-3 font-mincho text-[13px] tracking-[0.4em] text-[#cfc6b6]">
        {title}<span className="text-[11px] tracking-[0.15em] text-dust-faint">{note}</span>
      </h2>
      {children}
    </section>
  );
}
