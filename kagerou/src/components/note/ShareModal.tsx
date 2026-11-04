/** 風化状態を画像で切り取る（仕様書 §5.5） */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { NoteEntity } from '../../db/types';
import { canvasToBlob, renderShareCanvas, shareFontsReady, type ShareFormat } from './shareImage';
import { isNative, shareImage } from '../../platform/native';

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
    // フォントの読み込みを待ってから描く（明朝が代替書体で描かれるのを防ぐ）
    void shareFontsReady(note, now).then(() => canvasToBlob(renderShareCanvas(note, now, format))).then((b) => {
      if (revoked) return;
      objectUrl = URL.createObjectURL(b);
      setBlob(b);
      setUrl(objectUrl);
    });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // 画像は開いた時点の状態で固定する
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
    const r = await shareImage(blob, filename, '読み返さない言葉は、三十日で砂に還る。 #カゲロウ');
    if (r === 'unsupported') {
      download();
      setMsg('共有メニューを開けなかったため、保存を試みました。保存されないときは画像を長押ししてください。');
    }
  };

  const Opt = ({ f, label }: { f: ShareFormat; label: string }) => (
    <button type="button" onClick={() => setFormat(f)} aria-pressed={format === f}
      className={`py-1 ${format === f ? 'border-b border-[#e6dfd2]/60 text-[#e6dfd2]' : 'text-dust-faint'}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b0a09]/80 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label="画像で切り取る">
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-sumi-raised px-5 pt-5 sm:mb-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between font-mincho">
          <h2 className="text-[14px] tracking-[0.3em] text-[#e6dfd2]">切り取る</h2>
          <button type="button" onClick={onClose} className="py-1 text-[12px] tracking-[0.15em] text-dust">閉じる</button>
        </div>
        <div className="mb-4 flex gap-6 font-mincho text-[12px] tracking-[0.1em]">
          <Opt f="square" label="正方形" />
          <Opt f="portrait" label="縦長" />
        </div>
        <div className="flex max-h-[55vh] items-center justify-center overflow-hidden bg-black/40">
          {url ? <img src={url} alt="生成されたシェア画像のプレビュー" className="max-h-[55vh] w-auto" /> : <div className="p-16 font-mincho text-[12px] text-dust-faint">紙を写しています</div>}
        </div>
        <p className="mt-3 font-mincho text-[11px] leading-relaxed text-dust-faint">
          {msg ?? (isNative ? '共有から写真への保存もできます。' : '保存できないときは、画像を長押ししてください。')}
        </p>
        <div className="mt-4 flex justify-end gap-7 font-mincho text-[13px] tracking-[0.2em]">
          {!isNative && <button type="button" onClick={download} disabled={!url} className="py-2 text-dust disabled:opacity-30">保存</button>}
          <button type="button" onClick={() => void share()} disabled={!blob} className="border-b border-[#e6dfd2]/60 py-2 text-[#e6dfd2] disabled:opacity-30">共有する</button>
        </div>
      </motion.div>
    </div>
  );
}
