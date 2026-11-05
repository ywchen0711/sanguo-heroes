// Rival heroes: N computer players, each a general who sets out as the player does. Every month each one does what a
// player would: fight bandits, take bounties, gather companions, travel, find treasure, duel famous generals, serve a
// lord and rise through the ranks by merit and by leading sieges of their own - or, famous enough, raise volunteers,
// take a city and become a warlord, whose realm the simulation then runs like any other. Their record (G.rivals) is
// kept like the player's, so at the end everyone is scored alike, and whoever unifies the realm wins outright.
import { initLife, gainLife, note } from './life.js';

const RANK_AT = [0, 40, 100, 200, 350, 600], RANK_N = ['從事', '校尉', '都尉', '中郎將', '將軍', '大將軍'];
export const rankIdx = (m) => { let k = 0; RANK_AT.forEach((v, i) => { if (m >= v) k = i; }); return k; };
const total = (g) => g.lead + g.war + g.int + g.pol + g.cha;
// choose N rivals from the generals alive now: famous ones more often, never the player
export function pickRivals(G, n, pid, r) {
  const pool = G.gens.filter((g) => (g.status === 'serving' || g.status === 'free') && g.id !== pid && !g.hidden && total(g) >= 240 && G.year - g.born >= 16 && g.died > G.year + 8);
  const out = [];
  while (out.length < n && pool.length) { pool.sort((a, b) => total(b) + r() * 120 - (total(a) + r() * 120)); const g = pool.splice(0, 1)[0]; out.push(g); }
  return out.map((g) => { initLife(G, g); g.rivalHero = true; return { id: g.id, party: [], fame: Math.round(total(g) / 4), st: { wins: 0, battles: 0, bandits: 0, duels: 0, kills: [], cities: [], missions: 0, bestRank: g.status === 'serving' ? rankIdx(g.merit) : 0 }, alive: true }; });
}
export function rivalsMonth(G, E) {
  const r = G.r;
  for (const R of G.rivals || []) {
    const g = G.gens[R.id];
    if (!R.alive) continue;
    if (g.status === 'dead') { R.alive = false; for (const id of R.party) G.gens[id].follow = null; R.party = []; E.record(G, 'rival', 'rivalDie', { g: g.name }, g.fac, 2, { g: g.id }); continue; }
    if (g.status !== 'serving' && g.status !== 'free') continue;
    const f = g.status === 'serving' && G.factions[g.fac], lord = f && f.lord === g.id, city = G.cities[g.city];
    // companions go where the hero goes; a lord's companions serve the realm on their own
    R.party = R.party.filter((id) => G.gens[id].status !== 'dead' && G.gens[id].follow === g.id);
    for (const id of R.party) { const x = G.gens[id]; x.city = g.city; if (lord) x.follow = null; }
    if (lord) R.party = [];
    const lv = (g.life || initLife(G, g)).lv, power = total(g) + lv * 6 + R.party.length * 60;
    const w = lord ? { rule: 6, duel: 1 } : g.status === 'free'
      ? { bandit: 4, bounty: 2, recruit: R.party.length < 4 ? 2 : 0, travel: 2, treasure: 1, duel: 1, serve: R.fame >= 150 ? 2 : 0, rise: R.fame >= 280 && R.party.length >= 2 ? 2 : 0 }
      : { bandit: 2, bounty: 3, work: 2, recruit: R.party.length < 3 ? 1 : 0, duel: 1, siege: rankIdx(g.merit) >= 1 ? 3 : 0, treasure: 1, rise: R.fame >= 500 && g.loyalty < 50 ? 1 : 0 };
    let t = 0; for (const k in w) t += w[k]; let x = r() * t, act = 'bandit'; for (const k in w) { x -= w[k]; if (x < 0) { act = k; break; } }
    const merit = (n) => { if (g.status !== 'serving' || lord) return; const before = rankIdx(g.merit); g.merit += n; const after = rankIdx(g.merit); if (after > before) { R.st.bestRank = Math.max(R.st.bestRank, after); E.record(G, 'rival', 'rivalRank', { g: g.name, r: RANK_N[after], f: f.name }, g.fac, after >= 3 ? 2 : 1, { g: g.id }); } };
    if (act === 'bandit') { const n = 1 + Math.floor(r() * 3); R.st.battles += 1; if (r() < 0.85) { R.st.wins++; R.st.bandits += n; R.fame += 2 + n; gainLife(G, g, 30, 'war', E.refresh); merit(1); } }
    if (act === 'bounty') { R.st.battles++; if (r() < 0.75) { R.st.wins++; R.st.missions++; R.fame += 12; gainLife(G, g, 40, null, E.refresh); merit(8); } }
    if (act === 'work') { merit(4); gainLife(G, g, 16, 'pol', E.refresh); }
    if (act === 'travel' && city.adj.length) { g.city = city.adj[Math.floor(r() * city.adj.length)]; gainLife(G, g, 8, null, E.refresh); }
    if (act === 'recruit') {
      const cand = G.gens.filter((y) => y.status === (g.status === 'free' ? 'free' : 'serving') && y.city === g.city && !E.busy(y) && !y.rivalHero && (g.status === 'free' || (y.fac === g.fac && f.lord !== y.id)) && total(y) < total(g) + 40);
      const y = cand[Math.floor(r() * cand.length)];
      if (y && r() < 0.3 + g.cha / 300 + R.fame / 2000) { y.follow = g.id; R.party.push(y.id); R.fame += 4; E.record(G, 'rival', 'rivalJoin', { g: g.name, x: y.name }, g.fac, total(y) > 330 ? 2 : 1, { g: g.id }); }
    }
    if (act === 'treasure') { const hid = G.items.filter((it) => it.city === g.city); if (hid.length && r() < 0.25 + g.int / 400) { const it = hid[Math.floor(r() * hid.length)]; E.give(G, it, g); R.fame += 25; E.record(G, 'rival', 'rivalFind', { g: g.name, it: it.key }, g.fac, 2, { g: g.id }); } }
    if (act === 'duel') {
      const foes = G.gens.filter((y) => y.city === g.city && y.status === 'serving' && y.fac !== g.fac && !E.busy(y) && !y.isPlayer && y.war >= 70 && !y.rivalHero);
      const y = foes[Math.floor(r() * foes.length)];
      if (y) { R.st.duels++; const p = 1 / (1 + Math.exp(-(g.war + lv / 2 - y.war) / 8)); if (r() < p) { R.fame += 20; gainLife(G, g, 50, 'war', E.refresh); const yl = y.fac && G.factions[y.fac]?.lord === y.id; if (!yl && r() < 0.3) { R.st.kills.push(y.name); E.die(G, y, 'duel', g); E.record(G, 'rival', 'rivalKill', { g: g.name, x: y.name }, g.fac, 2, { g: g.id }); } } else R.st.duels--; }
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
        if (target.owner === f.id) { R.st.wins++; R.st.cities.push(target.name); R.fame += 60 + target.size * 20; merit(30 + target.size * 10); E.record(G, 'rival', 'rivalTake', { g: g.name, c: target.name, f: f.name }, f.id, 2, { g: g.id }); for (const y of army) if (y.status === 'serving') y.city = target.id; }
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
    if (act === 'rule') { R.fame += 3 + E.citiesOf(G, g.fac).length; gainLife(G, g, 14, 'lead', E.refresh); }
    // a lord's realm fights on its own: its victories since last month count for the lord
    if (lord) { for (let i = R.seen || 0; i < G.log.length; i++) { const e = G.log[i]; if (e.kind === 'war' && e.fac === g.fac) { R.st.battles++; if (e.win) { R.st.wins++; if (e.p?.c) R.st.cities.push(e.p.c); R.fame += 15; } } } R.peak = Math.max(R.peak || 0, E.citiesOf(G, g.fac).length); }
    R.seen = G.log.length;
  }
}
// the record of a rival, shaped like the player's, for the same reckoning at the end
export function rivalH(G, R) { const g = G.gens[R.id]; return { pid: R.id, st: R.st, fame: R.fame, rec: { [R.id]: { lv: g.life?.lv || 1 } }, titles: [], sworn: [], dex: {}, changed: [] }; }
