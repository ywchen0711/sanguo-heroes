// The land of the Han: a 450x450 tile map drawn from the 45 cities of the simulation (map units x4.5; it was 200x200,
// x2: five times the land now, so the cities, the people on the roads and the places between are not crowded). The coast, the
// Bohai gulf, the Yellow River and the Yangtze, the Qinling and Taihang ranges, the Sichuan basin ringed by mountains,
// the north-western desert and the southern forests; roads between the cities are found with A* and cross rivers on
// bridges and mountains through passes.
import { CITIES, ROADS } from './data/world.js';

export const W = 450, H = 450, SCALE = 4.5;
// how much further everything is than on the old 200x200 map (for distances given in tiles elsewhere)
export const K = SCALE / 2;
export const T = { SEA: 0, RIVER: 1, PLAIN: 2, MEADOW: 3, FOREST: 4, HILL: 5, MOUNT: 6, SNOW: 7, DESERT: 8, ROAD: 9, BRIDGE: 10, CITY: 11, BEACH: 12, MARSH: 13, FIELD: 14, COUNTY: 15, VILLAGE: 16, CAVE: 17 };
// height of the ground, whether you can walk on it, and the chance a step brings a fight
export const HEIGHT = { 0: -0.45, 1: -0.4, 2: 0, 3: 0, 4: 0.05, 5: 0.5, 6: 1.3, 7: 2.0, 8: 0, 9: 0.02, 10: 0.08, 11: 0.04, 12: -0.05, 13: -0.08, 14: 0, 15: 0.04, 16: 0.02, 17: 0.5 };
export const WALK = { 0: 0, 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0, 7: 0, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1 };
// (half what it was on the small map: a journey is twice and more as many steps, so about as many fights on the way)
export const ENC = { 2: 0.03, 3: 0.03, 4: 0.05, 5: 0.045, 8: 0.04, 9: 0.0075, 10: 0.005, 11: 0, 12: 0.02, 13: 0.045, 14: 0.015, 15: 0, 16: 0, 17: 0 };

// ---------------------------------------------------------------- noise
function hash2(x, y, s) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sm = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s), u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 2) * 0.15;
const lerpPts = (pts, v) => { for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const [a, A] = pts[i - 1], [b, B] = pts[i]; return A + (B - A) * (v - a) / (b - a); } return pts[pts.length - 1][1]; };
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
const lineDist = (x, y, pts) => { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, y, ...pts[i - 1], ...pts[i])); return d; };

// geography, in the simulation's 100x100 units
const EAST = [[0, 99], [8, 98], [14, 96], [20, 90], [30, 90], [38, 89], [44, 88], [50, 87], [56, 86], [62, 87], [66, 92], [72, 94], [80, 95], [86, 93], [92, 80], [100, 70]];
const SOUTH = [[0, 101], [28, 101], [36, 99.5], [44, 96.5], [55, 95], [70, 93], [85, 89], [100, 82]];
const YELLOW = [[2, 36], [12, 33], [20, 33], [27, 27], [33, 18], [40, 13], [45, 14], [47, 22], [46, 31], [45, 38], [50, 38.5], [56, 37], [63, 34.5], [69, 30], [74, 29], [80, 27]];
const YANGTZE = [[4, 80], [10, 78], [17, 77.5], [25, 79.5], [30, 76], [33, 73], [38, 76.5], [44, 77], [49, 75], [53, 72.8], [58, 72.5], [62, 73], [66, 71], [71, 67.5], [76, 64.5], [84, 61], [92, 60.5], [100, 60]];
const HAN = [[27, 57], [33, 59], [38, 61], [43, 64], [47, 65.5], [51, 68], [54, 71]];
const RIDGES = [ // [points, half width, strength]: mountain chains
  [[[8, 50], [18, 49], [28, 48.5], [36, 49], [43, 50]], 3.2, 1],          // Qinling, between Chang'an and Hanzhong
  [[[55, 12], [56, 20], [55.5, 28], [54, 34]], 2.2, 0.85],                  // Taihang
  [[[10, 58], [16, 60], [24, 60], [30, 62], [32, 66]], 2.6, 0.9],           // the northern rim of Sichuan
  [[[6, 64], [7, 74], [8, 82]], 2.5, 0.9],                                  // the western rim
  [[[28, 66], [30, 70], [33, 76], [35, 82]], 2.0, 0.75],                    // the gorges east of Sichuan
  [[[44, 84], [52, 86], [60, 86], [68, 84]], 2.4, 0.7],                     // the Nanling
  [[[2, 18], [10, 20], [18, 22]], 3, 0.9],                                  // the Qilian, south of Wuwei
  [[[60, 6], [70, 5], [82, 4]], 2.5, 0.6],                                  // the hills north of the plain
];

