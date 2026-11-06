// What the player does: talking to people, the buildings of a town, serving a lord or leaving, domestic work, drafting
// soldiers, recruiting companions, missions, duels with generals, fights on the road, besieging and taking cities,
// founding a warlord's realm of one's own, and looking for the famous treasures.
import { lookFor, LOOKS } from './sprites.js';
import { CITY_POS, T, K } from './world.js';
import { BUILDINGS } from './town.js';
import { serve, die, record, pickGovernor, destroy, give, hostile, allied, citiesOf, gensOf, lordOf, busy, power, refresh } from './sim/engine.js';
import { itemName, spellName } from './sim/text.js';
import { SIEGE_RANK } from './data/ranks.js';
import { EQUIP, WEAPONS, ARMORS, HORSES, ITEMS, RANKS, rankOf, newRec, solMax, spMax, bstats, gainExp, startLv, STAT_N, expNeed, shopItems, usable, FORGE, forgeOf, eqName, TROOPS, hasHorse } from './hero.js';
import { deed, bump, hasT, checkTitles, knownAs, TITLES } from './deeds.js';
import { itemOf, isRelic, relicFx, partyFx, rollRelic, giveRelic, jackpot, tryUlt, relicExp, powerLines as powerLinesOf, RELICS, PRICE, GRADE_N, GRADE_C, SLOT_N } from './relics.js';
import { equipScreen } from './equip.js';
import { addBond, offerOaths, versus, drink, isSworn, isRival, bondOf, bondsHTML } from './bonds.js';
import { mark, dexScreen, traitDex, traitCard } from './dex.js';
import { TYPE_N } from './sim/life.js';
import { PERKS, perkText } from './hero.js';
import { meetSage, sageOpts, sageGen, sageRumor } from './sages.js';
import { priceMul, garrisonMul, disasterAt, DIS_N } from './disaster.js';
import { tire, tired, eraBonus } from './board.js';
import { fameOf, fameName } from './fame.js';
import { beat, rankOf as listRank, rankHTML } from './martial.js';
import { diff } from './hardship.js';
import { jobMenu, governor, canGovern, cityLine } from './govern.js';
import { bLv } from './sim/build.js';
import { awaken, traitsOf, traitHTML, combosWith, TRAIT, reroll } from './traits.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const SUR = '張王李趙陳劉楊黃周吳徐孫馬朱胡郭何高林羅鄭梁謝宋唐許韓馮鄧曹彭曾蕭田董袁潘蔣蔡余杜葉程魏蘇呂丁任沈姚盧姜崔鍾譚陸汪范金石廖賈夏韋付方白鄒孟熊秦邱江尹薛閻段雷侯龍史陶黎賀顧毛郝龔邵萬錢嚴覃武戴莫孔向湯';
const GIV = '大二三虎豹龍蛟熊狼彪猛霸彪雄武勇猛剛強';
const FOES = {
  central: [['山賊', 'bandit'], ['黃巾餘黨', 'turban'], ['野狼', 'wolf'], ['流寇', 'bandit']],
  north: [['烏桓騎兵', 'nomad'], ['山賊', 'bandit'], ['野狼', 'wolf'], ['黑山賊', 'bandit']],
  west: [['羌族騎兵', 'nomad'], ['山賊', 'bandit'], ['棕熊', 'bear'], ['氐族兵', 'nomad']],
  south: [['南蠻兵', 'barbarian'], ['猛虎', 'tiger'], ['山豬', 'boar'], ['山越賊', 'barbarian']],
  coast: [['海賊', 'pirate'], ['山賊', 'bandit'], ['錦帆賊', 'pirate']],
};
const BEASTS = ['wolf', 'tiger', 'bear', 'boar', 'bat', 'snake', 'whitetiger'];

