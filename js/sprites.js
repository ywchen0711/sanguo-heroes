// Pixel art, drawn in code: chibi generals in the style of the old Famicom Three Kingdoms RPGs (big head, small body),
// four directions and three walking frames each, the faces of the famous ones, soldiers, bandits and beasts, trees,
// rocks and the 16x16 tiles of the land. Everything is drawn once into canvases and reused as textures.

// ---------------------------------------------------------------- colours
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const shade = (c, f) => { const [r, g, b] = hex(c); return f >= 1 ? toHex(r + (255 - r) * (f - 1), g + (255 - g) * (f - 1), b + (255 - b) * (f - 1)) : toHex(r * f, g * f, b * f); };
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed) => { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; };

// a colour as [r, g, b, a], read once
const RGBA = new Map();
let probe = null;
const rgba = (col) => {
  let v = RGBA.get(col); if (v) return v;
  if (/^#[0-9a-f]{6}$/i.test(col)) { const n = parseInt(col.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255, 255]; }
  else { probe ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true }); probe.clearRect(0, 0, 1, 1); probe.fillStyle = col; probe.fillRect(0, 0, 1, 1); v = [...probe.getImageData(0, 0, 1, 1).data]; }
  RGBA.set(col, v); return v;
};
// a tiny pixel canvas: set pixels, then outline and read out. The pixels are written straight into a buffer (a
// fillRect for each pixel was most of the cost of drawing a figure) and put on the canvas when it is read: c and x
// are the canvas and its context, as before
function px(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  let img = null, dirty = false, fresh = true;
  const data = () => { if (!img) img = fresh ? new ImageData(w, h) : ctx.getImageData(0, 0, w, h); return img.data; };
  const flush = () => { if (dirty) { ctx.putImageData(img, 0, 0); dirty = false; } };
  // one pixel, covered by k (a rect's edge may cover part of it, as a canvas would draw it)
  const dot = (d, i, j, c, k) => {
    const o = (j * w + i) * 4, sa = (c[3] / 255) * k; if (sa <= 0) return;
    if (sa >= 1) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; return; }
    const da = d[o + 3] / 255, oa = sa + da * (1 - sa);
    for (let n = 0; n < 3; n++) d[o + n] = (c[n] * sa + d[o + n] * da * (1 - sa)) / oa;
    d[o + 3] = oa * 255;
  };
  const P = (i, j, col) => { if (!col || i < 0 || j < 0 || i >= w || j >= h) return; dot(data(), i | 0, j | 0, rgba(col), 1); dirty = true; };
  const R = (i, j, a, b, col) => {
    if (!col) return; let x0 = i | 0, y0 = j | 0, x1 = x0 + a, y1 = y0 + b; if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
    const c = rgba(col), d = data();
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, Math.ceil(y1)); y++) { const ky = Math.min(y + 1, y1) - Math.max(y, y0);
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, Math.ceil(x1)); x++) dot(d, x, y, c, ky * (Math.min(x + 1, x1) - Math.max(x, x0))); }
    dirty = true;
  };
  return {
    P, R, w, h,
    get c() { flush(); return cv; },
    // the context, to draw on the canvas itself: what is drawn there is read back before the next pixel is set
    get x() { flush(); fresh = false; img = null; return ctx; },
    clear() { img = null; dirty = false; fresh = true; ctx.clearRect(0, 0, w, h); },
  };
}
// a dark outline around everything drawn (the crisp HD-2D sprite look)
// a sheet drawn one frame at a time: each frame on a canvas of its own (so a foot or a spear that reaches past the frame is
// cut off rather than drawn into the next one, and the outline stays inside it too), outlined, then put in its place
function sheetOf(cols, rows, fw, fh, draw, col) {
  const cv = px(fw * cols, fh * rows), one = px(fw, fh);
  for (let r = 0; r < rows; r++) for (let f = 0; f < cols; f++) { one.clear(); draw(one, f, r); cv.x.drawImage(one.c, f * fw, r * fh); }
  outline(cv, col, fw, fh);
  return cv;
}
// fw, fh: the size of one frame of a sheet (the ring never reaches across into the next frame)
function outline(cv, col = '#1a1410', fw = cv.w, fh = cv.h) {
  const { c, x, w, h } = cv, d = x.getImageData(0, 0, w, h), a = d.data, o = new Uint8ClampedArray(a);
  const [r, g, b] = hex(col);
  for (let j = 0; j < h; j++) { const fj = j % fh; for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4; if (a[k + 3]) continue; const fi = i % fw;
    if ((fi < fw - 1 && a[k + 7] > 0) || (fi > 0 && a[k - 1] > 0) || (fj < fh - 1 && a[k + w * 4 + 3] > 0) || (fj > 0 && a[k - w * 4 + 3] > 0)) { o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = 255; }
  } }
  x.putImageData(new ImageData(o, w, h), 0, 0);
  return c;
}

