// The simulation: a world of cities, warlords and 500 generals that runs on its own, one month at a time.
// No DOM here, so it runs the same in the browser and in node (tools/test.mjs, tools/sim.mjs).
//
//   const G = newGame({ seed, start: 190 });  step(G);  // one month
//   G.log: the chronicle   G.cities / G.factions / G.gens: the world   G.over: the winner once China is unified
//
// Playing a warlord: newGame({ player: 'caocao' }). That faction's generals then bring some of their plans to the lord as
// proposals (G.pending) instead of acting on their own: a few domestic jobs each month, every attack, every diplomatic move,
// treasures to hand out and captives to judge. decide(G, yes, choice) answers the first one; autoDecide(G) answers whatever
// G.auto allows (mode 'manual' | 'smart' | 'all', askWar). Unanswered proposals lapse when the next month begins.
import { GENERALS_RAW } from '../data/generals.js';
import { CITIES, ROADS } from '../data/world.js';
import { PREFER } from '../data/allegiance.js';
import { SCEN } from '../data/scenarios.js';
import { ITEMS, SPELL_HOLDERS, HIDDEN } from '../data/treasures.js';
import { lifeMonth, lifeBattle, note } from './life.js';
import { rivalsMonth } from './rivals.js';

// Sanguo Heroes: the player's general (isPlayer) and the companions who travel with them (follow = the player's id) are
// moved by the player, not by the simulation: they take no monthly job, are not sent to war or moved about, and are
// never caught in a siege. The game drives them through the exported helpers at the bottom.
export const busy = (g) => !!(g && (g.isPlayer || g.follow != null));

// ---------------------------------------------------------------- random numbers (seeded, so a game can be replayed)
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, a) => a[Math.floor(r() * a.length)];
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const maxBy = (a, f) => a.reduce((b, x) => (b === null || f(x) > f(b) ? x : b), null);

export const STAT = ['lead', 'war', 'int', 'pol', 'cha'];
export const date = (G) => `${G.year}年${G.month}月`;

// ---------------------------------------------------------------- a new world
export function newGame(o = {}) {
  const seed = (o.seed ?? (Date.now() & 0x7fffffff)) >>> 0, r = rng(seed), S = SCEN[o.scenario] || SCEN['190'], start = S.year;
  const G = { seed, r, scenario: S.id, start, year: start, month: 1, t: 0, log: [], over: null, history: [], nextFac: 1, opts: { lifespan: o.lifespan || 'history' }, carry: S.carry || {}, items: [] };
  // cities and roads
  G.cities = CITIES.map(([name, x, y, size], id) => {
    const pop = Math.round((40 + size * 70 + r() * 40) * 1000);
    return { id, name, x, y, size, adj: [], owner: null, gov: null, pop, popMax: pop * 2,
      farm: 100 + size * 90 + Math.round(r() * 80), farmMax: 300 + size * 250, comm: 80 + size * 90 + Math.round(r() * 80), commMax: 300 + size * 250,
      def: 150 + size * 150, defMax: 400 + size * 250, troops: 0, train: 40, morale: 60 };
  });
  const byName = Object.fromEntries(G.cities.map((c) => [c.name, c]));
  for (const pair of ROADS.split(/\s+/).filter(Boolean)) { const [a, b] = pair.split('-').map((n) => byName[n]); if (!a || !b) throw new Error('bad road ' + pair); a.adj.push(b.id); b.adj.push(a.id); }
  // warlords
  G.factions = {};
  for (const [id, name, lord, color, cities] of S.factions) {
    G.factions[id] = { id, name, lordName: lord, color, lord: null, alive: true, gold: 600 + cities.length * 350, food: 3000 + cities.length * 2500,
      rel: {}, allies: {}, truce: {}, capital: byName[cities[0]].id, born: G.t, peak: cities.length, aggr: 0.8 + r() * 0.5 };
    for (const n of cities) { const c = byName[n]; c.owner = id; c.troops = Math.round((5000 + c.size * 4000) * (0.8 + r() * 0.4)); c.train = 50 + Math.round(r() * 20); }
  }
  for (const c of G.cities) if (!c.owner) c.troops = Math.round((2000 + c.size * 1500) * (0.8 + r() * 0.4));
  // 190: Dong Zhuo holds the capital and the strongest army, and the coalition hates him
  if (S.dong) { for (const c of G.cities) if (c.owner === 'dong') c.troops = Math.round(c.troops * 1.4); G.factions.dong.aggr = 0.6; }
  for (const f of Object.values(G.factions)) for (const g of Object.values(G.factions)) if (f !== g) f.rel[g.id] = S.dong && (f.id === 'dong' || g.id === 'dong') ? -40 : 0;
  const rel = (a, b, v) => { G.factions[a].rel[b] = v; G.factions[b].rel[a] = v; };
  for (const [a, b, v] of S.rel || []) rel(a, b, v);
  for (const [a, b] of S.ally || []) G.factions[a].allies[b] = G.factions[b].allies[a] = 36;
  for (const [a, b] of S.truce || []) G.factions[a].truce[b] = G.factions[b].truce[a] = 12;
  // generals
  G.gens = GENERALS_RAW.trim().split('\n').filter((l) => l && !l.startsWith('//')).map((line, id) => {
    const [name, born, died, lead, war, int, pol, cha, fac, city, kin] = line.split(',');
    let b = +born, deathYear = +died + (G.opts.lifespan === 'long' ? 8 + Math.floor(r() * 10) : 0);
    if (S.allStars) { b = start - 20 - Math.floor(r() * 25); deathYear = start + 25 + Math.floor(r() * 30); }     // what-if: everyone is alive at once
    return { id, name, born: b, died: deathYear, deathMonth: 1 + Math.floor(r() * 12), lead: +lead, war: +war, int: +int, pol: +pol, cha: +cha,
      base: { lead: +lead, war: +war, int: +int, pol: +pol, cha: +cha }, spells: (SPELL_HOLDERS[name] || []).slice(),
      fac0: fac === '-' ? null : fac, home: byName[city].id, kin: kin || null, appear: S.allStars ? start : Math.max(start, b + 15), appearMonth: 1 + Math.floor(r() * 12),
      fac: null, city: byName[city].id, status: 'unborn', loyalty: 0, merit: 0, task: null, kills: 0, duelsWon: 0 };
  });
  // the four hidden generals: each may turn up somewhere, some time, in any game
  for (const [name, lead, war, int, pol, cha, sword, spells] of HIDDEN) {
    const comes = r() < 0.6, ay = start + 1 + Math.floor(r() * 35), city = Math.floor(r() * G.cities.length);
    G.gens.push({ id: G.gens.length, name, born: ay - 18, died: ay + 45 + Math.floor(r() * 15), deathMonth: 1 + Math.floor(r() * 12), lead, war, int, pol, cha,
      base: { lead, war, int, pol, cha }, spells: [], spells0: spells, sword, hidden: true, fac0: null, home: city, kin: 'chenfam', appear: comes ? ay : 9999, appearMonth: 1 + Math.floor(r() * 12),
      fac: null, city, status: 'unborn', loyalty: 0, merit: 0, task: null, kills: 0, duelsWon: 0 });
  }
  G.byName = Object.fromEntries(G.gens.map((g) => [g.name, g]));
  for (const [fid, names] of Object.entries(PREFER)) for (const n of names.split(/\s+/)) { if (!G.byName[n]) throw new Error('allegiance: unknown general ' + n); G.byName[n].prefer = fid; }
  for (const f of Object.values(G.factions)) { const l = G.byName[f.lordName]; if (!l || l.died < start || l.appear > start) throw new Error(`${S.id}: lord ${f.lordName} is not alive`); f.lord = l.id; }
  for (const n of Object.keys(S.who || {})) if (!G.byName[n]) throw new Error(`${S.id}: unknown general ${n}`);
  for (const g of G.gens) {
    if (g.died < start) { g.status = 'dead'; g.cause = 'before'; continue; }
    if (g.appear > start) continue;
    const fid = startFaction(G, S, g), f = fid && G.factions[fid];
    if (f) {
      const home = G.cities[g.city], near = citiesOf(G, f.id).sort((a, b2) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b2.x - home.x, b2.y - home.y))[0];
      const c = home.owner === f.id ? g.city : g.id === f.lord || S.id === '190' ? f.capital : near.id;
      serve(G, g, f.id, c, g.id === f.lord || sameKin(G, g, G.gens[f.lord]) ? 100 : 70 + Math.floor(r() * 25));
    } else { g.status = 'free'; }
  }
  for (const f of Object.values(G.factions)) G.gens[f.lord].city = f.capital;
  for (const c of G.cities) if (c.owner) pickGovernor(G, c);
  // famous items: with their historical owner if he is around, otherwise hidden somewhere
  G.items = ITEMS.map(([key, zh, en, slot, fx, holders, hideIn, teaches], id) => ({ id, key, zh, en, slot, fx, teaches: teaches || [], holder: null, fac: null, city: null }));
  for (const it of G.items) {
    const [, , , , , holders, hideIn] = ITEMS[it.id];
    const h = holders.map((x) => (Array.isArray(x) ? x : [x])).find(([n, from = 0, to = 9999]) => { const g = G.byName[n]; return g && start >= from && start <= to && (g.status === 'serving' || g.status === 'free') && !holds(G, g, it.slot); });
    if (h) give(G, it, G.byName[h[0]]);
    else if (hideIn) it.city = hideIn === '*' ? Math.floor(r() * G.cities.length) : byName[hideIn].id;
  }
  // the warlord the player rules (null: just watch)
  G.player = o.player && G.factions[o.player] ? o.player : null; G.pending = []; G.decided = []; G.auto = { mode: 'manual', askWar: true }; G.nextProp = 1;
  record(G, 'start', 'start', { s: S.id }, null, 3);
  snapshot(G);
  return G;
}
// where a general serves when the scenario begins
function startFaction(G, S, g) {
  if (S.who && g.name in S.who) { const w = S.who[g.name]; return w !== '-' && G.factions[w] ? w : null; }
  if (S.id === '190') return g.fac0 && G.factions[g.fac0] ? g.fac0 : null;
  for (const f of Object.values(G.factions)) if (f.lord === g.id) return f.id;
  if (g.kin) { const f = Object.values(G.factions).find((x) => G.gens[x.lord].kin === g.kin); if (f) return f.id; }
  const pre = g.prefer && !g.prefer.startsWith('kin:') && G.factions[g.prefer] ? g.prefer : null;
  if (S.allStars) return g.fac0 && G.factions[g.fac0] ? g.fac0 : pre;
  if (g.fac0) { const c = G.factions[g.fac0] ? g.fac0 : G.carry[g.fac0]; if (c && c !== '-' && G.factions[c]) return pre || c; }
  return pre;
}
// ---------------------------------------------------------------- items: stats are the base plus whatever a general carries
export const heldBy = (G, g) => G.items.filter((it) => it.holder === g.id);
const holds = (G, g, slot) => G.items.some((it) => it.holder === g.id && it.slot === slot);
function refresh(G, g) { for (const k of STAT) g[k] = g.base[k]; for (const it of heldBy(G, g)) for (const k in it.fx) g[k] += it.fx[k]; }
function give(G, it, g) { const prev = it.holder != null ? G.gens[it.holder] : null; it.holder = g.id; it.fac = null; it.city = null; if (prev) refresh(G, prev); refresh(G, g); }
function stash(G, it, fid) { const prev = it.holder != null ? G.gens[it.holder] : null; it.holder = null; it.fac = fid; it.city = null; if (prev) refresh(G, prev); }
function hide(G, it, cityId) { const prev = it.holder != null ? G.gens[it.holder] : null; it.holder = null; it.fac = null; it.city = cityId; if (prev) refresh(G, prev); }
const learn = (g, sp) => { if (!g.spells.includes(sp)) { g.spells.push(sp); return true; } return false; };
function serve(G, g, fid, cityId, loyalty) { if (G.t > 0 && g.fac !== fid && G.factions[fid]) note(G, g, 'join', G.factions[fid].name); g.status = 'serving'; g.fac = fid; g.city = cityId; g.loyalty = loyalty; g.task = null; }
const sameKin = (G, a, b) => !!(a && b && a.kin && a.kin === b.kin);
// the faction a talent would seek out: their historical lord's faction, or (kin:x) the faction a family serves
function preferred(G, g) {
  if (!g.prefer) return null;
  if (g.prefer.startsWith('kin:')) { const k = G.gens.find((x) => x.kin === g.prefer.slice(4) && x.status === 'serving'); return k ? G.factions[k.fac] : null; }
  const f = G.factions[g.prefer]; return f && f.alive && citiesOf(G, f.id).length ? f : null;
}
const lordOf = (G, fid) => G.gens[G.factions[fid].lord];
export const citiesOf = (G, fid) => G.cities.filter((c) => c.owner === fid);
export const gensOf = (G, fid) => G.gens.filter((g) => g.status === 'serving' && g.fac === fid);
const gensIn = (G, c) => G.gens.filter((g) => g.status === 'serving' && g.city === c.id && g.fac === c.owner && !busy(g));
const freeIn = (G, c) => G.gens.filter((g) => g.status === 'free' && g.city === c.id && !busy(g) && !g.held);
const allied = (G, a, b) => !!(a && b && (G.factions[a].allies[b] > G.t || G.factions[a].truce[b] > G.t));
const hostile = (G, a, b) => b === null || (a !== b && !allied(G, a, b));
// how many soldiers a city can quarter
export const capacity = (c) => 12000 + c.size * 12000;
export const power = (G, fid) => sum(citiesOf(G, fid), (c) => c.troops) + sum(gensOf(G, fid), (g) => (g.lead + g.war + g.int) * 20);
// the chronicle: each entry is a template key and the names involved; js/sim/text.js writes it in Chinese or English
function record(G, kind, key, p, fac, level = 1, extra = {}) { G.log.push({ t: G.t, year: G.year, month: G.month, kind, key, p, fac, level, ...extra }); }
function pickGovernor(G, c) { const gs = gensIn(G, c); const lord = c.owner && G.gens[G.factions[c.owner].lord]; c.gov = lord && lord.city === c.id && lord.status === 'serving' ? lord.id : gs.length ? maxBy(gs, (g) => g.lead + g.pol + g.cha).id : null; }
function snapshot(G) { const s = { t: G.t, year: G.year, f: {} }; for (const f of Object.values(G.factions)) if (f.alive) s.f[f.id] = citiesOf(G, f.id).length; G.history.push(s); }

