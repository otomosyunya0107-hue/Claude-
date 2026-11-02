/**
 * 実効時刻の提供（デバッグオフセット＋時計巻き戻し検知）。
 * now = (巻き戻し検知済みの実時刻) + debugTimeOffsetMs
 * lastKnownTime は実時刻で記録するため、タイムマシンのリセットは巻き戻し扱いにならない。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db/schema';
import { getConfig, patchConfig } from '../db/repository';
import { resolveBaseTime } from '../core/stateMachine';

const TICK_MS = 15_000;
const PERSIST_EVERY_MS = 30_000;

export function useTimeOffset() {
  const [ready, setReady] = useState(false);
  const [offset, setOffset] = useState(0);
  const [rolledBack, setRolledBack] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastKnown = useRef(0);
  const offsetRef = useRef(0);
  const lastPersisted = useRef(0);

  const compute = useCallback(() => {
    const real = Date.now();
    const { base, rolledBack: rb } = resolveBaseTime(real, lastKnown.current);
    setRolledBack(rb);
    if (!rb && real > lastKnown.current) {
      lastKnown.current = real;
      if (real - lastPersisted.current >= PERSIST_EVERY_MS) {
        lastPersisted.current = real;
        void patchConfig(db, { lastKnownTime: real });
      }
    }
    const n = base + offsetRef.current;
    setNow(n);
    return n;
  }, []);

  useEffect(() => {
    let alive = true;
    void getConfig(db).then((cfg) => {
      if (!alive) return;
      lastKnown.current = cfg.lastKnownTime;
      lastPersisted.current = 0;
      offsetRef.current = cfg.debugTimeOffsetMs;
      setOffset(cfg.debugTimeOffsetMs);
      compute();
      setReady(true);
    });
    const id = window.setInterval(compute, TICK_MS);
    const onVis = () => document.visibilityState === 'visible' && compute();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [compute]);

  const setDebugOffset = useCallback(async (ms: number) => {
    offsetRef.current = ms;
    setOffset(ms);
    await patchConfig(db, { debugTimeOffsetMs: ms });
    compute();
  }, [compute]);

  /** アクション直前に最新の実効時刻を取り直す */
  const getNow = useCallback(() => compute(), [compute]);

  return { ready, now, offset, rolledBack, setDebugOffset, getNow };
}
