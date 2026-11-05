// 三國英傑傳: play any general of the Three Kingdoms in a world that runs on without you. Walk the land and the towns
// (one step is a day; every thirty days the simulation moves the whole realm on a month), train, gather companions,
// serve a lord or rise on your own, fight bandits, duel famous generals and take cities — and change history. The game
// ends when the years you chose are up, or when one warlord unifies the realm, and then your deeds are reckoned.
import { View, THREE, personSheet } from './render.js';
import { buildWorld, T, WALK, ENC, CITY_POS, regionAt, W as WW } from './world.js';
import { buildTown, buildVillage, buildCave } from './town.js';
import { lookFor, LOOKS, soldierSheet, beastSheet, assignLooks } from './sprites.js';
import { newGame, step, rng, citiesOf, gensOf, busy, pickGovernor } from './sim/engine.js';
import { fmt, dateStr } from './sim/text.js';
import { newRec, solMax, spMax, bstats, gainExp, rankOf, RANKS, score, PERKS } from './hero.js';
import { Battle } from './battle.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Actions } from './actions.js';
import { Screens } from './screens.js';
import { Events } from './events.js';
import { Story } from './story.js';
import { AutoPlay } from './auto.js';
import { Board } from './board.js';
import { syncParty, awaken } from './traits.js';
import { pickRivals } from './sim/rivals.js';
import { deed, histDeaths, checkTitles, hasT, knownAs } from './deeds.js';
import { mourn } from './bonds.js';
import { mark } from './dex.js';
import { sagesHere, SAGES } from './sages.js';
import { partyFx, rollRelic, giveRelic, RELICS } from './relics.js';
import { noteDisasters, enterStricken, disasterAt, DIS_N } from './disaster.js';

const SAVE = 'sanguo-heroes-save-v1';
const DIRS = { down: [0, 1, 0], left: [-1, 0, 1], right: [1, 0, 2], up: [0, -1, 3] };

