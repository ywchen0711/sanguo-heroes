// The land of the Han: a 200x200 tile map drawn from the 45 cities of the simulation (map units x2). The coast, the
// Bohai gulf, the Yellow River and the Yangtze, the Qinling and Taihang ranges, the Sichuan basin ringed by mountains,
// the north-western desert and the southern forests; roads between the cities are found with A* and cross rivers on
// bridges and mountains through passes.
import { CITIES, ROADS } from './data/world.js';

export const W = 200, H = 200, SCALE = 2;
export const T = { SEA: 0, RIVER: 1, PLAIN: 2, MEADOW: 3, FOREST: 4, HILL: 5, MOUNT: 6, SNOW: 7, DESERT: 8, ROAD: 9, BRIDGE: 10, CITY: 11, BEACH: 12, MARSH: 13, FIELD: 14 };
// height of the ground, whether you can walk on it, and the chance a step brings a fight
export const HEIGHT = { 0: -0.45, 1: -0.4, 2: 0, 3: 0, 4: 0.05, 5: 0.5, 6: 1.3, 7: 2.0, 8: 0, 9: 0.02, 10: 0.08, 11: 0.04, 12: -0.05, 13: -0.08, 14: 0 };
export const WALK = { 0: 0, 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0, 7: 0, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 };
export const ENC = { 2: 0.06, 3: 0.06, 4: 0.1, 5: 0.09, 8: 0.08, 9: 0.015, 10: 0.01, 11: 0, 12: 0.04, 13: 0.09, 14: 0.03 };

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
      for (const [pts, w, s] of RIDGES) { const d = lineDist(u, v, pts); if (d < w * 1.8) m = Math.max(m, s * (1 - d / (w * 1.8)) + (n - 0.5) * 0.5); }
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
  for (const [pts, w] of [[YELLOW, 0.75], [YANGTZE, 0.85], [HAN, 0.45]]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = id(x, y); if (t[i] === T.SEA) continue;
    if (lineDist(x / SCALE, y / SCALE, pts) < w) t[i] = T.RIVER;
  }
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
  return { t, hgt, cityOf, deco, roads, W, H, at: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? T.SEA : t[id(x, y)]), hAt: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -0.45 : hgt[id(x, y)]), cityAt: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : cityOf[id(x, y)]) };
}

// A* on the tile grid (8 directions)
function astar(t, a, b, cost) {
  const N = W * H, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), open = [], start = a.y * W + a.x, goal = b.y * W + b.x;
  const push = (i, f) => { open.push([f, i]); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (open[p][0] <= open[k][0]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
  g[start] = 0; push(start, 0);
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.45], [1, -1, 1.45], [-1, 1, 1.45], [-1, -1, 1.45]];
  while (open.length) {
    const [, i] = pop(); if (i === goal) break;
    const x = i % W, y = (i - x) / W;
    for (const [dx, dy, m] of D) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx, c = cost(t[j]); if (!c) continue;
      if (dx && dy && (!cost(t[y * W + nx]) || !cost(t[ny * W + x]))) continue;
      const ng = g[i] + c * m; if (ng >= g[j]) continue;
      g[j] = ng; from[j] = i; push(j, ng + Math.hypot(nx - b.x, ny - b.y) * 0.5);
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
