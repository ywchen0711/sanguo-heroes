// Battles in the manner of the old Famicom Three Kingdoms RPGs: your generals on the right, the enemy on the left, each
// general's soldiers are their strength. Give every general an order (attack, a stratagem, an item, a duel, retreat),
// then the round plays out in order of speed. A general whose soldiers are gone is routed. The stage is a small HD-2D
// diorama; each general stands before a squad of soldiers that thins as the numbers fall.
//
// Duels (一騎討): two generals alone between the armies. Each turn both choose — 攻擊, 猛攻 (strong, but a guard turns it
// back), 防守 (blocks most and builds fury) or 必殺 (when fury is full) — and 武力 decides the rest.
import { View, THREE, personSheet, beastSheet, canvasTex } from './render.js';
import { LOOKS, shade } from './sprites.js';
import { TACTICS, tacticsOf, bstats, ITEMS } from './hero.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GROUND = { plain: [0, 1], forest: [5, 0], hill: [9, 6], desert: [8, 2], snow: [7, 6], city: [18, 10], marsh: [22, 0], coast: [4, 0] };

export class Battle {
  constructor(game) { this.game = game; this.root = document.getElementById('battle'); this.ui = this.root.querySelector('.b-ui'); }
  ensureView() {
    if (this.view) return;
    this.view = new View(this.root.querySelector('.b-stage'));
    this.view.camOff.set(0, 11, 11); this.view.camera.fov = 38; this.view.camera.updateProjectionMatrix();
    this.view.tsH.uniforms.band.value = this.view.tsV.uniforms.band.value = 0.24;
  }
  // ---------------------------------------------------------------- the stage
  stage(terrain, siege) {
    const v = this.view, [top, alt] = GROUND[terrain] || GROUND.plain, W = 18, H = 12;
    const rnd = (x, z) => ((x * 73 + z * 151) % 17) / 17;
    v.setMap({ W, H, water: terrain === 'coast' ? -0.2 : null, sky: { snow: '#c8d8e8', desert: '#e8c890', city: '#b8c8d8' }[terrain] || '#a8d0f0', fogNear: 18, fogFar: 40,
      tile: (x, z) => { if (x < 0 || z < 0 || x >= W || z >= H) return null; const back = z < 3; return { top: back && siege ? 11 : rnd(x, z) < 0.18 ? alt : top, side: siege && back ? 11 : 15, h: back ? (siege ? 1.6 : terrain === 'hill' ? 0.9 : 0.3) : 0 }; },
      deco: (x, z) => (z === 1 || z === 2) && !siege && rnd(x, z) < 0.45 ? (terrain === 'forest' ? 2 : terrain === 'hill' ? 5 : terrain === 'snow' ? 6 : terrain === 'desert' ? (rnd(z, x) < 0.5 ? 5 : 0) : 1 + Math.floor(rnd(z, x) * 3)) : 0,
      props: siege ? [{ kind: 'banner', x: 3, y: 1.6, z: 1, color: siege.color }, { kind: 'banner', x: 13, y: 1.6, z: 1, color: siege.color }] : [] });
    v.updateChunks(9, 6); v.follow(7.6, 0, 5.2, true);
  }
  unitActor(u, x, z, face) {
    const v = this.view, sheet = u.beast ? beastSheet(u.beast) : personSheet(u.look);
    const a = v.addActor(sheet, x, z, { scale: u.beast ? 1.3 : 1.2 });
    if (u.beast) { a.tex.repeat.set(1 / 2, 1); a.beast = true; a.sprite.scale.set(1.75, 1.3, 1); }
    a.face = face; this.setFrame(a, 1);
    // the squad: a few soldiers behind the general
    u.squad = [];
    if (!u.beast) for (let k = 0; k < 6; k++) { const sx = x + (face === 1 ? 1 : -1) * (0.85 + (k % 3) * 0.5), sz = z - 0.75 + Math.floor(k / 3) * 0.6 + (k % 3) * 0.08;
      const s = v.addActor(personSheet(u.side === 'party' ? LOOKS.soldier(this.partyColor) : u.solLook), sx, sz, { scale: 0.52 }); s.face = face; this.setFrame(s, 1); u.squad.push(s); }
    u.actor = a; u.home = [x, z];
    u.bar = v.addLabel('', a.sprite, u.beast ? 1.5 : 2.0, 'u-bar'); this.drawBar(u);
  }
  setFrame(a, f) { if (a.beast) { a.tex.offset.set((f % 2) / 2, 0); a.tex.repeat.x = (a.face === 2 ? -1 : 1) / 2; if (a.face === 2) a.tex.offset.x += 1 / 2; return; } a.frame = f; a.dir = a.face; this.view.placeActor(a); }
  drawBar(u) {
    const p = Math.max(0, u.sol / u.solMax);
    u.bar.el.innerHTML = `<b>${u.name}</b><i style="--p:${p * 100}%;--c:${p > 0.5 ? '#6ae06a' : p > 0.25 ? '#e8c84a' : '#e85a4a'}"></i><span>${Math.max(0, Math.round(u.sol))}</span>${u.status.confuse ? '<em>混亂</em>' : ''}`;
    const n = Math.ceil(6 * p); u.squad?.forEach((s, k) => { s.sprite.visible = s.shadow.visible = k < n && u.sol > 0; });
    if (u.sol <= 0 && u.actor) { u.actor.sprite.material.opacity = 0.35; u.actor.sprite.material.transparent = true; }
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
    const mk = (p) => { const g = p.g, r = p.rec; return { side: 'party', g, rec: r, name: g.name, look: p.look, lv: r.lv, sol: r.sol, solMax: p.solMax, sp: r.sp, spMax: p.spMax, st: bstats(g, r), tactics: tacticsOf(g), status: {}, isPlayer: g.isPlayer }; };
    this.party = party.map(mk);
    this.foes = foes.map((f) => ({ side: 'foe', ...f, st: { atk: f.war + (f.wpn || 0), def: f.lead * 0.6 + (f.arm || 0) * 1.6 + f.lv + (o.siege ? 18 : 0), int: f.int, spd: (f.war + f.lead) / 2 + f.lv * 0.3, lead: f.lead, war: f.war }, tactics: f.beast ? [] : tacticsOf({ int: f.int, spells: f.spells || [] }), status: {}, spMax: f.sp, solLook: f.solLook || LOOKS.soldier(f.color || '#8a4a3a') }));
    // a column for each side, spread from front to back, every other general a step out
    const zs = (n) => Array.from({ length: n }, (_, i) => (n === 1 ? 6.2 : 3.7 + i * Math.min(1.9, 5.2 / (n - 1))));
    const pz = zs(this.party.length), fz = zs(this.foes.length);
    this.party.forEach((u, i) => this.unitActor(u, 10.6 + (i % 2) * 1.2, pz[i], 1));
    this.foes.forEach((u, i) => this.unitActor(u, 4.6 - (i % 2) * 1.2, fz[i], 2));
    this.loop = true; const tick = (t) => { if (!this.loop) return; const dt = Math.min(0.05, (t - (this.lt || t)) / 1000); this.lt = t; this.anim(dt); this.view.render(dt); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    this.game.audio?.music('battle');
    await this.say(o.title || `${this.foes.map((f) => f.name).slice(0, 3).join('、')}${this.foes.length > 3 ? '等' : ''}出現了！`);
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
    // write the soldiers back
    for (const u of this.party) { u.rec.sol = Math.max(0, Math.round(u.sol)); u.rec.sp = Math.max(0, Math.round(u.sp)); }
    const out = { result, foes: this.foes, party: this.party, rounds: this.round };
    return out;
  }
  close() { this.loop = false; this.root.classList.remove('on'); this.ui.innerHTML = ''; this.view?.clearMap(); }
  anim(dt) {
    this.at = (this.at || 0) + dt; const f = Math.floor(this.at * 3) % 2 ? 0 : 2;
    for (const u of [...this.party, ...this.foes]) if (u.actor && u.sol > 0) { this.setFrame(u.actor, u.busy ? 1 : f); for (const s of u.squad || []) this.setFrame(s, f); }
  }
  // ---------------------------------------------------------------- orders
  async orders() {
    const list = [];
    for (let i = 0; i < this.party.length; i++) {
      const u = this.party[i]; if (u.sol <= 0) continue;
      if (u.status.confuse) { list.push({ u, kind: 'confused' }); continue; }
      if (this.auto) { list.push(this.autoOrder(u)); continue; }
      const c = await this.menu(`${u.name}　兵 ${Math.round(u.sol)}／策 ${Math.round(u.sp)}`, [
        { k: 'atk', n: '攻擊' }, { k: 'tac', n: '策略', off: !u.tactics.length }, { k: 'item', n: '道具', off: !this.game.H.items || !Object.values(this.game.H.items).some((n) => n > 0) },
        ...(u.isPlayer && this.foes.some((f) => f.sol > 0 && f.gid != null) ? [{ k: 'duel', n: '一騎討' }] : []), { k: 'auto', n: '全軍突擊' }, ...(this.o.noFlee ? [] : [{ k: 'flee', n: '撤退' }]), ...(i > 0 ? [{ k: 'back', n: '← 返回' }] : [])]);
      if (c == null) { i--; continue; }
      if (c === 'back') { list.pop(); i -= 2; while (i >= 0 && this.party[i + 1] && this.party[i + 1].sol <= 0) i--; continue; }
      if (c === 'flee') return 'flee';
      if (c === 'auto') { this.auto = true; i--; continue; }
      if (c === 'atk') { const t = await this.pick(this.foes, '攻擊哪一隊？'); if (!t) { i--; continue; } list.push({ u, kind: 'atk', t }); }
      if (c === 'duel') { const t = await this.pick(this.foes.filter((f) => f.gid != null), '向誰挑戰一騎討？'); if (!t) { i--; continue; } return { duel: { u, t }, list }; }
      if (c === 'tac') {
        const k = await this.menu('使用哪個策略？', [...u.tactics.map((k) => ({ k, n: `${TACTICS[k].n}　${TACTICS[k].sp}`, off: u.sp < TACTICS[k].sp, d: TACTICS[k].d })), { k: null, n: '← 返回' }]);
        if (!k) { i--; continue; }
        const T = TACTICS[k]; let t = null;
        if (T.tgt === 'one') { t = await this.pick(this.foes, `${T.n}：哪一隊？`); if (!t) { i--; continue; } }
        if (T.tgt === 'ally') { t = await this.pick(this.party, `${T.n}：哪一隊？`, true); if (!t) { i--; continue; } }
        list.push({ u, kind: 'tac', k, t });
      }
      if (c === 'item') {
        const H = this.game.H, own = Object.keys(H.items).filter((k) => H.items[k] > 0 && ITEMS[k] && !ITEMS[k].gift);
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
    const can = (k) => u.tactics.includes(k) && u.sp >= TACTICS[k].sp;
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
    }
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
  side(u) { return u.side === 'party' ? this.party : this.foes; }
  other(u) { return u.side === 'party' ? this.foes : this.party; }
  async act(o) {
    const u = o.u;
    if (o.kind === 'confused') { this.float(u, '混亂中', '#c8a0ff'); await wait(350); return; }
    if (o.kind === 'wait') return;
    if (o.kind === 'atk') {
      let t = o.t; if (!t || t.sol <= 0) t = this.other(u).find((x) => x.sol > 0); if (!t) return;
      await this.lunge(u, t);
      if (t.status.evade && Math.random() < 0.5) { this.float(t, '落空', '#c8e8ff'); this.game.audio?.sfx('miss'); return; }
      const d = this.physDmg(u, t); this.hit(t, d, u);
      if (u.st.war >= 85 && Math.random() < 0.12 && t.sol > 0) { await wait(220); this.float(u, '連擊！', '#ffd86a'); this.hit(t, Math.round(this.physDmg(u, t) * 0.6), u); }
      await wait(260); return;
    }
    if (o.kind === 'tac') {
      const T = TACTICS[o.k]; if (u.sp < T.sp) { return this.act({ u, kind: 'atk', t: o.t && o.t.side !== u.side ? o.t : null }); }
      u.sp -= T.sp; await this.say(`${u.name}使出「${T.n}」！`, 520); this.flash(T);
      const foes = this.other(u).filter((x) => x.sol > 0), mine = this.side(u).filter((x) => x.sol > 0);
      if (T.kind === 'dmg') {
        const ts = T.tgt === 'all' ? foes : [o.t && o.t.sol > 0 && o.t.side !== u.side ? o.t : foes[0]].filter(Boolean);
        for (const t of ts) {
          const hitP = clamp(0.6 + (u.st.int - t.st.int) / 110, 0.18, 0.97);
          if (Math.random() > hitP) { this.float(t, '識破！', '#c8e8ff'); continue; }
          const terr = this.o.terrain, bonus = (o.k === 'rock' && terr === 'hill') || (o.k === 'flood' && (terr === 'marsh' || terr === 'coast')) || ((o.k === 'fire' || o.k === 'blaze') && terr === 'forest') ? 1.35 : o.k === 'fire' && terr === 'snow' ? 0.7 : 1;
          const d = Math.round((u.st.int * 2.4 + (u.lv || 1) * 3) * T.pow * bonus * (0.9 + Math.random() * 0.2) * (110 / (110 + t.st.int * 0.5)));
          this.hit(t, d, u, true);
        }
      }
      if (T.kind === 'heal') { const ts = T.tgt === 'allies' ? mine : [o.t && o.t.sol > 0 ? o.t : mine.sort((a, b) => a.sol / a.solMax - b.sol / b.solMax)[0]]; for (const t of ts) { const n = Math.round((u.st.int * 3 + 60) * T.pow); t.sol = Math.min(t.solMax, t.sol + n); this.float(t, '+' + n, '#8aff8a'); this.drawBar(t); } }
      if (T.kind === 'confuse') { const ts = T.tgt === 'all' ? foes : [o.t && o.t.sol > 0 ? o.t : foes[0]]; for (const t of ts) { if (Math.random() < clamp(0.55 + (u.st.int - t.st.int) / 100, 0.1, 0.9)) { t.status.confuse = 2; this.float(t, '混亂！', '#c8a0ff'); this.drawBar(t); } else this.float(t, '識破！', '#c8e8ff'); } }
      if (T.kind === 'buff') for (const t of mine) { t.status.rouse = 3; this.float(t, '攻擊↑', '#ffb04a'); }
      if (T.kind === 'guard') for (const t of mine) { t.status.guard = 3; this.float(t, '防禦↑', '#8ac8ff'); }
      if (T.kind === 'evade') for (const t of mine) { t.status.evade = 3; this.float(t, '迴避↑', '#c8e8ff'); }
      await wait(450); return;
    }
    if (o.kind === 'item') {
      const H = this.game.H, I = ITEMS[o.k]; if (!(H.items[o.k] > 0)) return; H.items[o.k]--;
      await this.say(`${u.name}使用了${I.n}。`, 420);
      const ts = I.healAll ? this.party.filter((x) => x.sol > 0) : [o.t];
      for (const t of ts) { if (!t || t.sol <= 0 && !I.heal) continue; if (I.sp) { t.sp = Math.min(t.spMax, t.sp + I.sp); this.float(t, '策+' + I.sp, '#8ac8ff'); continue; } const n = Math.round(t.solMax * (I.heal || I.healAll)); t.sol = Math.min(t.solMax, Math.max(0, t.sol) + n); this.float(t, '+' + n, '#8aff8a'); if (t.actor) t.actor.sprite.material.opacity = 1; this.drawBar(t); }
      await wait(300);
    }
  }
  physDmg(u, t) {
    const sf = 0.4 + 0.6 * Math.sqrt(Math.max(0, u.sol) / u.solMax), base = u.st.atk * 2.4 + (u.lv || 1) * 3;
    let d = base * sf * (0.88 + Math.random() * 0.24) * (100 / (100 + t.st.def * 0.8));
    if (u.status.rouse) d *= 1.3; if (t.status.guard) d *= 0.5; if (this.o.siege && t.side === 'foe') d *= 0.85;
    if (Math.random() < 0.06 + u.st.war / 1500) { d *= 1.6; this.float(u, '會心！', '#ffe04a'); }
    return Math.max(1, Math.round(d));
  }
  hit(t, d, by, magic) {
    t.sol = Math.max(0, t.sol - d); this.float(t, d, magic ? '#ffb04a' : '#ffffff', d > t.solMax * 0.25);
    this.game.audio?.sfx(magic ? 'fire' : 'hit');
    t.shake = 0.3; this.drawBar(t);
    if (t.sol <= 0) { this.float(t, '潰敗', '#ff6a5a', true); t.routedBy = by; }
  }
  async lunge(u, t) {
    const a = u.actor, [hx, hz] = u.home, tx = t.home[0] + (u.side === 'party' ? 1.3 : -1.3), tz = t.home[1];
    u.busy = true;
    for (let k = 0; k <= 8; k++) { const p = k / 8; a.x = hx + (tx - hx) * p; a.z = hz + (tz - hz) * p; this.view.placeActor(a); await wait(18); }
    await wait(60); for (let k = 0; k <= 8; k++) { const p = k / 8; a.x = tx + (hx - tx) * p; a.z = tz + (hz - tz) * p; this.view.placeActor(a); await wait(16); }
    u.busy = false;
  }
  flash(T) { const g = this.view.grade.uniforms; g.flashColor.value.set(...(T.kind === 'heal' ? [0.6, 1, 0.6] : T.n.includes('雷') ? [0.9, 0.9, 1] : T.n.includes('水') ? [0.5, 0.7, 1] : [1, 0.6, 0.3])); g.flash.value = 0.45; const f = () => { g.flash.value *= 0.85; if (g.flash.value > 0.01) requestAnimationFrame(f); else g.flash.value = 0; }; requestAnimationFrame(f); }
  async tryFlee() {
    const me = Math.max(...this.party.filter((u) => u.sol > 0).map((u) => u.st.spd)), them = Math.max(...this.foes.filter((u) => u.sol > 0).map((u) => u.st.spd));
    if (Math.random() < clamp(0.55 + (me - them) / 100, 0.2, 0.95)) { await this.say('全軍撤退了。'); return true; }
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
    const hpOf = (u) => Math.round(100 + u.st.war * 2 + (u.lv || 1) * 2);
    const A = { u: a, hp: hpOf(a), max: hpOf(a), fury: 0 }, B = { u: b, hp: hpOf(b), max: hpOf(b), fury: 0 };
    // bring the two forward
    const pa = a.actor ? [a.actor.x, a.actor.z] : null, pb = b.actor ? [b.actor.x, b.actor.z] : null;
    if (a.actor) { a.actor.x = 9.4; a.actor.z = 6.2; this.view.placeActor(a.actor); } if (b.actor) { b.actor.x = 6.6; b.actor.z = 6.2; this.view.placeActor(b.actor); }
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
      const dmg = (S, T, k, k2) => { const base = (S.u.st.war * 1.1 + 12) * (0.85 + Math.random() * 0.3) * (1 + (S.u.st.war - T.u.st.war) / 120);
        let m = k === 'hit' ? 0.32 : k === 'power' ? 0.55 : k === 'ult' ? 1.2 : 0; if (k2 === 'guard') m *= k === 'power' ? 0.2 : k === 'ult' ? 0.6 : 0.35; return Math.max(0, Math.round(base * m)); };
      const da = ca === 'flee' ? 0 : dmg(A, B, ca, cb), db = dmg(B, A, cb, ca === 'flee' ? 'hit' : ca);
      // a strong blow into a guard is turned back on the striker
      const back = (k, k2, S) => (k === 'power' && k2 === 'guard' ? Math.round((S.u.st.war * 0.25 + 8)) : 0);
      const ra = back(ca, cb, A), rb = back(cb, ca, B);
      if (ca === 'ult') A.fury = 0; if (cb === 'ult') B.fury = 0;
      if (ca === 'guard') A.fury = Math.min(100, A.fury + 34); if (cb === 'guard') B.fury = Math.min(100, B.fury + 34);
      A.fury = Math.min(100, A.fury + Math.round(db / A.max * 120)); B.fury = Math.min(100, B.fury + Math.round(da / B.max * 120));
      if (a.actor && da) await this.lunge(a, b); else if (b.actor && db) await this.lunge(b, a);
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
    if (a.actor && pa) { a.actor.x = pa[0]; a.actor.z = pa[1]; this.view.placeActor(a.actor); } if (b.actor && pb) { b.actor.x = pb[0]; b.actor.z = pb[1]; this.view.placeActor(b.actor); }
    return res;
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
    this.unitActor(a, 10, 6.2, 1); this.unitActor(b, 6, 6.2, 2); for (const u of [a, b]) { u.squad.forEach((s) => { s.sprite.visible = s.shadow.visible = false; }); this.view.removeLabel(u.bar); u.bar = { el: document.createElement('div') }; }
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
