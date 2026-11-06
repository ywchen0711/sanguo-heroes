// 計略: an army on the march (armies.js) can be beaten without meeting it head on. The cleverest of the party plans
// it, and each kind can be tried once against an army:
//   火攻   set the grass or the woods round its camp alight (智力; not in the rain; best in forest, on dry grass)
//   斷糧道 fall on its supply train (a small fight with the escort): men desert, and the party eats from the carts
//   離間   turn its generals against each other (智力 and 魅力 against the commander's 智力): one of them marches
//          off home with his men; now and then the whole army falls apart
//   謠言   spread word that their own city is in danger (政治; costs gold for the agents): the army may turn back
// A plot found out costs renown, or brings the army down on the party.
import { CITY_POS, T } from './world.js';
import { allied, record } from './sim/engine.js';
import { deed, bump } from './deeds.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KIND = { fire: '火攻', food: '斷糧道', split: '離間', rumor: '散布謠言' };

export class Ploys {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; }
  hostile(c) { const mine = this.g.myFaction(); return !c.back && c.fac !== mine && !(mine && allied(this.G, mine, c.fac)); }
  // the armies near the player that a plot could reach
  near(r = 10) { const P = this.g.pos, cs = this.g.camps; return cs.list.filter((c) => { if (!this.hostile(c)) return false; const w = cs.where(c); return w && Math.hypot(w.at[0] - P.x, w.at[1] - P.z) <= r; }); }
  // who plans it: the cleverest of the party
  brain(k = 'int') { return this.g.partyList().map((p) => p.g).sort((a, b) => b[k] - a[k])[0]; }
  async pickArmy() {
    const L = this.near(); if (!L.length) { this.g.ui.toast('附近沒有可以施計的敵軍大軍（要在十格以內）'); return; }
    const G = this.G, k = L.length === 1 ? 0 : await this.g.ui.choose(L.map((c, i) => ({ k: i, n: `${G.factions[c.fac].name}軍・${G.gens[c.army[0]]?.name || ''}`, sub: `兵 ${c.troops}`, d: `往${G.cities[c.target].name}` })).concat([{ k: null, n: '返回' }]), { title: '對哪一支大軍施計？' });
    if (k != null) await this.menu(L[k]);
  }
  async menu(c) {
    const g = this.g, G = this.G, H = this.H, ui = g.ui, done = c.ploys ||= [], lead = G.gens[c.army[0]], wx = g.wx();
    const b = this.brain(), bc = this.brain('cha'), bp = this.brain('pol'), land = g.world.at(g.pos.x, g.pos.z);
    const pFire = clamp((b.int - 55) / 50 + (land === T.FOREST ? 0.2 : land === T.MEADOW || land === T.PLAIN ? 0.05 : -0.15) - (wx === 'rain' ? 0.6 : wx === 'snow' ? 0.3 : 0) - (lead.int - 60) / 200, 0.03, 0.9);
    const pSplit = clamp((b.int + bc.cha - lead.int - 70) / 120 + (c.army.length > 1 ? 0.1 : -0.3), 0.03, 0.85), pRumor = clamp((bp.pol - 50) / 90 + 0.1 - (lead.int - 60) / 150, 0.03, 0.7), cost = 150;
    const opts = [
      { k: 'fire', n: `火攻（${b.name}）`, sub: `${Math.round(pFire * 100)}%`, d: `燒掉他們的營地：兵力大減。${wx === 'rain' ? '下雨天很難點著。' : land === T.FOREST ? '樹林裡最好放火。' : ''}`, off: done.includes('fire') },
      { k: 'food', n: '斷糧道', d: '偷襲他們的運糧隊（打一場小仗）：士兵逃散，糧車上的糧食歸你', off: done.includes('food') },
      { k: 'split', n: `離間（${b.name}、${bc.name}）`, sub: `${Math.round(pSplit * 100)}%`, d: c.army.length > 1 ? '挑撥將領不和：一位將領帶著部下回去，有時整支大軍會分崩離析' : '只有一位將領，很難離間', off: done.includes('split') },
      { k: 'rumor', n: `散布謠言（${bp.name}）`, sub: `${Math.round(pRumor * 100)}%`, d: `花 ${cost} 金派人散布「老家告急」的謠言：大軍可能撤退`, off: done.includes('rumor') || H.gold < cost },
      { k: null, n: '返回' }];
    const k = await ui.choose(opts, { title: `計略：${G.factions[c.fac].name}軍・${lead.name}（兵 ${c.troops}，智力 ${lead.int}）` });
    if (!k) return; done.push(k);
    if (k === 'fire') return this.fire(c, b, pFire);
    if (k === 'food') return this.food(c);
    if (k === 'split') return this.split(c, b, pSplit);
    if (k === 'rumor') { H.gold -= cost; return this.rumor(c, bp, pRumor); }
  }
  // the army's losses, and turning back when it has lost half
  hurt(c, n, why) {
    const g = this.g, G = this.G, f = G.factions[c.fac], t = G.cities[c.target]; c.troops = Math.max(0, c.troops - n);
    const back = c.troops < c.troops0 * 0.5 || c.troops < 3000; if (back && !c.back) { g.camps.turnBack(c); deed(g, `${why}，${f.name}軍不戰而退，解${t.name}之圍`); }
    if (g.myFaction() && !g.isLord()) { g.me.merit += back ? 20 : 8; g.act.promote(); }
    this.H.fame += back ? 25 : 10; record(G, 'war', 'ploy', { g: g.me.name, f: f.name, k: KIND[c.ploys[c.ploys.length - 1]], c: t.name }, g.myFaction(), back ? 2 : 1, {});
    g.hud(); return back;
  }
  async fire(c, b, p) {
    const g = this.g, ui = g.ui;
    await ui.say(b.name, '夜深了，等他們睡熟，就從上風處放火！', g.lookOf(b));
    if (Math.random() < p) {
      const n = Math.round(c.troops * (0.18 + Math.random() * 0.17)); g.crowd.fx?.flames(g.pos.x, g.pos.z, 6); g.audio.sfx('fire');
      const back = this.hurt(c, n, '火燒敵營'); bump(this.H, 'tacs');
      return ui.say('', `大火沖天而起，敵營亂成一團！\n燒死、踩死、逃散的士兵有 ${n} 人。${back ? '\n敵軍主將下令撤退了！' : `\n敵軍還剩 ${c.troops} 人。`}`);
    }
    if (Math.random() < 0.5) { await ui.say('', '火還沒點起來，就被敵軍的巡邏兵發現了！'); return this.g.act.cutArmy(c); }
    this.H.fame = Math.max(0, this.H.fame - 5); return ui.say('', '風向突然變了，火燒不起來……只好悄悄退走。（名聲 -5）');
  }
  async food(c) {
    const g = this.g, act = g.act, G = this.G, f = G.factions[c.fac], lv = act.foeLv();
    const foes = Array.from({ length: Math.min(4, this.H.party.length + 2) }, (_, i) => act.foe(i ? '運糧兵' : '押糧官', 'soldier', Math.max(1, lv - 1 + (i ? 0 : 2)), f.color, !i));
    g.audio.sfx('encounter'); const r = await act.fight(foes, { terrain: act.terrainAt(), title: `偷襲${f.name}軍的運糧隊！`, ambush: true });
    if (r !== 'win') return;
    const n = Math.round(c.troops * 0.22), food = Math.round(15 * g.hard.need()); this.H.food = Math.min(g.hard.cap(), (this.H.food || 0) + food);
    const back = this.hurt(c, n, '斷其糧道');
    await g.ui.say('', `燒了糧車，搬走了一部分糧食（乾糧 +15 天份）。\n${f.name}軍斷了糧，一夜之間逃走了 ${n} 人。${back ? '\n大軍撤退了！' : ''}`);
  }
  async split(c, b, p) {
    const g = this.g, G = this.G, ui = g.ui, lead = G.gens[c.army[0]];
    if (Math.random() < p && c.army.length > 1) {
      const x = G.gens[c.army[c.army.length - 1]]; c.army = c.army.filter((id) => id !== x.id);
      const n = Math.round(c.troops * 0.25), all = Math.random() < 0.25, back = all ? (this.hurt(c, c.troops, '離間敵將'), true) : this.hurt(c, n, '離間敵將');
      bump(this.H, 'tacs');
      return ui.say('', `${b.name}的書信送到了${x.name}手裡……\n${x.name}對${lead.name}起了疑心，當晚就帶著部下 ${all ? '和一大半的人馬' : n + ' 人'}回去了。${back ? `\n${lead.name}只好撤軍！` : ''}`);
    }
    if (Math.random() < 0.4) { this.H.fame = Math.max(0, this.H.fame - 10); return ui.say(lead.name, `哼，這種離間計也想騙我？\n（計策被識破了。名聲 -10）`, g.lookOf(lead)); }
    return ui.say('', '書信送出去了，但他們好像沒有上當。');
  }
  async rumor(c, b, p) {
    const g = this.g, G = this.G, ui = g.ui, from = G.cities[c.from[0]];
    if (Math.random() < p) { const back = this.hurt(c, Math.round(c.troops * 0.1), '散布謠言'); if (!c.back) { g.camps.turnBack(c); deed(g, `散布謠言，${G.factions[c.fac].name}軍回師`); } return ui.say('', `「${from.name}被偷襲了！」的謠言在敵營裡傳開了。\n軍心大亂，${G.gens[c.army[0]].name}急忙撤軍回去救援！`); }
    return ui.say('', '謠言傳開了，但敵軍的主將並不相信。');
  }
}
