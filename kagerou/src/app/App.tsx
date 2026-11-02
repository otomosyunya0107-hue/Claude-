import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTimeOffset } from '../hooks/useTimeOffset';
import { useNotes } from '../hooks/useNotes';
import { NoteEditor } from '../components/editor/NoteEditor';
import { NoteCard } from '../components/note/NoteCard';
import { ShareModal } from '../components/note/ShareModal';
import { TimeMachine } from '../components/debug/TimeMachine';
import { haptic, sound } from '../core/soundEngine';
import type { NoteEntity } from '../db/types';
import { db } from '../db/schema';

const DEBUG_KEY = 'kagerou:debug';

function initialDebug(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === '1') localStorage.setItem(DEBUG_KEY, '1');
    if (q === '0') localStorage.removeItem(DEBUG_KEY);
    return import.meta.env.DEV || localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return import.meta.env.DEV;
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

  // 目の前で墓標化したノートに砂のエフェクトを出す
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
        haptic([60, 40, 120]);
        setCelebrateId(id);
        setToast('石碑に刻まれました。この言葉はもう風化しません。');
      } else {
        sound.playPolishComplete();
        haptic(30);
        setToast(r.counted ? `手入れしました（${r.note.polishCount}/5）` : '手入れしました（20時間以内の再手入れは回数に数えません）');
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : '手入れできませんでした');
    }
  }, [notes]);

  const onEdit = useCallback(async (id: string, c: string) => { await notes.edit(id, c); }, [notes]);
  const onDelete = useCallback((id: string) => void notes.remove(id), [notes]);

  const toggleMute = () => { sound.setMuted(!muted); setMuted(!muted); };

  const resetAll = async () => {
    if (!window.confirm('すべてのノートと設定を消去して初回状態に戻しますか？')) return;
    await db.delete();
    location.reload();
  };

  const handlers = { onPolish, onEdit, onDelete, onShare: setSharing };
  const empty = !notes.loading && notes.living.length + notes.monuments.length + notes.tombs.length === 0;

  return (
    <div className={`mx-auto min-h-screen max-w-2xl px-4 pt-6 ${showTM ? 'pb-28' : 'pb-16'}`}>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mincho text-2xl tracking-[0.25em]">
            カゲロウ<span className="ml-2 align-middle font-sans text-[11px] tracking-[0.3em] text-dim">KAGEROU</span>
          </h1>
          <p className="mt-1 text-xs text-dim">読み返さない言葉は、30日で砂に還る。</p>
        </div>
        <div className="flex items-center gap-1 text-dim">
          {debug && !showTM && (
            <button type="button" onClick={() => setShowTM(true)} className="rounded-md px-2 py-1 text-sm hover:text-ink" aria-label="タイムマシンを開く">⏳</button>
          )}
          <button type="button" onClick={toggleMute} className="rounded-md px-2 py-1 text-sm hover:text-ink" aria-label={muted ? '音を出す' : 'ミュート'} aria-pressed={muted}>
            {muted ? '🔇' : '🔈'}
          </button>
        </div>
      </header>

      {time.rolledBack && (
        <div role="alert" className="mb-4 rounded-lg border border-rust/40 bg-rust/10 px-3 py-2 text-xs text-rust">
          端末の時計が巻き戻されたことを検知しました。風化は最後に記録された時刻を基準に計算されます。
        </div>
      )}

      <section className="mb-8 rounded-2xl border border-white/5 bg-paper/60 p-4">
        <NoteEditor placeholder="いま考えていることを書き留める（1〜1,000文字）" onSubmit={async (c) => { await notes.add(c); }} />
      </section>

      <LayoutGroup>
        {notes.living.length > 0 && (
          <Section title="風化しつつある言葉" count={notes.living.length}>
            {notes.living.map((n) => <NoteCard key={n.id} note={n} now={time.now} {...handlers} />)}
          </Section>
        )}
        {notes.monuments.length > 0 && (
          <Section title="石碑" count={notes.monuments.length}>
            {notes.monuments.map((n) => <NoteCard key={n.id} note={n} now={time.now} celebrate={celebrateId === n.id} {...handlers} />)}
          </Section>
        )}
        {notes.tombs.length > 0 && (
          <Section title="墓標" count={notes.tombs.length}>
            {notes.tombs.map((n) => <NoteCard key={n.id} note={n} now={time.now} dissolving={dissolving.has(n.id)} {...handlers} />)}
          </Section>
        )}
      </LayoutGroup>

      {empty && <p className="py-16 text-center text-sm text-dim">まだ何も刻まれていません。</p>}

      <footer className="mt-12 flex justify-center gap-4 text-[11px] text-dim/60">
        <span>データはこの端末の中だけに保存されます</span>
        {debug && <button type="button" onClick={() => void resetAll()} className="underline hover:text-ink">初期化</button>}
        {!debug && <button type="button" onClick={() => { setDebug(true); setShowTM(true); try { localStorage.setItem(DEBUG_KEY, '1'); } catch { /* noop */ } }} className="opacity-0 focus:opacity-100" aria-label="デバッグモード">·</button>}
      </footer>

      <AnimatePresence>
        {toast && (
          <div className={`pointer-events-none fixed inset-x-0 ${showTM ? 'bottom-20' : 'bottom-6'} z-50 flex justify-center px-4`}>
            <div role="status" className="rounded-full border border-white/10 bg-[#1b1e24] px-4 py-2 text-xs text-ink shadow-xl">{toast}</div>
          </div>
        )}
      </AnimatePresence>

      {showTM && debug && <TimeMachine offset={time.offset} onChange={(ms) => void time.setDebugOffset(ms)} onClose={() => setShowTM(false)} />}
      {sharing && <ShareModal note={sharing} now={time.now} onClose={() => setSharing(null)} />}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-baseline gap-2 text-xs tracking-[0.2em] text-dim">
        {title}<span className="font-mono text-dim/60">{count}</span>
      </h2>
      <ul className="space-y-3">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </ul>
    </section>
  );
}
