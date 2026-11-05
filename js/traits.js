// 特性 in play: who has which two (the famous by hand, everyone else by their abilities and a roll that is the same in
// every game), what they add up to for a party — resonance, synergy, named combinations alone or across two members —
// and awakening at levels 20 and 40. The numbers go into the same powers the treasures use (relics.js relicFx merges
// them), so battles, the map and the shops read them without knowing where they came from.
import { TRAITS, TRAIT, SCHOOLS, RESONANCE, SYNERGY, COMBOS, FAMOUS, EXTRA, fxText } from './data/traits.js';
import { POWERS, RELICS } from './data/relics.js';

export { TRAITS, TRAIT, SCHOOLS, COMBOS };
const STATS = ['lead', 'war', 'int', 'pol', 'cha'];
// a roll that depends only on the general (so a save, a reload and a new game all agree)
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed) => { let a = seed || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; };
// how much each school suits a general
function leanings(g) {
  const s = (v) => Math.max(1, v - 35) ** 2;
  return { 勇: s(g.war), 騎: s(g.war * 0.6 + g.lead * 0.4) * 0.8, 弓: s(g.war * 0.6 + g.int * 0.3) * 0.6, 水: s((g.lead + g.int) / 2) * 0.35, 守: s(g.lead) * 0.8,
    謀: s(g.int), 火: s(g.int) * 0.45, 仁: s(g.cha * 0.6 + g.pol * 0.4) * 0.7, 速: s(g.war) * 0.55, 統: s(g.lead), 奇: s(g.int) * (g.spells?.length ? 0.9 : 0.25),
    政: s(g.pol), 魅: s(g.cha) * 0.8, 遊: (g.status === 'free' ? 900 : 300), 運: 400 };
}
function rollTraits(g) {
  const r = rnd(hash(g.name + '|' + g.id)), lean = leanings(g), top = Math.max(g.lead, g.war, g.int, g.pol, g.cha), out = [];
  const pickSchool = () => { let t = 0; for (const k in lean) t += lean[k]; let x = r() * t; for (const k in lean) { x -= lean[k]; if (x < 0) return k; } return '運'; };
  for (let i = 0; i < 2; i++) {
    const legend = top >= 92 && r() < 0.12, rare = legend || r() < 0.18 + Math.max(0, top - 75) / 60;
    for (let k = 0; k < 20; k++) {
      const sc = pickSchool(), rr = legend ? 3 : rare ? 2 : 1, pool = TRAITS.filter((t) => t.s[0] === sc && t.r === rr && !out.includes(t.n));
      const p = pool.length ? pool : TRAITS.filter((t) => t.s.includes(sc) && t.r <= rr && !out.includes(t.n));
      if (p.length) { out.push(p[Math.floor(r() * p.length)].n); break; }
    }
  }
  while (out.length < 2) out.push(['猛將', '謀士'].find((n) => !out.includes(n)));
  return out;
}
// a general's two traits (given the first time they are asked for)
export function traitsOf(g) { if (!g) return []; if (!g.traits || g.traits.length < 2) g.traits = FAMOUS[g.name] ? [...FAMOUS[g.name]] : rollTraits(g); return g.traits; }
export const schoolsOf = (g) => new Set(traitsOf(g).flatMap((n) => TRAIT[n]?.s || []));

