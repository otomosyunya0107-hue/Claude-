/**
 * Web Audio API プロシージャル音響（仕様書 §6.2）。外部音源ファイルは使わない。
 * AudioContext はユーザー操作後に遅延生成する（自動再生ポリシー対策）。
 */
const MUTE_KEY = 'kagerou:muted';

type AC = AudioContext;

class SoundEngine {
  private ctx: AC | null = null;
  private noise: AudioBuffer | null = null;
  muted: boolean;

  constructor() {
    let m = false;
    try { m = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage 不可 */ }
    this.muted = m;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* noop */ }
  }

  private ensure(): AC | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AC) {
    if (!this.noise) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }

  /** 1. 砂払い音: ホワイトノイズ → bandpass(Q=3)、進捗で 400→1800Hz スイープ */
  startSweep(): { update: (p: number) => void; stop: () => void } {
    const ctx = this.ensure();
    if (!ctx) return { update: () => {}, stop: () => {} };
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.0;
    bp.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.08);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start();
    let stopped = false;
    return {
      update: (p) => {
        if (stopped) return;
        bp.frequency.setTargetAtTime(400 + 1400 * Math.min(1, Math.max(0, p)), ctx.currentTime, 0.03);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.12);
        src.stop(t + 0.15);
      },
    };
  }

  /** 2. 手入れ完了音: sine 528→880Hz / 0.3秒 */
  playPolishComplete() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** 3. 石碑化達成音: 220/330/440Hz の sine+triangle、2.5秒の減衰 */
  playMonument() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    master.connect(ctx.destination);
    const partials: [number, OscillatorType, number][] = [
      [220, 'sine', 1], [220, 'triangle', 0.35], [330, 'sine', 0.5], [330, 'triangle', 0.2], [440, 'sine', 0.35],
    ];
    for (const [f, type, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = amp * 0.4;
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 2.6);
    }
  }
}

export const sound = new SoundEngine();
