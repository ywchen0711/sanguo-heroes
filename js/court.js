// 功高震主: serving a lord, the player's renown, rank and deeds can grow too big for him. Each month his suspicion
// (H.susp, 0-100) rises with the player's fame, rank, the cities he governs and the men he leads, the faster the less
// generous the lord (his 魅力) and the higher the difficulty; it falls while the player keeps his head down. As it
// rises: whispers at court (a warning); then the lord takes away part of his command (fewer soldiers for a while);
// then he sends him where he means him to die (a battle against the odds); at the last he orders his arrest — submit
// (stripped of rank, sent away), flee (free, and hunted), or rise in revolt in the city he governs. At any time the
// player can show his loyalty (gifts to the lord, a word with his favourites, or refusing a reward); 太守府 has it.
import { citiesOf, serve, record } from './sim/engine.js';
import { rankOf } from './hero.js';
import { diff } from './hardship.js';
import { deed } from './deeds.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Court {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; }
  on() { const g = this.g; return g.me.status === 'serving' && !g.isLord() && !!g.G.factions[g.me.fac]; }
  lord() { return this.G.gens[this.G.factions[this.g.me.fac].lord]; }
  curbed() { return (this.H.curb || 0) > (this.G?.t ?? 0); }
  // the month: how much more he fears the player
  month() {
    const H = this.H, G = this.G, g = this.g; if (!this.on()) { H.susp = 0; return; }
    const L = this.lord(), me = g.me, rk = rankOf(me.merit), gov = H.gov ? 1 : 0;
    const weight = Math.max(0, (H.fame - 250) / 120) + rk * 0.5 + gov * 2 + H.party.length * 0.4 + (me.cha > L.cha + 10 ? 1.5 : 0) + (me.lead > L.lead + 10 ? 1 : 0);
    const temper = Math.max(0.3, 1.35 - L.cha / 100) * (['曹操', '袁紹', '董卓', '孫權', '袁術', '司馬懿', '劉表'].includes(L.name) ? 1.3 : 1);
    const quiet = H.quietT > G.t ? 0.4 : 1;
    H.susp = Math.max(0, Math.min(100, (H.susp || 0) + weight * temper * diff(g).susp * quiet - 2));
    const s = H.susp, st = H.suspSt || 0;
    if (s >= 90 && st < 4) H.courtDue = 4; else if (s >= 75 && st < 3) H.courtDue = 3; else if (s >= 60 && st < 2) H.courtDue = 2; else if (s >= 40 && st < 1) H.courtDue = 1;
    if (s < 30) H.suspSt = 0;
  }
  // what the lord does about it (when the month's news comes in)
  async check() {
    const H = this.H, n = H.courtDue; if (!n || !this.on()) { H.courtDue = null; return false; } H.courtDue = null; H.suspSt = n;
    const g = this.g, ui = g.ui, L = this.lord(), look = g.lookOf(L), f = this.G.factions[g.me.fac];
    if (n === 1) { await ui.say('同僚', pick([`${g.me.name}，主公身邊有人在說你的閒話……說你名聲太大，手下的人只知有你，不知有主公。\n小心一點吧。`, `最近朝中有人上書，說${g.me.name}擁兵自重。主公沒說什麼，可臉色不太好看。`]), null); ui.toast('<b style="color:#ffb06a">主公開始猜忌你了。</b>　可以在太守府「表忠心」。', 4500); return true; }
    if (n === 2) { H.curb = this.G.t + 3; await ui.say(L.name, `${g.me.name}，你最近辛苦了。你帶的兵，我先調一部分去別處用吧。`, look); ui.toast('<b style="color:#ff8a6a">兵權被削了！</b>　三個月內，隊伍的兵力上限少了兩成五。', 5000); g.hud(); return true; }
    if (n === 3) return this.deadly(L, look, f);
    return this.arrest(L, look, f);
  }
  // sent to die: a battle against far more than the party
  async deadly(L, look, f) {
    const g = this.g, ui = g.ui, H = this.H;
    await ui.say(L.name, `${g.me.name}，前線告急。我要你帶本部人馬，去攔住敵軍的主力。\n……援軍？援軍隨後就到。`, look);
    const c = await ui.ask('這分明是要你去送死。', [{ k: 'go', n: '領命出征', d: '打贏了，猜忌大減，功績大增' }, { k: 'no', n: '稱病推辭', d: '猜忌更深' }], L.name, look);
    if (c !== 'go') { H.susp = Math.min(100, H.susp + 15); await ui.say(L.name, '哼，好一個病得正是時候。', look); return true; }
    const lv = g.act.foeLv() + 5, col = '#6a6a6a', foes = [g.act.foe('敵軍大將', 'soldier', lv + 2, col, true), ...Array.from({ length: Math.min(4, H.party.length + 3) }, () => g.act.foe('敵軍精兵', 'soldier', lv, col))];
    const r = await g.act.fight(foes, { terrain: g.mode === 'world' ? g.act.terrainAt() : 'plain', title: '孤軍迎敵！援軍沒有來……', noFlee: false });
    if (r === 'win') { H.susp = Math.max(0, H.susp - 35); H.suspSt = 1; g.me.merit += 40; g.act.promote(); H.fame += 40; deed(g, '孤軍破敵'); await ui.say(L.name, `……你竟然活著回來了。好，好。這一仗，你立了大功。`, look); }
    return true;
  }
  // the last: an order for the player's arrest
  async arrest(L, look, f) {
    const g = this.g, ui = g.ui, H = this.H, G = this.G, me = g.me, C = H.gov && G.cities[H.gov.cid];
    const canRise = !!C && C.owner === f.id && C.id !== f.capital && citiesOf(G, f.id).length > 1;
    await ui.say('', `深夜，一個老部下偷偷跑來：\n「將軍快走！${L.name}已經下令，明天一早就要拿你問罪！」`);
    const c = await ui.ask('怎麼辦？', [{ k: 'give', n: '束手就擒', d: '交出官職和兵權，被趕出去，但保住性命' }, { k: 'run', n: '連夜逃走', d: '成為在野之身，被懸賞通緝' }, ...(canRise ? [{ k: 'rise', n: `在${C.name}起兵`, d: '帶著這座城自立為王，和舊主為敵' }] : [])]);
    H.susp = 0; H.suspSt = 0; H.curb = 0;
    const leave = () => { me.status = 'free'; me.fac = null; me.merit = Math.round(me.merit * 0.3); H.gov = null; for (const id of H.party) { const x = G.gens[id]; if (x.status === 'serving' && x.fac === f.id) { x.status = 'free'; x.fac = null; } } };
    if (c === 'give') { leave(); H.fame = Math.max(0, H.fame - 30); deed(g, `為${f.name}所猜忌，罷官而去`); await ui.say(L.name, `念你過去有些功勞，饒你一命。走吧，永遠別回來。`, look); g.hud(); return true; }
    if (c === 'run') { leave(); H.wanted = (H.wanted || 0) + 40; f.rel ||= {}; deed(g, `遭${f.name}追捕，亡命天涯`); ui.toast(`<b style="color:#ff8a6a">你逃出了${f.name}的地盤，成了通緝犯。</b>`, 5000); g.hud(); return true; }
    // a revolt: the city goes with the player
    me.status = 'free'; me.fac = null; H.gov = null;
    const id = g.act.found(C); C.owner = id; C.gov = me.id; G.factions[id].rel[f.id] = f.rel[id] = -100;
    // the old master's officers in the city go home to him
    const home = citiesOf(G, f.id).find((c) => c.id !== C.id); for (const x of G.gens) if (x.status === 'serving' && x.fac === f.id && x.city === C.id) { if (home) x.city = home.id; else { x.status = 'free'; x.fac = null; } }
    record(G, 'rise', 'revolt', { g: me.name, f: f.name, c: C.name }, id, 3, { g: me.id });
    await ui.say('', `${me.name}在${C.name}舉起了反旗！\n「${L.name}容不下我，我就自己打出一片天下！」`);
    g.refreshCities?.(); g.hud(); return true;
  }
  // 表忠心: in the lord's hall
  async loyal() {
    const g = this.g, ui = g.ui, H = this.H, L = this.lord(), look = g.lookOf(L), gift = Math.max(200, Math.round(H.fame * 0.6));
    const c = await ui.choose([{ k: 'gift', n: `向主公獻禮　${gift} 金`, d: '猜忌下降很多', off: H.gold < gift }, { k: 'friend', n: `結交主公身邊的近臣　${Math.round(gift / 2)} 金`, d: '猜忌下降一些（魅力越高越有效）', off: H.gold < gift / 2 }, { k: 'quiet', n: '韜光養晦', d: '辭掉下一次的賞賜，半年內猜忌漲得很慢' }, { k: null, n: '返回' }], { title: `表忠心　主公的猜忌 ${Math.round(H.susp || 0)}` });
    if (c === 'gift') { H.gold -= gift; H.susp = Math.max(0, H.susp - 30); await ui.say(L.name, '你有這份心，很好。', look); }
    if (c === 'friend') { H.gold -= Math.round(gift / 2); H.susp = Math.max(0, H.susp - 10 - Math.round(g.me.cha / 10)); await ui.say('近臣', `${g.me.name}將軍為人忠厚，我會在主公面前替你說話的。`); }
    if (c === 'quiet') { H.quietT = this.G.t + 6; g.me.merit = Math.max(0, g.me.merit - 10); H.susp = Math.max(0, H.susp - 8); await ui.say(L.name, '不要賞賜？……你倒是個知進退的人。', look); }
    g.hud();
  }
  line() { const s = Math.round(this.H.susp || 0); return !this.on() || s < 20 ? '' : `主公的猜忌：${s}${s >= 75 ? '（危險）' : s >= 40 ? '（注意）' : ''}`; }
}