// ---------------------------------------------------------------- adding them up
const add = (o, fx, m = 1) => { for (const [k, v] of Object.entries(fx)) { if (POWERS[k] && POWERS[k][1][0] === 1 && POWERS[k][1][4] === 1) o[k] = 1; else o[k] = (o[k] || 0) + v * m; } };
const comboOf = (a, b) => COMBOS.find((c) => (c[0] === a && c[1] === b) || (c[0] === b && c[1] === a));
// for each general of a group (a party, or the generals of an enemy army): { fx, act: [{ kind, n, d }] }
// worn: optional map id -> the treasures they wear (a school treasure strengthens the traits of its school)
export function groupTraits(gens, worn = {}) {
  const out = new Map();
  gens.forEach((g, i) => {
    const [a, b] = traitsOf(g).map((n) => TRAIT[n]), fx = {}, act = [];
    if (!a || !b) { out.set(g.id, { fx, act }); return; }
    const shared = a.s.find((s) => b.s.includes(s)), boost = {};
    for (const e of worn[g.id] || []) { const R = RELICS[e.id]; if (R?.school) boost[R.school] = (boost[R.school] || 0) + 0.08 * R.grade; }
    for (const t of [a, b]) add(fx, t.fx, (shared ? 1.5 : 1) * (1 + Math.max(0, ...t.s.map((s) => boost[s] || 0))));
    if (shared) { add(fx, RESONANCE[shared][1]); act.push({ kind: '共鳴', n: RESONANCE[shared][0], d: `兩個${shared}系特性` }); }
    const mine = new Set([...a.s, ...b.s]);
    for (const [x, y, n, sfx, d] of SYNERGY) if ((a.s.includes(x) && b.s.includes(y)) || (a.s.includes(y) && b.s.includes(x))) { add(fx, sfx); act.push({ kind: '相生', n, d }); }
    const own = comboOf(a.n, b.n); if (own) { add(fx, own[3]); act.push({ kind: '絕技', n: own[2], d: `${a.n}＋${b.n}` }); }
    // with the others: named pairs across two members (合擊), and synergy with the one beside (相生)
    gens.forEach((m, j) => {
      if (j === i) return; const [c, d] = traitsOf(m).map((n) => TRAIT[n]); if (!c || !d) return;
      for (const x of [a, b]) for (const y of [c, d]) { const k = comboOf(x.n, y.n); if (k && !(own && own === k)) { add(fx, k[3]); act.push({ kind: '合擊', n: k[2], d: `${x.n}＋${m.name}的${y.n}`, with: m.id }); } }
      if (Math.abs(j - i) === 1) { const theirs = new Set([...c.s, ...d.s]); for (const [x, y, n, sfx, dd] of SYNERGY) if ((mine.has(x) && theirs.has(y) && !mine.has(y)) || (mine.has(y) && theirs.has(x) && !mine.has(x))) { add(fx, sfx, 0.5); act.push({ kind: '相生', n, d: `和${m.name}（效果減半）`, with: m.id }); break; } }
    });
    for (const k of ['startRouse', 'spRegen', 'spd', 'lead', 'war', 'int', 'pol', 'cha']) if (fx[k]) fx[k] = Math.round(fx[k]);
    out.set(g.id, { fx, act });
  });
  return out;
}
// the party's traits, kept for relicFx: rec -> fx (relics.js reads TF)
export const TF = new WeakMap();
let lastKey = '';
export function syncParty(game) {
  const H = game.H, G = game.G; if (!H || !G) return null;
  const ids = [H.pid, ...H.party], key = ids.join(',') + '|' + ids.map((id) => (G.gens[id].traits || []).join('+') + ':' + JSON.stringify(H.rec[id]?.eq || {})).join(';');
  if (key === lastKey && game._traits && ids.every((id) => !H.rec[id] || TF.has(H.rec[id]))) return game._traits; // (a loaded game has new records)
  lastKey = key;
  const worn = {}; for (const id of ids) worn[id] = Object.values(H.rec[id]?.eq || {}).filter((e) => e && typeof e === 'object' && e.id);
  const res = groupTraits(ids.map((id) => G.gens[id]), worn);
  for (const id of ids) if (H.rec[id]) TF.set(H.rec[id], res.get(id).fx);
  game._traits = res; return res;
}
export const resetTraits = () => { lastKey = ''; };
// the lines a battle opens with: every combination in play on a side
export function comboLines(res, gens, side) {
  const seen = new Set(), out = [];
  for (const g of gens) for (const a of res.get(g.id)?.act || []) { if (a.kind === '相生' || a.kind === '共鳴') continue; const k = a.kind + a.n; if (seen.has(k)) continue; seen.add(k); out.push(`${side}${a.kind === '合擊' ? '合擊' : `${g.name}的絕技`}「${a.n}」！`); }
  return out;
}
// ---------------------------------------------------------------- showing them
export const chip = (s) => `<span class="sch" style="background:${SCHOOLS[s][1]}">${s}</span>`;
const R_C = ['', '#e8e0d0', '#6ab0ff', '#ffc84a'];
export function traitHTML(n, full = true) {
  const t = TRAIT[n]; if (!t) return '';
  return `<span class="trait r${t.r}"><b style="color:${R_C[t.r]}">${t.n}</b>${t.s.map(chip).join('')}${full ? `<small>${Object.entries(t.fx).map(([k, v]) => fxText(POWERS, k, v)).join('、')}</small>` : ''}</span>`;
}
export function actHTML(act) { return act.length ? `<div class="acts">${act.map((a) => `<span class="act ${a.kind === '絕技' || a.kind === '合擊' ? 'big' : ''}">${a.kind}「${a.n}」<small>${a.d}</small></span>`).join('')}</div>` : ''; }
// who in the party a general would make a named combination with
export function combosWith(G, x, party) {
  const out = [], [a, b] = traitsOf(x);
  for (const g of party) { if (g.id === x.id) continue; for (const p of traitsOf(g)) for (const q of [a, b]) { const c = comboOf(p, q); if (c) out.push({ g, n: c[2] }); } }
  const own = comboOf(a, b); return { own: own ? own[2] : null, with: out };
}
export const fxLine = (fx) => Object.entries(fx).filter(([, v]) => v).map(([k, v]) => fxText(POWERS, k, v)).join('、');
// ---------------------------------------------------------------- awakening: at 20 and 40 a common trait becomes a rare one of its school
export function awaken(g, rec, lv) {
  const mark = lv >= 40 ? 2 : lv >= 20 ? 1 : 0; rec.awoke ||= 0; if (mark <= rec.awoke) return null;
  rec.awoke = mark; const ts = traitsOf(g), want = mark === 2 ? 3 : 2;
  if (comboOf(ts[0], ts[1])) return null;                 // a combination of one's own is kept as it is
  const i = ts.findIndex((n) => TRAIT[n].r < want); if (i < 0) return null;
  const old = TRAIT[ts[i]], r = rnd(hash(g.name + lv)), pool = TRAITS.filter((t) => t.r === want && t.s.includes(old.s[0]) && !ts.includes(t.n));
  const p = pool.length ? pool : TRAITS.filter((t) => t.r === want && t.s.some((s) => old.s.includes(s)) && !ts.includes(t.n)); if (!p.length) return null;
  const nu = p[Math.floor(r() * p.length)].n; ts[i] = nu; resetTraits(); return { old: old.n, nu };
}
// a trait taught (by an event, a sage, a book): it replaces the weaker one
export function learnTrait(g, n, i) {
  const ts = traitsOf(g); if (ts.includes(n) || !TRAIT[n]) return null;
  if (i == null) i = TRAIT[ts[0]].r <= TRAIT[ts[1]].r ? 0 : 1;
  const old = ts[i]; ts[i] = n; resetTraits(); return old;
}
// 洗髓丹: one trait drawn again (never a legend, never the same)
export function reroll(g, i) {
  const ts = traitsOf(g), r = Math.random, cur = TRAIT[ts[i]], lean = leanings(g);
  let t = 0; for (const k in lean) t += lean[k]; let x = r() * t, sc = '運'; for (const k in lean) { x -= lean[k]; if (x < 0) { sc = k; break; } }
  const rr = r() < 0.3 ? 2 : 1, pool = TRAITS.filter((q) => q.s.includes(sc) && q.r <= Math.max(rr, Math.min(2, cur.r)) && !ts.includes(q.n));
  const nu = pool[Math.floor(r() * pool.length)]?.n; if (!nu) return null; const old = ts[i]; ts[i] = nu; resetTraits(); return { old, nu };
}
export { EXTRA };
