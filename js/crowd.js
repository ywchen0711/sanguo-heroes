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
//
// And they do things out there, to be watched or joined: an officer rides with a few of his men; at the far end of a
// ride after bandits he fights them (and the player can lend a hand), a drill is a squad lined up swinging their
// spears, a free man stops to rest or to practise; two enemy officers who meet on the road fight it out, and the
// loser rides home (help one of them: you fight the other). Those near by say things: what they are about, the
// player's name if it is known, and true rumours (a weak garrison near by, a cave and what is in it).
// A stop is a few steps of a walk spent in one place: { i (where on the path), n (how long), what }.
import { CITY_POS, T, K } from './world.js';
import { busy, allied, record, die } from './sim/engine.js';
import { LOOKS } from './sprites.js';
import { FX } from './fx.js';
import { rankTag } from './martial.js';

const SEE = 30, KEEP = 34, MAX = 36, LOOPS = 5, CREW = 14, TALK = 14;
const KIND_N = { scout: '偵察', patrol: '巡邏', hunt: '討賊', drill: '操練', post: '赴任', wander: '雲遊' };
const STOP_N = { bandit: ['討賊中', '#ff8a6a'], clash: ['交戰中', '#ff5a4a'], duel: ['單挑中', '#ff5a4a'], drill: ['操練中', '#ffd86a'], rest: ['歇息', '#b8d8a0'], train: ['練武', '#ffd86a'], camp: ['紮營', '#b8d8a0'] };
const CREW_N = { scout: 2, patrol: 2, hunt: 3, drill: 4, post: 1 };
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const DIRW = ['東', '東南', '南', '西南', '西', '西北', '北', '東北'];
const dirWord = (dx, dz) => DIRW[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
// which way to face (x, z) from (x0, z0): the sheet's rows
const face = (x0, z0, x, z) => { const dx = x - x0, dz = z - z0; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; };

export class Crowd {
  constructor(game, sheet) { this.g = game; this.sheet = sheet; this.now = 0; this.N = new Map(); this.bodies = new Map(); this.paths = new Map(); this.mapRef = null; this.Gref = null; this.met = new Map(); this.fights = []; this.tried = new Set(); this.bubT = 1; this.clock = 0; this.fxT = 0; }
  get G() { return this.g.G; }
  // a new game or a loaded one: nobody has been anywhere yet
  sync() { if (this.Gref !== this.G) { this.Gref = this.G; this.N.clear(); this.paths.clear(); this.gates = null; this.fights = []; this.tried.clear(); } }
  // the steps of the land go by (the player walks one, or rests a day: thirty)
  step(n = 1) { this.now += n; if (this.fights.length) this.settle(); }
  // who is in the crowd
  who(g) {
    if (!g || g.isPlayer || g.rivalHero || g.held || busy(g) || this.g.camps?.busy(g.id) || (g.status !== 'serving' && g.status !== 'free') || g.city == null || !CITY_POS[g.city]) return false;
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
  // a ride out towards the nearest enemy city, most of the way to the border, and back (found once for each pair)
  scout(g, cid) {
    const G = this.G, here = CITY_POS[cid]; let e = null, ed = 75 * K;
    for (const c of G.cities) if (c.owner != null && c.owner !== g.fac && !allied(G, g.fac, c.owner) && CITY_POS[c.id]) { const d = Math.hypot(CITY_POS[c.id].x - here.x, CITY_POS[c.id].y - here.y); if (d < ed) { ed = d; e = c; } }
    if (!e) return null; const k = 's' + cid + '>' + e.id; if (this.paths.has(k)) return this.paths.get(k);
    const p = this.road(cid, e.id), out = p && p.length > 10 ? p.slice(0, Math.round(p.length * 0.55)) : null, L = out ? [...out, ...out.slice(0, -1).reverse()] : null;
    this.paths.set(k, L); return L;
  }
  // a stay in a city (in its streets: the town shows him)
  stay(g, cid, t0) { const long = g.status === 'serving' ? R(30, 120) : R(15, 60); return { kind: 'stay', cid, t0, end: t0 + long }; }
  // a walk, with what he stops to do on the way
  walk(kind, cid, path, t0, stops = [], to) { return { kind, cid, path, t0, end: t0 + path.length + stops.reduce((a, q) => a + q.n, 0), stops, to }; }
  // what he does after s
  next(g, s) {
    const t0 = s.end;
    if (s.kind !== 'stay') return this.stay(g, s.cid, t0);
    // sent to another city (or moved on): he rides there, and may camp on the way
    if (s.cid !== g.city) {
      const p = this.road(s.cid, g.city); if (!p) return this.stay(g, g.city, t0);
      const st = p.length > 40 && Math.random() < 0.3 ? [{ i: R(15, p.length - 15), n: R(8, 16), what: 'camp' }] : [];
      return this.walk(g.status === 'serving' ? 'post' : 'wander', g.city, p, t0, st, this.G.cities[g.city]?.name);
    }
    // sworn brothers in one city ride out together: the others go with the first of them
    const lead = g.status === 'serving' && this.g.ties ? this.g.ties.leadIn(g) : g.id, LG = this.G.gens[lead];
    if (lead !== g.id && this.who(LG)) { const L = this.cur(LG); return L.path ? { ...L, stops: (L.stops || []).map((q) => ({ ...q })), t0: L.t0 + 1, end: L.end + 1, with: lead } : { kind: 'stay', cid: s.cid, t0, end: Math.max(t0 + 1, L.end + 1) }; }
    const sc = g.status === 'serving' && Math.random() < 0.3 && this.scout(g, s.cid);
    if (sc) return this.walk('scout', s.cid, sc, t0, Math.random() < 0.3 ? [{ i: Math.floor(sc.length / 2), n: R(6, 12), what: 'camp' }] : []);
    const p = this.loop(s.cid); if (!p) return this.stay(g, s.cid, t0);
    const kind = g.status === 'free' ? 'wander' : ['patrol', 'patrol', 'hunt', 'drill'][R(0, 3)], mid = Math.floor(p.length / 2);
    // at the far end of the ride: bandits found (always on a hunt, now and then on patrol), the drill, a rest or practice
    const st = kind === 'hunt' || (kind === 'patrol' && Math.random() < 0.35) ? [{ i: mid, n: R(10, 18), what: 'bandit' }]
      : kind === 'drill' ? [{ i: mid, n: R(16, 30), what: 'drill' }]
      : kind === 'wander' && Math.random() < 0.55 ? [{ i: mid, n: R(10, 25), what: Math.random() < 0.5 ? 'rest' : 'train' }] : [];
    return this.walk(kind, s.cid, p, t0, st);
  }
  // where he is and what he is doing now
  cur(g) {
    this.sync();
    let s = this.N.get(g.id);
    if (!s || this.now - s.end > 400) { s = this.stay(g, g.city, this.now - R(0, 200)); if (s.end <= this.now) s.end = this.now + R(5, 60); }
    for (let k = 0; this.now >= s.end && k < 6; k++) s = this.next(g, s);
    this.N.set(g.id, s); return s;
  }
  // where on his path he is: i, and the stop he is in (q) and how far into it (e)
  at(s) {
    let r = this.now - s.t0;
    for (const q of s.stops || []) { if (r < q.i) break; if (r < q.i + q.n) return { i: q.i, q, e: r - q.i }; r -= q.n; }
    return { i: Math.max(0, Math.min(s.path.length - 1, r)), q: null };
  }
  // what he stops doing now (the bandits are beaten, the fight is over): the walk goes on from here
  cut(g) {
    const s = this.N.get(g.id); if (!s?.path) return; const { q, e } = this.at(s); if (!q) return;
    s.end -= q.n - e; q.n = e; this.fights = this.fights.filter((F) => F.a !== g.id && F.b !== g.id);
  }
  // back to his city at once (beaten on the road); whoever he was fighting goes on his way
  home(g) {
    this.sync();
    for (const F of this.fights) if (F.a === g.id || F.b === g.id) { const o = this.G.gens[F.a === g.id ? F.b : F.a]; this.fights = this.fights.filter((x) => x !== F); if (o) this.cut(o); break; }
    this.N.set(g.id, this.stay(g, g.city, this.now));
  }
  posOf(s) { return s.path ? s.path[this.at(s).i] : null; }
  // out on the land: where, or null in a city
  out(g) { if (!this.who(g)) return null; return this.posOf(this.cur(g)); }
  // the town shows him if he is in it (and anyone the crowd does not walk)
  inCity(g, cid) { if (!this.who(g)) return true; const s = this.cur(g); return s.kind === 'stay' && s.cid === cid; }
  // what he is busy with on the road now, for a talk: { stop, foe }
  doing(g) { const s = this.N.get(g.id); if (!s?.path) return {}; const { q } = this.at(s); return q ? { stop: q.what, foe: q.foe } : {}; }
  // ---------------------------------------------------------------- two enemy officers meet on the road
  clash(A, B, what = 'clash') {
    const ga = this.G.gens[A.id], gb = this.G.gens[B.id], n = R(8, 14);
    for (const [S, o] of [[A.s, gb], [B.s, ga]]) { const { i } = this.at(S), q = { i, n, what, foe: o.id }; S.stops = [...(S.stops || []), q].sort((x, y) => x.i - y.i); S.end += n; }
    this.fights.push({ a: ga.id, b: gb.id, end: this.now + n, at: [...A.at], duel: what === 'duel' });
  }
  // a fight on the road is over: the stronger side (with luck) drives the other home, and his city loses men
  settle() {
    const G = this.G, P = this.g.pos;
    for (const F of [...this.fights]) {
      if (this.now < F.end) continue; this.fights = this.fights.filter((x) => x !== F);
      const a = G.gens[F.a], b = G.gens[F.b];
      if (F.duel) { if (a && b && a.status !== 'dead' && b.status !== 'dead') this.duelEnd(a, b, F); continue; }
      if (!a || !b || a.status !== 'serving' || b.status !== 'serving') continue;
      const sc = (g) => g.war + g.lead + (g.life?.lv || 0) * 1.5 + Math.random() * 50, [w, l] = sc(a) >= sc(b) ? [a, b] : [b, a];
      const C = G.cities[l.city]; if (C && C.owner === l.fac) C.troops = Math.max(0, C.troops - R(80, 300));
      this.N.set(l.id, this.stay(l, l.city, this.now));
      if (P && this.g.mode === 'world' && Math.hypot(F.at[0] - P.x, F.at[1] - P.z) < SEE) this.g.ui.toast(`⚔ <b style="color:${G.factions[w.fac]?.color}">${G.factions[w.fac]?.name}軍</b>的${w.name}擊退了<b style="color:${G.factions[l.fac]?.color}">${G.factions[l.fac]?.name}軍</b>的${l.name}`, 3500);
    }
  }
  // two sworn enemies fought it out on the road, man to man: the loser rides home, if he lives
  duelEnd(a, b, F) {
    const G = this.G, P = this.g.pos, roll = a.war - b.war + (Math.random() - 0.5) * 40, [w, l] = roll >= 0 ? [a, b] : [b, a];
    const killed = Math.abs(roll) > 22 && Math.random() < 0.3 && l.war < 95 && G.factions[l.fac]?.lord !== l.id;
    record(G, 'tie', 'feudDuel', { w: w.name, l: l.name, c: G.cities[w.city]?.name || '', killed }, w.status === 'serving' ? w.fac : null, 2, { g: w.id });
    if (killed) die(G, l, 'duel', w); else this.N.set(l.id, this.stay(l, l.city, this.now));
    if (P && this.g.mode === 'world' && Math.hypot(F.at[0] - P.x, F.at[1] - P.z) < SEE) this.g.ui.toast(`⚔ 宿敵單挑：<b>${w.name}</b>擊敗了${l.name}${killed ? `，<b style="color:#ff8a6a">${l.name}戰死</b>` : ''}！`, 4000);
  }
  // ---------------------------------------------------------------- what they say
  line(g, s, q) {
    const G = this.G, H = this.g.H, me = this.g.me, f = g.status === 'serving' && G.factions[g.fac], lord = f && G.gens[f.lord], P = this.g.pos;
    if (q?.what === 'bandit') return pick(['賊寇休走！', '弟兄們，上！', '大膽毛賊，還敢作亂！', '一個也別放跑！']);
    if (q?.what === 'duel') { const o = G.gens[q.foe]; return pick([`${o?.name}！今天就做個了斷！`, '你我之間，只能活一個！', `${o?.name}，我等這一天很久了！`]); }
    if (q?.what === 'clash') { const o = G.gens[q.foe], of = o && G.factions[o.fac]; return pick([`${o?.name || '敵將'}，納命來！`, `${of?.name || '敵'}軍的鼠輩，看招！`, '殺──！', '休想過去！']); }
    if (q?.what === 'drill') return pick(['列陣！', '一、二……殺！', '盾牌舉高！', '再來一次！', '腳步要穩！']);
    if (q?.what === 'rest' || q?.what === 'camp') return pick(['走累了，歇一會兒。', '這裡風景不錯。', '天下何時才能太平……', '今晚就在這裡過夜吧。']);
    if (q?.what === 'train') return pick(['喝！', '這一招還不夠快……', '再練一百遍！']);
    const B = this.bodies.get(g.id), near = B && P && Math.hypot(B.at[0] - P.x, B.at[1] - P.z) < 6;
    if (near && H.fame > 120 && Math.random() < 0.4) return pick([`那不是${me.name}嗎？`, `聽說${me.name}很厲害……`, `${me.name}的名號，我聽說過。`]);
    // a true rumour
    const rr = this.g.outlaws?.rumor(); if (rr?.length && Math.random() < 0.2) return pick(rr);
    const hr = B && this.g.horses?.rumor(B.at[0], B.at[1]); if (hr && Math.random() < 0.15) return hr;
    if (Math.random() < 0.5) {
      const here = CITY_POS[g.city], cs = G.cities.filter((c) => c.id !== g.city && CITY_POS[c.id] && (!f || c.owner !== g.fac)).map((c) => [Math.hypot(CITY_POS[c.id].x - here.x, CITY_POS[c.id].y - here.y), c]).sort((a, b) => a[0] - b[0]).slice(0, 4).map((x) => x[1]);
      const weak = cs.find((c) => c.owner != null && c.troops < 4000);
      if (weak && Math.random() < 0.5) return `聽說${weak.name}的守軍只有${weak.troops}人……`;
      const caves = (this.g.world?.places || []).filter((p) => p.kind === 'cave' && B && Math.hypot(p.x - B.at[0], p.y - B.at[1]) < 40);
      if (caves.length && B) { const c = pick(caves); return `聽說${dirWord(c.x - B.at[0], c.y - B.at[1])}邊的${c.name}裡${c.tier >= 4 ? '藏著上古的寶物，可是極其兇險' : c.tier >= 3 ? '有猛獸出沒' : '有些寶物'}。`; }
      const hiring = cs.find((c) => c.owner != null); if (!f && hiring) return `聽說${G.factions[hiring.owner].name}在${hiring.name}招賢納士。`;
    }
    if (s.kind === 'patrol') return pick([`奉${lord?.name || '主公'}之命巡邏。`, '最近路上不太平。', '看到可疑的人要回報。']);
    if (s.kind === 'scout') return pick(['去看看敵軍的動靜。', '邊境最近不太平靜。', '敵軍的斥候常在這一帶出沒。']);
    if (s.kind === 'hunt') return pick(['聽說附近有山賊出沒。', '這一帶的賊寇，今天要一網打盡。']);
    if (s.kind === 'post') return pick([`奉命前往${s.to}赴任。`, `${s.to}還有多遠？`]);
    if (s.kind === 'drill') return pick(['找塊空地操練。', '兵不練不精。']);
    return pick(['天下何處有明主……', '若遇明主，願效犬馬之勞。', '四處走走，見識見識天下。']);
  }
  // ---------------------------------------------------------------- drawn on the land
  label(g, s, q) {
    const f = g.status === 'serving' && this.G.factions[g.fac], col = f?.color || '#b8c8a0', side = f ? f.name : '在野', sn = q && STOP_N[q.what];
    const vs = (q?.what === 'clash' || q?.what === 'duel') && this.G.gens[q.foe] ? ` vs ${this.G.gens[q.foe].name}` : '';
    return `${rankTag(this.g, g.id)}<b>${g.name}</b><i style="color:${col}">${side}・${sn ? `<span style="color:${sn[1]}">${sn[0]}${vs}</span>` : `${KIND_N[s.kind] || ''}${s.kind === 'post' && s.to ? s.to : ''}`}</i>`;
  }
  // a small figure that goes with a body (one of his men, or a bandit): it eases towards where it should be
  put(V, a, tx, tz, dt, look) {
    const k = Math.min(1, dt * 7), x0 = a.x, z0 = a.z; a.x += (tx - a.x) * k; a.z += (tz - a.z) * k;
    const d = Math.hypot(a.x - x0, a.z - z0); if (d > 0.004) { a.dir = face(x0, z0, a.x, a.z); a.walkT = (a.walkT || 0) + d; a.frame = Math.floor(a.walkT * 3) % 2 ? 0 : 2; } else if (look == null) a.frame = 1;
    if (look != null) { a.dir = look; }
    a.y = Math.max(0, this.g.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a);
  }
  tick(dt) {
    const game = this.g, V = game.view; if (!V || !this.G) return;
    if (V.M !== this.mapRef) { this.mapRef = V.M; this.bodies.clear(); this.fx?.clear(); this.fx = new FX(V.scene); }
    if (game.mode !== 'world') return;
    this.clock += dt; this.fx.update(dt);
    const P = game.pos, near = [];
    for (const g of this.G.gens) {
      if (!this.who(g)) continue;
      const s = this.cur(g), p = this.posOf(s); if (!p) continue;
      const d = Math.hypot(p[0] - P.x, p[1] - P.z); if (d > (this.bodies.has(g.id) ? KEEP : SEE)) continue;
      near.push([d, g, s, p]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const live = new Set(), shown = near.slice(0, MAX), spark = (this.fxT -= dt) <= 0; if (spark) this.fxT = 0.35;
    shown.forEach(([d, g, s, [tx, tz]], rank) => {
      const [px, pz] = [tx, tz];
      live.add(g.id); let B = this.bodies.get(g.id);
      if (!B) { const a = V.addActor(this.sheet(game.lookOf(g)), tx, tz); B = { id: g.id, a, at: [tx, tz], from: null, mt: 1, s, key: '', crew: [], foes: [], bub: null }; this.bodies.set(g.id, B); }
      let { i, q } = this.at(s), key = s.t0 + ':' + (q ? q.what + q.i : '');
      if (B.s !== s || B.key !== key) { B.s = s; B.key = key; if (B.a.label) V.removeLabel(B.a.label); B.a.label = V.addLabel(this.label(g, s, q), B.a.sprite, 1.75, 'npc'); }
      const a = B.a, f = g.status === 'serving' && this.G.factions[g.fac];
      if (B.at[0] !== px || B.at[1] !== pz) { B.from = [a.x, a.z]; B.at = [px, pz]; B.mt = 0; }
      // the foe he is fighting: bandits beside him, or the other officer
      const other = q?.what === 'clash' || q?.what === 'duel' ? this.bodies.get(q.foe) : null, fight = q && (q.what === 'bandit' || ((q.what === 'clash' || q.what === 'duel') && other));
      // two officers fighting meet half way (a few tiles apart on their roads)
      if (other) { const ox = other.at[0] - tx, oz = other.at[1] - tz, od = Math.hypot(ox, oz); if (od > 1.2) { tx += ox / od * (od - 1.2) / 2; tz += oz / od * (od - 1.2) / 2; } }
      const fx = q?.what === 'bandit' ? tx + 1.6 : other ? other.a.x : tx, fz = q?.what === 'bandit' ? tz : other ? other.a.z : tz;
      if (B.from && B.mt < 1) { B.base = null; B.mt = Math.min(1, B.mt + dt * 6); a.x = B.from[0] + (tx - B.from[0]) * B.mt; a.z = B.from[1] + (tz - B.from[1]) * B.mt; a.frame = Math.floor(B.mt * 6) % 2 ? 0 : 2; const dx = tx - B.from[0], dz = tz - B.from[1]; if (dx || dz) a.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; }
      else if (fight || q?.what === 'train') {
        // lunges and swings
        const ph = this.clock * 7 + g.id, l = Math.max(0, Math.sin(ph)) * 0.25, dl = Math.hypot(fx - tx, fz - tz) || 1, e = Math.min(1, dt * 3);
        const bs = B.base ||= [a.x, a.z]; bs[0] += (tx - bs[0]) * e; bs[1] += (tz - bs[1]) * e;
        a.x = bs[0] + (fight ? (fx - tx) / dl * l : 0); a.z = bs[1] + (fight ? (fz - tz) / dl * l : 0); a.frame = Math.floor(ph / 1.6) % 2 ? 0 : 2;
        if (fight) a.dir = face(tx, tz, fx, fz); else if (Math.floor(ph / 6) !== Math.floor((ph - dt * 7) / 6)) a.dir = R(0, 3);
        if (spark && fight && Math.random() < 0.6 && d < 20) { const mx = (a.x + fx) / 2 + 0.5, mz = (a.z + fz) / 2 + 0.5; this.fx.sparks(mx, a.y + 0.7, mz, 5); if (Math.random() < 0.3) this.fx.slash(mx, a.y + 0.8, mz, Math.random() < 0.5); }
      } else { a.x = tx; a.z = tz; a.frame = 1; B.base = null; }
      a.y = Math.max(0, game.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a);
      // his men: behind him on the road, round him when he stops (lined up for a drill)
      const nC = rank < CREW && f ? CREW_N[s.kind] || 0 : 0;
      while (B.crew.length > nC) V.removeActor(B.crew.pop());
      while (B.crew.length < nC) B.crew.push(V.addActor(this.sheet(LOOKS.soldier(f.color)), a.x, a.z, { scale: 0.8 }));
      B.crew.forEach((c, k) => {
        let x, z, look = null;
        if (q?.what === 'drill') { x = tx - 1.5 + k; z = tz + 1.3; look = 3; const ph = this.clock * 4; c.frame = Math.floor(ph) % 2 ? 0 : 2; }
        else if (q) { const o = [[-0.8, 0.7], [-0.9, -0.6], [-1.6, 0.1], [0.2, 1]][k % 4], sgn = fight && fx < tx ? -1 : 1; x = tx + o[0] * sgn; z = tz + o[1]; if (fight) { look = face(x, z, fx, fz); c.frame = Math.floor(this.clock * 5 + k) % 2 ? 0 : 2; } }
        else { const pp = s.path[Math.max(0, i - 1 - k)] || [tx, tz]; x = pp[0] + (k % 2 ? 0.25 : -0.25); z = pp[1] + 0.2; }
        this.put(V, c, x, z, dt, look);
      });
      // the bandits he is fighting
      const nF = q?.what === 'bandit' && d < SEE ? 2 + (g.id % 2) : 0;
      while (B.foes.length > nF) V.removeActor(B.foes.pop());
      while (B.foes.length < nF) { const k = B.foes.length; B.foes.push(V.addActor(this.sheet(LOOKS.bandit()), tx + 2, tz + k - 1, { scale: 0.9 })); }
      B.foes.forEach((b, k) => { const ph = this.clock * 6 + k * 2, l = Math.max(0, Math.sin(ph)) * 0.25; b.frame = Math.floor(ph / 1.6) % 2 ? 0 : 2; this.put(V, b, tx + 1.6 + k * 0.5 - l, tz + (k - 1) * 0.8, dt, 1); });
    });
    for (const [id, B] of this.bodies) if (!live.has(id)) this.drop(V, id, B);
    // two enemy officers near each other on the road: they fight (once for each meeting)
    if (this.clashAt !== this.now) {
      this.clashAt = this.now; const L = [...this.bodies.values()].filter((B) => B.s.path && !this.at(B.s).q), T = this.g.ties;
      for (let x = 0; x < L.length; x++) for (let y = x + 1; y < L.length; y++) {
        const A = L[x], C = L[y], ga = this.G.gens[A.id], gc = this.G.gens[C.id], d = Math.hypot(A.at[0] - C.at[0], A.at[1] - C.at[1]);
        if (T && d <= 8 && T.feuding(ga.id, gc.id)) { const k = 'd' + A.s.t0 + ':' + C.s.t0; if (!this.tried.has(k)) { this.tried.add(k); this.clash(A, C, 'duel'); } continue; }
        if (ga.status !== 'serving' || gc.status !== 'serving' || ga.fac === gc.fac || allied(this.G, ga.fac, gc.fac)) continue;
        if (d > 5) continue;
        const k = A.s.t0 + ':' + C.s.t0; if (this.tried.has(k)) continue; this.tried.add(k);
        if (Math.random() < 0.7 && !this.at(A.s).q && !this.at(C.s).q) this.clash(A, C);
      }
      if (this.tried.size > 4000) this.tried.clear();
    }
    // now and then one of those near by says something
    for (const B of this.bodies.values()) if (B.bub && (B.bub.t -= dt) <= 0) { V.removeLabel(B.bub.l); B.bub = null; }
    if ((this.bubT -= dt) <= 0 && !game.ui.busy) {
      this.bubT = 1.6 + Math.random() * 1.8;
      const cand = [...this.bodies.values()].filter((B) => !B.bub && Math.hypot(B.at[0] - P.x, B.at[1] - P.z) < TALK);
      if (cand.length) { const B = pick(cand), g = this.G.gens[B.id], { q } = this.at(B.s); B.bub = { l: V.addLabel(this.line(g, B.s, q), B.a.sprite, 2.45, 'say'), t: 3.6 }; }
    }
  }
  drop(V, id, B) { V.removeActor(B.a); for (const c of [...B.crew, ...B.foes]) V.removeActor(c); if (B.bub) V.removeLabel(B.bub.l); this.bodies.delete(id); }
  // the player walks into one of them on the road: they talk (now and then: not every step through a crowd)
  meet() {
    const game = this.g, P = game.pos, H = game.H; if (game.mode !== 'world' || game.auto?.on) return false;
    for (const B of this.bodies.values()) {
      if ((B.at[0] !== P.x || B.at[1] !== P.z) && (Math.round(B.a.x) !== P.x || Math.round(B.a.z) !== P.z)) continue;
      const g = this.G.gens[B.id], busyNow = this.at(B.s).q; if (!this.who(g) || (!busyNow && (this.met.get(g.id) ?? -999) > H.walk - 90)) continue;
      this.met.set(g.id, H.walk); B.s.end += 3; game.act.talk({ gen: g.id, a: B.a, x: B.at[0], z: B.at[1], road: true, kind: B.s.kind, ...this.doing(g) }); return true;
    }
    return false;
  }
  // the minimap: a small dot for each one out on the land, in the colour of his side
  marks(x, s) {
    if (!this.G) return;
    for (const g of this.G.gens) { if (!this.who(g)) continue; const p = this.posOf(this.cur(g)); if (!p) continue; x.fillStyle = (g.status === 'serving' && this.G.factions[g.fac]?.color) || '#d8d8c0'; x.fillRect(p[0] * s - 1, p[1] * s - 1, 2, 2); }
  }
}