class Game {
  constructor() {
    this.ui = new UI(this); this.audio = new Audio(); this.battle = new Battle(this); this.act = new Actions(this); this.screens = new Screens(this); this.events = new Events(this); this.story = new Story(this); this.auto = new AutoPlay(this); this.board = new Board(this);
    this.view = new View(document.getElementById('stage'));
    this.keys = new Set(); this.mode = 'title';
    addEventListener('keydown', (e) => { if (this.ui.busy) return; this.keys.add(e.key); if (e.repeat && !e.key.startsWith('Arrow') && !'wasdWASD'.includes(e.key)) return; if (['c', 'C', 'Escape', 'm', 'M'].includes(e.key) && (this.mode === 'world' || this.mode === 'town')) { e.preventDefault(); this.act.menu(); } if ((e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') && (this.mode === 'world' || this.mode === 'town')) { e.preventDefault(); this.interact(); } if (e.key.startsWith('Arrow')) e.preventDefault(); });
    addEventListener('keydown', (e) => { if (!this.G || this.mode === 'title' || this.mode === 'end') return; if ((e.key === 'p' || e.key === 'P') && !this.ui.busy) this.auto.toggle(); else if (this.auto.on && /^Arrow|^[wasdWASD]$/.test(e.key) && !this.ui.busy) this.auto.toggle(false); }, true);
    addEventListener('keyup', (e) => this.keys.delete(e.key));
    addEventListener('blur', () => this.keys.clear());
    this.touchPad(); this.freeCam();
    this.last = performance.now(); requestAnimationFrame((t) => this.frame(t));
    this.screens.title();
  }
  // ---------------------------------------------------------------- starting and loading
  start(o) {
    const G = this.G = newGame({ seed: o.seed ?? (Date.now() & 0x7fffffff), scenario: o.scenario });
    const g = G.gens[o.pid]; g.isPlayer = true; g.died = Math.max(g.died, G.year + o.years + 1);
    // the computer players: they live as long as the player does (unless killed)
    if (o.rivals) { G.rivals = pickRivals(G, o.rivals, g.id, G.r, o.rivalHow || 'famous'); for (const R of G.rivals) { const x = G.gens[R.id]; x.died = Math.max(x.died, G.year + o.years + 1); } }
    const f = g.status === 'serving' ? G.factions[g.fac] : null, lord = f && f.lord === g.id;
    this.H = { pid: g.id, gold: lord ? 1500 : f ? 500 : 300, fame: Math.round((g.lead + g.war + g.int + g.pol + g.cha) / 4) + (lord ? 200 : 0), items: { med: 3, rice: 1 }, party: [], rec: { [g.id]: newRec(g) },
      st: { wins: 0, battles: 0, bandits: 0, duels: 0, kills: [], cities: [], missions: 0, bestRank: 0 }, endYear: G.year + o.years, years: o.years, days: 0, missions: [], seenLog: G.log.length, scenario: o.scenario, startYear: G.year, news: [] };
    this.H.rec[g.id].eq = { w: 'w2', a: 'a2', h: null, x: null }; this.H.bag = [];
    { const ids = Object.keys(RELICS).filter((id) => RELICS[id].grade === 1 && RELICS[id].slot === 'x'); this.H.bag.push({ id: ids[Math.floor(Math.random() * ids.length)], lv: 1, exp: 0 }); }
    this.H.hist = histDeaths(G); this.H.startFac = f ? f.name : null; this.H.st.lastFac = f ? f.id : null;
    for (const [n, d] of Object.entries(this.H.hist)) if (n === g.name) delete this.H.hist[n];
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
    if (d.pos.place != null) this.enterPlace(this.world.places[d.pos.place], true, d.pos); else if (d.pos.town != null) this.enterTown(d.pos.town, true, d.pos); else this.enterWorld(d.pos.x, d.pos.z, d.pos.dir);
  }
  load2() { this.world ||= buildWorld(); this.mode = 'world'; document.body.classList.add('playing'); assignLooks(this.G.gens); }
  get me() { return this.G.gens[this.H.pid]; }
  // the party as [{ g, rec, look, solMax, spMax }]
  partyList() { syncParty(this); const cmd = this.perk().troop; return [this.H.pid, ...this.H.party].map((id) => { const g = this.G.gens[id], rec = this.H.rec[id]; rec.cmd = cmd; return { g, rec, look: this.lookOf(g), solMax: solMax(g, rec), spMax: spMax(g, rec) }; }); }
  // what the player's rank brings (see PERKS), and how many may travel with them
  perk() { const g = this.me; return PERKS[this.isLord() ? 7 : g.status === 'serving' ? 1 + rankOf(g.merit) : 0]; }
  partyMax() { return this.perk().party; }
  lookOf(g) { const f = g.status === 'serving' && this.G.factions[g.fac]; return lookFor(g, f ? f.color : '#7a6a5a'); }
  myFaction() { const g = this.me; return g.status === 'serving' ? g.fac : null; }
  isLord() { const f = this.myFaction(); return !!f && this.G.factions[f].lord === this.H.pid; }
  rank() { const g = this.me; if (this.isLord()) return '君主'; if (g.status !== 'serving') return '在野'; return RANKS[rankOf(g.merit)][0]; }
  // ---------------------------------------------------------------- the land
  enterWorld(x, z, dir = 'down') {
    if (this.world && !WALK[this.world.at(x, z)]) [x, z] = this.ashore(x, z);
    this.mode = 'world'; this.town = null; this.pos = { x, z, dir, town: null };
    const M = this.world, V = this.view, TT = { 0: [14, 15], 1: [14, 15], 2: [0, 15], 3: [1, 15], 4: [5, 15], 5: [9, 15], 6: [6, 16], 7: [7, 17], 8: [8, 23], 9: [3, 15], 10: [13, 13], 11: [18, 11], 12: [4, 23], 13: [22, 15], 14: [19, 15], 15: [18, 15], 16: [2, 15], 17: [9, 15] };
    V.setMap({ W: M.W, H: M.H, water: -0.24, sky: '#9ac8f0', fog: '#c8dcec', fogNear: 30, fogFar: 64,
      tile: (x, z) => { if (x < 0 || z < 0 || x >= M.W || z >= M.H) return null; const k = M.at(x, z), [top, side] = TT[k]; return { top: k === T.MOUNT && M.hAt(x, z) > 1.8 ? 7 : top, side, side2: k === T.MOUNT || k === T.SNOW ? 16 : side, h: M.hAt(x, z) }; },
      deco: (x, z) => M.deco[z * M.W + x] === 5 && M.at(x, z) === T.SNOW ? 6 : M.deco[z * M.W + x],
      props: CITY_POS.map((c) => { const C = this.G.cities[c.id], f = C.owner && this.G.factions[C.owner]; return { kind: 'city', x: c.x + 0.5, z: c.y + 0.5, r: c.size >= 3 ? 2 : 1, size: c.size, color: f ? f.color : '#9a9a9a', roofRed: c.size >= 3, label: this.cityLabel(c.id), labelY: c.size >= 3 ? 3.4 : 2.6, labelClass: 'city', cityId: c.id }; }).concat(this.placeProps()) });
    this.cityProps = V.M.props;
    this.missionMarks();
    this.spawnParty(x, z, dir);
    V.updateChunks(x, z); V.follow(x, this.groundY(x, z), z, true); V.season(this.G.month);
    this.audio.music('field');
    this.hud();
  }
  // counties, villages and caves on the land
  placeProps() {
    return this.world.places.map((q) => { const C = this.G.cities[q.near], f = C.owner && this.G.factions[C.owner], col = f ? f.color : '#9a9a9a';
      const st = this.H.places?.[q.id], done = q.kind === 'cave' && st?.boss;
      return { kind: q.kind, x: q.x + 0.5, z: q.y + 0.5, y: this.world.hAt(q.x, q.y), color: col, placeId: q.id, labelY: q.kind === 'cave' ? 1.5 : 1.3, labelClass: 'place ' + q.kind,
        label: q.kind === 'county' ? `<b>${q.name}</b>${f ? `<i style="color:${col}">${f.name}</i>` : ''}` : q.kind === 'cave' ? `<b>${q.name}</b><i>${done ? '已平定' : '★'.repeat(q.tier)}</i>` : `<b>${q.name}</b>` }; });
  }
  // a county, a village or a cave stands in for a city: its owner is the nearest city's
  placeC(q) {
    this.placeCs ||= {}; if (this.placeCs[q.id]) return this.placeCs[q.id];
    const G = this.G, near = G.cities[q.near];
    return this.placeCs[q.id] = { id: -1, place: q, name: q.name, size: q.kind === 'county' ? 1 : 0, get owner() { return G.cities[q.near].owner; }, troops: q.kind === 'county' ? 1500 : 300, morale: 60, def: 120, pos: { x: q.x, y: q.y }, adj: near.adj, x: near.x, y: near.y };
  }
  enterPlace(q, snap, at) {
    this.mode = 'town'; const C = this.placeC(q), f = C.owner && this.G.factions[C.owner];
    const M = this.town = q.kind === 'cave' ? buildCave(q) : q.kind === 'village' ? buildVillage(q.name) : buildTown(q.name, 1, f ? f.color : '#8a8a8a', { county: true });
    M.city = null; M.C = C; M.place = q;
    const st = (this.H.places ||= {})[q.id] ||= { chests: [], odd: [], boss: false };
    if (M.cave) for (const pr of M.props) if (pr.kind === 'chest' && st.chests.includes(pr.chest)) pr.open = true;
    const [sx, sz] = at && at.place === q.id && M.walkable(at.x, at.z) ? [at.x, at.z] : M.spawn; // an old save may stand where the cave has changed
    this.pos = { x: sx, z: sz, dir: at?.dir || 'up', town: null, place: q.id };
    this.me.city = q.near; for (const id of this.H.party) this.G.gens[id].city = q.near;
    this.view.setMap({ ...M, water: null });
    this.view.updateChunks(M.W / 2, M.H / 2);
    this.townNPCs();
    if (M.cave) this.caveThings(M, st);
    this.spawnParty(sx, sz, this.pos.dir);
    this.camTo(sx, sz, true); this.view.season(this.G.month); if (this.view.torch?.visible) this.view.torch.position.set(sx + 0.5, 1.6, sz + 0.5);
    this.audio.music(M.cave ? 'field' : 'town');
    this.hud();
    if (!snap) { this.ui.toast(`<b>${q.name}</b>　${q.kind === 'county' ? '縣城' : q.kind === 'village' ? '村莊' : '洞穴　危險 ' + '★'.repeat(q.tier)}`); if (!M.cave) setTimeout(() => this.happen('town'), 500); }
  }
  // the master of a cave (until beaten) and its strange things
  caveThings(M, st) {
    const q = M.place;
    if (!st.boss) { const B = this.act.caveBoss(q), [bx, by] = M.boss; const sheet = B.beast ? beastSheet(B.beast) : personSheet(B.look); const a = this.view.addActor(sheet, bx, by, { scale: B.beast ? 1.5 : 1.25 }); if (B.beast) { a.beast = true; a.face = 2; this.view.sizeActor(a, 2.6, 1.75); this.view.placeActor(a); } a.label = this.view.addLabel(`<b style="color:#ff8a6a">${B.name}</b>`, a.sprite, B.beast ? 1.6 : 2, 'npc'); this.npcs.push({ x: bx, z: by, a, home: [bx, by], special: 'boss', boss: B }); }
    M.odd.forEach((o, i) => { if (o.kind === 'hermit' && !st.odd.includes(i)) { const a = this.view.addActor(personSheet(LOOKS.villager('隱士' + q.name)), o.x, o.z, { scale: 0.95 }); this.npcs.push({ x: o.x, z: o.z, a, home: [o.x, o.z], special: 'odd', odd: i }); } else this.view.addProp({ kind: o.kind, x: o.x, z: o.z, used: st.odd.includes(i) }); });
  }
  cityLabel(id) { const C = this.G.cities[id], f = C.owner && this.G.factions[C.owner]; return `<b>${C.name}</b>${f ? `<i style="color:${f.color}">${f.name}</i>` : '<i>無主</i>'}`; }
  // a city that changed hands gets its new warlord's flag; every label shows who holds it now
  refreshCities() {
    if (this.mode !== 'world') return;
    const places = this.placeProps();
    for (const p of this.cityProps || []) {
      // counties, villages and caves follow the city they belong to; their labels are their own
      if (p.placeId != null) {
        const q = places[p.placeId], l = this.view.labels.find((l) => l.obj === p.obj);
        if (p.color !== q.color) { this.view.mapGroup.remove(p.obj); if (l) this.view.removeLabel(l); p.color = q.color; p.label = q.label; this.view.addProp(p); }
        else if (l) l.el.innerHTML = q.label;
        continue;
      }
      if (p.cityId == null) continue;
      const C = this.G.cities[p.cityId], f = C.owner && this.G.factions[C.owner], col = f ? f.color : '#9a9a9a';
      if (p.color !== col) { this.view.mapGroup.remove(p.obj); const l = this.view.labels.find((l) => l.obj === p.obj); if (l) this.view.removeLabel(l); p.color = col; p.label = this.cityLabel(p.cityId); this.view.addProp(p); }
      else { const l = this.view.labels.find((l) => l.obj === p.obj); if (l) l.el.innerHTML = this.cityLabel(p.cityId); }
    }
  }
  // the camera follows the leader; in a town it stays inside the walls
  camTo(x, z, snap) { if (this.mode === 'town' && Math.abs(this.view.yaw) < 0.01 && this.view.zoom <= 1.02) { const mx = Math.min(9, this.town.W / 2 - 0.5), mz = Math.min(6, this.town.H / 2 - 0.5); x = Math.max(mx, Math.min(this.town.W - mx - 1, x)); z = Math.max(mz, Math.min(this.town.H - mz, z)); } this.view.follow(x, this.mode === 'town' ? 0 : this.groundY(Math.round(x), Math.round(z)), z, snap); }
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
    const M = this.town = buildTown(C.name, C.size, f ? f.color : '#8a8a8a'); M.city = cityId; M.C = C;
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
    if (!snap) { const dz = disasterAt(this, cityId); this.ui.toast(`<b>${C.name}</b>　${f ? f.name + '軍' : '無主之城'}　兵 ${C.troops}${dz ? `　<b style="color:#ff9a6a">${DIS_N[dz.k]}</b>` : ''}`); setTimeout(async () => { if (this.ui.busy || this.locked) return; if (dz) { this.locked = true; try { if (await enterStricken(this, C)) return; } finally { this.locked = false; this.hud(); } } this.happen('town'); }, 500); }
    if (!snap) this.board.onTown(C);
  }
  // stories first, then the random events of the place
  async happen(where) {
    if (this.ui.busy || this.locked || !this.G || (this.mode !== 'town' && this.mode !== 'world')) return;
    if (where === 'town') { if (await this.story.check('town')) return; await this.events.maybe('w', 0.3); }
    if (where === 'walk') await this.events.maybe('w', 0.15);
    if (where === 'field') await this.events.maybe('f', 0.1);
    if (where === 'month') { if ((this.H.sworn || []).some((id) => this.G.gens[id].status === 'dead' && !(this.H.mourned || []).includes(id))) { await mourn(this); return; } await this.story.check('month'); }
  }
  townNPCs() {
    const M = this.town, C = M.C; this.npcs = [];
    for (const n of M.npcs) { const a = this.view.addActor(personSheet(n.look), n.x, n.z, { scale: 0.95 }); this.npcs.push({ ...n, a, home: [n.x, n.z], t: Math.random() * 3 }); }
    // the generals in this city: those who serve here wait before the hall, the free ones by the tavern
    const here = this.G.gens.filter((g) => !busy(g) && (g.status === 'serving' || g.status === 'free') && g.city === C.id && !g.held);
    const serving = here.filter((g) => g.status === 'serving').sort((a, b) => (b.lead + b.war + b.int) - (a.lead + a.war + a.int)).slice(0, 6), free = here.filter((g) => g.status === 'free').slice(0, 4);
    const spots = [[11, 7], [18, 7], [12, 8], [17, 8], [10, 8], [19, 8]], fspots = [[22, 10], [25, 10], [23, 14], [26, 14]];
    serving.forEach((g, i) => { const [x, z] = spots[i]; const a = this.view.addActor(personSheet(this.lookOf(g)), x, z); a.label = this.view.addLabel(`<b>${g.name}</b>${g.rivalHero ? '<i style="color:#ff9a6a">★對手</i>' : ''}`, a.sprite, 1.75, 'npc'); this.npcs.push({ x, z, a, gen: g.id, home: [x, z] }); });
    for (const g of [...serving, ...free]) mark(this, g.id, 1);
    for (const id of sagesHere(this)) {
      const [x, z] = M.cave ? this.freeSpot(M.boss[0] + 2, M.boss[1] - 1) : this.freeSpot(M.spawn[0], Math.max(2, M.spawn[1] - 4)); const S = SAGES[id], a = this.view.addActor(personSheet(S.look()), x, z, { scale: 0.95 });
      a.label = this.view.addLabel(`<b style="color:#c8b8ff">${S.n}</b>`, a.sprite, 1.75, 'npc'); this.npcs.push({ x, z, a, home: [x, z], special: 'sage', sage: id });
    }
    free.forEach((g, i) => { const [x, z] = fspots[i]; const a = this.view.addActor(personSheet(this.lookOf(g)), x, z); a.label = this.view.addLabel(`<b>${g.name}</b><i>${g.rivalHero ? '<span style="color:#ff9a6a">★對手</span>' : '在野'}</i>`, a.sprite, 1.75, 'npc'); this.npcs.push({ x, z, a, gen: g.id, home: [x, z] }); });
  }
  // a walkable tile near (x, z) that nobody stands on
  freeSpot(x0, z0) {
    for (let r = 0; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = x0 + dx, z = z0 + dz; if (this.town.walkable(x, z) && !this.npcs.some((n) => n.x === x && n.z === z) && !(this.town.doors || []).some((d) => d.x === x && d.z === z)) return [x, z]; }
    return [x0, z0];
  }
  // ---------------------------------------------------------------- the frame
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    // the next frame is asked for first: an error in one step must never stop the game drawing (that looks like a freeze)
    requestAnimationFrame((t2) => this.frame(t2));
    try {
      if (this.mode === 'world' || this.mode === 'town') { this.camTick(dt); this.boardT = (this.boardT || 0) + dt; if (this.boardT > 0.5 && !this.ui.busy) { this.boardT = 0; this.board.check(); } if (this.auto.on) { this.auto.watch(dt); if (!this.ui.busy && !this.locked && !this.pos?.moving) this.auto.tick(dt); } this.move(dt); this.npcTick(dt); this.armyTick(dt); if (this.pos) this.view.updateChunks(this.pos.x, this.pos.z, 1); if (this.mode === 'world' && this.pos?.moving) { this.mapT = (this.mapT || 0) + dt; if (this.mapT > 0.1) { this.mapT = 0; this.screens.minimap(); } } }
      if (this.mode === 'world' || this.mode === 'town') this.view.render(dt);
    } catch (e) { console.error(e); if (this.pos) this.pos.moving = false; }
  }
  held() { if (this.auto?.on) return this.auto.hasStep() ? 'auto' : null; const k = this.keys, tp = this.tpad; if (k.has('ArrowUp') || k.has('w') || k.has('W') || tp === 'up') return 'up'; if (k.has('ArrowDown') || k.has('s') || k.has('S') || tp === 'down') return 'down'; if (k.has('ArrowLeft') || k.has('a') || k.has('A') || tp === 'left') return 'left'; if (k.has('ArrowRight') || k.has('d') || k.has('D') || tp === 'right') return 'right'; return null; }
  move(dt) {
    const P = this.pos; if (!P || this.ui.busy || this.locked) { this.animWalk(dt, false); return; }
    if (P.moving) {
      P.mt += dt * (this.mode === 'world' ? (this.onRoad ? 7.5 : 6) : 5.5); const p = Math.min(1, P.mt);
      P.fx = P.from[0] + (P.x - P.from[0]) * p; P.fz = P.from[1] + (P.z - P.from[1]) * p;
      this.place(p); this.camTo(P.fx, P.fz); if (this.view.torch?.visible) this.view.torch.position.set(P.fx + 0.5, 1.6, P.fz + 0.5);
      this.animWalk(dt, true);
      if (p >= 1) { const over = P.mt - 1; P.moving = false; P.fx = P.x; P.fz = P.z; const at = this.mode; this.arrived(); if (this.mode === at && !this.ui.busy && !this.locked && this.held()) { this.tryStep(); if (P.moving) P.mt = Math.min(0.5, over); } }
      return;
    }
    this.animWalk(dt, false); this.tryStep();
  }
  tryStep() {
    const P = this.pos, d0 = this.held();
    if (!d0) { this.bumped = null; return; }
    const d = d0 === 'auto' ? this.auto.takeStep() : this.view.screenDir(d0); if (!d) return;
    const [dx, dz, di] = DIRS[d]; P.dir = d; this.actors[0].dir = di;
    const nx = P.x + dx, nz = P.z + dz;
    if (!this.canWalk(nx, nz)) { this.place(1); this.bump(nx, nz); return; }
    // the party follows in the leader's footsteps
    this.prevTiles = this.tiles.map((t) => [...t]); this.tiles = [[nx, nz], ...this.prevTiles.slice(0, this.actors.length - 1)];
    this.bumped = null; P.from = [P.x, P.z]; P.x = nx; P.z = nz; P.mt = 0; P.moving = true;
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
      this.townSteps = (this.townSteps || 0) + 1;
      if (this.town.cave) { if (this.townSteps > 6 && Math.random() < 0.07) { this.townSteps = 0; this.act.caveFight(this.town.place); } return; }
      if (this.townSteps % 20 === 0) this.happen('walk');
      const door = this.town.doors.find((d) => d.x === P.x && d.z === P.z); if (door) { this.act.building(door); return; }
      return;
    }
    const k = this.world.at(P.x, P.z); this.onRoad = k === T.ROAD || k === T.BRIDGE;
    this.screens.minimap(); // the map in the corner keeps up with every step
    // ten steps on the land make a day, thirty days a month
    this.steps = (this.steps || 0) + 1; this.H.walk = (this.H.walk || 0) + 1;
    if (this.H.walk % 10 === 0) { this.H.days++; if (this.H.days % 30 === 0) { this.monthTick(); if (this.mode !== 'world') return; } }
    if (k === T.CITY) { const c = this.world.cityAt(P.x, P.z); this.act.cityGate(c); return; }
    if (k === T.COUNTY || k === T.VILLAGE || k === T.CAVE) { const q = this.world.placeAt(P.x, P.z); if (q) { this.act.placeGate(q); return; } }
    const m = this.H.missions.find((m) => m.x === P.x && m.z === P.z && !m.done); if (m) { this.act.missionFight(m); return; }
    if (this.steps > 5 && this.board.walk()) { this.steps = 0; return; }
    if (this.steps > 5 && Math.random() < (ENC[k] || 0) * (hasT(this.H, 'canbao') ? 0.6 : 1) * (1 - partyFx(this, 'encounter'))) { this.steps = 0; this.act.encounter(regionAt(P.x, P.z), k); return; }
    if (this.H.walk % 10 === 0) this.happen('field');
    if (this.H.walk % 10 === 0) this.hud();
  }
  thingAt(x, z) { const M = this.town; if (!M?.cave) return null; return M.chests.find((c) => c.x === x && c.z === z) || M.odd.find((o) => o.x === x && o.z === z && o.kind !== 'hermit') || null; }
  bump(x, z) {
    if (this.mode !== 'town' || this.ui.busy || this.ui.settling) return;
    const th = this.thingAt(x, z); if (th) { const key = `t${x},${z}`; if (this.bumped === key) return; this.bumped = key; this.act.caveThing(th); return; }
    const n = this.npcs.find((n) => Math.round(n.a.x) === x && Math.round(n.a.z) === z), key = `${x},${z}`;
    if (!n || this.bumped === key) return;
    this.bumped = key; this.act.talk(n);
  }
  interact() {
    const P = this.pos; if (!P || P.moving || this.ui.busy || this.ui.settling) return; const [dx, dz] = DIRS[P.dir];
    if (this.mode === 'town') { const th = this.thingAt(P.x + dx, P.z + dz); if (th) return this.act.caveThing(th); const n = this.npcs.find((n) => Math.round(n.a.x) === P.x + dx && Math.round(n.a.z) === P.z + dz); if (n) return this.act.talk(n); const door = this.town.doors.find((d) => d.x === P.x && d.z === P.z) || this.town.doors.find((d) => d.x === P.x + dx && d.z === P.z + dz); if (door) return this.act.building(door); }
  }
  leaveTown() {
    for (const n of this.npcs) this.view.removeActor(n.a);
    const q = this.town.place; if (q) { const [x, z] = this.landNear(q.x, q.y + 1, q.x, q.y); this.enterWorld(x, z, 'down'); return; }
    const [x, z] = this.cityExit(this.town.city); this.enterWorld(x, z, 'down');
  }
  ashore(x, z) { const M = this.world; for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const t = M.at(x + dx, z + dz); if (WALK[t] && t !== T.CITY && t < 15) return [x + dx, z + dz]; } return [x, z]; }
  // where one comes out of a city: two steps south of its gate as before, unless that is water - then the nearest land
  // that joins the city (廬江's south gate opens onto the river)
  cityExit(id) { const c = CITY_POS[id], R = c.size >= 3 ? 2 : 1; return this.landNear(c.x, c.y + R + 2, c.x, c.y); }
  landNear(x, z, fromX = x, fromZ = z) {
    const M = this.world, ok = (a, b) => !!WALK[M.at(a, b)] && M.at(a, b) !== T.CITY && M.at(a, b) < 15;
    if (ok(x, z)) return [x, z];
    // walk out from the city (or the place) itself, over land, to the first open tile nearest the wanted spot
    const seen = new Set([fromZ * M.W + fromX]), q = [[fromX, fromZ]], found = [];
    for (let h = 0; h < q.length && h < 4000; h++) { const [a, b] = q[h]; if (ok(a, b)) { found.push([a, b]); if (found.length > 12) break; continue; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const na = a + dx, nb = b + dz, k = nb * M.W + na; if (seen.has(k) || !WALK[M.at(na, nb)]) continue; seen.add(k); q.push([na, nb]); } }
    found.sort((p1, p2) => Math.hypot(p1[0] - x, p1[1] - z) - Math.hypot(p2[0] - x, p2[1] - z));
    return found[0] || [x, z];
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
    const regen = this.perk().regen; for (const p of this.partyList()) p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * regen));
    // the news: big events everywhere, and anything about my own faction
    const mine = before.fac;
    const big = logs.filter((e) => e.level >= 3 || (e.kind === 'rival' && e.level >= 2) || (e.level >= 2 && (e.fac === mine || e.kind === 'war' || e.kind === 'death')) || (mine && e.fac === mine && ['war', 'defect', 'succession', 'fall'].includes(e.kind)) || e.def === mine);
    this.H.news.unshift(...logs.filter((e) => e.level >= 2).map((e) => `${dateStr(e.year, e.month)}　${fmt(e)}`)); this.H.news.length = Math.min(this.H.news.length, 80);
    big.slice(0, 4).forEach((e, i) => setTimeout(() => this.ui.toast(`<small>${dateStr(e.year, e.month)}</small> ${fmt(e)}`, 4200), i * 700));
    // what changed for me
    const now = g.status === 'serving' ? g.fac : null;
    if (before.fac && !now) { this.ui.toast(`<b style="color:#ff8a6a">${G.factions[before.fac]?.name || ''}軍滅亡了，你成了在野之身。</b>`, 5000); for (const id of this.H.party) { const m = G.gens[id]; if (m.status === 'serving') { m.status = 'free'; m.fac = null; } } }
    else if (before.fac && now && before.fac !== now) this.ui.toast(`<b>你所屬的勢力併入了${G.factions[now].name}軍。</b>`, 5000);
    if (!before.lord && this.isLord()) this.ui.toast(`<b style="color:#ffd86a">你繼承了${G.factions[now].name}軍之主的地位！</b>`, 5000);
    noteDisasters(this, logs);
    this.board.month();
    { const loyal = partyFx(this, 'loyal'), mine = this.myFaction(); if (loyal) for (const id of this.H.party) { const x = G.gens[id]; if (x.status === 'serving') x.loyalty = Math.min(100, x.loyalty + Math.round(loyal * 10)); } if (mine && this.isLord()) G.factions[mine].diplo = Math.min(0.3, partyFx(this, 'diplo')); }
    if (!before.lord && this.isLord()) deed(this, `繼${G.factions[now].name}之位`, true);
    if (before.fac && !now) deed(this, `${G.factions[before.fac]?.name || ''}亡，${g.name}流落在野`);
    if (hasT(this.H, 'bazhu')) this.H.fame += 3;
    if (this.H.wound && this.H.wound <= G.t) { this.H.wound = 0; this.ui.toast('傷勢痊癒了。', 3000); }
    checkTitles(this);
    // armies on the march: this month's campaigns, walking from city to city
    for (const e of logs) if (e.kind === 'war' && e.from != null && e.city != null) this.march(e.from, e.city, G.factions[e.fac]?.color || '#888', e.win);
    this.view.season(G.month); this.refreshCities(); this.hud();
    // the end: the years are up, the realm is one, or the player's general has died
    if (G.over || G.year >= this.H.endYear || g.status === 'dead') { if (G.over && G.over === this.myFaction()) deed(this, this.isLord() ? '一統天下' : `助${G.factions[G.over].name}一統天下`, true); this.screens.ending(); return; }
    if (G.month === 1) this.ui.toast(`<b>${G.year}年</b>　距離結束還有 ${this.H.endYear - G.year} 年`, 3000);
    setTimeout(() => this.happen('month'), 300);
  }
  march(from, to, color, win) {
    if (this.mode !== 'world') return;
    const a = CITY_POS[from], b = CITY_POS[to], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 60) return;
    const act = this.view.addActor(soldierSheet('soldier', color, 'flag'), a.x, a.y + 1, { scale: 1.2 });
    act.march = { a, b, t: 0, dur: 4 + d / 8, win }; (this.armies ||= []).push(act);
  }
  armyTick(dt) {
    if (!this.armies?.length) return;
    for (const a of [...this.armies]) { const m = a.march; m.t += dt; const p = Math.min(1, m.t / m.dur); a.x = m.a.x + (m.b.x - m.a.x) * p; a.z = m.a.y + 1 + (m.b.y - m.a.y) * p; a.dir = Math.abs(m.b.x - m.a.x) > Math.abs(m.b.y - m.a.y) ? (m.b.x > m.a.x ? 2 : 1) : m.b.y > m.a.y ? 0 : 3; a.frame = Math.floor(m.t * 6) % 2 ? 0 : 2; a.y = this.mode === 'world' ? Math.max(0, this.world.hAt(Math.round(a.x), Math.round(a.z))) : 0; this.view.placeActor(a); if (p >= 1) { this.view.removeActor(a); this.armies = this.armies.filter((x) => x !== a); } }
  }
  missionMarks(list = this.H.missions) { for (const m of list) if (!m.done) this.view.addProp({ kind: 'banner', x: m.x, z: m.z, y: Math.max(0, this.world.hAt(m.x, m.z)), color: '#2a2a2a', label: `<b>${m.boss}</b>`, labelY: 1.8, labelClass: 'mission' }); }
  // ---------------------------------------------------------------- the HUD
  hud() {
    const G = this.G, g = this.me, f = this.myFaction() && G.factions[this.myFaction()], el = document.getElementById('hud');
    if (!G) { el.innerHTML = ''; return; }
    const sol = this.partyList().reduce((s, p) => s + p.rec.sol, 0), max = this.partyList().reduce((s, p) => s + p.solMax, 0);
    const tt = knownAs(this.H), hurt = this.H.wound > G.t, bot = this.auto?.on;
    el.innerHTML = `<div class="h-name"><b>${g.name}</b>${tt ? `<em class="h-title">「${tt}」</em>` : ''}<span style="color:${f ? f.color : '#c8c8c8'}">${f ? f.name + '軍・' + this.rank() : '在野'}</span>${hurt ? '<em class="h-hurt">負傷</em>' : ''}${bot ? '<em class="h-bot">🤖 代玩中</em>' : ''}</div>
      <div class="h-row"><span>${dateStr(G.year, G.month)}${this.H.days % 30 + 1}日</span><span>金 ${this.H.gold}</span><span>名聲 ${this.H.fame}</span></div>
      <div class="h-row"><span>兵力 ${sol}/${max}</span><span>Lv ${this.H.rec[this.H.pid].lv}</span><span>隊伍 ${this.H.party.length + 1}</span></div>`;
    this.screens.minimap();
  }
  // ---------------------------------------------------------------- the free camera: drag to turn, the wheel to zoom,
  // Q / E to turn, + / - to zoom, R to put it back; two fingers on a touch screen. Remembered between games.
  freeCam() {
    const V = this.view, el = V.renderer.domElement; let cam = { yaw: 0, zoom: 1 };
    try { cam = { ...cam, ...JSON.parse(localStorage.getItem('sanguo-heroes-cam') || '{}') }; } catch (e) {}
    const want = { ...cam }, keep = () => { try { localStorage.setItem('sanguo-heroes-cam', JSON.stringify(want)); } catch (e) {} };
    this.camWant = want; V.setView(want.yaw, want.zoom);
    const live = () => this.mode === 'world' || this.mode === 'town';
    let drag = null;
    const host = document.getElementById('stage');
    host.addEventListener('pointerdown', (e) => { if (!live() || e.pointerType === 'touch') return; drag = { x: e.clientX, yaw: want.yaw }; });
    addEventListener('pointermove', (e) => { if (!drag) return; want.yaw = drag.yaw - (e.clientX - drag.x) * 0.008; });
    addEventListener('pointerup', () => { if (drag) { drag = null; keep(); } });
    host.addEventListener('wheel', (e) => { if (!live()) return; e.preventDefault(); want.zoom = Math.max(0.55, Math.min(1.7, want.zoom * (e.deltaY > 0 ? 1.08 : 1 / 1.08))); keep(); }, { passive: false });
    addEventListener('keydown', (e) => {
      if (this.ui.busy || !live()) return;
      if (e.key === 'q' || e.key === 'Q') want.yaw += Math.PI / 8; if (e.key === 'e' || e.key === 'E') want.yaw -= Math.PI / 8;
      if (e.key === '+' || e.key === '=') want.zoom = Math.max(0.55, want.zoom / 1.12); if (e.key === '-' || e.key === '_') want.zoom = Math.min(1.7, want.zoom * 1.12);
      if (e.key === 'r' || e.key === 'R') { want.yaw = 0; want.zoom = 1; }
      if ('qQeE+=-_rR'.includes(e.key)) keep();
    });
    // two fingers: turn and pinch
    let t2 = null;
    host.addEventListener('touchstart', (e) => { if (e.touches.length === 2 && live()) { const [a, b] = e.touches; t2 = { ang: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX), d: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), yaw: want.yaw, zoom: want.zoom }; } }, { passive: true });
    host.addEventListener('touchmove', (e) => { if (!t2 || e.touches.length !== 2) return; const [a, b] = e.touches; want.yaw = t2.yaw - (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) - t2.ang); want.zoom = Math.max(0.55, Math.min(1.7, t2.zoom * t2.d / Math.max(20, Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)))); }, { passive: true });
    host.addEventListener('touchend', () => { if (t2) { t2 = null; keep(); } });
  }
  // ease the camera towards where it was asked to be
  camTick(dt) {
    const V = this.view, w = this.camWant; if (!w) return;
    const dy = w.yaw - V.yaw, dz = w.zoom - V.zoom; if (Math.abs(dy) < 0.001 && Math.abs(dz) < 0.001) return;
    const k = Math.min(1, dt * 10); V.setView(Math.abs(dy) < 0.001 ? w.yaw : V.yaw + dy * k, Math.abs(dz) < 0.001 ? w.zoom : V.zoom + dz * k);
    if (this.pos) this.camTo(this.pos.fx ?? this.pos.x, this.pos.fz ?? this.pos.z, true);
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
