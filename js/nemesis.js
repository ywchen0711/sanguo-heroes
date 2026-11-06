// 宿敵: a named general the player beats and who gets away remembers it. He goes off and trains (his strength and his
// level grow each time), and some months later he comes looking for the player on the road with more men than before,
// talking of the last time (where, and how long ago). Beaten again, he may be put to death, let go (he will be back,
// stronger), or — after three defeats — won over, the two of them having come to respect each other. The fourth time
// he asks to settle it man to man. State: H.nem = { gid: { k (beaten by you), w (beat you), lv, at, y, last } }.
import { die, refresh, serve } from './sim/engine.js';
import { CITY_POS } from './world.js';
import { diff } from './hardship.js';
import { deed } from './deeds.js';
import { addBond } from './bonds.js';
import { newRec, bstats, solMax, spMax } from './hero.js';
import { relicFx } from './relics.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Nemesis {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; }
  all() { return (this.H.nem ||= {}); }
  able(x) { const G = this.G; return !!x && !x.isPlayer && (x.status === 'serving' || x.status === 'free') && !this.H.party.includes(x.id) && !(x.status === 'serving' && G.factions[x.fac]?.lord === x.id) && !(x.status === 'serving' && x.fac === this.g.myFaction()); }
  where() { const P = this.g.pos, x = P.town != null ? CITY_POS[P.town].x : P.x, z = P.town != null ? CITY_POS[P.town].y : P.z; let b = null, bd = 1e9; for (const c of CITY_POS) { const d = Math.hypot(c.x - x, c.y - z); if (d < bd) { bd = d; b = c; } } return b ? this.G.cities[b.id].name : ''; }
  // after a battle: a named general routed by the player, and alive, remembers; one who beat the player gloats
  note(gid, won, routed) {
    const G = this.G, x = G.gens[gid]; if (!this.able(x)) return;
    const N = this.all(), n = N[gid];
    if (!won) { if (n) n.w++; return; }
    if (!routed) return;
    const first = !n, e = N[gid] ||= { k: 0, w: 0, lv: 0, last: G.t };
    e.k++; e.at = this.where(); e.y = G.year; e.last = G.t; this.grow(x, e);
    if (first) this.g.ui.toast(`<b style="color:#ff9a6a">${x.name}敗走了，臨走前狠狠地瞪了你一眼。</b><br><small>他會記住這一仗的</small>`, 4500);
    if (e.k === 3) deed(this.g, `三敗${x.name}`);
  }
  // he trains: stronger each time
  grow(x, e) {
    const D = diff(this.g); e.lv += Math.round(2 * D.nem);
    for (const k of x.war >= x.int ? ['war', 'lead'] : ['int', 'lead']) x.base[k] = Math.min(100, x.base[k] + 1 + Math.round(Math.random() * D.nem));
    refresh(this.G, x);
  }
  lvBonus(id) { return this.H?.nem?.[id]?.lv || 0; }
  // the month: one of them, a while after the last time, sets out to find the player
  month() {
    const G = this.G, H = this.H, D = diff(this.g); if (H.nemDue != null) return;
    const ready = Object.entries(this.all()).filter(([id, e]) => this.able(G.gens[id]) && e.last + 3 <= G.t && !e.done);
    if (ready.length && Math.random() < 0.22 * D.nem * Math.min(2, ready.length)) H.nemDue = +pick(ready)[0];
  }
  // he finds the player on the road
  async strike() {
    const g = this.g, G = this.G, H = this.H, ui = g.ui, id = H.nemDue; H.nemDue = null;
    const x = G.gens[id], e = this.all()[id]; if (!this.able(x) || !e) return;
    const look = g.lookOf(x), ago = G.year - e.y, when = ago <= 0 ? '前些日子' : `${ago}年前`;
    const said = e.k >= 4 ? `${g.me.name}！我們之間，該做個了斷了。\n不要兵馬，不要計謀——就你我兩人，一對一！`
      : e.k >= 2 ? pick([`${when}在${e.at}，我又一次敗在你手下。\n這些日子我沒有一天不在想著今天！`, `${g.me.name}，你還記得我嗎？\n我可是一天也沒忘記過${e.at}的事！`])
      : pick([`${when}在${e.at}的那一仗，我可還記得清清楚楚！\n今天，我要把那天丟的臉全部討回來！`, `總算讓我找到你了，${g.me.name}！\n自從${e.at}一敗，我日夜苦練，就等著這一天！`]);
    g.audio.sfx('encounter');
    await ui.say(x.name, `${said}\n（宿敵${x.name}：武力 ${x.war}　統率 ${x.lead}　Lv ${g.act.lvOf(x)}${e.k ? `　你已經勝了他 ${e.k} 次` : ''}）`, look);
    if (e.k >= 4) return this.showdown(x, e, look);
    const lv = g.act.lvOf(x), rec = { lv, eq: {} }, f = x.status === 'serving' && G.factions[x.fac], col = f ? f.color : '#6a5a4a';
    const sol = Math.round(solMax(x, rec) * (1.1 + 0.15 * e.k));
    const foes = [{ name: x.name, look, lv, war: x.war, lead: x.lead, int: x.int, sol, solMax: sol, sp: Math.round(spMax(x, rec)), spells: x.spells, gid: x.id, color: col, wpn: Math.round(lv / 3), arm: Math.round(lv / 3) }];
    for (let i = 0; i < Math.min(4, 1 + e.k, H.party.length + 2); i++) foes.push(g.act.foe(`${x.name}的親衛`, f ? 'soldier' : 'bandit', Math.max(1, lv - 2), col, i === 0));
    const r = await g.act.fight(foes, { terrain: g.act.terrainAt(), title: `宿敵${x.name}來襲！`, noRelic: false });
    if (r !== 'win') { H.fame = Math.max(0, H.fame - 10); await ui.say(x.name, `哈哈哈！${g.me.name}，你也有今天！
（名聲 -10）`, look); return; }
    if (!this.able(x)) return;
    const can = e.k >= 3 && H.party.length < g.partyMax();
    const c = await ui.ask(`${x.name}又一次敗在你的手下，倒在地上喘著氣。`, [{ k: 'free', n: '放他走', d: '名聲 +5；他還會再來，而且更強' }, ...(can ? [{ k: 'win', n: '惺惺相惜，邀他同行', d: '交手這麼多次，或許他願意追隨你' }] : []), { k: 'kill', n: '斬殺', d: '一了百了' }], x.name, look);
    if (c === 'kill') { die(G, x, 'executed', g.me); H.st.kills.push(x.name); H.fame += 15; e.done = true; deed(g, `斬宿敵${x.name}`); await ui.say('', `${x.name}倒下了。糾纏多年的恩怨，就此了結。`); return; }
    if (c === 'win') {
      const p = Math.min(0.85, 0.25 + (e.k - 2) * 0.2 + (g.me.cha - 60) / 150);
      if (Math.random() < p) { e.done = true; this.join(x); await ui.say(x.name, `……我一次又一次地來找你，一次又一次地輸。\n天下之大，能讓我心服口服的，就只有你了。${g.me.name}，讓我跟著你吧！`, look); deed(g, `${x.name}屢敗於${g.me.name}，終於歸心`); return; }
      await ui.say(x.name, '要我跟著你？……哼，下次我一定會贏！', look);
    }
    H.fame += 5; await ui.say(x.name, pick(['今天算你厲害……我還會再來的！', '你等著，下次倒下的就是你！', '……為什麼不殺我？哼，你會後悔的！']), look);
  }
  // the fourth time: man to man, to settle it
  async showdown(x, e, look) {
    const g = this.g, H = this.H, G = this.G, ui = g.ui;
    if (!await ui.yesno(`接受${x.name}的單挑嗎？（拒絕：名聲 -20，他會再來）`)) { H.fame = Math.max(0, H.fame - 20); e.last = G.t; await ui.say(x.name, '你怕了？哈哈哈！', look); return; }
    const me = g.me, rec = H.rec[me.id], a = { name: me.name, look: g.lookOf(me), lv: rec.lv, st: bstats(me, rec), isPlayer: true, arms: relicFx(rec) }, b = g.act.duelFoe(x), was = g.mode;
    g.mode = 'battle'; g.audio.music('battle'); const r = await g.battle.soloDuel(a, b, { noFlee: true }); g.battle.close(); g.mode = was; g.audio.music(was === 'town' ? 'town' : 'field');
    if (r === 'win') {
      H.st.duels++; me.duelsWon++; H.fame += 60; e.done = true; g.act.rankAfter(x, true);
      const c = await ui.ask(`${x.name}單膝跪地：「我輸了，輸得心服口服。」`, [{ k: 'win', n: '扶他起來，邀他同行' }, { k: 'free', n: '讓他走吧' }, { k: 'kill', n: '斬殺' }], x.name, look);
      if (c === 'kill') { die(G, x, 'duel', me); H.st.kills.push(x.name); deed(g, `於一騎討斬宿敵${x.name}`, true); await ui.say('', `一代宿敵${x.name}，死在你的手中。`); return; }
      if (c === 'win' && H.party.length < g.partyMax()) { this.join(x); deed(g, `收服宿敵${x.name}`, true); await ui.say(x.name, '從今往後，我這條命就是你的了！', look); return; }
      deed(g, `一騎討大敗宿敵${x.name}`); await ui.say(x.name, '……後會有期。', look); return;
    }
    if (r === 'lose') { e.w++; e.last = G.t; H.fame = Math.max(0, H.fame - 30); g.act.rankAfter(x, false); await ui.say(x.name, '終於……終於贏了你！這一天我等了好久！', look); }
  }
  join(x) {
    const g = this.g, H = this.H, G = this.G;
    x.follow = H.pid; H.party.push(x.id); H.rec[x.id] ||= newRec(x, Math.max(1, g.act.lvOf(x) - 2)); addBond(g, x.id, 30);
    if (g.me.status === 'serving') serve(G, x, g.me.fac, g.me.city, 70); else if (x.status === 'serving') { x.status = 'free'; x.fac = null; }
    g.respawnParty(); g.hud();
  }
  // in a battle against one: { foeAtk, lines }
  mods(foes) {
    const N = this.H?.nem || {}, out = { foeAtk: 1, lines: [] };
    for (const f of foes) { const e = f.gid != null && N[f.gid]; if (!e || e.done) continue; out.foeAtk *= 1 + 0.04 * e.k; out.lines.push(`宿敵${f.name}：「${e.at}的帳，今天一起算！」（敵軍攻擊上升）`); }
    return out;
  }
  // the people panel
  html() {
    const G = this.G, rows = Object.entries(this.H.nem || {}).map(([id, e]) => { const x = G.gens[id]; if (!x) return ''; const st = x.status === 'dead' ? '已故' : e.done ? '恩怨已了' : this.H.party.includes(+id) ? '同行' : '還在找你'; return `<div class="rf"><b>${x.name}</b><span>你勝 ${e.k}・他勝 ${e.w}</span><span>武${x.war} 統${x.lead}</span><span>${st}</span></div>`; }).join('');
    return rows ? `<h4>纏著你的宿敵（被你打敗又逃走的人）</h4>${rows}` : '';
  }
}
