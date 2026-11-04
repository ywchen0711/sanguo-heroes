// Pixel art, drawn in code: chibi generals in the style of the old Famicom Three Kingdoms RPGs (big head, small body),
// four directions and three walking frames each, the faces of the famous ones, soldiers, bandits and beasts, trees,
// rocks and the 16x16 tiles of the land. Everything is drawn once into canvases and reused as textures.

// ---------------------------------------------------------------- colours
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const shade = (c, f) => { const [r, g, b] = hex(c); return f >= 1 ? toHex(r + (255 - r) * (f - 1), g + (255 - g) * (f - 1), b + (255 - b) * (f - 1)) : toHex(r * f, g * f, b * f); };
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed) => { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; };

// a tiny pixel canvas: set pixels, then outline and read out
function px(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const P = (i, j, col) => { if (!col || i < 0 || j < 0 || i >= w || j >= h) return; x.fillStyle = col; x.fillRect(i | 0, j | 0, 1, 1); };
  const R = (i, j, a, b, col) => { if (!col) return; x.fillStyle = col; x.fillRect(i | 0, j | 0, a, b); };
  return { c, x, P, R, w, h };
}
// a dark outline around everything drawn (the crisp HD-2D sprite look)
function outline(cv, col = '#1a1410') {
  const { c, x, w, h } = cv, d = x.getImageData(0, 0, w, h), a = d.data, o = new Uint8ClampedArray(a);
  const [r, g, b] = hex(col);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4; if (a[k + 3]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => { const ii = i + u, jj = j + v; return ii >= 0 && jj >= 0 && ii < w && jj < h && a[(jj * w + ii) * 4 + 3] > 0; });
    if (near) { o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = 255; }
  }
  x.putImageData(new ImageData(o, w, h), 0, 0);
  return c;
}

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
  于吉: { skin: '#f0c8a0', beard: 'long', beardC: '#f0f0f0', hat: 'taoist', hatC: '#3a3a3a', body: '#e8e8e0', trim: '#5a5a5a', cape: null, wpn: 'staff', robe: true },
};
const HAIRS = ['#1a1410', '#2a1a10', '#3a2a1a', '#141018'], SKINS = ['#f0c8a0', '#e8b890', '#f4d0a8', '#d8a078', '#e8c098'];
// a look for any general: g = { name, war, int, lead, cha }, color = their warlord's colour
export function lookFor(g, color = '#7a7a8a') {
  const F = FAMOUS[g.name]; if (F) return { ...F, hair: F.beardC || '#1a1410', key: g.name };
  const r = rnd(hash(g.name)), scholar = g.int > g.war + 15 && g.war < 65, brute = g.war >= 85 && g.int < 50;
  const hats = scholar ? ['scholar', 'scholar', 'band', 'taoist'] : brute ? ['band', null, 'helmet'] : ['helmet', 'helmet', 'band', 'hood', 'topknot'];
  const wpns = scholar ? ['fan', 'sword', null, 'staff'] : ['spear', 'glaive', 'sword', 'halberd', 'bow', 'hammer'];
  const pick = (a) => a[Math.floor(r() * a.length)];
  const body = scholar ? pick(['#e8e8e0', '#8a9ab8', '#5a6a8a', '#c8b898']) : color;
  return { skin: pick(SKINS), hair: pick(HAIRS), beard: r() < 0.45 ? pick(['short', 'goatee', 'long', 'spiky']) : null, beardC: pick(HAIRS), hat: pick(hats), hatC: scholar ? '#2a2a3a' : shade(color, 0.75),
    body, trim: pick(['#e8c860', '#d8d8e0', '#c8a060', '#3a3a3a']), cape: r() < 0.7 ? shade(color, 0.6) : null, wpn: pick(wpns), robe: scholar, fat: brute && r() < 0.4, key: g.name + color };
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
export function personSheet(L) {
  if (cache.has(L.key)) return cache.get(L.key);
  const cv = px(FW * 3, FH * 4);
  for (let d = 0; d < 4; d++) for (let f = 0; f < 3; f++) drawPerson(cv, f * FW, d * FH, d, f, L);
  outline(cv);
  const out = { canvas: cv.c, fw: FW, fh: FH };
  cache.set(L.key, out);
  return out;
}
function drawPerson(cv, ox, oy, dir, frame, L) {
  const { P, R } = cv, p = (i, j, c) => P(ox + i, oy + j, c), r = (i, j, a, b, c) => R(ox + i, oy + j, a, b, c);
  const skin = L.skin, skinD = shade(skin, 0.82), body = L.body, bodyD = shade(body, 0.72), bodyL = shade(body, 1.18), trim = L.trim, hair = L.hair || '#1a1410';
  const step = frame === 1 ? 0 : frame === 0 ? -1 : 1, bob = frame === 1 ? 0 : 1, fat = L.fat ? 1 : 0;
  const side = dir === 1 || dir === 2, flip = dir === 2, back = dir === 3;
  const X = (i) => flip ? FW - 1 - i : i; // mirror for facing right
  const q = (i, j, c) => p(X(i), j, c), qr = (i, j, a, b, c) => { for (let u = 0; u < a; u++) for (let v = 0; v < b; v++) q(i + u, j + v, c); };
  const y0 = 1 + bob;
  // the cape, behind everything
  if (L.cape && !L.small) { if (back) qr(5, y0 + 15, 14, 12, L.cape); else if (side) qr(13, y0 + 16, 4, 10, shade(L.cape, 0.85)); }
  // legs and boots
  const legY = y0 + 25;
  if (side) { qr(9 + step, legY, 3, 5, bodyD); qr(12 - step, legY, 3, 5, shade(bodyD, 0.85)); qr(9 + step, legY + 4, 3, 2, '#2a2018'); qr(12 - step, legY + 4, 3, 2, '#2a2018'); }
  else { qr(8, legY + (step < 0 ? -1 : 0), 3, 5, bodyD); qr(13, legY + (step > 0 ? -1 : 0), 3, 5, bodyD); qr(8, legY + 4 + (step < 0 ? -1 : 0), 3, 2, '#2a2018'); qr(13, legY + 4 + (step > 0 ? -1 : 0), 3, 2, '#2a2018'); }
  // the body: armour or a robe
  const bw = 12 + fat * 2, bx = 6 - fat;
  if (L.robe) { qr(bx, y0 + 15, bw, 12, body); qr(bx, y0 + 15, 2, 12, bodyD); qr(bx + bw - 2, y0 + 15, 2, 12, bodyD); if (!back) { qr(11, y0 + 15, 2, 12, trim); } qr(bx, y0 + 21, bw, 1, trim); }
  else {
    qr(bx, y0 + 15, bw, 10, body); qr(bx, y0 + 15, bw, 1, bodyL); qr(bx, y0 + 24, bw, 1, bodyD);
    if (!back) { qr(bx + 2, y0 + 17, bw - 4, 1, trim); qr(bx + 2, y0 + 19, bw - 4, 1, shade(body, 0.85)); qr(11, y0 + 16, 2, 5, shade(trim, 0.9)); }
    qr(bx, y0 + 22, bw, 2, trim); // the belt
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
  if (back) { qr(6, hy, 12, 12, hair); qr(9, hy - 2, 6, 3, hair); }
  else {
    qr(6, hy, 12, 4, hair); qr(6, hy, 2, 8, hair); qr(16, hy, 2, 8, hair);
    if (side) { qr(13, hy, 5, 9, hair); }
    // the face
    const ey = hy + 6;
    if (side) { q(8, ey, '#1a1410'); q(8, ey + 1, '#1a1410'); q(7, ey + 4, shade(skin, 0.7)); }
    else { p(8, ey, '#1a1410'); p(8, ey + 1, '#1a1410'); p(15, ey, '#1a1410'); p(15, ey + 1, '#1a1410'); p(9, ey, '#fff'); p(14, ey, '#fff'); p(11, ey + 4, shade(skin, 0.7)); p(12, ey + 4, shade(skin, 0.7)); p(7, ey + 2, shade(skin, 0.92)); p(16, ey + 2, shade(skin, 0.92)); }
    if (L.patch) { if (side) qr(7, ey - 1, 3, 3, '#1a1a1a'); else qr(14, ey - 1, 3, 3, '#1a1a1a'); }
    // beards
    const bc = L.beardC || '#1a1410';
    if (L.beard === 'long') { if (side) qr(6, ey + 4, 5, 9, bc); else { qr(9, ey + 4, 6, 3, bc); qr(10, ey + 7, 4, 6, bc); qr(11, ey + 13, 2, 2, bc); } }
    if (L.beard === 'spiky') { if (side) qr(6, ey + 3, 6, 4, bc); else { qr(7, ey + 3, 10, 3, bc); p(6, ey + 4, bc); p(17, ey + 4, bc); qr(9, ey + 6, 6, 2, bc); } }
    if (L.beard === 'short') { if (side) qr(7, ey + 4, 4, 2, bc); else qr(9, ey + 4, 6, 2, bc); }
    if (L.beard === 'goatee') { if (side) qr(7, ey + 5, 2, 3, bc); else qr(11, ey + 5, 2, 3, bc); }
    if (L.beard === 'thin') { if (side) qr(7, ey + 5, 2, 4, bc); else { qr(11, ey + 5, 2, 5, bc); p(9, ey + 4, bc); p(14, ey + 4, bc); } }
  }
  // headgear
  const hc = L.hatC, hcD = hc && shade(hc, 0.7), hcL = hc && shade(hc, 1.25);
  switch (L.hat) {
    case 'helmet': qr(5, hy - 2, 14, 5, hc); qr(5, hy - 2, 14, 1, hcL); qr(5, hy + 3, 14, 1, hcD); qr(11, hy - 5, 2, 3, '#e83a2a'); qr(10, hy - 6, 4, 1, '#e83a2a'); if (!back) qr(4, hy + 3, 2, 5, hcD), qr(18, hy + 3, 2, 5, hcD); break;
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
    case 'lady': qr(6, hy - 3, 12, 5, hair); qr(9, hy - 5, 6, 3, hair); p(16, hy - 3, '#e8c860'); p(17, hy - 4, '#e85a8a'); break;
    case 'straw': qr(3, hy - 1, 18, 2, '#d8b860'); qr(7, hy - 3, 10, 2, '#c8a850'); break;
  }
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
// a frame as its own small canvas (for battle and portraits)
export function frameCanvas(sheet, dir, f = 1) { const c = document.createElement('canvas'); c.width = sheet.fw; c.height = sheet.fh; c.getContext('2d').drawImage(sheet.canvas, f * sheet.fw, dir * sheet.fh, sheet.fw, sheet.fh, 0, 0, sheet.fw, sheet.fh); return c; }

// ---------------------------------------------------------------- beasts: [frames of 32x24, facing left]
export function beastSheet(kind) {
  const key = 'beast_' + kind; if (cache.has(key)) return cache.get(key);
  const cv = px(32 * 2, 24);
  for (let f = 0; f < 2; f++) {
    const { P } = cv, o = f * 32, p = (i, j, c) => P(o + i, j, c), r = (i, j, a, b, c) => { for (let u = 0; u < a; u++) for (let v = 0; v < b; v++) p(i + u, j + v, c); };
    const T = { tiger: ['#e8962a', '#1a1410', '#f8f0e0'], wolf: ['#8a8a98', '#4a4a58', '#d8d8e0'], bear: ['#5a3a2a', '#3a2418', '#8a6a4a'], boar: ['#6a4a3a', '#3a2a1a', '#e8e0c8'] }[kind];
    const [c, d, l] = T, lg = f ? 1 : 0;
    r(8, 8, 18, 9, c); r(8, 15, 18, 2, d); r(10, 9, 14, 2, shade(c, 1.15));
    if (kind === 'tiger') for (let k = 0; k < 5; k++) r(11 + k * 3, 8, 1, 6, d);
    r(2, 5, 9, 8, c); r(1, 9, 3, 3, l); p(4, 7, '#1a1410'); p(5, 7, '#fff'); r(3, 3, 2, 3, c); r(8, 3, 2, 3, c); p(1, 10, '#1a1410');
    if (kind === 'boar') { p(1, 12, '#fff'); p(2, 13, '#fff'); }
    r(9, 17, 3, 5 - lg, d); r(14, 17, 3, 5 - (1 - lg), d); r(19, 17, 3, 5 - lg, d); r(23, 17, 3, 5 - (1 - lg), d);
    for (let k = 0; k < 6; k++) p(26 + k, 9 - Math.round(Math.sin(k / 2 + f) * 2), c);
  }
  outline(cv);
  const out = { canvas: cv.c, fw: 32, fh: 24, beast: true }; cache.set(key, out); return out;
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