// each ridge with the box round its points (most tiles are far from any: no need to measure)
const box = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
const RIDGES_BB = RIDGES.map(([pts, w, s]) => [pts, w, s, box(pts)]);

const cityAt = CITIES.map(([name, x, y, size], id) => ({ id, name, x: Math.round(x * SCALE), y: Math.round(y * SCALE), size }));
export const CITY_POS = cityAt;

export function buildWorld(seed = 7) {
  const t = new Uint8Array(W * H), hgt = new Float32Array(W * H), cityOf = new Int16Array(W * H).fill(-1), deco = new Uint8Array(W * H);
  const id = (x, y) => y * W + x;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / SCALE, v = y / SCALE, n = fbm(u / 9, v / 9, seed);
    let k = T.PLAIN;
    // sea: east of the coast, south of the south coast, and the Bohai gulf
    const coast = lerpPts(EAST, v) + (n - 0.5) * 3, scoast = lerpPts(SOUTH, u) + (n - 0.5) * 2.5;
    const bohai = ((u - 83) / 8) ** 2 + ((v - 21) / 6.5) ** 2 < 1 + (n - 0.5) * 0.4 || ((u - 89) / 6) ** 2 + ((v - 15) / 4) ** 2 < 1;
    if (u > coast || v > scoast || bohai) k = T.SEA;
    else if (u > coast - 1.2 || v > scoast - 1 || ((u - 83) / 9.2) ** 2 + ((v - 21) / 7.5) ** 2 < 1) k = T.BEACH;
    else {
      // mountains: the ridges, the high west, and noise
      let m = 0;
      for (const [pts, w, s, bb] of RIDGES_BB) { if (u < bb[0] - w * 1.8 || u > bb[2] + w * 1.8 || v < bb[1] - w * 1.8 || v > bb[3] + w * 1.8) continue; const d = lineDist(u, v, pts); if (d < w * 1.8) m = Math.max(m, s * (1 - d / (w * 1.8)) + (n - 0.5) * 0.5); }
      if (u < 12 && v > 30 && v < 60) m = Math.max(m, (12 - u) / 10 + (n - 0.5) * 0.4);         // the Tibetan edge
      if (u < 10 && v > 84) m = Math.max(m, 0.45 + (n - 0.5) * 0.6);
      const sichuan = ((u - 17) / 9) ** 2 + ((v - 71) / 9) ** 2 < 1;                           // the basin itself is flat
      if (sichuan) m *= 0.25;
      if (m > 0.78) k = m > 1.05 && v < 60 ? T.SNOW : T.MOUNT; else if (m > 0.5) k = T.HILL;
      else if (u < 26 && v < 36 && n > 0.42) k = T.DESERT;                                       // the north-west
      else if (v < 7 && n > 0.5) k = T.DESERT;
      else if (v > 62 && n > 0.58 || (u < 30 && v > 55 && n > 0.62) || n > 0.72) k = T.FOREST;    // the wooded south
      else if (v > 74 && n < 0.3 && u > 50) k = T.MARSH;
      else k = n > 0.5 ? T.MEADOW : T.PLAIN;
    }
    t[id(x, y)] = k;
  }
  // rivers, two tiles wide where they are big
  // (only the tiles in the box round each stretch of a river are measured)
  for (const [pts, w0] of [[YELLOW, 0.75], [YANGTZE, 0.85], [HAN, 0.45]]) { const w = w0 * 2.6 / SCALE; for (let s = 1; s < pts.length; s++) {
    const [ax, ay] = pts[s - 1], [bx, by] = pts[s], x0 = Math.max(0, Math.floor((Math.min(ax, bx) - w) * SCALE)), x1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + w) * SCALE)), y0 = Math.max(0, Math.floor((Math.min(ay, by) - w) * SCALE)), y1 = Math.min(H - 1, Math.ceil((Math.max(ay, by) + w) * SCALE));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = id(x, y); if (t[i] === T.SEA) continue; if (segDist(x / SCALE, y / SCALE, ax, ay, bx, by) < w) t[i] = T.RIVER; }
  } }
  // around each city: flat land, farm fields, the city itself (3x3, or 5x5 for a big one)
  for (const c of cityAt) {
    const R = c.size >= 3 ? 2 : 1;
    for (let dy = -R - 3; dy <= R + 3; dy++) for (let dx = -R - 3; dx <= R + 3; dx++) {
      const x = c.x + dx, y = c.y + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = id(x, y), d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d <= R) { t[i] = T.CITY; cityOf[i] = c.id; }
      else if (t[i] === T.SEA) continue;
      else if (d <= R + 1) t[i] = t[i] === T.RIVER ? T.RIVER : T.PLAIN;
      else if ([T.MOUNT, T.SNOW, T.HILL, T.FOREST, T.DESERT, T.MARSH].includes(t[i]) && d <= R + 2) t[i] = T.PLAIN;
      else if (d <= R + 3 && (t[i] === T.PLAIN || t[i] === T.MEADOW) && hash2(x, y, 3) < 0.45) t[i] = T.FIELD;
    }
  }
  // roads: A* from city to city, cheap on plain, dear across rivers (they become bridges) and mountains (passes)
  const cost = (k) => ({ 0: 0, 1: 9, 2: 1, 3: 1, 4: 1.6, 5: 2.5, 6: 7, 7: 12, 8: 1.4, 9: 0.5, 10: 0.6, 11: 0.4, 12: 1.2, 13: 2, 14: 1 })[k];
  const byName = Object.fromEntries(cityAt.map((c) => [c.name, c]));
  const roads = [];
  for (const pair of ROADS.split(/\s+/).filter(Boolean)) {
    const [a, b] = pair.split('-').map((n) => byName[n]);
    const path = astar(t, a, b, cost); if (!path) continue;
    roads.push([a.id, b.id, path]);
    // a diagonal step gets a corner tile too, so the road can be walked in four directions
    const full = []; let prev = a.y * W + a.x;
    for (const i of path) { const px = prev % W, py = (prev - px) / W, x = i % W, y = (i - x) / W; if (px !== x && py !== y) full.push(py * W + x); full.push(i); prev = i; }
    for (const i of full) { const k = t[i]; if (k === T.CITY) continue; t[i] = k === T.RIVER ? T.BRIDGE : k === T.SEA ? T.BRIDGE : T.ROAD; if (k === T.MOUNT || k === T.SNOW || k === T.HILL) hgt[i] = k === T.HILL ? 0.25 : 0.35; }
  }
  // heights, with a little noise on hills and mountains
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = id(x, y), k = t[i];
    if (hgt[i]) continue;
    let h = HEIGHT[k];
    if (k === T.MOUNT) h += Math.floor(fbm(x / 3, y / 3, seed + 5) * 4) * 0.35;
    if (k === T.SNOW) h += Math.floor(fbm(x / 3, y / 3, seed + 5) * 3) * 0.4;
    if (k === T.HILL) h += hash2(x, y, 9) < 0.3 ? 0.2 : 0;
    hgt[i] = h;
  }
  // scenery on the tiles: trees in forests, now and then on grass; rocks on hills
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = id(x, y), k = t[i], v = hash2(x, y, 11);
    if (k === T.FOREST) deco[i] = v < 0.85 ? 1 + Math.floor(v * 3.5) : 0;
    else if ((k === T.PLAIN || k === T.MEADOW) && v < 0.035) deco[i] = 1 + Math.floor(v * 100) % 3;
    else if (k === T.HILL && v < 0.12) deco[i] = 5;
    else if (k === T.MARSH && v < 0.3) deco[i] = 2;
  }
  const places = placePlaces(t, hgt, deco, seed);
  return { t, hgt, cityOf, deco, roads, places, placeAt: (x, y) => places.find((q) => q.x === x && q.y === y) || null, W, H, at: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? T.SEA : t[id(x, y)]), hAt: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -0.45 : hgt[id(x, y)]), cityAt: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : cityOf[id(x, y)]) };
}

