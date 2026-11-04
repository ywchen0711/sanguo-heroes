// A walled town for every city: the 太守府 at the top, shops, an inn and a tavern, a training ground, wells and
// lanterns, trees and townsfolk. The layout is the same idea everywhere but shuffled by the city, and bigger cities
// have more houses and a grander hall.
import { LOOKS } from './sprites.js';

const B = { GRASS: 0, GRASS2: 1, DIRT: 2, ROAD: 3, STONE: 10, BRICK: 11, PLAZA: 18, FIELD: 19, WALL: 21 };
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export const BUILDINGS = {
  gov: { n: '太守府', sign: '府' }, arms: { n: '武具店', sign: '武' }, goods: { n: '道具店', sign: '藥' }, inn: { n: '客棧', sign: '宿' },
  tavern: { n: '酒館', sign: '酒' }, drill: { n: '練兵場', sign: '兵' }, house: { n: '民家', sign: null },
};

export function buildTown(city, size, color, o = {}) {
  const W = 30, H = 24, r = (() => { let a = hash(city) || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; })();
  const top = new Uint8Array(W * H).fill(B.PLAZA), hgt = new Float32Array(W * H), walk = new Uint8Array(W * H).fill(1);
  const set = (x, z, t, h = 0, w = 1) => { if (x < 0 || z < 0 || x >= W || z >= H) return; const i = z * W + x; top[i] = t; hgt[i] = h; walk[i] = w; };
  // the ground: grass round the edges, stone streets, a plaza
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) set(x, z, r() < 0.7 ? B.GRASS : B.GRASS2);
  for (let z = 2; z < H - 1; z++) for (let x = 13; x <= 16; x++) set(x, z, B.STONE);
  for (let x = 2; x < W - 2; x++) for (let z = 11; z <= 13; z++) set(x, z, B.STONE);
  for (let z = 9; z <= 15; z++) for (let x = 10; x <= 19; x++) set(x, z, B.PLAZA);
  // the walls, with the gate in the south
  for (let x = 0; x < W; x++) { set(x, 0, B.BRICK, 1.5, 0); if (x < 13 || x > 16) set(x, H - 1, B.BRICK, 1.5, 0); }
  for (let z = 0; z < H; z++) { set(0, z, B.BRICK, 1.5, 0); set(W - 1, z, B.BRICK, 1.5, 0); }
  const props = [], doors = [], npcs = [];
  const house = (id, x, z, w, d, o = {}) => {
    for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) walk[zz * W + xx] = 0;
    const door = o.door ?? Math.floor(w / 2);
    props.push({ kind: 'house', x, z, w, d, h: o.h || 1.1, door: id === 'house' ? null : door, sign: BUILDINGS[id].sign, red: o.red ?? r() < 0.4, floors: o.floors, roofH: o.roofH });
    if (id !== 'house') { doors.push({ id, x: x + door, z: z + d, n: BUILDINGS[id].n }); set(x + door, z + d, B.STONE); }
  };
  // the hall of the governor
  const big = size >= 3;
  if (o.county) house('house', 11, 2, 8, 4, { red: true, h: 1.3, roofH: 0.9 }); // the county yamen: the magistrate keeps to himself
  else house('gov', big ? 10 : 11, 2, big ? 10 : 8, 4, { red: true, floors: big ? 2 : 1, h: 1.4, roofH: 1 });
  for (let x = 12; x <= 17; x++) set(x, 6, B.STONE);
  props.push({ kind: 'banner', x: big ? 9 : 10, z: 6, color }, { kind: 'banner', x: big ? 20 : 19, z: 6, color });
  // shops, inn and tavern on either side, in a shuffled order
  const left = [['arms', 2, 3], ['goods', 2, 7]], right = [['inn', 21, 3], ['tavern', 21, 7]];
  if (r() < 0.5) [left[0][0], left[1][0]] = [left[1][0], left[0][0]];
  if (r() < 0.5) [right[0][0], right[1][0]] = [right[1][0], right[0][0]];
  for (const [id, x, z] of [...left, ...right]) house(id, x, z, 6, 3);
  // the training ground (open, with banners and straw men) and houses in the south
  for (let z = 16; z <= 21; z++) for (let x = 2; x <= 9; x++) set(x, z, B.DIRT);
  doors.push({ id: 'drill', x: 6, z: 18, n: '練兵場', open: true });
  props.push({ kind: 'banner', x: 2, z: 16, color }, { kind: 'banner', x: 9, z: 16, color });
  const nh = size >= 3 ? 4 : size === 2 ? 3 : 2;
  for (let k = 0; k < nh; k++) house('house', 19 + (k % 2) * 5, 16 + Math.floor(k / 2) * 3, 4, 2, { h: 0.9 });
  // wells, lanterns and trees
  props.push({ kind: 'well', x: 14, z: 11 });
  for (const [x, z] of [[10, 9], [19, 9], [10, 15], [19, 15], [12, 21], [17, 21]]) props.push({ kind: 'lantern', x, z });
  for (let k = 0; k < 10; k++) { const x = 1 + Math.floor(r() * (W - 2)), z = 1 + Math.floor(r() * (H - 2)); if (walk[z * W + x] && top[z * W + x] <= 1 && !(x >= 12 && x <= 17)) { props.push({ kind: 'tree', x, z, t: Math.floor(r() * 4) }); walk[z * W + x] = 0; } }
  for (const p of props) if (p.kind === 'well' || p.kind === 'lantern') walk[p.z * W + p.x] = 0;
  // the townsfolk
  const LINES = ['聽說北方又在打仗了……', '今年的收成還不錯。', '城外常有山賊出沒，出門要小心。', '酒館裡常有在野的英雄豪傑。', '武具店剛進了一批好兵器。', '太守大人正在招募人才呢。', '練兵場可以磨練武藝。', '客棧住一晚，疲勞全消。', '聽說有人在附近見過珍奇的寶物。', '天下大亂，百姓苦啊。'];
  for (let k = 0; k < 5 + size; k++) { let x, z; do { x = 3 + Math.floor(r() * (W - 6)); z = 8 + Math.floor(r() * 13); } while (!walk[z * W + x]); npcs.push({ x, z, look: LOOKS.villager(city + k), line: LINES[Math.floor(r() * LINES.length)], wander: true }); }
  if (o.county) npcs.push({ x: 15, z: 7, look: LOOKS.villager('縣令' + city), line: `本官是${city}的縣令。小地方，沒什麼好招待的。`, special: 'magistrate' });
  npcs.push({ x: 12, z: 21, look: LOOKS.soldier(color), line: `這裡是${city}。進出城門請守規矩。`, guard: true }, { x: 17, z: 21, look: LOOKS.soldier(color), line: `${city}的城牆可不是好攻的。`, guard: true });
  const tile = (x, z) => { if (x < 0 || z < 0 || x >= W || z >= H) return null; const i = z * W + x; return { top: top[i], side: top[i] === B.BRICK ? 11 : 15, h: hgt[i] }; };
  return { W, H, tile, walkable: (x, z) => x >= 0 && z >= 0 && x < W && z < H && walk[z * W + x] === 1, props, doors, npcs, spawn: [14, H - 2], gate: { x0: 13, x1: 16, z: H - 1 }, sky: '#a8d0f0', fogNear: 30, fogFar: 70 };
}