import { LADIES } from './data/ladies.js';
// ---------------------------------------------------------------- finer sprites: every figure is drawn at its pixel size, then
// doubled with Scale2x (which rounds the stair-steps of curves and diagonals into smooth lines) and lit at the new size
// - a soft highlight on the edges that face the light (top left) and a shade on the far ones - so it reads finer
// without losing the pixel look.
function refine(src) {
  const w = src.width, h = src.height, sx = src.getContext('2d').getImageData(0, 0, w, h), a = new Uint32Array(sx.data.buffer);
  const W2 = w * 2, H2 = h * 2, out = new ImageData(W2, H2), b = new Uint32Array(out.data.buffer);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : a[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = a[y * w + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C === A && C !== D && A !== B) e0 = A; if (A === B && A !== C && B !== D) e1 = B;
    if (D === C && D !== B && C !== A) e2 = C; if (B === D && B !== A && D !== C) e3 = D;
    const o = (y * 2) * W2 + x * 2; b[o] = e0; b[o + 1] = e1; b[o + W2] = e2; b[o + W2 + 1] = e3;
  }
  // little-endian RGBA in a Uint32 (0xAABBGGRR)
  const R_ = (c) => c & 255, G_ = (c) => (c >>> 8) & 255, B_ = (c) => (c >>> 16) & 255, A_ = (c) => c >>> 24;
  const lum = (c) => R_(c) * 0.3 + G_(c) * 0.59 + B_(c) * 0.11;
  const tint = (c, k) => ((A_(c) << 24) | (Math.min(255, B_(c) * k) << 16) | (Math.min(255, G_(c) * k) << 8) | Math.min(255, R_(c) * k)) >>> 0;
  const src2 = b.slice(), N = [-W2, 1, W2, -1];
  // the outline is the dark ring next to the transparent outside (not the eyes, brows or a dark beard inside)
  const ring = new Uint8Array(W2 * H2);
  for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x, c = src2[i]; if (A_(c) && lum(c) < 42 && (!A_(src2[i - W2]) || !A_(src2[i + 1]) || !A_(src2[i + W2]) || !A_(src2[i - 1]))) ring[i] = 1; }
  const skin = (c) => { if (!A_(c) || lum(c) < 100) return false; const r = R_(c), g = G_(c), bl = B_(c); return r - g >= 8 && r - g <= 64 && g - bl >= 12 && g - bl <= 72; };
  for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) {
    const i = y * W2 + x, c = src2[i]; if (!A_(c) || ring[i] || lum(c) < 42) continue;
    // a fine line where the face meets hair, helmet, beard or collar: the cheek and the chin stay sharp
    if (skin(c) && N.some((d) => { const o = src2[i + d]; return A_(o) && !ring[i + d] && !skin(o) && Math.abs(lum(o) - lum(c)) > 22; })) { b[i] = tint(c, 0.7); continue; }
    // a soft rim of light only along the silhouette, on the side that faces the light
    if (ring[i - W2] || ring[i - 1]) b[i] = tint(c, 1.12);
  }
  const cv = document.createElement('canvas'); cv.width = W2; cv.height = H2; cv.getContext('2d').putImageData(out, 0, 0); return cv;
}
const fine = (out) => { out.canvas = refine(out.canvas); out.fw *= 2; out.fh *= 2; return out; };
// ---------------------------------------------------------------- how a general looks
// the famous ones by name; everyone else from their stats and a hash of their name
const FAMOUS = {
  關羽: { skin: '#c8503a', beard: 'long', beardC: '#141010', hat: 'hood', hatC: '#2a7a3a', body: '#2a8a4a', trim: '#e8c860', cape: '#1a5a2a', wpn: 'glaive' },
  張飛: { skin: '#9a6a48', beard: 'spiky', beardC: '#141010', hat: 'band', hatC: '#2a2a3a', body: '#3a3a4a', trim: '#c8a060', cape: '#5a2a2a', wpn: 'spear' },
  劉備: { skin: '#f0c8a0', beard: 'short', beardC: '#2a1a10', hat: 'crown', hatC: '#e8c860', body: '#3aa85a', trim: '#f0e0a0', cape: '#e8e0c8', wpn: 'twin' },
  曹操: { skin: '#f0c8a0', beard: 'goatee', beardC: '#1a1410', hat: 'crown', hatC: '#e8c860', body: '#2a4ab8', trim: '#e8c860', cape: '#1a1a3a', wpn: 'sword' },
  呂布: { skin: '#f0c8a0', beard: null, hat: 'pheasant', hatC: '#e8c860', body: '#b83a2a', trim: '#e8c860', cape: '#8a1a1a', wpn: 'halberd' },
  諸葛亮: { skin: '#f4d0a8', beard: 'thin', beardC: '#2a2a2a', hat: 'scholar', hatC: '#2a2a3a', body: '#f0f0e8', trim: '#4a6ab8', cape: '#d8d8e8', wpn: 'fan', robe: true },
  孫權: { skin: '#f0c8a0', beard: 'short', beardC: '#7a3a8a', hat: 'crown', hatC: '#e8c860', body: '#c83a2a', trim: '#e8c860', cape: '#5a1a1a', wpn: 'sword' },
  孫策: { skin: '#f0c8a0', beard: null, hat: 'helmet', hatC: '#d84a3a', body: '#d84a3a', trim: '#e8c860', cape: '#8a2a1a', wpn: 'spear' },
  孫堅: { skin: '#e8b890', beard: 'short', beardC: '#2a1a10', hat: 'helmet', hatC: '#c83a2a', body: '#c83a2a', trim: '#e8c860', cape: '#6a1a1a', wpn: 'glaive' },
  趙雲: { skin: '#f4d0a8', beard: null, hat: 'helmet', hatC: '#e8e8f0', body: '#e8e8f0', trim: '#4a8ad8', cape: '#3a6ab8', wpn: 'spear' },
  馬超: { skin: '#f4d0a8', beard: null, hat: 'lion', hatC: '#e8e8f0', body: '#d8d8e0', trim: '#7a5ad8', cape: '#e8e8f0', wpn: 'spear' },
  黃忠: { skin: '#e8b890', beard: 'long', beardC: '#e8e8e8', hat: 'helmet', hatC: '#c8a040', body: '#c8a040', trim: '#8a5a2a', cape: '#6a4a2a', wpn: 'bow' },
  董卓: { skin: '#d8a078', beard: 'spiky', beardC: '#1a1410', hat: 'crown', hatC: '#8a6a2a', body: '#6a1a1a', trim: '#e8c860', cape: '#2a0a0a', wpn: 'sword', fat: true },
  袁紹: { skin: '#f0c8a0', beard: 'short', beardC: '#2a1a10', hat: 'crown', hatC: '#e8c860', body: '#d8b02a', trim: '#8a5a2a', cape: '#6a4a1a', wpn: 'sword' },
  司馬懿: { skin: '#e8c8a0', beard: 'goatee', beardC: '#1a1410', hat: 'scholar', hatC: '#1a1a2a', body: '#3a3a6a', trim: '#8a8ac8', cape: '#1a1a3a', wpn: 'fan', robe: true },
  周瑜: { skin: '#f4d0a8', beard: null, hat: 'crown', hatC: '#e8c860', body: '#e84a3a', trim: '#f0e0a0', cape: '#f0f0f0', wpn: 'sword' },
  典韋: { skin: '#9a6a48', beard: 'spiky', beardC: '#141010', hat: 'band', hatC: '#4a3a2a', body: '#6a4a3a', trim: '#2a2a2a', cape: null, wpn: 'twinaxe', fat: true },
  許褚: { skin: '#c89a70', beard: 'spiky', beardC: '#2a1a10', hat: null, hatC: null, body: '#4a5a8a', trim: '#2a2a2a', cape: null, wpn: 'hammer', fat: true },
  夏侯惇: { skin: '#f0c8a0', beard: 'short', beardC: '#1a1410', hat: 'helmet', hatC: '#2a3a8a', body: '#2a3a8a', trim: '#c8c8d8', cape: '#1a1a4a', wpn: 'glaive', patch: true },
  貂蟬: { skin: '#f8dcc0', beard: null, hat: 'lady', hatC: '#1a1010', body: '#e85a8a', trim: '#f8e0f0', cape: '#f8c8d8', wpn: null, robe: true, lady: true },
  孟獲: { skin: '#8a5a38', beard: 'spiky', beardC: '#1a1410', hat: 'feather', hatC: '#c8a040', body: '#8a6a2a', trim: '#e8c860', cape: '#5a3a1a', wpn: 'hammer' },
  華佗: { skin: '#f0c8a0', beard: 'long', beardC: '#e8e8e8', hat: 'scholar', hatC: '#4a4a3a', body: '#8a9a7a', trim: '#e8e8d8', cape: null, wpn: null, robe: true },
  Jeff: { skin: '#f0c8a0', beard: 'short', beardC: '#3a2a1a', hat: 'crown', hatC: '#ffd86a', body: '#2a6ad8', trim: '#ffd86a', cape: '#e8e8f0', wpn: 'sword', brow: 'thick', eyes: 'big', armor: 'scale', mark: 'earring', hair: '#3a2a1a' },
  Erin: { skin: '#f8dcc0', beard: null, hat: 'lady', hatC: '#ff8ab8', body: '#e84a8a', trim: '#ffd86a', cape: '#f8c8e8', wpn: 'fan', robe: true, lady: true, pin: '#ff8ab8', hairStyle: 'long', eyes: 'big', mark: 'blush', hair: '#6a3a1a' },
  Josh: { skin: '#f0c8a0', beard: null, hat: 'helmet', hatC: '#e83a3a', body: '#e83a3a', trim: '#ffd86a', cape: '#2a2a3a', wpn: 'halberd', brow: 'angry', eyes: 'big', armor: 'stripe', hair: '#1a1410' },
  Jasper: { skin: '#f4d0a8', beard: null, hat: 'band', hatC: '#3ad88a', body: '#2a9a5a', trim: '#e8e8f0', cape: '#1a4a3a', wpn: 'twin', brow: 'straight', eyes: 'big', armor: 'scale', hairStyle: 'tail', mark: 'scar', hair: '#2a1a10' },
  于吉: { skin: '#f0c8a0', beard: 'long', beardC: '#f0f0f0', hat: 'taoist', hatC: '#3a3a3a', body: '#e8e8e0', trim: '#5a5a5a', cape: null, wpn: 'staff', robe: true },
};
const HAIRS = ['#1a1410', '#2a1a10', '#3a2a1a', '#141018'], SKINS = ['#f0c8a0', '#e8b890', '#f4d0a8', '#d8a078', '#e8c098'];
const HAIR_ALL = ['#1a1410', '#2a1a10', '#3a2a1a', '#141018', '#4a3020', '#5a4a3a', '#8a8a8a', '#c8c8c8'];
const SKIN_ALL = ['#f0c8a0', '#e8b890', '#f4d0a8', '#d8a078', '#e8c098', '#c89068', '#f8dcc0', '#b88058'];
const TRIMS = ['#e8c860', '#d8d8e0', '#c8a060', '#3a3a3a', '#a83a2a', '#3a6ab8', '#5a8a4a', '#8a5ab8'];
const SCHOLAR_BODY = ['#e8e8e0', '#8a9ab8', '#5a6a8a', '#c8b898', '#7a8a6a', '#9a7a5a', '#4a5a5a', '#b8a8c8'];
const LADY_BODY = ['#e85a8a', '#f0a0c0', '#c86ab8', '#8ac8e8', '#e8d8a0', '#a8e0c0', '#f8c8a0', '#c8a8e8', '#e8e8f0', '#d84a5a'];
// the parts of a face and figure that tell one general from another (colours of the warlord come on top)
function traitsFor(g, salt) {
  const r = rnd(hash(g.name + '#' + salt)), pick = (a) => a[Math.floor(r() * a.length)], lady = LADIES.has(g.name);
  const scholar = !lady && g.int > g.war + 15 && g.war < 65, brute = !lady && g.war >= 85 && g.int < 50, old = (g.born || 170) < 160;
  const T = { lady, scholar, brute };
  T.skin = pick(SKIN_ALL); T.hair = old && r() < 0.5 ? pick(['#8a8a8a', '#c8c8c8']) : pick(HAIR_ALL.slice(0, 6));
  T.hairStyle = lady ? pick(['bun', 'long', 'long', 'bun', 'tail']) : pick(['short', 'short', 'long', 'bun', 'tail', 'bald']);
  T.brow = lady ? pick(['none', 'thin', 'sad']) : pick(['straight', 'angry', 'sad', 'thick', 'none']);
  T.eyes = pick(['dot', 'big', 'narrow', 'dot']);
  T.beard = lady ? null : r() < (old ? 0.85 : 0.5) ? pick(['short', 'goatee', 'long', 'spiky', 'thin', 'mustache', 'sideburns', 'full']) : null;
  T.beardC = old && r() < 0.6 ? '#c8c8c8' : pick(HAIR_ALL.slice(0, 6));
  T.hat = lady ? pick(['lady', 'lady', null, 'band']) : scholar ? pick(['scholar', 'scholar', 'band', 'taoist', null, 'hood']) : brute ? pick(['band', null, 'helmet', 'fur']) : pick(['helmet', 'helmet', 'band', 'hood', 'topknot', 'crown2', 'fur', null]);
  T.hatTone = pick([0.55, 0.7, 0.85, 1.05]);
  T.wpn = lady ? pick([null, 'fan', 'sword', 'twin', 'bow']) : scholar ? pick(['fan', 'sword', null, 'staff', 'fan']) : pick(['spear', 'glaive', 'sword', 'halberd', 'bow', 'hammer', 'twin', 'twinaxe', 'staff']);
  T.trim = pick(TRIMS); T.cape = !lady && r() < 0.65; T.capeTone = pick([0.5, 0.62, 0.75]);
  T.armor = scholar || lady ? 'robe' : pick(['plain', 'scale', 'stripe', 'plain']);
  T.build = brute && r() < 0.5 ? 'fat' : r() < 0.18 ? 'thin' : 'normal';
  T.mark = pick([null, null, null, 'scar', 'mole', 'earring', lady ? 'blush' : 'tattoo']);
  T.robe = pick(lady ? LADY_BODY : SCHOLAR_BODY); T.pin = pick(['#e8c860', '#e85a8a', '#8ae0ff', '#ffffff']);
  return T;
}
// only what can be seen: a robe's colour only on a robe, a beard's colour only with a beard, a helmet's tone only on a helmet
const sigOf = (T) => [T.skin, T.hair, T.hat && T.hairStyle === 'bald' ? 'short' : T.hairStyle, T.brow, T.eyes, T.beard, T.beard ? T.beardC : '', T.hat, T.hat && !T.lady && !T.scholar ? T.hatTone : '', T.wpn, T.trim, T.cape, T.armor, T.armor === 'robe' ? T.robe : '', T.build, T.mark, T.lady ? T.pin : ''].join('|');
// every general gets traits no one else has: rolled again until they differ (in the order of the roster, so it is
// the same in every game)
const TRAITS = new Map();
export function assignLooks(gens) {
  if (TRAITS.size) return; const taken = new Set();
  for (const g of gens) { if (FAMOUS[g.name]) continue; let k = 0, T = traitsFor(g, 0); while (taken.has(sigOf(T)) && k < 50) T = traitsFor(g, ++k); taken.add(sigOf(T)); TRAITS.set(g.name, T); }
}
export const lookSig = (name) => (TRAITS.has(name) ? sigOf(TRAITS.get(name)) : null);
// a look for any general: g = { name, war, int, lead, cha }, color = their warlord's colour
export function lookFor(g, color = '#7a7a8a') {
  const F = FAMOUS[g.name]; if (F) return { ...F, hair: F.hair || F.beardC || '#1a1410', key: g.name };
  const T = TRAITS.get(g.name) || traitsFor(g, 0), robeLike = T.armor === 'robe';
  return { skin: T.skin, hair: T.hair, hairStyle: T.hairStyle, brow: T.brow, eyes: T.eyes, beard: T.beard, beardC: T.beardC, hat: T.hat,
    hatC: T.lady ? T.pin : T.scholar ? shade(T.robe, 0.45) : shade(color, T.hatTone), body: robeLike ? T.robe : color, trim: T.trim,
    cape: T.cape ? shade(color, T.capeTone) : null, wpn: T.wpn, robe: robeLike, armor: T.armor, fat: T.build === 'fat', thin: T.build === 'thin', mark: T.mark, lady: T.lady, pin: T.pin, key: g.name + color };
}
// soldiers, bandits and the like
export const LOOKS = {
  soldier: (color) => ({ skin: '#e8b890', hair: '#1a1410', hat: 'helmet', hatC: shade(color, 0.8), body: color, trim: '#d8d8d8', cape: null, wpn: 'spear', small: true, key: 'sol' + color }),
  bandit: () => ({ skin: '#d8a078', hair: '#2a1a10', beard: 'spiky', beardC: '#1a1410', hat: 'band', hatC: '#8a2a2a', body: '#7a5a3a', trim: '#4a3a2a', cape: null, wpn: 'sword', key: 'bandit' }),
  turban: () => ({ skin: '#e8b890', hair: '#1a1410', beard: null, hat: 'turban', hatC: '#e8c830', body: '#a89a5a', trim: '#e8c830', cape: null, wpn: 'spear', key: 'turban' }),
  turbanBoss: () => ({ skin: '#e8b890', hair: '#1a1410', beard: 'long', beardC: '#1a1410', hat: 'turban', hatC: '#f0d830', body: '#e8c830', trim: '#8a2a2a', cape: '#c8a020', wpn: 'staff', robe: true, key: 'turbanBoss' }),
  barbarian: () => ({ skin: '#8a5a38', hair: '#1a1410', beard: null, hat: 'feather', hatC: '#c84a2a', body: '#8a6a2a', trim: '#e8c860', cape: null, wpn: 'spear', key: 'barb' }),
  nomad: () => ({ skin: '#d8a078', hair: '#1a1410', beard: 'short', beardC: '#1a1410', hat: 'fur', hatC: '#8a6a4a', body: '#6a5a4a', trim: '#c8a060', cape: '#4a3a2a', wpn: 'bow', key: 'nomad' }),
  pirate: () => ({ skin: '#c89a70', hair: '#1a1410', beard: 'spiky', beardC: '#1a1410', hat: 'band', hatC: '#2a4a8a', body: '#3a5a7a', trim: '#c8c8c8', cape: null, wpn: 'sword', key: 'pirate' }),
  villager: (seed) => { const r = rnd(hash('v' + seed)), p = (a) => a[Math.floor(r() * a.length)]; const lady = r() < 0.45;
    return { skin: p(SKINS), hair: p(HAIRS), beard: !lady && r() < 0.3 ? 'short' : null, beardC: '#3a3a3a', hat: lady ? 'lady' : p([null, 'topknot', 'straw', 'band']), hatC: p(['#c8a860', '#3a3a3a', '#8a5a3a']), body: p(['#8a7a5a', '#5a7a9a', '#9a5a5a', '#7a8a5a', '#c8b898']), trim: p(['#d8c8a8', '#4a3a2a']), cape: null, wpn: null, robe: true, lady, key: 'v' + seed }; },
};