// A* on the tile grid (8 directions), with a heap in typed arrays (the land is big: no arrays of pairs) and each
// tile settled once
function astar(t, a, b, cost) {
  const N = W * H, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), start = a.y * W + a.x, goal = b.y * W + b.x;
  let hf = new Float32Array(1 << 16), hi = new Int32Array(1 << 16), n = 0;
  const push = (i, f) => {
    if (n === hf.length) { const f2 = new Float32Array(n * 2), i2 = new Int32Array(n * 2); f2.set(hf); i2.set(hi); hf = f2; hi = i2; }
    let k = n++; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; hf[k] = hf[p]; hi[k] = hi[p]; k = p; } hf[k] = f; hi[k] = i;
  };
  const pop = () => {
    const top = hi[0], lf = hf[--n], li = hi[n]; let k = 0;
    for (;;) { const l = 2 * k + 1, r = l + 1; if (l >= n) break; const m = r < n && hf[r] < hf[l] ? r : l; if (hf[m] >= lf) break; hf[k] = hf[m]; hi[k] = hi[m]; k = m; }
    hf[k] = lf; hi[k] = li; return top;
  };
  g[start] = 0; push(start, 0);
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.45], [1, -1, 1.45], [-1, 1, 1.45], [-1, -1, 1.45]];
  while (n) {
    const i = pop(); if (done[i]) continue; done[i] = 1; if (i === goal) break;
    const x = i % W, y = (i - x) / W;
    for (const [dx, dy, m] of D) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (done[j]) continue; const c = cost(t[j]); if (!c) continue;
      if (dx && dy && (!cost(t[y * W + nx]) || !cost(t[ny * W + x]))) continue;
      const ng = g[i] + c * m; if (ng >= g[j]) continue;
      g[j] = ng; from[j] = i; push(j, ng + Math.hypot(nx - b.x, ny - b.y) * 0.8);
    }
  }
  if (from[goal] < 0) return null;
  const path = []; for (let i = goal; i !== start; i = from[i]) path.push(i);
  return path.reverse();
}

