// 恩怨: the computer generals have their own brothers and enemies (G.ties). Sworn brothers (some from the histories,
// more as the years go by between officers of one city) ride out together; when one is killed, the others swear to
// avenge him on his killer. Sworn enemies hunt each other: on the road they fight it out man to man (crowd.js: watch,
// or take the place of one of them), and now and then the chronicle tells of a bout between them somewhere else.
import { record, die } from './sim/engine.js';

const OATHS = [['劉備', '關羽', '張飛'], ['孫策', '周瑜']];
const FEUDS = [['甘寧', '凌統'], ['孫堅', '黃祖'], ['張飛', '呂布'], ['關羽', '呂蒙'], ['馬超', '曹操'], ['太史慈', '孫策']];
const able = (g) => !!g && (g.status === 'serving' || g.status === 'free') && !g.isPlayer;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Ties {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; }
  get T() {
    const G = this.G; if (G.ties) return G.ties; const T = G.ties = { sworn: [], feud: [] }, by = (n) => G.gens.find((g) => g.name === n && able(g));
    for (const o of OATHS) { const gs = o.map(by).filter(Boolean); if (gs.length >= 2) T.sworn.push(gs.map((g) => g.id)); }
    for (const [a, b] of FEUDS) { const x = by(a), y = by(b); if (x && y) T.feud.push([x.id, y.id]); }
    // and some of no story: officers of one city, and strong men of enemy sides
    const live = G.gens.filter((g) => able(g) && g.status === 'serving'), used = new Set(T.sworn.flat());
    for (let k = 0; k < 400 && T.sworn.length < 12; k++) { const a = pick(live), b = pick(live); if (a !== b && a.city === b.city && a.fac === b.fac && !used.has(a.id) && !used.has(b.id) && Math.abs(a.war - b.war) < 25) { T.sworn.push([a.id, b.id]); used.add(a.id); used.add(b.id); } }
    const strong = live.filter((g) => g.war >= 72);
    for (let k = 0; k < 400 && T.feud.length < 14; k++) { const a = pick(strong), b = pick(strong); if (a && b && a !== b && a.fac !== b.fac && !this.feuding(a.id, b.id, T)) T.feud.push([a.id, b.id]); }
    return T;
  }
  brothers(id) { const s = this.T.sworn.find((s) => s.includes(id)); return s ? s.filter((x) => x !== id) : []; }
  foes(id) { return this.T.feud.filter((f) => f.includes(id)).map((f) => (f[0] === id ? f[1] : f[0])); }
  feuding(a, b, T = this.T) { return T.feud.some((f) => (f[0] === a && f[1] === b) || (f[0] === b && f[1] === a)); }
  // of a group of sworn brothers in one city, the one the others ride with
  leadIn(g) { const G = this.G, bs = this.brothers(g.id).filter((id) => G.gens[id]?.city === g.city && G.gens[id].status === g.status); return bs.length ? Math.min(g.id, ...bs) : g.id; }
  // the month: new oaths, vows of revenge for the fallen, and a bout between enemies somewhere
  month(logs) {
    const G = this.G, T = this.T;
    for (const e of logs) {
      if (e.key !== 'death' || !e.p.by) continue; const dead = G.gens[e.g], killer = G.gens.find((x) => x.name === e.p.by && able(x)); if (!dead || !killer) continue;
      for (const b of this.brothers(dead.id)) { const x = G.gens[b]; if (!able(x) || x.id === killer.id || this.feuding(x.id, killer.id)) continue; T.feud.push([x.id, killer.id]); record(G, 'tie', 'vow', { a: x.name, b: dead.name, c: killer.name }, x.status === 'serving' ? x.fac : null, 2, { g: x.id }); }
    }
    T.sworn = T.sworn.map((s) => s.filter((id) => G.gens[id]?.status !== 'dead')).filter((s) => s.length >= 2);
    T.feud = T.feud.filter(([a, b]) => able(G.gens[a]) && able(G.gens[b]));
    if (Math.random() < 0.25) {
      const live = G.gens.filter((g) => able(g) && g.status === 'serving' && !this.brothers(g.id).length), a = pick(live), b = a && pick(live.filter((x) => x !== a && x.city === a.city && x.fac === a.fac));
      if (a && b) { T.sworn.push([a.id, b.id]); record(G, 'tie', 'tieOath', { a: a.name, b: b.name, c: G.cities[a.city].name }, a.fac, 1, { g: a.id }); }
    }
    for (const [a, b] of T.feud) {
      const x = G.gens[a], y = G.gens[b], cx = G.cities[x.city], cy = G.cities[y.city]; if (!able(x) || !able(y) || !cx || !cy || (x.city !== y.city && !cx.adj.includes(y.city)) || Math.random() > 0.08) continue;
      const roll = x.war - y.war + (Math.random() - 0.5) * 40, [w, l] = roll >= 0 ? [x, y] : [y, x], killed = Math.abs(roll) > 22 && Math.random() < 0.3 && l.war < 95 && G.factions[l.fac]?.lord !== l.id;
      record(G, 'tie', 'feudDuel', { w: w.name, l: l.name, c: cx.name, killed }, w.status === 'serving' ? w.fac : null, killed || w.war + l.war > 180 ? 2 : 1, { g: w.id });
      if (killed) die(G, l, 'duel', w); w.duelsWon = (w.duelsWon || 0) + 1;
    }
  }
  // for a talk: who he is sworn to, and who he hates
  info(x) {
    const G = this.G, b = this.brothers(x.id).map((id) => G.gens[id]?.name).filter(Boolean), f = this.foes(x.id).map((id) => G.gens[id]?.name).filter(Boolean);
    return (b.length ? `\n<b style="color:#8ad8ff">結義兄弟：${b.join('、')}</b>` : '') + (f.length ? `\n<b style="color:#ff8a6a">宿敵：${f.join('、')}</b>` : '');
  }
}
