// Battle effects: little pixel-art particles drawn in code (flames, smoke and dust, sparks, a slash arc, rocks, water,
// lightning, healing motes, dizzy stars, arrows) flying about the stage with a velocity, gravity, growth and a fade.
import { THREE, canvasTex } from './render.js';

const cache = {};
function pix(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw((i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); }, x); return c; }
const disc = (P, cx, cy, r, f) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j) / r; if (d <= 1) { const c = f(d, i, j); if (c) P(cx + i, cy + j, c); } } };
const TEX = {
  flame: () => pix(12, 16, (P) => { for (let j = 0; j < 16; j++) for (let i = 0; i < 12; i++) { const w = (1 - j / 16) * 5.5 * (0.6 + Math.sin(j * 0.9) * 0.15), d = Math.abs(i - 5.5); if (d < w * (j < 4 ? j / 4 : 1)) P(i, 15 - j, d < w * 0.35 ? '#fff4a0' : d < w * 0.7 ? '#ffb030' : '#e8481a'); } }),
  smoke: () => pix(12, 12, (P) => disc(P, 6, 6, 5, (d) => (d < 0.6 ? '#d8d0c0' : '#a8a090'))),
  dust: () => pix(10, 10, (P) => disc(P, 5, 5, 4, (d, i, j) => ((i + j) % 3 ? '#c8b08a' : '#a89070'))),
  spark: () => pix(7, 7, (P) => { for (let k = -3; k <= 3; k++) { P(3 + k, 3, Math.abs(k) < 2 ? '#ffffff' : '#ffe060'); P(3, 3 + k, Math.abs(k) < 2 ? '#ffffff' : '#ffe060'); } }),
  slash: () => pix(32, 32, (P) => { for (let a = 0; a < 70; a++) { const t = a / 70, ang = -0.6 + t * 2.6, r = 13 - Math.abs(t - 0.5) * 6; for (let w = 0; w < 3 - Math.abs(t - 0.5) * 3; w++) P(Math.round(16 + Math.cos(ang) * (r - w)), Math.round(16 - Math.sin(ang) * (r - w)), w ? '#c8e8ff' : '#ffffff'); } }),
  rock: () => pix(12, 12, (P) => disc(P, 6, 6, 5, (d, i, j) => (i + j < -2 ? '#b0a898' : d > 0.8 ? '#4a463e' : '#7a7468'))),
  water: () => pix(10, 10, (P) => disc(P, 5, 5, 4, (d, i, j) => (i < 0 && j < 0 ? '#e8f8ff' : d > 0.7 ? '#2a6ab8' : '#5aa8e8'))),
  bolt: () => pix(16, 64, (P) => { let x = 8; for (let j = 0; j < 64; j++) { x += (j % 7 === 3 ? 3 : j % 7 === 6 ? -3 : 0) * (j % 14 < 7 ? 1 : -1); for (let w = -1; w <= 1; w++) P(x + w, j, w ? '#a8c8ff' : '#ffffff'); } }),
  heal: () => pix(7, 7, (P) => { for (let k = 0; k < 7; k++) { P(3, k, k === 3 ? '#ffffff' : '#8aff9a'); P(k, 3, k === 3 ? '#ffffff' : '#8aff9a'); } }),
  star: () => pix(7, 7, (P) => { P(3, 0, '#ffe060'); P(3, 6, '#ffe060'); for (let i = 0; i < 7; i++) P(i, 3, '#ffe060'); P(2, 2, '#fff8c0'); P(4, 4, '#fff8c0'); P(2, 4, '#fff8c0'); P(4, 2, '#fff8c0'); P(3, 3, '#ffffff'); }),
  arrow: () => pix(16, 4, (P) => { for (let i = 0; i < 13; i++) P(i, 2, '#8a5a2a'); P(13, 1, '#d8dce8'); P(13, 2, '#d8dce8'); P(13, 3, '#d8dce8'); P(14, 2, '#ffffff'); P(0, 1, '#e8e8e8'); P(0, 3, '#e8e8e8'); P(1, 1, '#e8e8e8'); P(1, 3, '#e8e8e8'); }),
  ring: () => pix(32, 32, (P) => { for (let a = 0; a < 120; a++) { const ang = a / 120 * Math.PI * 2; for (const r of [14, 13]) P(Math.round(16 + Math.cos(ang) * r), Math.round(16 + Math.sin(ang) * r), r === 14 ? '#ffffff' : '#ffe8a0'); } }),
  wave: () => pix(24, 16, (P) => { for (let i = 0; i < 24; i++) { const h = 6 + Math.round(Math.sin(i / 3.8) * 4 + 4); for (let j = 16 - h; j < 16; j++) P(i, j, j === 16 - h ? '#ffffff' : j < 16 - h + 3 ? '#8ad0ff' : '#3a7ac8'); } }),
};
const mat = (k) => cache[k] ||= new THREE.SpriteMaterial({ map: canvasTex(TEX[k]()), transparent: true, depthWrite: false, fog: false });

