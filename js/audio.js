// Sound: a few synthesised effects, and a pentatonic tune for the land, the towns and battle (plucked notes over a
// drone, in the manner of old Chinese-themed game music). Starts on the first key press or touch.
const PENT = [0, 2, 4, 7, 9];
const TUNES = {
  field: { bpm: 92, root: 57, wave: 'triangle', drone: 45, seed: 3 },
  town: { bpm: 104, root: 62, wave: 'triangle', drone: 50, seed: 7 },
  battle: { bpm: 150, root: 52, wave: 'square', drone: 40, seed: 11, drum: true },
};
export class Audio {
  constructor() {
    this.on = true;
    const wake = () => { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = 0.18; this.master.connect(this.ctx.destination); if (this.want) this.music(this.want, true); } catch (e) { this.on = false; } } };
    addEventListener('keydown', wake, { once: false }); addEventListener('pointerdown', wake);
  }
  tone(f, d, type = 'square', v = 0.3, slide = 0, when = 0) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.02);
  }
  noise(d, v = 0.3, hp = 800) {
    const c = this.ctx; if (!c || !this.on) return;
    const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = v; s.buffer = b; s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
  sfx(k) {
    switch (k) {
      case 'move': this.tone(880, 0.04, 'square', 0.08); break;
      case 'ok': this.tone(660, 0.06, 'square', 0.12); this.tone(990, 0.08, 'square', 0.1, 0, 0.05); break;
      case 'cancel': this.tone(440, 0.08, 'square', 0.1, -120); break;
      case 'hit': this.noise(0.12, 0.35, 600); this.tone(150, 0.1, 'square', 0.15, -60); break;
      case 'clash': this.tone(1400, 0.12, 'square', 0.12, -600); this.noise(0.08, 0.25, 2000); break;
      case 'fire': this.noise(0.45, 0.3, 300); this.tone(220, 0.4, 'sawtooth', 0.08, 300); break;
      case 'miss': this.tone(500, 0.1, 'sine', 0.1, 300); break;
      case 'level': [0, 4, 7, 12].forEach((s, i) => this.tone(523 * 2 ** (s / 12), 0.18, 'square', 0.12, 0, i * 0.09)); break;
      case 'coin': this.tone(988, 0.06, 'square', 0.1); this.tone(1319, 0.12, 'square', 0.1, 0, 0.06); break;
      case 'encounter': [0, 3, 6, 9].forEach((s, i) => this.tone(330 * 2 ** (s / 12), 0.08, 'square', 0.14, 0, i * 0.05)); break;
    }
  }
  // a generated tune: each mode has its own scale, tempo and seed; it loops every 8 bars
  music(k, force) {
    this.want = k; if (!this.ctx || (!force && this.cur === k)) return; this.cur = k;
    clearInterval(this.timer); const T = TUNES[k]; if (!T) return;
    let s = T.seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const bar = Array.from({ length: 64 }, (_, i) => (r() < (i % 4 === 0 ? 0.9 : 0.45) ? PENT[Math.floor(r() * 5)] + 12 * Math.floor(r() * 2) : null));
    const beat = 60 / T.bpm / 2; let i = 0;
    const midi = (m) => 440 * 2 ** ((m - 69) / 12);
    this.timer = setInterval(() => {
      if (!this.on) return; const n = bar[i % 64];
      if (n != null) this.tone(midi(T.root + n), beat * 1.8, T.wave, 0.09);
      if (i % 8 === 0) this.tone(midi(T.drone), beat * 7.5, 'sine', 0.06);
      if (T.drum && i % 2 === 0) this.noise(0.05, i % 8 === 0 ? 0.22 : 0.08, i % 8 === 0 ? 120 : 3000);
      i++;
    }, beat * 1000);
  }
}