// ---------------------------------------------------------------- the person sheet: 4 directions (down, left, right, up) x 3 frames, 24x32 each
const FW = 24, FH = 32;
const cache = new Map();
export const hasSheet = (L) => cache.has(L.key);
export function personSheet(L) {
  if (cache.has(L.key)) return cache.get(L.key);
  const cv = sheetOf(3, 4, FW, FH, (one, f, d) => drawPerson(one, 0, 0, d, f, L));
  const out = fine({ canvas: cv.c, fw: FW, fh: FH });
  cache.set(L.key, out);
  return out;
}
function drawPerson(cv, ox, oy, dir, frame, L) {
  const { P, R } = cv, p = (i, j, c) => P(ox + i, oy + j, c), r = (i, j, a, b, c) => R(ox + i, oy + j, a, b, c);
  const skin = L.skin, skinD = shade(skin, 0.82), body = L.body, bodyD = shade(body, 0.72), bodyL = shade(body, 1.18), trim = L.trim, hair = L.hair || '#1a1410';
  const step = frame === 1 ? 0 : frame === 0 ? -1 : 1, bob = frame === 1 ? 0 : 1, fat = L.fat ? 1 : L.thin ? -1 : 0;
  const side = dir === 1 || dir === 2, flip = dir === 2, back = dir === 3;
  const X = (i) => flip ? FW - 1 - i : i; // mirror for facing right
  const q = (i, j, c) => p(X(i), j, c), qr = (i, j, a, b, c) => { for (let u = 0; u < a; u++) for (let v = 0; v < b; v++) q(i + u, j + v, c); };
  const y0 = 1 + bob;
  // the cape, behind everything
  if (L.cape && !L.small) { if (back) qr(5, y0 + 15, 14, 12, L.cape); else if (side) qr(13, y0 + 16, 4, 10, shade(L.cape, 0.85)); }
  // legs and boots
  const legY = y0 + 25;
  if (side) { qr(9 + step, legY, 3, 5, bodyD); qr(12 - step, legY, 3, 5, shade(bodyD, 0.85)); qr(9 + step, legY + 4, 3, 2, '#2a2018'); qr(12 - step, legY + 4, 3, 2, '#2a2018'); q(9 + step, legY + 4, '#5a4a38'); }
  else { qr(8, legY + (step < 0 ? -1 : 0), 3, 5, bodyD); qr(13, legY + (step > 0 ? -1 : 0), 3, 5, bodyD); qr(8, legY + 4 + (step < 0 ? -1 : 0), 3, 2, '#2a2018'); qr(13, legY + 4 + (step > 0 ? -1 : 0), 3, 2, '#2a2018'); }
  // the body: armour or a robe
  const bw = 12 + fat * 2, bx = 6 - fat;
  if (L.robe) { qr(bx, y0 + 15, bw, 12, body); qr(bx, y0 + 15, 2, 12, bodyD); qr(bx + bw - 2, y0 + 15, 2, 12, bodyD); if (!back) { qr(11, y0 + 15, 2, 12, trim); if (L.lady) { qr(bx + 2, y0 + 20, bw - 4, 2, L.pin || trim); qr(bx + 1, y0 + 26, bw - 2, 1, shade(body, 1.2)); } } qr(bx, y0 + 21, bw, 1, trim); }
  else {
    qr(bx, y0 + 15, bw, 10, body); qr(bx, y0 + 15, bw, 1, bodyL); qr(bx, y0 + 24, bw, 1, bodyD);
    if (L.armor === 'scale') for (let j = 0; j < 6; j++) for (let i = 0; i < bw; i += 2) q(bx + i + (j % 2), y0 + 16 + j, shade(body, 0.8));
    if (L.armor === 'stripe' && !back) for (let i = 1; i < bw; i += 3) qr(bx + i, y0 + 16, 1, 6, shade(body, 0.78));
    if (!back) { qr(bx + 2, y0 + 17, bw - 4, 1, trim); qr(bx + 2, y0 + 19, bw - 4, 1, shade(body, 0.85)); qr(11, y0 + 16, 2, 5, shade(trim, 0.9)); }
    qr(bx, y0 + 22, bw, 2, trim); if (!back) { qr(11, y0 + 22, 2, 2, shade(trim, 1.35)); p(11, y0 + 22, '#ffffff'); } // the belt and its buckle
    if (!back) { for (let i = bx + 1; i < bx + bw - 1; i += 2) p(i, y0 + 21, shade(body, 0.7)); qr(bx + 1, y0 + 16, 1, 5, shade(body, 1.12)); }
    qr(bx - 1, y0 + 15, 3, 3, shade(body, 1.1)); qr(bx + bw - 2, y0 + 15, 3, 3, shade(body, 1.1)); // shoulder plates
  }
  // arms
  const armSwing = side ? step : 0;
  if (side) { qr(10 + armSwing, y0 + 16, 3, 7, bodyD); q(11 + armSwing, y0 + 23, skin); }
  else { qr(bx - 2, y0 + 16, 2, 7, bodyD); qr(bx + bw, y0 + 16, 2, 7, bodyD); p(bx - 2, y0 + 23, skin); p(bx + bw + 1, y0 + 23, skin); }
  // the head: big and round
  const hy = y0 + 3;
  qr(6, hy + 1, 12, 11, skin); qr(7, hy, 10, 1, skin); qr(7, hy + 12, 10, 1, skinD);
  qr(6, hy + 9, 12, 3, skinD); qr(7, hy + 9, 10, 2, skin);
  // hair behind and on top
  const hs = L.hairStyle;
  if (back) { qr(6, hy, 12, 12, hair); qr(9, hy - 2, 6, 3, hair); if (hs === 'long') qr(6, hy + 12, 12, 5, hair); if (hs === 'tail') qr(11, hy + 10, 2, 7, hair); }
  else {
    qr(6, hy, 12, 4, hair); qr(6, hy, 2, 8, hair); qr(16, hy, 2, 8, hair); qr(8, hy, 4, 1, shade(hair, 1.45)); p(13, hy + 1, shade(hair, 1.3));
    if (side) { qr(13, hy, 5, 9, hair); if (hs === 'long') qr(14, hy + 8, 4, 7, hair); if (hs === 'tail') { qr(17, hy + 3, 2, 9, hair); } }
    else if (hs === 'long') { qr(5, hy + 3, 2, 10, hair); qr(17, hy + 3, 2, 10, hair); }
    if (hs === 'bald' && !L.hat) { qr(7, hy, 10, 3, skin); qr(7, hy, 10, 1, shade(skin, 1.12)); }
    // the face
    const ey = hy + 6;
    const E = L.eyes || 'dot', dk = '#1a1410', bc0 = L.beardC && L.hair === '#c8c8c8' ? '#c8c8c8' : hair;
    if (side) { if (E === 'narrow') { q(8, ey + 1, dk); q(9, ey + 1, dk); } else { q(8, ey, dk); q(8, ey + 1, dk); if (E === 'big') { q(9, ey, dk); q(9, ey + 1, dk); q(9, ey, '#fff'); } } q(7, ey + 4, shade(skin, 0.7)); }
    else {
      if (E === 'narrow') { p(7, ey + 1, dk); p(8, ey + 1, dk); p(15, ey + 1, dk); p(16, ey + 1, dk); }
      else if (E === 'big') { for (const x of [7, 15]) { p(x, ey, dk); p(x + 1, ey, dk); p(x, ey + 1, dk); p(x + 1, ey + 1, dk); p(x, ey, '#fff'); } }
      else { p(8, ey, dk); p(8, ey + 1, dk); p(15, ey, dk); p(15, ey + 1, dk); p(9, ey, '#fff'); p(14, ey, '#fff'); }
      p(11, ey + 4, shade(skin, 0.7)); p(12, ey + 4, shade(skin, 0.7)); p(7, ey + 2, shade(skin, 0.92)); p(16, ey + 2, shade(skin, 0.92));
      // a nose, a mouth, a lid over each eye, shade under the cheekbones, the ears
      p(11, ey + 2, shade(skin, 0.86)); if (!L.beard || L.beard === 'goatee' || L.beard === 'sideburns') { p(10, ey + 5, shade(skin, 0.62)); p(11, ey + 5, shade(skin, 0.55)); p(12, ey + 5, shade(skin, 0.55)); p(13, ey + 5, shade(skin, 0.62)); }
      if (E !== 'narrow') { p(8, ey - 1, shade(skin, 0.78)); p(15, ey - 1, shade(skin, 0.78)); }
      p(6, ey + 4, shade(skin, 0.85)); p(17, ey + 4, shade(skin, 0.85)); p(6, ey + 1, shade(skin, 0.75)); p(17, ey + 1, shade(skin, 0.75));
    }
    // brows
    const B = L.brow;
    if (B && B !== 'none') {
      if (side) { const by = ey - 2; q(7, by + (B === 'sad' ? 0 : 0), bc0); q(8, by + (B === 'angry' ? 1 : 0), bc0); q(9, by + (B === 'sad' ? 1 : 0), bc0); if (B === 'thick') { q(7, by - 1, bc0); q(8, by - 1, bc0); } }
      else { const by = ey - 2, L1 = [[7, 0], [8, 0], [9, 0]], tilt = B === 'angry' ? [0, 0, 1] : B === 'sad' ? [1, 0, 0] : [0, 0, 0];
        L1.forEach(([x], k) => { p(x, by + tilt[k], bc0); p(23 - x, by + tilt[k], bc0); }); if (B === 'thick') { p(7, by - 1, bc0); p(8, by - 1, bc0); p(15, by - 1, bc0); p(16, by - 1, bc0); } if (B === 'thin') { p(9, by, null); } }
    }
    // marks: a scar, a mole, an earring, tattoos, blushing cheeks
    if (L.mark === 'scar') { if (side) { q(9, ey + 2, shade(skin, 0.62)); q(10, ey + 3, shade(skin, 0.62)); q(11, ey + 4, shade(skin, 0.62)); } else { p(14, ey + 2, shade(skin, 0.62)); p(15, ey + 3, shade(skin, 0.62)); p(16, ey + 4, shade(skin, 0.62)); } }
    if (L.mark === 'mole') { if (side) q(9, ey + 3, '#3a2418'); else p(14, ey + 3, '#3a2418'); }
    if (L.mark === 'earring') { if (side) { q(13, ey + 3, '#e8c860'); q(13, ey + 4, '#e8c860'); } else { p(5, ey + 3, '#e8c860'); p(18, ey + 3, '#e8c860'); } }
    if (L.mark === 'tattoo') { const tc = '#3a5a8a'; if (side) { q(10, ey + 2, tc); q(11, ey + 2, tc); } else { p(7, ey + 3, tc); p(7, ey + 4, tc); p(16, ey + 3, tc); p(16, ey + 4, tc); } }
    if (L.mark === 'blush' || L.lady) { if (!side) { p(7, ey + 3, '#f0909a'); p(16, ey + 3, '#f0909a'); } else q(8, ey + 3, '#f0909a'); }
    if (L.patch) { if (side) qr(7, ey - 1, 3, 3, '#1a1a1a'); else qr(14, ey - 1, 3, 3, '#1a1a1a'); }
    // beards
    const bc = L.beardC || '#1a1410';
    if (L.beard === 'long') { if (side) qr(6, ey + 4, 5, 9, bc); else { qr(9, ey + 4, 6, 3, bc); qr(10, ey + 7, 4, 6, bc); qr(11, ey + 13, 2, 2, bc); } }
    if (L.beard === 'spiky') { if (side) qr(6, ey + 3, 6, 4, bc); else { qr(7, ey + 3, 10, 3, bc); p(6, ey + 4, bc); p(17, ey + 4, bc); qr(9, ey + 6, 6, 2, bc); } }
    if (L.beard === 'short') { if (side) qr(7, ey + 4, 4, 2, bc); else qr(9, ey + 4, 6, 2, bc); }
    if (L.beard === 'goatee') { if (side) qr(7, ey + 5, 2, 3, bc); else qr(11, ey + 5, 2, 3, bc); }
    if (L.beard === 'thin') { if (side) qr(7, ey + 5, 2, 4, bc); else { qr(11, ey + 5, 2, 5, bc); p(9, ey + 4, bc); p(14, ey + 4, bc); } }
    if (L.beard === 'mustache') { if (side) qr(6, ey + 3, 3, 1, bc); else { qr(9, ey + 3, 6, 1, bc); p(8, ey + 4, bc); p(15, ey + 4, bc); } }
    if (L.beard === 'sideburns') { if (side) qr(11, ey, 2, 5, bc); else { qr(6, ey, 1, 5, bc); qr(17, ey, 1, 5, bc); qr(7, ey + 4, 1, 2, bc); qr(16, ey + 4, 1, 2, bc); } }
    if (L.beard === 'full') { if (side) { qr(6, ey + 2, 6, 6, bc); qr(7, ey + 8, 4, 2, bc); } else { qr(6, ey + 2, 2, 4, bc); qr(16, ey + 2, 2, 4, bc); qr(7, ey + 4, 10, 4, bc); qr(9, ey + 8, 6, 2, bc); p(11, ey + 4, skin); p(12, ey + 4, skin); } }
  }
  // headgear
  const hc = L.hatC, hcD = hc && shade(hc, 0.7), hcL = hc && shade(hc, 1.25);
  switch (L.hat) {
    case 'helmet': qr(5, hy - 2, 14, 5, hc); qr(5, hy - 2, 14, 1, hcL); qr(7, hy - 1, 3, 1, shade(hc, 1.5)); qr(5, hy + 2, 14, 1, shade(hc, 0.8)); p(11, hy - 1, shade(hc, 0.75)); p(12, hy - 1, shade(hc, 0.75)); qr(5, hy + 3, 14, 1, hcD); qr(11, hy - 5, 2, 3, '#e83a2a'); qr(10, hy - 6, 4, 1, '#e83a2a'); if (!back) qr(4, hy + 3, 2, 5, hcD), qr(18, hy + 3, 2, 5, hcD); break;
    case 'crown': qr(7, hy - 2, 10, 3, hc); qr(7, hy - 2, 10, 1, hcL); p(8, hy - 3, hc); p(11, hy - 4, hc); p(12, hy - 4, hc); p(15, hy - 3, hc); qr(5, hy - 1, 14, 1, '#1a1410'); qr(4, hy - 1, 2, 1, '#e8c860'); qr(18, hy - 1, 2, 1, '#e8c860'); break;
    case 'pheasant': qr(6, hy - 2, 12, 4, hc); qr(6, hy - 2, 12, 1, hcL); p(11, hy - 1, '#e83a2a'); p(12, hy - 1, '#e83a2a');
      for (let k = 0; k < 9; k++) { p(7 - Math.floor(k / 3), hy - 3 - k, k % 2 ? '#d84a2a' : '#f0a040'); p(16 + Math.floor(k / 3), hy - 3 - k, k % 2 ? '#d84a2a' : '#f0a040'); } break;
    case 'scholar': qr(7, hy - 3, 10, 4, hc); qr(8, hy - 4, 8, 1, hc); qr(7, hy - 3, 10, 1, hcL); if (!back) qr(17, hy - 1, 2, 6, hcD); break;
    case 'hood': qr(5, hy - 2, 14, 6, hc); qr(5, hy - 2, 14, 1, hcL); if (!back) { qr(4, hy + 2, 2, 8, hcD); qr(18, hy + 2, 2, 8, hcD); } else qr(5, hy, 14, 12, hc); break;
    case 'band': qr(6, hy + 1, 12, 2, hc); if (!back && !side) { p(18, hy + 2, hc); p(19, hy + 3, hc); } if (side) { q(18, hy + 2, hc); q(19, hy + 3, hc); q(19, hy + 4, hc); } break;
    case 'turban': qr(5, hy - 2, 14, 5, hc); qr(5, hy, 14, 1, hcD); qr(8, hy - 3, 8, 1, hc); break;
    case 'topknot': qr(10, hy - 3, 4, 3, hair); qr(9, hy - 1, 6, 1, '#c8a060'); break;
    case 'lion': qr(5, hy - 2, 14, 5, hc); qr(5, hy - 2, 14, 1, hcL); qr(9, hy - 4, 6, 2, '#e8c860'); qr(10, hy - 5, 4, 1, '#e8c860'); qr(11, hy - 8, 2, 3, '#f0f0f0'); break;
    case 'taoist': qr(9, hy - 4, 6, 4, hc); qr(8, hy - 1, 8, 1, '#c8a060'); break;
    case 'feather': qr(6, hy, 12, 2, '#c8a040'); for (let k = 0; k < 5; k++) { qr(6 + k * 3, hy - 5, 2, 5, k % 2 ? hc : '#e8e8e8'); } break;
    case 'fur': qr(5, hy - 2, 14, 5, hc); qr(5, hy - 2, 14, 1, shade(hc, 1.3)); qr(5, hy + 3, 14, 1, '#d8c8a8'); break;
    case 'lady': qr(6, hy - 3, 12, 5, hair); qr(9, hy - 5, 6, 3, hair); p(16, hy - 3, '#e8c860'); p(17, hy - 4, L.pin || '#e85a8a'); p(7, hy - 3, L.pin || '#e85a8a'); break;
    case 'crown2': qr(8, hy - 2, 8, 3, hc); qr(8, hy - 2, 8, 1, hcL); qr(11, hy - 4, 2, 2, hc); p(11, hy - 1, '#e83a2a'); p(12, hy - 1, '#e83a2a'); break;
    case 'straw': qr(3, hy - 1, 18, 2, '#d8b860'); qr(7, hy - 3, 10, 2, '#c8a850'); break;
  }
  if (!L.hat && (L.hairStyle === 'bun' || L.hairStyle === 'tail') && !back) { qr(10, hy - 3, 4, 3, hair); qr(9, hy - 1, 6, 1, L.pin || '#c8a060'); }
  // the weapon (not seen from the back except the top of a polearm)
  const w = L.wpn, hand = side ? [11 + armSwing, y0 + 23] : [bx + bw + 1, y0 + 23];
  const wq = side ? q : p, wood = '#8a5a2a', steel = '#d8dce8', steelD = '#8a90a0';
  if (w && !L.small || w === 'spear') {
    const [hx, hy2] = hand, up = (len, top) => { for (let k = 0; k < len; k++) wq(hx, hy2 + 4 - k, wood); top(hx, hy2 + 4 - len); };
    if (back && !['spear', 'glaive', 'halberd', 'staff'].includes(w)) {}
    else if (w === 'spear') up(26, (x, y) => { wq(x, y, steel); wq(x, y - 1, steel); wq(x, y - 2, steelD); wq(x - 1, y + 1, '#e83a2a'); wq(x + 1, y + 1, '#e83a2a'); });
    else if (w === 'glaive') up(26, (x, y) => { for (let k = 0; k < 6; k++) { wq(x, y - k, steel); wq(x + 1, y - k + 1, k < 4 ? steel : null); wq(x + 2, y - k + 2, k < 2 ? steelD : null); } wq(x - 1, y + 1, '#2a8a4a'); });
    else if (w === 'halberd') up(26, (x, y) => { for (let k = 0; k < 5; k++) wq(x, y - k, steel); wq(x - 1, y + 1, steel); wq(x - 2, y + 1, steel); wq(x + 1, y + 1, steel); wq(x + 2, y + 1, steel); wq(x - 2, y + 2, steelD); wq(x + 2, y + 2, steelD); wq(x, y + 3, '#e83a2a'); });
    else if (w === 'staff') up(24, (x, y) => { wq(x, y, '#c8a040'); wq(x - 1, y, '#c8a040'); wq(x + 1, y, '#c8a040'); wq(x, y - 1, '#e8e060'); });
    else if (w === 'sword') { for (let k = 0; k < 8; k++) wq(hx, hy2 - 1 - k, steel); wq(hx - 1, hy2, '#c8a040'); wq(hx + 1, hy2, '#c8a040'); }
    else if (w === 'twin') { for (let k = 0; k < 7; k++) { wq(hx, hy2 - 1 - k, steel); p(side ? X(hx - 3) : bx - 2, hy2 - 1 - k, steel); } }
    else if (w === 'twinaxe' || w === 'hammer') { for (let k = 0; k < 9; k++) wq(hx, hy2 + 2 - k, wood); const c = w === 'hammer' ? '#5a5a6a' : steel; for (let u = -2; u <= 2; u++) for (let v = 0; v < 3; v++) wq(hx + u, hy2 - 7 - v, c); }
    else if (w === 'bow') { for (let k = 0; k < 13; k++) wq(hx + (k < 3 || k > 9 ? 1 : 2), hy2 + 3 - k, wood); for (let k = 0; k < 13; k++) wq(hx, hy2 + 3 - k, '#e8e8d8'); }
    else if (w === 'fan') { const fx = hx, fy = hy2 - 3; for (let u = -2; u <= 2; u++) for (let v = 0; v < 4 - Math.abs(u); v++) wq(fx + u, fy - v, v === 0 ? '#c8c8c8' : '#f8f8f0'); wq(fx, fy + 1, wood); }
  }
}
// ---------------------------------------------------------------- foot soldiers for the battle squads: true proportions, not chibi
// kind: soldier | bandit | turban | nomad | barbarian | pirate; role: spear | bow | flag. A sheet laid out like a person's
// (4 rows of directions x 3 frames, 24x32), drawn side-on: the left row is drawn, the right is its mirror, and the
// front and back rows reuse them.
const SOL = {
  soldier: (c) => ({ skin: '#e8b890', body: c, bodyD: shade(c, 0.68), trim: '#d8d0b8', hat: 'helm', hatC: shade(c, 0.55), plume: '#e83a2a', pants: '#3a3028', wpn: 'spear', shield: true, plates: true }),
  bandit: () => ({ skin: '#d8a078', body: '#7a5a3a', bodyD: '#5a4028', trim: '#4a3a2a', hat: 'band', hatC: '#a83a2a', pants: '#4a4038', wpn: 'blade', bare: true }),
  turban: () => ({ skin: '#e8b890', body: '#a89a5a', bodyD: '#7a6e3a', trim: '#e8c830', hat: 'scarf', hatC: '#f0d030', pants: '#6a5a3a', wpn: 'spear' }),
  nomad: () => ({ skin: '#d8a078', body: '#7a5a40', bodyD: '#5a3e2a', trim: '#c8a060', hat: 'fur', hatC: '#8a6a4a', pants: '#4a3a2a', wpn: 'bow', fur: true }),
  barbarian: () => ({ skin: '#8a5a38', body: '#8a6a2a', bodyD: '#6a4a1a', trim: '#e8c860', hat: 'feather', hatC: '#d84a2a', pants: '#5a3a1a', wpn: 'spear', shield: true, rattan: true, bare: true }),
  pirate: () => ({ skin: '#c89a70', body: '#e8e8e8', bodyD: '#3a5a8a', trim: '#2a2a2a', hat: 'band', hatC: '#2a4a8a', pants: '#3a3a4a', wpn: 'blade', stripes: true }),
};
export function soldierSheet(kind = 'soldier', color = '#8a4a3a', role = 'spear') {
  const key = `sol_${kind}_${color}_${role}`; if (cache.has(key)) return cache.get(key);
  const S = (SOL[kind] || SOL.soldier)(color); if (role === 'bow') S.wpn = 'bow', S.shield = false; if (role === 'flag') S.wpn = 'flag', S.shield = false;
  if (role === 'cav') return riderSheet(key, S, color);
  const cv = sheetOf(3, 4, FW, FH, (one, f, row) => drawSoldier(one, 0, 0, f, S, color, row >= 2), '#140e0a');
  const out = fine({ canvas: cv.c, fw: FW, fh: FH }); cache.set(key, out); return out;
}
function drawSoldier(cv, ox, oy, frame, S, color, flip) {
  const P = (i, j, c) => { if (c) cv.P(ox + (flip ? FW - 1 - i : i), oy + j, c); }, R = (i, j, w, h, c) => { for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) P(i + u, j + v, c); };
  const step = frame === 0 ? 1 : frame === 2 ? -1 : 0, bob = frame === 1 ? 0 : 1, y = 4 + bob; // everything (the spear tip too) stays inside the 32 rows
  const skin = S.skin, skinD = shade(skin, 0.8), steel = '#c8ccd8', steelD = '#7a8090', wood = '#7a4a22';
  // the back arm and leg first (darker)
  R(11 - step, y + 19, 3, 6, shade(S.pants, 0.75)); R(11 - step, y + 24, 4, 2, '#1e1610');
  // a flag on a pole behind the bearer
  if (S.wpn === 'flag') { R(15, y - 3, 1, 25, wood); for (let j = 0; j < 9; j++) for (let i = 0; i < 7 - (j > 6 ? j - 6 : 0); i++) P(16 + i, y - 3 + j, j === 0 ? shade(color, 1.25) : (i + j) % 5 === 0 ? shade(color, 0.85) : color); P(15, y - 4, '#e8c860'); }
  // legs: trousers and boots, walking
  R(8 + step, y + 19, 3, 6, S.pants); R(7 + step, y + 24, 4, 2, '#2a2018'); P(7 + step, y + 25, '#3a3028');
  // the body: lamellar plates, a vest over bare arms, a fur coat, a striped shirt
  R(7, y + 10, 7, 9, S.body); R(7, y + 10, 1, 7, shade(S.body, 1.18)); R(13, y + 10, 1, 7, shade(S.body, 0.78));
  if (S.plates) { for (let j = 0; j < 9; j += 2) for (let i = 0; i < 7; i++) P(7 + i, y + 10 + j, (i + j) % 2 ? shade(S.body, 0.82) : shade(S.body, 1.12)); R(7, y + 10, 7, 1, S.trim); }
  if (S.stripes) for (let j = 0; j < 8; j += 2) R(7, y + 10 + j, 7, 1, S.bodyD);
  if (S.fur) { R(7, y + 10, 7, 2, '#d8c8a8'); R(7, y + 17, 7, 1, '#d8c8a8'); }
  R(6, y + 16, 9, 1, S.trim); P(9, y + 16, '#e8c860'); // the belt and buckle
  if (S.plates) { R(6, y + 10, 3, 2, shade(S.hatC, 1.1)); P(6, y + 10, shade(S.hatC, 1.4)); }   // a shoulder guard
  R(7, y + 17, 7, 3, S.bodyD); P(8, y + 19, shade(S.bodyD, 0.8)); P(12, y + 19, shade(S.bodyD, 0.8)); // the skirt
  // the head: a real face in profile, not a big chibi one
  R(8, y + 3, 6, 7, skin); R(7, y + 5, 1, 3, skin); P(7, y + 6, skinD); R(8, y + 9, 5, 1, skinD);
  P(8, y + 5, '#1a1410'); P(9, y + 5, '#1a1410'); P(7, y + 7, skinD); P(8, y + 8, shade(skin, 0.7));
  R(12, y + 3, 2, 5, '#1a1410'); // hair at the back of the head
  switch (S.hat) {
    case 'helm': R(7, y + 1, 7, 3, S.hatC); R(7, y + 1, 7, 1, shade(S.hatC, 1.35)); R(13, y + 3, 2, 4, S.hatC); R(6, y + 3, 2, 1, shade(S.hatC, 1.2)); R(10, y - 1, 2, 2, steel); R(11, y - 3, 2, 2, S.plume); P(12, y - 4, S.plume); P(13, y - 3, S.plume); break;
    case 'band': R(7, y + 2, 7, 2, '#1a1410'); R(7, y + 3, 7, 1, S.hatC); P(14, y + 3, S.hatC); P(15, y + 4, S.hatC); P(15, y + 5, S.hatC); break;
    case 'scarf': R(7, y + 1, 7, 3, S.hatC); R(7, y + 3, 7, 1, shade(S.hatC, 0.8)); R(14, y + 2, 2, 5, S.hatC); P(16, y + 6, S.hatC); break;
    case 'fur': R(6, y + 1, 9, 3, S.hatC); R(6, y + 3, 9, 1, '#d8c8a8'); R(13, y + 3, 2, 5, S.hatC); break;
    case 'feather': R(7, y + 2, 7, 2, '#c8a040'); for (let k = 0; k < 4; k++) R(8 + k * 2, y - 2 - (k % 2), 1, 4, k % 2 ? S.hatC : '#f0f0e8'); break;
  }
  // the front arm and the weapon
  const arm = S.bare ? skin : shade(S.body, 0.9);
  if (S.wpn === 'spear') { R(5, y - 1, 1, 26, wood); R(4, y - 2, 3, 1, steel); R(5, y - 4, 1, 2, '#ffffff'); P(4, y - 3, steel); P(6, y - 3, steel); R(4, y, 3, 1, '#e83a2a'); R(5, y + 11, 3, 2, arm); P(5, y + 12, skin); }
  if (S.wpn === 'blade') { R(6, y + 11, 2, 4, arm); P(5, y + 14, skin); for (let k = 0; k < 9; k++) { P(4 - Math.floor(k / 3), y + 13 - k, k ? steel : '#8a6a3a'); if (k > 1) P(5 - Math.floor(k / 3), y + 13 - k, steelD); } R(3, y + 13, 3, 1, '#c8a040'); }
  if (S.wpn === 'bow') { for (let k = 0; k < 15; k++) P(4 - (k > 2 && k < 12 ? 1 : 0), y + 5 + k, wood); for (let k = 0; k < 15; k++) P(5, y + 5 + k, '#e8e8d8'); R(5, y + 11, 3, 2, arm); R(14, y + 9, 2, 7, '#6a4a2a'); P(14, y + 8, '#e8e8e8'); P(15, y + 8, '#e8e8e8'); }
  if (S.wpn === 'flag') { R(12, y + 11, 3, 2, arm); }
  // the shield on the front arm: round lacquer with a boss, or woven rattan
  if (S.shield) { const sc = S.rattan ? '#b8904a' : shade(color, 0.85); for (let j = -4; j <= 4; j++) for (let i = -3; i <= 3; i++) if (i * i / 9 + j * j / 16 <= 1) P(7 + i, y + 14 + j, (i * i / 9 + j * j / 16 > 0.6) ? (S.rattan ? '#8a6a32' : '#e8c860') : S.rattan && (i + j) % 2 ? '#a07a3a' : sc); P(7, y + 14, S.rattan ? '#6a4a22' : '#e8e8e8'); }
}
// a horseman: 32x32 cells, the same 4 rows x 3 frames as a soldier (the left- and right-facing rows are what battles use)
const CW = 32;
function riderSheet(key, S, color) {
  const cv = sheetOf(3, 4, CW, FH, (one, f, row) => drawRider(one, 0, 0, f, S, color, row >= 2), '#140e0a');
  const out = fine({ canvas: cv.c, fw: CW, fh: FH, rider: true }); cache.set(key, out); return out;
}
function drawRider(cv, ox, oy, frame, S, color, flip) {
  const P = (i, j, c) => { if (c) cv.P(ox + (flip ? CW - 1 - i : i), oy + j, c); }, R = (i, j, w, h, c) => { for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) P(i + u, j + v, c); };
  const horse = S.fur ? '#8a5a3a' : color === '#d8d8d8' ? '#e8e0d0' : '#6a4a32', hD = shade(horse, 0.7), hL = shade(horse, 1.2), mane = '#2a1a12';
  const g = frame === 0 ? 1 : frame === 2 ? -1 : 0, bob = frame === 1 ? 0 : 1, y = 2 + bob;
  // the horse: far legs, body, near legs (galloping), neck and head, mane, tail
  R(21 - g, y + 21, 2, 7, hD); R(9 + g, y + 21, 2, 7, hD);
  R(8, y + 15, 17, 7, horse); R(8, y + 15, 17, 1, hL); R(8, y + 21, 17, 1, hD); R(7, y + 16, 1, 5, horse); R(25, y + 16, 1, 4, horse);
  R(24 + g, y + 21, 2, 7, horse); R(12 - g, y + 21, 2, 7, horse);
  for (const x of [9 + g, 12 - g, 21 - g, 24 + g]) R(x, y + 28, 2, 1, '#1a1410');
  R(4, y + 10, 5, 7, horse); R(1, y + 9, 5, 4, horse); R(0, y + 11, 2, 2, hL); P(0, y + 12, '#1a1410'); P(3, y + 10, '#1a1410'); R(4, y + 7, 2, 3, horse); // neck, head, ear
  R(6, y + 8, 2, 8, mane); R(25, y + 15, 2, 2, mane); R(26, y + 16, 2, 6 + (frame % 2), mane);
  R(4, y + 12, 1, 2, '#c8a040'); R(10, y + 14, 9, 2, S.trim); R(13, y + 15, 3, 3, '#8a2a1a'); // bridle, saddle, saddle cloth
  // the rider: leg, body, head, hat, weapon
  R(13, y + 13, 3, 6, S.pants); R(13, y + 18, 3, 2, '#2a2018');
  R(12, y + 4, 7, 10, S.body); R(12, y + 4, 1, 9, shade(S.body, 1.18)); R(18, y + 4, 1, 9, shade(S.body, 0.78)); R(12, y + 11, 7, 1, S.trim);
  if (S.plates) for (let j = 0; j < 6; j += 2) for (let i = 0; i < 7; i++) P(12 + i, y + 5 + j, (i + j) % 2 ? shade(S.body, 0.82) : shade(S.body, 1.1));
  if (S.fur) { R(12, y + 4, 7, 2, '#d8c8a8'); }
  R(13, y - 2, 5, 6, S.skin); R(12, y, 1, 2, S.skin); P(13, y, '#1a1410'); R(17, y - 2, 1, 4, '#1a1410');
  if (S.hat === 'helm') { R(12, y - 4, 7, 3, S.hatC); R(12, y - 4, 7, 1, shade(S.hatC, 1.35)); R(15, y - 6, 1, 2, S.plume || '#e83a2a'); }
  else if (S.hat === 'fur') { R(12, y - 4, 7, 3, S.hatC); R(12, y - 2, 7, 1, '#d8c8a8'); R(18, y - 2, 1, 4, S.hatC); }
  else if (S.hat === 'scarf') { R(12, y - 4, 7, 3, S.hatC); R(18, y - 3, 2, 4, S.hatC); }
  else if (S.hat === 'feather') { R(12, y - 3, 7, 2, '#c8a040'); for (let k = 0; k < 3; k++) R(13 + k * 2, y - 7 + (k % 2), 1, 4, k % 2 ? S.hatC : '#f0f0e8'); }
  else { R(12, y - 3, 7, 2, '#1a1410'); R(12, y - 2, 7, 1, S.hatC || '#a83a2a'); }
  const arm = S.bare ? S.skin : shade(S.body, 0.9);
  if (S.wpn === 'bow') { for (let k = 0; k < 13; k++) P(9 - (k > 2 && k < 10 ? 1 : 0), y + 1 + k, '#7a4a22'); for (let k = 0; k < 13; k++) P(10, y + 1 + k, '#e8e8d8'); R(10, y + 6, 3, 2, arm); }
  else { for (let k = 0; k < 16; k++) P(11 - k, y + 9 - Math.round(k * 0.35), '#7a4a22'); R(0, y + 2, 1, 2, '#e8eef8'); P(1, y + 3, '#c8ccd8'); R(10, y + 8, 3, 2, arm); R(3, y + 5, 2, 1, '#e83a2a'); } // a lance couched forward
}
// a frame as its own small canvas (for battle and portraits)
export function frameCanvas(sheet, dir, f = 1) { const c = document.createElement('canvas'); c.width = sheet.fw; c.height = sheet.fh; c.getContext('2d').drawImage(sheet.canvas, f * sheet.fw, dir * sheet.fh, sheet.fw, sheet.fh, 0, 0, sheet.fw, sheet.fh); return c; }

