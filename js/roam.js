// The rival heroes on the land: each one who is not a lord walks the map as the player does, a tile for each of the
// player's steps (so they stop when the player stops: in a town, in a battle), picks something to do (rivals.js
// pickAct), goes there and does it on arrival (rivalAct): bandits out in the wilds, a bounty further off, a cave whose
// master it beats (the cave stays 平定 for a year, then a new master moves in), a journey to the next city, or work,
// recruiting, a treasure hunt, a duel, service, a siege or a rising in the city it is in. Meet one on the road and you
// can talk to them. Their bodies are drawn when they are near; the minimap shows them all.
import { pickAct, rivalAct, ONCE } from './sim/rivals.js';
import { rivalE } from './sim/engine.js';
import { CITY_POS, WALK, T, ENC, K } from './world.js';

// a rival meets bandits on the road less often than the player does: it never stops to fight them
const ROAD = 0.12;
// and rests between deeds: a day is thirty steps, so a rival does about as much in a month as when it was ten
const REST = 3;
const WAIT = { bandit: 2, bounty: 5, cave: 20, travel: 5, work: 20, recruit: 10, treasure: 10, duel: 5, serve: 10, siege: 20, rise: 20 };
const IN_CITY = new Set(['work', 'recruit', 'treasure', 'duel', 'serve', 'siege', 'rise']);
const ACT_N = { bandit: '討賊', bounty: '追捕賊首', cave: '探洞', travel: '前往', work: '辦事', recruit: '招募', treasure: '尋寶', duel: '找人比武', serve: '求見', siege: '出征', rise: '起兵' };
const PLACE = new Set([T.CITY, T.COUNTY, T.VILLAGE, T.CAVE]);

