// 艱辛: what the road costs. The difficulty chosen at the start (輕鬆 / 標準 / 亂世) and 鐵人 (one save, written by
// itself: a battle left half-way counts as lost); rations (H.food, in man-days: a day on the land eats one for each
// member of the party; without them men desert every day, unless a 兵糧 is opened); fatigue (H.fatigue 0-100: every day
// on the land tires the party, the more on snow, sand or with an empty belly; a tired party fights worse; a night in an
// inn or a camp on the road takes it off — a camp at night may be raided); and companions who fall in battle: a
// routed companion may be wounded for a while or, rarely, killed; a close one throws himself in front of a blow meant
// for the player; a retreat can be covered by one who stays behind, at his own risk.
import { die } from './sim/engine.js';
import { T, regionAt } from './world.js';
import { bondOf, addBond, mourn } from './bonds.js';
import { priceMul } from './disaster.js';
import { deed } from './deeds.js';

export const DIFF = {
  easy: { n: '輕鬆', d: '敵人弱一點、錢多一點、糧食吃得少，同伴只會受傷不會戰死', lv: -2, enc: 0.8, gold: 1.3, food: 0.5, tire: 0.6, fall: 0, susp: 0.6, nem: 0.8, foeK: 0.95 },
  normal: { n: '標準', d: '原本的難度', lv: 0, enc: 1, gold: 1, food: 1, tire: 1, fall: 1, susp: 1, nem: 1, foeK: 1 },
  hard: { n: '亂世', d: '敵人更強更多、錢更少、糧食吃得兇，同伴戰死的機會更高，君主更多疑，宿敵更難纏', lv: 3, enc: 1.2, gold: 0.8, food: 1.3, tire: 1.3, fall: 2, susp: 1.4, nem: 1.3, foeK: 1.1 },
};
export const diff = (game) => DIFF[game.H?.diff] || DIFF.normal;
const PRICE = 2, MAXD = 40;
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Hardship {
  constructor(game) { this.g = game; }
  get H() { return this.g.H; } get G() { return this.g.G; }
  // ---------------------------------------------------------------- rations
  need() { return (1 + this.H.party.length) * diff(this.g).food; }
  days() { return Math.floor((this.H.food ?? 0) / this.need()); }
  cap() { return Math.round(MAXD * this.need()); }
  // what a man-day costs here: free to a lord in his own city, half to an officer of the house
  price(C) {
    const g = this.g, own = C && C.id >= 0 && C.owner && C.owner === g.myFaction();
    if (own && g.isLord()) return 0; return PRICE * priceMul(g, C && C.id >= 0 ? C.id : null) * (own ? 0.5 : 1);
  }
  buyN(C, n) { const H = this.H, p = this.price(C), k = Math.max(0, Math.min(n, this.cap() - (H.food || 0), p ? Math.floor(H.gold / p) : Infinity)); H.food = (H.food || 0) + k; H.gold -= Math.ceil(k * p); return k; }
  async buy(C) {
    const ui = this.g.ui;
    for (;;) {
      const p = this.price(C), d = this.need(), left = this.days(), room = this.cap() - (this.H.food || 0), ten = Math.ceil(10 * d * p), full = Math.ceil(room * p);
      const c = await ui.choose([{ k: 10, n: `買十天份　${ten ? ten + ' 金' : '免費'}`, off: room < 1 || this.H.gold < ten }, { k: 'full', n: `買到滿（${MAXD} 天）　${full ? full + ' 金' : '免費'}`, off: room < 1 || (p && this.H.gold < Math.ceil(d * p)) }, { k: null, n: '返回' }], { title: `乾糧　還剩 ${left} 天份　金 ${this.H.gold}`, q: `隊伍 ${1 + this.H.party.length} 人，一天吃 ${Math.round(d * 10) / 10} 份。在野外沒有糧食，每天都會有人逃走。` });
      if (c == null) return; this.buyN(C, c === 'full' ? room : Math.round(10 * d)); this.g.audio.sfx('coin'); this.g.hud();
    }
  }
  // the computer player keeps itself fed
  restock(C) { if (this.days() < 25) this.buyN(C, this.cap()); }
  // ---------------------------------------------------------------- a day goes by
  // on the land: a day's rations eaten, and the road tires
  dayOut() {
    const H = this.H, g = this.g, D = diff(g), k = g.world?.at(g.pos.x, g.pos.z), need = this.need(); H.food ??= 20 * need;
    let starving = false;
    if (H.food >= need) H.food -= need;
    else if ((H.items.rice || 0) > 0) { H.items.rice--; H.food += Math.round(12 * need) - need; g.ui.toast('乾糧吃完了，打開了一袋兵糧（十二天份）。', 3500); }
    else { starving = true; H.food = 0; this.desert(); }
    const hard = k === T.SNOW || k === T.DESERT || k === T.MOUNT || k === T.HILL || k === T.MARSH;
    H.fatigue = Math.min(100, (H.fatigue || 0) + (2.5 + (hard ? 2 : 0) + (starving ? 3 : 0) + (g.wx() ? 1 : 0)) * D.tire);
    const left = this.days(); if (!starving && (left === 5 || left === 2)) g.ui.toast(`<b style="color:#ffb06a">乾糧只剩 ${left} 天份了！</b>　進城去道具店或客棧補給。`, 4000);
    if (H.fatigue >= 70 && !this.warnT) { this.warnT = 1; g.ui.toast('<b style="color:#ffb06a">隊伍精疲力竭了。</b>　找間客棧休息，或在路上紮營（選單）。', 4000); } if (H.fatigue < 60) this.warnT = 0;
  }
  // without food men slip away in the night
  desert() {
    const g = this.g, out = []; for (const p of g.partyList()) { const n = Math.min(p.rec.sol - 1, Math.round(p.solMax * 0.07)); if (n > 0) { p.rec.sol -= n; out.push(n); } }
    const n = out.reduce((a, b) => a + b, 0); g.ui.toast(`<b style="color:#ff8a6a">斷糧了！</b>　一夜之間逃走了 ${n} 名士兵。`, 3500);
  }
  // in a town: a day's rest
  dayIn(n = 1) { this.H.fatigue = Math.max(0, (this.H.fatigue || 0) - 20 * n); }
  rest() { this.H.fatigue = 0; }
  // ---------------------------------------------------------------- a camp on the road: half a day, a day's food
  async camp() {
    const g = this.g, H = this.H, ui = g.ui, need = this.need();
    if (g.mode !== 'world') return;
    const night = g.night(), c = await ui.choose([{ k: 'camp', n: '紮營休息（半天）', d: `消耗一天份乾糧，疲勞大減，兵力回復一成。${night ? '夜裡紮營可能被賊人偷襲。' : ''}`, off: (H.food || 0) < need }, { k: null, n: '返回' }], { title: `紮營　乾糧 ${this.days()} 天份　疲勞 ${Math.round(H.fatigue || 0)}` });
    if (c !== 'camp') return;
    H.food -= need; H.fatigue = Math.max(0, (H.fatigue || 0) - 45);
    for (const p of g.partyList()) { p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * 0.1)); p.rec.sp = Math.min(p.spMax, p.rec.sp + Math.round(p.spMax * 0.3)); }
    await ui.fade(1, 300); this.pass(15); await ui.fade(0, 300);
    if (night && Math.random() < 0.25 && g.mode === 'world') { ui.toast('<b style="color:#ff8a6a">夜裡有賊人摸進了營地！</b>', 3000); await g.act.encounter(regionAt(g.pos.x, g.pos.z), g.world.at(g.pos.x, g.pos.z)); return; }
    ui.toast('紮營休息了半天，大家恢復了精神。', 3000); g.hud();
  }
  // steps of time on the land without walking them (the days, the months)
  pass(n) {
    const g = this.g, H = this.H; g.roam.step(n); g.crowd.step(n);
    for (let i = 0; i < n; i++) { H.walk = (H.walk || 0) + 1; if (H.walk % 30 === 0) { H.days++; if (H.days % 30 === 0) { g.monthTick(); if (g.mode === 'title') return; } } }
    g.hud();
  }
  // ---------------------------------------------------------------- in battle
  // a tired party: { atk, dmg (taken), line }
  battle() {
    const t = this.H?.fatigue || 0; if (t >= 70) return { atk: 0.82, dmg: 1.15, line: '隊伍精疲力竭（攻擊、防禦大幅下降）' };
    if (t >= 40) return { atk: 0.92, dmg: 1.06, line: '隊伍有些疲憊（攻擊、防禦下降）' }; return null;
  }
  // after the battle: the fallen companions, and the one who stayed behind to cover the retreat
  async after(out, o) {
    const g = this.g, G = this.G, H = this.H, D = diff(g), lines = []; if (o.drill || !out.party) return;
    for (const u of out.party) {
      if (u.isPlayer || u.sol > 0 || u.guest) continue; const x = u.g, by = u.routedBy?.gid != null ? G.gens[u.routedBy.gid] : null;
      const pDie = D.fall * (out.result === 'lose' ? 0.06 : 0.025) * (H.rec[x.id]?.hurt > G.t ? 2 : 1);
      if (Math.random() < pDie) { await this.fall(x, by, `${x.name}在亂軍之中戰死了`); continue; }
      if (Math.random() < 0.35) { H.rec[x.id].hurt = G.t + 2; lines.push(`${x.name}身負重傷（兩個月內攻擊、防禦下降）`); }
    }
    const rg = this.rear; this.rear = null;
    if (rg != null && H.party.includes(rg)) {
      const x = G.gens[rg], r = Math.random() + (x.war + x.lead - 150) / 200;
      if (r > 0.55) { H.rec[x.id].sol = Math.max(1, Math.round(H.rec[x.id].sol * 0.5)); lines.push(`${x.name}斷後殺退了追兵，平安歸隊！`); addBond(g, x.id, 8); }
      else if (r > 0.2) { H.rec[x.id].hurt = G.t + 2; H.rec[x.id].sol = 1; lines.push(`${x.name}斷後時受了重傷，總算逃了回來`); }
      else if (Math.random() < 0.5 * Math.max(0.5, D.fall)) await this.fall(x, null, `${x.name}為了掩護大家撤退，力戰而死`);
      else if (H.saga && x.hidden) { H.rec[x.id].hurt = G.t + 2; H.rec[x.id].sol = 1; lines.push(`${x.name}斷後時受了重傷，總算逃了回來`); }
      else { H.party = H.party.filter((i) => i !== x.id); x.follow = null; if (x.status === 'serving') { x.status = 'free'; x.fac = null; } g.respawnParty(); lines.push(`${x.name}斷後時被敵軍衝散，下落不明`); }
    }
    if (lines.length) await g.ui.say('', lines.join('\n'));
  }
  async fall(x, by, text) {
    if (this.H.saga && x.hidden) { this.H.rec[x.id].hurt = this.G.t + 2; await this.g.ui.say('', `${x.name}傷得很重，被家人拚命救了回來（兩個月內攻擊、防禦下降）`); return; }   // the family of the story never die (saga.js)
    const g = this.g, G = this.G, H = this.H;
    H.party = H.party.filter((i) => i !== x.id); x.follow = null; die(G, x, 'battle', by || undefined); g.respawnParty();
    deed(g, `${x.name}戰歿`, false);
    await g.ui.say('', `${text}……\n${g.me.name}抱著他的屍首，久久說不出話來。${bondOf(H, x.id) >= 60 ? `\n「${x.name}！是我害了你……」` : ''}`);
    if ((H.sworn || []).includes(x.id)) await mourn(g);
  }
  // the hurt: weaker for a while
  hurt(id) { return (this.H?.rec[id]?.hurt || 0) > (this.G?.t ?? 0); }
  // ---------------------------------------------------------------- 鐵人: the one save is written by itself
  iron() { return !!this.H?.iron; }
  save() { if (this.iron()) this.g.saveGame(); }
  battleStart(foes) { if (!this.iron()) return; this.H.inBattle = foes.map((f) => f.name).slice(0, 3).join('、'); this.g.saveGame(); }
  battleEnd() { if (!this.iron()) return; this.H.inBattle = null; this.g.saveGame(); }
  // loaded in the middle of a battle: it was lost
  async loaded() { const H = this.H; if (!H.inBattle) return; const who = H.inBattle; H.inBattle = null; await this.g.ui.say('', `（鐵人模式：上次和${who}的戰鬥沒有打完就離開了，視為戰敗。）`); await this.g.act.defeat(); this.g.saveGame(); }
}
