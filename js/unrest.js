// 亂世之災: what a disaster does beyond the city walls. Out of a city struck by famine the hungry take to the roads
// (流民: drawn on the land, walking away from it; share your rations with them, for renown); the country round a
// stricken city swarms with bandits (more fights on the road); and now and then someone raises the starving in revolt
// (民變: a black banner near the city — put it down, or talk them into laying down their arms; left alone for three
// months, the rebels storm the city: its garrison and its people's hearts are broken, or its soldiers put them down).
import { CITY_POS } from './world.js';
import { LOOKS } from './sprites.js';
import { record } from './sim/engine.js';
import { disasterAt, famine, DIS_N } from './disaster.js';
import { deed, bump } from './deeds.js';

const SEE = 30, pick = (a) => a[Math.floor(Math.random() * a.length)];
const face = (x0, z0, x, z) => { const dx = x - x0, dz = z - z0; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; };
const LEAD = ['張', '王', '李', '趙', '陳', '馬', '劉', '孫'], GIV = ['角', '牛角', '白騎', '燕', '雷公', '大目', '毒', '白繞'];

export class Unrest {
  constructor(game, sheet) { this.g = game; this.sheet = sheet; this.drawn = new Map(); this.mapRef = null; this.met = {}; }
  get G() { return this.g.G; } get H() { return this.g.H; }
  // the cities struck by famine
  hungry() { return this.G.cities.filter((c) => { const d = CITY_POS[c.id] && disasterAt(this.g, c.id); return d && famine(d.k); }); }
  // fights on the road: more of them near a stricken city
  encMul(x, z) { for (const c of this.G.cities) { if (!CITY_POS[c.id] || !disasterAt(this.g, c.id)) continue; if (Math.hypot(CITY_POS[c.id].x - x, CITY_POS[c.id].y - z) < 24) return 1.6; } return 1; }
  // the month: someone raises the starving; a revolt left alone breaks out
  month(logs) {
    const G = this.G, H = this.H, g = this.g;
    for (const e of logs) {
      const d = e.city != null && disasterAt(g, e.city); if (!d || e.key !== d.k || Math.random() > 0.4) continue;
      const C = G.cities[e.city]; if (H.missions.some((m) => m.rise === C.id && !m.done)) continue;
      const m = g.act.newMission(C, !!g.myFaction() && C.owner === g.myFaction()); if (!m) continue;
      Object.assign(m, { rise: C.id, boss: `${pick(LEAD)}${pick(GIV)}`, kind: 'turban', minion: '饑民', lv: m.lv + 2, until: G.t + 3, gold: Math.round(m.gold * 0.8), fame: Math.round(m.fame * 1.3), merit: m.merit ? m.merit + 10 : 0 });
      H.missions.push(m); if (g.mode === 'world') g.missionMarks([m]);
      const P = g.pos, px = P?.town != null ? CITY_POS[P.town].x : P?.x, pz = P?.town != null ? CITY_POS[P.town].y : P?.z, near = P && Math.hypot(CITY_POS[C.id].x - px, CITY_POS[C.id].y - pz) < 90;
      if (near || (C.owner && C.owner === g.myFaction())) setTimeout(() => g.ui.toast(`<b style="color:#ff8a6a">${C.name}${DIS_N[d.k]}，${m.boss}聚集饑民起事了！</b><br><small>三個月內不平定，饑民就會攻城（地圖上以黑旗標示）</small>`, 5500), 1500);
    }
    for (const m of H.missions) {
      if (m.rise == null || m.done || m.until > G.t) continue; m.done = true; g.act.dropBanner(m); const C = G.cities[m.rise];
      if (Math.random() < 0.45) { record(G, 'rise', 'riseDown', { c: C.name, g: m.boss }, C.owner, 1, {}); continue; }
      C.troops = Math.round(C.troops * 0.6); C.morale = Math.max(0, C.morale - 25);
      record(G, 'rise', 'riseUp', { c: C.name, g: m.boss }, C.owner, 2, {});
      if (C.owner && C.owner === g.myFaction()) g.ui.toast(`<b style="color:#ff8a6a">${m.boss}率饑民攻進了${C.name}！</b>　守軍折損四成，民心大跌。`, 5000);
    }
    H.missions = H.missions.filter((m) => !m.done);
  }
  // the rebels' camp reached: fight, or talk them down; true if the fight is already handled
  async camp(m) {
    const g = this.g, ui = g.ui, H = this.H, G = this.G, C = G.cities[m.rise], look = LOOKS.turban ? LOOKS.turban() : null;
    const p = Math.min(0.85, 0.2 + (g.me.cha - 50) / 100 + ((H.food || 0) >= 10 * g.hard.need() ? 0.2 : 0));
    const k = await ui.ask(`${m.boss}帶著上千名饑民，在${C.name}城外紮營。\n「官府不給我們活路，我們只好自己找活路！」`, [{ k: 'fight', n: '討伐', d: '擊敗他們' }, { k: 'talk', n: '招安', d: `勸他們放下武器（成功率 ${Math.round(p * 100)}%；帶的乾糧夠多，成功率更高）` }, { k: null, n: '離開' }], m.boss, look);
    if (k == null) return true;
    if (k === 'talk') {
      if (Math.random() < p) {
        m.done = true; g.act.dropBanner(m); H.missions = H.missions.filter((x) => !x.done);
        const give = Math.min(H.food || 0, Math.round(10 * g.hard.need())); H.food -= give; H.fame += m.fame; bump(H, 'ren'); C.morale = Math.min(100, C.morale + 10);
        for (const q of g.partyList()) q.rec.sol = Math.min(q.solMax, q.rec.sol + Math.round(q.solMax * 0.15));
        if (m.official && g.me.status === 'serving') { g.me.merit += m.merit; g.act.promote(); }
        deed(g, `招安${C.name}的饑民`); record(G, 'rise', 'riseDown', { c: C.name, g: m.boss }, C.owner, 1, {});
        await ui.say(m.boss, `……你說得對，跟著你，至少還有口飯吃。\n（饑民放下了武器，有些人加入了你的隊伍：兵力回復一成五。名聲 +${m.fame}${give ? `，分給他們 ${Math.round(give / g.hard.need())} 天份的乾糧` : ''}）`, look); g.hud();
        return true;
      }
      await ui.say(m.boss, '少來這套！官府的話，我一個字也不信！弟兄們，上！', look);
    }
    return false;
  }
  // ---------------------------------------------------------------- 流民 on the roads out of a hungry city
  groups() { const out = []; for (const C of this.hungry()) { const adj = C.adj.filter((a) => CITY_POS[a]); for (let i = 0; i < Math.min(3, adj.length); i++) out.push({ id: C.id * 10 + i, a: C.id, b: adj[i] }); } return out; }
  where(q) { const p = this.g.crowd.road(q.a, q.b, true); if (!p || p.length < 6) return null; const n = this.g.crowd.now, L = Math.min(p.length, 40), i = (n + q.id * 7) % (L * 2); return p[Math.min(L - 1, i < L ? i : L * 2 - 1 - i)]; }
  tick(dt) {
    const g = this.g, V = g.view; if (!V || !this.G) return;
    if (V.M !== this.mapRef) { this.mapRef = V.M; this.drawn.clear(); }
    if (g.mode !== 'world') return;
    if ((this.scanT = (this.scanT || 0) - dt) <= 0 || !this.list) { this.scanT = 1; this.list = this.groups(); }
    const P = g.pos, live = new Set();
    for (const q of this.list) {
      const at = this.where(q); if (!at || Math.hypot(at[0] - P.x, at[1] - P.z) > SEE) continue; live.add(q.id);
      let D = this.drawn.get(q.id);
      if (!D) { D = { men: Array.from({ length: 4 }, (_, k) => V.addActor(this.sheet(LOOKS.villager('流' + q.id + k)), at[0], at[1], { scale: k ? 0.85 : 0.95 })), at }; D.men[0].label = V.addLabel('<b style="color:#d8c8a0">流民</b><i>逃荒</i>', D.men[0].sprite, 1.6, 'npc'); this.drawn.set(q.id, D); }
      D.at = at;
      D.men.forEach((a, k) => { const tx = at[0] + [0, -0.6, 0.5, -0.2][k], tz = at[1] + [0, 0.5, 0.6, -0.6][k], x0 = a.x, z0 = a.z, e = Math.min(1, dt * 4); a.x += (tx - a.x) * e; a.z += (tz - a.z) * e; const d = Math.hypot(a.x - x0, a.z - z0); if (d > 0.003) { a.dir = face(x0, z0, a.x, a.z); a.walkT = (a.walkT || 0) + d; a.frame = Math.floor(a.walkT * 3) % 2 ? 0 : 2; } else a.frame = 1; a.y = Math.max(0, g.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a); });
    }
    for (const [id, D] of this.drawn) if (!live.has(id)) { for (const a of D.men) V.removeActor(a); this.drawn.delete(id); }
  }
  meet() {
    const g = this.g, P = g.pos, H = this.H; if (g.mode !== 'world' || g.auto?.on) return false;
    for (const [id, D] of this.drawn) { if (Math.abs(D.at[0] - P.x) > 1 || Math.abs(D.at[1] - P.z) > 1 || (this.met[id] ?? -999) > H.walk - 60) continue; this.met[id] = H.walk; this.talk(id); return true; }
    return false;
  }
  async talk(id) {
    const g = this.g, ui = g.ui, H = this.H, look = LOOKS.villager('流' + id + '0'), C = this.G.cities[Math.floor(id / 10)], share = Math.round(5 * g.hard.need());
    const k = await ui.ask(`我們是從${C?.name || ''}逃出來的……田裡顆粒無收，一家老小已經三天沒吃東西了。\n大人，行行好吧……`, [{ k: 'give', n: '分給他們五天份的乾糧', d: '名聲 +8', off: (H.food || 0) < share }, { k: 'gold', n: '給他們 30 金', off: H.gold < 30 }, { k: null, n: '默默走開' }], '流民', look);
    if (k === 'give') { H.food -= share; H.fame += 8; bump(H, 'ren'); await ui.say('流民', '謝謝大人！謝謝大人！您是我們的救命恩人！', look); }
    if (k === 'gold') { H.gold -= 30; H.fame += 3; await ui.say('流民', '大人的恩情，我們一輩子都忘不了。', look); }
    g.hud();
  }
}
