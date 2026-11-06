// 大軍出征: the month's campaigns (G.camps: an army sets out in the monthly reckoning and reaches the walls in the next,
// see arrive() in sim/engine.js) are on the map all the month between: a general's banner and his column of men on the
// road from the city they left to the one they march on, a day's walk further each day. Walk up to the head of the
// column to talk: ride with them as the vanguard (fight the garrison's sortie: the city goes into the siege weaker),
// or, if they are no friends of yours, cut into them (each win thins the army; cut down to half, it turns back).
// A city of yours they march on is warned of them, and again when they are close.
import { CITY_POS } from './world.js';
import { LOOKS, soldierSheet } from './sprites.js';
import { allied } from './sim/engine.js';

const SEE = 40, MEN = 7;
const face = (x0, z0, x, z) => { const dx = x - x0, dz = z - z0; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; };

export class Armies {
  constructor(game, sheet) { this.g = game; this.sheet = sheet; this.drawn = new Map(); this.mapRef = null; this.warned = new Set(); this.hit = {}; this.out = new Set(); this.outKey = ''; }
  get G() { return this.g.G; }
  get list() { return this.G?.camps || []; }
  // the generals marching (the crowd does not walk them)
  busy(id) { const k = this.list.map((c) => c.id).join(','); if (k !== this.outKey) { this.outKey = k; this.out = new Set(this.list.flatMap((c) => c.army)); } return this.out.has(id); }
  // how far through the month: the armies are that far along the road
  prog() { const H = this.g.H; return Math.min(1, ((H.days % 30) + ((H.walk || 0) % 30) / 30) / 30); }
  where(c) {
    const p = this.g.crowd.road(c.from[0], c.target); if (!p) return null; const L = p.length - 1, now = this.prog();
    const i = c.back ? Math.max(0, Math.round(c.backI - (now - c.backP) * 2 * L)) : Math.round(now * L);
    return { p, i, at: p[i], dir: c.back ? -1 : 1 };
  }
  daysLeft() { return Math.max(0, 30 - (this.g.H.days % 30)); }
  label(c) {
    const G = this.G, f = G.factions[c.fac], g = G.gens[c.army[0]], t = G.cities[c.target];
    return `<b style="color:${f.color}">${f.name}軍・${g?.name || ''}</b><i style="color:#ffd8a0">${c.back ? '撤退中' : `兵${c.troops} → ${t.name}`}</i>`;
  }
  tick(dt) {
    const game = this.g, V = game.view; if (!V || !this.G) return;
    if (V.M !== this.mapRef) { this.mapRef = V.M; this.drawn.clear(); }
    if (game.mode !== 'world') return;
    const P = game.pos, live = new Set(), mine = game.myFaction();
    for (const c of this.list) {
      const w = this.where(c); if (!w) continue;
      // a warning for a city of ours, when they are near
      if (!c.back && c.def != null && c.def === mine && this.prog() > 0.75 && !this.warned.has(c.id)) { this.warned.add(c.id); game.ui.toast(`<b style="color:#ff8a6a">⚠ ${this.G.factions[c.fac].name}軍已逼近${this.G.cities[c.target].name}！</b><br><small>兵${c.troops}，再${this.daysLeft()}日攻城</small>`, 5000); }
      if (Math.hypot(w.at[0] - P.x, w.at[1] - P.z) > SEE) continue;
      live.add(c.id); let D = this.drawn.get(c.id);
      const f = this.G.factions[c.fac], g = this.G.gens[c.army[0]];
      if (!D) {
        const lead = V.addActor(this.sheet(game.lookOf(g)), w.at[0], w.at[1], { scale: 1.1 });
        const flag = V.addActor(soldierSheet('soldier', f.color, 'flag'), w.at[0], w.at[1], { scale: 1.15 });
        const men = Array.from({ length: MEN }, () => V.addActor(this.sheet(LOOKS.soldier(f.color)), w.at[0], w.at[1], { scale: 0.85 }));
        D = { lead, flag, men, key: '' }; this.drawn.set(c.id, D);
      }
      const key = c.troops + ':' + !!c.back; if (D.key !== key) { D.key = key; if (D.lead.label) V.removeLabel(D.lead.label); D.lead.label = V.addLabel(this.label(c), D.lead.sprite, 2, 'npc'); }
      // the column: the general at the head, his banner just behind, the men in two files behind that
      const at = (k) => w.p[Math.max(0, Math.min(w.p.length - 1, w.i - k * w.dir))];
      this.put(V, D.lead, at(0)[0], at(0)[1], dt); D.at = at(0);
      this.put(V, D.flag, at(1)[0] + 0.3, at(1)[1], dt);
      D.men.forEach((m, k) => { const q = at(2 + (k >> 1)); this.put(V, m, q[0] + (k % 2 ? 0.35 : -0.35), q[1] + 0.15, dt); });
    }
    for (const [id, D] of this.drawn) if (!live.has(id)) this.drop(V, id, D);
  }
  put(V, a, tx, tz, dt) {
    const k = Math.min(1, dt * 5), x0 = a.x, z0 = a.z; a.x += (tx - a.x) * k; a.z += (tz - a.z) * k;
    const d = Math.hypot(a.x - x0, a.z - z0); if (d > 0.003) { a.dir = face(x0, z0, a.x, a.z); a.walkT = (a.walkT || 0) + d; a.frame = Math.floor(a.walkT * 3) % 2 ? 0 : 2; } else a.frame = 1;
    a.y = Math.max(0, this.g.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a);
  }
  drop(V, id, D) { for (const a of [D.lead, D.flag, ...D.men]) V.removeActor(a); this.drawn.delete(id); }
  // the player walks up to the head of a column
  meet() {
    const game = this.g, P = game.pos, H = game.H; if (game.mode !== 'world' || game.auto?.on) return false;
    for (const c of this.list) {
      const D = this.drawn.get(c.id); if (!D?.at || c.back) continue;
      if (Math.abs(D.at[0] - P.x) > 1 || Math.abs(D.at[1] - P.z) > 1) continue;
      if ((this.hit[c.id] ?? -999) > H.walk - 12) continue;
      this.hit[c.id] = H.walk; this.talk(c); return true;
    }
    return false;
  }
  async talk(c) {
    const game = this.g, G = this.G, act = game.act, f = G.factions[c.fac], t = G.cities[c.target], g = G.gens[c.army[0]], mine = game.myFaction();
    const names = c.army.map((id) => G.gens[id]?.name).filter(Boolean).join('、');
    const info = `<b style="color:${f.color}">${f.name}軍</b>的大軍　將領：${names}\n兵 ${c.troops} 人，往${t.name}（${t.owner ? G.factions[t.owner].name + '軍' : '無主'}，守軍 ${t.troops}）進軍，再${this.daysLeft()}日兵臨城下。`;
    const opts = [];
    if (!c.vang && (mine === c.fac || !mine) && t.owner !== mine) opts.push({ k: 'van', n: '擔任先鋒', d: mine ? `先打${t.name}出城迎戰的守軍，讓城裡兵力變少` : '當傭兵先鋒，打贏有賞金' });
    if (!mine || (mine !== c.fac && !allied(G, mine, c.fac))) { opts.push({ k: 'cut', n: '截擊大軍', d: `和${g.name}的部隊交戰，削減他們的兵力（剩一半就會撤退）` }); opts.push({ k: 'ploy', n: '施計', d: '火攻、斷糧道、離間、散布謠言：不必正面交鋒' }); }
    opts.push({ k: null, n: '離開' });
    const k = await game.ui.ask(info, opts, g.name, game.lookOf(g));
    if (k === 'van') await act.vanguard(c);
    if (k === 'cut') await act.cutArmy(c);
    if (k === 'ploy') await game.ploys.menu(c);
  }
  // an army cut down to half turns back
  turnBack(c) { const w = this.where(c); c.back = true; c.backI = w ? w.i : 0; c.backP = this.prog(); }
  marks(x, s) {
    for (const c of this.list) {
      const w = this.where(c); if (!w) continue; const f = this.G.factions[c.fac], T = CITY_POS[c.target];
      x.strokeStyle = f.color; x.lineWidth = 1; x.setLineDash([2, 2]); x.beginPath(); x.moveTo(w.at[0] * s, w.at[1] * s); x.lineTo(T.x * s, T.y * s); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#000'; x.fillRect(w.at[0] * s - 3, w.at[1] * s - 3, 6, 6); x.fillStyle = f.color; x.fillRect(w.at[0] * s - 2, w.at[1] * s - 2, 4, 4);
    }
  }
}
