// Battles in the manner of the old Famicom Three Kingdoms RPGs: your generals on the right, the enemy on the left, each
// general's soldiers are their strength. Give every general an order (attack, a stratagem, an item, a duel, retreat),
// then the round plays out in order of speed. A general whose soldiers are gone is routed. The stage is a small HD-2D
// diorama; each general stands before a squad of soldiers that thins as the numbers fall.
//
// Duels (一騎討): two generals alone between the armies. Each turn both choose — 攻擊, 猛攻 (strong, but a guard turns it
// back), 防守 (blocks most and builds fury) or 必殺 (when fury is full) — and 武力 decides the rest.
import { View, THREE, personSheet, beastSheet, canvasTex } from './render.js';
import { LOOKS, shade, soldierSheet } from './sprites.js';
import { TACTICS, tacticsOf, bstats, ITEMS, usable, armsOf, hasHorse, TROOPS, troopMul, FORMS } from './hero.js';
import { hasT, bump } from './deeds.js';
import { battleMods } from './bonds.js';
import { relicFx } from './relics.js';
import { FX } from './fx.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2), easeIn = (p) => p * p * p, easeOut = (p) => 1 - (1 - p) ** 3;
const GROUND = { river: [0, 1], cave: [2, 6], plain: [0, 1], forest: [5, 0], hill: [9, 6], desert: [8, 2], snow: [7, 6], city: [18, 10], marsh: [22, 0], coast: [4, 0] };

