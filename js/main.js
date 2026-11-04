// 三國英傑傳: play any general of the Three Kingdoms in a world that runs on without you. Walk the land and the towns
// (one step is a day; every thirty days the simulation moves the whole realm on a month), train, gather companions,
// serve a lord or rise on your own, fight bandits, duel famous generals and take cities — and change history. The game
// ends when the years you chose are up, or when one warlord unifies the realm, and then your deeds are reckoned.
import { View, THREE, personSheet } from './render.js';
import { buildWorld, T, WALK, ENC, CITY_POS, regionAt, W as WW } from './world.js';
import { buildTown } from './town.js';
import { lookFor, LOOKS } from './sprites.js';
import { newGame, step, rng, citiesOf, gensOf, busy, pickGovernor } from './sim/engine.js';
import { fmt, dateStr } from './sim/text.js';
import { newRec, solMax, spMax, bstats, gainExp, rankOf, RANKS, score } from './hero.js';
import { Battle } from './battle.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Actions } from './actions.js';
import { Screens } from './screens.js';

const SAVE = 'sanguo-heroes-save-v1';
const DIRS = { down: [0, 1, 0], left: [-1, 0, 1], right: [1, 0, 2], up: [0, -1, 3] };

class Game {
  constructor() {
    this.ui = new UI(this); this.audio = new Audio(); this.battle = new Battle(this); this.act = new Actions(this); this.screens = new Screens(this);
    this.view = new View(document.getElementById('stage'));
    this.keys = new Set(); this.mode = 'title';
    addEventListener('keydown', (e) => { if (this.ui.busy) return; this.keys.add(e.key); if (['c', 'C', 'Escape', 'm', 'M'].includes(e.key) && (this.mode === 'world' || this.mode === 'town')) { e.preventDefault(); this.act.menu(); } if ((e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') && (this.mode === 'world' || this.mode === 'town')) { e.preventDefault(); this.interact(); } if (e.key.startsWith('Arrow')) e.preventDefault(); });
    addEventListener('keyup', (e) => this.keys.delete(e.key));
    addEventListener('blur', () => this.keys.clear());
    this.touchPad();
    this.last = performance.now(); requestAnimationFrame((t) => this.frame(t));
    this.screens.title();
  }
  // ---------------------------------------------------------------- starting and loading
  start(o) {
    const G = this.G = newGame({ seed: o.seed ?? (Date.now() & 0x7fffffff), scenario: o.scenario });
    const g = G.gens[o.pid]; g.isPlayer = true; g.died = Math.max(g.died, G.year + o.years + 1);
    const f = g.status === 'serving' ? G.factions[g.fac] : null, lord = f && f.lord === g.id;
    this.H = { pid: g.id, gold: lord ? 1500 : f ? 500 : 300, fame: Math.round((g.lead + g.war + g.int + g.pol + g.cha) / 4) + (lord ? 200 : 0), items: { med: 3, rice: 1 }, party: [], rec: { [g.id]: newRec(g) },
      st: { wins: 0, battles: 0, bandits: 0, duels: 0, kills: [], cities: [], missions: 0, bestRank: 0 }, endYear: G.year + o.years, years: o.years, days: 0, missions: [], seenLog: G.log.length, scenario: o.scenario, startYear: G.year, news: [] };
    this.H.rec[g.id].eq = { w: 'w2', a: 'a2', h: null };
    // the companions history gave them: the sworn brothers, and a lord's best generals
    this.load2();
    this.enterTown(g.city, true);
    this.ui.toast(`<b>${dateStr(G.year, G.month)}</b>　${g.name}的故事開始了。`);
    this.act.intro();
  }
  saveGame() { try { const G = { ...this.G, r: undefined, pending: [], byName: undefined }; localStorage.setItem(SAVE, JSON.stringify({ G, H: this.H, pos: this.pos })); return true; } catch (e) { console.error(e); return false; } }
  hasSave() { try { return !!localStorage.getItem(SAVE); } catch (e) { return false; } }
  loadGame() {
    const d = JSON.parse(localStorage.getItem(SAVE)); const G = this.G = d.G; G.r = rng(G.seed + G.t * 7919 + 1); G.pending = []; G.byName = Object.fromEntries(G.gens.map((g) => [g.name, g]));
    this.H = d.H; this.load2();
    if (d.pos.town != null) this.enterTown(d.pos.town, true, d.pos); else this.enterWorld(d.pos.x, d.pos.z, d.pos.dir);
  }
  load2() { this.world ||= buildWorld(); this.mode = 'world'; document.body.classList.add('playing'); }
  get me() { return this.G.gens[this.H.pid]; }
  // the party as [{ g, rec, look, solMax, spMax }]
  partyList() { return [this.H.pid, ...this.H.party].map((id) => { const g = this.G.gens[id], rec = this.H.rec[id]; return { g, rec, look: this.lookOf(g), solMax: solMax(g, rec), spMax: spMax(g, rec) }; }); }
  lookOf(g) { const f = g.status === 'serving' && this.G.factions[g.fac]; return lookFor(g, f ? f.color : '#7a6a5a'); }
  myFaction() { const g = this.me; return g.status === 'serving' ? g.fac : null; }
  isLord() { const f = this.myFaction(); return !!f && this.G.factions[f].lord === this.H.pid; }
  rank() { const g = this.me; if (this.isLord()) return '君主'; if (g.status !== 'serving') return '在野'; return RANKS[rankOf(g.merit)][0]; }
  // ---------------------------------------------------------------- the land
  enterWorld(x, z, dir = 'down') {
    this.mode = 'world'; this.town = null; this.pos = { x, z, dir, town: null };
    const M = this.world, V = this.view, TT = { 0: [14, 15], 1: [14, 15], 2: [0, 15], 3: [1, 15], 4: [5, 15], 5: [9, 15], 6: [6, 16], 7: [7, 17], 8: [8, 23], 9: [3, 15], 10: [13, 13], 11: [18, 11], 12: [4, 23], 13: [22, 15], 14: [19, 15] };
    V.setMap({ W: M.W, H: M.H, water: -0.24, sky: '#9ac8f0', fog: '#c8dcec', fogNear: 24, fogFar: 52,
      tile: (x, z) => { if (x < 0 || z < 0 || x >= M.W || z >= M.H) return null; const k = M.at(x, z), [top, side] = TT[k]; return { top: k === T.MOUNT && M.hAt(x, z) > 1.8 ? 7 : top, side, side2: k === T.MOUNT || k === T.SNOW ? 16 : side, h: M.hAt(x, z) }; },
      deco: (x, z) => M.deco[z * M.W + x] === 5 && M.at(x, z) === T.SNOW ? 6 : M.deco[z * M.W + x],
      props: CITY_POS.map((c) => { const C = this.G.cities[c.id], f = C.owner && this.G.factions[C.owner]; return { kind: 'city', x: c.x + 0.5, z: c.y + 0.5, r: c.size >= 3 ? 2 : 1, size: c.size, color: f ? f.color : '#9a9a9a', roofRed: c.size >= 3, label: this.cityLabel(c.id), labelY: c.size >= 3 ? 3.4 : 2.6, labelClass: 'city', cityId: c.id }; }) });
    this.cityProps = V.M.props;
    this.missionMarks();
    this.spawnParty(x, z, dir);
    V.updateChunks(x, z); V.follow(x, this.groundY(x, z), z, true); V.season(this.G.month);
    this.audio.music('field');
    this.hud();
  }
  cityLabel(id) { const C = this.G.cities[id], f = C.owner && this.G.factions[C.owner]; return `<b>${C.name}</b>${f ? `<i style="color:${f.color}">${f.name}</i>` : '<i>無主</i>'}`; }
  // a city that changed hands gets its new warlord's flag; every label shows who holds it now
  refreshCities() {
    if (this.mode !== 'world') return;
    for (const p of this.cityProps || []) {
      const C = this.G.cities[p.cityId], f = C.owner && this.G.factions[C.owner], col = f ? f.color : '#9a9a9a';
      if (p.color !== col) { this.view.mapGroup.remove(p.obj); const l = this.view.labels.find((l) => l.obj === p.obj); if (l) this.view.removeLabel(l); p.color = col; p.label = this.cityLabel(p.cityId); this.view.addProp(p); }
      else { const l = this.view.labels.find((l) => l.obj === p.obj); if (l) l.el.innerHTML = this.cityLabel(p.cityId); }
    }
  }
  // the camera follows the leader; in a town it stays inside the walls
  camTo(x, z, snap) { if (this.mode === 'town') { x = Math.max(7, Math.min(this.town.W - 8, x)); z = Math.max(5, Math.min(this.town.H - 7, z)); } this.view.follow(x, this.mode === 'town' ? 0 : this.groundY(Math.round(x), Math.round(z)), z, snap); }
  groundY(x, z) { if (this.mode === 'town') return 0; const h = this.world.hAt(x, z); return Math.max(h, -0.05); }
  spawnParty(x, z, dir) {
    this.actors = []; const list = this.partyList();
    list.forEach((p, i) => { const a = this.view.addActor(personSheet(p.look), x, z, { scale: i ? 0.95 : 1 }); a.dir = DIRS[dir][2]; this.actors.push(a); });
    this.tiles = list.map(() => [x, z]); this.prevTiles = null;
    this.place(1);
  }
  respawnParty() { const { x, z, dir } = this.pos; for (const a of this.actors || []) this.view.removeActor(a); this.spawnParty(x, z, dir); }
  // each follower walks to where the one ahead of them was (p: how far through the step)
  place(p = 1) {
    this.actors.forEach((a, i) => {
      const to = this.tiles[i], from = this.prevTiles?.[i] || to, x = from[0] + (to[0] - from[0]) * p, z = from[1] + (to[1] - from[1]) * p;
      if (i && (to[0] !== from[0] || to[1] !== from[1])) a.dir = to[0] > from[0] ? 2 : to[0] < from[0] ? 1 : to[1] < from[1] ? 3 : 0;
      a.x = x; a.z = z; a.y = this.groundY(Math.round(x), Math.round(z)); this.view.placeActor(a);
    });
  }
  // ---------------------------------------------------------------- a town
  enterTown(cityId, snap, at) {
    this.mode = 'town'; const C = this.G.cities[cityId], f = C.owner && this.G.factions[C.owner];
    const M = this.town = buildTown(C.name, C.size, f ? f.color : '#8a8a8a'); M.city = cityId;
    const [sx, sz] = at && at.town === cityId ? [at.x, at.z] : M.spawn;
    this.pos = { x: sx, z: sz, dir: at?.dir || 'up', town: cityId };
    this.me.city = cityId; for (const id of this.H.party) this.G.gens[id].city = cityId;
    this.view.setMap({ ...M, water: null });
    this.view.updateChunks(15, 12);
    this.townNPCs();
    this.spawnParty(sx, sz, this.pos.dir);
    this.camTo(sx, sz, true); this.view.season(this.G.month);
    this.audio.music('town');
    this.hud();
    if (!snap) this.ui.toast(`<b>${C.name}</b>　${f ? f.name + '軍' : '無主之城'}　兵 ${C.troops}`);
  }
  townNPCs() {
    const M = this.town, C = this.G.cities[M.city]; this.npcs = [];
    for (const n of M.npcs) { const a = this.view.addActor(personSheet(n.look), n.x, n.z, { scale: 0.95 }); this.npcs.push({ ...n, a, home: [n.x, n.z], t: Math.random() * 3 }); }
    // the generals in this city: those who serve here wait before the hall, the free ones by the tavern
    const here = this.G.gens.filter((g) => !busy(g) && (g.status === 'serving' || g.status === 'free') && g.city === C.id && !g.held);
    const serving = here.filter((g) => g.status === 'serving').sort((a, b) => (b.lead + b.war + b.int) - (a.lead + a.war + a.int)).slice(0, 6), free = here.filter((g) => g.status === 'free').slice(0, 4);
    const spots = [[11, 7], [18, 7], [12, 8], [17, 8], [10, 8], [19, 8]], fspots = [[22, 10], [25, 10], [23, 14], [26, 14]];
    serving.forEach((g, i) => { const [x, z] = spots[i]; const a = this.view.addActor(personSheet(this.lookOf(g)), x, z); a.label = this.view.addLabel(`<b>${g.name}</b>`, a.sprite, 1.75, 'npc'); this.npcs.push({ x, z, a, gen: g.id, home: [x, z] }); });
    free.forEach((g, i) => { const [x, z] = fspots[i]; const a = this.view.addActor(personSheet(this.lookOf(g)), x, z); a.label = this.view.addLabel(`<b>${g.name}</b><i>在野</i>`, a.sprite, 1.75, 'npc'); this.npcs.push({ x, z, a, gen: g.id, home: [x, z] }); });
  }
  // ---------------------------------------------------------------- the frame
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (this.mode === 'world' || this.mode === 'town') { this.move(dt); this.npcTick(dt); this.armyTick(dt); }
    if (this.mode !== 'battle' && this.mode !== 'title' || this.view.M) this.view.render(dt);
    requestAnimationFrame((t2) => this.frame(t2));
  }
  held() { const k = this.keys, tp = this.tpad; if (k.has('ArrowUp') || k.has('w') || k.has('W') || tp === 'up') return 'up'; if (k.has('ArrowDown') || k.has('s') || k.has('S') || tp === 'down') return 'down'; if (k.has('ArrowLeft') || k.has('a') || k.has('A') || tp === 'left') return 'left'; if (k.has('ArrowRight') || k.has('d') || k.has('D') || tp === 'right') return 'right'; return null; }
  move(dt) {
    const P = this.pos; if (!P || this.ui.busy || this.locked) { this.animWalk(dt, false); return; }
    if (P.moving) {
      P.mt += dt * (this.mode === 'world' ? (this.onRoad ? 7.5 : 6) : 5.5); const p = Math.min(1, P.mt);
      P.fx = P.from[0] + (P.x - P.from[0]) * p; P.fz = P.from[1] + (P.z - P.from[1]) * p;
      this.place(p); this.camTo(P.fx, P.fz);
      this.animWalk(dt, true);
      if (p >= 1) { P.moving = false; P.fx = P.x; P.fz = P.z; this.arrived(); }
      return;
    }
    const d = this.held(); this.animWalk(dt, false);
    if (!d) return;
    const [dx, dz, di] = DIRS[d]; P.dir = d; this.actors[0].dir = di;
    const nx = P.x + dx, nz = P.z + dz;
    if (!this.canWalk(nx, nz)) { this.place(1); this.bump(nx, nz); return; }
    // the party follows in the leader's footsteps
    this.prevTiles = this.tiles.map((t) => [...t]); this.tiles = [[nx, nz], ...this.prevTiles.slice(0, this.actors.length - 1)];
    P.from = [P.x, P.z]; P.x = nx; P.z = nz; P.mt = 0; P.moving = true;
  }
  animWalk(dt, walking) { this.wt = (this.wt || 0) + dt; const f = walking ? (Math.floor(this.wt * 8) % 2 ? 0 : 2) : 1; for (const a of this.actors || []) { a.frame = f; this.view.placeActor(a); } }
  canWalk(x, z) {
    if (this.mode === 'town') { if (z >= this.town.H - 1 && x >= this.town.gate.x0 && x <= this.town.gate.x1) return true; return this.town.walkable(x, z) && !this.npcs.some((n) => Math.round(n.a.x) === x && Math.round(n.a.z) === z); }
    return !!WALK[this.world.at(x, z)];
  }
  // after a step: the day goes by, a town is entered, or something comes out of the grass
  arrived() {
    const P = this.pos;
    if (this.mode === 'town') {
      if (P.z >= this.town.H - 1) { this.leaveTown(); return; }
      const door = this.town.doors.find((d) => d.x === P.x && d.z === P.z); if (door) { this.act.building(door); return; }
      return;
    }
    const k = this.world.at(P.x, P.z); this.onRoad = k === T.ROAD || k === T.BRIDGE;
    this.H.days++; this.steps = (this.steps || 0) + 1;
    if (this.H.days % 30 === 0) { this.monthTick(); if (this.mode !== 'world') return; }
    if (k === T.CITY) { const c = this.world.cityAt(P.x, P.z); this.act.cityGate(c); return; }
    const m = this.H.missions.find((m) => m.x === P.x && m.z === P.z && !m.done); if (m) { this.act.missionFight(m); return; }
    if (this.steps > 5 && Math.random() < (ENC[k] || 0)) { this.steps = 0; this.act.encounter(regionAt(P.x, P.z), k); }
    if (this.H.days % 3 === 0) this.hud();
  }
  bump(x, z) { if (this.mode === 'town') { const n = this.npcs.find((n) => Math.round(n.a.x) === x && Math.round(n.a.z) === z); if (n && !this.ui.busy) this.act.talk(n); } }
  interact() {
    const P = this.pos; if (!P || P.moving || this.ui.busy) return; const [dx, dz] = DIRS[P.dir];
    if (this.mode === 'town') { const n = this.npcs.find((n) => Math.round(n.a.x) === P.x + dx && Math.round(n.a.z) === P.z + dz); if (n) return this.act.talk(n); const door = this.town.doors.find((d) => d.x === P.x && d.z === P.z) || this.town.doors.find((d) => d.x === P.x + dx && d.z === P.z + dz); if (door) return this.act.building(door); }
  }
  leaveTown() {
    const c = CITY_POS[this.town.city], R = c.size >= 3 ? 2 : 1;
    for (const n of this.npcs) this.view.removeActor(n.a);
    this.enterWorld(c.x, c.y + R + 2, 'down');
  }
  npcTick(dt) {
    if (this.mode !== 'town') return;
    for (const n of this.npcs) {
      n.t -= dt;
      if (n.wander && n.t <= 0 && !this.ui.busy) {
        n.t = 1.5 + Math.random() * 3; const d = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)], [dx, dz, di] = DIRS[d], x = Math.round(n.a.x) + dx, z = Math.round(n.a.z) + dz;
        n.a.dir = di; if (this.town.walkable(x, z) && Math.abs(x - n.home[0]) < 4 && Math.abs(z - n.home[1]) < 4 && !(x === this.pos.x && z === this.pos.z) && !this.npcs.some((m) => m !== n && Math.round(m.a.x) === x && Math.round(m.a.z) === z)) { n.to = [x, z]; n.from = [n.a.x, n.a.z]; n.mt = 0; }
      }
      if (n.to) { n.mt += dt * 3; const p = Math.min(1, n.mt); n.a.x = n.from[0] + (n.to[0] - n.from[0]) * p; n.a.z = n.from[1] + (n.to[1] - n.from[1]) * p; n.a.frame = Math.floor(n.mt * 6) % 2 ? 0 : 2; if (p >= 1) { n.to = null; n.a.frame = 1; } this.view.placeActor(n.a); }
    }
  }
  // ---------------------------------------------------------------- a month goes by: the realm moves on
  monthTick() {
    const G = this.G, g = this.me, before = { fac: g.status === 'serving' ? g.fac : null, lord: this.isLord(), status: g.status };
    const n0 = G.log.length; step(G);
    const logs = G.log.slice(n0); this.H.seenLog = G.log.length;
    // pay
    if (g.status === 'serving') { const pay = this.isLord() ? 0 : RANKS[rankOf(g.merit)][2]; if (pay) this.H.gold += pay; this.H.st.bestRank = Math.max(this.H.st.bestRank, rankOf(g.merit)); }
    // the wounded recover a little each month
    for (const p of this.partyList()) p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * 0.08));
    // the news: big events everywhere, and anything about my own faction
    const mine = before.fac;
    const big = logs.filter((e) => e.level >= 3 || (e.level >= 2 && (e.fac === mine || e.kind === 'war' || e.kind === 'death')) || (mine && e.fac === mine && ['war', 'defect', 'succession', 'fall'].includes(e.kind)) || e.def === mine);
    this.H.news.unshift(...logs.filter((e) => e.level >= 2).map((e) => `${dateStr(e.year, e.month)}　${fmt(e)}`)); this.H.news.length = Math.min(this.H.news.length, 80);
    big.slice(0, 4).forEach((e, i) => setTimeout(() => this.ui.toast(`<small>${dateStr(e.year, e.month)}</small> ${fmt(e)}`, 4200), i * 700));
    // what changed for me
    const now = g.status === 'serving' ? g.fac : null;
    if (before.fac && !now) { this.ui.toast(`<b style="color:#ff8a6a">${G.factions[before.fac]?.name || ''}軍滅亡了，你成了在野之身。</b>`, 5000); for (const id of this.H.party) { const m = G.gens[id]; if (m.status === 'serving') { m.status = 'free'; m.fac = null; } } }
    else if (before.fac && now && before.fac !== now) this.ui.toast(`<b>你所屬的勢力併入了${G.factions[now].name}軍。</b>`, 5000);
    if (!before.lord && this.isLord()) this.ui.toast(`<b style="color:#ffd86a">你繼承了${G.factions[now].name}軍之主的地位！</b>`, 5000);
    // armies on the march: this month's campaigns, walking from city to city
    for (const e of logs) if (e.kind === 'war' && e.from != null && e.city != null) this.march(e.from, e.city, G.factions[e.fac]?.color || '#888', e.win);
    this.view.season(G.month); this.refreshCities(); this.hud();
    // the end: the years are up, the realm is one, or the player's general has died
    if (G.over || G.year >= this.H.endYear || g.status === 'dead') { this.screens.ending(); return; }
    if (G.month === 1) this.ui.toast(`<b>${G.year}年</b>　距離結束還有 ${this.H.endYear - G.year} 年`, 3000);
  }
  march(from, to, color, win) {
    if (this.mode !== 'world') return;
    const a = CITY_POS[from], b = CITY_POS[to], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 60) return;
    const act = this.view.addActor(personSheet(LOOKS.soldier(color)), a.x, a.y + 1, { scale: 1.1 });
    act.march = { a, b, t: 0, dur: 4 + d / 8, win }; (this.armies ||= []).push(act);
  }
  armyTick(dt) {
    if (!this.armies?.length) return;
    for (const a of [...this.armies]) { const m = a.march; m.t += dt; const p = Math.min(1, m.t / m.dur); a.x = m.a.x + (m.b.x - m.a.x) * p; a.z = m.a.y + 1 + (m.b.y - m.a.y) * p; a.dir = Math.abs(m.b.x - m.a.x) > Math.abs(m.b.y - m.a.y) ? (m.b.x > m.a.x ? 2 : 1) : m.b.y > m.a.y ? 0 : 3; a.frame = Math.floor(m.t * 6) % 2 ? 0 : 2; a.y = this.mode === 'world' ? Math.max(0, this.world.hAt(Math.round(a.x), Math.round(a.z))) : 0; this.view.placeActor(a); if (p >= 1) { this.view.removeActor(a); this.armies = this.armies.filter((x) => x !== a); } }
  }
  missionMarks() { for (const m of this.H.missions) if (!m.done) this.view.addProp({ kind: 'banner', x: m.x, z: m.z, y: Math.max(0, this.world.hAt(m.x, m.z)), color: '#2a2a2a', label: `<b>${m.boss}</b>`, labelY: 1.8, labelClass: 'mission' }); }
  // ---------------------------------------------------------------- the HUD
  hud() {
    const G = this.G, g = this.me, f = this.myFaction() && G.factions[this.myFaction()], el = document.getElementById('hud');
    if (!G) { el.innerHTML = ''; return; }
    const sol = this.partyList().reduce((s, p) => s + p.rec.sol, 0), max = this.partyList().reduce((s, p) => s + p.solMax, 0);
    el.innerHTML = `<div class="h-name"><b>${g.name}</b><span style="color:${f ? f.color : '#c8c8c8'}">${f ? f.name + '軍' : '在野'}・${this.rank()}</span></div>
      <div class="h-row"><span>${dateStr(G.year, G.month)}</span><span>金 ${this.H.gold}</span><span>名聲 ${this.H.fame}</span></div>
      <div class="h-row"><span>兵力 ${sol}/${max}</span><span>Lv ${this.H.rec[this.H.pid].lv}</span><span>隊伍 ${this.H.party.length + 1}</span></div>`;
    this.screens.minimap();
  }
  // ---------------------------------------------------------------- touch: a pad and two buttons
  touchPad() {
    const pad = document.getElementById('tpad'); if (!pad) return;
    const set = (d) => { this.tpad = d; };
    pad.querySelectorAll('[data-d]').forEach((b) => { b.addEventListener('touchstart', (e) => { e.preventDefault(); if (this.ui.busy) this.ui.key(b.dataset.d); else set(b.dataset.d); }); b.addEventListener('touchend', () => set(null)); });
    document.getElementById('tA').addEventListener('touchstart', (e) => { e.preventDefault(); if (this.ui.busy) this.ui.key('ok'); else this.interact(); });
    document.getElementById('tB').addEventListener('touchstart', (e) => { e.preventDefault(); if (this.ui.busy) this.ui.key('back'); else if (this.mode === 'world' || this.mode === 'town') this.act.menu(); });
  }
}

window.SG = new Game();