// ---------------------------------------------------------------- the player's court: proposals and decisions
const isMine = (G, f) => !!G.player && f.id === G.player;
function propose(G, prop) { prop.id = G.nextProp++; prop.t = G.t; prop.p = prop.p || {}; G.pending.push(prop); }
// last month's unanswered proposals lapse; captives waiting for judgement are let go
function lapse(G) {
  for (const prop of G.pending) if (prop.type === 'captive') { const x = G.gens[prop.x]; if (x.held) { x.held = null; x.city = pick(G.r, G.cities[x.city].adj); } }
  G.pending = [];
}
const snap = (c, f) => ({ farm: c.farm, comm: c.comm, def: c.def, morale: c.morale, train: c.train, troops: c.troops, gold: f.gold });
// answer the first proposal: yes = approve, or choice = one of its extra options (e.g. 'execute')
export function decide(G, yes, choice) {
  const prop = G.pending.shift(); if (!prop) return null;
  const n0 = G.log.length, g = G.gens[prop.g];
  let res;
  if (!prop.valid()) res = { void: true };
  else if ((yes || choice) && prop.cost && G.factions[G.player].gold < prop.cost) res = { broke: true };
  else if (yes || choice) { res = { ok: true, ...(prop.run(choice || true) || {}) }; if (g && g.status === 'serving') g.merit += 1; }
  else {
    if (prop.reject) prop.reject();
    if (g && g.status === 'serving' && g.fac === G.player && g.id !== G.factions[G.player].lord) g.loyalty = Math.max(0, g.loyalty - 1 - Math.floor(G.r() * 2));
    res = { rejected: true };
  }
  res.prop = prop; res.logs = G.log.slice(n0); res.year = G.year; res.month = G.month;
  G.decided.push(res); if (G.decided.length > 15) G.decided.shift();
  return res;
}
// what the automatic answer would be (null: ask the player)
export function autoAnswer(G, prop) {
  const m = G.auto.mode;
  if (m === 'manual' || (prop.type === 'war' && G.auto.askWar)) return null;
  return m === 'all' ? true : !!prop.smart;
}
export function autoDecide(G) { const out = []; while (G.pending.length) { const a = autoAnswer(G, G.pending[0]); if (a === null) break; out.push(decide(G, a)); } return out; }
const alive = (G, fid) => !!(G.factions[fid] && G.factions[fid].alive);