// which part of the land a tile is in (for the kind of trouble met on the road)
export function regionAt(x, y) {
  const u = x / SCALE, v = y / SCALE;
  if (u < 30 && v < 45) return 'west';
  if (v < 22) return 'north';
  if (v > 82 || (u < 20 && v > 78)) return 'south';
  if (u > 76 && v > 55) return 'coast';
  return 'central';
}

// ---------------------------------------------------------------- counties, villages and caves
// Counties are real Han counties, put near where they were (in the simulation's 100x100 units); villages are scattered
// over the farmland; caves open in the hills at the foot of the mountains. None of them is part of the simulation:
// each belongs to whoever holds the nearest city.
const COUNTIES = [['涿縣', 68, 18], ['易京', 65, 21], ['鉅鹿', 64, 31], ['廣宗', 67, 34], ['邯鄲', 58, 32], ['白馬', 63, 39], ['官渡', 57, 45], ['虎牢', 54, 43],
  ['滎陽', 55, 47], ['潁川', 54, 52], ['博望', 52, 59], ['樊城', 47, 64], ['麥城', 48, 70], ['當陽', 44, 70], ['夷陵', 38, 72], ['涪城', 19, 66], ['雒城', 17, 67],
  ['劍閣', 22, 59], ['陽平關', 23, 51], ['街亭', 23, 38], ['祁山', 17, 46], ['陳倉', 28, 45], ['五丈原', 31, 47], ['潼關', 38, 41], ['河內', 55, 37], ['上黨', 55, 25],
  ['雁門', 48, 12], ['漁陽', 75, 13], ['柳城', 86, 7], ['臨淄', 80, 31], ['琅邪', 85, 40], ['廣陵', 82, 54], ['曲阿', 85, 61], ['丹陽', 78, 66], ['鄱陽', 70, 72],
  ['豫章', 63, 79], ['合肥', 74, 63], ['皖城', 67, 63], ['濡須', 77, 61], ['夏口', 59, 67], ['赤壁', 53, 74], ['華容', 49, 75], ['公安', 44, 77], ['益陽', 49, 81],
  ['臨沅', 41, 83], ['牂牁', 22, 84], ['越嶲', 10, 79], ['武都', 21, 49], ['金城', 14, 33], ['西平', 8, 36], ['臨洮', 15, 38], ['平陽', 46, 27], ['九原', 44, 7]];
