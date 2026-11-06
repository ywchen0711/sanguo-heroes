// 天下眾生: every general of the land walks the map, as in an MMO: officers ride out of their city on patrol, after
// bandits or to drill the troops and come back, ride to a new post when their lord sends them there, and free men
// roam the country round the town they are in. The rivals (roam.js) are their own; the player's people and the lords
// (who keep to their halls) are not in the crowd. What the crowd does is only seen: the realm's work is still the
// monthly reckoning of sim/engine.js, so a general is where the reckoning says (g.city) and walks there if he is not.
//
// It costs almost nothing however many there are: a general's walk is a path and the step it began on, so where he
// is now is read off it (no work for each step), the paths are shared (between two cities, or out of a city and
// back: a few for each city, found once), and only the nearest are drawn. A long rest (days at the inn) just puts
// everyone back home.
import { CITY_POS, T, K } from './world.js';
import { busy } from './sim/engine.js';

const SEE = 30, KEEP = 34, MAX = 36, LOOPS = 5;
const KIND_N = { patrol: '巡邏', hunt: '討賊', drill: '操練', post: '赴任', wander: '雲遊' };
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Crowd {
  constructor(game, sheet) { this.g = game; this.sheet = sheet; this.now = 0; this.N = new Map(); this.bodies = new Map(); this.paths = new Map(); this.mapRef = null; this.Gref = null; this.met = new Map(); }
  get G() { return this.g.G; }
  // a new game or a loaded one: nobody has been anywhere yet
  sync() { if (this.Gref !== this.G) { this.Gref = this.G; this.N.clear(); this.paths.clear(); this.gates = null; } }
  // the steps of the land go by (the player walks one, or rests a day: thirty)
  step(n = 1) { this.now += n; }
  // who is in the crowd
  who(g) {
    if (!g || g.isPlayer || g.rivalHero || g.held || busy(g) || (g.status !== 'serving' && g.status !== 'free') || g.city == null || !CITY_POS[g.city]) return false;
    return !(g.status === 'serving' && this.G.factions[g.fac]?.lord === g.id);
  }
  // the land just outside a city's walls, where a walk out of it starts
  gate(cid) { this.gates ||= {}; if (!(cid in this.gates)) { const c = CITY_POS[cid]; this.gates[cid] = this.g.roam.free(c.x, c.y + 2) || this.g.roam.free(c.x, c.y); } return this.gates[cid]; }
  // the road between two cities (found once)
  road(a, b) {
    const k = a + '>' + b; if (this.paths.has(k)) return this.paths.get(k);
    const s = this.gate(a), p = s && this.g.roam.path(s[0], s[1], this.g.roam.near(b)); const out = p && p.length ? [s, ...p] : null;
    this.paths.set(k, out); return out;
  }
  // a ride out of a city and back (a few for each city, found once)
  loop(cid) {
    const k = 'o' + cid; let L = this.paths.get(k); if (!L) this.paths.set(k, L = []);
    if (L.length < LOOPS) {
      const s = this.gate(cid), M = this.g.world;
      if (s) for (let t = 0; t < 12; t++) {
        const ang = Math.random() * Math.PI * 2, d = R(6, Math.round(14 * K)), x = Math.round(s[0] + Math.cos(ang) * d), z = Math.round(s[1] + Math.sin(ang) * d), w = M.at(x, z);
        if (w === T.CITY || w === T.COUNTY || w === T.VILLAGE || w === T.CAVE) continue;
        const p = this.g.roam.path(s[0], s[1], (px, pz) => px === x && pz === z);
        if (p && p.length >= 3) { const out = [s, ...p]; L.push([...out, ...out.slice(0, -1).reverse()]); break; }
      }
    }
    return L.length ? L[Math.floor(Math.random() * L.length)] : null;
  }
  // a stay in a city (in its streets: the town shows him)
  stay(g, cid, t0) { const long = g.status === 'serving' ? R(30, 120) : R(15, 60); return { kind: 'stay', cid, t0, end: t0 + long }; }
  // what he does after s
  next(g, s) {
    const t0 = s.end;
    if (s.kind !== 'stay') return this.stay(g, s.cid, t0);
    // sent to another city (or moved on): he rides there
    if (s.cid !== g.city) { const p = this.road(s.cid, g.city); return p ? { kind: g.status === 'serving' ? 'post' : 'wander', cid: g.city, path: p, t0, end: t0 + p.length, to: this.G.cities[g.city]?.name } : this.stay(g, g.city, t0); }
    const p = this.loop(s.cid); if (!p) return this.stay(g, s.cid, t0);
    const kind = g.status === 'free' ? 'wander' : ['patrol', 'patrol', 'hunt', 'drill'][R(0, 3)];
    return { kind, cid: s.cid, path: p, t0, end: t0 + p.length };
  }
  // where he is and what he is doing now
  cur(g) {
    this.sync();
    let s = this.N.get(g.id);
    if (!s || this.now - s.end > 400) { s = this.stay(g, g.city, this.now - R(0, 200)); if (s.end <= this.now) s.end = this.now + R(5, 60); }
    for (let k = 0; this.now >= s.end && k < 6; k++) s = this.next(g, s);
    this.N.set(g.id, s); return s;
  }
  // back to his city at once (beaten on the road)
  home(g) { this.sync(); this.N.set(g.id, this.stay(g, g.city, this.now)); }
  posOf(s) { return s.path ? s.path[Math.max(0, Math.min(s.path.length - 1, this.now - s.t0))] : null; }
  // out on the land: where, or null in a city
  out(g) { if (!this.who(g)) return null; return this.posOf(this.cur(g)); }
  // the town shows him if he is in it (and anyone the crowd does not walk)
  inCity(g, cid) { if (!this.who(g)) return true; const s = this.cur(g); return s.kind === 'stay' && s.cid === cid; }
  // ---------------------------------------------------------------- drawn on the land
  label(g, s) {
    const f = g.status === 'serving' && this.G.factions[g.fac], col = f?.color || '#b8c8a0', side = f ? f.name : '在野';
    return `<b>${g.name}</b><i style="color:${col}">${side}・${KIND_N[s.kind] || ''}${s.kind === 'post' && s.to ? s.to : ''}</i>`;
  }
  tick(dt) {
    const game = this.g, V = game.view; if (!V || !this.G) return;
    if (V.M !== this.mapRef) { this.mapRef = V.M; this.bodies.clear(); }
    if (game.mode !== 'world') return;
    const P = game.pos, near = [];
    for (const g of this.G.gens) {
      if (!this.who(g)) continue;
      const s = this.cur(g), p = this.posOf(s); if (!p) continue;
      const d = Math.hypot(p[0] - P.x, p[1] - P.z); if (d > (this.bodies.has(g.id) ? KEEP : SEE)) continue;
      near.push([d, g, s, p]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const live = new Set();
    for (const [, g, s, [tx, tz]] of near.slice(0, MAX)) {
      live.add(g.id); let B = this.bodies.get(g.id);
      if (!B) { const a = V.addActor(this.sheet(game.lookOf(g)), tx, tz); a.label = V.addLabel(this.label(g, s), a.sprite, 1.75, 'npc'); B = { id: g.id, a, at: [tx, tz], from: null, mt: 1, s }; this.bodies.set(g.id, B); }
      if (B.s !== s) { B.s = s; B.a.label.el.innerHTML = this.label(g, s); }
      const a = B.a;
      if (B.at[0] !== tx || B.at[1] !== tz) { B.from = [a.x, a.z]; B.at = [tx, tz]; B.mt = 0; }
      if (B.from && B.mt < 1) { B.mt = Math.min(1, B.mt + dt * 6); a.x = B.from[0] + (tx - B.from[0]) * B.mt; a.z = B.from[1] + (tz - B.from[1]) * B.mt; a.frame = Math.floor(B.mt * 6) % 2 ? 0 : 2; const dx = tx - B.from[0], dz = tz - B.from[1]; if (dx || dz) a.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; }
      else { a.x = tx; a.z = tz; a.frame = 1; }
      a.y = Math.max(0, game.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a);
    }
    for (const [id, B] of this.bodies) if (!live.has(id)) { V.removeActor(B.a); this.bodies.delete(id); }
  }
  // the player walks into one of them on the road: they talk (now and then: not every step through a crowd)
  meet() {
    const game = this.g, P = game.pos, H = game.H; if (game.mode !== 'world' || game.auto?.on) return false;
    for (const B of this.bodies.values()) {
      if (B.at[0] !== P.x || B.at[1] !== P.z) continue;
      const g = this.G.gens[B.id]; if (!this.who(g) || (this.met.get(g.id) ?? -999) > H.walk - 90) continue;
      this.met.set(g.id, H.walk); B.s.end += 3; game.act.talk({ gen: g.id, a: B.a, x: B.at[0], z: B.at[1], road: true, kind: B.s.kind }); return true;
    }
    return false;
  }
  // the minimap: a small dot for each one out on the land, in the colour of his side
  marks(x, s) {
    if (!this.G) return;
    for (const g of this.G.gens) { if (!this.who(g)) continue; const p = this.posOf(this.cur(g)); if (!p) continue; x.fillStyle = (g.status === 'serving' && this.G.factions[g.fac]?.color) || '#d8d8c0'; x.fillRect(p[0] * s - 1, p[1] * s - 1, 2, 2); }
  }
}