// ---------------------------------------------------------------- a village: a few farmhouses round a threshing floor, fields, a well,
// the village head, a farmhouse that takes in travellers and a little shop
export function buildVillage(name) {
  const W = 22, H = 18, r = (() => { let a = hash(name) || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; })();
  const top = new Uint8Array(W * H), hgt = new Float32Array(W * H), walk = new Uint8Array(W * H).fill(1);
  const set = (x, z, t, h = 0, w = 1) => { if (x < 0 || z < 0 || x >= W || z >= H) return; const i = z * W + x; top[i] = t; hgt[i] = h; walk[i] = w; };
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) set(x, z, r() < 0.7 ? B.GRASS : B.GRASS2);
  // fields on either side, a dirt lane down the middle and round the threshing floor
  for (let z = 2; z < H - 3; z++) for (let x = 1; x < 5; x++) set(x, z, B.FIELD);
  for (let z = 2; z < H - 3; z++) for (let x = W - 5; x < W - 1; x++) set(x, z, B.FIELD);
  for (let z = 1; z < H; z++) { set(10, z, B.DIRT); set(11, z, B.DIRT); }
  for (let z = 7; z <= 10; z++) for (let x = 7; x <= 14; x++) set(x, z, B.DIRT);
  // a fence of trees round the edge, open at the south
  const props = [], doors = [], npcs = [];
  for (let x = 0; x < W; x++) { walk[x] = 0; if (x < 9 || x > 12) walk[(H - 1) * W + x] = 0; }
  for (let z = 0; z < H; z++) { walk[z * W] = 0; walk[z * W + W - 1] = 0; }
  for (let x = 0; x < W; x += 2) props.push({ kind: 'tree', x, z: 0, t: x % 4 ? 0 : 2 });
  const house = (id, x, z, w, d, door) => { for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) walk[zz * W + xx] = 0; props.push({ kind: 'house', x, z, w, d, h: 0.9, door: id === 'house' ? null : door, sign: BUILDINGS[id].sign, red: false, roofH: 0.7, straw: true }); if (id !== 'house') { doors.push({ id, x: x + door, z: z + d, n: id === 'inn' ? '農家（借宿）' : '雜貨鋪' }); set(x + door, z + d, B.DIRT); } };
  house('inn', 6, 2, 4, 3, 2); house('goods', 12, 2, 4, 3, 1); house('house', 6, 12, 3, 2); house('house', 13, 12, 3, 2);
  if (r() < 0.5) house('house', 16, 6, 3, 2);
  props.push({ kind: 'well', x: 10, z: 8 }); walk[8 * W + 10] = 0;
  for (let k = 0; k < 4; k++) { const x = 5 + Math.floor(r() * 12), z = 11 + Math.floor(r() * 4); if (walk[z * W + x] && top[z * W + x] <= 1) { props.push({ kind: 'tree', x, z, t: Math.floor(r() * 4) }); walk[z * W + x] = 0; } }
  const LINES = ['我們村子小，難得有貴客來。', '今年的收成還過得去。', '山裡的洞穴可別亂闖，裡面有吃人的東西。', '聽說城裡又在徵兵了……', '村口的老槐樹有三百歲了。', '要是能太平就好了。', '我家的雞今天下了兩個蛋！'];
  npcs.push({ x: 12, z: 9, look: LOOKS.villager('村長' + name), line: `我是${name}的村長。`, special: 'elder' });
  for (let k = 0; k < 4; k++) { let x, z; do { x = 5 + Math.floor(r() * 12); z = 6 + Math.floor(r() * 9); } while (!walk[z * W + x]); npcs.push({ x, z, look: LOOKS.villager(name + k), line: LINES[Math.floor(r() * LINES.length)], wander: true }); }
  const tile = (x, z) => { if (x < 0 || z < 0 || x >= W || z >= H) return null; const i = z * W + x; return { top: top[i], side: 15, h: hgt[i] }; };
  return { W, H, tile, walkable: (x, z) => x >= 0 && z >= 0 && x < W && z < H && walk[z * W + x] === 1, props, doors, npcs, spawn: [10, H - 2], gate: { x0: 9, x1: 12, z: H - 1 }, sky: '#a8d0f0', fogNear: 26, fogFar: 60 };
}

