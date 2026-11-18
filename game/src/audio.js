// Solmar City — synthesised sound effects and a small music loop, WebAudio only.
// No audio files: every sound is built from oscillators and filtered noise.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
  }

  /** Create the context on a user gesture; safe to call repeatedly. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
    } catch (err) { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** Short oscillator blip. */
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (err) { /* audio is best-effort */ }
  }

  /** Filtered noise burst (gunshots, thuds, skids). */
  noise(dur, vol, filterFreq, type) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(t);
    } catch (err) { /* audio is best-effort */ }
  }

  gunshot() { this.noise(0.14, 0.6, 2600, 'highpass'); this.blip(160, 0.08, 'square', 0.25, 60); }
  punch() { this.noise(0.09, 0.5, 500); this.blip(90, 0.09, 'sine', 0.4, 45); }
  pickup() { this.blip(660, 0.1, 'sine', 0.3); setTimeout(() => this.blip(990, 0.16, 'sine', 0.3), 90); }
  cash() { this.blip(880, 0.08, 'triangle', 0.3); setTimeout(() => this.blip(1174, 0.14, 'triangle', 0.3), 80); }
  crash() { this.noise(0.35, 0.7, 700); this.blip(70, 0.3, 'sawtooth', 0.3, 35); }
  skid() { this.noise(0.25, 0.18, 1800, 'bandpass'); }
  sirenBlip() { this.blip(880, 0.18, 'square', 0.08, 660); }
  door() { this.noise(0.12, 0.3, 900); }
  hurt() { this.blip(220, 0.2, 'sawtooth', 0.3, 110); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.3), i * 110));
  }

  /** Continuous engine hum whose pitch follows speed; call every frame. */
  setEngine(speed01, on) {
    if (!this.ctx || this.muted) return;
    try {
      if (!on) {
        if (this.engineOsc) { this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
        return;
      }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 600;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.sfxGain);
        this.engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, t, 0.1);
    } catch (err) { /* audio is best-effort */ }
  }

  /** A laid-back synth loop: bass notes plus a sparse pluck melody. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // A minor-key bassline that loops every 8 steps; melody floats above it.
    const bass = [55, 0, 55, 65.4, 49, 0, 58.3, 65.4];
    const melody = [220, 0, 261.6, 0, 329.6, 0, 261.6, 196];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.musicStep % 8;
      const b = bass[i], m = melody[i];
      if (b) this.musicNote(b, 0.42, 'triangle', 0.5);
      if (m && this.musicStep % 2 === 0) this.musicNote(m, 0.3, 'sine', 0.16);
      this.musicStep++;
    }, 340);
  }

  musicNote(freq, dur, type, vol) {
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (err) { /* audio is best-effort */ }
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