// ---------------------------------------------------------------- beasts: [frames of 32x24, facing left]
// ---------------------------------------------------------------- beasts: two side-view frames (48x32 each, facing left), shaded
// like the generals: a soft light from the top left, a darker belly side, legs that stride from one frame to the next
const BW = 48, BH = 32;
function beastKit(cv, o) {
  const buf = new Map(), key = (i, j) => (j << 8) | i;
  const P = (i, j, c) => { i = Math.round(i); j = Math.round(j); if (c && i >= 0 && j >= 0 && i < BW && j < BH) buf.set(key(i, j), c); };
  const has = (i, j) => buf.has(key(Math.round(i), Math.round(j)));
  const lit = (T, l) => (l > 0.4 ? T[0] : l < -0.35 ? T[2] : T[1]);
  // a shaded ellipse
  const E = (cx, cy, rx, ry, T, only) => { for (let j = Math.floor(cy - ry); j <= cy + ry; j++) for (let i = Math.floor(cx - rx); i <= cx + rx; i++) { const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry; if (dx * dx + dy * dy > 1 || (only && !has(i, j))) continue; P(i, j, Array.isArray(T) ? lit(T, -dx * 0.55 - dy * 0.8) : T); } };
  // a rounded limb from (x0,y0) to (x1,y1), r0 -> r1 thick, shaded across
  const L = (x0, y0, x1, y1, r0, r1, T) => { const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, m = Math.max(r0, r1) + 1;
    for (let j = Math.floor(Math.min(y0, y1) - m); j <= Math.max(y0, y1) + m; j++) for (let i = Math.floor(Math.min(x0, x1) - m); i <= Math.max(x0, x1) + m; i++) {
      const t = Math.max(0, Math.min(1, ((i + 0.5 - x0) * dx + (j + 0.5 - y0) * dy) / l2)), vx = i + 0.5 - (x0 + dx * t), vy = j + 0.5 - (y0 + dy * t), r = r0 + (r1 - r0) * t, d = Math.hypot(vx, vy);
      if (d <= r) P(i, j, Array.isArray(T) ? lit(T, (-vx * 0.55 - vy * 0.8) / Math.max(1, r)) : T); } };
  const C = (pts, r0, r1, T) => { for (let k = 0; k + 1 < pts.length; k++) L(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], r0 + (r1 - r0) * k / (pts.length - 1), r0 + (r1 - r0) * (k + 1) / (pts.length - 1), T); };
  // a filled polygon in one colour
  const Q = (pts, c) => { const ys = pts.map((p) => p[1]); for (let j = Math.floor(Math.min(...ys)); j <= Math.ceil(Math.max(...ys)); j++) { const xs = []; for (let k = 0; k < pts.length; k++) { const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length]; if ((ay <= j + 0.5 && by > j + 0.5) || (by <= j + 0.5 && ay > j + 0.5)) xs.push(ax + (j + 0.5 - ay) / (by - ay) * (bx - ax)); } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let i = Math.round(xs[k]); i < Math.round(xs[k + 1]); i++) P(i, j, c); } };
  const flush = () => { for (const [k, c] of buf) cv.P(o + (k & 255), k >> 8, c); };
  return { P, has, E, L, C, Q, flush };
}
const tri = (c) => [shade(c, 1.25), c, shade(c, 0.7)];
function drawBeast(K, kind, f) {
  const { P, E, L, C, Q } = K, st = f ? 1 : -1; // the stride: legs swing one way, then the other
  const eye = (x, y, c = '#ffd23a') => { P(x, y, c); P(x + 1, y, c); P(x, y - 1, shade(c, 1.3)); P(x + 1, y + 1, '#1a1410'); P(x, y + 1, '#1a1410'); };
  if (kind === 'wolf') {
    const F = tri('#8a8c9a'), D = tri('#5a5c6a'), W = tri('#d8d8e0');
    C([[37, 14], [42, 10 + st], [46, 13 + st]], 2.6, 1.6, F); L(45, 13 + st, 47, 14 + st, 1.4, 1, W);            // the bushy tail
    L(32, 19, 33 - st * 2, 29, 2, 1.6, D); L(18, 19, 17 + st * 2, 29, 2, 1.6, D);                               // far legs
    E(27, 16, 12, 6, F); E(17, 16, 6.5, 6.5, F); E(27, 20, 9, 2.2, W);                                          // body, chest, belly
    L(36, 19, 37 + st * 2, 29, 2.3, 1.8, F); L(15, 19, 14 - st * 2, 29, 2.3, 1.8, F);                           // near legs
    for (const x of [14 - st * 2, 17 + st * 2, 33 - st * 2, 37 + st * 2]) { P(x - 1, 30, '#2a2a34'); P(x, 30, '#2a2a34'); P(x + 1, 30, '#2a2a34'); }
    E(10, 12, 5.5, 4.5, F); L(7, 14, 1, 15, 2.4, 1.6, F); L(6, 16, 2, 16.5, 1.2, 1, W); P(0, 14, '#1a1410'); P(0, 15, '#1a1410');
    Q([[9, 9], [11, 2], [13, 9]], F[1]); Q([[6, 10], [7, 4], [9, 9]], D[1]); P(11, 5, '#e8b0b8');
    eye(8, 11); for (let i = 2; i < 7; i++) P(i, 17, '#2a1a1a'); P(3, 18, '#fff');
    for (let i = 0; i < 5; i++) P(19 + i * 3, 11, F[0]);                                                          // a ruff of light fur
  }
  if (kind === 'tiger' || kind === 'whitetiger') {
    const white = kind === 'whitetiger', F = tri(white ? '#f0f0f4' : '#e8902a'), S = white ? '#2a2a3a' : '#1a1410', W = tri('#fff8ec');
    C([[37, 15], [42, 9 + st], [46, 7 + st]], 2, 1.6, F); for (const k of [41, 44]) E(k, 10 + st - (k - 41) / 2, 1.4, 1.6, S, true); E(46, 7 + st, 1.6, 1.6, S);
    L(32, 20, 33 - st * 2, 29, 2.4, 2, tri(shade(F[1], 0.8))); L(18, 20, 17 + st * 2, 29, 2.4, 2, tri(shade(F[1], 0.8)));
    E(27, 17, 12.5, 6.5, F); E(18, 17, 6.5, 6.5, F); E(26, 21, 9, 2.2, W);
    for (let k = 0; k < 6; k++) { const x = 20 + k * 3.2; L(x, 11, x + 1, 16 + (k % 2), 0.6, 0.5, S); } // stripes
    for (const k of [0, 1]) { E(k ? 33 : 13, k ? 22 : 22, 1, 1, S, true); }
    L(36, 20, 37 + st * 2, 29, 2.6, 2.2, F); L(15, 20, 14 - st * 2, 29, 2.6, 2.2, F);
    for (const x of [14 - st * 2, 17 + st * 2, 33 - st * 2, 37 + st * 2]) E(x, 29.5, 2.4, 1.3, W);
    E(10, 13, 7, 6.2, F); E(6, 16, 3.6, 2.6, W); E(12, 18, 4, 2, W);                                           // head, muzzle, cheek ruff
    E(7, 7, 2, 2, F); E(13, 6.5, 2, 2, F); P(7, 7, '#e8b0b8'); P(13, 6.5, '#e8b0b8');
    for (const [x, y] of [[11, 9], [14, 11], [9, 9]]) L(x, y, x + 1, y + 2, 0.5, 0.5, S);                      // brow stripes
    eye(7, 11, white ? '#6ac8ff' : '#ffd23a'); P(2, 15, '#2a1a1a'); P(3, 15, '#e88a9a'); P(2, 16, '#2a1a1a');
    for (let i = 3; i < 7; i++) P(i, 18, '#2a1a1a'); P(4, 19, '#fff');
  }
  if (kind === 'bear') {
    const F = tri('#6a4430'), D = tri('#4a2e20'), M = tri('#b08a62');
    L(31, 21, 32 - st, 29, 3.2, 2.8, D); L(17, 21, 16 + st, 29, 3.2, 2.8, D);
    E(27, 16, 14, 8.5, F); E(31, 9.5, 7.5, 4, F); E(26, 21, 10, 2.5, tri('#7a5440'));                          // body, the hump
    L(37, 21, 38 + st, 29, 3.4, 3, F); L(14, 21, 13 - st, 29, 3.4, 3, F);
    for (const x of [13 - st, 38 + st]) for (const d of [-2, 0, 2]) P(x + d, 31, '#e8e0c8');                      // claws
    E(10, 13, 6.5, 5.8, F); E(5, 15.5, 3.5, 2.6, M); P(2, 14, '#1a1410'); P(2, 15, '#1a1410'); P(3, 14, '#3a2a2a');
    E(8, 7.5, 2.2, 2.2, F); E(14, 7.5, 2.2, 2.2, F); P(8, 7.5, M[1]); P(14, 7.5, M[1]);
    eye(8, 11, '#2a1a10'); P(8, 10, '#fff'); for (let i = 3; i < 7; i++) P(i, 18, '#2a1a1a');
  }
  if (kind === 'boar') {
    const F = tri('#5a3a2c'), D = tri('#3a2418'), B = '#2a1a10';
    L(31, 21, 32 - st * 2, 29, 2, 1.7, D); L(18, 21, 17 + st * 2, 29, 2, 1.7, D);
    E(28, 17, 13, 7.5, F); E(18, 17, 7, 7, F);
    for (let k = 0; k < 9; k++) { const x = 15 + k * 3, y = 10 - (k > 1 && k < 7 ? 1 : 0); Q([[x - 1.5, y + 2], [x + 0.5, y - 2 - (k % 2)], [x + 1.5, y + 2]], B); } // the bristly crest
    L(36, 21, 37 + st * 2, 29, 2.2, 1.9, F); L(15, 21, 14 - st * 2, 29, 2.2, 1.9, F);
    for (const x of [14 - st * 2, 17 + st * 2, 32 - st * 2, 37 + st * 2]) { P(x - 1, 30, '#1a1010'); P(x, 30, '#1a1010'); }
    Q([[14, 10], [4, 13], [2, 18], [6, 22], [15, 22]], F[1]); E(9, 14, 4, 3, F); E(2.5, 17, 1.8, 2.6, tri('#c88a7a')); P(2, 16, B); P(2, 18, B);
    C([[6, 19], [4, 16], [5, 13]], 1.1, 0.7, tri('#f4ecd8'));                                                     // a tusk
    Q([[11, 9], [13, 5], [14, 10]], D[1]); eye(9, 13, '#ff6a3a');
    C([[40, 15], [43, 13], [44, 15]], 0.9, 0.7, F);                                                               // a curly tail
  }
  if (kind === 'bat') { // seen from the front: wings up, then down
    const F = tri('#4a3050'), Wm = tri('#7a4a7a'), up = f === 0;
    for (const s of [-1, 1]) { const X = (x) => 24 + s * x;
      const pts = up ? [[3, 12], [12, 3], [21, 1], [17, 8], [21, 11], [15, 13], [17, 17], [8, 16]] : [[3, 13], [11, 18], [20, 24], [18, 17], [22, 18], [16, 14], [18, 12], [8, 11]];
      Q(pts.map(([x, y]) => [X(x), y]), Wm[1]);
      for (const [x, y] of up ? [[21, 1], [21, 11], [17, 17]] : [[20, 24], [22, 18], [18, 12]]) L(X(3), 12, X(x), y, 0.6, 0.5, F[2]);
    }
    E(24, 15, 4.5, 5.5, F); E(24, 9, 4, 3.5, F); Q([[20, 8], [21, 2], [23, 7]], F[1]); Q([[28, 8], [27, 2], [25, 7]], F[1]);
    P(22, 9, '#ff3a2a'); P(26, 9, '#ff3a2a'); P(22, 8, '#ff9a8a'); P(26, 8, '#ff9a8a'); P(23, 12, '#fff'); P(25, 12, '#fff'); for (let i = 22; i < 27; i++) P(i, 11, '#1a0a1a');
    L(22, 20, 21, 23, 0.7, 0.6, F[2]); L(26, 20, 27, 23, 0.7, 0.6, F[2]);
  }
  if (kind === 'snake') { // coiled, its head raised and swaying, a forked tongue
    const F = tri('#4a9a3a'), D = '#2a5a22', Bl = tri('#d8d070'), sw = f ? 1 : -1;
    E(28, 25, 13, 5, F); E(28, 21, 10, 4, F); E(27, 17.5, 6.5, 3, F);
    for (let k = 0; k < 7; k++) { const x = 18 + k * 3.4; E(x, 25 - (k % 2), 1.2, 1, D, true); E(x + 1.5, 21 + (k % 2), 1, 0.8, D, true); }
    C([[22, 18], [16 + sw, 13], [12 + sw, 8]], 3, 2.4, F); L(19, 18, 14 + sw, 12, 1, 1, Bl[1]);
    E(9 + sw, 7, 5, 3.4, F); E(6 + sw, 8, 2, 1.6, Bl);
    eye(9 + sw, 6, '#ffe040'); P(4 + sw, 6, '#1a1410');
    L(4 + sw, 8.5, 1 + sw, 8.5, 0.5, 0.5, '#e83a2a'); P(0 + sw, 7.5, '#e83a2a'); P(0 + sw, 9.5, '#e83a2a');
  }
}
// a horse with no rider (a wild one): the same cells as a horseman, the rows facing left and right
export function horseSheet(coat, mane = '#2a1a12') {
  const key = 'horse_' + coat + mane; if (cache.has(key)) return cache.get(key);
  const cv = sheetOf(3, 4, CW, FH, (one, f, row) => drawHorse(one, f, coat, mane, row === 2 || row === 0), '#140e0a');
  const out = fine({ canvas: cv.c, fw: CW, fh: FH, rider: true }); cache.set(key, out); return out;
}
function drawHorse(cv, frame, horse, mane, flip) {
  const P = (i, j, c) => { if (c) cv.P(flip ? CW - 1 - i : i, j, c); }, R = (i, j, w, h, c) => { for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) P(i + u, j + v, c); };
  const hD = shade(horse, 0.7), hL = shade(horse, 1.2), g = frame === 0 ? 1 : frame === 2 ? -1 : 0, y = 4 + (frame === 1 ? 0 : 1);
  R(21 - g, y + 21, 2, 7, hD); R(9 + g, y + 21, 2, 7, hD);
  R(8, y + 15, 17, 7, horse); R(8, y + 15, 17, 1, hL); R(8, y + 21, 17, 1, hD); R(7, y + 16, 1, 5, horse); R(25, y + 16, 1, 4, horse);
  R(24 + g, y + 21, 2, 7, horse); R(12 - g, y + 21, 2, 7, horse);
  for (const x of [9 + g, 12 - g, 21 - g, 24 + g]) R(x, y + 28, 2, 1, '#1a1410');
  R(4, y + 10, 5, 7, horse); R(1, y + 9, 5, 4, horse); R(0, y + 11, 2, 2, hL); P(0, y + 12, '#1a1410'); P(3, y + 10, '#1a1410'); R(4, y + 7, 2, 3, horse);
  R(6, y + 8, 2, 8, mane); R(9, y + 14, 3, 1, mane); R(25, y + 15, 2, 2, mane); R(26, y + 16, 2, 6 + (frame % 2), mane);
}
export function beastSheet(kind) {
  const key = 'beast2_' + kind; if (cache.has(key)) return cache.get(key);
  const cv = sheetOf(2, 1, BW, BH, (one, f) => { const K = beastKit(one, 0); drawBeast(K, kind, f); K.flush(); });
  const out = fine({ canvas: cv.c, fw: BW, fh: BH, beast: true }); cache.set(key, out); return out;
}

