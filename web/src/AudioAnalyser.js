import * as THREE from 'three';

// Wraps the Web Audio API: takes a media source (uploaded file, the bundled
// track, or the microphone), runs an FFT, and exposes smoothed bass/mid/treble
// energies plus a DataTexture of the raw spectrum for the ring shader.
export class AudioAnalyser {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.audioEl = null;
    this.fftSize = 1024;
    this.bins = this.fftSize / 2;
    this.freqData = new Uint8Array(this.bins);

    // Smoothed band energies (0..1).
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;

    // Downsampled spectrum texture for the rings (keeps GPU upload small).
    this.texWidth = 256;
    this.texData = new Uint8Array(this.texWidth);
    this.texture = new THREE.DataTexture(
      this.texData, this.texWidth, 1, THREE.RedFormat, THREE.UnsignedByteType
    );
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    this.ready = false;
  }

  _ensureCtx() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  async _connectStream(stream) {
    this._ensureCtx();
    await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.ready = true;
  }

  // Play an <audio> element (file URL or bundled track) and route it to both
  // the analyser and the speakers.
  async playElement(url) {
    this._ensureCtx();
    await this.ctx.resume();
    if (this.audioEl) { this.audioEl.pause(); }
    this.audioEl = new Audio(url);
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.loop = true;
    this.source = this.ctx.createMediaElementSource(this.audioEl);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    await this.audioEl.play();
    this.ready = true;
  }

  async useMicrophone() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await this._connectStream(stream);
  }

  // When no real audio is available, synthesise a pleasant pulsing spectrum so
  // the visuals still "dance". time is seconds.
  _synth(time) {
    const beat = 0.5 + 0.5 * Math.sin(time * Math.PI * 1.6);
    const beat2 = 0.5 + 0.5 * Math.sin(time * Math.PI * 0.9 + 1.0);
    for (let i = 0; i < this.bins; i++) {
      const f = i / this.bins;
      const env = Math.exp(-f * 4.0);                 // bass-heavy falloff
      const wobble = 0.5 + 0.5 * Math.sin(time * 6.0 * (1.0 + f * 3.0) + i);
      const v = env * (0.4 + 0.6 * beat) * wobble + 0.1 * beat2 * (1.0 - f);
      this.freqData[i] = Math.min(255, v * 255);
    }
  }

  update(time) {
    if (this.ready && this.analyser) {
      this.analyser.getByteFrequencyData(this.freqData);
    } else {
      this._synth(time);
    }

    // Average the three classic bands.
    const avg = (lo, hi) => {
      let s = 0;
      for (let i = lo; i < hi; i++) s += this.freqData[i];
      return s / ((hi - lo) * 255);
    };
    const bassRaw = avg(1, Math.floor(this.bins * 0.08));
    const midRaw = avg(Math.floor(this.bins * 0.08), Math.floor(this.bins * 0.35));
    const trebleRaw = avg(Math.floor(this.bins * 0.35), this.bins);

    // Attack-fast / release-slow smoothing for snappy beats, calm decay.
    const smooth = (cur, target) => target > cur ? target : cur + (target - cur) * 0.12;
    this.bass = smooth(this.bass, bassRaw);
    this.mid = smooth(this.mid, midRaw);
    this.treble = smooth(this.treble, trebleRaw);

    // Resample spectrum into the ring texture (log-ish to spread the lows).
    for (let i = 0; i < this.texWidth; i++) {
      const t = i / this.texWidth;
      const src = Math.floor(Math.pow(t, 1.6) * this.bins);
      this.texData[i] = this.freqData[Math.min(this.bins - 1, src)];
    }
    this.texture.needsUpdate = true;
  }
}
