// 綠林: what goes on between the towns besides the generals.
// - Caravans: merchants with porters and hired guards walk the roads from city to city (as the crowd does, crowd.js: a
//   path and the step it began on). Now and then bandits fall on one: help the merchant (he pays), or rob it yourself.
// - Villages taken by bandits: a few at a time, for some months; smoke over the roofs, and the gate is the bandits'
//   stockade. Drive them out: the village thanks you.
// - The wanted: robbing caravans puts a price on your head (H.wanted, a little less each month). Bounty hunters come
//   after you on the road, and the guards at a city gate may know your face.
import { CITY_POS, T } from './world.js';
import { LOOKS } from './sprites.js';
import { THREE } from './render.js';
import { deed, bump } from './deeds.js';
import { ITEMS } from './hero.js';

const N = 46, SEE = 30, RAIDS = 7;
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const face = (x0, z0, x, z) => { const dx = x - x0, dz = z - z0; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; };
const GOODS = ['絲綢', '鹽', '茶葉', '糧食', '藥材', '鐵器', '布匹', '瓷器'];

export class Outlaws {
  constructor(game, sheet) { this.g = game; this.sheet = sheet; this.cars = null; this.Gref = null; this.drawn = new Map(); this.mapRef = null; this.marks3 = new Map(); this.fxT = 0; this.met = {}; }
  get G() { return this.g.G; }
  get H() { return this.g.H; }
  get now() { return this.g.crowd.now; }
  // ---------------------------------------------------------------- caravans
  sync() {
    if (this.Gref === this.G && this.cars) return; this.Gref = this.G;
    const cs = this.G.cities.filter((c) => CITY_POS[c.id] && c.adj.length);
    this.cars = Array.from({ length: N }, (_, i) => { const a = cs[(i * 13) % cs.length]; return { id: i, a: a.id, b: a.adj[i % a.adj.length], t0: this.now - R(0, 120), goods: GOODS[i % GOODS.length], rob: null }; });
  }
  // where a caravan is now: on its road (or resting in a town at the end of it, null)
  cur(c) {
    if (this.now < c.t0) return null;   // (robbed: back in town a while)
    for (let k = 0; k < 8; k++) {
      const p = this.g.crowd.road(c.a, c.b, true); if (p === undefined) return null; if (!p) { c.b = pick(this.G.cities[c.a].adj); c.t0 = this.now; return null; }
      const end = c.t0 + p.length + (c.rob ? c.rob.n : 0), rest = 20;
      if (this.now < end) { let i = this.now - c.t0; if (c.rob) { if (i >= c.rob.i + c.rob.n) i -= c.rob.n; else if (i >= c.rob.i) return { p, i: c.rob.i, rob: true }; } return { p, i: Math.min(p.length - 1, i), rob: false }; }
      if (this.now < end + rest) return null;
      // on to the next town: and on some roads, bandits wait
      c.t0 = end + rest; c.a = c.b; c.b = pick(this.G.cities[c.a].adj); const q = this.g.crowd.road(c.a, c.b);
      c.rob = q && q.length > 20 && Math.random() < 0.3 ? { i: R(8, q.length - 8), n: R(12, 24) } : null;
    }
    return null;
  }
  // the bandits are beaten (or the caravan robbed): it goes on (or home)
  free(c) { const w = this.cur(c); if (!w?.rob) return; const e = this.now - c.t0 - c.rob.i; c.rob.n = Math.max(0, e); }
  // ---------------------------------------------------------------- villages held by bandits
  raids() { return (this.H.raids ||= {}); }
  raided(q) { const r = this.raids()[q.id]; return !!r && r > this.G.t; }
  month() { this.fill(); const H = this.H; if (H.wanted) { H.wanted = Math.max(0, H.wanted - 4); if (!H.wanted) this.g.ui.toast('官府對你的通緝撤銷了。', 3500); } }
  fill() {
    const G = this.G, H = this.H, rd = this.raids();
    for (const k in rd) if (rd[k] <= G.t) delete rd[k];
    const vs = (this.g.world?.places || []).filter((q) => q.kind === 'village');
    const P = this.g.pos, near = vs.filter((q) => P && Math.hypot(q.x - P.x, q.y - P.z) < 70 && !rd[q.id]);
    while (Object.keys(rd).length < RAIDS && vs.length) { const q = near.length && Math.random() < 0.5 ? near.splice(R(0, near.length - 1), 1)[0] : pick(vs); if (!rd[q.id]) rd[q.id] = G.t + R(3, 7); }
  }
  // ---------------------------------------------------------------- drawn on the land
  tick(dt) {
    const game = this.g, V = game.view; if (!V || !this.G) return; this.sync(); if (!this.H.raidsOn && game.world) { this.H.raidsOn = 1; this.fill(); }
    if (V.M !== this.mapRef) { this.mapRef = V.M; this.drawn.clear(); this.marks3.clear(); }
    if (game.mode !== 'world') return;
    const P = game.pos, live = new Set(), clock = (this.clock = (this.clock || 0) + dt);
    for (const c of this.cars) {
      const w = this.cur(c); if (!w) continue; const at = w.p[w.i]; if (Math.hypot(at[0] - P.x, at[1] - P.z) > SEE) continue;
      live.add(c.id); let D = this.drawn.get(c.id);
      if (!D) {
        const boss = V.addActor(this.sheet(LOOKS.villager('商' + c.id)), at[0], at[1]);
        const men = [V.addActor(this.sheet(LOOKS.villager('夫' + c.id)), at[0], at[1], { scale: 0.85 }), V.addActor(this.sheet(LOOKS.soldier('#8a7a5a')), at[0], at[1], { scale: 0.85 }), V.addActor(this.sheet(LOOKS.soldier('#8a7a5a')), at[0], at[1], { scale: 0.85 })];
        D = { boss, men, foes: [], key: '' }; this.drawn.set(c.id, D);
      }
      const key = String(w.rob); if (D.key !== key) { D.key = key; if (D.boss.label) V.removeLabel(D.boss.label); D.boss.label = V.addLabel(`<b style="color:#e8d8a0">${this.G.cities[c.b]?.name || ''}商隊</b><i style="color:${w.rob ? '#ff8a6a' : '#c8e8ff'}">${w.rob ? '遭劫！' : c.goods}</i>`, D.boss.sprite, 1.7, 'npc'); }
      D.at = at;
      const step = (k) => w.p[Math.max(0, w.i - k)];
      this.put(V, D.boss, at[0], at[1], dt, w.rob ? 2 : null, w.rob ? clock : 0);
      D.men.forEach((m, k) => { if (w.rob) this.put(V, m, at[0] - 0.7 + (k === 0 ? -0.6 : 0.4), at[1] + (k - 1) * 0.7, dt, 2, k ? clock + k : 0); else { const q = step(k + 1); this.put(V, m, q[0] + (k % 2 ? 0.3 : -0.3), q[1], dt); } });
      const nF = w.rob ? 3 : 0; while (D.foes.length > nF) V.removeActor(D.foes.pop());
      while (D.foes.length < nF) D.foes.push(V.addActor(this.sheet(LOOKS.bandit()), at[0] + 2, at[1], { scale: 0.9 }));
      D.foes.forEach((b, k) => this.put(V, b, at[0] + 1.5 + (k % 2) * 0.5, at[1] + (k - 1) * 0.8, dt, 1, clock * 1.1 + k));
      if (w.rob && (this.fxT -= dt) <= 0) { this.fxT = 0.4; if (Math.random() < 0.6) game.crowd.fx?.sparks(at[0] + 1.3, 0.8 + Math.max(0, game.world.hAt(at[0], at[1])), at[1] + 0.5, 4); }
    }
    for (const [id, D] of this.drawn) if (!live.has(id)) this.drop(V, id, D);
    // smoke over the villages the bandits hold
    const rd = this.raids();
    for (const [id, m] of this.marks3) if (!(rd[id] > this.G.t)) { V.removeLabel(m.l); V.scene.remove(m.o); this.marks3.delete(id); }
    for (const id in rd) {
      if (rd[id] <= this.G.t) continue; const q = game.world.places[id]; if (!q) continue; const d = Math.hypot(q.x - P.x, q.y - P.z);
      let m = this.marks3.get(+id); if (d > 45) { if (m) { V.removeLabel(m.l); V.scene.remove(m.o); this.marks3.delete(+id); } continue; }
      if (!m) { const o = new THREE.Object3D(); o.position.set(q.x + 0.5, Math.max(0, game.world.hAt(q.x, q.y)) + 0.6, q.y + 0.5); V.scene.add(o); m = { o, l: V.addLabel('<b style="color:#ff7a5a">被山賊佔據</b>', o, 1.9, 'mission'), t: 0 }; this.marks3.set(+id, m); }
      if ((m.t -= dt) <= 0 && game.crowd.fx) { m.t = 0.5; game.crowd.fx.add('smoke', { x: q.x + 0.5 + (Math.random() - 0.5), y: m.o.position.y + 0.5, z: q.y + 0.5, vy: 1 + Math.random() * 0.6, vx: 0.2, life: 1.8, s0: 0.5, s1: 1.6, alpha: 0.55 }); if (d < 25 && Math.random() < 0.3) game.crowd.fx.flames(q.x, q.y, 3); }
    }
  }
  put(V, a, tx, tz, dt, look, swing) {
    const k = Math.min(1, dt * 6), x0 = a.x, z0 = a.z; a.x += (tx - a.x) * k; a.z += (tz - a.z) * k;
    const d = Math.hypot(a.x - x0, a.z - z0); if (d > 0.004) { a.dir = face(x0, z0, a.x, a.z); a.walkT = (a.walkT || 0) + d; a.frame = Math.floor(a.walkT * 3) % 2 ? 0 : 2; } else a.frame = swing ? (Math.floor(swing * 4) % 2 ? 0 : 2) : 1;
    if (look != null && d <= 0.004) a.dir = look;
    a.y = Math.max(0, this.g.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a);
  }
  drop(V, id, D) { for (const a of [D.boss, ...D.men, ...D.foes]) V.removeActor(a); this.drawn.delete(id); }
  // ---------------------------------------------------------------- meeting them
  meet() {
    const game = this.g, P = game.pos, H = this.H; if (game.mode !== 'world' || game.auto?.on || !this.cars) return false;
    for (const c of this.cars) {
      const D = this.drawn.get(c.id); if (!D?.at || Math.abs(D.at[0] - P.x) > 1 || Math.abs(D.at[1] - P.z) > 1) continue;
      if ((this.met[c.id] ?? -999) > H.walk - 25) continue; this.met[c.id] = H.walk; this.talk(c); return true;
    }
    return false;
  }
  async talk(c) {
    const game = this.g, ui = game.ui, w = this.cur(c), look = LOOKS.villager('商' + c.id), to = this.G.cities[c.b]?.name || '';
    const opts = w?.rob ? [{ k: 'help', n: '救援商隊', d: '打退山賊，商人會付謝禮' }, { k: null, n: '離開' }] : [{ k: 'talk', n: '交談' }, { k: 'rob', n: '打劫商隊', d: '搶他們的貨物和錢財（會被官府通緝）' }, { k: null, n: '離開' }];
    const k = await ui.ask(w?.rob ? '救命啊！山賊搶劫了！' : `我們是運${c.goods}到${to}的商隊。`, opts, `${to}商隊`, look);
    if (k === 'talk') await ui.say('商人', pick([`最近路上不太平，聽說有山賊佔了村子。`, `${to}的${c.goods}能賣個好價錢。`, '保鏢的錢可不便宜啊。', ...this.rumor()]), look);
    if (k === 'help') await this.help(c, look);
    if (k === 'rob') await this.rob(c, look);
  }
  rumor() { const rd = this.raids(), out = []; for (const id in rd) if (rd[id] > this.G.t) { const q = this.g.world.places[id]; if (q) out.push(`聽說${q.name}被山賊佔了，村民苦不堪言。`); } return out.slice(0, 3); }
  async help(c, look) {
    const act = this.g.act, H = this.H, lv = act.foeLv(), base = pick(['山賊', '流寇', '響馬']);
    const foes = Array.from({ length: R(2, 4) }, (_, i) => act.foe(i ? base : base + '頭目', 'bandit', Math.max(1, lv + R(-1, 1)), null, !i));
    this.g.audio.sfx('encounter'); const r = await act.fight(foes, { terrain: act.terrainAt(), title: '救援商隊！' });
    this.free(c); if (r !== 'win') return;
    const gold = 40 + lv * 5; H.gold += gold; H.fame += 4; H.st.bandits += foes.length; bump(H, 'ren'); this.g.audio.sfx('coin'); this.g.hud();
    await this.g.ui.say('商人', `恩人哪！這點謝禮請一定收下。\n（金 +${gold}、名聲 +4）`, look);
  }
  async rob(c, look) {
    const act = this.g.act, H = this.H, lv = act.foeLv();
    const foes = Array.from({ length: R(2, 3) }, (_, i) => act.foe(i ? '鏢師' : '總鏢頭', 'soldier', Math.max(1, lv + 1), '#8a7a5a', !i));
    this.g.audio.sfx('encounter'); const r = await act.fight(foes, { terrain: act.terrainAt(), title: '打劫商隊！', ambush: true });
    if (r !== 'win') return;
    const gold = 120 + lv * 10 + R(0, 80); H.gold += gold; H.wanted = (H.wanted || 0) + 25; bump(H, 'cruel'); H.fame = Math.max(0, H.fame - 5);
    c.t0 = this.now + 200; c.rob = null; // it limps home
    this.g.audio.sfx('coin'); this.g.hud();
    await this.g.ui.say('', `搶到了一車${c.goods}，換了 ${gold} 金。\n官府開始通緝你了（懸賞 ${this.bounty()} 金）。名聲 -5`);
  }
  bounty() { return (this.H.wanted || 0) * 10; }
  // bounty hunters on the road (instead of bandits, now and then, the higher the price the more often)
  hunters() {
    const H = this.H, w = H.wanted || 0; if (w < 10 || Math.random() > Math.min(0.5, w / 120)) return false;
    const act = this.g.act, lv = act.foeLv() + Math.min(6, Math.floor(w / 25));
    const foes = Array.from({ length: Math.min(4, 2 + Math.floor(w / 40)) }, (_, i) => act.foe(i ? '捕快' : '賞金獵人', 'soldier', lv, '#3a3a4a', !i));
    (async () => { await this.g.ui.say('賞金獵人', `${this.g.me.name}！你的人頭值 ${this.bounty()} 金，乖乖受死吧！`, LOOKS.soldier('#3a3a4a')); this.g.audio.sfx('encounter'); const r = await act.fight(foes, { terrain: act.terrainAt(), title: '賞金獵人！' }); if (r === 'win') { H.wanted += 3; this.g.hud(); } })();
    return true;
  }
  // at a city gate, the guards may know the face
  async gate(C) {
    const H = this.H, w = H.wanted || 0; if (w < 30 || Math.random() > 0.35 + w / 300) return true;
    const pay = w * 4, f = C.owner && this.G.factions[C.owner];
    const k = await this.g.ui.ask(`城門守衛盯著你看：「你不就是告示上懸賞 ${this.bounty()} 金的那個人嗎？」`, [{ k: 'pay', n: `賄賂（${pay} 金）`, d: '通緝減半', off: H.gold < pay }, { k: 'fight', n: '硬闖', d: '和守衛打一場，通緝加重' }, { k: null, n: '離開' }], '守衛', LOOKS.soldier(f ? f.color : '#8a7a6a'));
    if (k === 'pay') { H.gold -= pay; H.wanted = Math.floor(w / 2); this.g.hud(); return true; }
    if (k === 'fight') { const act = this.g.act, lv = act.foeLv() + 1, foes = Array.from({ length: 3 }, (_, i) => act.foe(i ? '守城士兵' : '城門校尉', 'soldier', lv, f ? f.color : '#8a7a6a', !i)); const r = await act.fight(foes, { terrain: 'city', title: '硬闖城門！' }); H.wanted += 10; return r === 'win'; }
    return false;
  }
  // a village taken: the bandits' stockade at its gate
  async village(q) {
    const act = this.g.act, H = this.H, ui = this.g.ui;
    const k = await ui.ask(`${q.name}被山賊佔據了！\n村口立起了寨柵，村民被關在裡面，哭聲隱約可聞……`, [{ k: 'go', n: '攻打山寨', d: '打退山賊，解救村民' }, { k: null, n: '離開' }], q.name);
    if (k !== 'go') return false;
    const lv = act.foeLv() + 2, base = pick(['山賊', '黃巾餘黨', '流寇']), kind = base === '黃巾餘黨' ? 'turban' : 'bandit';
    const foes = [act.foe(pick(['黑風寨主', '獨眼龍', '過山虎', '鑽天鷂', '混世魔王']), kind, lv + 1, null, true), ...Array.from({ length: R(2, 4) }, () => act.foe(base, kind, lv))];
    this.g.audio.sfx('encounter'); const r = await act.fight(foes, { terrain: act.terrainAt(), title: `攻打${q.name}的山寨！` });
    if (r !== 'win') return false;
    delete this.raids()[q.id];
    const gold = 80 + lv * 8; H.gold += gold; H.fame += 10; H.st.bandits += foes.length; bump(H, 'ren'); if (H.wanted) H.wanted = Math.max(0, H.wanted - 10);
    const gift = pick(['wine', 'med2', 'rice', 'med2']); H.items[gift] = (H.items[gift] || 0) + 1;
    deed(this.g, `解救${q.name}`); this.g.audio.sfx('level'); this.g.hud();
    await ui.say('村長', `恩人！山賊被趕跑了，${q.name}的百姓永遠記得您的大恩！\n（金 +${gold}、名聲 +10${H.wanted ? '、通緝減輕' : ''}，村民送了一份${ITEMS[gift].n}）`, LOOKS.villager('村長' + q.id));
    return true;
  }
  marks(x, s) {
    const rd = this.raids?.() || {};
    for (const id in rd) { if (rd[id] <= this.G.t) continue; const q = this.g.world.places[id]; if (!q) continue; x.strokeStyle = '#ff5a3a'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(q.x * s - 3, q.y * s - 3); x.lineTo(q.x * s + 3, q.y * s + 3); x.moveTo(q.x * s + 3, q.y * s - 3); x.lineTo(q.x * s - 3, q.y * s + 3); x.stroke(); }
  }
}