const VNAME = ['杏花村', '桃花塢', '柳樹屯', '白石村', '黃泥崗', '石橋鎮', '青龍集', '臥牛村', '清水灣', '落鳳坡', '老鴉嶺', '八里莊', '十里鋪', '雙溪村', '梅花村', '牛家莊', '張家村', '李家屯', '王家集', '趙家堡', '劉家莊', '陳家村', '孫家屯', '周家集', '吳家村', '鄭家莊', '馮家堡', '褚家村', '衛家集', '蔣家莊', '沈家村', '韓家屯', '楊家莊', '朱家集', '秦家村', '許家堡', '何家莊', '呂家村', '施家屯', '孔家集', '曹家莊', '嚴家村', '華家堡', '金家莊', '魏家村', '陶家屯', '姜家集', '謝家村', '鄒家莊', '喻家堡', '蘇家村', '潘家屯', '葛家集', '范家莊', '彭家村', '魯家堡', '馬家屯', '苗家集', '鳳家村', '方家莊', '俞家村', '任家屯', '袁家集', '柳家莊', '鮑家村'];
const CNAME = ['黑風洞', '臥龍洞', '水簾洞', '白骨洞', '盤蛇洞', '藏兵洞', '仙人洞', '青牛洞', '蝙蝠洞', '火雲洞', '冰魄洞', '古墓穴', '黃巾密窟', '熊王洞', '虎嘯洞', '鬼哭洞', '百寶洞', '天書洞', '雷音洞', '幽冥洞', '玉泉洞', '金蠶洞', '飛狐洞', '千佛洞', '赤焰洞', '寒潭洞', '狼牙洞', '迷魂洞'];
// the deeper places (three to five stars): more caves in the hills, and 地洞 (sinkholes and old underground halls)
// that open in the plains, the forests and the deserts
const CNAME2 = ['龍潭洞', '萬妖洞', '血池洞', '黑龍洞', '修羅洞', '九幽洞', '屍王洞', '天魔洞', '紫電洞', '玄冰洞', '焚天洞', '鎖龍洞', '盤古洞', '蚩尤洞', '餓鬼洞', '萬蛇洞', '絕情洞', '雷公洞', '白虎洞', '朱雀洞'];
const DNAME = ['無底地洞', '地底迷宮', '秦王地宮', '萬人坑', '黃泉地洞', '鬼王地宮', '地心古城', '殭屍地窟', '始皇陵道', '蟲巢地洞', '伏魔地宮', '幽冥地府'];
// past the list of village names: a family's farm, hamlet or market
const SURN = [...'孫周吳鄭馮衛蔣沈韓楊朱秦許何呂施孔曹嚴華金魏陶姜謝鄒喻柏竇章蘇潘葛范彭魯韋馬苗鳳花方俞任袁柳鮑史唐費廉岑薛雷賀倪湯殷羅畢郝安常樂于傅齊康伍余顧孟黃穆蕭尹姚邵汪祁毛狄米貝明臧計伏成戴宋龐熊紀舒屈項祝董梁杜阮藍閔席季麻賈路婁江童顏郭梅盛林鍾徐邱駱高夏蔡田樊胡凌霍虞萬支柯管盧莫房裘繆解應宗丁宣鄧郁單杭洪包左石崔吉龔程邢裴陸榮翁荀羊惠甄'], SUF = ['家莊', '家村', '家屯', '家集', '家堡', '家灣', '家寨', '家坪'];
const villageName = (n) => n < VNAME.length ? VNAME[n] : SURN[(n * 37) % SURN.length] + SUF[n % SUF.length];
const CNAME3 = [...'赤青玄白金銀鐵石風雲霧月星狼豹鷹蛟蟒狐鴉'].flatMap((a, i) => ['岩洞', '石窟', '山洞'].map((b, j) => [a + b, (i * 3 + j) * 7 % 60])).sort((p, q) => p[1] - q[1]).map((p) => p[0]);
function placePlaces(t, hgt, deco, seed) {
  const id = (x, y) => y * W + x, r = (() => { let a = (seed * 2654435761) >>> 0 || 7; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; })();
  // what can be reached on foot from the first city
  const seen = new Uint8Array(W * H), q = [id(cityAt[0].x, cityAt[0].y)]; seen[q[0]] = 1;
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = id(nx, ny); if (seen[j] || !WALK[t[j]]) continue; seen[j] = 1; q.push(j); } }
  const places = [], far = (x, y, dc, dp) => cityAt.every((c) => Math.hypot(c.x - x, c.y - y) >= dc) && places.every((p) => Math.hypot(p.x - x, p.y - y) >= dp);
  const nearCity = (x, y) => { let b = 0, d = 1e9; for (const c of cityAt) { const e = Math.hypot(c.x - x, c.y - y); if (e < d) { d = e; b = c.id; } } return b; };
  // the tile south of a place must be walkable too (that is where you come out)
  const ok = (x, y, kinds) => x > 1 && y > 1 && x < W - 2 && y < H - 2 && seen[id(x, y)] && kinds.includes(t[id(x, y)]) && WALK[t[id(x, y + 1)]] && t[id(x, y + 1)] < 15;
  const add = (kind, name, x, y, extra = {}) => { const k = id(x, y); t[k] = kind === 'county' ? T.COUNTY : kind === 'village' ? T.VILLAGE : T.CAVE; deco[k] = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 2]]) deco[id(x + dx, y + dy)] = 0; places.push({ id: places.length, kind, name, x, y, near: nearCity(x, y), ...extra }); };
  const land = [T.PLAIN, T.MEADOW, T.FIELD, T.FOREST, T.DESERT, T.HILL, T.ROAD];
  for (const [name, u, v] of COUNTIES) {
    let best = null, bd = 1e9; const cx = Math.round(u * SCALE), cy = Math.round(v * SCALE);
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const x = cx + dx, y = cy + dy; if (!ok(x, y, land.filter((k) => k !== T.ROAD)) || !far(x, y, 6, 5)) continue; const d = dx * dx + dy * dy - (t[id(x, y + 1)] === T.ROAD || t[id(x - 1, y)] === T.ROAD || t[id(x + 1, y)] === T.ROAD ? 10 : 0); if (d < bd) { bd = d; best = [x, y]; } }
    if (best) add('county', name, ...best);
  }
  const used = new Set(places.map((q) => q.name));
  for (let k = 0, n = 0; k < 30000 && n < 180; k++) {
    const x = 3 + Math.floor(r() * (W - 6)), y = 3 + Math.floor(r() * (H - 6));
    if (!ok(x, y, [T.PLAIN, T.MEADOW, T.FIELD, T.FOREST, T.DESERT]) || !far(x, y, 9, 9)) continue;
    let nm = villageName(n); for (let j = 1; used.has(nm); j++) nm = villageName(n + j * 61); used.add(nm); add('village', nm, x, y); n++;
  }
  for (let k = 0, n = 0; k < 60000 && n < CNAME.length; k++) {
    const x = 3 + Math.floor(r() * (W - 6)), y = 3 + Math.floor(r() * (H - 6));
    if (!ok(x, y, [T.HILL]) || !far(x, y, 8, 7)) continue;
    const rocky = [[0, -1], [1, -1], [-1, -1], [0, -2]].some(([dx, dy]) => [T.MOUNT, T.SNOW].includes(t[id(x + dx, y + dy)]));
    if (!rocky) continue;
    add('cave', CNAME[n], x, y, { tier: 1 + Math.floor(r() * 3) }); n++;
  }
  // (added later, after everything else, so the places of an old game keep their numbers and their spots)
  const r2 = (() => { let a = (seed * 40503 + 977) >>> 0 || 9; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; })();
  const deepTier = () => { const v = r2(); return v < 0.35 ? 3 : v < 0.72 ? 4 : 5; };
  for (let k = 0, n = 0; k < 60000 && n < CNAME2.length; k++) {
    const x = 3 + Math.floor(r2() * (W - 6)), y = 3 + Math.floor(r2() * (H - 6));
    if (!ok(x, y, [T.HILL, T.FOREST, T.SNOW]) || !far(x, y, 6, 4)) continue;
    if (![[0, -1], [1, -1], [-1, -1], [0, -2], [-1, 0], [1, 0]].some(([dx, dy]) => [T.MOUNT, T.SNOW].includes(t[id(x + dx, y + dy)]))) continue;
    add('cave', CNAME2[n], x, y, { tier: deepTier() }); n++;
  }
  for (let k = 0, n = 0; k < 60000 && n < DNAME.length; k++) {
    const x = 3 + Math.floor(r2() * (W - 6)), y = 3 + Math.floor(r2() * (H - 6));
    if (!ok(x, y, [T.PLAIN, T.FOREST, T.DESERT, T.MEADOW]) || !far(x, y, 10, 8)) continue;
    add('cave', DNAME[n], x, y, { tier: r2() < 0.45 ? 4 : 5, deep: true }); n++;
  }
  // and more caves for the bigger land (one to three stars), named from their look
  const r3 = (() => { let a = (seed * 69069 + 4111) >>> 0 || 11; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; })();
  for (let k = 0, n = 0; k < 60000 && n < CNAME3.length; k++) {
    const x = 3 + Math.floor(r3() * (W - 6)), y = 3 + Math.floor(r3() * (H - 6));
    if (!ok(x, y, [T.HILL, T.FOREST]) || !far(x, y, 8, 7)) continue;
    if (![[0, -1], [1, -1], [-1, -1], [0, -2], [-1, 0], [1, 0]].some(([dx, dy]) => [T.MOUNT, T.SNOW, T.HILL].includes(t[id(x + dx, y + dy)]))) continue;
    add('cave', CNAME3[n], x, y, { tier: 1 + Math.floor(r3() * 3) }); n++;
  }
  return places;
}
