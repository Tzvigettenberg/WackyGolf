// SFX — Phase 4f
//
// WebAudio synthesized one-shots. No asset loading — every sound is built
// on the fly from oscillators + noise buffers. Keeps the bundle tiny and
// avoids the network/decode latency you get with mp3/ogg files.
//
// Browser autoplay rules: AudioContext starts suspended until a user
// gesture. We listen once for pointerdown/touchstart/keydown, resume the
// context, and from then on sounds play instantly.
//
// Mute state persists in localStorage under `wackygolf_muted_v1`.
//
// Usage:
//   import { sfx } from './audio/Sfx.js';
//   sfx.swing(0.7);   // 0..1 power
//   sfx.cupDrop();
//   sfx.setMuted(true);
//   sfx.isMuted();

const MUTE_KEY = 'wackygolf_muted_v1';

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = this._loadMute();
    this._unlocked = false;

    const unlock = () => {
      this._ensureCtx();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      this._unlocked = true;
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  setMuted(muted) {
    this.muted = !!muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch (_) {}
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }
  isMuted() { return this.muted; }

  // -------- one-shot generators --------

  /** Swing release — pitched whoosh, length scales with power. */
  swing(power = 0.5) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const dur = 0.18;

    // Pitch-down sawtooth = "whoosh"
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const f0 = 180 + power * 240;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.32, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);

    // Brief noise puff to give it body
    const noiseDur = 0.06;
    const noise = this._noiseBuffer(noiseDur);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.18 + power * 0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
    src.connect(ng).connect(this.master);
    src.start(t);
  }

  /**
   * Ground contact — tick that varies with impact strength AND surface.
   *   fairway — bright square click (default)
   *   green   — soft, higher-pitched sine "tip"
   *   rough   — low-passed noise thud
   *   (sand handled separately by bunker())
   */
  bounce(intensity = 0.5, surface = 'fairway') {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    if (surface === 'green') {
      // Putting-green tip — softer, higher
      const dur = 0.06;
      const f = 760 + intensity * 180;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(Math.min(0.13, 0.04 + intensity * 0.10), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      return;
    }

    if (surface === 'rough') {
      // Rough grass = muffled lowpass-noise thud
      const dur = 0.09;
      const noise = this._noiseBuffer(dur);
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(Math.min(0.20, 0.06 + intensity * 0.14), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(g).connect(this.master);
      src.start(t);
      return;
    }

    // Fairway (default) — bright square click
    const dur = 0.05;
    const f = 480 + intensity * 220;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.45, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.18, 0.05 + intensity * 0.13), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Ball into cup — descending sine + chime. The dopamine hit. */
  cupDrop() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    // Dropping sine = "plonk"
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(720, t);
    osc1.frequency.exponentialRampToValueAtTime(280, t + 0.28);
    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.linearRampToValueAtTime(0.32, t + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc1.connect(g1).connect(this.master);
    osc1.start(t);
    osc1.stop(t + 0.36);

    // Higher chime accent
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1980, t + 0.22);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.05);
    g2.gain.linearRampToValueAtTime(0.16, t + 0.07);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
    osc2.connect(g2).connect(this.master);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.32);
  }

  /** Water hazard — low-passed white noise burst. */
  splash() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const dur = 0.42;

    const noise = this._noiseBuffer(dur);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(380, t + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  /** Sand landing — muffled thud. */
  bunker() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const dur = 0.22;

    // Filtered noise + low sine for the thud
    const noise = this._noiseBuffer(dur);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 550;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.32, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(ng).connect(this.master);
    src.start(t);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + dur);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Run over — short descending minor cue + low thud. The "you lose" cue. */
  runOver() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    // G4, Eb4, Bb3 — descending minor third + minor third = unresolved sad
    const notes = [392, 311.13, 233.08];
    for (let i = 0; i < notes.length; i++) {
      const startT = t + i * 0.18;
      const dur = 0.42;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], startT);
      osc.frequency.exponentialRampToValueAtTime(notes[i] * 0.85, startT + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(0.18, startT + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, startT + dur);
      osc.connect(g).connect(this.master);
      osc.start(startT);
      osc.stop(startT + dur + 0.05);
    }
    // Low sine thud at the end for finality.
    const thudT = t + 0.6;
    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(110, thudT);
    thud.frequency.exponentialRampToValueAtTime(50, thudT + 0.55);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.32, thudT);
    tg.gain.exponentialRampToValueAtTime(0.001, thudT + 0.55);
    thud.connect(tg).connect(this.master);
    thud.start(thudT);
    thud.stop(thudT + 0.6);
  }

  /** Cash gained — bright two-note coin chime. */
  cashGain() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const freqs = [880, 1108]; // A5 and ~C#6 — pleasant interval
    for (let i = 0; i < freqs.length; i++) {
      const startT = t + i * 0.045;
      const dur = 0.22;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freqs[i];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(0.18, startT + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, startT + dur);
      osc.connect(g).connect(this.master);
      osc.start(startT);
      osc.stop(startT + dur + 0.02);
    }
  }

  // ----- UI ticks -----

  /** Tiny pitched click for a number that's counting up. Pitch climbs
   *  with `progress` (0..1) so a long count-up sounds like a slot machine
   *  ramp. Designed to be called ~20 times per second during animations. */
  cashTick(progress = 0.5) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const dur = 0.04;
    const f = 720 + Math.max(0, Math.min(1, progress)) * 520;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  uiClick() { this._uiTick(800, 0.04, 0.10); }
  uiBuy() {
    this._uiTick(700, 0.05, 0.16);
    this._scheduleTick(1100, 0.06, 0.16, 0.06);
  }
  uiSell() {
    this._uiTick(900, 0.05, 0.16);
    this._scheduleTick(550, 0.06, 0.16, 0.06);
  }
  uiReroll() {
    this._uiTick(620, 0.04, 0.13);
    this._scheduleTick(820, 0.04, 0.13, 0.05);
    this._scheduleTick(1020, 0.04, 0.13, 0.10);
  }

  // ----- internals -----

  _ready() {
    if (this.muted) return false;
    if (!this._unlocked) return false;
    this._ensureCtx();
    return !!this.ctx;
  }

  _ensureCtx() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
  }

  _loadMute() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; }
    catch (_) { return false; }
  }

  _uiTick(freq, dur, gain) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _scheduleTick(freq, dur, gain, delaySec) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime + delaySec;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noiseBuffer(durationSec) {
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * durationSec);
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}

export const sfx = new Sfx();