// ---------------------------------------------------------------- a cave: passages carved by wandering diggers from the mouth to a deep
// chamber where its master waits; chests in the dead ends and side rooms, torches on the walls, and one or two strange
// things (a hermit, an old stele, a spring, a skeleton with a letter). The cave is the same every time it is entered.
export function buildCave(place) {
  const W = 34, H = 34, r = (() => { let a = hash(place.name + place.x) || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; })();
  const open = new Uint8Array(W * H), at = (x, z) => x > 0 && z > 0 && x < W - 1 && z < H - 2 && open[z * W + x];
  const dig = (x, z) => { if (x > 0 && z > 0 && x < W - 1 && z < H - 1) open[z * W + x] = 1; };
  // the main way, from the mouth at the bottom to the deep chamber at the top, wandering
  let x = 17, z = H - 2; const main = [];
  dig(x, z); dig(x - 1, z); dig(x + 1, z);
  while (z > 4) { const v = r(); if (v < 0.45) z--; else if (v < 0.72) x = Math.max(3, x - 1); else x = Math.min(W - 4, x + 1); dig(x, z); dig(x + 1, z); dig(x - 1, z); if (r() < 0.4) dig(x, z - 1); main.push([x, z]); }
  const boss = [x, Math.max(3, z - 1)];
  for (let dz = -2; dz <= 2; dz++) for (let dx = -3; dx <= 3; dx++) dig(boss[0] + dx, boss[1] + dz);
  // side passages ending in rooms
  const rooms = [];
  for (let k = 0; k < 6; k++) {
    let [sx, sz] = main[Math.floor(r() * main.length)], dir = r() < 0.5 ? -1 : 1; const len = 4 + Math.floor(r() * 7);
    for (let i = 0; i < len; i++) { sx += r() < 0.7 ? dir : 0; sz += r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0; sx = Math.max(2, Math.min(W - 3, sx)); sz = Math.max(3, Math.min(H - 4, sz)); dig(sx, sz); }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) dig(sx + dx, sz + dz);
    rooms.push([sx, sz]);
  }
  const props = [], npcs = [], chests = [];
  // chests in the rooms, the master in the deep chamber, strange things here and there
  rooms.forEach(([cx, cz], i) => { if (i < 4) chests.push({ x: cx, z: cz - 1, i }); });
  const ODD = ['hermit', 'stele', 'spring', 'bones', 'shrine'], odd = [];
  for (const [cx, cz] of rooms.slice(4)) odd.push({ x: cx, z: cz, kind: ODD[Math.floor(r() * ODD.length)] });
  if (r() < 0.6) { const [mx, mz] = main[Math.floor(main.length * (0.3 + r() * 0.4))]; if (at(mx + 1, mz)) odd.push({ x: mx + 1, z: mz, kind: ODD[Math.floor(r() * ODD.length)] }); }
  for (const c of chests) props.push({ kind: 'chest', x: c.x, z: c.z, chest: c.i });
  // torches along the main way
  main.forEach(([mx, mz], i) => { if (i % 6 === 3) { const tx = at(mx - 1, mz) ? mx + 2 : mx - 1; if (!at(tx, mz)) props.push({ kind: 'lantern', x: tx, z: mz, y: 0, wall: true }); } });
  const tile = (x, z) => { if (x < 0 || z < 0 || x >= W || z >= H) return null; const i = z * W + x; return open[i] ? { top: (x * 7 + z * 13) % 5 ? 2 : 6, side: 16, h: 0 } : { top: 16, side: 16, h: z >= H - 3 ? 0.4 : 0.85 + ((x * 5 + z * 3) % 3) * 0.12 }; }; // low walls, so the camera sees over them
  const solid = new Set([...chests.map((c) => c.z * W + c.x), ...odd.map((o) => o.z * W + o.x)]);
  return { W, H, tile, walkable: (x, z) => x >= 0 && z >= 0 && x < W && z < H && open[z * W + x] === 1 && !solid.has(z * W + x), props, doors: [], npcs, chests, odd, boss, spawn: [17, H - 2], gate: { x0: 16, x1: 18, z: H - 1 }, sky: '#140e0a', fog: '#140e0a', fogNear: 20, fogFar: 38, dark: true, cave: true };
}