export class Actions {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; } get ui() { return this.g.ui; } get me() { return this.g.me; }
  // ---------------------------------------------------------------- the opening
  async intro() {
    const G = this.G, g = this.me, f = this.g.myFaction() && G.factions[this.g.myFaction()], look = this.g.lookOf(g);
    const where = G.cities[g.city].name;
    let text = `${G.year}年，天下大亂。\n我是${g.name}，此刻身在${where}。`;
    if (this.g.isLord()) text += `\n我是${f.name}軍之主。統領群臣，一統天下吧！`;
    else if (f) text += `\n我效力於${f.name}軍。立下戰功，步步高升，輔佐主公平定天下。`;
    else text += '\n我是在野之身。可以投靠明主，也可以聚集豪傑，自立為王。';
    text += `\n\n距離結束還有 ${this.H.years} 年。`;
    await this.ui.say(g.name, text, look);
    await this.ui.say('', '【操作】方向鍵移動，Z 確認／對話，X 取消，C 打開選單。\n走到門前就能進入建築。和城裡的武將對話，可以招募、切磋或挑戰。\n在大地圖上走十步是一天，三十天就是一個月，天下也會跟著變化。');
  }
  // ---------------------------------------------------------------- counties, villages and caves
  async placeGate(q) {
    await this.g.stories.arrive(q);   // a companion's lost kin, or his old master (stories.js)
    if (q.kind === 'cave') {
      const st = this.H.places?.[q.id];
      const c = await this.ui.ask(`${q.name}　危險 ${'★'.repeat(q.tier)}${st?.boss ? '（洞主已被打倒）' : ''}\n${q.deep ? '地面裂開一個大洞，石階一路往下，看不到底。陰風陣陣，像是有人在下面哭……' : '洞裡黑漆漆的，深處傳來奇怪的聲音……'}${q.tier >= 4 ? '\n（非常危險：建議隊伍等級 ' + (6 + q.tier * 4) + ' 以上）' : ''}`, [{ k: true, n: '進去探險' }, { k: false, n: '離開' }]);
      if (!c) { this.stepOff(q); return; }
    }
    if (q.kind === 'village' && this.g.outlaws.raided(q) && !(await this.g.outlaws.village(q))) { this.stepOff(q); return; }
    await this.ui.fade(1, 200); this.g.enterPlace(q); await this.ui.fade(0, 200);
  }
  stepOff(q) { const P = this.g.pos; [P.x, P.z] = this.g.landNear(q.x, q.y + 1, q.x, q.y); this.g.tiles = this.g.tiles.map(() => [P.x, P.z]); this.g.prevTiles = null; this.g.place(1); this.g.camTo(P.x, P.z, true); }
  // the master of a cave, the same every time: a bandit king, a great beast, or a sorcerer
  caveBoss(q) {
    const lv = this.avgLv() + q.tier * 2 + 1, k = (q.id * 7 + q.x) % 6;
    const kinds = [['山大王', 'bandit'], ['黑熊精', 'bear'], ['白額虎', 'whitetiger'], ['妖道', 'turban'], ['巨蟒', 'snake'], ['蝠王', 'bat']];
    const deepN = q.deep ? ['地底魔王', '熊魔', '赤焰魔虎', '鬼王', '九頭蛇王', '血蝠老祖'] : ['綠林魔王', '熊王', '虎王', '天師', '蛇王', '蝠王老祖'];
    const [name0, kind] = kinds[k], name = q.tier >= 4 ? deepN[k] : name0, u = this.foe(name, kind, lv, null, true);
    u.solMax = u.sol = Math.round(u.solMax * (1.2 + q.tier * 0.35));
    if (kind === 'turban') { u.look = LOOKS.turbanBoss(); u.int = Math.min(98, 60 + q.tier * 10); u.spells = ['lei', 'yao']; u.sp = 80 + q.tier * 10; }
    if (q.tier >= 4) { u.war = Math.min(110, u.war + (q.tier - 3) * 8); u.lead = Math.min(110, u.lead + (q.tier - 3) * 6); }
    return u;
  }
  avgLv() { const l = this.g.partyList(); return Math.round(l.reduce((t, p) => t + p.rec.lv, 0) / l.length); }
  caveFoes(q) {
    const lv = this.avgLv() + q.tier - 2, pool = [['蝙蝠', 'bat'], ['蝙蝠', 'bat'], ['毒蛇', 'snake'], ['野狼', 'wolf'], ['棕熊', 'bear'], ['山賊', 'bandit']];
    const n = 1 + Math.floor(Math.random() * Math.min(4, this.H.party.length + 2)), [name, kind] = pick(pool);
    return Array.from({ length: n }, () => this.foe(name, kind, Math.max(1, lv + Math.round(Math.random() * 2 - 1))));
  }
  async caveFight(q) { this.g.audio.sfx('encounter'); await this.fight(this.caveFoes(q), { terrain: 'cave' }); }
  // a chest or a strange thing in a cave
  async caveThing(th) {
    const M = this.g.town, q = M.place, st = this.H.places[q.id], c = this.g.events.ctx('t');
    if (th.i != null) { // a chest
      if (st.chests.includes(th.i)) { await this.ui.say('', '寶箱已經空了。'); return; }
      st.chests.push(th.i); const pr = this.g.view.M.props.find((p) => p.kind === 'chest' && p.chest === th.i); if (pr?.obj?.userData.lid) this.g.battle.ensureView && this.lidOpen(pr.obj.userData.lid);
      this.g.audio.sfx('coin');
      // now and then a famous treasure hidden near here
      const hid = this.G.items.filter((it) => it.city === q.near);
      if (hid.length && Math.random() < (hasT(this.H, 'tanxian') ? 0.55 : 0.35)) { const it = pick(hid); give(this.G, it, this.me); this.H.fame += 40; record(this.G, 'item', 'itemFind', { g: this.me.name, c: q.name, it: it.key }, this.g.myFaction(), 2, { g: this.me.id }); await this.ui.say('', `寶箱裡竟然是傳說中的「${itemName(it.key)}」！\n${Object.entries(it.fx).map(([k, v]) => `${STAT_N[k]} +${v}`).join('　')}`); return; }
      const t = q.tier, opts = [`item:ore*${1 + rint(0, t)}`, `gold+${30 + t * 30} item:ore${t >= 3 ? ' item:ore2' : ''}`, `gold+${60 + t * 70 + rint(0, 60)}`, `gold+${40 + t * 40} item:med2`, `item:med*2 item:book`, `eq:w${Math.min(7, 2 + t + rint(0, 1))}`, `eq:a${Math.min(7, 2 + t + rint(0, 1))}`, `gold+${30 + t * 30} item:rice item:wine`];
      const notes = await this.g.events.effects(pick(opts).split(' '), c, {});
      const ult = tryUlt(this.g, 'chest'); if (ult) notes.push(`★★ 神器「${RELICS[ult].n}」`);
      else if (Math.random() < (0.02 + q.tier * 0.01) / 5) { const id = jackpot(this.g); notes.push(`★「${RELICS[id].n}」（${GRADE_N[RELICS[id].grade]}）`); }
      else if (Math.random() < 0.4 + (q.tier >= 4 ? 0.15 : 0)) { const id = rollRelic(this.avgLv(), Math.min(4, q.tier)); giveRelic(this.g, id, true); notes.push(`寶物「${RELICS[id].n}」（${GRADE_N[RELICS[id].grade]}）`); }
      await this.ui.say('', '打開了寶箱！\n' + notes.join('　')); this.g.hud(); return;
    }
    const i = M.odd.indexOf(th); await this.caveOdd(th.kind, i, st, q, c);
  }
  lidOpen(lid) { let k = 0; const f = () => { k++; lid.rotation.x = -1.9 * Math.min(1, k / 14); if (k < 14) requestAnimationFrame(f); }; requestAnimationFrame(f); }
  async caveOdd(kind, i, st, q, c) {
    if (st.odd.includes(i)) { await this.ui.say('', { stele: '石碑上的字已經看熟了。', spring: '泉水已經不再發光了。', bones: '只剩下一堆白骨。', shrine: '小祠裡的燈已經熄了。', hermit: '隱士已經離開了。' }[kind]); return; }
    const me = this.me, fx = async (toks, text, who, look) => { st.odd.push(i); const notes = await this.g.events.effects(toks.split(' ').filter(Boolean), c, {}); await this.ui.say(who || '', [text, notes.join('　')].filter(Boolean).join('\n'), look); this.g.hud(); };
    if (kind === 'stele') {
      const learnable = ['dun', 'huan', 'feng', 'zhi', 'zhen', 'yao', 'lei'].filter((x) => !me.spells.includes(x));
      if (me.int >= 50 && learnable.length && Math.random() < 0.6) { const sp = pick(learnable); me.spells.push(sp); st.odd.push(i); deed(this.g, `於${q.name}讀古碑，悟${spellName(sp)}之術`); await this.ui.say('', `石碑上刻著古老的文字。你讀了一整夜，終於參透了其中的奧秘——\n學會了法術「${spellName(sp)}」！（戰鬥中的策略可以使用）`); this.g.audio.sfx('level'); return; }
      return fx('stat:int exp+40', '石碑上刻著一篇兵法。你仔細研讀，獲益良多。');
    }
    if (kind === 'spring') return fx('heal sp+40', '洞中有一眼發著微光的泉水。喝了一口，全身的傷痛都消失了。');
    if (kind === 'bones') return fx(`gold+${50 + q.tier * 40} hint:treasure`, '一具白骨靠在石壁上，手裡緊緊抓著一個錢袋和一封信。');
    if (kind === 'shrine') return fx('fame+15 stat:cha sp+20', '一座供奉山神的小祠。你恭敬地上了一炷香。');
    if (kind === 'hermit') {
      const look = LOOKS.villager('隱士' + q.name), stat = pick(['war', 'int', 'lead']);
      const ok = await this.ui.ask(`一位白髮蒼蒼的老人坐在石床上閉目養神。\n「年輕人，能走到這裡，也算有緣。想學點本事嗎？」`, [{ k: true, n: '拜師學藝（十天）' }, { k: false, n: '不打擾了' }], '隱士', look);
      if (!ok) return;
      await fx(`days+10 stat:${stat} stat:${stat} exp+${60 * q.tier}`, `老人傳授了你${STAT_N[stat]}上的心得。十天之後，你覺得自己脫胎換骨了。`, '隱士', look);
      const n = this.g.npcs.find((x) => x.odd === i); if (n) { this.g.view.removeActor(n.a); this.g.npcs = this.g.npcs.filter((x) => x !== n); }
    }
  }
  // the people who live in villages and counties, and the master of a cave
  async special(n) {
    const C = this.g.town?.C, q = this.g.town?.place, look = n.look;
    if (n.special === 'odd') return this.caveOdd('hermit', n.odd, this.H.places[q.id], q, this.g.events.ctx('t'));
    if (n.special === 'sage') return meetSage(this.g, n.sage);
    if (n.special === 'boss') {
      const B = n.boss;
      await this.ui.say(B.name, pick(['什麼人敢闖進我的地盤？', '又有送死的來了！', '這洞裡的寶貝，全都是我的！', '哈哈哈，好久沒有開葷了！']), B.look);
      const r = await this.fight([B, ...this.caveFoes(q).slice(0, q.tier >= 4 ? 3 : 2)], { terrain: 'cave', title: `${B.name}現身了！`, noFlee: false });
      if (r !== 'win') return;
      this.H.places[q.id].boss = true; this.g.view.removeActor(n.a); this.g.npcs = this.g.npcs.filter((x) => x !== n);
      const t = q.tier, notes = await this.g.events.effects([`gold+${150 + t * 150}`, `fame+${30 + t * 25}`, `eq:${pick(['w', 'a'])}${Math.min(7, 3 + t)}`, ...(t >= 2 ? ['eq:h' + (t >= 3 ? 3 : 2), 'item:ore2'] : ['item:ore*2'])], this.g.events.ctx('t'), {});
      bump(this.H, 'caves'); deed(this.g, `入${q.name}，誅${B.name}`); for (const id of this.H.party) addBond(this.g, id, 5); checkTitles(this.g);
      if (this.me.status === 'serving') { this.me.merit += 10 * t; this.promote(); }
      this.H.st.missions++;
      if (Math.random() < 0.12 + q.tier * 0.04) { this.H.items.xisui = (this.H.items.xisui || 0) + 1; notes.push('洗髓丹'); }
      const ult = tryUlt(this.g, 'boss'); if (ult) notes.push(`★★ 神器「${RELICS[ult].n}」`);
      if (Math.random() < (0.08 + q.tier * 0.04) / 5) { const id = jackpot(this.g); notes.push(`★「${RELICS[id].n}」（${GRADE_N[RELICS[id].grade]}）`); }
      else { const id = rollRelic(this.avgLv() + 4, Math.min(5, q.tier >= 4 ? q.tier : q.tier + 1)); giveRelic(this.g, id, true); notes.push(`寶物「${RELICS[id].n}」（${GRADE_N[RELICS[id].grade]}）`); }
      await this.ui.say('', `打倒了${q.name}的${B.name}！\n${notes.join('　')}`); this.g.hud(); return;
    }
    if (n.special === 'elder') {
      if (await this.g.events.maybe('t', 0.5, n)) return;
      const cave = this.g.world.places.filter((p) => p.kind === 'cave' && !this.H.places?.[p.id]?.boss).sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y))[0];
      const c = await this.ui.ask(`我是${q.name}的村長。小地方，難得有英雄路過。`, [{ k: 'cave', n: '附近有什麼地方可以探險？' }, { k: 'mission', n: '村子有什麼困難嗎？' }, { k: 'rest', n: '在村子裡歇歇腳（一天）' }, { k: null, n: '告辭' }], '村長', look);
      if (c === 'cave') await this.ui.say('村長', cave ? `往${this.dirTo(q, cave)}走大約 ${Math.round(Math.hypot(cave.x - q.x, cave.y - q.y))} 里，有一個叫「${cave.name}」的洞穴（危險 ${'★'.repeat(cave.tier)}）。聽說裡面有寶貝，也有吃人的東西。` : '附近的洞穴都被英雄們平定了。', look);
      if (c === 'mission') await this.missionOffer(C, null);
      if (c === 'rest') { for (const p of this.g.partyList()) p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * 0.15)); await this.passDays(1, '村民們熱情地招待了你們。'); }
      return;
    }
    if (n.special === 'magistrate') {
      if (await this.g.events.maybe('t', 0.35, n)) return;
      const mine = this.g.myFaction(), own = mine && C.owner === mine;
      const c = await this.ui.ask(`本官是${q.name}的縣令。${own ? '將軍來巡視，有失遠迎。' : '有何貴幹？'}`, [{ k: 'mission', n: '縣裡有沒有盜匪需要討伐？' }, { k: 'news', n: '打聽消息' }, { k: 'donate', n: '捐錢修路（100 金）', off: this.H.gold < 100 }, { k: null, n: '告辭' }], '縣令', look);
      if (c === 'mission') await this.missionOffer(C, own ? this.G.factions[mine] : null);
      if (c === 'news') await this.rumor(C);
      if (c === 'donate') { this.H.gold -= 100; this.H.fame += 20; if (own) { this.me.merit += 3; this.promote(); } await this.ui.say('縣令', '將軍高義！縣裡的百姓都會記得您的恩情。', look); }
    }
  }
  dirTo(a, b) { const dx = b.x - a.x, dz = b.y - a.y; return (Math.abs(dz) > Math.abs(dx) / 2 ? (dz < 0 ? '北' : '南') : '') + (Math.abs(dx) > Math.abs(dz) / 2 ? (dx < 0 ? '西' : '東') : ''); }
  // ---------------------------------------------------------------- the menu
  async menu() {
    if (this.ui.busy) return;
    const k = await this.ui.choose([{ k: 'status', n: '狀態' }, { k: 'party', n: '隊伍' }, { k: 'equip', n: '裝備', sub: (this.H.bag || []).length || '' }, { k: 'items', n: '道具' }, { k: 'board', n: '情勢', d: '時局、機會（有期限）、民心', sub: (this.H.opps || []).filter((o) => !o.done && !o.missed).length || '' }, { k: 'missions', n: '任務', sub: this.H.missions.filter((m) => !m.done).length || '' }, { k: 'news', n: '年表' }, { k: 'realm', n: '天下' }, ...((this.G.rivals || []).length ? [{ k: 'rivals', n: '群雄榜', d: '你和電腦對手的排名' }, { k: 'martial', n: '武力榜', d: '天下最強的二十人' }] : []), { k: 'people', n: '人物', d: '稱號、結義兄弟、宿敵' }, { k: 'dex', n: '武將圖鑑', sub: Object.keys(this.H.dex || {}).length }, { k: 'tdex', n: '特性圖鑑', d: '特性、名組合、誰有哪個特性、神器錄' }, ...(this.g.mode === 'world' && this.g.ploys.near().length ? [{ k: 'ploy', n: '計略', d: '對附近的敵軍大軍施計：火攻、斷糧道、離間、散布謠言' }] : []), ...(this.g.mode === 'world' ? [{ k: 'camp', n: '紮營', d: `在路邊紮營休息半天（乾糧 ${this.g.hard.days()} 天份、疲勞 ${Math.round(this.H.fatigue || 0)}）` }] : []), { k: 'save', n: this.H.iron ? '存檔（鐵人：自動）' : '存檔' }, { k: 'auto', n: this.g.auto.on ? `電腦代玩：開（${this.g.auto.style.n}）` : '電腦代玩：關', d: '讓電腦替你玩，可以選方針：均衡、練功、打寶、積極攻城（P 鍵也可以切換，按方向鍵取回控制）' }, { k: 'end', n: '提前結算' }, { k: 'sound', n: `音樂 ${this.g.audio.on ? '開' : '關'}` }], { title: '選單', cls: 'main-menu' });
    if (k === 'status') await this.g.screens.status();
    if (k === 'party') await this.partyMenu();
    if (k === 'equip') await equipScreen(this.g);
    if (k === 'items') await this.useItems();
    if (k === 'board') await this.g.board.screen();
    if (k === 'missions') await this.g.screens.missions();
    if (k === 'news') await this.g.screens.news();
    if (k === 'realm') await this.g.screens.realm();
    if (k === 'rivals') await this.g.screens.rivals();
    if (k === 'martial') await this.ui.panel(rankHTML(this.g), { title: '天下武力排行榜', cls: 'wide' });
    if (k === 'people') await this.people();
    if (k === 'dex') await dexScreen(this.g);
    if (k === 'tdex') await traitDex(this.g);
    if (k === 'save') { if (this.H.iron) this.ui.toast('鐵人模式會自動存檔（離開城鎮、每場戰鬥、每個月）'); else this.g.saveGame() ? this.ui.toast('已存檔') : this.ui.toast('存檔失敗'); }
    if (k === 'camp') await this.g.hard.camp();
    if (k === 'ploy') await this.g.ploys.pickArmy();
    if (k === 'end' && await this.ui.yesno('要現在結束，結算功績嗎？')) this.g.screens.ending();
    if (k === 'sound') { this.g.audio.on = !this.g.audio.on; }
    if (k === 'auto') {
      const { STYLES } = await import('./auto.js'), cur = this.H.autoMode || 'balance';
      const m = await this.ui.choose([...Object.entries(STYLES).map(([id, s]) => ({ k: id, n: `${s.n}${this.g.auto.on && id === cur ? '（目前）' : ''}`, d: s.d })), ...(this.g.auto.on ? [{ k: 'off', n: '停止代玩' }] : [])], { title: '電腦代玩：方針' });
      if (m === 'off') this.g.auto.toggle(false); else if (m) this.g.auto.toggle(true, m);
    }
  }
  async people() {
    const H = this.H, ts = (H.titles || []).map((id) => TITLES.find((t) => t.id === id)).filter(Boolean);
    const next = TITLES.filter((t) => !(H.titles || []).includes(t.id) && !t.bad).slice(0, 6);
    await this.ui.panel(`<h4>稱號</h4>${ts.length ? ts.map((t) => `<p><b style="color:${t.bad ? '#ff8a6a' : '#ffd86a'}">「${t.n}」</b>　<small>${t.d}</small></p>`).join('') : '<p class="dim">還沒有稱號。</p>'}<p class="dim">還沒得到：${next.map((t) => t.n).join('、')}……</p>${this.g.court.line() ? `<p><b style="color:#ffb06a">${this.g.court.line()}</b>　<small>名聲、官職、當太守、帶的人越多，主公越不放心。可以在太守府表忠心。</small></p>` : ''}${bondsHTML(this.g)}${this.g.nemesis.html()}${this.g.stories.html()}`, { title: '人物', cls: 'wide' });
  }
  async partyMenu() {
    for (;;) {
      const list = this.g.partyList();
      const k = await this.ui.choose(list.map((p, i) => ({ k: i, n: `${p.g.name}　Lv${p.rec.lv}`, sub: `${TROOPS[this.troopOf(p)].n}　兵 ${p.rec.sol}/${p.solMax}`, d: `統${p.g.lead} 武${p.g.war} 智${p.g.int} 政${p.g.pol} 魅${p.g.cha}　策略 ${p.rec.sp}/${p.spMax}${i ? `　${isSworn(this.H, p.g.id) ? '結義兄弟' : `好感 ${bondOf(this.H, p.g.id)}`}` : ''}` })), { title: '隊伍' });
      if (k == null) return;
      const p = list[k];
      const c = await this.ui.choose([{ k: 'info', n: '詳細' }, { k: 'equip', n: '裝備' }, { k: 'troop', n: `兵種（${TROOPS[this.troopOf(p)].n}）` }, ...(k ? [{ k: 'leave', n: '離隊', off: isSworn(this.H, p.g.id), d: isSworn(this.H, p.g.id) ? '結義兄弟不會離開你' : '' }] : [])], { title: p.g.name, cls: 'small' });
      if (c === 'info') await this.g.screens.status(k ? p.g.id : undefined);
      if (c === 'equip') await equipScreen(this.g, k);
      if (c === 'troop') { const t = await this.ui.choose(Object.entries(TROOPS).map(([id, T]) => ({ k: id, n: T.n, d: T.d, off: id === 'cav' && !hasHorse(this.G, p.g, p.rec) })).concat([{ k: null, n: '返回' }]), { title: `${p.g.name}的兵種` }); if (t) { p.rec.troop = t; this.ui.toast(`${p.g.name}改率${TROOPS[t].n}`); } }
      if (c === 'leave' && await this.ui.yesno(`讓${p.g.name}離開隊伍？`)) { p.g.follow = null; this.H.party = this.H.party.filter((x) => x !== p.g.id); this.g.respawnParty(); this.g.hud(); }
    }
  }
  troopOf(p) { const r = p.rec; return r.troop === 'cav' && !hasHorse(this.G, p.g, r) ? 'inf' : r.troop || (hasHorse(this.G, p.g, r) ? 'cav' : p.look?.wpn === 'bow' ? 'bow' : 'inf'); }
  refreshMe() { for (const p of this.g.partyList()) refresh(this.G, p.g); this.g.hud(); }
  async useItems() {
    const own = Object.keys(this.H.items).filter((k) => this.H.items[k] > 0 && usable(k));
    if (!own.length) { this.ui.toast('沒有可以用的道具'); return; }
    const k = await this.ui.choose(own.map((k) => ({ k, n: `${ITEMS[k].n} ×${this.H.items[k]}`, d: ITEMS[k].d })), { title: '道具' }); if (!k) return;
    const I = ITEMS[k], list = this.g.partyList();
    if (I.reroll) {
      const i = await this.ui.choose(list.map((p, i) => ({ k: i, n: p.g.name, sub: traitsOf(p.g).join('・') })), { title: '洗髓丹：給誰？' }); if (i == null) return; const g = list[i].g;
      const j = await this.ui.choose(traitsOf(g).map((t, j) => ({ k: j, n: t, d: TRAIT[t].d })), { title: `重抽${g.name}的哪一個特性？` }); if (j == null) return;
      this.H.items[k]--; const r = reroll(g, j); if (r) { this.g.audio.sfx('level'); await this.ui.say('', `${g.name}服下洗髓丹，脫胎換骨！\n特性「${r.old}」變成了「${r.nu}」。`); }
      return;
    }
    const targets = I.healAll ? list : [list[await this.ui.choose(list.map((p, i) => ({ k: i, n: p.g.name, sub: I.sp ? `策 ${p.rec.sp}/${p.spMax}` : `兵 ${p.rec.sol}/${p.solMax}` })), { title: '給誰？' }) ?? -1]].filter(Boolean);
    if (!targets.length) return;
    this.H.items[k]--; if (I.full) this.H.wound = 0; for (const p of targets) { if (I.full) p.rec.sp = p.spMax; if (I.sp) p.rec.sp = Math.min(p.spMax, p.rec.sp + I.sp); else p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * (I.heal || I.healAll))); }
    this.g.audio.sfx('ok'); this.g.hud();
  }
  // ---------------------------------------------------------------- talking
  async talk(n) {
    if (n.special) return this.special(n);
    if (n.gen == null) { n.a.dir = this.faceTo(n.a); this.g.view.placeActor(n.a); if (await this.g.events.maybe('t', n.guard ? 0.25 : 0.4, n)) return; await this.ui.say(n.guard ? '守城士兵' : '百姓', n.line, n.look); return; }
    const G = this.G, x = G.gens[n.gen], f = x.status === 'serving' && G.factions[x.fac], me = this.me, mine = this.g.myFaction();
    n.a.dir = this.faceTo(n.a); this.g.view.placeActor(n.a);
    if (await this.g.events.maybe('t', 0.15, n)) return;
    const sameSide = f && mine === x.fac, look = this.g.lookOf(x), age = G.year - x.born;
    mark(this.g, x.id, 1); addBond(this.g, x.id, 1);
    const info = `${x.name}（${age}歲）${x.life ? `　【${TYPE_N[x.life.type]}】Lv${x.life.lv}${x.life.vet ? '・身經百戰' : ''}` : ''}${f ? `　${f.name}軍${G.factions[x.fac].lord === x.id ? '・君主' : ''}` : '　在野'}\n統率 ${x.lead}　武力 ${x.war}　智力 ${x.int}　政治 ${x.pol}　魅力 ${x.cha}${G.items.some((it) => it.holder === x.id) ? `\n寶物：${G.items.filter((it) => it.holder === x.id).map((it) => itemName(it.key)).join('、')}` : ''}\n特性：${traitsOf(x).map((t) => `<b>${t}</b>`).join('、')}${(() => { const c = combosWith(G, x, this.g.partyList().map((p) => p.g)); return (c.own ? `　★ 絕技「${c.own}」` : '') + c.with.slice(0, 2).map((w) => `\n<b style="color:#ffd86a">★ 和${w.g.name}能組成「${w.n}」</b>`).join(''); })()}`;
    const opts = [{ k: 'talk', n: '交談' }, { k: 'traits', n: '查看特性', d: traitsOf(x).join('・') }, ...sageOpts(x)];
    if (!f) opts.push({ k: 'recruit', n: '招募' });
    if (sameSide && !this.g.H.party.includes(x.id) && G.factions[x.fac].lord !== x.id) opts.push({ k: 'invite', n: '邀請同行', d: `依官階而定（${this.g.perk().n}）` });
    if (!f || sameSide) opts.push({ k: 'spar', n: '切磋' });
    if (!sameSide) opts.push({ k: 'duel', n: '挑戰（生死決鬥）' });
    if (n.road && this.canAmbush(x)) opts.push({ k: 'ambush', n: '攻擊', d: `和${x.name}的部隊交戰` });
    // busy on the road (crowd.js): fighting bandits, or another officer
    const foe = n.stop === 'clash' && G.gens[n.foe];
    if (n.stop === 'bandit') opts.unshift({ k: 'helpB', n: '助陣討賊', d: `和${x.name}一起打山賊` });
    const enemy = n.stop === 'duel' && G.gens[n.foe];
    if (enemy) opts.unshift({ k: 'helpD', n: `代他出戰（單挑${enemy.name}）`, d: `${x.name}和${enemy.name}是宿敵` });
    if (foe && this.canAmbush(foe)) opts.unshift({ k: 'helpC', n: `助陣（攻擊${foe.name}）`, d: `幫${x.name}打${G.factions[foe.fac].name}軍` });
    opts.push({ k: null, n: '離開' });
    const tie = this.g.ties.info(x);
    let c; for (;;) { c = await this.ui.ask(info + tie, opts, x.name, look); if (c !== 'traits') break; await this.ui.panel(traitCard(this.g, x), { title: `${x.name}的特性`, cls: 'wide' }); }
    if (c === 'talk') await this.ui.say(x.name, this.lineOf(x, f, sameSide), look);
    if (['heal', 'wuqin', 'fu'].includes(c)) await sageGen(this.g, x, c);
    if (c === 'recruit') await this.recruit(x, n);
    if (c === 'invite') await this.invite(x, n);
    if (c === 'spar') await this.duelWith(x, 'spar', n);
    if (c === 'duel') await this.duelWith(x, 'kill', n);
    if (c === 'ambush') await this.roadFight(x, n);
    if (c === 'helpB') await this.helpBandits(x);
    if (c === 'helpC') await this.helpClash(x, foe);
    if (c === 'helpD') { const r = await this.duelWith(enemy, 'spar'); if (r === 'win') { this.g.crowd.home(enemy); addBond(this.g, x.id, 20); await this.ui.say(x.name, `${enemy.name}這口氣，你替我出了！\n（好感 +20）`, look); } }
  }
  // an officer fighting bandits on the road: fight them for him
  async helpBandits(x) {
    const me = this.me, H = this.H, look = this.g.lookOf(x), lv0 = this.g.partyList().reduce((s, p) => s + p.rec.lv, 0) / (H.party.length + 1), base = pick(['山賊', '流寇', '盜匪']);
    const foes = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, (_, i) => this.foe(i ? base : base + '頭目', 'bandit', Math.max(1, Math.round(lv0 + Math.random() * 2 - 1)), null, !i));
    this.g.audio.sfx('encounter');
    const r = await this.fight(foes, { terrain: this.terrainAt(), title: `助${x.name}討賊！` });
    this.g.crowd.cut(x); if (r !== 'win') return;
    const gold = 20 + Math.round(lv0 * 4); H.gold += gold; H.fame += 3; H.st.bandits += foes.length; addBond(this.g, x.id, 15);
    if (this.g.myFaction() && x.fac === this.g.myFaction() && !this.g.isLord()) { me.merit += 3; this.promote(); }
    this.g.audio.sfx('coin'); this.g.hud();
    await this.ui.say(x.name, `${pick([`多謝${me.name}出手相助！`, '好身手！有你在，這些賊寇不堪一擊。', `${me.name}，這份人情我記下了。`])}
（金 +${gold}、名聲 +3、好感 +15）`, look);
  }
  // two officers fighting on the road: take one side (fight the other one)
  async helpClash(x, foe) {
    const r = await this.roadFight(foe, { kind: 'patrol' }); if (r !== 'win') return;
    addBond(this.g, x.id, 20);
    await this.ui.say(x.name, `${pick([`${this.me.name}，多謝援手！此恩必報。`, '來得正好！', `${foe.name}被打跑了，多虧有你！`])}
（好感 +20）`, this.g.lookOf(x));
  }
  // ---------------------------------------------------------------- an enemy officer met on the road (crowd.js): fight him and his men
  canAmbush(x) { const G = this.G, f = x.status === 'serving' && G.factions[x.fac], mine = this.g.myFaction(); if (!f || x.fac === mine || f.lord === x.id) return false; return !mine || !allied(G, mine, f.id); }
  async roadFight(x, n) {
    const G = this.G, f = G.factions[x.fac], C = G.cities[x.city], kind = n.kind || 'patrol', me = this.me;
    // his own troop (out of his city's garrison), more when drilling, fewer on the way to a new post; and a few squads
    const lv = this.lvOf(x), rec = { lv, eq: {} }, mul = { patrol: 1, hunt: 0.9, drill: 1.2, post: 0.7 }[kind] || 1;
    const sol = Math.max(150, Math.min(Math.round(solMax(x, rec) * mul), C && C.owner === x.fac ? Math.max(150, Math.round(C.troops * 0.15)) : 99999));
    const foes = [{ name: x.name, look: this.g.lookOf(x), lv, war: x.war, lead: x.lead, int: x.int, sol, solMax: sol, sp: Math.round(spMax(x, rec)), spells: x.spells, gid: x.id, color: f.color, wpn: Math.round(lv / 4), arm: Math.round(lv / 4) }];
    for (let i = 0, k = kind === 'post' ? 1 : 1 + Math.floor(Math.random() * 3); i < k; i++) foes.push(this.foe(`${f.name}軍士兵`, 'soldier', Math.max(1, lv - 3), f.color, false));
    this.g.audio.sfx('encounter');
    const r = await this.fight(foes, { terrain: this.terrainAt(), title: `與${f.name}軍・${x.name}交戰！`, ambush: true });
    // what he lost comes out of his city's garrison (the battle fights copies: out.foes); and he rides home
    const fought = this.last?.foes || foes, lost = fought.reduce((s, u) => s + (u.solMax - Math.max(0, u.sol)), 0); if (C && C.owner === x.fac) C.troops = Math.max(0, C.troops - lost);
    this.g.crowd.home(x);
    if (r !== 'win' || x.status !== 'serving') return r;
    this.H.fame += 8; if (this.g.myFaction() && !this.g.isLord()) { me.merit += Math.round(6 * (1 + partyFx(this.g, 'merit'))); this.promote(); }
    record(G, 'war', 'roadWin', { g: me.name, x: x.name, f: f.name }, this.g.myFaction(), 1, { g: x.id });
    // beaten to the last man, he may be taken
    if ((fought.find((u) => u.gid === x.id)?.sol ?? 1) <= 0 && Math.random() < 0.5) await this.captive(x, f);
    return r;
  }
  // ---------------------------------------------------------------- the martial ranking (martial.js)
  // a win or a loss in a duel moves the names on the list
  rankAfter(x, won) {
    const me = this.me, H = this.H;
    if (won) { const n = beat(this.g, me, x); if (!n) return; H.fame += (21 - n) * 2; this.ui.toast(`<b style="color:#ffd86a">你擊敗了${x.name}，成為天下第${n}！</b>`, 4500); this.g.audio.sfx('level'); if (n === 1) deed(this.g, '天下第一', true); else if (n <= 10) deed(this.g, `武力名列天下第${n}`); }
    else { const was = listRank(this.g, me.id), n = beat(this.g, x, me); if (n && was) this.ui.toast(`${x.name}奪走了你天下第${n}的名號……`, 4000); }
  }
  // someone below the player on the list comes to challenge him
  async rankChallenge() {
    const G = this.G, H = this.H, me = this.me, x = G.gens[H.challenger?.id]; H.challenger = null;
    if (!x || !(x.status === 'serving' || x.status === 'free')) return;
    const n = listRank(this.g, me.id), look = this.g.lookOf(x); if (!n) return;
    const c = await this.ui.ask(`天下第${listRank(this.g, x.id) || '?'}的${x.name}找上門來：\n「${me.name}！天下第${n}的名號，今天就讓給我吧！」\n武力 ${x.war}　Lv ${this.lvOf(x)}`, [{ k: 'go', n: '應戰', d: '一對一單挑，輸了名次讓給他' }, { k: 'no', n: '不理他', d: '名聲 -10，名次讓給他' }], x.name, look);
    if (c !== 'go') { H.fame = Math.max(0, H.fame - 10); beat(this.g, x, me); await this.ui.say(x.name, '哼，原來是個膽小鬼！', look); this.g.hud(); return; }
    const rec = H.rec[me.id], a = { name: me.name, look: this.g.lookOf(me), lv: rec.lv, st: bstats(me, rec), isPlayer: true, arms: relicFx(rec) }, b = this.duelFoe(x), was = this.g.mode;
    this.g.mode = 'battle'; this.g.audio.music('battle');
    const r = await this.g.battle.soloDuel(a, b, { noFlee: true });
    this.g.battle.close(); this.g.mode = was; this.g.audio.music(was === 'town' ? 'town' : 'field');
    if (r === 'win' || r === 'lose') versus(this.g, x.id, r === 'win');
    if (r === 'win') { H.st.duels++; me.duelsWon++; gainExp(G, me, rec, 40 + b.lv * 8); H.fame += 10; await this.ui.say(x.name, `……不愧是天下第${n}。我還會再來的！\n（名聲 +10）`, look); }
    else if (r === 'lose') { this.rankAfter(x, false); await this.ui.say(x.name, `天下第${n}的名號，從今天起是我的了！`, look); }
    this.g.hud();
  }
  // ---------------------------------------------------------------- an army on the march (armies.js)
  // the vanguard: the garrison rides out to meet the column, and the player's party meets them first
  async vanguard(c) {
    const G = this.G, me = this.me, H = this.H, t = G.cities[c.target], f = G.factions[c.fac], mine = this.g.myFaction(), lead = G.gens[c.army[0]];
    const foes = this.defenders(t).slice(0, 3); for (const u of foes) { u.sol = u.solMax = Math.max(150, Math.round(u.solMax * 0.5)); }
    this.g.audio.sfx('encounter');
    const r = await this.fight(foes, { terrain: this.terrainAt(), title: `${f.name}軍先鋒：迎擊${t.name}守軍` });
    c.vang = true; if (r !== 'win') return;
    const cut = Math.round(t.troops * 0.2); t.troops -= cut; H.fame += 6;
    let msg = `${t.name}的守軍折損 ${cut} 人。`;
    if (mine === c.fac) { if (!this.g.isLord()) { me.merit += Math.round(8 * (1 + partyFx(this.g, 'merit'))); this.promote(); } msg += '\n功績 +8、名聲 +6'; }
    else { const gold = 80 + Math.round(t.troops / 100); H.gold += gold; msg += `\n${f.name}軍付了賞金 ${gold} 金。名聲 +6`; }
    this.g.hud(); await this.ui.say(lead?.name || '', `先鋒立了頭功！${msg}`, lead ? this.g.lookOf(lead) : null);
  }
  // cut into the column: its generals and their men (out of the army's numbers); cut down to half, it turns back
  async cutArmy(c) {
    const G = this.G, me = this.me, H = this.H, f = G.factions[c.fac], t = G.cities[c.target], mine = this.g.myFaction();
    const gs = c.army.map((id) => G.gens[id]).filter((g) => g && g.status === 'serving').slice(0, 3); if (!gs.length) return;
    const foes = gs.map((x) => { const lv = this.lvOf(x), rec = { lv, eq: {} }, sol = Math.max(200, Math.min(Math.round(solMax(x, rec) * 1.5), Math.round(c.troops / (gs.length + 2))));
      return { name: x.name, look: this.g.lookOf(x), lv, war: x.war, lead: x.lead, int: x.int, sol, solMax: sol, sp: Math.round(spMax(x, rec)), spells: x.spells, gid: x.id, color: f.color, wpn: Math.round(lv / 4), arm: Math.round(lv / 4) }; });
    for (let i = 0; i < 2; i++) foes.push(this.foe(`${f.name}軍士兵`, 'soldier', Math.max(1, this.lvOf(gs[0]) - 3), f.color, false));
    this.g.audio.sfx('encounter');
    const r = await this.fight(foes, { terrain: this.terrainAt(), title: `截擊${f.name}軍大軍！`, ambush: true });
    const fought = this.last?.foes || foes, lost = fought.reduce((s, u) => s + (u.solMax - Math.max(0, u.sol)), 0);
    // the men lost in the fight, and (a win) as many again who scatter
    c.troops = Math.max(0, c.troops - lost * (r === 'win' ? 2 : 1)); if (r !== 'win') return;
    H.fame += 10; const ours = t.owner && t.owner === mine;
    if (mine && !this.g.isLord()) { me.merit += Math.round((ours ? 15 : 8) * (1 + partyFx(this.g, 'merit'))); this.promote(); }
    const back = c.troops < c.troops0 * 0.5 || c.troops < 3000; if (back) { this.g.camps.turnBack(c); H.fame += 10; deed(this.g, `截擊${f.name}軍，解${t.name}之圍`); }
    record(G, 'war', 'roadWin', { g: me.name, x: gs[0].name, f: f.name }, mine, back ? 2 : 1, { g: gs[0].id });
    this.g.hud();
    await this.ui.say('', back ? `${f.name}軍大亂，${gs[0].name}下令撤退！\n${t.name}之圍解了。名聲 +20${mine ? '、功績' : ''}` : `${f.name}軍損兵折將，還剩 ${c.troops} 人。\n名聲 +10${mine ? '、功績' : ''}`);
  }
  // a general taken on the road: win him over, let him go, or put him to death
  async captive(x, pf) {
    const G = this.G, me = this.me, H = this.H, mine = this.g.myFaction(), p = clamp(0.2 + (me.cha - x.loyalty) / 160 + (fameOf(H).defect || 0), 0.03, 0.9);
    const room = H.party.length < this.g.partyMax(), can = mine || room;
    const opts = [...(can ? [{ k: 'win', n: '招降', d: mine ? '歸順我軍' : '加入隊伍' }] : []), { k: 'free', n: '釋放' }, { k: 'kill', n: '斬首' }];
    const c = await this.ui.ask(`俘虜了${pf.name}軍的${x.name}。要怎麼處置？\n統${x.lead} 武${x.war} 智${x.int}${can ? `　招降成功率 ${Math.round(p * 100)}%` : '　（隊伍已滿）'}`, opts, x.name, this.g.lookOf(x));
    mark(this.g, x.id, 2);
    if (c === 'kill') { die(G, x, 'executed', me); H.st.kills.push(x.name); H.fame += 10; bump(H, 'cruel'); deed(this.g, `斬${x.name}`); return; }
    if (c === 'win' && Math.random() < p) {
      if (mine) { const home = citiesOf(G, mine)[0]; serve(G, x, mine, home ? home.id : x.city, 60 + Math.round(Math.random() * 20)); }
      else { x.status = 'free'; x.fac = null; x.loyalty = 0; }
      if (room) { x.follow = H.pid; H.party.push(x.id); H.rec[x.id] ||= newRec(x, Math.max(startLv(x), H.rec[H.pid].lv - 3)); this.g.respawnParty(); }
      record(G, 'join', 'captive', { g: x.name, f: mine ? G.factions[mine].name : me.name }, mine, 2, { g: x.id }); mark(this.g, x.id, 3);
      await this.ui.say(x.name, room ? `${me.name}，我願追隨您！` : '敗軍之將，願降。', this.g.lookOf(x)); this.g.hud(); return;
    }
    if (c === 'win') await this.ui.say(x.name, '要殺就殺，我絕不投降！', this.g.lookOf(x));
    if (c === 'free') { bump(H, 'ren'); addBond(this.g, x.id, 20); await this.ui.say(x.name, '……今日之恩，他日必報。', this.g.lookOf(x)); }
  }
  faceTo(a) { const P = this.g.pos, dx = P.x - Math.round(a.x), dz = P.z - Math.round(a.z); return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 1) : dz > 0 ? 0 : 3; }
  lineOf(x, f, same) {
    const G = this.G, lord = f && G.gens[f.lord], H = this.H, me = this.me, t = knownAs(H);
    if (isSworn(H, x.id)) return pick([`${me.name}，咱們兄弟同心，什麼都不怕！`, '兄長／賢弟，有事儘管吩咐。', '能和你結為兄弟，是我一生的福氣。']);
    if (isRival(H, x.id)) { const v = (H.vs || {})[x.id] || { w: 0, l: 0 }; return v.l > v.w ? `${me.name}，你又來送死了嗎？我們之間已經交手${v.w + v.l}次了。` : `${me.name}……總有一天，我會打敗你。`; }
    if (t && Math.random() < 0.45) { const T = TITLES.find((y) => y.n === t); return T.bad ? pick([`哼，你就是那個「${t}」？離我遠一點。`, `「${t}」${me.name}……我聽說過你的事。`]) : pick([`你就是人稱「${t}」的${me.name}？久仰大名！`, `「${t}」的名號，天下誰人不知！`, `能見到「${t}」${me.name}，真是三生有幸。`]); }
    if (!f) return pick(['天下大亂，不知何處有明主……', `我在${G.cities[x.city].name}等待時機。`, '若遇明主，願效犬馬之勞。', '亂世之中，唯有實力才能說話。']);
    if (f.lord === x.id) return pick([`天下終將歸於我${f.name}。`, '正是用人之際，有能之士我都歡迎。', '誰能助我平定天下？']);
    if (same) return pick([`為${lord.name}大人效力，萬死不辭。`, '最近戰事吃緊，我們要更加努力。', `${this.me.name}，聽說你又立了功！`, '一起建功立業吧！']);
    return pick([`我是${f.name}軍的${x.name}。`, `你最好別打${G.cities[x.city].name}的主意。`, `${lord.name}大人才是真正的英雄。`]);
  }
  // ---------------------------------------------------------------- companions
  async recruit(x, npc) {
    const H = this.H, me = this.me, mine = this.g.myFaction();
    if (H.party.length >= this.g.partyMax()) { await this.ui.say(x.name, `你的隊伍已經滿了。（${this.g.perk().n}最多帶 ${this.g.partyMax()} 位同伴）`, this.g.lookOf(x)); return; }
    let p = 0.18 + partyFx(this.g, 'recruit') + this.g.perk().recruit + (me.cha - 50) / 110 + H.fame / 1600 - (x.refused || 0) * 0.08 + (x.prefer && x.prefer === mine ? 0.25 : 0) + (x.seek > this.G.t ? 0.4 : 0) + (fameOf(H).recruit || 0) + bLv(this.G.cities[x.city], 'acad') * 0.05;
    if (me.war + me.int + me.lead > x.war + x.int + x.lead + 30) p += 0.1;
    if (hasT(H, 'renyi')) p += 0.1; if (hasT(H, 'jianu')) p -= 0.15; if (hasT(H, 'canbao')) p -= 0.1; p += bondOf(H, x.id) / 200;
    if ((H.items.wine || 0) > 0 && await this.ui.yesno(`要送上美酒嗎？（剩 ${H.items.wine}）`)) { H.items.wine--; p += 0.25; }
    p = clamp(p, 0.04, 0.95);
    if (Math.random() < p) {
      x.follow = H.pid; x.known = true; H.party.push(x.id); H.rec[x.id] ||= newRec(x, Math.max(startLv(x), H.rec[H.pid].lv - 3));
      if (mine) serve(this.G, x, mine, me.city, 85);
      mark(this.g, x.id, 3); addBond(this.g, x.id, 15); if (x.lead + x.war + x.int > 220) deed(this.g, `得${x.name}相助`);
      await this.ui.say(x.name, `${me.name}大人，我願追隨您！`, this.g.lookOf(x));
      if (npc) { this.g.view.removeActor(npc.a); this.g.npcs = this.g.npcs.filter((m) => m !== npc); }
      this.g.respawnParty(); this.g.hud(); H.fame += 5;
    } else { x.refused = (x.refused || 0) + 1; await this.ui.say(x.name, pick(['我還想再看看天下的形勢。', '你還不足以讓我追隨。', '抱歉，我另有打算。']), this.g.lookOf(x)); }
  }
  // one's own faction's officers: the higher the player's rank, the readier they are to come along
  async invite(x, npc) {
    const G = this.G, H = this.H, me = this.me, look = this.g.lookOf(x), P = this.g.perk();
    if (H.party.length >= this.g.partyMax()) { await this.ui.say(x.name, `你的隊伍已經滿了。（${P.n}最多帶 ${this.g.partyMax()} 位同伴）`, look); return; }
    const rk = PERKS.indexOf(P), mine = x.fac === me.fac, rel = bondOf(H, x.id);
    const p = this.g.isLord() || P.inv >= 3 ? 1 : P.inv === 2 ? 0.9 : P.inv === 1 ? 0.55 + rel / 200 + (me.cha - 60) / 150 : 0.15 + rel / 200 + (me.cha - 60) / 200 + (x.lead + x.war + x.int < me.lead + me.war + me.int ? 0.15 : -0.1);
    if (!mine) return;
    if (Math.random() < Math.max(0.03, Math.min(1, p))) {
      x.follow = H.pid; H.party.push(x.id); H.rec[x.id] ||= newRec(x, Math.max(startLv(x), x.life?.lv || 1));
      for (const c of G.cities) if (c.gov === x.id) pickGovernor(G, c); mark(this.g, x.id, 3); addBond(this.g, x.id, 10);
      if (npc) { this.g.view.removeActor(npc.a); this.g.npcs = this.g.npcs.filter((m) => m !== npc); }
      await this.ui.say(x.name, this.g.isLord() ? '主公有令，末將遵命！' : `能跟隨${P.n}大人出征，是我的榮幸！`, look);
      this.g.respawnParty(); this.g.hud();
    } else await this.ui.say(x.name, rk < 4 ? '我有軍務在身，恕難從命。（官階升到中郎將以上，比較容易邀請）' : '這次我想留在城裡，下次吧。', look);
  }
  // ---------------------------------------------------------------- duels: a friendly bout, or to the death
  duelFoe(x) { const lv = this.lvOf(x); const r = { lv, eq: {} }; return { name: x.name, look: this.g.lookOf(x), lv, st: bstats(x, r), gid: x.id }; }
  // a general's level in battle: their own life's level (see sim/life.js), or for an old save an estimate from the years
  lvOf(x) {
    if (this.H.rec[x.id]) return this.H.rec[x.id].lv; const nb = this.g.nemesis?.lvBonus(x.id) || 0;
    const own = x.life ? x.life.lv + 2 : startLv(x) + Math.floor((this.G.year - this.H.startYear) * 1.2) + 2;
    // they do not stand still while the player grows: a great general keeps within a level or two, a lesser one further back
    const keep = this.avgLv() - 4 + Math.round(Math.max(-4, Math.min(4, (x.war + x.lead - 140) / 12)));
    return Math.max(1, Math.max(own, keep) + nb);
  }
  async duelWith(x, kind, npc) {
    const G = this.G, me = this.me, f = x.status === 'serving' && G.factions[x.fac];
    if (kind === 'kill' && !await this.ui.yesno(`真的要向${x.name}挑戰生死決鬥嗎？\n${f ? `會與${f.name}軍結仇。` : ''}`)) return;
    const rec = this.H.rec[me.id], a = { name: me.name, look: this.g.lookOf(me), lv: rec.lv, st: bstats(me, rec), isPlayer: true, arms: relicFx(rec) }, b = this.duelFoe(x);
    const was = this.g.mode; this.g.mode = 'battle'; this.g.audio.music('battle');
    const r = await this.g.battle.soloDuel(a, b, { noFlee: kind === 'kill' });
    // back where the duel was: in a town, or out on the road
    this.g.battle.close(); this.g.mode = was === 'world' ? 'world' : 'town'; this.g.audio.music(was === 'world' ? 'field' : 'town');
    mark(this.g, x.id, 2); if (r === 'win' || r === 'lose') { versus(this.g, x.id, r === 'win'); this.rankAfter(x, r === 'win'); }
    if (r === 'win') {
      this.H.st.duels++; x.duelsLost = (x.duelsLost || 0) + 1; me.duelsWon++;
      gainExp(G, me, rec, 40 + b.lv * 8);
      if (kind === 'spar') { this.H.fame += 5; addBond(this.g, x.id, 3); checkTitles(this.g); await this.ui.say(x.name, '好身手！我服了。', b.look); return r; }
      const c = await this.ui.ask(`${x.name}倒在地上。`, [{ k: 'kill', n: '斬殺' }, { k: 'spare', n: '饒他一命' }]);
      if (c === 'kill') {
        const had = G.items.filter((it) => it.holder === x.id);
        die(G, x, 'duel', me); me.kills++; this.H.st.kills.push(x.name); this.H.fame += Math.round((x.war + x.lead) / 3);
        for (const it of had) if (it.holder !== me.id && (it.city === me.city || it.fac === null && it.holder == null)) { give(G, it, me); this.ui.toast(`得到了「${itemName(it.key)}」！`); }
        if (f) { this.H.foes = this.H.foes || {}; this.H.foes[f.id] = (this.H.foes[f.id] || 0) + 1; const mf = this.g.myFaction(); if (mf && G.factions[mf]) { G.factions[mf].rel[f.id] = (G.factions[mf].rel[f.id] || 0) - 25; f.rel[mf] = (f.rel[mf] || 0) - 25; } }
        if (npc) { this.g.view.removeActor(npc.a); this.g.npcs = this.g.npcs.filter((m) => m !== npc); }
        deed(this.g, `與${x.name}決鬥，斬之`, x.lead + x.war > 150); versus(this.g, x.id, true); checkTitles(this.g);
        await this.ui.say('', `${me.name}斬殺了${x.name}！\n天下為之震動。`);
        if (f && x.city === this.g.town?.city) { await this.ui.say('守城士兵', '殺人兇手！把他趕出城去！', LOOKS.soldier(f.color)); this.g.leaveTown(); }
      } else { this.H.fame += 20; bump(this.H, 'ren'); addBond(this.g, x.id, 15); checkTitles(this.g); await this.ui.say(x.name, '……今日之恩，他日必報。', b.look); }
    } else if (r === 'lose') {
      if (kind === 'spar') { gainExp(G, me, rec, 15); await this.ui.say(x.name, '還要多加磨練啊。', b.look); return r; }
      const lost = Math.round(this.H.gold * 0.2); this.H.gold -= lost; for (const p of this.g.partyList()) p.rec.sol = Math.round(p.rec.sol * 0.5);
      await this.ui.say(x.name, `就這點本事？滾吧！\n（失去了 ${lost} 金，兵力減半）`, b.look);
      if (f && x.city === this.g.town?.city) this.g.leaveTown();
    }
    this.g.hud(); return r;
  }
  // ---------------------------------------------------------------- buildings
  async building(door) {
    const C = this.g.town.C;
    this.g.locked = true;
    try {
      if (this.g.auto.on && await this.g.auto.door(door, C)) return;
      if (door.id === 'gov') await this.gov(C);
      if (door.id === 'arms') await this.shop(C);
      if (door.id === 'goods') await this.goods(C);
      if (door.id === 'inn') await this.inn(C);
      if (door.id === 'tavern') await this.tavern(C);
      if (door.id === 'drill') await this.drill(C);
    } finally { this.g.locked = false; this.g.hud(); }
    // step back out of the door
    const P = this.g.pos; if (!door.open) { P.z += 1; if (!this.g.canWalk(P.x, P.z)) P.z -= 1; this.g.tiles = this.g.tiles.map(() => [P.x, P.z]); this.g.prevTiles = null; this.g.place(1); this.g.camTo(P.x, P.z); }
  }
  async gov(C) {
    const G = this.G, me = this.me, mine = this.g.myFaction(), f = C.owner && G.factions[C.owner], gov = C.gov != null ? G.gens[C.gov] : null;
    const host = f ? (G.gens[f.lord].city === C.id && G.gens[f.lord].status === 'serving' && !busy(G.gens[f.lord]) ? G.gens[f.lord] : gov) : null;
    if (!f) {
      const opts = [{ k: 'take', n: '佔領此城', d: '擊敗守備隊，奪下這座城' }, { k: null, n: '離開' }];
      const c = await this.ui.ask(`${C.name}沒有主人，由守備隊看守。（兵 ${C.troops}）`, opts);
      if (c === 'take') await this.siege(C);
      return;
    }
    if (C.owner === mine) return this.ownHall(C, f, host);
    // another warlord's hall
    const who = host || { name: `${f.name}軍的守將`, look: LOOKS.soldier(f.color) };
    const look = host ? this.g.lookOf(host) : who.look;
    const opts = [{ k: 'visit', n: '拜訪' }];
    if (!mine) opts.push({ k: 'serve', n: `仕官（投靠${f.name}）` });
    opts.push({ k: null, n: '離開' });
    const c = await this.ui.ask(`這裡是${f.name}軍的${C.name}。\n兵 ${C.troops}　城防 ${C.def}　守將 ${gov ? gov.name : '—'}`, opts, host?.name, look);
    if (c === 'visit') await this.ui.say(host?.name || '守將', mine && hostile(G, mine, f.id) ? '哼，敵國之人也敢來此？' : `${f.name}大人正在廣招天下英才。`, look);
    if (c === 'serve') {
      const lord = G.gens[f.lord], grudge = (this.H.foes || {})[f.id] || 0;
      const p = clamp(0.3 + this.H.fame / 700 + (me.lead + me.war + me.int + me.cha) / 1000 - grudge * 0.35 - (f.lord === me.id ? 1 : 0) - (hasT(this.H, 'jianu') ? 0.2 : 0) + (hasT(this.H, 'renyi') ? 0.1 : 0), 0.02, 0.97);
      if (Math.random() < p) {
        serve(G, me, f.id, C.id, 80); me.merit = Math.max(me.merit, 0);
        for (const id of this.H.party) serve(G, G.gens[id], f.id, C.id, 80);
        record(G, 'join', 'serve', { g: me.name, f: f.name }, f.id, 2, { g: me.id });
        if (this.H.st.lastFac && this.H.st.lastFac !== f.id) bump(this.H, 'turns'); this.H.st.lastFac = f.id;
        deed(this.g, `投奔${f.name}，拜為${RANKS[rankOf(me.merit)][0]}`); checkTitles(this.g);
        await this.ui.say(lord.name, `好！${me.name}，從今以後你就是我${f.name}軍的${RANKS[rankOf(me.merit)][0]}了。立下戰功，我必有重賞。`, this.g.lookOf(lord));
        this.g.respawnParty();
      } else await this.ui.say(host?.name || '守將', grudge ? '你殺了我們的人，還敢來投靠？' : '你的名聲還不夠響亮，以後再說吧。', look);
    }
  }
  async ownHall(C, f, host) {
    const G = this.G, me = this.me, lord = G.gens[f.lord], isLord = f.lord === me.id, rk = rankOf(me.merit), next = RANKS[rk + 1];
    for (;;) {
      const opts = [{ k: 'report', n: isLord ? '軍情' : '謁見', d: isLord ? '看看勢力的情況' : `官職 ${RANKS[rk][0]}（功績 ${me.merit}${next ? `／升${next[0]}需 ${next[1]}` : ''}）` },
        { k: 'job', n: '內政', d: '開墾、經商、築城、練兵、安民（十天），或興建水利、市集、城郭等建設' },
        ...(canGovern(this.g, C) ? [{ k: 'governor', n: this.H.gov?.cid === C.id ? '太守方針' : isLord ? '親領此城' : '請命為太守', d: this.H.gov?.cid === C.id ? `你是${C.name}的太守，可以更改治理方針` : '每月依你的能力治理這座城，分得兩成的稅收（都尉以上）' }] : []),
        { k: 'draft', n: '徵兵', d: `從城中調兵補滿隊伍（城中兵 ${C.troops}）` },
        { k: 'mission', n: '任務', d: '討伐附近的賊寇' },
        ...(this.g.board.restless(C) ? [{ k: 'calm', n: '安撫百姓', d: `民心 ${C.morale}：新佔領，可能民變。200 金、五天，民心 +${10 + Math.round(me.cha / 10)}` }] : []),
        ...(!isLord && fameOf(this.H).petition ? [{ k: 'petition', n: '上書自薦', d: (this.H.petition || -99) + 12 > this.G.t ? `一年只能一次（${(this.H.petition || 0) + 12 - this.G.t} 個月後）` : `憑名聲請求升遷（功績 +${Math.min(150, Math.round(this.H.fame / 12))}）`, off: (this.H.petition || -99) + 12 > this.G.t }] : []),
        ...(!isLord && this.g.court.on() && (this.H.susp || 0) >= 10 ? [{ k: 'loyal', n: '表忠心', d: this.g.court.line() }] : []),
        { k: 'pick', n: '點將', d: `邀請城裡的武將同行（同伴 ${this.H.party.length}／${this.g.partyMax()}）` },
        ...(isLord ? [{ k: 'treasury', n: '府庫', d: `勢力金 ${f.gold}，可以支取` }] : [{ k: 'quit', n: '下野', d: '離開這個勢力' }]),
        { k: null, n: '離開' }];
      const c = await this.ui.choose(opts, { title: `${C.name}・太守府　${f.name}軍` });
      if (c == null) return;
      if (c === 'report') await this.report(C, f, isLord, host || lord);
      if (c === 'job') await this.job(C, f);
      if (c === 'loyal') await this.g.court.loyal();
      if (c === 'governor') await governor(this, C, f);
      if (c === 'draft') await this.draft(C, true);
      if (c === 'calm') await this.g.board.calm(C);
      if (c === 'petition') { this.H.petition = this.G.t; const n = Math.min(150, Math.round(this.H.fame / 12)); me.merit += n; await this.ui.say(lord.name, `${me.name}的名聲我早有耳聞。好，就照你說的辦！（功績 +${n}）`, this.g.lookOf(lord)); this.promote(); }
      if (c === 'mission') await this.missionOffer(C, f);
      if (c === 'pick') { const gs = G.gens.filter((x) => x.status === 'serving' && x.fac === f.id && x.city === C.id && !busy(x) && f.lord !== x.id); if (!gs.length) { this.ui.toast('城裡沒有可以同行的武將'); continue; } const k = await this.ui.choose(gs.map((x) => ({ k: x.id, n: x.name, sub: `統${x.lead} 武${x.war} 智${x.int}`, d: x.life ? `【${TYPE_N[x.life.type]}】Lv${x.life.lv}` : '' })).concat([{ k: null, n: '返回' }]), { title: '點將' }); if (k != null) await this.invite(G.gens[k]); }
      if (c === 'treasury') { const n = await this.ui.choose([500, 1000, 3000].map((n) => ({ k: n, n: `支取 ${n} 金`, off: f.gold < n })).concat([{ k: -500, n: '存入 500 金', off: this.H.gold < 500 }, { k: null, n: '返回' }]), { title: `府庫　勢力金 ${f.gold}` }); if (n) { f.gold -= n; this.H.gold += n; this.g.audio.sfx('coin'); } }
      if (c === 'quit' && await this.ui.yesno(`真的要離開${f.name}軍嗎？`)) { me.status = 'free'; me.fac = null; me.loyalty = 0; for (const id of this.H.party) { const m = G.gens[id]; m.status = 'free'; m.fac = null; } record(G, 'release', 'release', { x: lord.name, g: me.name }, f.id, 1, { g: me.id }); deed(this.g, `棄${f.name}而去`); this.ui.toast('你成了在野之身。'); this.g.respawnParty(); return; }
    }
  }
  async report(C, f, isLord, host) {
    const G = this.G, me = this.me, cs = citiesOf(G, f.id), gs = gensOf(G, f.id);
    if (isLord) { await this.ui.say('', `${f.name}軍：城池 ${cs.length} 座　武將 ${gs.length} 人　金 ${f.gold}　糧 ${f.food}\n兵力 ${cs.reduce((s, c) => s + c.troops, 0)}\n${cityLine(G, C, f)}\n各城的武將會自己處理內政與戰事。你可以親自出征，攻下敵城。`); return; }
    const rk = rankOf(me.merit), next = RANKS[rk + 1];
    await this.ui.say(host.name, `${me.name}，你目前官拜${RANKS[rk][0]}，月俸 ${RANKS[rk][2]} 金。\n${perkText(PERKS[rk + 1])}${next ? `\n再立 ${next[1] - me.merit} 點功績，就升為${next[0]}：${perkText(PERKS[rk + 2])}` : '\n你已位極人臣。'}`, this.g.lookOf(host));
  }
  async job(C, f) { await jobMenu(this, C, f); }
  promote() { const me = this.me; if (me.status !== 'serving' || this.g.isLord()) return; const rk = rankOf(me.merit); if (rk > this.H.st.bestRank) { this.H.st.bestRank = rk; deed(this.g, `遷${RANKS[rk][0]}`); this.ui.toast(`<b style="color:#ffd86a">升官！${me.name}成為${RANKS[rk][0]}。</b><br><small>${perkText(PERKS[rk + 1])}</small>`, 6000); this.g.partyList(); this.g.audio.sfx('level'); } }
  async draft(C, own) {
    const list = this.g.partyList(), need = list.reduce((s, p) => s + p.solMax - p.rec.sol, 0);
    if (!need) { this.ui.toast('兵力已經滿了'); return; }
    if (own) {
      const take = Math.min(need, Math.max(0, C.troops - 1500)); if (!take) { this.ui.toast('城裡的兵不夠調用了'); return; }
      C.troops -= take; this.fill(take); this.ui.toast(`從${C.name}調來 ${take} 名士兵。`);
    } else {
      const cost = Math.ceil(need / 3), can = Math.min(need, this.H.gold * 3);
      if (!can) { this.ui.toast('沒有錢募兵'); return; }
      if (!await this.ui.yesno(`募集 ${can} 名義勇兵，需要 ${Math.ceil(can / 3)} 金。`)) return;
      this.H.gold -= Math.ceil(can / 3); this.fill(can); this.ui.toast(`募集了 ${can} 名義勇兵。`);
    }
    this.g.audio.sfx('ok'); this.g.hud();
  }
  fill(n) { for (const p of this.g.partyList()) { const k = Math.min(n, p.solMax - p.rec.sol); p.rec.sol += k; n -= k; } }
  async shop(C) {
    const tierMax = C.size * 2, stock = [...WEAPONS, ...ARMORS, ...HORSES].filter((w) => w[4] <= tierMax), pm = priceMul(this.g, C.id >= 0 ? C.id : null), P = (n) => Math.round(n * pm);
    for (;;) {
      const top = await this.ui.choose([{ k: 'buy', n: '買裝備' }, { k: 'sell', n: '出售背包裡的東西', sub: (this.H.bag || []).length || '', off: !(this.H.bag || []).length }, { k: 'forge', n: '鍛造強化', d: `鐵匠用礦石把武器、防具打得更好（鐵礦石 ${this.H.items.ore || 0}、玄鐵 ${this.H.items.ore2 || 0}）` }, { k: null, n: '離開' }], { title: `武具店　金 ${this.H.gold}${pm > 1.2 ? '　（饑荒，物價上漲）' : ''}` });
      if (!top) return;
      if (top === 'forge') { await this.forge(); continue; }
      if (top === 'sell') { await this.sellBag(); continue; }
      const k = await this.ui.choose(stock.map(([id, n, v, price0]) => { const price = P(price0); return { k: id, n, sub: `${price} 金`, d: `${{ w: '武器　攻擊', a: '防具　防禦', h: '坐騎　速度' }[EQUIP[id].kind]} +${v}${EQUIP[id].kind === 'h' ? `，兵力上限 +${v * 25}` : ''}`, off: this.H.gold < price }; }).concat([{ k: null, n: '返回' }]), { title: `武具店　金 ${this.H.gold}` });
      if (!k) continue;
      const E = EQUIP[k], list = this.g.partyList();
      const who = await this.ui.choose(list.map((p, i) => { const cur = itemOf(p.rec.eq[E.kind]); return { k: i, n: p.g.name, sub: cur ? `${cur.n}（+${cur.v}）` : '無' }; }).concat([{ k: null, n: '返回' }]), { title: `${E.n} 給誰？` });
      if (who == null) continue;
      const p = list[who], old = p.rec.eq[E.kind];
      // a shop piece taken off is sold at half price; a treasure goes into the bag
      this.H.gold -= P(E.price); const oldIt = itemOf(old);
      if (old && oldIt.shop) this.H.gold += Math.round(oldIt.price / 2); else if (old) { this.H.bag ||= []; this.H.bag.push({ ...old, forge: p.rec.forge?.[E.kind] || 0 }); }
      p.rec.eq[E.kind] = k; if (p.rec.forge) p.rec.forge[E.kind] = 0; if (E.kind === 'h') p.rec.sol = Math.min(solMax(p.g, p.rec), p.rec.sol);
      this.g.audio.sfx('coin'); this.ui.toast(`${p.g.name}裝備了${E.n}${old ? oldIt.shop ? `（舊的${oldIt.n}以半價賣出）` : `（${oldIt.n}放進了背包）` : ''}`);
    }
  }
  // the treasure merchant of a big city: four pieces, new every three months
  merchantStock(C) {
    const G = this.G, seed = (C.id + 1) * 7919 + Math.floor(G.t / 3) * 104729; let a = seed >>> 0 || 1; const r = () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; };
    const ids = Object.keys(RELICS), maxG = Math.min(5, C.size + 1), out = [];
    for (let i = 0; i < 40 && out.length < 4; i++) { const id = ids[Math.floor(r() * ids.length)]; if (RELICS[id].grade <= maxG && !out.includes(id)) out.push(id); }
    if (r() < 0.08) { const top = ids.filter((id) => RELICS[id].grade === 5); out[out.length - 1] = top[Math.floor(r() * top.length)]; } // a piece of the top grade, rarely
    return out.sort((x, y) => RELICS[x].grade - RELICS[y].grade);
  }
  async merchant(C) {
    const H = this.H, pm = priceMul(this.g, C.id), P = (g) => Math.round(PRICE[g] * pm); H.bought ||= {};
    for (;;) {
      const key = `${C.id}:${Math.floor(this.G.t / 3)}`, stock = this.merchantStock(C).filter((id) => !(H.bought[key] || []).includes(id));
      const k = await this.ui.choose(stock.map((id) => { const R = RELICS[id], e = { id, lv: 1 }; return { k: id, n: `<span style="color:${GRADE_C[R.grade]}">${R.n}</span>`, sub: `${GRADE_N[R.grade]}・${SLOT_N[R.slot]}　${P(R.grade)} 金`, d: `${R.d}<br>${powerLinesOf(e).map((l) => `【${l.n}】${l.d}`).join('<br>')}`, off: H.gold < P(R.grade) }; }).concat([{ k: null, n: stock.length ? '離開' : '（今天的貨賣完了）離開' }]), { title: `寶物商人　金 ${H.gold}`, cls: 'wide' });
      if (!k) return;
      H.gold -= P(RELICS[k].grade); (H.bought[key] ||= []).push(k); giveRelic(this.g, k); this.g.audio.sfx('coin'); this.g.hud();
    }
  }
  async sellBag() {
    const H = this.H;
    for (;;) {
      const bag = H.bag || []; if (!bag.length) return;
      const k = await this.ui.choose(bag.map((e, i) => { const it = itemOf(e); return { k: i, n: it.shop ? it.n : `<span style="color:${it.color}">${it.n}</span>${it.lv > 1 ? ` Lv${it.lv}` : ''}`, sub: `${Math.round(it.price / 2)} 金`, d: it.shop ? `${SLOT_N[it.slot]}・商店貨` : `${GRADE_N[it.grade]}・${SLOT_N[it.slot]}　${powerLinesOf(e).map((l) => `【${l.n}】${l.d}`).join('　')}` }; }).concat([{ k: null, n: '返回' }]), { title: `出售　金 ${H.gold}`, cls: 'wide' });
      if (k == null) return;
      const e = bag[k], it = itemOf(e); if (it.grade === 6) { this.ui.toast('神器無價，不能賣'); continue; } if (!it.shop && it.grade >= 4 && !await this.ui.yesno(`真的要賣掉${GRADE_N[it.grade]}「${it.n}」嗎？`)) continue;
      H.bag.splice(k, 1); H.gold += Math.round(it.price / 2); this.g.audio.sfx('coin');
    }
  }
  async goods(C) {
    if (C.size >= 2 && C.id >= 0) { const w = await this.ui.choose([{ k: 'items', n: '道具' }, { k: 'relic', n: '寶物商人', d: '這座城的寶物商人，每三個月進一次新貨' }, { k: null, n: '離開' }], { title: `${C.name}・道具店` }); if (!w) return; if (w === 'relic') return this.merchant(C); }
    const pm = priceMul(this.g, C.id >= 0 ? C.id : null), P = (n) => Math.round(n * pm);
    for (;;) {
      const k = await this.ui.choose(shopItems().map(([id, I]) => ({ k: id, n: I.n, sub: `${P(I.price)} 金　持有 ${this.H.items[id] || 0}`, d: I.d, off: this.H.gold < P(I.price) })).concat([{ k: 'food', n: '乾糧', sub: `還剩 ${this.g.hard.days()} 天份`, d: '在野外每天都要吃。沒有糧食，士兵每天都會逃走' }, { k: null, n: '離開' }]), { title: `道具店　金 ${this.H.gold}${pm > 1.2 ? '　（饑荒，物價上漲）' : ''}` });
      if (!k) return; if (k === 'food') { await this.g.hard.buy(C); continue; } this.H.gold -= P(ITEMS[k].price); this.H.items[k] = (this.H.items[k] || 0) + 1; this.g.audio.sfx('coin');
    }
  }
  // the smith: a weapon or an armour a level better, for gold and ore; the higher levels can fail
  async forge() {
    const H = this.H, list = this.g.partyList();
    const opts = []; for (const [i, p] of list.entries()) for (const kd of ['w', 'a']) if (p.rec.eq[kd]) { const lv = forgeOf(p.rec, kd), F = FORGE[lv + 1]; opts.push({ k: `${i}${kd}`, n: `${p.g.name}　${eqName(p.rec, kd)}`, sub: F ? `→+${lv + 1}　${F[0]} 金` : '已經最強', off: !F || H.gold < F[0] || (H.items.ore || 0) < F[1] || (H.items.ore2 || 0) < F[2], d: F ? `需要 ${F[0]} 金、鐵礦石 ${F[1]}${F[2] ? `、玄鐵 ${F[2]}` : ''}　成功率 ${Math.round(F[3] * 100)}%${F[3] < 1 ? '（失敗會失去礦石）' : ''}` : '' }); }
    if (!opts.length) { this.ui.toast('沒有可以強化的武器或防具'); return; }
    const k = await this.ui.choose(opts.concat([{ k: null, n: '返回' }]), { title: `鐵匠　鐵礦石 ${H.items.ore || 0}　玄鐵 ${H.items.ore2 || 0}` }); if (!k) return;
    const p = list[+k[0]], kd = k[1], lv = forgeOf(p.rec, kd), F = FORGE[lv + 1];
    H.gold -= F[0]; H.items.ore -= F[1]; if (F[2]) H.items.ore2 -= F[2];
    this.g.audio.sfx('clash'); await this.passDays(2);
    if (Math.random() < F[3]) { (p.rec.forge ||= {})[kd] = lv + 1; this.g.audio.sfx('level'); await this.ui.say('鐵匠', `叮叮噹噹打了兩天——成了！\n${eqName(p.rec, kd)}（${kd === 'w' ? '攻擊' : '防禦'}上升）`); }
    else { H.gold += Math.round(F[0] / 2); await this.ui.say('鐵匠', '唉，火候差了一點，礦石燒壞了……錢退你一半。'); }
  }
  async inn(C) {
    const n = this.H.party.length + 1, cost = fameOf(this.H).inn ? 0 : Math.round(8 * n * priceMul(this.g, C.id >= 0 ? C.id : null));
    const c = await this.ui.choose([{ k: 'rest', n: cost ? `住宿　${cost} 金` : `住宿　免費（掌櫃：「${this.me.name}大人光臨，小店蓬蓽生輝！」）`, d: '回復策略點，兵力回復兩成五，疲勞全消，並存檔', off: this.H.gold < cost }, { k: 'food', n: '補給乾糧', sub: `${this.g.hard.days()} 天份` }, { k: 'save', n: '存檔' }, { k: null, n: '離開' }], { title: '客棧' });
    if (c === 'food') await this.g.hard.buy(C);
    if (c === 'rest') { this.H.gold -= cost; this.g.hard.rest(); for (const p of this.g.partyList()) { p.rec.sp = p.spMax; p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * 0.25)); } await this.passDays(1, '好好休息了一晚。'); this.g.saveGame(); this.ui.toast('已存檔'); }
    if (c === 'save') { this.g.saveGame() ? this.ui.toast('已存檔') : this.ui.toast('存檔失敗'); }
  }
  async tavern(C) {
    const G = this.G;
    for (;;) {
      const free = G.gens.filter((x) => x.status === 'free' && x.city === C.id && !busy(x) && !x.held);
      const c = await this.ui.choose([{ k: 'recruit', n: '招募武將', sub: `${free.length} 人`, off: !free.length }, { k: 'rumor', n: '打聽消息' }, { k: 'search', n: '四處探訪（五天）', d: '在城裡打聽寶物和人才的下落' }, { k: 'bounty', n: '懸賞告示', d: '討伐賊寇的懸賞' }, { k: 'hire', n: '募兵', d: '花錢招募義勇兵' }, { k: 'drink', n: '和同伴喝酒', d: `一起痛飲，增加好感（${10 * (this.H.party.length + 1)} 金）`, off: !this.H.party.length }, { k: null, n: '離開' }], { title: `${C.name}・酒館` });
      if (c == null) return;
      if (c === 'recruit') { const k = await this.ui.choose(free.map((x) => ({ k: x.id, n: x.name, sub: `統${x.lead} 武${x.war} 智${x.int}`, d: `政治 ${x.pol}　魅力 ${x.cha}　${G.year - x.born}歲` })).concat([{ k: null, n: '返回' }]), { title: '在野武將' }); if (k != null) await this.recruit(G.gens[k]); }
      if (c === 'rumor') await this.rumor(C);
      if (c === 'search') await this.search(C);
      if (c === 'bounty') await this.missionOffer(C, null);
      if (c === 'hire') await this.draft(C, false);
      if (c === 'drink') await drink(this.g);
    }
  }
  async rumor(C) {
    const G = this.G, hid = G.items.filter((it) => it.city != null), free = G.gens.filter((x) => x.status === 'free' && !busy(x) && x.lead + x.war + x.int > 210);
    const lines = [];
    if (hid.length && Math.random() < 0.6) { const it = pick(hid); lines.push(`聽說「${itemName(it.key)}」藏在${G.cities[it.city].name}一帶。`); }
    if (free.length) { const x = pick(free); lines.push(`有個叫${x.name}的人物，現在在${G.cities[x.city].name}。`); }
    const strong = Object.values(G.factions).filter((f) => f.alive).sort((a, b) => power(G, b.id) - power(G, a.id))[0];
    if (strong) lines.push(`現在天下最強的是${strong.name}，擁有 ${citiesOf(G, strong.id).length} 座城。`);
    if (this.H.news[0]) lines.push('最近：' + this.H.news[0].split('　').slice(1).join('　'));
    if (Math.random() < 0.35) lines.push(sageRumor(this.g));
    { const h = this.g.arena.hint(); if (h) lines.push(h, h); }
    const sick = G.cities.filter((c) => disasterAt(this.g, c.id)); if (sick.length) { const c = pick(sick); lines.push(`${c.name}正在鬧${DIS_N[disasterAt(this.g, c.id).k]}，聽說守軍也人心惶惶。`); }
    const said = hasT(this.H, 'bowen') ? [...new Set([pick(lines), pick(lines)])] : [pick(lines)];
    await this.ui.say('酒館老闆', said.filter(Boolean).join('\n') || '最近沒什麼新鮮事。');
  }
  async search(C) {
    const G = this.G, me = this.me, hid = G.items.filter((it) => it.city === C.id);
    await this.passDays(5, `${me.name}在${C.name}四處探訪……`);
    if (hid.length && Math.random() < 0.25 + me.int / 400 + me.cha / 800) {
      const it = pick(hid); give(G, it, me); this.H.fame += 30; me.merit += 5;
      record(G, 'item', 'itemFind', { g: me.name, c: C.name, it: it.key }, this.g.myFaction(), 2, { g: me.id });
      this.g.audio.sfx('level'); await this.ui.say('', `發現了寶物「${itemName(it.key)}」！\n${Object.entries(it.fx).map(([k, v]) => `${STAT_N[k]} +${v}`).join('　')}`);
    } else if (Math.random() < 0.35) { const n = rint(30, 120); this.H.gold += n; await this.ui.say('', `沒找到什麼特別的，倒是撿到了 ${n} 金。`); }
    else await this.ui.say('', '什麼也沒找到。');
  }
  async drill(C) {
    const G = this.G, me = this.me, mine = this.g.myFaction();
    const c = await this.ui.choose([{ k: 'train', n: '操練（三天）', d: '和城裡的士兵演練，得到經驗' }, { k: null, n: '離開' }], { title: `${C.name}・練兵場` });
    if (c !== 'train') return;
    const lv = this.g.partyList().reduce((s, p) => s + p.rec.lv, 0) / (this.H.party.length + 1);
    const foes = Array.from({ length: Math.min(4, this.H.party.length + 1) }, (_, i) => this.foe('練兵士兵', 'soldier', Math.max(1, Math.round(lv)), C.owner ? G.factions[C.owner].color : '#8a6a4a'));
    const saved = this.g.partyList().map((p) => p.rec.sol);
    const r = await this.fight(foes, { terrain: 'plain', title: '操練開始！', drill: true });
    this.g.partyList().forEach((p, i) => { p.rec.sol = saved[i]; });
    await this.passDays(3);
  }
  // ---------------------------------------------------------------- time passing (in town: rest, work, search)
  async passDays(n, msg) {
    if (msg) this.ui.toast(msg);
    for (let i = 0; i < n; i++) { this.g.roam.step(30); this.g.crowd.step(30); this.H.days++; this.g.hard.dayIn(1); if (this.H.days % 30 === 0) { this.g.monthTick(); if (this.g.mode === 'title') return; } }
    this.g.hud();
  }
  // ---------------------------------------------------------------- missions: a bandit chief somewhere near a city
  async missionOffer(C, f) {
    const H = this.H, open = H.missions.filter((m) => !m.done);
    if (open.length >= 3) { await this.ui.say('', '你手上的任務已經夠多了。先完成它們吧。'); return; }
    const m = this.newMission(C, !!f);
    if (!m) { await this.ui.say('', '附近很太平，沒有需要討伐的賊寇。'); return; }
    const dir = (() => { const c = C.pos || CITY_POS[C.id], dx = m.x - c.x, dz = m.z - c.y; return (Math.abs(dz) > Math.abs(dx) / 2 ? (dz < 0 ? '北' : '南') : '') + (Math.abs(dx) > Math.abs(dz) / 2 ? (dx < 0 ? '西' : '東') : ''); })();
    if (await this.ui.yesno(`${C.name}${dir}方約 ${Math.round(Math.hypot(m.x - (C.pos || CITY_POS[C.id]).x, m.z - (C.pos || CITY_POS[C.id]).y))} 里處，「${m.boss}」率領賊眾作亂。\n報酬：${m.gold} 金${f ? `、功績 ${m.merit}` : ''}、名聲 ${m.fame}\n要接下這個任務嗎？`)) { H.missions.push(m); this.ui.toast('接下了任務。（地圖上以黑旗標示）'); }
  }
  newMission(C, official) {
    const W = this.g.world, c = C.pos || CITY_POS[C.id], lv0 = 0, lv = Math.round(this.g.partyList().reduce((s, p) => s + p.rec.lv, 0) / (this.H.party.length + 1)) + 2;
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2, d = (8 + Math.random() * 12) * Math.sqrt(K), x = Math.round(c.x + Math.cos(a) * d), z = Math.round(c.y + Math.sin(a) * d);
      const t = W.at(x, z); if (![T.PLAIN, T.MEADOW, T.FOREST, T.HILL, T.DESERT].includes(t)) continue;
      const kind = pick(['bandit', 'turban', 'bandit', 'pirate']), boss = `${pick(['惡虎', '黑風', '赤眉', '獨眼', '鐵臂', '白狼', '飛天'])} ${pick([...SUR])}${pick([...GIV])}`;
      const mul = tire(this.H, 'bandit') * eraBonus(this.G, 'bandit');   // the same work again pays less; hard times pay more
      return { id: Date.now() + k, city: C.id, x, z, boss, kind, lv, gold: Math.round((120 + lv * 35) * mul), merit: official ? Math.round(10 * mul) : 0, fame: Math.round((30 + lv * 2) * mul), official };
    }
    return null;
  }
  dropBanner(m) { if (this.g.mode !== 'world') return; const p = this.g.view.M.props?.find((q) => q.kind === 'banner' && q.x === m.x && q.z === m.z && !q.obj?.userData.gone); if (p) this.g.view.removeProp(p); }
  async missionFight(m) {
    if (m.rise != null && await this.g.unrest.camp(m)) return;
    const n = Math.min(5, 2 + Math.floor(m.lv / 8)), foes = [this.foe(m.boss, m.kind === 'pirate' ? 'pirate' : m.kind, m.lv + 2, null, true)];
    for (let i = 1; i < n; i++) foes.push(this.foe(m.minion || (m.kind === 'turban' ? '黃巾賊' : m.kind === 'pirate' ? '海賊' : '山賊'), m.kind, m.lv));
    const r = await this.fight(foes, { terrain: this.terrainAt(), title: `「${m.boss}」率領賊眾殺了過來！`, noFlee: false });
    if (r === 'win') {
      if (hasT(this.H, 'xiake')) { m.gold = Math.round(m.gold * 1.25); m.fame = Math.round(m.fame * 1.25); }
      if (Math.random() < 0.35) { const id = rollRelic(m.lv, 2); giveRelic(this.g, id); }
      m.done = true; this.H.gold += m.gold; this.H.fame += m.fame; this.H.st.missions++; tired(this.H, 'bandit'); if (m.official && this.me.status === 'serving') { this.me.merit += Math.round(m.merit * (1 + partyFx(this.g, 'merit'))); this.promote(); }
      await this.ui.say('', `討伐了「${m.boss}」！\n得到 ${m.gold} 金${m.official ? `、功績 ${m.merit}` : ''}、名聲 ${m.fame}。`);
      this.dropBanner(m);
      this.H.missions = this.H.missions.filter((x) => !x.done);
      if (m.story != null) await this.g.stories.done(m.story);
    }
  }
  // ---------------------------------------------------------------- fights on the road
  terrainAt() { const P = this.g.pos, W = this.g.world, k = W.at(P.x, P.z); if (k === T.BRIDGE || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => W.at(P.x + dx, P.z + dz) === T.RIVER)) return 'river'; return { 4: 'forest', 5: 'hill', 8: 'desert', 13: 'marsh', 12: 'coast', 7: 'snow', 6: 'hill' }[k] || (P.z < 30 && this.g.world.at(P.x, P.z - 2) === T.SNOW ? 'snow' : 'plain'); }
  foe(name, kind, lv, color, boss) {
    lv = Math.max(1, lv + diff(this.g).lv);
    const beast = BEASTS.includes(kind), K = boss ? 1.25 : 1, r = Math.random;
    const war = Math.min(99, Math.round((34 + lv * 1.5 + r() * 14) * K)), lead = Math.min(99, Math.round((28 + lv * 1.25 + r() * 14) * K)), int = beast ? 5 : Math.min(95, Math.round(15 + r() * 30 + (boss ? 15 : 0) + lv * 0.4));
    const solMax = Math.round((beast ? 80 + lv * 32 : 100 + lead * 4 + lv * 34) * (boss ? 1.6 : 1));
    const look = beast ? null : kind === 'soldier' ? LOOKS.soldier(color || '#8a6a4a') : (LOOKS[kind] || LOOKS.bandit)();
    if (boss && look) look.key += 'boss';
    return { name, look, beast: beast ? kind : null, solKind: beast ? null : kind, color: color || null, lv, war, lead, int, sol: solMax, solMax, sp: Math.round(int * 0.9 + lv), boss, solLook: look ? { ...look, small: true, key: look.key + 's' } : null, wpn: Math.round(lv / 3), arm: Math.round(lv / 4) };
  }
  async encounter(region, tile) {
    const types = FOES[region] || FOES.central, [base, kind] = pick(types), lv0 = this.g.partyList().reduce((s, p) => s + p.rec.lv, 0) / (this.H.party.length + 1);
    const awe = fameOf(this.H).awe || 0;
    if (awe && !BEASTS.includes(kind) && Math.random() < awe) { const n = 20 + Math.round(Math.random() * 30 + lv0 * 4); this.H.gold += n; this.H.fame += 1; this.H.st.bandits += 2; this.g.audio.sfx('coin'); this.ui.toast(`<b>${base}</b>聽說來的是「${fameName(this.H)}」的${this.me.name}，嚇得丟下財物逃走了！<br><small>不戰而勝　金 +${n}</small>`, 3500); return; }
    const n = 1 + Math.floor(Math.random() * Math.min(4, this.H.party.length + 2)), foes = [];
    for (let i = 0; i < n; i++) { const lv = Math.max(1, Math.round(lv0 + (Math.random() * 3 - 1))); foes.push(this.foe(i === 0 && n > 2 && !BEASTS.includes(kind) ? base + '頭目' : base, kind, lv, null, i === 0 && n > 2 && !BEASTS.includes(kind))); }
    this.g.audio.sfx('encounter');
    const r = await this.fight(foes, { terrain: this.terrainAt() });
    if (r === 'win' && !BEASTS.includes(kind)) this.H.st.bandits += foes.length;
  }
  // run a battle and hand out the spoils; returns the result
  // a battle that goes wrong must not leave the game locked: back to the map, as if the party had withdrawn
  async fight(foes, o = {}) {
    try { return await this.fight0(foes, o); }
    catch (e) { console.error(e); const g = this.g; try { g.battle.close(); } catch (e2) {} g.mode = g.town ? 'town' : 'world'; g.locked = false; await this.ui.fade(0, 100); g.hud(); return 'flee'; }
  }
  async fight0(foes, o = {}) {
    const g = this.g, G = this.G; o = { night: g.night(), wx: g.wx(), ...o }; g.mode = 'battle'; g.locked = true;
    await this.ui.fade(1, 250); if (!o.drill) g.hard.battleStart(foes);
    const party = g.partyList(), f = g.myFaction() && G.factions[g.myFaction()];
    const res = g.battle.run(party, foes, { ...o, color: f ? f.color : '#5a6a8a' });
    await this.ui.fade(0, 250);
    const out = await res;
    this.H.st.battles++;
    let msg = '', ups = [];
    if (out.result === 'win') {
      this.H.st.wins++;
      const exp = Math.round(foes.reduce((s, x) => s + 10 + x.lv * 7 + x.solMax / 22, 0) * (o.drill ? 0.6 : 1) * (hasT(this.H, 'baizhan') ? 1.1 : 1) * (1 + partyFx(g, 'exp'))), gold = o.drill ? 0 : Math.round(foes.reduce((s, x) => s + x.lv * 6 + Math.random() * x.lv * 5, 0) * (1 + partyFx(g, 'gold')) * diff(g).gold);
      this.H.gold += gold; this.H.fame += o.drill ? 0 : Math.round(foes.length * (1 + partyFx(g, 'fame')));
      for (const p of party) for (const u of gainExp(G, p.g, p.rec, exp)) { ups.push(`${p.g.name} 升到 Lv${u.lv}！${u.grow.map((k) => STAT_N[k] + '+1').join(' ')}`); const aw = awaken(p.g, p.rec, u.lv); if (aw) { ups.push(`★ ${p.g.name}覺醒了！特性「${aw.old}」→「${aw.nu}」`); setTimeout(() => this.ui.banner(`<b style="color:#ffc84a;font-size:20px">★ 覺醒 ★</b><br>${p.g.name}的「${aw.old}」覺醒為「${aw.nu}」`, 6000), 400); } }
      msg = `勝利！\n經驗 +${exp}${gold ? `　金 +${gold}` : ''}${ups.length ? '\n' + ups.join('\n') : ''}`;
      if (ups.length) g.audio.sfx('level');
      // now and then the defeated leave something behind
      if (!o.drill && Math.random() < 0.15) { const it = pick(['med', 'med', 'rice', 'book', 'med2']); this.H.items[it] = (this.H.items[it] || 0) + 1; msg += `\n得到了${ITEMS[it].n}。`; }
      // a treasure left on the field: likelier from a named general or a chief
      const named = foes.some((x) => x.gid != null || x.boss), chance = (named ? 0.14 : 0.05) + partyFx(g, 'drop');
      if (!o.drill && !o.noRelic && Math.random() < chance) { const id = rollRelic(this.avgLv(), named ? 2 : 1); giveRelic(g, id, true); msg += `\n得到寶物「<b style="color:${GRADE_C[RELICS[id].grade]}">${RELICS[id].n}</b>」！（${GRADE_N[RELICS[id].grade]}・${SLOT_N[RELICS[id].slot]}）`; }
      // a jackpot: very rarely, a treasure of the top grades from any fight (likelier from a general or a chief)
      if (!o.drill && !o.noRelic && Math.random() < ((named ? 0.04 : 0.012) + partyFx(g, 'drop') / 4) / 5) { const id = jackpot(g); msg += `\n★ 天降至寶！得到「<b style="color:${GRADE_C[RELICS[id].grade]}">${RELICS[id].n}</b>」（${GRADE_N[RELICS[id].grade]}）！`; }
      // a 神器: hardly ever, unless the party is set on finding treasure
      if (!o.drill && !o.noRelic) { const id = tryUlt(g, named ? 'named' : 'fight'); if (id) msg += `
★★ 神器現世！得到「<b style="color:${GRADE_C[6]}">${RELICS[id].n}</b>」！`; }
      // beaten generals now and then leave their own famous treasure behind (Red Hare from Lü Bu…)
      if (!o.drill && !o.noRelic) for (const u of foes) { if (u.gid == null) continue; const own = G.items.filter((it) => it.holder === u.gid); if (own.length && Math.random() < 0.06) { const it = own[Math.floor(Math.random() * own.length)]; give(G, it, this.me); this.H.fame += 30; msg += `\n★ ${G.gens[u.gid].name}敗走，丟下了「${itemName(it.key)}」！`; g.audio.sfx('level'); this.ui.banner(`<b style="color:#ffc84a;font-size:20px">★ 奪得名寶 ★</b><br>${G.gens[u.gid].name}的「${itemName(it.key)}」歸你了！`, 6500); break; } }
      const mend = partyFx(g, 'mend'); if (mend && !o.drill) { for (const p of party) p.rec.sol = Math.min(p.solMax, p.rec.sol + Math.round(p.solMax * mend)); msg += `\n救護兵醫治了傷兵（兵力 +${Math.round(mend * 100)}%）。`; }
      if (!o.drill) { const ru = relicExp(g, 1 + foes.length); if (ru.length) msg += '\n' + ru.join('\n'); }
    }
    if (!o.drill) {
      for (const p of party) { if (p.g.id !== this.H.pid) { mark(g, p.g.id, 3); if (out.result === 'win') addBond(g, p.g.id, 2); } }
      for (const u of out.foes || []) if (u.gid != null) { mark(g, u.gid, 2); if (out.result === 'win' && u.sol <= 0) versus(g, u.gid, true); if (out.result === 'lose') versus(g, u.gid, false); g.nemesis.note(u.gid, out.result === 'win', u.sol <= 0); }
    }
    await g.battle.say(out.result === 'win' ? '勝利！' : out.result === 'lose' ? '全軍潰敗……' : '撤退了。', 700);
    g.battle.close(); g.mode = g.town ? 'town' : 'world'; g.audio.music(g.town ? 'town' : 'field');
    if (msg) await this.ui.say('', msg);
    await g.hard.after(out, o);
    if (out.result === 'lose' && !o.drill && !o.siegeOf) await this.defeat();
    if (!o.drill) g.hard.battleEnd();
    g.locked = false; g.hud();
    checkTitles(g); if (!o.drill) await offerOaths(g);
    out.result && (this.last = out);
    return out.result;
  }
  // beaten: wake up in the nearest friendly city, poorer
  async defeat() {
    const G = this.G, lost = Math.round(this.H.gold * 0.3); this.H.gold -= lost;
    for (const p of this.g.partyList()) p.rec.sol = Math.max(30, Math.round(p.solMax * 0.15));
    const mine = this.g.myFaction(), P = this.g.pos;
    const cs = G.cities.filter((c) => !mine ? true : c.owner === mine); const near = (cs.length ? cs : G.cities).sort((a, b) => Math.hypot(CITY_POS[a.id].x - P.x, CITY_POS[a.id].y - P.z) - Math.hypot(CITY_POS[b.id].x - P.x, CITY_POS[b.id].y - P.z))[0];
    this.H.wound = G.t + 3;
    await this.ui.say('', `${this.me.name}好不容易逃了出來，在${near.name}養傷。\n（失去了 ${lost} 金。身受重傷，三個月內攻擊、防禦下降；找華佗、于吉或吃仙丹可以治好）`);
    this.g.enterTown(near.id, true);
  }
  // ---------------------------------------------------------------- a city on the land: go in, or lay siege
  async cityGate(cid) {
    const G = this.G, C = G.cities[cid], mine = this.g.myFaction(), f = C.owner && G.factions[C.owner], me = this.me;
    if (C.owner && C.owner !== mine && !(await this.g.outlaws.gate(C))) { this.stepBack(); return; }
    const enemy = f && mine ? hostile(G, mine, f.id) && C.owner !== mine : !!f && !mine;
    const canSiege = f && C.owner !== mine && !(mine && allied(G, mine, f.id)) && (mine ? (this.g.isLord() || rankOf(me.merit) >= SIEGE_RANK) : this.H.fame >= 100);
    if (f && C.owner !== mine && (canSiege || enemy)) {
      const opts = [{ k: 'in', n: '進城' }, ...(canSiege ? [{ k: 'siege', n: mine ? '攻城' : '攻城（自立為王）' }] : []), { k: null, n: '離開' }];
      const why = !canSiege ? (mine ? (allied(G, mine, f.id) ? '（同盟勢力）' : '（升為校尉才能率軍攻城）') : '（名聲 100 以上才能號召兵馬攻城）') : '';
      const dz = disasterAt(this.g, C.id);
      const c = await this.ui.ask(`${C.name}　${f.name}軍　兵 ${C.troops}　城防 ${C.def}${bLv(C, 'def') ? `（城郭 Lv${bLv(C, 'def')}）` : ''}　訓練 ${C.train}${why}${dz ? `\n城裡正在鬧${DIS_N[dz.k]}，守軍士氣低落（攻城有利）` : ''}`, opts);
      if (c === 'siege') { await this.siege(C); return; }
      if (c !== 'in') { this.stepBack(); return; }
    }
    await this.ui.fade(1, 200); this.g.enterTown(cid); await this.ui.fade(0, 200);
  }
  stepBack() { const P = this.g.pos, c = CITY_POS[this.world().cityAt(P.x, P.z)], R = c && c.size >= 3 ? 2 : 1; if (c) { [P.x, P.z] = this.g.cityExit(c.id); } this.g.tiles = this.g.tiles.map(() => [P.x, P.z]); this.g.prevTiles = null; this.g.place(1); this.g.camTo(P.x, P.z, true); }
  world() { return this.g.world; }
  // the defenders of a city: its best generals with the garrison shared between them, or the garrison alone
  // (six in ten of the city's soldiers man the walls; the rest are held back)
  defenders(C) {
    const G = this.G, f = C.owner && G.factions[C.owner];
    const gs = G.gens.filter((x) => x.status === 'serving' && x.city === C.id && x.fac === C.owner && !busy(x)).sort((a, b) => (b.lead + b.war) - (a.lead + a.war)).slice(0, 5);
    if (!gs.length) { const n = C.troops > 6000 ? 3 : 2, lv = Math.round(this.g.partyList()[0].rec.lv); return Array.from({ length: n }, (_, i) => { const u = this.foe(i ? '守備兵' : '守備隊長', 'soldier', lv, f ? f.color : '#8a7a6a', !i); u.sol = u.solMax = Math.max(200, Math.round(Math.min(C.troops * 0.6, 7000) / n)); return u; }); }
    const lead = gs.reduce((s, x) => s + x.lead, 0);
    return gs.map((x) => { const lv = this.lvOf(x), rec = { lv, eq: {} }, max = solMax(x, rec), sol = Math.max(200, Math.min(Math.round(max * 1.6), Math.round(C.troops * 0.6 * x.lead / lead)));
      return { name: x.name, look: this.g.lookOf(x), lv, war: x.war, lead: x.lead, int: x.int, sol, solMax: sol, sp: Math.round(spMax(x, rec)), spells: x.spells, gid: x.id, color: f.color, wpn: Math.round(lv / 4), arm: Math.round(lv / 4) }; });
  }
  async siege(C) {
    const G = this.G, me = this.me, f = C.owner && G.factions[C.owner], sol = this.g.partyList().reduce((s, p) => s + p.rec.sol, 0);
    if (sol < 300) { await this.ui.say('', '兵力太少了，先去徵兵或募兵吧。'); this.stepBack(); return; }
    await this.g.board.beforeSiege(C);
    const foes = this.defenders(C), gm = garrisonMul(this.g, C.id) * this.g.board.gapMul(C.id);
    if (gm < 1) for (const u of foes) { u.sol = u.solMax = Math.round(u.solMax * gm); }
    { const wall = 8 + Math.min(C.def, 1800) / 45 + bLv(C, 'def') * 6, drill = 0.85 + C.train / 330; for (const u of foes) { u.wall = Math.round(wall); u.war = Math.round(u.war * drill); } }
    const before = C.troops;
    const r = await this.fight(foes, { terrain: 'city', siege: { color: f ? f.color : '#8a7a6a' }, title: `進攻${C.name}！`, siegeOf: C.id });
    const out = this.last;
    // the garrison lost what the defenders lost
    const lost = (out?.foes || foes).reduce((s, u) => s + (u.solMax - Math.max(0, u.sol)), 0); C.troops = Math.max(0, before - lost);
    if (r === 'win') await this.conquer(C, out.foes.filter((u) => u.gid != null).map((u) => G.gens[u.gid]));
    else if (r === 'lose') { await this.ui.say('', `攻打${C.name}失敗了……`); C.def = Math.max(0, C.def - 30); this.stepBack(); for (const p of this.g.partyList()) p.rec.sol = Math.max(20, p.rec.sol); }
    else this.stepBack();
  }
  async conquer(C, beaten) {
    const G = this.G, me = this.me, prev = C.owner, pf = prev && G.factions[prev];
    let mine = this.g.myFaction();
    // rising on one's own: the first city makes a warlord
    if (!mine) mine = this.found(C);
    const F = G.factions[mine];
    C.owner = mine; C.troops = Math.max(800, Math.round(C.troops * 0.3) + 500); C.morale = Math.max(20, C.morale - 15); C.def = Math.max(50, C.def - 60);
    record(G, 'war', 'warWin', { f: F.name, g: me.name, c: C.name, o: pf ? pf.name : null, notes: [] }, mine, 2, { city: C.id, from: C.id, srcs: [], win: true, def: prev });
    this.H.st.cities.push(C.name); this.H.fame += 80 + C.size * 30; const after = this.g.board.conquered(C, prev); deed(this.g, `攻拔${C.name}`, C.size >= 3); if (!this.g.isLord()) { me.merit += Math.round((40 + C.size * 15) * (1 + partyFx(this.g, 'merit'))); this.promote(); }
    await this.ui.say('', `攻下了${C.name}！${F.name}軍的旗幟插上了城頭。\n${after}`);
    // the generals who fought for the city: win them over, let them go, or put them to death
    for (const x of beaten) {
      if (x.status !== 'serving' || x.fac !== prev) continue;
      const isLord = pf && pf.lord === x.id, p = isLord ? 0.04 : clamp(0.25 + (me.cha - x.loyalty) / 160 + (fameOf(this.H).defect || 0), 0.03, 0.92);
      const c = await this.ui.ask(`俘虜了${x.name}（${isLord ? pf.name + '軍之主' : pf.name + '軍'}）。要怎麼處置？\n統${x.lead} 武${x.war} 智${x.int}　招降成功率 ${Math.round(p * 100)}%`, [{ k: 'win', n: '招降' }, { k: 'free', n: '釋放' }, { k: 'kill', n: '斬首' }], x.name, this.g.lookOf(x));
      mark(this.g, x.id, 2);
      if (c === 'kill') { die(G, x, 'executed', me); this.H.st.kills.push(x.name); this.H.fame += 10; bump(this.H, 'cruel'); deed(this.g, `斬降將${x.name}`); continue; }
      if (c === 'free') { bump(this.H, 'ren'); addBond(this.g, x.id, 20); }
      if (c === 'win' && Math.random() < p) { serve(G, x, mine, C.id, 60 + Math.round(Math.random() * 20)); record(G, 'join', 'captive', { g: x.name, f: F.name }, mine, 2, { g: x.id }); mark(this.g, x.id, 3); if (x.lead + x.war + x.int > 220) deed(this.g, `降${x.name}`); await this.ui.say(x.name, '……我願意歸順。', this.g.lookOf(x)); continue; }
      if (c === 'win') await this.ui.say(x.name, '要殺就殺，我絕不投降！', this.g.lookOf(x));
      // released (or refused): back to their own lord if they still have a city, otherwise free
      const home = pf && citiesOf(G, prev).sort((a, b) => Math.hypot(a.x - C.x, a.y - C.y) - Math.hypot(b.x - C.x, b.y - C.y))[0];
      if (home) x.city = home.id; else { x.status = 'free'; x.fac = null; x.city = pick(C.adj); }
    }
    pickGovernor(G, C); checkTitles(this.g);
    if (pf && pf.alive && citiesOf(G, prev).length === 0) { destroy(G, prev, mine, 'lastCity', { f: pf.name, c: C.name }); deed(this.g, `滅${pf.name}`, true); }
    F.peak = Math.max(F.peak || 1, citiesOf(G, mine).length);
    this.g.refreshCities?.(); this.g.hud();
    await this.ui.fade(1, 200); this.g.enterTown(C.id); await this.ui.fade(0, 200);
  }
  // a warlord of one's own: a new faction with the player as its lord
  found(C) {
    const G = this.G, me = this.me, id = 'pl' + me.id, colors = ['#e8a030', '#30c8e8', '#e830a0', '#a0e830'];
    G.factions[id] = { id, name: me.name, lordName: me.name, color: colors[me.id % colors.length], lord: me.id, alive: true, gold: 600, food: 4000, rel: {}, allies: {}, truce: {}, capital: C.id, born: G.t, peak: 1, aggr: 1 };
    for (const o of Object.values(G.factions)) if (o.id !== id) { G.factions[id].rel[o.id] = 0; o.rel[id] = 0; }
    if (C.owner) { G.factions[id].rel[C.owner] = G.factions[C.owner].rel[id] = -60; }
    serve(G, me, id, C.id, 100);
    for (const x of this.H.party) serve(G, G.gens[x], id, C.id, 90);
    record(G, 'rise', 'rise', { f: me.name, c: C.name }, id, 3); deed(this.g, `於${C.name}起兵，自立為王`, true);
    this.ui.toast(`<b style="color:#ffd86a">${me.name}在${C.name}起兵，自立為王！</b>`, 5000);
    return id;
  }
}
