// 電腦代玩: the computer plays the player's general. It walks the land and the towns by itself, answers every question,
// fights its battles on 全軍突擊, rests when the soldiers run low, buys better arms, recruits, takes bounties and
// hunts them down, serves a lord, works for merit, and lays siege when it is strong enough. P (or the menu) turns it
// on and off; an arrow key takes the controls back.
import { CITY_POS, T, WALK } from './world.js';
import { hostile, allied, citiesOf } from './sim/engine.js';
import { WEAPONS, ARMORS, HORSES, EQUIP, rankOf, solMax } from './hero.js';
import { itemOf, isRelic, wear, giveRelic, RELICS, PRICE } from './relics.js';
import { priceMul } from './disaster.js';

// what the computer plays for (方針): how often it does each thing, and how much it dares
export const STYLES = {
  balance: { n: '均衡', d: '什麼都做一點：任務、機會、洞穴、攻城' },
  grind: { n: '練功', d: '專心變強：剿匪、闖洞穴、練兵場操練，不攻城', rest: 0.45, opp: 0.4, bounty: 1, siege: 0, cave: 0.45, town: 0.25 },
  loot: { n: '打寶', d: '專找寶物：洞穴寶箱和洞主、四處探訪、寶物商人，幾乎不攻城', rest: 0.45, opp: 0.5, bounty: 0.5, siege: 0.02, cave: 0.75, town: 0.5 },
  war: { n: '積極攻城', d: '擴張地盤：兵一補滿就攻城，打得更遠、更敢打', rest: 0.6, opp: 0.5, bounty: 0.4, siege: 0.95, cave: 0.05, town: 0.5 },
};
Object.assign(STYLES.balance, { rest: 0.45, opp: 0.6, bounty: 1, siege: 0.6, cave: 0.2, town: 0.5 });

