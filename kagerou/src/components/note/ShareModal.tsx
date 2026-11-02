/** SNSシェア用画像生成モーダル（仕様書 §5.5） */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { NoteEntity } from '../../db/types';
import { canvasToBlob, renderShareCanvas, type ShareFormat } from './shareImage';

interface Props {
  note: NoteEntity;
  now: number;
  onClose: () => void;
}

export function ShareModal({ note, now, onClose }: Props) {
  const [format, setFormat] = useState<ShareFormat>('square');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    const canvas = renderShareCanvas(note, now, format);
    void canvasToBlob(canvas).then((b) => {
      if (revoked) return;
      objectUrl = URL.createObjectURL(b);
      setBlob(b);
      setUrl(objectUrl);
    });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // 画像は開いた時点の状態で固定する（now の更新では作り直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, format]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filename = `kagerou-${note.id.slice(0, 8)}-${format}.png`;

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: '#Kagerou 読み返さない言葉は、30日で砂に還る。' });
      } else {
        download();
        setMsg('この端末は画像の共有に対応していないため、ダウンロードしました。');
      }
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') setMsg('共有できませんでした。ダウンロードをお試しください。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label="画像で切り取る">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121418] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">風化状態を画像で切り取る</h2>
          <button type="button" onClick={onClose} className="px-2 text-dim hover:text-ink" aria-label="閉じる">✕</button>
        </div>
        <div className="mb-3 flex gap-2 text-xs">
          {(['square', 'portrait'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`rounded-full border px-3 py-1 ${format === f ? 'border-moss text-moss' : 'border-white/10 text-dim'}`}
            >
              {f === 'square' ? '正方形 1080×1080' : '縦長 1080×1350'}
            </button>
          ))}
        </div>
        <div className="flex max-h-[55vh] items-center justify-center overflow-hidden rounded-lg bg-black">
          {url ? <img src={url} alt="生成されたシェア画像のプレビュー" className="max-h-[55vh] w-auto" /> : <div className="p-16 text-xs text-dim">生成中…</div>}
        </div>
        {msg && <p className="mt-2 text-xs text-dim">{msg}</p>}
        <div className="mt-4 flex justify-end gap-2 text-sm">
          <button type="button" onClick={download} disabled={!url} className="rounded-lg border border-white/10 px-4 py-2 text-ink hover:bg-white/5 disabled:opacity-30">
            ダウンロード
          </button>
          <button type="button" onClick={() => void share()} disabled={!blob} className="rounded-lg bg-ink px-4 py-2 font-medium text-void hover:bg-white disabled:opacity-30">
            共有する
          </button>
        </div>
      </motion.div>
    </div>
  );
}