// ---------------------------------------------------------------- the land: a 16x16 tile atlas (8 x 4 tiles)
export const TILE_N = { grass: 0, grass2: 1, dirt: 2, road: 3, sand: 4, forest: 5, rock: 6, snow: 7, desert: 8, hill: 9, stone: 10, brick: 11, roof: 12, wood: 13, water: 14, cliff: 15, cliffRock: 16, cliffSnow: 17, plaza: 18, field: 19, roofRed: 20, wall: 21, marsh: 22, cliffSand: 23 };
export function tileAtlas() {
  if (cache.has('atlas')) return cache.get('atlas');
  const T = 16, cols = 8, rows = 3, cv = px(T * cols, T * rows), r = rnd(1234);
  const tile = (n, fn) => { const ox = (n % cols) * T, oy = Math.floor(n / cols) * T; fn((i, j, c) => cv.P(ox + i, oy + j, c), ox, oy); };
  const noise = (base, vary, n, extra) => tile(n, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const v = r(); p(i, j, v < 0.12 ? shade(base, 1 - vary) : v > 0.9 ? shade(base, 1 + vary * 0.6) : base); } extra && extra(p); });
  noise('#6aa84a', 0.12, TILE_N.grass, (p) => { for (let k = 0; k < 7; k++) { const i = Math.floor(r() * 15), j = 1 + Math.floor(r() * 14); p(i, j, '#8ac85a'); p(i, j - 1, '#8ac85a'); } });
  noise('#5a9a42', 0.12, TILE_N.grass2, (p) => { for (let k = 0; k < 3; k++) { const i = Math.floor(r() * 15), j = Math.floor(r() * 15); p(i, j, ['#f0e060', '#f0a0b0', '#ffffff'][k]); } });
  noise('#a08058', 0.12, TILE_N.dirt);
  noise('#c8b088', 0.1, TILE_N.road, (p) => { for (let k = 0; k < 6; k++) { const i = Math.floor(r() * 14), j = Math.floor(r() * 14); p(i, j, '#a89070'); p(i + 1, j, '#a89070'); } });
  noise('#e8d8a0', 0.08, TILE_N.sand);
  noise('#3a7a3a', 0.15, TILE_N.forest);
  noise('#8a8478', 0.14, TILE_N.rock, (p) => { for (let k = 0; k < 4; k++) { const i = Math.floor(r() * 13), j = Math.floor(r() * 13); p(i, j, '#a8a498'); p(i + 1, j, '#6a6458'); p(i, j + 1, '#6a6458'); } });
  noise('#eef2f8', 0.05, TILE_N.snow);
  noise('#d8b878', 0.1, TILE_N.desert, (p) => { for (let j = 3; j < 16; j += 5) for (let i = 0; i < 16; i++) if ((i + j) % 7 < 3) p(i, j, '#c8a868'); });
  noise('#7a9a4a', 0.14, TILE_N.hill);
  tile(TILE_N.stone, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const edge = i % 8 === 0 || j % 8 === 0; p(i, j, edge ? '#8a8478' : r() < 0.15 ? '#b8b0a0' : '#a8a090'); } });
  tile(TILE_N.brick, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const row = Math.floor(j / 4), edge = j % 4 === 3 || (i + row * 4) % 8 === 0; p(i, j, edge ? '#6a6258' : r() < 0.2 ? '#a89c88' : '#9a8e7a'); } });
  tile(TILE_N.roof, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const edge = j % 4 === 3, ridge = i % 4 === 0; p(i, j, edge ? '#1a2a3a' : ridge ? '#3a5a6a' : '#2a4a5a'); } });
  tile(TILE_N.wood, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) p(i, j, i % 5 === 0 ? '#5a3a1a' : r() < 0.2 ? '#8a5a2a' : '#7a4a22'); });
  noise('#3a7ab8', 0.08, TILE_N.water, (p) => { for (let k = 0; k < 5; k++) { const i = Math.floor(r() * 12), j = Math.floor(r() * 15); p(i, j, '#8ac8f0'); p(i + 1, j, '#8ac8f0'); p(i + 2, j, '#8ac8f0'); } });
  tile(TILE_N.cliff, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) p(i, j, j < 3 ? '#5a8a3a' : (i * 3 + j * 7) % 11 < 2 ? '#5a4a38' : r() < 0.2 ? '#8a7258' : '#7a6248'); });
  tile(TILE_N.cliffRock, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) p(i, j, (i * 5 + j * 3) % 13 < 2 ? '#4a4640' : r() < 0.2 ? '#7a766c' : '#6a665c'); });
  tile(TILE_N.cliffSnow, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) p(i, j, j < 4 ? '#f0f4f8' : (i * 5 + j * 3) % 13 < 2 ? '#5a5a64' : '#8a8a94'); });
  tile(TILE_N.plaza, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const edge = (i % 8 === 0) !== (j % 8 === 0); p(i, j, edge ? '#9a9080' : r() < 0.1 ? '#c8c0b0' : '#bab2a0'); } });
  tile(TILE_N.field, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) p(i, j, j % 4 < 2 ? (r() < 0.2 ? '#a8b840' : '#98a838') : '#7a6a3a'); });
  tile(TILE_N.roofRed, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const edge = j % 4 === 3, ridge = i % 4 === 0; p(i, j, edge ? '#4a1a10' : ridge ? '#a84a2a' : '#8a3a22'); } });
  tile(TILE_N.wall, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) p(i, j, j < 2 ? '#d8d0c0' : r() < 0.1 ? '#e8e0d0' : '#e0d8c8'); });
  noise('#5a7a4a', 0.15, TILE_N.marsh, (p) => { for (let k = 0; k < 4; k++) { const i = Math.floor(r() * 12), j = Math.floor(r() * 15); p(i, j, '#4a7aa0'); p(i + 1, j, '#4a7aa0'); } });
  tile(TILE_N.cliffSand, (p) => { for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) p(i, j, j < 3 ? '#d8b878' : (i * 3 + j * 7) % 11 < 2 ? '#8a6a48' : r() < 0.2 ? '#b89068' : '#a88058'); });
  const out = { canvas: cv.c, cols, rows, T }; cache.set('atlas', out); return out;
}