export class Roam {
  constructor(game, sheet) { this.g = game; this.sheet = sheet; this.bodies = new Map(); this.mapRef = null; }
  get G() { return this.g.G; }
  // the rivals who walk: alive, not a lord
  walkers() { const G = this.G; return (G?.rivals || []).filter((R) => { const g = G.gens[R.id]; return R.alive && (g.status === 'free' || (g.status === 'serving' && G.factions[g.fac]?.lord !== g.id)); }); }
  near(id) { const c = CITY_POS[id], R = c.size >= 3 ? 2 : 1; return (x, z) => Math.abs(x - c.x) <= R + 1 && Math.abs(z - c.y) <= R + 1; }
  start(R) { if (R.pos) return; const g = this.G.gens[R.id], c = CITY_POS[g.city] || CITY_POS[0]; R.pos = this.free(c.x, c.y + 3) || [c.x, c.y]; R.inside = g.city; R.wait = Math.floor(Math.random() * 20); }
  free(x, z) { const M = this.g.world; for (let r = 0; r < 10; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const t = M.at(x + dx, z + dz); if (WALK[t] && !PLACE.has(t)) return [x + dx, z + dz]; } return null; }
  // a path over the land, around towns and caves unless one is the goal
  path(sx, sz, goal) {
    const M = this.g.world, W = M.W, H = M.H; if (!this.prev || this.prev.length !== W * H) this.prev = new Int32Array(W * H);
    const prev = this.prev.fill(-1), q = [sz * W + sx]; prev[q[0]] = q[0];
    for (let h = 0; h < q.length && h < 120000; h++) {
      const k = q[h], x = k % W, z = (k - x) / W;
      if (goal(x, z)) { const out = []; let c = k; while (c !== q[0]) { out.push([c % W, Math.floor(c / W)]); c = prev[c]; } return out.reverse(); }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const nk = nz * W + nx; if (prev[nk] >= 0) continue; const t = M.at(nx, nz); if (!WALK[t] || (PLACE.has(t) && !goal(nx, nz))) continue; prev[nk] = k; q.push(nk); }
    }
    return null;
  }
  wild(R, a, b) { const M = this.g.world; for (let k = 0; k < 20; k++) { const ang = Math.random() * Math.PI * 2, d = a + Math.random() * (b - a), x = Math.round(R.pos[0] + Math.cos(ang) * d), z = Math.round(R.pos[1] + Math.sin(ang) * d), t = M.at(x, z); if (WALK[t] && !PLACE.has(t)) return [x, z]; } return null; }
  // what next, and where
  choose(R) {
    const G = this.G, g = G.gens[R.id], once = new Set(R.once || []); let act = pickAct(G, R, once); if (ONCE.includes(act)) (R.once ||= []).push(act);
    let o = { act }, goal = null;
    if (act === 'cave') { const q = this.cave(R); if (q) { o.tier = q.tier; o.place = q.id; o.label = q.name; goal = (x, z) => x === q.x && z === q.y; } else act = o.act = 'bandit'; }
    if (act === 'travel') { const C = G.cities[g.city], to = C?.adj.length ? C.adj[Math.floor(Math.random() * C.adj.length)] : null; if (to == null) { R.wait = 10; return; } o.to = to; o.label = G.cities[to].name; goal = this.near(to); }
    if (IN_CITY.has(act)) { goal = this.near(g.city); o.label = G.cities[g.city]?.name; }
    if (act === 'bandit' || act === 'bounty') { const p = act === 'bandit' ? this.wild(R, 4, 11) : this.wild(R, 10 * K, 20 * K); if (!p) { R.wait = 5; return; } goal = (x, z) => x === p[0] && z === p[1]; }
    const path = goal(R.pos[0], R.pos[1]) ? [] : this.path(R.pos[0], R.pos[1], goal);
    if (!path) { R.wait = 10; return; }
    R.goal = o; R.path = path; R.inside = null; this.say(R);
  }
  // the nearest cave whose master the rival could take on
  cave(R) {
    const H = this.g.H; let best = null, bd = 45 * K;
    for (const q of this.g.world.places) { if (q.kind !== 'cave' || H.places?.[q.id]?.boss || q.tier * 4 > R.lv + 2) continue; const d = Math.hypot(q.x - R.pos[0], q.y - R.pos[1]); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  arrive(R) {
    const G = this.G, g = G.gens[R.id], o = R.goal; R.goal = null; R.path = null;
    const w0 = R.st.wins, c0 = R.st.caves;
    rivalAct(G, R, o.act, rivalE(), { to: o.to, tier: o.tier });
    if (IN_CITY.has(o.act) || o.act === 'travel') R.inside = g.city;
    if (o.act === 'cave' && R.st.caves > c0) { const st = ((this.g.H.places ||= {})[o.place] ||= { chests: [], odd: [], boss: false }); st.boss = true; st.by = g.name; st.byT = G.t; }
    R.wait = (WAIT[o.act] || 10) * REST;
    const B = this.bodies.get(R.id);
    if (B && R.st.wins > w0) this.pop(B, o.act === 'cave' ? `平定${o.label}！` : o.act === 'bounty' ? '擒獲賊首！' : '擊退山賊！');
  }
  // n steps of the land go by for everyone
  step(n = 1) {
    if (!this.G?.roam || !this.g.world) return;
    for (let i = 0; i < n; i++) for (const R of this.walkers()) {
      this.start(R);
      if (R.wait > 0) { R.wait--; continue; }
      if (!R.goal) { this.choose(R); if (!R.goal) continue; }
      if (R.path.length) { R.pos = R.path.shift(); const B = this.bodies.get(R.id); if (B && n === 1) { B.from = [B.a.x, B.a.z]; B.mt = 0; }
        // bandits on the road, as the player meets them
        if (Math.random() < (ENC[this.g.world.at(R.pos[0], R.pos[1])] || 0) * ROAD) { const w0 = R.st.wins; rivalAct(this.G, R, 'bandit', rivalE()); if (B && R.st.wins > w0) this.pop(B, '擊退山賊！'); } }
      if (!R.path.length) this.arrive(R);
    }
  }
  // each month: a cave a rival took gets a new master after a year
  month() { const H = this.g.H, G = this.G; for (const id in H.places || {}) { const st = H.places[id]; if (st.by && G.t - st.byT >= 12) { st.boss = false; delete st.by; delete st.byT; } } }
  // where a rival is: in a city (and so in its streets), or out on the land
  inCity(gid, cid) { const R = (this.G.rivals || []).find((x) => x.id === gid); if (!R || !this.walkers().includes(R) || !R.pos) return true; return R.inside === cid; }
  // ---------------------------------------------------------------- drawn on the land
  say(R) { const B = this.bodies.get(R.id); if (B) B.a.label.el.innerHTML = this.label(R); }
  label(R) { const g = this.G.gens[R.id], o = R.goal; return `<b>${g.name}</b><i style="color:#ff9a6a">★對手${o ? `・${ACT_N[o.act]}${o.act === 'travel' || o.act === 'cave' ? o.label : ''}` : ''}</i>`; }
  pop(B, t) { B.a.label.el.innerHTML = `<b>${this.G.gens[B.id].name}</b><i style="color:#ffd86a">${t}</i>`; B.popT = 2; }
  tick(dt) {
    const game = this.g, V = game.view; if (!V || !this.G?.roam) return;
    if (V.M !== this.mapRef) { this.mapRef = V.M; this.bodies.clear(); }
    if (game.mode !== 'world') return;
    const P = game.pos, live = new Set();
    for (const R of this.walkers()) {
      if (!R.pos || R.inside != null && !R.goal) continue;
      const d = Math.hypot(R.pos[0] - P.x, R.pos[1] - P.z); if (d > 34) continue;
      live.add(R.id); let B = this.bodies.get(R.id);
      if (!B) { const a = V.addActor(this.sheet(game.lookOf(this.G.gens[R.id])), R.pos[0], R.pos[1]); a.label = V.addLabel(this.label(R), a.sprite, 1.75, 'npc'); B = { id: R.id, a, from: null, mt: 1 }; this.bodies.set(R.id, B); }
      const a = B.a, [tx, tz] = R.pos;
      if (B.from && B.mt < 1) { B.mt = Math.min(1, B.mt + dt * 6); a.x = B.from[0] + (tx - B.from[0]) * B.mt; a.z = B.from[1] + (tz - B.from[1]) * B.mt; a.frame = Math.floor(B.mt * 6) % 2 ? 0 : 2; const dx = tx - B.from[0], dz = tz - B.from[1]; if (dx || dz) a.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; }
      else { a.x = tx; a.z = tz; a.frame = 1; }
      a.y = Math.max(0, game.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a);
      if (B.popT > 0 && (B.popT -= dt) <= 0) this.say(R);
    }
    for (const [id, B] of this.bodies) if (!live.has(id)) { V.removeActor(B.a); this.bodies.delete(id); }
  }
  // the player walks into a rival on the road
  meet() {
    const game = this.g, P = game.pos, H = game.H; if (game.mode !== 'world') return false;
    for (const R of this.walkers()) {
      if (!R.pos || Math.abs(R.pos[0] - P.x) + Math.abs(R.pos[1] - P.z) > 1 || (R.metAt ?? -999) > H.walk - 60) continue;
      const B = this.bodies.get(R.id); if (!B) continue; R.metAt = H.walk;
      if (game.auto?.on) { game.ui.toast(`路上遇到了對手<b>${this.G.gens[R.id].name}</b>。`, 2500); return false; }
      R.wait = Math.max(R.wait || 0, 5); game.act.talk({ gen: R.id, a: B.a, x: R.pos[0], z: R.pos[1] }); return true;
    }
    return false;
  }
  marks(x, s) { for (const R of this.walkers()) { if (!R.pos) continue; x.fillStyle = '#ff6a4a'; x.strokeStyle = '#000'; x.lineWidth = 1; x.beginPath(); x.moveTo(R.pos[0] * s, R.pos[1] * s - 4); x.lineTo(R.pos[0] * s + 3.5, R.pos[1] * s + 2.5); x.lineTo(R.pos[0] * s - 3.5, R.pos[1] * s + 2.5); x.closePath(); x.fill(); x.stroke(); } }
}
