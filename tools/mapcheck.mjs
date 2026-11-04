import { buildWorld, W, H, T, WALK, CITY_POS } from '../js/world.js';
const t0 = Date.now(); const M = buildWorld(); console.log('built in', Date.now() - t0, 'ms');
// flood fill from the first city over walkable tiles
const seen = new Uint8Array(W * H), q = [CITY_POS[0].y * W + CITY_POS[0].x]; seen[q[0]] = 1;
for (let k = 0; k < q.length; k++) { const i = q[k], x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (seen[j] || !WALK[M.t[j]]) continue; seen[j] = 1; q.push(j); } }
const bad = CITY_POS.filter(c => !seen[c.y * W + c.x]).map(c => c.name); console.log('unreachable cities:', bad.join(' ') || 'none', '| roads', M.roads.length);
const ch = { 0: '~', 1: '=', 2: '.', 3: ',', 4: 'T', 5: 'n', 6: 'M', 7: 'A', 8: ':', 9: '#', 10: 'H', 11: 'C', 12: '_', 13: '%', 14: 'f' };
for (let y = 0; y < H; y += 3) { let s = ''; for (let x = 0; x < W; x += 2) s += ch[M.t[y * W + x]]; console.log(s); }