// ---------------------------------------------------------------- scenery sprites
export function treeCanvas(kind = 0) {
  const key = 'tree' + kind; if (cache.has(key)) return cache.get(key);
  const cv = px(24, 32), { P } = cv, r = rnd(77 + kind);
  const leaf = [['#3a8a3a', '#2a6a2a', '#5aaa4a'], ['#2a6a4a', '#1a4a3a', '#3a8a5a'], ['#6a9a3a', '#4a7a2a', '#8aba4a'], ['#d87aa0', '#b85a80', '#f0a0c0']][kind % 4];
  for (let j = 22; j < 32; j++) { P(11, j, '#6a4a2a'); P(12, j, '#5a3a1a'); }
  if (kind === 1) { // a pine
    for (let k = 0; k < 4; k++) { const w = 4 + k * 2, y = 3 + k * 5; for (let j = 0; j < 6; j++) for (let i = -w + j / 2; i <= w - j / 2; i++) if (Math.abs(i) <= w - (5 - j)) P(12 + i, y + j, j < 2 ? leaf[2] : r() < 0.3 ? leaf[1] : leaf[0]); }
  } else {
    for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) { const dx = i - 11.5, dy = j - 11; if (dx * dx / 120 + dy * dy / 110 < 1 + (r() - 0.5) * 0.15) P(i, j, dy < -4 && dx < 2 ? leaf[2] : r() < 0.25 ? leaf[1] : leaf[0]); }
  }
  outline(cv, '#142014');
  cache.set(key, cv.c); return cv.c;
}
export function rockCanvas(snow) {
  const key = 'rock' + (snow ? 1 : 0); if (cache.has(key)) return cache.get(key);
  const cv = px(24, 24), { P } = cv, r = rnd(5);
  for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) { const dx = i - 12, h = 22 - Math.abs(dx) * 1.6; if (j > 24 - h) P(i, j, snow && j < 24 - h + 4 ? '#f0f4f8' : dx < -2 ? '#9a968c' : r() < 0.2 ? '#6a665c' : '#7a766c'); }
  outline(cv); cache.set(key, cv.c); return cv.c;
}
// a flag in a warlord's colour
export function flagCanvas(color) {
  const key = 'flag' + color; if (cache.has(key)) return cache.get(key);
  const cv = px(12, 20), { P } = cv;
  for (let j = 0; j < 20; j++) P(1, j, '#5a3a1a');
  for (let j = 1; j < 9; j++) for (let i = 2; i < 11; i++) P(i, j, i > 8 && j > 6 ? null : j === 1 ? shade(color, 1.2) : color);
  outline(cv); cache.set(key, cv.c); return cv.c;
}