// ---------------------------------------------------------------- one month
export function step(G) {
  if (G.over) return G;
  lapse(G);
  lifecycle(G);
  lifeMonth(G, { r: G.r, refresh, gensIn, busy, citiesOf });   // every general's own month (see life.js)
  if (G.rivals) rivalsMonth(G, { record, refresh, busy, give, die, serve, hostile, hostileTo: () => false, siege, citiesOf, destroy }); // the computer players (rivals.js)
  economy(G);
  events(G);
  for (const fid of shuffle(G, Object.keys(G.factions))) { const f = G.factions[fid]; if (!f.alive) continue; domestic(G, f); }
  if (G.month % 3 === 0) for (const fid of shuffle(G, Object.keys(G.factions))) { const f = G.factions[fid]; if (f.alive) diplomacy(G, f); }
  for (const fid of shuffle(G, Object.keys(G.factions))) { const f = G.factions[fid]; if (f.alive) war(G, f); }
  unrest(G);
  checkFactions(G);
  // next month
  G.t++; G.month++; if (G.month > 12) { G.month = 1; G.year++; snapshot(G); }
  const alive = Object.values(G.factions).filter((f) => f.alive), owned = new Set(G.cities.map((c) => c.owner));
  if (alive.length === 1 && !owned.has(null) && owned.size === 1) { G.over = alive[0].id; const lord = lordOf(G, alive[0].id); record(G, 'unify', 'unify', { g: lord.name, f: alive[0].name }, alive[0].id, 3); }
  if (G.year >= 300 && !G.over) { G.over = 'time'; record(G, 'end', 'end', {}, null, 3); }
  return G;
}
function shuffle(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(G.r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------------------------------------------------------- birth, coming of age, death, succession
function lifecycle(G) {
  const r = G.r;
  for (const g of G.gens) {
    if (g.status === 'unborn' && (G.year > g.appear || (G.year === g.appear && G.month >= g.appearMonth)) && g.died >= G.year) comeOfAge(G, g);
    else if (g.status !== 'dead' && g.status !== 'unborn' && (G.year > g.died || (G.year === g.died && G.month >= g.deathMonth))) die(G, g, 'natural');
  }
  // a general who reads a book of the arts may learn its spells
  for (const it of G.items) if (it.teaches.length && it.holder != null) {
    const g = G.gens[it.holder], sp = it.teaches.find((x) => !g.spells.includes(x));
    if (sp && g.int >= 60 && r() < 0.03) { learn(g, sp); record(G, 'spell', 'bookSpell', { g: g.name, it: it.key, s: sp }, g.status === 'serving' ? g.fac : null, 2, { g: g.id }); }
  }
  // the occasional wandering talent moves to another city
  for (const g of G.gens) {
    if (g.status !== 'free' || busy(g)) continue;
    const f = preferred(G, g);
    if (f && r() < 0.06) {
      const c = citiesOf(G, f.id).sort((a, b) => Math.hypot(a.x - G.cities[g.city].x, a.y - G.cities[g.city].y) - Math.hypot(b.x - G.cities[g.city].x, b.y - G.cities[g.city].y))[0];
      if (c) { serve(G, g, f.id, c.id, 80 + Math.round(r() * 15)); record(G, 'join', 'seek', { g: g.name, f: f.name }, f.id, g.lead + g.war + g.int + g.pol + g.cha > 360 ? 2 : 1, { g: g.id }); continue; }
    }
    if (r() < 0.015) { const c = G.cities[g.city]; g.city = pick(r, c.adj); }
  }
}
function comeOfAge(G, g) {
  if (g.hidden) { const it = G.items.find((x) => x.key === g.sword); if (it) give(G, it, g); for (const s of g.spells0) learn(g, s); }
  // family first: join the faction where kin serve (the lord's own family above all)
  const kinG = g.kin && G.gens.filter((k) => k !== g && k.kin === g.kin && k.status === 'serving').sort((a, b) => (G.factions[b.fac].lord === b.id) - (G.factions[a.fac].lord === a.id))[0];
  if (kinG) { serve(G, g, kinG.fac, kinG.city, G.factions[kinG.fac].lord === kinG.id ? 95 : 85); record(G, 'join', 'kinJoin', { g: g.name, f: G.factions[g.fac].name }, g.fac, g.lead + g.int + g.war > 220 ? 2 : 1, { g: g.id }); return; }
  const f = preferred(G, g) || (g.fac0 && (G.factions[g.fac0] || G.factions[G.carry[g.fac0]]));
  if (f && f.alive && G.r() < 0.7) { serve(G, g, f.id, f.capital, 75); record(G, 'join', 'serve', { g: g.name, f: f.name }, f.id, 1, { g: g.id }); return; }
  g.status = 'free'; g.city = g.home;
  if (g.hidden) { g.known = true; record(G, 'appear', 'hiddenAppear', { g: g.name, c: G.cities[g.home].name }, null, 3, { g: g.id }); return; }
  if (g.lead + g.war + g.int + g.pol > 300) record(G, 'appear', 'appear', { g: g.name, c: G.cities[g.home].name }, null, 1, { g: g.id });
}
function die(G, g, cause, by) {
  const was = g.status, fid = g.fac, f = fid && G.factions[fid], wasLord = f && f.lord === g.id && was === 'serving';
  g.status = 'dead'; g.diedAt = G.t; g.cause = cause;
  const level = wasLord ? 3 : g.lead + g.war + g.int + g.pol + g.cha > 330 ? 2 : 1;
  record(G, 'death', 'death', { g: g.name, f: f && was === 'serving' ? f.name : null, cause, by: by ? by.name : null, age: G.year - g.born }, was === 'serving' ? fid : null, level, { g: g.id });
  for (const it of heldBy(G, g)) {
    if (by && by.status === 'serving' && !holds(G, by, it.slot)) { give(G, it, by); record(G, 'item', 'itemTake', { g: by.name, x: g.name, it: it.key }, by.fac, 2, { g: by.id }); }
    else if (by && by.status === 'serving') stash(G, it, by.fac);
    else if (was === 'serving' && f && f.alive) stash(G, it, fid);
    else hide(G, it, g.city);
  }
  // a lord with no city left takes the faction down with him; otherwise someone succeeds
  if (wasLord) { if (citiesOf(G, fid).length) succession(G, fid, g); else destroy(G, fid, null, 'scatter', { f: f.name }); }
  for (const c of G.cities) if (c.gov === g.id) pickGovernor(G, c);
}
function succession(G, fid, old) {
  const f = G.factions[fid], members = gensOf(G, fid);
  if (!members.length) { destroy(G, fid, null, 'noHeir', { f: f.name }); return; }
  // family first; otherwise the most able leader (a physician or a scholar won't do: the faction dissolves instead)
  const heir = members.filter((m) => sameKin(G, m, old)).sort((a, b) => a.born - b.born)[0] || maxBy(members.filter((m) => m.lead + m.cha >= 100), (m) => m.cha * 2 + m.lead + m.pol + m.loyalty);
  if (!heir) { destroy(G, fid, null, 'noHeir', { f: f.name }); return; }
  f.lord = heir.id; heir.loyalty = 100; const oldName = f.name; f.name = heir.name;
  record(G, 'succession', 'succession', { g: heir.name, old: old.name, f: oldName }, fid, 2, { g: heir.id });
  for (const m of members) if (m !== heir && !sameKin(G, m, heir)) m.loyalty = clamp(m.loyalty - 10 + Math.round((heir.cha - 60) / 5), 10, 99);
}
function destroy(G, fid, by, key, p) {
  const f = G.factions[fid]; if (!f.alive) return;
  f.alive = false; f.died = G.t;
  for (const it of G.items) if (it.fac === fid) hide(G, it, f.capital);
  for (const c of citiesOf(G, fid)) { c.owner = null; c.gov = null; }
  for (const g of gensOf(G, fid)) { g.status = 'free'; g.fac = null; g.loyalty = 0; }
  record(G, 'fall', key, p, fid, 3);
}

// ---------------------------------------------------------------- money, food, people
function economy(G) {
  for (const f of Object.values(G.factions)) if (f.alive) {
    const cs = citiesOf(G, f.id);
    f.gold += Math.round(sum(cs, (c) => (c.comm * 0.13 + c.pop / 9000) * (0.4 + c.morale / 160)));
    f.gold -= gensOf(G, f.id).length * 2 + Math.round(sum(cs, (c) => c.troops) / 400);
    if (G.month === 7) { const harvest = Math.round(sum(cs, (c) => (c.farm * 2.6 + c.pop / 320) * (0.4 + c.morale / 160))); f.food += harvest; }
    f.food -= Math.round(sum(cs, (c) => c.troops) / 150);
    if (f.food < 0) { f.food = 0; for (const c of cs) { c.troops = Math.round(c.troops * 0.93); c.morale = clamp(c.morale - 3, 0, 100); } if (G.r() < 0.1) record(G, 'famine', 'famine', { f: f.name }, f.id, 1); }
    f.gold = Math.max(0, f.gold);
  }
  for (const c of G.cities) { c.pop = Math.min(c.popMax, Math.round(c.pop * (1 + (c.morale - 40) / 60000 + c.farm / 400000))); if (!c.owner) { c.troops = Math.min(c.troops + 30, 2000 + c.size * 2500); } }
}

// ---------------------------------------------------------------- 內政: each general does one job a month
function front(G, c) { return c.adj.some((a) => hostile(G, c.owner, G.cities[a].owner)); }
function frontDist(G, fid) {   // steps from each city to the nearest hostile city
  const d = new Map(), q = [];
  for (const c of G.cities) if (c.owner === fid && front(G, c)) { d.set(c.id, 0); q.push(c.id); }
  for (let i = 0; i < q.length; i++) for (const a of G.cities[q[i]].adj) if (G.cities[a].owner === fid && !d.has(a)) { d.set(a, d.get(q[i]) + 1); q.push(a); }
  return d;
}
function domestic(G, f) {
  const r = G.r, cs = citiesOf(G, f.id), dist = frontDist(G, f.id), lord = lordOf(G, f.id);
  // the player's realm: a few generals, chosen at random, ask the lord before they act (the rest get on with their work)
  const asks = new Set();
  if (isMine(G, f)) { const pool = shuffle(G, gensOf(G, f.id).filter((g) => g.id !== f.lord)); for (const g of pool.slice(0, clamp(2 + Math.floor(pool.length / 10), 2, 5))) asks.add(g.id); }
  for (const c of cs) {
    const gs = gensIn(G, c).sort((a, b) => b.pol + b.lead - (a.pol + a.lead)), isFront = dist.get(c.id) === 0;
    const want = Math.min(capacity(c), isFront ? 9000 + c.size * 5000 : 3000 + c.size * 1500);
    for (const g of gs) {
      g.task = null;
      if (g.loyalty < 100 && r() < 0.03) g.loyalty = clamp(g.loyalty + (lord.cha > 75 ? 1 : lord.cha < 45 ? -2 : 0) - (cs.length > 12 ? 1 : 0), 0, 99);
      // pick the job this city needs most and this general is good at
      const free = freeIn(G, c);
      const jobs = [
        ['recruitGen', free.length ? 150 + g.cha : 0],
        ['search', G.t % 4 === c.id % 4 && f.gold > 50 ? 30 + g.cha * 0.4 + g.int * 0.3 : 0],
        ['draft', c.troops < want && f.gold > 120 && c.pop > 30000 ? (want - c.troops) / want * 140 + g.cha * 0.5 : 0],
        ['train', c.train < (isFront ? 90 : 60) ? (isFront ? 70 : 30) + g.lead * 0.6 - c.train * 0.5 : 0],
        ['farm', c.farm < c.farmMax && f.gold > 40 ? (1 - c.farm / c.farmMax) * 90 + g.pol * 0.6 - (isFront ? 20 : 0) : 0],
        ['comm', c.comm < c.commMax && f.gold > 40 ? (1 - c.comm / c.commMax) * 90 + g.pol * 0.6 - (isFront ? 20 : 0) : 0],
        ['def', c.def < c.defMax && f.gold > 40 ? (isFront ? 50 : 10) + g.lead * 0.3 - c.def / c.defMax * 40 : 0],
        ['morale', c.morale < 70 ? 80 - c.morale + g.cha * 0.3 : 0],
        ['reward', f.gold > 300 && gs.some((m) => m.loyalty < 60) ? 50 + g.cha * 0.2 : 0],
      ];
      // each job gets a little random jitter once (a random sort comparator would make replays differ between browsers)
      if (!jobs.some((j) => j[1] > 0)) continue;
      const [job] = maxBy(jobs.map(([k, v]) => [k, v + (r() - 0.5) * 20]), (j) => j[1]);
      if (asks.has(g.id)) { propose(G, jobProposal(G, f, c, g, job, free)); continue; }
      g.task = job; doJob(G, f, c, g, job, free);
    }
    // a capital with no general still grows slowly
    if (!gs.length) { c.farm = Math.min(c.farmMax, c.farm + 1); c.comm = Math.min(c.commMax, c.comm + 1); }
  }
  logistics(G, f, dist);
  // twice a year the lord rewards an officer with something from the treasury
  if (G.month % 6 === 1) for (const it of G.items.filter((x) => x.fac === f.id)) {
    const fit = (g) => (it.slot === 'b' ? g.int + g.lead : it.slot === 't' ? g.cha + g.pol : g.war + g.lead) + (100 - g.loyalty) * 0.5;
    const g = maxBy(gensOf(G, f.id).filter((m) => !holds(G, m, it.slot)), fit); if (!g) continue;
    if (isMine(G, f)) {
      const adv = maxBy(gensOf(G, f.id).filter((m) => m.id !== f.lord), (m) => m.pol + m.int) || lord;
      propose(G, { type: 'item', g: adv.id, city: g.city, x: g.id, smart: true, p: { g: adv.name, x: g.name, it: it.key },
        valid: () => it.fac === f.id && g.status === 'serving' && g.fac === f.id && !holds(G, g, it.slot),
        run: () => { give(G, it, g); g.loyalty = Math.min(100, g.loyalty + 10); record(G, 'item', 'itemGive', { x: lordOf(G, f.id).name, g: g.name, it: it.key }, f.id, 1, { g: g.id }); } });
      continue;
    }
    give(G, it, g); g.loyalty = Math.min(100, g.loyalty + 10);
    record(G, 'item', 'itemGive', { x: lord.name, g: g.name, it: it.key }, f.id, 1, { g: g.id });
  }
}
function jobProposal(G, f, c, g, job, free) {
  const x = job === 'recruitGen' ? maxBy(free, (y) => y.lead + y.war + y.int + y.pol + y.cha + (y.known ? 50 : 0)) : null;
  // what the job costs the treasury (approving it without the gold does nothing)
  const cost = { farm: 20, comm: 20, def: 20, morale: 10, reward: 40, search: 10, draft: 120 }[job] || 0;
  return { type: 'job', job, g: g.id, city: c.id, smart: true, cost, p: { g: g.name, c: c.name, x: x && x.name },
    valid: () => g.status === 'serving' && g.fac === f.id && g.city === c.id && c.owner === f.id && alive(G, f.id),
    run: () => {
      const before = snap(c, f); g.task = job; doJob(G, f, c, g, job, freeIn(G, c));
      const after = snap(c, f), d = Object.keys(before).filter((k) => after[k] !== before[k]).map((k) => [k, after[k] - before[k]]);
      return { key: 'jobDone', p: { g: g.name, c: c.name, job, d } };
    } };
}
function doJob(G, f, c, g, job, free) {
  const r = G.r;
  switch (job) {
    case 'farm': c.farm = Math.min(c.farmMax, c.farm + Math.round(2 + g.pol / 9 + r() * 4)); f.gold -= 20; g.merit += 1; break;
    case 'comm': c.comm = Math.min(c.commMax, c.comm + Math.round(2 + g.pol / 9 + r() * 4)); f.gold -= 20; g.merit += 1; break;
    case 'def': c.def = Math.min(c.defMax, c.def + Math.round(3 + g.lead / 10 + r() * 4)); f.gold -= 20; g.merit += 1; break;
    case 'morale': c.morale = Math.min(100, c.morale + Math.round(1 + g.cha / 25 + r() * 2)); f.gold -= 10; g.merit += 1; break;
    case 'train': c.train = Math.min(100, c.train + Math.round(2 + g.lead / 14 + r() * 3)); g.merit += 1; break;
    case 'draft': { const n = Math.min(Math.round(600 + g.cha * 18 + r() * 600), Math.floor(c.pop / 15), f.gold * 8);
      if (n <= 0) break; c.train = Math.round((c.train * c.troops + 35 * n) / (c.troops + n)); c.troops += n; c.pop -= Math.round(n / 2); f.gold -= Math.ceil(n / 8); c.morale = Math.max(0, c.morale - 1); g.merit += 1; break; }
    case 'reward': { const low = gensIn(G, c).filter((m) => m.loyalty < 100).sort((a, b) => a.loyalty - b.loyalty)[0]; if (low) { low.loyalty = Math.min(99, low.loyalty + 6 + Math.round(r() * 6)); f.gold -= 40; } break; }
    case 'search': {
      f.gold -= 10;
      const hidden = G.gens.filter((x) => x.status === 'free' && x.city === c.id && !x.known), loot = G.items.filter((it) => it.city === c.id);
      if (loot.length && r() < 0.12 + g.int / 1000) { const it = pick(r, loot); if (!holds(G, g, it.slot)) give(G, it, g); else stash(G, it, f.id); g.merit += 5; record(G, 'item', 'itemFind', { g: g.name, c: c.name, it: it.key }, f.id, 2, { g: g.id }); }
      else if (hidden.length && r() < 0.35 + g.cha / 300) { const x = pick(r, hidden); x.known = true; }
      else if (r() < 0.2) f.gold += 50 + Math.round(r() * 100);
      break; }
    case 'recruitGen': {
      const x = maxBy(free, (y) => y.lead + y.war + y.int + y.pol + y.cha + (y.known ? 50 : 0)); if (!x) break;
      const lord = lordOf(G, f.id), p = 0.18 + g.cha / 250 + (lord.cha - 60) / 300 + (x.fac0 === f.id ? 0.2 : 0) - (x.refused || 0) * 0.05;
      if (r() < p) { serve(G, x, f.id, c.id, 60 + Math.round(r() * 25)); x.known = true; g.merit += 3;
        const big = x.lead + x.war + x.int + x.pol + x.cha;
        record(G, 'join', 'recruit', { g: g.name, x: x.name, f: f.name }, f.id, big > 360 ? 2 : 1, { g: x.id });
      } else x.refused = (x.refused || 0) + 1;
      break; }
  }
}
// move troops and generals from safe cities toward the front
function logistics(G, f, dist) {
  const cs = citiesOf(G, f.id);
  for (const c of cs) {
    const d = dist.get(c.id); if (d === undefined || d === 0) continue;
    const next = c.adj.map((a) => G.cities[a]).filter((a) => a.owner === f.id && dist.get(a.id) < d).sort((a, b) => a.troops - b.troops)[0];
    if (!next) continue;
    const keep = 2000 + c.size * 1000;
    if (c.troops > keep + 1500 && next.troops < capacity(next)) { const n = Math.min(Math.round((c.troops - keep) * 0.6), capacity(next) - next.troops); c.troops -= n; next.troops += n; }
    const gs = gensIn(G, c).filter((g) => g.id !== c.gov && g.id !== f.lord).sort((a, b) => b.lead + b.war - (a.lead + a.war));
    for (const g of gs.slice(0, Math.max(0, gs.length - 1))) if (g.lead + g.war > 120 && G.r() < 0.5) g.city = next.id;
  }
  // the lord settles in the strongest city near the front
  const lord = lordOf(G, f.id);
  if (!busy(lord) && (lord.status === 'serving' && !G.cities[lord.city] || G.cities[lord.city].owner !== f.id)) { const c = maxBy(cs, (x) => x.troops); if (c) lord.city = c.id; }
  for (const c of cs) if (!c.gov || G.gens[c.gov].city !== c.id || G.gens[c.gov].status !== 'serving') pickGovernor(G, c);
}

// ---------------------------------------------------------------- 外交
function diplomacy(G, f) {
  const r = G.r, me = power(G, f.id), lord = lordOf(G, f.id), envoy = maxBy(gensOf(G, f.id), (g) => g.int + g.pol);
  if (!envoy) return;
  const neighbours = new Set(); for (const c of citiesOf(G, f.id)) for (const a of c.adj) { const o = G.cities[a].owner; if (o && o !== f.id) neighbours.add(o); }
  for (const oid of neighbours) {
    const o = G.factions[oid], them = power(G, oid), rel = f.rel[oid] || 0, olord = lordOf(G, oid);
    // demand surrender from a much weaker neighbour
    // (great warlords never bow; minor ones may, once the realm has settled a little)
    const pride = olord.lead + olord.war + olord.int + olord.cha;
    if (G.year >= 192 && pride < 250 && me > them * 6 && citiesOf(G, oid).length <= 2 && r() < 0.025 + (envoy.cha + lord.cha - olord.cha) / 4000) {
      if (isMine(G, f)) { propose(G, { type: 'absorb', g: envoy.id, smart: true, p: { g: envoy.name, o: o.name, x: olord.name },
        valid: () => alive(G, o.id) && alive(G, f.id) && envoy.status === 'serving' && envoy.fac === f.id, run: () => absorb(G, f, o, envoy) }); return; }
      absorb(G, f, o, envoy); return;
    }
    // betray an ally that has become weak and is the only way to grow
    if (f.allies[oid] > G.t && me > them * 3 && r() < 0.06 * f.aggr) {
      const betray = () => { delete f.allies[oid]; delete o.allies[f.id]; f.rel[oid] = o.rel[f.id] = -60; record(G, 'diplo', 'betray', { g: lordOf(G, f.id).name, x: lordOf(G, oid).name }, f.id, 2); };
      if (isMine(G, f)) propose(G, { type: 'betray', g: envoy.id, smart: true, p: { g: envoy.name, o: o.name }, valid: () => alive(G, oid) && f.allies[oid] > G.t, run: betray });
      else betray();
      continue;
    }
  }
  // look for an ally against the strongest neighbour
  const threat = maxBy([...neighbours].filter((o) => !allied(G, f.id, o)), (o) => power(G, o));
  if (threat && power(G, threat) > me * 1.1 && !Object.keys(f.allies).some((a) => f.allies[a] > G.t && G.factions[a].alive)) {
    const cand = Object.values(G.factions).filter((o) => o.alive && o.id !== f.id && o.id !== threat && !(f.allies[o.id] > G.t) && citiesOf(G, o.id).some((c) => c.adj.some((a) => G.cities[a].owner === threat)));
    const o = maxBy(cand, (x) => power(G, x.id) + (f.rel[x.id] || 0) * 300);
    if (o && r() < 0.12 + ((f.rel[o.id] || 0) + (envoy.int + envoy.pol) / 2 - 50) / 250) {
      const ally = () => { f.allies[o.id] = o.allies[f.id] = G.t + 36; f.rel[o.id] = o.rel[f.id] = Math.min(100, (f.rel[o.id] || 0) + 30);
        record(G, 'diplo', 'ally', { f: f.name, o: o.name, t: G.factions[threat].name, g: envoy.name }, f.id, 2); };
      if (isMine(G, f)) propose(G, { type: 'ally', g: envoy.id, smart: true, p: { g: envoy.name, o: o.name, t: G.factions[threat].name }, valid: () => alive(G, o.id) && alive(G, f.id) && !(f.allies[o.id] > G.t), run: ally });
      else ally();
    } else if (power(G, threat) > me * 2.5 && power(G, threat) < me * 6 && !(f.truce[threat] > G.t - 24) && r() < 0.05 + envoy.int / 1000) {   // a giant won't bother with a truce
      const t = G.factions[threat], truce = () => { f.truce[threat] = t.truce[f.id] = G.t + 12; record(G, 'diplo', 'truce', { f: f.name, o: t.name }, f.id, 1); };
      if (isMine(G, f)) propose(G, { type: 'truce', g: envoy.id, smart: true, p: { g: envoy.name, o: t.name }, valid: () => alive(G, threat) && alive(G, f.id), run: truce });
      else truce();
    }
  }
  // lure away a disloyal general of a rival
  const target = G.gens.filter((g) => g.status === 'serving' && !busy(g) && g.fac !== f.id && !allied(G, f.id, g.fac) && g.loyalty < 55 && G.factions[g.fac].lord !== g.id && !sameKin(G, g, lordOf(G, g.fac)))
    .sort((a, b) => b.lead + b.war + b.int - (a.lead + a.war + a.int))[0];
  if (target && r() < 0.15 + (envoy.cha - target.loyalty) / 250) {
    const from = G.factions[target.fac], fromId = target.fac;
    const lure = () => {
      const c = G.cities[target.city];
      serve(G, target, f.id, f.capital, 70);
      record(G, 'defect', 'defect', { g: target.name, x: envoy.name, o: from.name, f: f.name }, f.id, 2, { g: target.id });
      if (c.gov === target.id) pickGovernor(G, c);
    };
    if (isMine(G, f)) propose(G, { type: 'lure', g: envoy.id, x: target.id, smart: true, p: { g: envoy.name, x: target.name, o: from.name },
      valid: () => alive(G, f.id) && target.status === 'serving' && target.fac === fromId && G.factions[fromId].lord !== target.id, run: lure });
    else lure();
  }
}
function absorb(G, f, o, envoy) {
  const olord = lordOf(G, o.id);
  for (const c of citiesOf(G, o.id)) c.owner = f.id;
  for (const g of gensOf(G, o.id)) { g.fac = f.id; g.loyalty = g.id === olord.id ? 55 : 60 + Math.round(G.r() * 20); }
  o.alive = false; o.died = G.t;
  for (const it of G.items) if (it.fac === o.id) it.fac = f.id;
  record(G, 'fall', 'surrender', { g: olord.name, x: envoy.name, o: o.name, f: f.name }, f.id, 3);
  for (const c of citiesOf(G, f.id)) pickGovernor(G, c);
}

// ---------------------------------------------------------------- 戰爭
const wallBonus = (c) => 1.2 + Math.min(c.def, 1100) / 1600;
// the ground of a campaign: on the Yangtze the southern navies are at home and northern armies flounder; the horsemen
// of the west and the north are at their best on open ground. Returns [attacker, defender] multipliers.
const RIVER_CITIES = new Set(['江陵', '江夏', '柴桑', '建業', '廬江', '吳', '永安', '江州']), HILL_CITIES = new Set(['漢中', '梓潼', '成都', '上庸', '永安', '江州', '建寧', '雲南', '武陵', '交趾']);
const homeOf = (G, fid) => { const f = fid && G.factions[fid]; return f ? G.cities[f.capital] || null : null; };
function fieldMul(G, fid, city, from) {
  const a = homeOf(G, fid), d = homeOf(G, city.owner), south = (c) => !!c && c.y >= 60, horse = (c) => !!c && ((c.x < 35 && c.y < 48) || c.y < 25);
  const water = RIVER_CITIES.has(city.name) || (from && (from.y < 60) !== (city.y < 60) && city.x > 38);
  let am = 1, dm = 1;
  if (water) { am *= south(a) ? 1.1 : 0.82; dm *= south(d) ? 1.1 : 0.92; }
  else if (!HILL_CITIES.has(city.name) && horse(a)) am *= 1.12;
  return [am, dm];
}
const armyPower = (gs, troops, train) => { const lead = gs.length ? Math.max(...gs.map((g) => g.lead)) : 30, war = gs.length ? Math.max(...gs.map((g) => g.war)) : 30; return troops * (0.55 + train / 220) * (0.6 + lead / 160 + war / 400); };
function war(G, f) {
  const r = G.r, lord = lordOf(G, f.id), cs = citiesOf(G, f.id);
  if (G.t < 3 || f.food < 1500 || f.rest > G.t) return;          // the coalition gathers before the fighting starts
  // every hostile city on the border, and what all our cities around it could throw at it
  const targets = new Map();
  for (const c of cs) for (const a of c.adj) { const t = G.cities[a]; if (hostile(G, f.id, t.owner)) { if (!targets.has(t.id)) targets.set(t.id, []); targets.get(t.id).push(c); } }
  const options = [], mine = power(G, f.id), theirs = new Map(), dist = frontDist(G, f.id);
  for (const [tid, srcs] of targets) {
    const t = G.cities[tid], from = srcs.filter((c) => c.troops >= 5000 && gensIn(G, c).length);
    if (!from.length) continue;
    // a grand campaign: safe interior cities one road further back march in with half their men
    const back = [...new Set(from.flatMap((c) => c.adj))].map((a) => G.cities[a]).filter((c) => c.owner === f.id && !from.includes(c) && !srcs.includes(c) && dist.get(c.id) > 0 && c.troops >= 6000);
    from.push(...back);
    const send = from.map((c) => Math.round(c.troops * (back.includes(c) ? 0.5 : 0.7))), troops = sum(send, (x) => x);
    const pool = from.flatMap((c) => gensIn(G, c).filter((g) => g.id !== c.gov || gensIn(G, c).length === 1));
    const army = pool.sort((x, y) => y.lead + y.war - (x.lead + x.war)).slice(0, 5);
    if (!army.length || troops < 6000) continue;
    const train = sum(from, (c) => c.train * c.troops) / Math.max(1, sum(from, (c) => c.troops));
    const [fa, fd] = fieldMul(G, f.id, t, from[0]), atk = armyPower(army, troops, train) * fa, def = armyPower(gensIn(G, t), t.troops, t.train) * wallBonus(t) * fd;
    // commanders misjudge the enemy a little (fog of war), so some risky attacks happen
    const ratio = atk / Math.max(1, def) * (0.85 + r() * 0.3), want = ratio * f.aggr * (t.owner === null ? 1.3 : 1) * (1 + (f.rel[t.owner] || 0) / -300) * (t.size / 2 + 0.5);
    // a realm far stronger overall can afford riskier sieges (this is what ends long stalemates)
    if (t.owner && !theirs.has(t.owner)) theirs.set(t.owner, power(G, t.owner));
    const edge = t.owner ? mine / Math.max(1, theirs.get(t.owner)) : 9, need = edge > 2.5 ? 0.9 : edge > 1.5 ? 1.0 : edge > 1.1 ? 1.1 : 1.2;
    if (ratio > need) options.push({ t, from, send, troops, army, train, ratio, need, want: want * Math.min(2, edge / 2 + 0.5) });
  }
  if (!options.length) return;
  // the player's realm: the best plan goes to the lord (now and then, like the AI's own appetite for war)
  if (isMine(G, f)) {
    const o = options.sort((a, b) => b.want - a.want)[0];
    if (o.t.owner === f.id || r() > 0.55 + lord.war / 500) return;
    const target = o.t, ownerThen = target.owner, chance = Math.round(clamp(100 / (1 + Math.exp(-5 * (o.ratio - 1.05))), 3, 97));
    propose(G, { type: 'war', g: o.army[0].id, city: o.from[0].id, target: target.id, from: o.from.map((c) => c.id), army: o.army.map((g) => g.id), smart: o.ratio > o.need * 1.15,
      p: { g: o.army[0].name, c: o.from[0].name, t: target.name, o: ownerThen ? G.factions[ownerThen].name : null, troops: Math.round(o.troops / 100) * 100, chance, army: o.army.map((g) => g.name), from: o.from.map((c) => c.name) },
      valid: () => alive(G, f.id) && target.owner === ownerThen && target.owner !== f.id && hostile(G, f.id, target.owner) && o.from.every((c) => c.owner === f.id) && o.army.some((g) => g.status === 'serving' && g.fac === f.id),
      run: () => {
        const army = o.army.filter((g) => g.status === 'serving' && g.fac === f.id), send = o.from.map((c, i) => Math.min(o.send[i], c.troops)), troops = sum(send, (x) => x);
        f.food = Math.max(0, f.food - Math.round(troops / 60));
        o.from.forEach((c, i) => { c.troops -= send[i]; });
        siege(G, f, o.from, target, army, troops, send, o.train);
        f.rest = G.t + 1 + Math.floor(G.r() * 3);
      } });
    return;
  }
  const attacks = cs.length > 15 ? 2 : 1;
  for (const o of options.sort((a, b) => b.want - a.want).slice(0, attacks)) {
    if (o.t.owner === f.id || r() > 0.35 + lord.war / 500 + (f.aggr - 1) * 0.3) continue;
    if (!o.from.every((c) => c.owner === f.id) || !o.army.every((g) => g.status === 'serving' && g.fac === f.id)) continue;
    f.food -= Math.round(o.troops / 60);
    o.from.forEach((c, i) => { c.troops -= Math.min(o.send[i], c.troops); });
    siege(G, f, o.from, o.t, o.army, o.troops, o.send, o.train);
    f.rest = G.t + 1 + Math.floor(r() * 4) + Math.floor(cs.length / 4);
  }
}
function siege(G, f, srcs, city, army, troops, sent, train) {
  const r = G.r, defFid = city.owner, defF = defFid && G.factions[defFid], defGens = gensIn(G, city), from = srcs[0];
  // survivors go home in the proportion they came
  const home = (n) => srcs.forEach((c, i) => { c.troops += Math.round(n * sent[i] / troops); });
  let a = troops, d = city.troops, aMor = 70 + Math.max(...army.map((g) => g.lead)) / 5, dMor = 60 + (city.morale + city.def / 20) / 3;
  const atkLead = maxBy(army, (g) => g.lead), aInt = maxBy(army, (g) => g.int), dInt = maxBy(defGens, (g) => g.int);
  const startA = a, startD = d, notes = [], [fa, fd] = fieldMul(G, f.id, city, from);
  const caster = (gs) => maxBy(gs.filter((g) => g.spells.length && g.status === 'serving'), (g) => g.int), cA = caster(army), cD = caster(defGens);
  let castA = 0, castD = 0;
  // a duel before the walls
  const champA = maxBy(army, (g) => g.war), champD = maxBy(defGens, (g) => g.war);
  if (champA && champD && champA.war >= 75 && champD.war >= 70 && r() < 0.3) {
    const roll = champA.war - champD.war + (r() - 0.5) * 30;
    const [win, lose] = roll >= 0 ? [champA, champD] : [champD, champA];
    win.duelsWon++;
    if (roll >= 0) { aMor += 15; dMor -= 15; } else { aMor -= 15; dMor += 15; }
    const killed = Math.abs(roll) > 18 && r() < 0.35 && lose.war < 95;
    record(G, 'duel', 'duel', { c: city.name, a: champA.name, d: champD.name, w: win.name, l: lose.name, killed }, f.id, killed || win.war >= 95 ? 2 : 1, { g: win.id });
    if (killed) { die(G, lose, 'duel', win); win.kills++; }
  }
  // the siege, in rounds
  for (let round = 0; round < 12 && a > 0 && d > 0; round++) {
    const liveA = army.filter((g) => g.status === 'serving'), liveD = defGens.filter((g) => g.status === 'serving');
    const pa = armyPower(liveA, a, train) * (aMor / 80) * fa, pd = armyPower(liveD, d, city.train) * (dMor / 80) * wallBonus(city) * fd;
    let dmgD = pa * (0.07 + r() * 0.05), dmgA = pd * (0.08 + r() * 0.05);
    // stratagems: the cleverer side may set fires, lay ambushes or sow confusion
    let stratA = false, stratD = false;
    if (aInt && r() < clamp((aInt.int - (dInt ? dInt.int : 40) + 20) / 220, 0.03, 0.4)) { dmgD *= 1.8; stratA = true; if (!notes.length) notes.push({ who: aInt.name, tac: pick(r, ['fire', 'ambush', 'flood', 'rumor']) }); }
    if (dInt && r() < clamp((dInt.int - (aInt ? aInt.int : 40) + 20) / 260, 0.03, 0.35)) { dmgA *= 1.7; stratD = true; if (notes.length < 2) notes.push({ who: dInt.name, tac: pick(r, ['fire', 'night', 'rocks', 'raid']), def: 1 }); }
    // spells: a sorcerer on either side may call down lightning, raise a wind, bewitch the enemy …
    for (const side of ['a', 'd']) {
      const cst = side === 'a' ? cA : cD; if (!cst || cst.status !== 'serving' || (side === 'a' ? castA : castD) >= 2 || r() > 0.16 + cst.int / 900) continue;
      const opts = cst.spells.filter((x) => x !== 'zhi' && (x !== 'zhen' || side === 'd')); if (!opts.length) continue;
      const sp = pick(r, opts), atk = side === 'a';
      if (atk) castA++; else castD++;
      if (sp === 'lei') { if (atk) dmgD *= 2.2; else dmgA *= 2.2; const foes = (atk ? defGens : army).filter((x) => x.status === 'serving' && G.factions[x.fac] && G.factions[x.fac].lord !== x.id && x.war < 95); if (foes.length && r() < 0.06) die(G, pick(r, foes), 'lightning', cst); }
      else if (sp === 'yao') { if (atk) dMor -= 18; else aMor -= 18; }
      else if (sp === 'feng') { if (atk) dmgD *= (stratA ? 2.6 : 1.8); else dmgA *= (stratD ? 2.6 : 1.8); }
      else if (sp === 'zhen') { dmgD *= 0.35; aMor -= 10; }
      else if (sp === 'dun') { if (atk) dmgA *= 0.5; else dmgD *= 0.5; }
      else if (sp === 'huan') { if (atk) { if (stratD) dmgA /= 1.7; dMor -= 10; } else { if (stratA) dmgD /= 1.8; aMor -= 10; } }
      if (notes.length < 4) notes.push({ who: cst.name, tac: 'sp_' + sp, def: atk ? 0 : 1 });
    }
    a = Math.max(0, Math.round(a - dmgA)); d = Math.max(0, Math.round(d - dmgD));
    aMor -= 2 + (dmgA / Math.max(1, a)) * 20; dMor -= 2 + (dmgD / Math.max(1, d)) * 25;
    if (a < startA * 0.3 || aMor < 25) break;
    if (dMor < 15) { d = 0; break; }
  }
  // healers bring many of the wounded back to the ranks
  if (cA && cA.status === 'serving' && cA.spells.includes('zhi') && a < startA) { a += Math.round((startA - a) * 0.25); if (notes.length < 4) notes.push({ who: cA.name, tac: 'sp_zhi' }); }
  if (cD && cD.status === 'serving' && cD.spells.includes('zhi') && d > 0 && d < startD) { d += Math.round((startD - d) * 0.25); if (notes.length < 4) notes.push({ who: cD.name, tac: 'sp_zhi', def: 1 }); }
  city.def = Math.max(0, Math.round(city.def - (startA - a) / 60));
  for (const g of army) if (g.status === 'serving') g.merit += 3;
  const wp = { f: f.name, g: atkLead.name, c: city.name, o: defF ? defF.name : null, notes };
  lifeBattle(G, army, d <= 0, refresh); lifeBattle(G, defGens, d > 0, refresh);
  if (d <= 0) {
    note(G, atkLead, 'took', city.name);
    city.troops = 0;
    const lost = city.owner;
    city.owner = f.id; city.troops = Math.min(a, capacity(city)); home(a - city.troops); city.train = Math.round(train); city.morale = Math.max(20, city.morale - 15);
    for (const g of army) if (g.status === 'serving') g.city = city.id;
    record(G, 'war', 'warWin', wp, f.id, city.size >= 3 || (defF && citiesOf(G, defFid).length === 0) ? 2 : 1, { city: city.id, from: from.id, srcs: srcs.map((c) => c.id), win: true, def: lost });
    captives(G, f, city, defGens, defFid);
    pickGovernor(G, city);
    if (defF && defF.alive && citiesOf(G, defFid).length === 0) destroy(G, defFid, f.id, 'lastCity', { f: defF.name, c: city.name });
    f.peak = Math.max(f.peak, citiesOf(G, f.id).length);
  } else {
    city.troops = d; home(a);
    record(G, 'war', 'warLose', wp, f.id, 1, { city: city.id, from: from.id, srcs: srcs.map((c) => c.id), win: false, def: defFid });
    if (defF) { defF.rel[f.id] = (defF.rel[f.id] || 0) - 10; f.rel[defFid] = (f.rel[defFid] || 0) - 5; }
  }
  if (defF) { defF.rel[f.id] = Math.max(-100, (defF.rel[f.id] || 0) - 15); delete defF.allies[f.id]; delete f.allies[defFid]; delete f.truce[defFid]; delete defF.truce[f.id]; }
}
// what happens to the generals of a fallen city
function captives(G, f, city, defGens, defFid) {
  const r = G.r, lord = lordOf(G, f.id);
  for (const g of defGens) {
    if (g.status !== 'serving') continue;
    const escape = defFid && citiesOf(G, defFid).filter((c) => c.adj.includes(city.id) || true).sort((x, y) => (G.cities[x.id].adj.includes(city.id) ? -1 : 1))[0];
    const isLord = defFid && G.factions[defFid].lord === g.id;
    if (escape && r() < 0.35 + (g.war + g.int) / 400 + (isLord ? 0.25 : 0) + (holds(G, g, 'h') ? 0.2 : 0)) { g.city = escape.id; continue; }
    // try to win the captive over
    const p = isLord ? 0.04 : clamp(0.25 + (lord.cha - g.loyalty) / 160 + (defFid && sameKin(G, g, lordOf(G, defFid)) ? -0.4 : 0), 0.03, 0.9);
    // the player's lord decides: persuade, release or execute
    if (isMine(G, f) && !isLord) {
      g.status = 'free'; g.fac = null; g.city = city.id; g.loyalty = 0; g.held = f.id;
      const adv = maxBy(gensOf(G, f.id).filter((m) => m.id !== f.lord), (m) => m.int) || lord;
      propose(G, { type: 'captive', g: adv.id, x: g.id, city: city.id, smart: true, p: { g: adv.name, x: g.name, o: defFid ? G.factions[defFid].name : null, chance: Math.round(p * 100) }, extra: ['execute'],
        valid: () => g.held === f.id && g.status === 'free' && alive(G, f.id),
        run: (choice) => {
          const me = lordOf(G, f.id); g.held = null;
          if (choice === 'execute') { die(G, g, 'executed', me); return; }
          if (G.r() < p) { serve(G, g, f.id, g.city, 55 + Math.round(G.r() * 20)); record(G, 'join', 'captive', { g: g.name, f: f.name }, f.id, g.lead + g.war + g.int + g.pol + g.cha > 360 ? 2 : 1, { g: g.id }); return; }
          g.city = pick(G.r, G.cities[g.city].adj); record(G, 'release', 'refuse', { x: me.name, g: g.name }, f.id, 1, { g: g.id });
        },
        reject: () => { const me = lordOf(G, f.id); g.held = null; g.city = pick(G.r, G.cities[g.city].adj); record(G, 'release', 'release', { x: me.name, g: g.name }, f.id, 1, { g: g.id }); } });
      continue;
    }
    if (r() < p) {
      const old = defFid && G.factions[defFid];
      serve(G, g, f.id, city.id, 55 + Math.round(r() * 20));
      record(G, 'join', 'captive', { g: g.name, f: f.name }, f.id, g.lead + g.war + g.int + g.pol + g.cha > 360 ? 2 : 1, { g: g.id });
      if (isLord && old && citiesOf(G, old.id).length) succession(G, old.id, g);
      continue;
    }
    const kill = isLord ? 0.3 : clamp(0.12 + (60 - lord.cha) / 200, 0.03, 0.35);
    if (r() < kill) die(G, g, 'executed', lord);
    else if (isLord && escape) {     // a released lord goes home and keeps his throne
      g.city = escape.id; record(G, 'release', 'releaseHome', { x: lord.name, g: g.name, c: escape.name }, f.id, 2, { g: g.id });
    } else { g.status = 'free'; g.fac = null; g.city = pick(r, city.adj); g.loyalty = 0;
      if (isLord) { record(G, 'release', 'release', { x: lord.name, g: g.name }, f.id, 2, { g: g.id }); if (citiesOf(G, defFid).length) succession(G, defFid, g); } }
  }
}

// ---------------------------------------------------------------- random events: disasters, windfalls, sages, immortals, treasures …
const ownedCities = (G) => G.cities.filter((c) => c.owner);
const living = (G) => Object.values(G.factions).filter((f) => f.alive && citiesOf(G, f.id).length);
const EVENTS = [
  ['locust', 6, (G, r) => { if (G.month < 4 || G.month > 9) return; const c = pick(r, ownedCities(G)), f = G.factions[c.owner]; c.farm = Math.round(c.farm * 0.75); f.food = Math.max(0, f.food - 800 - c.size * 600); return ['locust', { c: c.name, f: f.name }, c.owner, 1, { city: c.id }]; }],
  ['plague', 4, (G, r) => {
    const c = pick(r, ownedCities(G)), healer = G.gens.find((g) => (g.status === 'serving' || g.status === 'free') && g.city === c.id && g.spells.includes('zhi'));
    if (healer) { c.morale = Math.min(100, c.morale + 5); healer.merit += 5; return ['plagueCured', { c: c.name, g: healer.name }, c.owner, 2, { g: healer.id }]; }
    c.pop = Math.round(c.pop * 0.88); c.troops = Math.round(c.troops * 0.9);
    const old = G.gens.filter((g) => g.status === 'serving' && !busy(g) && g.city === c.id && G.year - g.born > 50 && G.factions[g.fac].lord !== g.id);
    if (old.length && r() < 0.15) die(G, pick(r, old), 'plague');
    return ['plague', { c: c.name }, c.owner, 1, { city: c.id }]; }],
  ['flood', 4, (G, r) => { if (G.month < 5 || G.month > 9) return; const c = pick(r, ownedCities(G)); c.farm = Math.round(c.farm * 0.85); c.def = Math.round(c.def * 0.85); return ['flood', { c: c.name }, c.owner, 1, { city: c.id }]; }],
  ['harvest', 4, (G, r) => { if (G.month < 7 || G.month > 9) return; const c = pick(r, ownedCities(G)), f = G.factions[c.owner]; f.food += 1500 + c.farm * 2; return ['harvest', { c: c.name, f: f.name }, c.owner, 1, { city: c.id }]; }],
  ['quake', 2, (G, r) => { const c = pick(r, ownedCities(G)); c.def = Math.round(c.def * 0.7); c.pop = Math.round(c.pop * 0.95); return ['quake', { c: c.name }, c.owner, 2, { city: c.id }]; }],
  ['bandits', 6, (G, r) => {
    const c = pick(r, ownedCities(G)), gov = c.gov != null ? G.gens[c.gov] : null;
    if (gov && gov.war + gov.lead > 140 && r() < 0.75) { gov.merit += 3; if (r() < 0.3 && gov.base.war < 100) { gov.base.war++; refresh(G, gov); } return ['banditsBeaten', { c: c.name, g: gov.name }, c.owner, 1, { g: gov.id }]; }
    c.troops = Math.max(0, c.troops - 800 - Math.round(r() * 2000)); c.morale = Math.max(0, c.morale - 10); return ['bandits', { c: c.name }, c.owner, 1, { city: c.id }]; }],
  ['caravan', 5, (G, r) => { const c = pick(r, ownedCities(G)), f = G.factions[c.owner], n = 200 + Math.round(r() * 500); f.gold += n; return ['caravan', { c: c.name, f: f.name, n }, c.owner, 1, { city: c.id }]; }],
  ['omen', 2, (G, r) => { const f = pick(r, living(G)); for (const c of citiesOf(G, f.id)) c.morale = Math.min(100, c.morale + 8); return ['omen', { f: f.name }, f.id, 1]; }],
  ['comet', 1, (G, r) => {
    const lords = living(G).map((f) => G.gens[f.lord]).filter((g) => G.year - g.born >= 55); if (!lords.length) return;
    const g = pick(r, lords); if (r() < 0.5) g.died = Math.min(g.died, G.year + 1);
    return ['comet', { g: g.name }, g.fac, 2, { g: g.id }]; }],
  ['sage', 4, (G, r) => { const gs = G.gens.filter((g) => g.status === 'serving' && g.base.int >= 50 && g.base.int < 100); if (!gs.length) return; const g = pick(r, gs), n = 1 + Math.floor(r() * 3); g.base.int = Math.min(100, g.base.int + n); refresh(G, g); return ['sage', { g: g.name, n }, g.fac, 1, { g: g.id }]; }],
  ['training', 4, (G, r) => { const gs = G.gens.filter((g) => g.status === 'serving' && g.base.war >= 70 && g.base.war < 100); if (!gs.length) return; const g = pick(r, gs), n = 1 + Math.floor(r() * 2); g.base.war = Math.min(100, g.base.war + n); refresh(G, g); return ['training', { g: g.name, n }, g.fac, 1, { g: g.id }]; }],
  ['treasure', 3, (G, r) => {
    const loot = G.items.filter((it) => it.city != null); if (!loot.length) return;
    const it = pick(r, loot), c = G.cities[it.city], gs = G.gens.filter((g) => (g.status === 'serving' || g.status === 'free') && g.city === c.id); if (!gs.length) return;
    const g = pick(r, gs);
    if (!holds(G, g, it.slot)) give(G, it, g); else if (g.status === 'serving') stash(G, it, g.fac); else return;
    return ['itemFind', { g: g.name, c: c.name, it: it.key }, g.status === 'serving' ? g.fac : null, 2, { g: g.id }]; }],
  ['immortal', 2, (G, r) => {
    const all = ['lei', 'yao', 'feng', 'zhen', 'dun', 'huan', 'zhi'], gs = G.gens.filter((g) => (g.status === 'serving' || g.status === 'free') && g.base.int >= 75 && g.spells.length < 3);
    if (!gs.length) return; const g = pick(r, gs), sp = pick(r, all.filter((x) => !g.spells.includes(x))); learn(g, sp);
    return ['immortal', { g: g.name, s: sp }, g.status === 'serving' ? g.fac : null, 2, { g: g.id }]; }],
  ['refugees', 4, (G, r) => { const c = pick(r, ownedCities(G)); c.pop = Math.min(c.popMax, Math.round(c.pop * 1.08)); c.morale = Math.max(0, c.morale - 3); return ['refugees', { c: c.name }, c.owner, 1, { city: c.id }]; }],
  ['tournament', 2, (G, r) => {
    if (G.month > 3) return; const fs = living(G).filter((f) => gensOf(G, f.id).length >= 4); if (!fs.length) return;
    const f = pick(r, fs), gs = gensOf(G, f.id), g = maxBy(gs, (x) => x.war + r() * 20);
    for (const m of gs) m.loyalty = Math.min(100, m.loyalty + 3); g.merit += 5;
    return ['tournament', { f: f.name, g: g.name }, f.id, 1, { g: g.id }]; }],
  ['oath', 2, (G, r) => {
    const gs = G.gens.filter((g) => g.status === 'serving' && g.cha >= 70 && !g.sworn); if (gs.length < 2) return;
    const a = pick(r, gs), b = gs.find((x) => x !== a && x.fac === a.fac && x.city === a.city); if (!b) return;
    a.sworn = b.sworn = true; a.loyalty = Math.max(a.loyalty, 95); b.loyalty = Math.max(b.loyalty, 95);
    return ['oath', { a: a.name, b: b.name }, a.fac, 1, { g: a.id }]; }],
  ['edict', 2, (G, r) => { const fs = living(G).filter((f) => citiesOf(G, f.id).length >= 3); if (!fs.length) return; const f = pick(r, fs); for (const o of Object.keys(f.rel)) f.rel[o] = Math.min(100, f.rel[o] + 10); for (const c of citiesOf(G, f.id)) c.morale = Math.min(100, c.morale + 4); return ['edict', { f: f.name }, f.id, 1]; }],
  ['assassin', 1, (G, r) => { const f = pick(r, living(G)), g = G.gens[f.lord]; return [g.war + g.int > 120 || r() < 0.6 ? 'assassinFail' : 'assassinWound', { g: g.name }, f.id, 2, { g: g.id }]; }],
  ['granary', 2, (G, r) => { const c = pick(r, ownedCities(G)), f = G.factions[c.owner]; f.food = Math.round(f.food * 0.8); return ['granary', { c: c.name, f: f.name }, c.owner, 1, { city: c.id }]; }],
];
const EV_TOTAL = EVENTS.reduce((s, e) => s + e[1], 0);
function events(G) {
  const r = G.r, n = (r() < 0.6 ? 1 : 0) + (r() < 0.25 ? 1 : 0);      // a little under one event a month across the realm
  for (let i = 0; i < n; i++) {
    let x = r() * EV_TOTAL, ev = EVENTS[0]; for (const e of EVENTS) { x -= e[1]; if (x < 0) { ev = e; break; } }
    if (!ownedCities(G).length) return;
    const out = ev[2](G, r); if (!out) continue;
    const [key, p, fac, level, extra] = out; record(G, 'event', key, p, fac || null, level, extra || {});
  }
}

// ---------------------------------------------------------------- unrest: rebellions and wandering lords
function unrest(G) {
  const r = G.r;
  for (const c of G.cities) {
    if (!c.owner || !c.gov) continue;
    const gov = G.gens[c.gov], f = G.factions[c.owner];
    if (!gov || busy(gov) || f.lord === gov.id || sameKin(G, gov, lordOf(G, f.id)) || gov.loyalty > 55 || gov.lead + gov.cha < 110) continue;
    // a sprawling empire is hard to hold: the more cities, the likelier a governor rebels
    const n = citiesOf(G, f.id).length; if (n < 3 || r() > 0.006 + n / 1200) continue;
    // the governor declares himself a warlord
    const id = 'r' + G.nextFac++, colors = ['#e07a5a', '#5ae0c0', '#c05ae0', '#e0d05a', '#5a8ae0', '#e05a9a', '#9ae05a', '#5ae07a'];
    G.factions[id] = { id, name: gov.name, lordName: gov.name, color: colors[G.nextFac % colors.length], lord: gov.id, alive: true, gold: 400, food: 3000, rel: {}, allies: {}, truce: {}, capital: c.id, born: G.t, peak: 1, aggr: 0.9 + r() * 0.4, rebel: true };
    for (const o of Object.values(G.factions)) { G.factions[id].rel[o.id] = 0; o.rel[id] = 0; }
    G.factions[id].rel[f.id] = f.rel[id] = -80;
    c.owner = id; gov.fac = id; gov.loyalty = 100;
    for (const g of gensIn(G, Object.assign({}, c, { owner: f.id }))) if (g !== gov && r() < 0.5 + (60 - g.loyalty) / 100) { g.fac = id; g.loyalty = 70; }
    record(G, 'rebel', 'rebel', { g: gov.name, c: c.name, f: f.name }, id, 2, { g: gov.id });
  }
}
function checkFactions(G) {
  for (const f of Object.values(G.factions)) {
    if (!f.alive) continue;
    if (citiesOf(G, f.id).length === 0) {
      // a warlord with no city wanders with his men until someone takes him in, or gives up
      const members = gensOf(G, f.id);
      if (!members.length || G.r() < 0.08) destroy(G, f.id, null, 'scatter', { f: f.name });
      else { const lord = lordOf(G, f.id); const c = G.cities.find((x) => x.owner === null); if (c && G.r() < 0.15) { c.owner = f.id; lord.city = c.id; for (const m of members) m.city = c.id; c.troops += 2000; record(G, 'rise', 'rise', { f: f.name, c: c.name }, f.id, 2); } }
    }
  }
}

// ---------------------------------------------------------------- run many months (used by tools and the "skip" button)
export function run(G, months, until) { for (let i = 0; i < months && !G.over; i++) { step(G); if (until && until(G)) break; } return G; }

// ---------------------------------------------------------------- for the game: what the player does goes through these
export { siege, die, serve, captives, destroy, pickGovernor, record, give, stash, hide, refresh, holds, gensIn, freeIn, lordOf, hostile, allied, succession, frontDist, alive as factionAlive };