const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const RISKY = /忘掉|生死|斬首|斬殺|下野|離開這個|背叛|高價賣|視而不見|不關我的事|按兵不動|太危險|重新選擇|稱王天下/;
const RISKY_Q = /生死決鬥|離開.+軍嗎|賣掉|結束，結算|提前結算|斬殺/;
export class AutoPlay {
  constructor(game) { this.g = game; this.on = false; this.path = []; this.want = null; this.wait = 0; this.tasks = []; this.stuckN = 0; this.lastCity = null; this.restDay = -99; }
  get G() { return this.g.G; } get H() { return this.g.H; }
  // the level a party wants before a cave of this danger (those set on training or treasure dare a little sooner)
  caveLv(tier) { return (this.style.cave >= 0.4 ? 1 : 6) + tier * 4; }
  get style() { return STYLES[this.H?.autoMode] || STYLES.balance; }
  toggle(v = !this.on, mode) {
    if (mode) this.H.autoMode = mode;
    this.on = v; this.path = []; this.tasks = []; this.target = null;
    this.g.battle.auto = v ? true : this.g.battle.auto;
    this.g.ui.toast(v ? `<b style="color:#8affff">🤖 電腦代玩開始・${this.style.n}</b><br><small>${this.style.d}<br>按 P 或方向鍵取回控制</small>` : '🤖 電腦代玩結束，回到手動操作', 3000);
    this.g.hud();
  }
  // ---------------------------------------------------------------- answering: the option it wants, or the first safe one
  pick(opts, o = {}) {
    const ok = opts.filter((x) => !x.off);
    if (this.want) { const w = ok.find((x) => this.want.includes(x.k)); if (w) return w.k; }
    if (o.q && RISKY_Q.test(o.q)) { const no = ok.find((x) => x.k === false || x.k === null); if (no) return no.k; }
    const safe = ok.filter((x) => !RISKY.test(String(x.n)) && x.k !== null && x.k !== 'sort');
    return (safe[0] || ok.find((x) => x.k === null) || ok[0] || opts[0])?.k ?? null;
  }
  // ---------------------------------------------------------------- walking: a path over the land or a town
  bfs(W, H, can, sx, sz, goal) {
    const prev = new Int32Array(W * H).fill(-1), q = [sz * W + sx]; prev[q[0]] = q[0];
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % W, z = (k - x) / W;
      if (goal(x, z)) { const out = []; let c = k; while (c !== q[0]) { out.push([c % W, Math.floor(c / W)]); c = prev[c]; } return out.reverse(); }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const nk = nz * W + nx; if (prev[nk] >= 0) continue; if (!can(nx, nz) && !goal(nx, nz)) continue; prev[nk] = k; q.push(nk); }
      if (q.length > 60000) break;
    }
    return null;
  }
  walkTo(goal) {
    const P = this.g.pos, M = this.g.mode === 'town' ? this.g.town : this.g.world;
    if (this.g.mode === 'town') { this.path = this.bfs(M.W, M.H, (x, z) => this.g.canWalk(x, z), P.x, P.z, goal) || []; return this.path.length > 0; }
    // over the land: around the cities, counties, villages and caves on the way (stepping on one goes in), unless there is no other way
    const open = (x, z) => !!WALK[M.at(x, z)], past = (x, z) => { const t = M.at(x, z); return open(x, z) && t !== T.CITY && t !== T.COUNTY && t !== T.VILLAGE && t !== T.CAVE; };
    this.path = this.bfs(M.W, M.H, past, P.x, P.z, goal) || this.bfs(M.W, M.H, open, P.x, P.z, goal) || []; return this.path.length > 0;
  }
  hasStep() { return this.on && this.path.length > 0; }
  takeStep() {
    const P = this.g.pos, n = this.path.shift(); if (!n) return null;
    const dx = n[0] - P.x, dz = n[1] - P.z; if (Math.abs(dx) + Math.abs(dz) !== 1) { this.path = []; return null; }
    return dx > 0 ? 'right' : dx < 0 ? 'left' : dz > 0 ? 'down' : 'up';
  }
  // ---------------------------------------------------------------- the watchdog: called every frame while it plays. If nothing has
  // changed for a while - the same place, the same dialog, still locked - it shakes things loose instead of waiting
  watch(dt) {
    if (!this.on) return; const g = this.g, P = g.pos, key = `${g.mode}|${P?.x},${P?.z}|${g.ui.stack.length}|${g.locked}`;
    if (key !== this.wKey) { this.wKey = key; this.wT = 0; } else this.wT = (this.wT || 0) + dt;
    if (g.mode === 'town') this.townT = (this.townT || 0) + dt; else this.townT = 0;
    if (g.mode === 'battle' || g.mode === 'title' || g.mode === 'end') return;
    if (g.ui.busy && this.wT > 8) {                                                                               // a dialog nobody answered
      this.busyT = (this.busyT || 0) + 1; g.ui.key(this.busyT % 2 ? 'ok' : 'back'); this.wT = 6;
      if (this.busyT > 8) { this.busyT = 0; g.ui.stack.pop(); document.querySelectorAll('#ui > .talk, #ui > .menu, #ui > .panel').forEach((el, i, all) => { if (i === all.length - 1) el.remove(); }); } // last resort: close it
      return;
    }
    if (!g.ui.busy) this.busyT = 0;
    if (!g.ui.busy && g.locked && this.wT > 12) { g.locked = false; this.wT = 0; return; }                        // left locked
    if (!g.ui.busy && !g.locked && (this.wT > 5 || this.townT > 45)) {                                            // standing still, or too long in a town
      this.path = []; this.errands = []; this.townKey = null; this.wT = 0;
      if (g.mode === 'town' && (this.townT > 45 || this.stuckN++ > 1)) { this.townT = 0; this.stuckN = 0; g.leaveTown(); }
      else if (g.mode === 'world') this.wander();
    }
  }
  wander() { const P = this.g.pos; for (let k = 0; k < 30; k++) { const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 10, x = Math.round(P.x + Math.cos(a) * d), z = Math.round(P.z + Math.sin(a) * d); const t = this.g.world.at(x, z); if (WALK[t] && t !== T.CITY && t < 15 && this.walkTo((xx, zz) => xx === x && zz === z)) { this.want = null; this.target = '野外'; return true; } } return false; }
  // ---------------------------------------------------------------- deciding, a few times a second when idle
  tick(dt) {
    if (!this.on) return; this.wait -= dt; if (this.wait > 0 || this.path.length) return; this.wait = 0.4;
    try { if (this.g.mode === 'world') this.onLand(); else if (this.g.mode === 'town') this.inTown(); } catch (e) { console.error(e); this.path = []; }
  }
  party() { const L = this.g.partyList(); return { L, sol: L.reduce((t, p) => t + p.rec.sol, 0), max: L.reduce((t, p) => t + p.solMax, 0), lv: Math.round(L.reduce((t, p) => t + p.rec.lv, 0) / L.length) }; }
  near(list, P) { return list.map((c) => [c, Math.hypot(c.x - P.x, c.y - P.z)]).sort((a, b) => a[1] - b[1]); }
  goCity(C, want) { const q = CITY_POS[C.id]; this.want = want; this.target = C.name; return this.walkTo((x, z) => this.g.world.at(x, z) === T.CITY && Math.hypot(x - q.x, z - q.y) <= 3); }
  onLand() {
    const G = this.G, H = this.H, P = this.g.pos, me = this.g.me, mine = this.g.myFaction(), pt = this.party();
    const cities = G.cities.map((c) => ({ ...CITY_POS[c.id], C: c }));
    // 1. hurt: back to the nearest friendly city to rest
    const S = this.style;
    if (pt.sol < pt.max * S.rest && this.H.days - this.restDay > 3) { const own = mine ? this.near(cities.filter((c) => c.C.owner === mine), P)[0] : null, any = this.near(cities, P)[0], home = own && own[1] < any[1] + 25 ? own : any; if (home && this.goCity(home[0].C, ['in'])) return; }
    if (pt.sol < pt.max * 0.45) { if (this.wander()) return; }
    // training and treasure: the caves first
    if (S.cave >= 0.4 && Math.random() < S.cave && this.tryCave(S, pt, P, true)) return;
    // 2b. the chances of the month (情勢): the nearest one that can still be made in time, most of the time
    const opps = (H.opps || []).filter((o) => !o.done && !o.missed && o.k !== 'bandit' && o.k !== 'border').map((o) => { const c = CITY_POS[o.k === 'escort' && o.stage ? o.to : o.cid]; return [o, Math.hypot(c.x - P.x, c.y - P.z)]; })
      .filter(([o, d]) => d < 60 && (o.k !== 'gap' || (S.siege >= 0.5 && this.g.board.canSiege(G.cities[o.cid]) && pt.sol > pt.max * 0.7))).sort((a, b) => a[1] - b[1]);
    if (opps.length && Math.random() < S.opp) { const [o] = opps[0], C = G.cities[o.k === 'escort' && o.stage ? o.to : o.cid]; if (this.goCity(C, [o.k === 'gap' ? 'siege' : 'in'])) { this.target = C.name + '・' + o.k; if (o.k === 'talent') this.tasks = ['talent']; return; } }
    // 2. a bounty to hunt
    const m = H.missions.filter((x) => !x.done).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    if (m && Math.random() < S.bounty && this.walkTo((x, z) => x === m.x && z === m.z)) { this.want = null; this.target = m.boss; return; }
    // 3. strong enough: lay siege to a weak enemy city nearby
    const canSiege = mine ? (this.g.isLord() || rankOf(me.merit) >= 2) : H.fame >= 100;
    const bold = S === STYLES.war;
    if (canSiege && S.siege > 0 && pt.sol > pt.max * (bold ? 0.65 : 0.8)) {
      const prey = this.near(cities.filter((c) => c.C.owner && c.C.owner !== mine && (!mine || hostile(G, mine, c.C.owner)) && !(mine && allied(G, mine, c.C.owner)) && c.C.troops * this.g.board.gapMul(c.C.id) < pt.sol * (bold ? 3 : 1.6)), P).filter(([, d]) => d < (bold ? 65 : 40))[0];
      if (prey && Math.random() < S.siege && this.goCity(prey[0].C, ['siege'])) return;
    }
    // 4. no lord yet: go and serve the strongest one near
    if (!mine && H.fame >= (bold ? 30 : 60) && Math.random() < (bold ? 0.9 : 0.5)) { const lordCity = this.near(cities.filter((c) => c.C.owner), P).slice(0, 6).sort((a, b) => citiesOf(G, b[0].C.owner).length - citiesOf(G, a[0].C.owner).length)[0]; if (lordCity && this.goCity(lordCity[0].C, ['in'])) { this.tasks = ['serve']; return; } }
    // 5. a cave the party is ready for, or now and then a county or a village (not the one just left)
    if (Math.random() < S.cave && this.tryCave(S, pt, P)) return;
    // 6. otherwise a city now and then (shopping, bounties, work), or a walk in the country for the fights
    // shops and inns are open to anyone: one of the nearest few cities, whoever holds it
    if (Math.random() < S.town) { const c = this.near(cities.filter((c) => c.C.name !== this.lastCity), P).filter(([, d]) => d < 45).slice(0, 4)[Math.floor(Math.random() * 4)]; if (c && this.goCity(c[0].C, ['in'])) return; }
    for (let k = 0; k < 20; k++) { const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 10, x = Math.round(P.x + Math.cos(a) * d), z = Math.round(P.z + Math.sin(a) * d); const t = this.g.world.at(x, z); if (WALK[t] && t !== T.CITY && t < 15 && this.walkTo((xx, zz) => xx === x && zz === z)) { this.want = null; this.target = '野外'; return; } }
  }
  // a cave the party is ready for (or a county or a village now and then, not the one just left); true if on the way
  tryCave(S, pt, P, only) {
    const H = this.H;
      const done = (q) => q.kind === 'cave' && (H.places?.[q.id]?.boss || pt.lv < this.caveLv(q.tier) || (pt.lv < 6 + q.tier * 4 && (H.places?.[q.id]?.chests.length || 0) >= 3));
      const q = this.near(this.g.world.places.filter((q) => q.name !== this.lastCity && !done(q) && (q.kind === 'cave' || (!only && Math.random() < 0.3))).map((q) => ({ ...q, z: q.y })), P).filter(([, d]) => d < (S === STYLES.loot ? 65 : S.cave >= 0.4 ? 45 : 30))[0];
      if (q && this.walkTo((x, z) => x === q[0].x && z === q[0].y)) { this.want = null; this.target = q[0].name; return true; }
    return false;
  }
  // ---------------------------------------------------------------- in a town: a short list of errands, then out of the gate
  inTown() {
    const M = this.g.town, H = this.H, pt = this.party(), mine = this.g.myFaction();
    if (!this.townKey || this.townKey !== M) {
      this.townKey = M; const own = M.C.owner && M.C.owner === mine;
      const list = [];
      if (M.cave) { // a cave: its chests, then its master, if the party is strong enough
        const st = H.places?.[M.place.id];
        if (pt.lv >= this.caveLv(M.place.tier)) { for (const c of M.chests) if (!st?.chests.includes(c.i)) list.push({ thing: c }); const b = this.g.npcs.find((n) => n.special === 'boss'); if (b && pt.lv >= 6 + M.place.tier * 4) list.push({ npc: b }); } // the master only when strong enough
      } else {
        if (pt.sol < pt.max * 0.9 || this.g.partyList().some((p) => p.rec.sp < p.spMax * 0.5)) list.push({ door: 'inn' });
        if (H.gold > 400) list.push({ door: 'arms' });
        if ((H.items.med || 0) < 3 && H.gold > 150) list.push({ door: 'goods' });
        const talent = (H.opps || []).some((o) => o.k === 'talent' && !o.done && !o.missed && o.cid === M.C.id);
        if (H.party.length < this.g.partyMax() && (H.gold > 250 || talent)) list.push({ door: 'tavern' });
        if (this.g.board.restless(M.C) && M.C.morale < 65 && H.gold >= 200) list.push({ door: 'gov', calm: true });
        const S = this.style;
        if (S === STYLES.grind && M.doors.some((d) => d.id === 'drill')) list.push({ door: 'drill' });
        if (S === STYLES.loot) { list.push({ door: 'tavern', search: true }); if (M.C.size >= 2 && M.C.id >= 0 && H.gold > 1500) list.push({ door: 'goods', relic: true }); }
        if (this.tasks.includes('serve') && !mine) list.push({ door: 'gov', want: ['serve'] });
        else if (own) list.push({ door: 'gov' });
        else if (H.missions.filter((m) => !m.done).length < 2) list.push({ door: 'tavern', bounty: true });
      }
      this.errands = list; this.tasks = [];
    }
    const e = this.errands.shift();
    if (!e) { this.lastCity = M.C.name; const gt = M.gate; this.walkTo((x, z) => z >= M.H - 1 && x >= gt.x0 && x <= gt.x1); this.want = null; return; }
    if (e.door) { const d = M.doors.find((x) => x.id === e.door); if (!d) return; this.errand = e; this.walkTo((x, z) => x === d.x && z === d.z); return; }
    const t = e.thing || { x: Math.round(e.npc.a.x), z: Math.round(e.npc.a.z) };
    // walk next to it and then into it (a bump opens a chest or speaks to the master)
    if (this.walkTo((x, z) => Math.abs(x - t.x) + Math.abs(z - t.z) === 1)) this.path.push([t.x, t.z]);
  }
  // a door reached in a town: do the errand directly; true if handled
  async door(door, C) {
    const A = this.g.act, H = this.H, e = this.errand || {}; this.errand = null;
    const mine = this.g.myFaction(), f = mine && this.G.factions[mine];
    if (door.id === 'inn') { const cost = 8 * (H.party.length + 1); this.restDay = H.days; if (H.gold < cost) { for (const p of this.g.partyList()) p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * 0.12)); await A.passDays(3); this.g.ui.toast('🤖 沒錢住店，在馬廄歇了三天', 2500); } if (H.gold >= cost) { H.gold -= cost; for (const p of this.g.partyList()) { p.rec.sp = p.spMax; p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * 0.25)); } await A.passDays(1); this.g.saveGame(); } if (C.owner && C.owner === mine) await A.draft(C, true); else if (H.gold > 300) await this.hire(); return true; }
    if (door.id === 'arms') { this.shop(C); this.gear(); return true; }
    if (door.id === 'drill') { this.want = ['train']; await A.drill(C); this.want = null; return true; }
    if (door.id === 'goods' && e.relic) { this.buyRelic(C); return true; }
    if (door.id === 'goods') { while ((H.items.med || 0) < 4 && H.gold >= 30) { H.gold -= 30; H.items.med = (H.items.med || 0) + 1; } return true; }
    if (door.id === 'tavern') {
      if (e.bounty) { this.want = [true]; await A.missionOffer(C, null); this.want = null; return true; }
      if (e.search) { await A.search(C); return true; }
      const free = this.G.gens.filter((x) => x.status === 'free' && x.city === C.id && x.follow == null && !x.isPlayer).sort((a, b) => (b.seek > this.G.t) - (a.seek > this.G.t) || (b.lead + b.war + b.int) - (a.lead + a.war + a.int));
      if (free[0] && H.party.length < this.g.partyMax()) { this.want = [true]; await A.recruit(free[0]); this.want = null; }
      return true;
    }
    if (door.id === 'gov') {
      if (e.calm) { await this.g.board.calm(C); return true; }
      if (e.want) { this.want = e.want; await A.gov(C); this.want = null; return true; }
      if (f && C.owner === mine) {
        if (H.missions.filter((m) => !m.done).length < 2) { this.want = [true]; await A.missionOffer(C, f); }
        else { this.want = ['train', 'farm', 'comm']; await A.job(C, f); }
        await A.draft(C, true); this.want = null; return true;
      }
      return true;
    }
    return true; // anything else: just pass by
  }
  // the treasure merchant: the best piece the money allows (keeping something back)
  buyRelic(C) {
    const H = this.H, A = this.g.act, pm = priceMul(this.g, C.id), key = `${C.id}:${Math.floor(this.G.t / 3)}`; H.bought ||= {};
    const stock = A.merchantStock(C).filter((id) => !(H.bought[key] || []).includes(id)).sort((a, b) => RELICS[b].grade - RELICS[a].grade);
    const id = stock.find((id) => Math.round(PRICE[RELICS[id].grade] * pm) <= H.gold - 300); if (!id) return;
    H.gold -= Math.round(PRICE[RELICS[id].grade] * pm); (H.bought[key] ||= []).push(id); giveRelic(this.g, id); this.gear();
  }
  // put on the best treasures in the bag (a higher grade, or the same grade and more)
  gear() {
    const H = this.H; if (!(H.bag || []).length) return;
    for (const p of this.g.partyList()) for (const k of ['w', 'a', 'h', 'x']) {
      const cur = itemOf(p.rec.eq?.[k]), score = (it) => (it ? (it.grade || 0) * 100 + it.v : -1);
      const best = (H.bag || []).filter((e) => isRelic(e) && itemOf(e)?.slot === k).sort((a, b) => score(itemOf(b)) - score(itemOf(a)))[0];
      if (best && score(itemOf(best)) > score(cur)) { wear(H, p.rec, k, best); this.g.ui.toast(`🤖 ${p.g.name}裝備了${itemOf(best).n}`, 2000); }
    }
  }
  async hire() { const A = this.g.act; this.want = [true]; const C = this.g.town.C; await A.draft(C, false); this.want = null; }
  // buy the best arms the money allows, for whoever gains most
  shop(C) {
    const H = this.H, tierMax = C.size * 2, stock = [...WEAPONS, ...ARMORS, ...HORSES].filter((w) => w[4] <= tierMax);
    for (const p of this.g.partyList()) for (const kind of ['w', 'a', 'h']) {
      const cur = itemOf(p.rec.eq?.[kind]), budget = H.gold - 150; if (cur && !cur.shop) continue; // keep a treasure on
      const best = stock.filter((s) => EQUIP[s[0]].kind === kind && s[3] <= budget && s[2] > (cur?.v || 0)).sort((a, b) => b[2] - a[2])[0];
      if (!best) continue;
      H.gold -= best[3]; if (cur) H.gold += Math.round(cur.price / 2); p.rec.eq[kind] = best[0]; if (p.rec.forge) p.rec.forge[kind] = 0;
      if (kind === 'h') p.rec.sol = Math.min(solMax(p.g, p.rec), p.rec.sol);
      this.g.ui.toast(`🤖 ${p.g.name}換上了${EQUIP[best[0]].n}`, 2000);
    }
  }
}