export class Battle {
  constructor(game) { this.game = game; this.root = document.getElementById('battle'); this.ui = this.root.querySelector('.b-ui'); }
  ensureView() {
    if (this.view) return;
    this.view = new View(this.root.querySelector('.b-stage'));
    this.view.camOff.set(0, 11, 11); this.view.camera.fov = 38; this.view.camera.updateProjectionMatrix();
    this.view.tsH.uniforms.band.value = this.view.tsV.uniforms.band.value = 0.24;
    this.fx = new FX(this.view.scene); this.tw = [];
    this.view.sun.shadow.mapSize.set(1024, 1024); // the small stage does not need the land's big shadow map
  }
  // a tween: fn(p) every frame for dur seconds, p from 0 to 1; resolves when done
  tween(dur, fn) { return new Promise((res) => this.tw.push({ t: 0, dur, fn, res })); }
  shake(k = 0.25) { this.shakeT = Math.max(this.shakeT || 0, k); }
  // ---------------------------------------------------------------- the stage
  stage(terrain, siege) {
    const v = this.view, [top, alt] = GROUND[terrain] || GROUND.plain, W = 18, H = 12;
    const rnd = (x, z) => ((x * 73 + z * 151) % 17) / 17;
    v.setMap({ W, H, water: terrain === 'coast' || terrain === 'river' ? -0.2 : null, sky: { snow: '#c8d8e8', desert: '#e8c890', city: '#b8c8d8', cave: '#120c08' }[terrain] || '#a8d0f0', fogNear: terrain === 'cave' ? 12 : 18, fogFar: terrain === 'cave' ? 30 : 40, dark: terrain === 'cave',
      tile: (x, z) => { if (x < 0 || z < 0 || x >= W || z >= H) return null; const back = z < 3; return { top: back && siege ? 11 : terrain === 'cave' && back ? 16 : rnd(x, z) < 0.18 ? alt : top, side: siege && back ? 11 : terrain === 'cave' ? 16 : 15, h: back ? (siege ? 1.6 : terrain === 'cave' ? 2.4 : terrain === 'hill' ? 0.9 : terrain === 'river' ? -0.5 : 0.3) : 0 }; },
      deco: (x, z) => (z === 1 || z === 2) && !siege && terrain !== 'cave' && rnd(x, z) < 0.45 ? (terrain === 'forest' ? 2 : terrain === 'hill' ? 5 : terrain === 'snow' ? 6 : terrain === 'desert' ? (rnd(z, x) < 0.5 ? 5 : 0) : 1 + Math.floor(rnd(z, x) * 3)) : 0,
      props: siege ? [{ kind: 'banner', x: 3, y: 1.6, z: 1, color: siege.color }, { kind: 'banner', x: 13, y: 1.6, z: 1, color: siege.color }] : [] });
    v.updateChunks(9, 6); v.follow(7.6, 0, 5.2, true);
  }
  unitActor(u, x, z, face, noSquad) {
    const v = this.view, sheet = u.beast ? beastSheet(u.beast) : personSheet(u.look);
    const a = v.addActor(sheet, x, z, { scale: u.beast ? 1.3 : 1.2 });
    if (u.beast) { a.tex.repeat.set(1 / 2, 1); a.beast = true; v.sizeActor(a, 1.75, 1.3); }
    a.face = face; this.setFrame(a, 1);
    // the squad: a few soldiers behind the general
    u.squad = [];
    const kind = u.side === 'party' ? 'soldier' : u.solKind || 'soldier', col = u.side === 'party' ? this.partyColor : u.color || '#8a4a3a';
    if (!u.beast && !noSquad) for (let k = 0; k < 6; k++) { const sx = x + (face === 1 ? 1 : -1) * (0.8 + (k % 3) * 0.55), sz = z - 0.8 + Math.floor(k / 3) * 0.65 + (k % 3) * 0.08;
      const role = kind === 'nomad' || u.troop === 'bow' ? 'bow' : k === 1 && kind === 'soldier' ? 'flag' : k === 5 && (kind === 'soldier' || kind === 'turban') ? 'bow' : 'spear';
      const s = v.addActor(soldierSheet(kind, col, role), sx, sz, { scale: 0.68 }); s.face = face; s.home = [sx, sz]; s.ph = Math.random() * 6; this.setFrame(s, 1); u.squad.push(s); }
    u.actor = a; u.home = [x, z]; u.ox = 0; u.oz = 0; u.oy = 0; u.sx = 0; u.alive0 = true; u.shown = u.squad.length;
    u.bar = v.addLabel('', a.sprite, u.beast ? 1.5 : 2.0, 'u-bar'); this.drawBar(u);
  }
  setFrame(a, f) { if (a.beast) { a.tex.offset.set((f % 2) / 2, 0); a.tex.repeat.x = (a.face === 2 ? -1 : 1) / 2; if (a.face === 2) a.tex.offset.x += 1 / 2; return; } a.frame = f; a.dir = a.face; this.view.placeActor(a); }
  drawBar(u) {
    const p = Math.max(0, u.sol / u.solMax);
    u.bar.el.innerHTML = `<b>${u.troop ? `<small class="tr ${u.troop}">${TROOPS[u.troop].n[0]}</small>` : ''}${u.name}</b><i style="--p:${p * 100}%;--c:${p > 0.5 ? '#6ae06a' : p > 0.25 ? '#e8c84a' : '#e85a4a'}"></i><span>${Math.max(0, Math.round(u.sol))}</span>${u.status.confuse ? '<em>混亂</em>' : ''}`;
    const n = u.sol > 0 ? Math.ceil((u.squad?.length || 0) * p) : 0;
    u.squad?.forEach((s, k) => { if (k < n) { s.down = 0; s.sprite.visible = s.shadow.visible = true; s.sprite.rotation.z = 0; s.sprite.material.opacity = 1; } else if (s.sprite.visible && !s.down) s.down = 0.001; });
    if (u.sol <= 0 && u.actor && !u.routT) u.routT = 0.001;
    if (u.sol > 0 && u.routT) { u.routT = 0; u.actor.sprite.rotation.z = 0; u.actor.sprite.material.opacity = 1; u.actor.sprite.visible = true; }
  }
  float(u, text, color = '#fff', big) {
    const l = this.view.addLabel(`<span style="color:${color}">${text}</span>`, u.actor.sprite, 1.9, 'dmg' + (big ? ' big' : ''));
    setTimeout(() => this.view.removeLabel(l), 1100);
  }
  // ---------------------------------------------------------------- run a battle
  // party: [{ g, rec }], foes: [{ name, look|beast, lv, war, lead, int, sol, solMax, sp, gid?, spells? }], o: { terrain, siege, noFlee, title }
  async run(party, foes, o = {}) {
    this.ensureView(); this.root.classList.add('on'); this.partyColor = o.color || '#3a6ad8';
    this.stage(o.terrain, o.siege); this.o = o; this.round = 0; this.log = [];
    const G = this.game.G, H = this.game.H, wounded = H?.wound > G?.t;
    const EXTRA = ['stun', 'breakdef', 'counter', 'bowPow', 'navyPow', 'again', 'tacDmg', 'tacCost', 'tacHit', 'healPow', 'spRegen', 'steal', 'regen', 'physRes', 'tacRes', 'block', 'noConfuse', 'revive', 'lowHeal', 'startRouse', 'auraAtk', 'auraDef', 'duelHp', 'duelDmg'];
    const withRelics = (arms, r) => { const R = relicFx(r); for (const k of ['crit', 'combo', 'pierce', 'dodge']) arms[k] = (arms[k] || 0) + (R[k] || 0); arms.sweep = Math.max(arms.sweep || 0, R.sweep || 0); arms.first ||= !!R.first; arms.flee ||= !!R.flee; arms.cav = (arms.cav || 1) * (1 + (R.cavPow || 0)); for (const k of EXTRA) arms[k] = R[k] || 0; return arms; };
    const mk = (p) => { const g = p.g, r = p.rec, st = bstats(g, r), arms = withRelics(armsOf(G, g), r);
      if (g.isPlayer && wounded) { st.atk *= 0.85; st.def *= 0.85; }
      st.spd += arms.spd + (arms.first ? 999 : 0);
      const troop = r.troop === 'cav' && !hasHorse(G, g, r) ? 'inf' : r.troop || (hasHorse(G, g, r) ? 'cav' : p.look?.wpn === 'bow' ? 'bow' : 'inf');
      return { side: 'party', g, rec: r, name: g.name, look: p.look, lv: r.lv, sol: r.sol, solMax: p.solMax, sp: r.sp, spMax: p.spMax, st, arms, troop, tactics: tacticsOf(g), status: {}, isPlayer: g.isPlayer }; };
    this.party = party.map(mk);
    const foeTroop = (f) => f.troop || (f.beast ? null : f.solKind === 'nomad' ? 'cav' : f.solKind === 'pirate' ? 'navy' : f.gid != null ? (hasHorse(G, G.gens[f.gid]) ? 'cav' : f.int > f.war + 10 ? 'bow' : 'inf') : o.siege ? 'bow' : 'inf');
    this.foes = foes.map((f) => { const arms = armsOf(G, f.gid != null ? G.gens[f.gid] : { id: -9 });
      return { side: 'foe', ...f, arms, troop: foeTroop(f), st: { atk: f.war + (f.wpn || 0), def: f.lead * 0.6 + (f.arm || 0) * 1.6 + f.lv + (o.siege ? 18 : 0), int: f.int, spd: (f.war + f.lead) / 2 + f.lv * 0.3 + arms.spd + (arms.first ? 999 : 0), lead: f.lead, war: f.war }, tactics: f.beast ? [] : tacticsOf({ int: f.int, spells: f.spells || [] }), status: {}, spMax: f.sp, solLook: f.solLook || LOOKS.soldier(f.color || '#8a4a3a') }; });
    // formations: ours as last chosen; an army led by generals (or a siege) draws one up too
    this.form = { party: H?.form || 'yulin', foe: foes.some((f) => f.gid != null) || o.siege ? Object.keys(FORMS)[Math.floor(Math.random() * 5)] : null };
    // what the people in the player's life bring: sworn brothers, a fury for a fallen one, rivals, a killer to avenge
    this.mods = H && !o.drill ? battleMods(this.game, this.foes) : { atk: 1, foeAtk: 1, lines: [] };
    if (H && hasT(H, 'wanren')) this.mods.atk *= 1.05; if (H && o.siege && hasT(H, 'gongcheng')) this.mods.atk *= 1.1;
    this.mods.atk *= 1 + Math.min(0.3, this.party.reduce((t, u) => t + (u.arms.auraAtk || 0), 0));
    this.partyDef = 1 - Math.min(0.3, this.party.reduce((t, u) => t + (u.arms.auraDef || 0), 0));
    // a column for each side, spread from front to back, every other general a step out
    const zs = (n) => Array.from({ length: n }, (_, i) => (n === 1 ? 6.2 : 3.7 + i * Math.min(1.9, 5.2 / (n - 1))));
    const pz = zs(this.party.length), fz = zs(this.foes.length);
    this.party.forEach((u, i) => this.unitActor(u, 10.6 + (i % 2) * 1.2, pz[i], 1));
    this.foes.forEach((u, i) => this.unitActor(u, 4.6 - (i % 2) * 1.2, fz[i], 2));
    this.loop = true; const tick = (t) => { if (!this.loop) return; const dt = Math.min(0.05, (t - (this.lt || t)) / 1000); this.lt = t; this.anim(dt); this.view.render(dt); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    this.game.audio?.music('battle');
    this.marchIn();
    await this.say(o.title || `${this.foes.map((f) => f.name).slice(0, 3).join('、')}${this.foes.length > 3 ? '等' : ''}出現了！`);
    this.formBar();
    for (const l of this.mods.lines) await this.say(l, 1100);
    const drum = Math.max(0, ...this.party.map((u) => u.arms.startRouse || 0));
    if (drum) { for (const u of this.party) { u.status.rouse = drum + 1; this.float(u, '攻擊↑', '#ffb04a'); } await this.say('戰鼓擂響，全軍士氣大振！', 900); }
    let result;
    for (;;) {
      this.round++;
      const orders = await this.orders(); if (orders === 'flee') { if (await this.tryFlee()) { result = 'flee'; break; } else continue; }
      if (orders.duel) { const r = await this.duelFrom(orders.duel); if (r) { result = r; } }
      if (!result) await this.playRound(orders.list);
      if (this.foes.every((f) => f.sol <= 0)) { result = 'win'; break; }
      if (this.party.every((u) => u.sol <= 0)) { result = 'lose'; break; }
      if (result) break;
    }
    if (result === 'win') await this.cheer();
    if (result === 'flee') await this.retreat();
    // write the soldiers back
    for (const u of this.party) { u.rec.sol = Math.max(0, Math.round(u.sol)); u.rec.sp = Math.max(0, Math.round(u.sp)); }
    const out = { result, foes: this.foes, party: this.party, rounds: this.round };
    return out;
  }
  // the formations of both sides, at the top of the field
  formBar() {
    let el = this.ui.querySelector('.b-form'); if (!el) { el = document.createElement('div'); el.className = 'b-form'; this.ui.appendChild(el); }
    const F = this.form, beat = F.foe && FORMS[F.party].beats === F.foe ? ' <em>克制！</em>' : F.foe && FORMS[F.foe].beats === F.party ? ' <em class="bad">被克制</em>' : '';
    el.innerHTML = `${F.foe ? `<span>敵　${FORMS[F.foe].n}陣</span>` : ''}<span>我軍　${FORMS[F.party].n}陣${beat}</span>`;
  }
  async chooseForm() {
    const F = this.form, k = await this.menu('陣型', Object.entries(FORMS).map(([k, f]) => ({ k, n: `${f.n}陣${k === F.party ? '（目前）' : ''}${F.foe && f.beats === F.foe ? '　克制敵陣' : ''}`, d: f.d })).concat([{ k: null, n: '← 返回' }]));
    if (k) { F.party = k; if (this.game.H) this.game.H.form = k; this.formBar(); await this.say(`我軍擺出了${FORMS[k].n}陣！`, 600); }
  }
  // both armies march in from their side of the field
  marchIn() {
    const all = [...this.party, ...this.foes];
    for (const u of all) { u.ox = (u.side === 'party' ? 7 : -7); u.running = true; }
    return this.tween(0.9, (p) => { for (const u of all) { u.ox = (u.side === 'party' ? 7 : -7) * (1 - easeOut(p)); if (Math.random() < 0.2) this.fx.dust(u.home[0] + u.ox, u.home[1], 1, u.side === 'party' ? -1 : 1); if (p >= 1) u.running = false; } });
  }
  async cheer() { const live = this.party.filter((u) => u.sol > 0); for (const u of live) u.cheer = true; await this.tween(1.0, (p) => { for (const u of live) u.oy = Math.abs(Math.sin(p * Math.PI * 3)) * 0.45; }); for (const u of live) { u.cheer = false; u.oy = 0; } }
  async retreat() { const live = this.party.filter((u) => u.sol > 0); for (const u of live) { u.running = true; u.actor.face = 2; for (const s of u.squad) s.face = 2; } await this.tween(0.7, (p) => { for (const u of live) { u.ox = easeIn(p) * 8; if (Math.random() < 0.3) this.fx.dust(u.home[0] + u.ox, u.home[1], 1, 1); } }); }
  close() { this.fx?.clear(); this.tw = []; this.loop = false; this.root.classList.remove('on'); this.ui.innerHTML = ''; this.view?.clearMap(); }
  anim(dt) {
    this.at = (this.at || 0) + dt; const f = Math.floor(this.at * 3) % 2 ? 0 : 2;
    for (const w of [...this.tw]) { w.t += dt; const p = Math.min(1, w.t / w.dur); w.fn(p); if (p >= 1) { this.tw = this.tw.filter((x) => x !== w); w.res(); } }
    this.fx?.update(dt);
    for (const u of [...(this.party || []), ...(this.foes || [])]) {
      const a = u.actor; if (!a) continue;
      const run = u.running ? (Math.floor(this.at * 10) % 2 ? 0 : 2) : f;
      if (u.sol > 0 || u.routT === 0) this.setFrame(a, u.busy && !u.running ? 1 : run);
      a.x = u.home[0] + u.ox + (u.shk > 0 ? Math.sin(this.at * 90) * u.shk * 0.5 : 0); a.z = u.home[1] + u.oz; a.y = u.oy; if (u.shk > 0) u.shk -= dt;
      // red for a moment when hit
      if (u.flashT > 0) { u.flashT -= dt; a.sprite.material.color.set(u.flashT > 0 ? '#ff7a6a' : '#ffffff'); }
      if (u.routT) { u.routT += dt; const q = Math.min(1, u.routT / 0.6); a.sprite.rotation.z = (u.side === 'party' ? -1 : 1) * q * 1.3; a.sprite.material.transparent = true; a.sprite.material.opacity = 1 - q * 0.75; }
      this.view.placeActor(a);
      for (const s of u.squad || []) {
        if (s.down) { s.down += dt; const q = Math.min(1, s.down / 0.5); s.sprite.rotation.z = (u.side === 'party' ? -1 : 1) * q * 1.5; s.sprite.material.transparent = true; s.sprite.material.opacity = 1 - q; if (q >= 1) s.sprite.visible = s.shadow.visible = false; }
        else if (s.sprite.visible) this.setFrame(s, u.running ? run : f);
        s.x = s.home[0] + u.ox * (u.squadK ?? 1) + (u.flee ? u.flee * (u.side === 'party' ? 1 : -1) : 0); s.z = s.home[1] + u.oz * (u.squadK ?? 1); s.y = u.oy * 0.5 + (u.cheer ? Math.max(0, Math.sin(this.at * 12 + s.ph)) * 0.25 : 0); this.view.placeActor(s);
      }
    }
    // the camera shakes on a big blow
    if (this.shakeT > 0) { this.shakeT -= dt; const k = Math.max(0, this.shakeT) * 0.6; this.view.camera.position.x += (Math.random() - 0.5) * k; this.view.camera.position.y += (Math.random() - 0.5) * k; }
    else if (this.view?.camTarget) this.view.follow(this.view.camTarget.x - 0.5, this.view.camTarget.y, this.view.camTarget.z - 0.5, true);
  }
  // ---------------------------------------------------------------- orders
  async orders() {
    const list = [];
    for (let i = 0; i < this.party.length; i++) {
      const u = this.party[i]; if (u.sol <= 0) continue;
      if (u.status.confuse) { list.push({ u, kind: 'confused' }); continue; }
      if (this.auto) { list.push(this.autoOrder(u)); continue; }
      const c = await this.menu(`${u.name}　兵 ${Math.round(u.sol)}／策 ${Math.round(u.sp)}`, [
        { k: 'atk', n: '攻擊' }, { k: 'tac', n: '策略', off: !u.tactics.length }, { k: 'item', n: '道具', off: !this.game.H.items || !Object.keys(this.game.H.items).some((k) => this.game.H.items[k] > 0 && usable(k)) },
        ...(u.isPlayer && this.foes.some((f) => f.sol > 0 && f.gid != null) ? [{ k: 'duel', n: '一騎討' }] : []), ...(list.length === 0 && !this.o.drill ? [{ k: 'form', n: `陣型（${FORMS[this.form.party].n}）` }] : []), { k: 'auto', n: '全軍突擊' }, ...(this.o.noFlee ? [] : [{ k: 'flee', n: '撤退' }]), ...(i > 0 ? [{ k: 'back', n: '← 返回' }] : [])]);
      if (c == null) { i--; continue; }
      if (c === 'back') { list.pop(); i -= 2; while (i >= 0 && this.party[i + 1] && this.party[i + 1].sol <= 0) i--; continue; }
      if (c === 'flee') return 'flee';
      if (c === 'auto') { this.auto = true; i--; continue; }
      if (c === 'form') { await this.chooseForm(); i--; continue; }
      if (c === 'atk') { const t = await this.pick(this.foes, '攻擊哪一隊？'); if (!t) { i--; continue; } list.push({ u, kind: 'atk', t }); }
      if (c === 'duel') { const t = await this.pick(this.foes.filter((f) => f.gid != null), '向誰挑戰一騎討？'); if (!t) { i--; continue; } return { duel: { u, t }, list }; }
      if (c === 'tac') {
        const k = await this.menu('使用哪個策略？', [...u.tactics.map((k) => ({ k, n: `${TACTICS[k].n}　${this.cost(u, k)}`, off: u.sp < this.cost(u, k), d: TACTICS[k].d })), { k: null, n: '← 返回' }]);
        if (!k) { i--; continue; }
        const T = TACTICS[k]; let t = null;
        if (T.tgt === 'one') { t = await this.pick(this.foes, `${T.n}：哪一隊？`); if (!t) { i--; continue; } }
        if (T.tgt === 'ally') { t = await this.pick(this.party, `${T.n}：哪一隊？`, true); if (!t) { i--; continue; } }
        list.push({ u, kind: 'tac', k, t });
      }
      if (c === 'item') {
        const H = this.game.H, own = Object.keys(H.items).filter((k) => H.items[k] > 0 && usable(k));
        const k = await this.menu('使用哪個道具？', [...own.map((k) => ({ k, n: `${ITEMS[k].n} ×${H.items[k]}`, d: ITEMS[k].d })), { k: null, n: '← 返回' }]);
        if (!k) { i--; continue; }
        let t = null; if (!ITEMS[k].healAll) { t = await this.pick(this.party, `${ITEMS[k].n}：給誰？`, true); if (!t) { i--; continue; } }
        list.push({ u, kind: 'item', k, t });
      }
    }
    return { list };
  }
  autoOrder(u) {
    const live = this.foes.filter((f) => f.sol > 0), weak = live.sort((a, b) => a.sol - b.sol)[0];
    const hurt = this.party.filter((x) => x.sol > 0 && x.sol < x.solMax * 0.35);
    const can = (k) => u.tactics.includes(k) && u.sp >= this.cost(u, k);
    if (hurt.length && can('rally')) return { u, kind: 'tac', k: 'rally' };
    if (hurt.length && can('zhi')) return { u, kind: 'tac', k: 'zhi' };
    if (hurt.length && can('cheer')) return { u, kind: 'tac', k: 'cheer', t: hurt[0] };
    if (live.length >= 2) for (const k of ['lei', 'feng', 'flood', 'blaze']) if (can(k)) return { u, kind: 'tac', k };
    if (u.st.int > u.st.war + 10) for (const k of ['rock', 'fire']) if (can(k)) return { u, kind: 'tac', k, t: weak };
    return { u, kind: 'atk', t: weak };
  }
  // ---------------------------------------------------------------- a round
  async playRound(list) {
    const foeOrders = this.foes.filter((f) => f.sol > 0).map((f) => this.foeOrder(f));
    const all = [...list, ...foeOrders].map((o) => ({ ...o, sp: o.u.st.spd + Math.random() * 25 })).sort((a, b) => b.sp - a.sp);
    for (const o of all) {
      if (o.u.sol <= 0) continue;
      if (this.foes.every((f) => f.sol <= 0) || this.party.every((u) => u.sol <= 0)) break;
      await this.act(o);
      if (!o.again && o.u.sol > 0 && o.u.arms?.again && Math.random() < o.u.arms.again && !this.foes.every((f) => f.sol <= 0) && !this.party.every((u) => u.sol <= 0)) { this.float(o.u, '再動！', '#8affff'); await wait(250); await this.act({ ...o, again: true }); }
    }
    // treasures that mend: soldiers and stratagem points come back at the end of each round
    for (const u of [...this.party, ...this.foes]) { if (u.sol <= 0 || !u.arms) continue; if (u.arms.regen) { const n = Math.round(u.solMax * u.arms.regen); u.sol = Math.min(u.solMax, u.sol + n); this.float(u, '+' + n, '#8aff8a'); } if (u.arms.spRegen && u.spMax) u.sp = Math.min(u.spMax, u.sp + u.arms.spRegen); }
    for (const u of [...this.party, ...this.foes]) for (const k of Object.keys(u.status)) if (--u.status[k] <= 0) delete u.status[k];
    for (const u of [...this.party, ...this.foes]) if (u.sol > 0) this.drawBar(u);
  }
  foeOrder(f) {
    if (f.status.confuse) return { u: f, kind: 'confused' };
    const live = this.party.filter((u) => u.sol > 0); if (!live.length) return { u: f, kind: 'wait' };
    const can = f.tactics.filter((k) => f.sp >= TACTICS[k].sp && TACTICS[k].kind !== 'heal');
    if (can.length && Math.random() < 0.38) { const k = can[Math.floor(Math.random() * can.length)]; return { u: f, kind: 'tac', k, t: live[Math.floor(Math.random() * live.length)] }; }
    const t = Math.random() < 0.5 ? live.sort((a, b) => a.sol - b.sol)[0] : live[Math.floor(Math.random() * live.length)];
    return { u: f, kind: 'atk', t };
  }
  cost(u, k) { return Math.max(1, Math.round(TACTICS[k].sp * (u.isPlayer && hasT(this.game.H, 'xianyuan') ? 0.8 : 1) * (1 - (u.arms?.tacCost || 0)))); }
  side(u) { return u.side === 'party' ? this.party : this.foes; }
  other(u) { return u.side === 'party' ? this.foes : this.party; }
  async act(o) {
    const u = o.u;
    if (o.kind === 'confused') { this.float(u, '混亂中', '#c8a0ff'); this.fx.stars(u.home[0] + 0.5, 1.6, u.home[1] + 0.5); await wait(280); return; }
    if (o.kind === 'wait') return;
    if (o.kind === 'atk') {
      let t = o.t; if (!t || t.sol <= 0) t = this.other(u).find((x) => x.sol > 0); if (!t) return;
      const dodge = !t.status.evade && t.arms?.dodge && Math.random() < t.arms.dodge;
      const miss = (t.status.evade && Math.random() < 0.5) || dodge, d = miss ? 0 : this.physDmg(u, t), combo = !miss && Math.random() < (u.st.war >= 85 ? 0.12 : 0) + (u.arms?.combo || 0);
      // a great halberd sweeps through the line beside the target
      const side = u.arms?.sweep && !miss ? this.other(u).filter((x) => x !== t && x.sol > 0).sort((a, b) => Math.abs(a.home[1] - t.home[1]) - Math.abs(b.home[1] - t.home[1]))[0] : null;
      const after = () => { if (t.sol <= 0) return; if (u.arms?.stun && Math.random() < u.arms.stun && !t.arms?.noConfuse && !t.beast) { t.status.confuse = 1; this.float(t, '混亂！', '#c8a0ff'); this.drawBar(t); } if (u.arms?.breakdef) { t.status.broken = 2; t.brokenV = Math.max(t.brokenV || 0, u.arms.breakdef); this.float(t, '防禦↓', '#ff9a6a'); } };
      await this.charge(u, t, () => { if (miss) { this.float(t, dodge ? '閃開了！' : '落空', '#c8e8ff'); this.game.audio?.sfx('miss'); } else { this.hit(t, d, u); after(); if (side) { this.float(u, '橫掃！', '#ffd86a'); this.hit(side, Math.round(this.physDmg(u, side) * u.arms.sweep), u); } } }, combo ? () => { if (t.sol > 0) { this.float(u, '連擊！', '#ffd86a'); this.hit(t, Math.round(this.physDmg(u, t) * 0.6), u); } } : null);
      if (!miss && !o.counter && t.sol > 0 && u.sol > 0 && t.arms?.counter && Math.random() < t.arms.counter && !t.status.confuse) { this.float(t, '反擊！', '#ffb04a'); await wait(150); await this.charge(t, u, () => this.hit(u, Math.round(this.physDmg(t, u) * 0.6), t)); }
      await wait(40); return;
    }
    if (o.kind === 'tac') {
      const T = TACTICS[o.k], cost = this.cost(u, o.k); if (u.sp < cost) { return this.act({ u, kind: 'atk', t: o.t && o.t.side !== u.side ? o.t : null }); }
      u.sp -= cost;
      const foes = this.other(u).filter((x) => x.sol > 0), mine = this.side(u).filter((x) => x.sol > 0);
      await this.cast(u, T, o.k, T.kind === 'dmg' || T.kind === 'confuse' ? (T.tgt === 'all' ? foes : [o.t && o.t.sol > 0 && o.t.side !== u.side ? o.t : foes[0]].filter(Boolean)) : T.tgt === 'allies' ? mine : [o.t && o.t.sol > 0 ? o.t : mine[0]].filter(Boolean));
      if (T.kind === 'dmg') {
        const ts = T.tgt === 'all' ? foes : [o.t && o.t.sol > 0 && o.t.side !== u.side ? o.t : foes[0]].filter(Boolean);
        for (const t of ts) {
          const hitP = clamp(0.6 + (u.st.int - t.st.int) / 110 + (u.arms?.tacHit || 0), 0.18, 0.97);
          if (Math.random() > hitP) { this.float(t, '識破！', '#c8e8ff'); continue; }
          const terr = this.o.terrain, bonus = (o.k === 'rock' && terr === 'hill') || (o.k === 'flood' && (terr === 'marsh' || terr === 'coast')) || ((o.k === 'fire' || o.k === 'blaze') && terr === 'forest') ? 1.35 : o.k === 'fire' && terr === 'snow' ? 0.7 : 1;
          const fm = FORMS[this.form[u.side === 'party' ? 'party' : 'foe']]?.tac || 1, tm = u.side === 'party' && hasT(this.game.H, 'zhiduo') ? 1.1 : 1;
          const res = (1 - (t.arms?.tacRes || 0)) * (t.side === 'party' ? this.partyDef || 1 : 1);
          const d = Math.round((u.st.int * 2.4 + (u.lv || 1) * 3) * T.pow * bonus * fm * tm * (1 + (u.arms?.tacDmg || 0)) * res * (0.9 + Math.random() * 0.2) * (110 / (110 + t.st.int * 0.5)));
          if (u.side === 'party' && this.game.H) bump(this.game.H, 'tacs');
          this.hit(t, d, u, true);
        }
      }
      if (T.kind === 'heal') { const ts = T.tgt === 'allies' ? mine : [o.t && o.t.sol > 0 ? o.t : mine.sort((a, b) => a.sol / a.solMax - b.sol / b.solMax)[0]]; for (const t of ts) { const n = Math.round((u.st.int * 3 + 60) * T.pow * (1 + (u.arms?.healPow || 0))); t.sol = Math.min(t.solMax, t.sol + n); this.float(t, '+' + n, '#8aff8a'); this.drawBar(t); } }
      if (T.kind === 'confuse') { const ts = T.tgt === 'all' ? foes : [o.t && o.t.sol > 0 ? o.t : foes[0]]; for (const t of ts) { if (t.arms?.noConfuse) { this.float(t, '無效', '#c8e8ff'); continue; } if (Math.random() < clamp(0.55 + (u.st.int - t.st.int) / 100, 0.1, 0.9)) { t.status.confuse = 2; this.float(t, '混亂！', '#c8a0ff'); this.drawBar(t); } else this.float(t, '識破！', '#c8e8ff'); } }
      if (T.kind === 'buff') for (const t of mine) { t.status.rouse = 3; this.float(t, '攻擊↑', '#ffb04a'); }
      if (T.kind === 'guard') for (const t of mine) { t.status.guard = 3; this.float(t, '防禦↑', '#8ac8ff'); }
      if (T.kind === 'evade') for (const t of mine) { t.status.evade = 3; this.float(t, '迴避↑', '#c8e8ff'); }
      await wait(450); return;
    }
    if (o.kind === 'item') {
      const H = this.game.H, I = ITEMS[o.k]; if (!(H.items[o.k] > 0)) return; H.items[o.k]--;
      await this.say(`${u.name}使用了${I.n}。`, 420);
      const ts = I.healAll ? this.party.filter((x) => x.sol > 0) : [o.t];
      for (const t of ts) { if (!t || t.sol <= 0 && !I.heal) continue; if (I.full) t.sp = t.spMax; if (I.sp) { t.sp = Math.min(t.spMax, t.sp + I.sp); this.float(t, '策+' + I.sp, '#8ac8ff'); continue; } const n = Math.round(t.solMax * (I.heal || I.healAll)); t.sol = Math.min(t.solMax, Math.max(0, t.sol) + n); this.float(t, '+' + n, '#8aff8a'); if (t.actor) t.actor.sprite.material.opacity = 1; this.drawBar(t); }
      await wait(300);
    }
  }
  physDmg(u, t) {
    const sf = 0.4 + 0.6 * Math.sqrt(Math.max(0, u.sol) / u.solMax), base = u.st.atk * 2.4 + (u.lv || 1) * 3;
    const ku = this.form?.[u.side === 'party' ? 'party' : 'foe'], kt = this.form?.[t.side === 'party' ? 'party' : 'foe'], fu = FORMS[ku], ft = FORMS[kt];
    const def = t.st.def * (ft?.def || 1) * (1 - (u.arms?.pierce || 0)) * (t.status.broken ? 1 - (t.brokenV || 0) : 1);
    let d = base * sf * (0.88 + Math.random() * 0.24) * (100 / (100 + def * 0.8));
    if (u.status.rouse) d *= 1.3; if (t.status.guard) d *= 0.5; if (this.o.siege && t.side === 'foe') d *= 0.85;
    // troops against troops on this ground; the formations; the cavalry of a famous horse
    d *= troopMul(u.troop, t.troop, this.o.terrain) * (fu?.atk || 1) * (fu && kt && fu.beats === kt ? 1.15 : 1);
    if (u.troop === 'bow' && fu?.bow) d *= fu.bow; if (u.troop === 'cav') d *= u.arms?.cav || 1;
    if (this.mods) d *= u.side === 'party' ? this.mods.atk : this.mods.foeAtk;
    if (u.troop === 'bow') d *= 1 + (u.arms?.bowPow || 0); if (u.troop === 'navy') d *= 1 + (u.arms?.navyPow || 0);
    d *= (1 - (t.arms?.physRes || 0)) * (t.side === 'party' ? this.partyDef || 1 : 1);
    if (t.arms?.block && Math.random() < t.arms.block) { d *= 0.5; this.float(t, '格擋', '#c8e8ff'); }
    if (Math.random() < 0.06 + u.st.war / 1500 + (u.arms?.crit || 0)) { d *= 1.6; this.float(u, '會心！', '#ffe04a'); }
    return Math.max(1, Math.round(d));
  }
  hit(t, d, by, magic) {
    t.sol = Math.max(0, t.sol - d); this.float(t, d, magic ? '#ffb04a' : '#ffffff', d > t.solMax * 0.25);
    if (by && !magic && by.arms?.steal && by.sol > 0) { const n = Math.round(d * by.arms.steal); by.sol = Math.min(by.solMax, by.sol + n); this.drawBar(by); }
    if (t.sol <= 0 && t.arms?.revive && !t.revived) { t.revived = true; t.sol = Math.round(t.solMax * t.arms.revive); setTimeout(() => this.float(t, '重整旗鼓！', '#ffd86a', true), 300); }
    else if (t.sol > 0 && t.sol < t.solMax * 0.3 && t.arms?.lowHeal && !t.lowHealed) { t.lowHealed = true; const n = Math.round(t.solMax * t.arms.lowHeal); t.sol = Math.min(t.solMax, t.sol + n); setTimeout(() => this.float(t, '急救 +' + n, '#8aff8a'), 300); }
    this.game.audio?.sfx(magic ? 'fire' : 'hit');
    t.flashT = 0.18; t.shk = 0.25; this.drawBar(t);
    const back = t.side === 'party' ? 1 : -1; this.tween(0.25, (p) => { t.ox = back * 0.35 * Math.sin(p * Math.PI); });
    if (d > t.solMax * 0.25 || magic && d > t.solMax * 0.15) this.shake(0.3);
    if (t.sol <= 0) { this.float(t, '潰敗', '#ff6a5a', true); t.routedBy = by; this.shake(0.35); t.flee = 0; this.tween(0.8, (p) => { t.flee = easeIn(p) * 3; }); }
  }
  ranged(u) { return ['bow', 'gun'].includes(u.look?.wpn); }
  // a charge: the general runs at the enemy with the squad behind, strikes (onHit), maybe again (onHit2), and runs back;
  // archers loose a volley instead
  async charge(u, t, onHit, onHit2) {
    const dir = u.side === 'party' ? -1 : 1, [hx, hz] = u.home, tx = t.home[0] - dir * 1.25 + (t.ox || 0), tz = t.home[1];
    u.busy = true;
    if (this.ranged(u) && !t.duelist) {
      await this.tween(0.15, (p) => { u.oy = Math.sin(p * Math.PI) * 0.25; });
      const shooters = [u.actor, ...u.squad.filter((s) => s.sprite.visible)];
      shooters.forEach((s, i) => setTimeout(() => this.fx.arrow(s.x + 0.5, 0.8, s.z + 0.5, t.home[0] + 0.5 + (Math.random() - 0.5) * 0.8, t.home[1] + 0.5 + (Math.random() - 0.5) * 0.6), i * 60));
      this.game.audio?.sfx('miss');
      await wait(shooters.length * 60 + 420); this.fx.sparks(t.home[0] + 0.5, 0.8, t.home[1] + 0.5, 6); onHit();
      if (onHit2) { await wait(200); onHit2(); }
      u.busy = false; return;
    }
    u.running = true; u.squadK = 0.55;
    await this.tween(0.26, (p) => { const e = easeIn(p); u.ox = (tx - hx) * e; u.oz = (tz - hz) * e; if (Math.random() < 0.5) this.fx.dust(hx + u.ox + 0.5, hz + u.oz + 0.5, 1, dir); });
    u.running = false;
    // the blow
    const cx = t.home[0] + 0.5 - dir * 0.4, cz = t.home[1] + 0.5;
    this.fx.slash(cx, 1.0, cz, dir > 0); this.fx.sparks(cx, 0.9, cz, 9); this.game.audio?.sfx('clash');
    onHit();
    await this.tween(0.12, (p) => { u.ox = (tx - hx) + dir * 0.25 * Math.sin(p * Math.PI); });
    if (onHit2) { this.fx.slash(cx, 0.8, cz, dir < 0); this.fx.sparks(cx, 0.9, cz, 6); onHit2(); await this.tween(0.12, (p) => { u.ox = (tx - hx) + dir * 0.25 * Math.sin(p * Math.PI); }); }
    await wait(90);
    u.running = true; const ox = u.ox, oz = u.oz;
    await this.tween(0.24, (p) => { const e = easeOut(p); u.ox = ox * (1 - e); u.oz = oz * (1 - e); });
    u.running = false; u.squadK = 1; u.ox = u.oz = 0; u.busy = false;
  }
  lunge(u, t) { return this.charge(u, t, () => {}); }
  // the caster raises a hand (a hop and a ring of light), the name of the stratagem sweeps across, then the effect
  async cast(u, T, k, targets) {
    const col = { dmg: '#ffb04a', heal: '#8aff9a', confuse: '#d8a0ff', buff: '#ff8a4a', guard: '#8ac8ff', evade: '#e8f4ff' }[T.kind];
    u.busy = true; this.fx.aura(u.home[0] + 0.5, u.home[1] + 0.5, col);
    this.tween(0.35, (p) => { u.oy = Math.sin(p * Math.PI) * 0.5; });
    this.cutin(u, T, col); await wait(650);
    this.flash(T);
    const at = (t) => [t.home[0] + 0.5 + (t.ox || 0), t.home[1] + 0.5];
    const fire = k === 'fire' || k === 'blaze' || k === 'feng';
    targets.forEach((t, i) => {
      const [x, z] = at(t);
      setTimeout(() => {
        if (fire) { this.fx.flames(x, z, k === 'fire' ? 12 : 9); if (k === 'feng') this.fx.dust(x, z, 6, 1); }
        else if (k === 'rock') this.fx.rocks(x, z);
        else if (k === 'flood') this.fx.water(x, z);
        else if (k === 'lei') this.fx.bolt(x, z);
        else if (T.kind === 'heal') this.fx.heal(x, z);
        else if (T.kind === 'confuse') this.fx.stars(x, 1.6, z);
        else this.fx.aura(x, z, col);
      }, i * (k === 'lei' ? 180 : 90));
    });
    if (k === 'flood' && targets[0]) this.fx.wave(targets[0].side === 'foe' ? -1 : 18, targets[0].side === 'foe' ? 8 : 9, 6.5);
    if (T.kind === 'dmg') this.game.audio?.sfx(k === 'lei' ? 'clash' : 'fire');
    await wait(k === 'rock' ? 620 : k === 'lei' ? 300 + targets.length * 180 : k === 'flood' ? 650 : 380);
    if (T.kind === 'dmg') this.shake(0.3);
    u.busy = false; u.oy = 0;
  }
  cutin(u, T, col) {
    const el = document.createElement('div'); el.className = 'b-cut' + (u.side === 'party' ? ' r' : ' l');
    el.innerHTML = `<small>${u.name}</small><b style="color:${col}">${T.n}</b>`; this.ui.appendChild(el);
    setTimeout(() => el.classList.add('out'), 700); setTimeout(() => el.remove(), 1100);
  }
  flash(T) { const g = this.view.grade.uniforms; g.flashColor.value.set(...(T.kind === 'heal' ? [0.6, 1, 0.6] : T.n.includes('雷') ? [0.9, 0.9, 1] : T.n.includes('水') ? [0.5, 0.7, 1] : [1, 0.6, 0.3])); g.flash.value = 0.45; const f = () => { g.flash.value *= 0.85; if (g.flash.value > 0.01) requestAnimationFrame(f); else g.flash.value = 0; }; requestAnimationFrame(f); }
  async tryFlee() {
    const me = Math.max(...this.party.filter((u) => u.sol > 0).map((u) => u.st.spd)), them = Math.max(...this.foes.filter((u) => u.sol > 0).map((u) => u.st.spd));
    const dilu = this.party.find((u) => u.sol > 0 && u.arms?.flee);
    if (dilu) { await this.say(`${dilu.name}的的盧一躍而起，全軍跟著突圍而出！`); return true; }
    if (Math.random() < clamp(0.55 + (me - them) / 100 + (FORMS[this.form.party].flee || 0), 0.2, 0.95)) { await this.say('全軍撤退了。'); return true; }
    await this.say('撤退失敗！'); await this.playRound([]); return false;
  }
  // ---------------------------------------------------------------- a duel picked in battle: the loser's army is routed
  async duelFrom({ u, t }) {
    const r = await this.duel(u, t);
    if (r === 'win') { t.sol = 0; this.drawBar(t); t.duelLost = true; this.float(t, '敗走', '#ff6a5a', true); }
    else if (r === 'lose') { u.sol = Math.round(u.sol * 0.4); this.drawBar(u); }
    if (this.foes.every((f) => f.sol <= 0)) return 'win';
    return null;
  }
  // a: { name, look, st, lv }, b the same; returns 'win' | 'lose' | 'flee' for a
  async duel(a, b, o = {}) {
    const hpOf = (u) => Math.round((100 + u.st.war * 2 + (u.lv || 1) * 2) * (u.isPlayer && hasT(this.game.H, 'wushuang') ? 1.15 : 1) * (1 + (u.arms?.duelHp || 0)));
    const A = { u: a, hp: hpOf(a), max: hpOf(a), fury: 0 }, B = { u: b, hp: hpOf(b), max: hpOf(b), fury: 0 };
    // bring the two forward
    const pa = a.home, pb = b.home; a.duelist = b.duelist = true;
    const walk = async (u, to) => { if (!u.actor) return; const from = u.home; u.running = true; await this.tween(0.45, (p) => { const e = ease(p); u.home = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]; }); u.running = false; };
    // the camera comes in close on the two
    const off0 = this.view.camOff.clone(), tgt0 = this.view.camTarget.clone(), zoom = (to, at) => { const f = this.view.camOff.clone(), t0 = this.view.camTarget.clone(); return this.tween(0.5, (p) => { const e = ease(p); this.view.camOff.lerpVectors(f, to, e); this.view.camTarget.lerpVectors(t0, at, e); }); };
    await Promise.all([walk(a, [9.0, 6.4]), walk(b, [6.4, 6.4]), zoom(new THREE.Vector3(0, 7.2, 9.2), new THREE.Vector3(8.2, 0.2, 6.4))]);
    this.root.classList.add('dueling');
    const box = document.createElement('div'); box.className = 'duel-hud'; this.ui.appendChild(box);
    const draw = () => { box.innerHTML = [B, A].map((S) => `<div class="dh"><b>${S.u.name}</b><span>武力 ${S.u.st.war}</span><i style="--p:${Math.max(0, S.hp / S.max) * 100}%"></i><em style="--p:${S.fury}%"></em></div>`).join('<div class="vs">VS</div>'); };
    draw(); await this.say(`${a.name}與${b.name}的一騎討！`);
    let res = null;
    for (let turn = 0; turn < 30 && !res; turn++) {
      const opts = [{ k: 'hit', n: '攻擊', d: '普通的一擊' }, { k: 'power', n: '猛攻', d: '強力，但會被防守反擊' }, { k: 'guard', n: '防守', d: '擋下大部分傷害，累積氣勢' }, ...(A.fury >= 100 ? [{ k: 'ult', n: '必殺', d: '氣勢全滿的必殺一擊' }] : []), ...(o.noFlee ? [] : [{ k: 'flee', n: '退卻' }])];
      const ca = a.side === 'party' && !this.auto ? await this.menu('一騎討', opts) : this.duelAI(A, B);
      if (ca === 'flee') { if (Math.random() < clamp(0.5 + (a.st.war - b.st.war) / 80, 0.15, 0.9)) { res = 'flee'; await this.say(`${a.name}退了回去。`); break; } await this.say('退不了！'); }
      const cb = this.duelAI(B, A);
      const dmg = (S, T, k, k2) => { const base = (S.u.st.war * 1.1 + 12) * (0.85 + Math.random() * 0.3) * (1 + (S.u.st.war - T.u.st.war) / 120) * (1 + (S.u.arms?.duelDmg || 0));
        let m = k === 'hit' ? 0.32 : k === 'power' ? 0.55 : k === 'ult' ? 1.2 : 0; if (k2 === 'guard') m *= k === 'power' ? 0.2 : k === 'ult' ? 0.6 : 0.35; return Math.max(0, Math.round(base * m)); };
      const da = ca === 'flee' ? 0 : dmg(A, B, ca, cb), db = dmg(B, A, cb, ca === 'flee' ? 'hit' : ca);
      // a strong blow into a guard is turned back on the striker
      const back = (k, k2, S) => (k === 'power' && k2 === 'guard' ? Math.round((S.u.st.war * 0.25 + 8)) : 0);
      const ra = back(ca, cb, A), rb = back(cb, ca, B);
      if (ca === 'ult') A.fury = 0; if (cb === 'ult') B.fury = 0;
      if (ca === 'guard') A.fury = Math.min(100, A.fury + 34); if (cb === 'guard') B.fury = Math.min(100, B.fury + 34);
      A.fury = Math.min(100, A.fury + Math.round(db / A.max * 120)); B.fury = Math.min(100, B.fury + Math.round(da / B.max * 120));
      await this.duelClash(a, b, ca, cb, da, db);
      B.hp -= da + ra * 0; A.hp -= db; A.hp -= ra; B.hp -= rb;
      if (da && b.actor) this.float(b, da, ca === 'ult' ? '#ffd86a' : '#fff', ca === 'ult');
      if (db && a.actor) this.float(a, db, cb === 'ult' ? '#ffd86a' : '#fff', cb === 'ult');
      if (ra && a.actor) this.float(a, '反擊 ' + ra, '#ffb04a'); if (rb && b.actor) this.float(b, '反擊 ' + rb, '#ffb04a');
      this.game.audio?.sfx('clash');
      draw(); await wait(350);
      if (B.hp <= 0 && A.hp > 0) res = 'win'; else if (A.hp <= 0) res = 'lose';
    }
    res ||= A.hp / A.max >= B.hp / B.max ? 'win' : 'lose';
    await this.say(res === 'win' ? `${a.name}擊敗了${b.name}！` : res === 'lose' ? `${a.name}敗給了${b.name}……` : '一騎討結束了。');
    box.remove(); this.root.classList.remove('dueling');
    await Promise.all([walk(a, pa), walk(b, pb), zoom(off0, tgt0)]); a.duelist = b.duelist = false;
    return res;
  }
  // what a turn of the duel looks like: both charge and meet in the middle, or one strikes and the other guards
  async duelClash(a, b, ca, cb, da, db) {
    if (!a.actor || !b.actor) return;
    for (const [u, k] of [[a, ca], [b, cb]]) if (k === 'ult') { this.cutin(u, { n: '必殺' }, '#ffd86a'); this.flash({ kind: 'dmg', n: '' }); }
    if (ca === 'ult' || cb === 'ult') await wait(550);
    const guardA = ca === 'guard', guardB = cb === 'guard', mid = (a.home[0] + b.home[0]) / 2;
    const ring = (u) => this.fx.aura(u.home[0] + 0.5, u.home[1] + 0.5, '#8ac8ff');
    if (guardA) ring(a); if (guardB) ring(b);
    // who runs: whoever attacks; if both do, they meet in the middle
    const goA = !guardA && ca !== 'flee', goB = !guardB;
    const dA = goA ? (goB ? mid + 0.55 - a.home[0] : b.home[0] + 1.2 - a.home[0]) : 0, dB = goB ? (goA ? mid - 0.55 - b.home[0] : a.home[0] - 1.2 - b.home[0]) : 0;
    a.running = goA; b.running = goB;
    await this.tween(0.24, (p) => { const e = easeIn(p); a.ox = dA * e; b.ox = dB * e; if (Math.random() < 0.4) { if (goA) this.fx.dust(a.home[0] + a.ox + 0.5, a.home[1] + 0.5, 1, -1); if (goB) this.fx.dust(b.home[0] + b.ox + 0.5, b.home[1] + 0.5, 1, 1); } });
    a.running = b.running = false;
    const cx = goA && goB ? mid + 0.5 : goA ? b.home[0] + 0.9 : a.home[0] + 0.1, cz = a.home[1] + 0.5, big = ca === 'ult' || cb === 'ult' || ca === 'power' || cb === 'power';
    this.fx.sparks(cx, 1, cz, big ? 16 : 10); this.fx.slash(cx, 1.05, cz, goB && !goA);
    if (goA && goB) this.fx.slash(cx, 0.8, cz, true);
    if (big) this.shake(ca === 'ult' || cb === 'ult' ? 0.45 : 0.25);
    if (da) { b.flashT = 0.18; b.shk = 0.2; } if (db) { a.flashT = 0.18; a.shk = 0.2; }
    await this.tween(0.14, (p) => { const k = Math.sin(p * Math.PI) * 0.3; a.ox = dA + (db ? k : 0); b.ox = dB - (da ? k : 0); });
    await wait(80);
    const oa = a.ox, ob = b.ox; a.running = !!oa; b.running = !!ob;
    await this.tween(0.22, (p) => { const e = easeOut(p); a.ox = oa * (1 - e); b.ox = ob * (1 - e); });
    a.running = b.running = false; a.ox = b.ox = 0;
  }
  duelAI(S, T) {
    if (S.fury >= 100 && Math.random() < 0.8) return 'ult';
    const r = Math.random(); return r < 0.45 ? 'hit' : r < 0.72 ? 'power' : 'guard';
  }
  // a duel on its own (in a town, or a challenge): sets up a stage with just the two
  async soloDuel(a, b, o = {}) {
    this.ensureView(); this.root.classList.add('on'); this.stage(o.terrain || 'city', null); this.o = o;
    this.party = [a]; this.foes = [b];
    a.side = 'party'; b.side = 'foe'; a.status = {}; b.status = {}; a.sol = a.solMax = 1; b.sol = b.solMax = 1;
    this.unitActor(a, 9.4, 6.2, 1, true); this.unitActor(b, 5.8, 6.2, 2, true); for (const u of [a, b]) { this.view.removeLabel(u.bar); u.bar = { el: document.createElement('div') }; }
    this.loop = true; const tick = (t) => { if (!this.loop) return; const dt = Math.min(0.05, (t - (this.lt || t)) / 1000); this.lt = t; this.anim(dt); this.view.render(dt); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const r = await this.duel(a, b, o);
    return r;
  }
  // ---------------------------------------------------------------- the little UI: a message line, menus, target picking
  say(text, ms = 900) { return new Promise((res) => { let el = this.ui.querySelector('.b-msg'); if (!el) { el = document.createElement('div'); el.className = 'b-msg'; this.ui.appendChild(el); } el.textContent = text; el.classList.add('on'); setTimeout(() => res(), ms); }); }
  menu(title, opts) { return this.game.ui.choose(opts, { title, host: this.ui, cls: 'b-menu' }); }
  async pick(list, title, ally) {
    const live = list.filter((u) => ally || u.sol > 0); if (live.length === 1 && !ally) return live[0];
    const k = await this.game.ui.choose([...live.map((u, i) => ({ k: i, n: `${u.name}　兵 ${Math.round(u.sol)}` })), { k: null, n: '← 返回' }], { title, host: this.ui, cls: 'b-menu', hover: (i) => { for (const u of list) u.actor && (u.actor.sprite.material.color.set(live[i] === u ? '#ffe8a0' : '#ffffff')); } });
    for (const u of list) u.actor?.sprite.material.color.set('#ffffff');
    return k == null ? null : live[k];
  }
}
