// 擂台比武大會: once a year one of the great cities holds a tournament (announced in the spring, held in the eighth
// month). Eight fighters — the strongest of the land who can come, and the player if he is in the city that month —
// meet man to man, knock-out, three rounds. Before it starts the crowd bets on the champion (the odds from the
// fighters' might). The champion takes gold, renown and a treasure; every win against a ranked fighter moves the
// martial ranking (martial.js). Held without the player, the chronicle tells who won.
import { CITY_POS } from './world.js';
import { rankList, might } from './martial.js';
import { bstats } from './hero.js';
import { relicFx, rollRelic, giveRelic, RELICS } from './relics.js';
import { record } from './sim/engine.js';
import { deed } from './deeds.js';

const MONTH = 8;
const able = (g) => !!g && (g.status === 'serving' || g.status === 'free') && !g.isPlayer;
const win = (a, b) => Math.random() < 1 / (1 + Math.exp(-(might(a) - might(b)) / 10));

export class Arena {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; }
  // the spring: this year's host
  month() {
    const G = this.G, H = this.H;
    if (!H.arena || H.arena.y !== G.year) {
      const big = G.cities.filter((c) => CITY_POS[c.id]?.size >= 3 && c.owner); if (!big.length) return;
      const c = big[Math.floor(Math.random() * big.length)]; H.arena = { y: G.year, c: c.id, done: false };
      if (G.month <= MONTH) this.g.ui.toast(`<b style="color:#ffd86a">${G.year}年${MONTH}月，${c.name}將舉辦天下比武大會！</b><br><small>天下高手齊聚，冠軍可得重賞。到時候人在${c.name}就能報名。</small>`, 5500);
    }
    // the month is over and the player did not come: it was held without him
    if (G.month === MONTH + 1 && H.arena && !H.arena.done) { H.arena.done = true; this.simulate(); }
  }
  hint() { const a = this.H?.arena, G = this.G; return a && !a.done && a.y === G.year ? `${G.year}年${MONTH}月，${G.cities[a.c].name}要舉辦天下比武大會。` : ''; }
  // the eight
  field(withMe) {
    const G = this.G, L = rankList(this.g).map((id) => G.gens[id]).filter((x) => able(x) && !this.H.party.includes(x.id) && !(x.status === 'serving' && G.factions[x.fac]?.lord === x.id));
    const rest = G.gens.filter((x) => able(x) && !L.includes(x) && !this.H.party.includes(x.id) && x.war >= 70 && !(x.status === 'serving' && G.factions[x.fac]?.lord === x.id)).sort(() => Math.random() - 0.5);
    const out = [...L.slice(0, 5), ...rest].slice(0, withMe ? 7 : 8); if (withMe) out.splice(Math.floor(Math.random() * 8), 0, this.g.me);
    return out;
  }
  simulate() {
    const G = this.G, a = this.H.arena; let f = this.field(false); while (f.length > 1) { const n = []; for (let i = 0; i < f.length; i += 2) n.push(f[i + 1] && !win(f[i], f[i + 1]) ? f[i + 1] : f[i]); f = n; }
    const c = f[0]; if (!c) return; c.duelsWon = (c.duelsWon || 0) + 3;
    record(G, 'tie', 'arena', { g: c.name, c: G.cities[a.c].name }, c.status === 'serving' ? c.fac : null, 2, { g: c.id });
    this.g.ui.toast(`🏆 <b>${c.name}</b>在${G.cities[a.c].name}的天下比武大會奪得冠軍！`, 4500);
  }
  // in the host city in the month: enter?
  async check() {
    const g = this.g, G = this.G, H = this.H, a = H.arena;
    if (!a || a.done || a.y !== G.year || G.month !== MONTH || g.town?.city !== a.c || g.mode !== 'town') return false;
    const ui = g.ui, C = G.cities[a.c];
    await ui.say('', `${C.name}城中搭起了一座高高的擂台，四方的豪傑都來了。\n「天下比武大會」今天開始！`);
    const go = await ui.yesno('要報名參加比武大會嗎？（三輪單挑淘汰賽，冠軍有重賞）');
    a.done = true;
    const F = this.field(go), names = F.map((x) => x.name);
    await ui.say('', `參賽的八位高手：\n${names.slice(0, 4).join('、')}\n${names.slice(4).join('、')}`);
    const bet = await this.bet(F);
    let f = F, champ = null, mine = go;
    for (let r = 0; f.length > 1; r++) {
      const next = [], rn = ['八強賽', '準決賽', '決賽'][r];
      for (let i = 0; i < f.length; i += 2) {
        const x = f[i], y = f[i + 1]; if (!y) { next.push(x); continue; }
        if (x.isPlayer || y.isPlayer) { const o = x.isPlayer ? y : x; const w = await this.fight(o, rn); if (w) next.push(g.me); else { next.push(o); mine = false; } }
        else next.push(win(x, y) ? x : y);
      }
      if (!go || !next.includes(g.me) || f.length === 2) await ui.say('', `${rn}結果：${next.map((x) => x.name).join('、')}${next.length > 1 ? '晉級' : '奪得冠軍！'}`);
      f = next;
    }
    champ = f[0];
    if (champ.isPlayer) {
      const gold = 1000, id = rollRelic(g.act.avgLv() + 10, 3); H.gold += gold; H.fame += 150; H.st.duels += 3; giveRelic(g, id, true); deed(g, `${C.name}比武大會奪魁`, true); g.audio.sfx('level');
      record(G, 'tie', 'arena', { g: g.me.name, c: C.name }, g.myFaction(), 3, { g: g.me.id });
      await ui.say('', `🏆 ${g.me.name}在${C.name}的天下比武大會奪得冠軍！\n全場歡聲雷動。\n（金 +${gold}、名聲 +150、得到「${RELICS[id].n}」）`);
    } else {
      record(G, 'tie', 'arena', { g: champ.name, c: C.name }, champ.status === 'serving' ? champ.fac : null, 2, { g: champ.id });
      if (go && F.includes(g.me)) H.fame += 20;
    }
    if (bet) { if (bet.x === champ) { const n = Math.round(bet.n * bet.odds); H.gold += n; g.audio.sfx('coin'); await ui.say('莊家', `押中了！${champ.name}奪冠，賠率 ${bet.odds.toFixed(1)} 倍——這是你的 ${n} 金！`); } else await ui.say('莊家', `${champ.name}奪冠了……您押的${bet.x.name}沒能贏。`); }
    g.hud(); return true;
  }
  // the bookmaker: odds from might
  async bet(F) {
    const g = this.g, H = this.H, ui = g.ui, M = F.map((x) => Math.exp(might(x) / 12)), S = M.reduce((a, b) => a + b, 0);
    const odds = F.map((x, i) => Math.max(1.3, Math.min(25, 0.9 * S / M[i])));
    const k = await ui.choose([...F.map((x, i) => ({ k: i, n: x.name + (x.isPlayer ? '（你自己）' : ''), sub: `賠率 ${odds[i].toFixed(1)}`, d: `武力 ${x.war}　Lv ${g.act.lvOf(x)}` })), { k: null, n: '不下注' }], { title: `莊家：押誰會奪冠？　金 ${H.gold}` });
    if (k == null) return null;
    const n = await ui.choose([100, 300, 1000].map((v) => ({ k: v, n: `押 ${v} 金`, off: H.gold < v })).concat([{ k: null, n: '算了' }]), { title: `押${F[k].name}` });
    if (!n) return null; H.gold -= n; return { x: F[k], n, odds: odds[k] };
  }
  async fight(o, rn) {
    const g = this.g, H = this.H, me = g.me, rec = H.rec[me.id], ui = g.ui;
    await ui.say('', `${rn}：${me.name} 對 ${o.name}（武力 ${o.war}）`);
    const a = { name: me.name, look: g.lookOf(me), lv: rec.lv, st: bstats(me, rec), isPlayer: true, arms: relicFx(rec) }, b = g.act.duelFoe(o), was = g.mode;
    g.mode = 'battle'; g.audio.music('battle'); const r = await g.battle.soloDuel(a, b, { noFlee: true, terrain: 'city' }); g.battle.close(); g.mode = was; g.audio.music('town');
    if (r === 'win') { me.duelsWon++; g.act.rankAfter(o, true); await ui.say(o.name, '……你贏了。', g.lookOf(o)); return true; }
    g.act.rankAfter(o, false); await ui.say(o.name, '承讓了。', g.lookOf(o)); return false;
  }
}