export class FX {
  constructor(scene) { this.scene = scene; this.ps = []; }
  // one particle: p = { k, x, y, z, vx, vy, vz, g, life, s0, s1, rot, spin, alpha }
  add(k, o) {
    const s = new THREE.Sprite(mat(k).clone()); s.center.set(0.5, o.anchor ?? 0.5);
    const p = { s, t: 0, life: 0.6, s0: 0.5, s1: 0.5, g: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, alpha: 1, aspect: 1, ...o };
    s.material.rotation = p.rot; s.position.set(p.x, p.y, p.z); this.scene.add(s); this.ps.push(p); return p;
  }
  update(dt) {
    for (const p of [...this.ps]) {
      p.t += dt; const q = Math.min(1, p.t / p.life);
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor != null && p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.s.position.set(p.x, p.y, p.z); p.s.material.rotation += p.spin * dt;
      const sc = p.s0 + (p.s1 - p.s0) * q; p.s.scale.set(sc * p.aspect, sc, 1);
      p.s.material.opacity = p.alpha * (q > 0.6 ? 1 - (q - 0.6) / 0.4 : 1);
      if (q >= 1) { this.scene.remove(p.s); p.s.material.dispose(); this.ps = this.ps.filter((x) => x !== p); }
    }
  }
  clear() { for (const p of this.ps) { this.scene.remove(p.s); p.s.material.dispose(); } this.ps = []; }
  // ---------------------------------------------------------------- recipes; (x, z) is a unit's foot, y its height
  sparks(x, y, z, n = 8) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 3; this.add('spark', { x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1.5, vz: (Math.random() - 0.5) * 2, g: 9, life: 0.4 + Math.random() * 0.2, s0: 0.6, s1: 0.15 }); } }
  dust(x, z, n = 4, dir = 0) { for (let i = 0; i < n; i++) this.add('dust', { x: x + (Math.random() - 0.5) * 0.6, y: 0.1, z: z + (Math.random() - 0.5) * 0.5, vx: -dir * (0.6 + Math.random()) + (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.4, life: 0.6 + Math.random() * 0.3, s0: 0.25, s1: 0.65, alpha: 0.85 }); }
  slash(x, y, z, flip) { this.add('slash', { x, y, z: z + 0.2, life: 0.26, s0: 1.8, s1: 2.5, rot: flip ? Math.PI : 0, spin: flip ? 6 : -6 }); }
  flames(x, z, n = 14) {
    for (let i = 0; i < n; i++) this.add('flame', { x: x + (Math.random() - 0.5) * 1.6, y: 0, z: z + (Math.random() - 0.5) * 1.1, anchor: 0, vy: 0.5 + Math.random(), life: 0.6 + Math.random() * 0.5, s0: 0.6 + Math.random() * 0.5, s1: 1.6 + Math.random() * 0.7, aspect: 0.75 });
    for (let i = 0; i < 6; i++) this.add('smoke', { x: x + (Math.random() - 0.5), y: 1, z, vy: 1 + Math.random(), vx: (Math.random() - 0.5) * 0.5, life: 1 + Math.random() * 0.4, s0: 0.4, s1: 1.2, alpha: 0.55 });
  }
  rocks(x, z, n = 6) { for (let i = 0; i < n; i++) this.add('rock', { x: x + (Math.random() - 0.5) * 1.4, y: 6 + i * 0.8, z: z + (Math.random() - 0.5) * 0.8, vy: -6, g: 18, floor: 0.2, spin: (Math.random() - 0.5) * 8, life: 1.1, s0: 0.45 + Math.random() * 0.3, s1: 0.45 }); }
  water(x, z, n = 18) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.5; this.add('water', { x: x + (Math.random() - 0.5), y: 0.2, z, vx: Math.cos(a) * v * 0.6, vy: 3 + Math.random() * 3, vz: Math.sin(a) * v * 0.3, g: 10, life: 0.8, s0: 0.3, s1: 0.2 }); } }
  wave(x0, x1, z) { this.add('wave', { x: x0, y: 0, z, anchor: 0, vx: (x1 - x0) / 0.9, life: 0.9, s0: 1.6, s1: 2.2, aspect: 1.5 }); }
  bolt(x, z) { this.add('bolt', { x, y: 0, z, anchor: 0, life: 0.3, s0: 6, s1: 6, aspect: 0.25 }); this.sparks(x, 0.3, z, 12); this.add('ring', { x, y: 0.1, z, life: 0.4, s0: 0.5, s1: 2.2 }); }
  heal(x, z, n = 10) { for (let i = 0; i < n; i++) this.add('heal', { x: x + (Math.random() - 0.5) * 1.2, y: Math.random() * 0.6, z: z + (Math.random() - 0.5) * 0.6, vy: 1.2 + Math.random() * 0.8, life: 0.9 + Math.random() * 0.4, s0: 0.3, s1: 0.15 }); }
  stars(x, y, z) { for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; this.add('star', { x: x + Math.cos(a) * 0.4, y: y + 0.1, z: z + Math.sin(a) * 0.2, vx: -Math.sin(a) * 1.2, vz: Math.cos(a) * 0.6, life: 0.9, s0: 0.3, s1: 0.3, spin: 4 }); } }
  aura(x, z, color) { const p = this.add('ring', { x, y: 0.05, z, life: 0.7, s0: 0.6, s1: 1.8 }); p.s.material.color.set(color || '#ffffff'); for (let i = 0; i < 6; i++) { const q = this.add('spark', { x: x + (Math.random() - 0.5) * 0.9, y: 0.1, z, vy: 2 + Math.random(), life: 0.7, s0: 0.25, s1: 0.1 }); q.s.material.color.set(color || '#ffffff'); } }
  arrow(x0, y, z0, x1, z1) { const d = Math.hypot(x1 - x0, z1 - z0), t = Math.max(0.25, d / 14); const p = this.add('arrow', { x: x0, y, z: z0, vx: (x1 - x0) / t, vz: (z1 - z0) / t, vy: 2.4, g: 4.8 / t, life: t, s0: 0.55, s1: 0.55, aspect: 2.5, rot: x1 < x0 ? Math.PI : 0 }); return t; }
}
