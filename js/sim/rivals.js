// Rival heroes: N computer players, each a general who sets out as the player does. Every month each one does what a
// player would: fight bandits, take bounties, gather companions, travel, find treasure, duel famous generals, serve a
// lord and rise through the ranks by merit and by leading sieges of their own - or, famous enough, raise volunteers,
// take a city and become a warlord, whose realm the simulation then runs like any other. Their record (G.rivals) is
// kept like the player's, so at the end everyone is scored alike, and whoever unifies the realm wins outright.
import { initLife, gainLife, note } from './life.js';

import { RANKS as RANK_T } from '../data/ranks.js';
const RANK_AT = RANK_T.map((r) => r[1]), RANK_N = RANK_T.map((r) => r[0]);
export { RANK_N };
export const rankIdx = (m) => { let k = 0; RANK_AT.forEach((v, i) => { if (m >= v) k = i; }); return k; };
const total = (g) => g.lead + g.war + g.int + g.pol + g.cha;
// choose N rivals from the generals alive now, never the player. how: 'famous' - the great names, most likely the
// greatest; 'random' - anyone at all, every general as likely as another
export function pickRivals(G, n, pid, r, how = 'famous') {
  const adult = (g) => (g.status === 'serving' || g.status === 'free') && g.id !== pid && G.year - g.born >= 16 && g.died > G.year + 3;
  const pool = G.gens.filter((g) => adult(g) && (how === 'random' || (!g.hidden && total(g) >= 300 && g.died > G.year + 8)));
  const out = [];
  if (how === 'random') while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  else while (out.length < n && pool.length) { pool.sort((a, b) => total(b) + r() * 90 - (total(a) + r() * 90)); out.push(pool.splice(0, 1)[0]); }
  return out.map((g) => { const L = initLife(G, g); g.rivalHero = true; return { id: g.id, party: [], since: {}, sworn: [], met: [], lv: Math.max(1, Math.round((g.lead + g.war + g.int) / 30 - 3)), exp: 0, fame: Math.round(total(g) / 4), st: { wins: 0, battles: 0, bandits: 0, duels: 0, kills: [], cities: [], missions: 0, caves: 0, bestRank: g.status === 'serving' ? rankIdx(g.merit) : 0 }, alive: true }; });
}
// experience on the player's own curve (hero.js expNeed), so a rival's level means what the player's does
const need = (lv) => 30 + lv * lv * 18;
function gainR(G, R, g, n, favour, E) { R.lv ||= 1; R.exp = (R.exp || 0) + n; while (R.exp >= need(R.lv)) { R.exp -= need(R.lv); R.lv++; } gainLife(G, g, Math.round(n / 6), favour, E.refresh); if (g.life && g.life.lv < R.lv) g.life.lv = R.lv; }
// the generals in the city a rival is in: met (for their own encyclopedia)
function meet(G, R, g) { R.met ||= []; const seen = new Set(R.met); for (const y of G.gens) if (y.city === g.city && y !== g && (y.status === 'serving' || y.status === 'free') && !seen.has(y.id)) { R.met.push(y.id); seen.add(y.id); if (R.met.length % 40 === 0) break; } }
// some things a rival does at most once a month
export const ONCE = ['travel', 'serve', 'siege', 'rise', 'recruit', 'duel', 'treasure'];
// what a rival does next, by what it is now
export function pickAct(G, R, once = new Set()) {
  const r = G.r, g = G.gens[R.id], f = g.status === 'serving' && G.factions[g.fac], lord = f && f.lord === g.id, city = G.cities[g.city], lv = R.lv;
    const w = lord ? { rule: 6, duel: 1, bandit: 2 } : g.status === 'free'
      ? { bandit: 5, bounty: 3, cave: lv >= 8 ? 1 : 0, recruit: R.party.length < 4 ? 2 : 0, travel: 2, treasure: 1, duel: 1, serve: R.fame >= 150 ? 2 : 0, rise: R.fame >= 280 && R.party.length >= 2 ? 2 : 0 }
      : { bandit: 3, bounty: 3, cave: lv >= 8 ? 1 : 0, work: 2, recruit: R.party.length < 4 ? 1 : 0, duel: 1, siege: rankIdx(g.merit) >= 2 ? 3 : 0, treasure: 1, rise: R.fame >= 500 && g.loyalty < 50 ? 1 : R.fame >= 2500 && (g.life?.type === 'A' || g.loyalty < 75) ? 0.6 : 0 };
    for (const k of once) w[k] = 0;
    let t = 0; for (const k in w) t += w[k]; let x = r() * t, act = 'bandit'; for (const k in w) { x -= w[k]; if (x < 0) { act = k; break; } }
  return act;
}
// a rival does it (o.to: the city a journey ends in; o.tier: the cave)
export function rivalAct(G, R, act, E, o = {}) {
  const r = G.r, g = G.gens[R.id], f = g.status === 'serving' && G.factions[g.fac], lord = f && f.lord === g.id, city = G.cities[g.city], lv = R.lv;
    const merit = (n) => { if (g.status !== 'serving' || lord) return; const before = rankIdx(g.merit); g.merit += n; const after = rankIdx(g.merit); if (after > before) { R.st.bestRank = Math.max(R.st.bestRank, after); E.record(G, 'rival', 'rivalRank', { g: g.name, r: RANK_N[after], f: f.name }, g.fac, after >= 3 ? 2 : 1, { g: g.id }); } };
    const fight = (n, plus) => n * (10 + (lv + plus) * 7 + (90 + (lv + plus) * 28) / 22);
    if (act === 'bandit') { const n = 1 + Math.floor(r() * 4); R.st.battles += 1; if (r() < 0.88) { R.st.wins++; R.st.bandits += n; R.fame += n * 2; gainR(G, R, g, fight(n, 0), 'war', E); merit(1); } }
    if (act === 'bounty') { R.st.battles++; if (r() < 0.8) { R.st.wins++; R.st.missions++; R.fame += 20 + lv; gainR(G, R, g, fight(4, 2), null, E); merit(6); } }
    if (act === 'cave') { const tier = o.tier ?? 1 + Math.floor(r() * 3); R.st.battles += 3; if (r() < Math.min(0.9, 0.35 + (lv - tier * 4) / 20)) { R.st.wins += 3; R.st.caves++; R.fame += 20 + tier * 15; gainR(G, R, g, fight(3, tier * 2) * 3, 'war', E); merit(6 * tier); const hid = G.items.filter((it) => it.city === g.city); if (hid.length && r() < 0.35) { const it = hid[Math.floor(r() * hid.length)]; E.give(G, it, g); E.record(G, 'rival', 'rivalFind', { g: g.name, it: it.key }, g.fac, 2, { g: g.id }); } } }
    if (act === 'work') { merit(3); gainR(G, R, g, 20, 'pol', E); }
    if (act === 'travel' && city.adj.length) { g.city = o.to ?? city.adj[Math.floor(r() * city.adj.length)]; meet(G, R, g); gainR(G, R, g, 10, null, E); }
    if (act === 'recruit') {
      const cand = G.gens.filter((y) => y.status === (g.status === 'free' ? 'free' : 'serving') && y.city === g.city && !E.busy(y) && !y.rivalHero && (g.status === 'free' || (y.fac === g.fac && f.lord !== y.id)) && total(y) < total(g) + 40);
      const y = cand[Math.floor(r() * cand.length)];
      if (y && r() < 0.3 + g.cha / 300 + R.fame / 2000) { y.follow = g.id; R.party.push(y.id); R.fame += 4; E.record(G, 'rival', 'rivalJoin', { g: g.name, x: y.name }, g.fac, total(y) > 330 ? 2 : 1, { g: g.id }); }
    }
    if (act === 'treasure') { const hid = G.items.filter((it) => it.city === g.city); if (hid.length && r() < 0.25 + g.int / 400) { const it = hid[Math.floor(r() * hid.length)]; E.give(G, it, g); R.fame += 25; E.record(G, 'rival', 'rivalFind', { g: g.name, it: it.key }, g.fac, 2, { g: g.id }); } }
    if (act === 'duel') {
      const foes = G.gens.filter((y) => y.city === g.city && y.status === 'serving' && y.fac !== g.fac && !E.busy(y) && !y.isPlayer && y.war >= 70 && !y.rivalHero);
      const y = foes[Math.floor(r() * foes.length)];
      if (y) { R.st.duels++; const p = 1 / (1 + Math.exp(-(g.war + lv / 2 - y.war) / 8)); if (r() < p) { R.fame += 20; gainR(G, R, g, 40 + lv * 8, 'war', E); const yl = y.fac && G.factions[y.fac]?.lord === y.id; if (!yl && r() < 0.3) { R.st.kills.push(y.name); E.die(G, y, 'duel', g); E.record(G, 'rival', 'rivalKill', { g: g.name, x: y.name }, g.fac, 2, { g: g.id }); } } else R.st.duels--; }
    }
    if (act === 'serve' && city.owner && !E.hostileTo(G, city.owner, g)) {
      const F = G.factions[city.owner]; if (F && F.alive && r() < 0.4 + R.fame / 800) { E.serve(G, g, F.id, city.id, 80); for (const id of R.party) E.serve(G, G.gens[id], F.id, city.id, 80); E.record(G, 'rival', 'rivalServe', { g: g.name, f: F.name }, F.id, 2, { g: g.id }); }
    }
    if (act === 'siege' && f && city.owner === f.id && city.troops >= 4000) {
      const target = city.adj.map((a) => G.cities[a]).filter((c) => c.owner !== f.id && (c.owner === null || E.hostile(G, f.id, c.owner))).sort((a, b) => a.troops - b.troops)[0];
      if (target) {
        const army = [g, ...R.party.map((id) => G.gens[id])], troops = Math.min(Math.round(city.troops * 0.55), 2500 + lv * 250 + R.party.length * 800), before = target.owner;
        city.troops -= troops; R.st.battles++;
        E.siege(G, f, [city], target, army, troops, [troops], city.train);
        if (target.owner === f.id) { R.st.wins++; R.st.cities.push(target.name); R.fame += 80 + target.size * 30; merit(40 + target.size * 15); gainR(G, R, g, fight(5, 3), 'lead', E); E.record(G, 'rival', 'rivalTake', { g: g.name, c: target.name, f: f.name }, f.id, 2, { g: g.id }); for (const y of army) if (y.status === 'serving') y.city = target.id; }
        else merit(5);
      }
    }
    if (act === 'rise') { // volunteers flock to a famous name: take a weak city near and be a warlord
      const near = [city, ...city.adj.map((a) => G.cities[a])].filter((c) => c.owner === null || (c.owner !== g.fac && c.troops < 6000)).sort((a, b) => a.troops - b.troops)[0];
      if (near) {
        const vol = Math.round(R.fame * 8 + R.party.length * 600 + lv * 100), win = vol * (1 + g.lead / 200) > near.troops * (1.3 + near.def / 1500) * (0.8 + r() * 0.5);
        R.st.battles++;
        if (win) {
          if (g.status === 'serving') { const old = G.factions[g.fac]; E.record(G, 'rival', 'rivalLeave', { g: g.name, f: old.name }, old.id, 2, { g: g.id }); }
          const id = 'rv' + g.id, prev = near.owner;
          G.factions[id] = { id, name: g.name, lordName: g.name, color: ['#e85ae8', '#5ae8e8', '#e8e85a', '#5a5ae8', '#e8905a', '#90e85a', '#e85a90', '#5ae890'][g.id % 8], lord: g.id, alive: true, gold: 500, food: 4000, rel: {}, allies: {}, truce: {}, capital: near.id, born: G.t, peak: 1, aggr: 1.1 };
          for (const o of Object.values(G.factions)) if (o.id !== id) { G.factions[id].rel[o.id] = 0; o.rel[id] = 0; }
          if (prev) { G.factions[id].rel[prev] = G.factions[prev].rel[id] = -60; }
          near.owner = id; near.troops = Math.max(1500, Math.round(vol * 0.6)); near.gov = g.id;
          E.serve(G, g, id, near.id, 100); for (const pid of R.party) { E.serve(G, G.gens[pid], id, near.id, 90); G.gens[pid].follow = null; } R.party = [];
          R.st.wins++; R.st.cities.push(near.name); R.fame += 120;
          E.record(G, 'rival', 'rivalRise', { g: g.name, c: near.name }, id, 3, { g: g.id });
          if (prev && G.factions[prev]?.alive && E.citiesOf(G, prev).length === 0) E.destroy(G, prev, id, 'lastCity', { f: G.factions[prev].name, c: near.name });
        }
      }
    }
    if (act === 'rule') { R.fame += 3 + E.citiesOf(G, g.fac).length; gainR(G, R, g, 30, 'lead', E); }
}
export function rivalsMonth(G, E) {
  const r = G.r;
  for (const R of G.rivals || []) {
    const g = G.gens[R.id];
    if (!R.alive) continue;
    if (g.status === 'dead') { R.alive = false; for (const id of R.party) G.gens[id].follow = null; R.party = []; E.record(G, 'rival', 'rivalDie', { g: g.name }, g.fac, 2, { g: g.id }); continue; }
    if (g.status !== 'serving' && g.status !== 'free') continue;
    R.st.caves ||= 0; R.since ||= {}; R.sworn ||= []; R.lv ||= Math.max(1, g.life?.lv || 1);
    const lord0 = g.status === 'serving' && G.factions[g.fac]?.lord === g.id;
    // companions go where the hero goes; a lord's companions serve the realm on their own
    R.party = R.party.filter((id) => G.gens[id].status !== 'dead' && G.gens[id].follow === g.id);
    for (const id of R.party) { const x = G.gens[id]; x.city = g.city; if (lord0) x.follow = null; R.since[id] ??= G.t; if (!R.sworn.includes(id) && R.sworn.length < 3 && G.t - R.since[id] >= 24) { R.sworn.push(id); x.loyalty = 100; } }
    if (lord0) R.party = [];
    meet(G, R, g);
    // as busy as the player: G.pace is how many fights the player has had a month lately (set by the game; 4 without one).
    // In the game (G.roam) a rival who is not a lord walks the land instead (roam.js) and acts where it arrives.
    const base = G.pace || 4, turns = lord0 ? Math.max(3, Math.round(base / 3)) : G.roam ? 0 : g.status === 'free' ? base + 1 : base, once = new Set();
    for (let turn = 0; turn < turns; turn++) {
      if (g.status === 'dead') break;
      const act = pickAct(G, R, once); if (ONCE.includes(act)) once.add(act);
      rivalAct(G, R, act, E);
    }
    R.once = [];
    // a lord's realm fights on its own: its victories since last month count for the lord
    if (g.status === 'serving' && G.factions[g.fac]?.lord === g.id) { for (let i = R.seen || 0; i < G.log.length; i++) { const e = G.log[i]; if (e.kind === 'war' && e.fac === g.fac) { R.st.battles++; if (e.win) { R.st.wins++; if (e.p?.c) R.st.cities.push(e.p.c); R.fame += 15; } } } R.peak = Math.max(R.peak || 0, E.citiesOf(G, g.fac).length); }
    R.seen = G.log.length;
  }
}
// the record of a rival, shaped like the player's, for the same reckoning at the end
export function rivalH(G, R) { const g = G.gens[R.id]; return { pid: R.id, st: { ren: 0, turns: 0, cruel: 0, tacs: 0, relief: 0, sages: 0, ...R.st }, fame: R.fame, rec: { [R.id]: { lv: R.lv || g.life?.lv || 1 } }, titles: [], sworn: R.sworn || [], dex: Object.fromEntries((R.met || []).map((id) => [id, 1])), changed: [] }; }
