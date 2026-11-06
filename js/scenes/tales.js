// 虛擬名場面: stories that the histories never told, but could have happened in an age like that one. Each happens
// once a game, by chance, when the place and the time suit it — and never two within a few months of each other.
import { LOOKS } from '../sprites.js';
import { citiesOf } from '../sim/engine.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cool = (s) => (s.H.taleT ?? -99) + 4 <= s.G.t;
const begin = (s) => { s.H.taleT = s.G.t; };
const lordHere = (s) => { if (!s.serving() || s.g.isLord()) return null; const f = s.G.factions[s.me.fac], L = s.G.gens[f.lord]; return s.g.town?.city === L.city ? L : null; };

export const TALES = [
  // ---------------------------------------------------------------- 夜宴刺客
  { id: 't_banquet', when: 'town', ok: (s) => cool(s) && !!lordHere(s) && s.chance(0.12),
    async run(s) {
      begin(s); const L = lordHere(s), look = LOOKS.bandit();
      await s.say('', `${L.name}在府中大宴群臣。酒過三巡，幾個舞劍助興的人忽然變了臉色——\n劍鋒一轉，直刺主公！`);
      const r = await s.battle([s.foe('刺客首領', 'bandit', null, 4), s.foe('刺客', 'bandit', null, 2), s.foe('刺客', 'bandit', null, 2)], { title: '保護主公！', terrain: 'city', noFlee: true, night: true });
      if (r !== 'win') { await s.say('', '刺客趁亂逃走了，主公受了輕傷。'); return; }
      s.merit(60); s.fame(60); s.H.susp = Math.max(0, (s.H.susp || 0) - 40); s.gold(300);
      await s.say(L.name, `今天要不是你，我已經是個死人了。\n${s.me.name}的忠心，從今以後誰也不許懷疑！（功績 +60、金 +300，主公的猜忌大減）`, L);
    } },
  // ---------------------------------------------------------------- 黃河鬼船
  { id: 't_ghostship', when: 'month', ok: (s) => cool(s) && s.onLand() && s.north() && s.g.night() && s.year >= 185 && s.chance(0.1),
    async run(s) {
      begin(s);
      await s.say('', '深夜的黃河上漂來一條沒有槳手的大船，船頭點著綠幽幽的燈籠。\n船上傳來唸咒的聲音：「蒼天已死，黃天當立……」');
      if (!await s.yes('要登上鬼船看個究竟嗎？')) { await s.say('', '那條船順著河水漂遠了，燈籠一盞一盞熄滅。'); return; }
      const lv = s.g.act.avgLv() + 4, sorc = (n, b) => { const f = s.g.act.foe(n, 'turban', lv + (b ? 3 : 0), null, b); f.int = Math.min(98, 75 + lv / 2); f.spells = ['lei', 'huan']; f.sp = 200; return f; };
      const ok = await s.waves([() => [sorc('太平道術士'), sorc('太平道術士'), s.foe('黃巾死士', 'turban', null, 2)], () => [sorc('鬼面大祭司', true), sorc('太平道術士')]], { titles: ['太平道的術士！', '船艙深處的大祭司！'], terrain: 'river', night: true });
      if (!ok) return;
      const n = s.relic(3, 6); s.fame(90);
      await s.say('', `大祭司倒下了，船上的燈籠一齊熄滅。艙底藏著一個貼滿符咒的箱子——\n得到了「${n}」！`);
    } },
  // ---------------------------------------------------------------- 雪夜孤城
  { id: 't_snowtown', when: 'month', ok: (s) => cool(s) && s.onLand() && s.north() && s.season(12, 1, 2) && s.chance(0.12),
    async run(s) {
      begin(s); const q = s.g.world.places.filter((p) => p.kind === 'county').sort((a, b) => Math.hypot(a.x - s.g.pos.x, a.y - s.g.pos.z) - Math.hypot(b.x - s.g.pos.x, b.y - s.g.pos.z))[0];
      await s.say('縣令', `大雪封山的夜裡，烏桓的騎兵包圍了${q?.name || '這座小縣城'}！城裡只剩三百個守兵……\n壯士，求你幫我們守到天亮！`, '縣令');
      if (!await s.yes('要留下來守城嗎？（三波攻城，中間不能休息）')) { await s.say('', '你頭也不回地走進了風雪裡。'); s.fame(-10); return; }
      const nomad = (n, p, b) => s.foe(n, 'nomad', '#8a6a3a', p);
      const ok = await s.waves([() => [nomad('烏桓騎兵', 1), nomad('烏桓騎兵', 1)], () => [nomad('烏桓騎兵', 2), nomad('烏桓騎兵', 2), nomad('烏桓弓騎', 2)], () => [nomad('烏桓大人', 5), nomad('烏桓親衛', 3), nomad('烏桓親衛', 3)]], { titles: ['第一波：烏桓騎兵衝向城門！', '第二波：他們又來了！', '天快亮了……烏桓大人親自殺來！'], terrain: 'snow', noFlee: true, wx: 'snow' });
      if (!ok) { await s.say('', '城門被衝破了……'); return; }
      s.fame(150); s.gold(400); s.item('med2', 2); s.exp(60);
      await s.say('縣令', '天亮了！烏桓人退了！\n恩公，全城的百姓都會記住您！（名聲 +150、金 +400）', '縣令');
    } },
  // ---------------------------------------------------------------- 海賊王
  { id: 't_pirate', when: 'town', ok: (s) => cool(s) && s.coast() && s.chance(0.12),
    async run(s) {
      begin(s); const look = LOOKS.pirate();
      await s.say('', '港口忽然響起了警鐘——幾十條海賊船衝進了港灣，船頭插著一面畫著鯊魚的黑旗。\n「是『鬼鯊』！東海的海賊王！」');
      if (!await s.yes('要上船迎戰海賊嗎？')) return;
      const ok = await s.waves([() => [s.foe('海賊', 'pirate', null, 1), s.foe('海賊', 'pirate', null, 1), s.foe('海賊', 'pirate', null, 2)], () => [s.foe('鬼鯊的副手', 'pirate', null, 4), s.foe('海賊', 'pirate', null, 2)]], { titles: ['海賊登岸了！', '旗艦上的精銳！'], terrain: 'coast' });
      if (!ok) return;
      await s.say('鬼鯊', '有兩下子！敢不敢和我一對一？贏了，我的寶藏都歸你！', look);
      const r = await s.duelWith('海賊王「鬼鯊」', look, s.g.act.avgLv() + 6, 92, 75, 55);
      if (r !== 'win') { s.fame(60); await s.say('鬼鯊', '哈哈哈！下次再來吧！', look); return; }
      const n = s.relic(3, 6); s.gold(800); s.fame(140);
      await s.say('', `鬼鯊跪在甲板上投降了。船艙裡堆滿了搶來的金銀珠寶——\n得到 800 金和「${n}」！`);
    } },
  // ---------------------------------------------------------------- 古墓寶藏
  { id: 't_tomb', when: 'month', ok: (s) => cool(s) && s.onLand() && s.year >= 185 && s.chance(0.07),
    async run(s) {
      begin(s); const old = LOOKS.villager('盜墓老人');
      await s.say('老人', '年輕人……我快死了。這張羊皮圖，是我在一座古墓裡畫的。\n那是春秋時一位將軍的墓，他的兵器還在裡面……可是墓裡有機關，還有守墓的東西……', old);
      if (!await s.yes('要照著地圖去找古墓嗎？（要走五天）')) return;
      await s.g.act.passDays(5);
      await s.say('', '古墓的入口藏在一棵老槐樹下。墓道又黑又長，地上鋪著一塊塊的石板。');
      const t1 = await s.ask('石板上刻著奇怪的花紋——', [{ k: 'int', n: '仔細看看花紋（智力）' }, { k: 'run', n: '快步衝過去（武力）' }]);
      if (!(t1 === 'int' ? s.check('int', 70) : s.check('war', 75))) { for (const p of s.g.partyList()) p.rec.sol = Math.round(p.rec.sol * 0.75); await s.say('', '石板翻了過來，下面是一排尖刀！（兵力 -25%）'); }
      else await s.say('', '你們平安地通過了墓道。');
      const t2 = await s.ask('墓室的門上有三個銅環：一個刻著龍，一個刻著虎，一個刻著龜。', [{ k: 'dragon', n: '拉龍環' }, { k: 'tiger', n: '拉虎環' }, { k: 'turtle', n: '拉龜環' }]);
      if (t2 !== 'turtle' && !s.check('int', 85)) { await s.say('', '門頂射出一排毒箭！'); for (const p of s.g.partyList()) p.rec.sol = Math.round(p.rec.sol * 0.8); }
      else await s.say('', '「將軍之墓，以守為上」——龜環一拉，石門緩緩打開了。');
      const r = await s.battle([s.foe('守墓白虎', 'whitetiger', null, 5), s.foe('墓中巨蛇', 'snake', null, 3)], { title: '守墓的猛獸！', terrain: 'cave' });
      if (r !== 'win') return;
      const n = s.relic(4, 8); s.fame(100);
      await s.say('', `石棺旁邊放著一件兵器，兩千年了，還閃著寒光——\n得到了「${n}」！`);
    } },
  // ---------------------------------------------------------------- 名醫被綁
  { id: 't_doctor', when: 'town', ok: (s) => cool(s) && s.chance(0.1),
    async run(s) {
      begin(s); const ht = s.gen('華佗'), real = ht && ht.status === 'free' && !s.inParty(ht), name = real ? '華佗' : '一位遊方的名醫';
      await s.say('藥童', `不好了！${name}被城外山上的強盜綁走了！他們說是寨主病了，要師父去治——治不好就要殺他！`, '藥童');
      if (!await s.yes('要上山救人嗎？')) return;
      const r = await s.battle([s.foe('山寨寨主', 'bandit', null, 4), s.foe('嘍囉', 'bandit', null, 1), s.foe('嘍囉', 'bandit', null, 1), s.foe('嘍囉', 'bandit', null, 2)], { title: '殺上山寨！', terrain: 'hill' });
      if (r !== 'win') return;
      s.heal(); s.item('med2', 3); s.fame(70);
      await s.say(real ? '華佗' : '名醫', '多謝救命之恩！我身上沒什麼值錢的東西，這幾帖藥你收下吧。\n（全隊兵力、策略點回滿，得到金創藥三份）', real ? ht : '名醫');
      if (real && s.H.party.length < s.g.partyMax() && await s.yes('華佗說他想跟著你到處走走，替人看病。要邀他同行嗎？')) s.join(ht, 80);
    } },
  // ---------------------------------------------------------------- 和親公主
  { id: 't_princess', when: 'month', ok: (s) => cool(s) && s.serving() && !s.g.isLord() && s.me.merit >= 300 && s.chance(0.06),
    async run(s) {
      begin(s); const f = s.G.factions[s.me.fac], L = s.G.gens[f.lord];
      await s.say(L.name, `北方的烏桓願意和我們結盟，條件是要娶我們的公主。\n${s.me.name}，護送公主出塞的事，就交給你了。路上……小心。`, L);
      if (!await s.yes('要接下護送公主的任務嗎？')) return;
      const traitor = s.foe('叛將', 'soldier', f.color, 4); traitor.name = pick(['都尉張奐', '校尉韓猛', '別部司馬李封']);
      const ok = await s.waves([() => [s.foe('馬賊', 'bandit', null, 2), s.foe('馬賊', 'bandit', null, 2)], () => [traitor, s.foe('叛軍', 'soldier', f.color, 2), s.foe('叛軍', 'soldier', f.color, 2)]], { titles: ['馬賊襲擊車隊！', `${traitor.name}叛變了！他想劫走公主投靠敵國！`], terrain: 'plain' });
      if (!ok) { await s.say('', '公主被劫走了……'); s.merit(-20); return; }
      s.merit(80); s.fame(90); const n = s.relic(3, 4);
      await s.say('公主', `${s.me.name}將軍，一路上多虧了你。這是母后給我的嫁妝，我把它送給你吧。\n（功績 +80，得到「${n}」）`, LOOKS.villager('公主'));
    } },
  // ---------------------------------------------------------------- 血月狼群
  { id: 't_wolves', when: 'month', ok: (s) => cool(s) && s.onLand() && s.g.night() && s.chance(0.08),
    async run(s) {
      begin(s);
      await s.say('', '月亮變成了血紅色。四面八方傳來狼嚎，一雙雙綠眼睛在黑暗中亮了起來……\n是狼群！');
      const ok = await s.waves([() => [s.foe('野狼', 'wolf', null, 1), s.foe('野狼', 'wolf', null, 1), s.foe('野狼', 'wolf', null, 1)], () => [s.foe('野狼', 'wolf', null, 2), s.foe('野狼', 'wolf', null, 2)], () => [s.foe('血月狼王', 'whitetiger', null, 6), s.foe('野狼', 'wolf', null, 3)]], { titles: ['狼群撲上來了！', '還有更多！', '狼王出現了！'], terrain: 'forest', night: true, noFlee: true });
      if (!ok) return;
      s.fame(80); s.H.food = Math.min(s.g.hard.cap(), (s.H.food || 0) + Math.round(12 * s.g.hard.need())); s.exp(50);
      await s.say('', '狼王倒下了，血月也漸漸褪成了白色。\n剝下的狼皮能賣錢，狼肉夠大家吃好幾天。（名聲 +80、乾糧 +12 天份）');
    } },
  // ---------------------------------------------------------------- 糧倉大火
  { id: 't_granary', when: 'town', ok: (s) => cool(s) && s.serving() && s.g.town?.C?.owner === s.me.fac && s.chance(0.1),
    async run(s) {
      begin(s); const C = s.g.town.C, f = s.G.factions[s.me.fac];
      await s.say('', `半夜，${C.name}的糧倉燒起來了！火光中，有幾個黑影翻牆往城外逃。`);
      const c = await s.ask('火越燒越大……', [{ k: 'fire', n: '指揮救火', d: '看統率：救下多少糧食' }, { k: 'spy', n: '追捕放火的奸細', d: '打一場，抓到人能問出敵情' }]);
      if (c === 'fire') { const ok = s.check('lead', 70); f.food = Math.round(f.food * (ok ? 0.97 : 0.85)); s.merit(ok ? 30 : 10); await s.say('', ok ? '你組織百姓排成長龍傳水，天亮前把火撲滅了，大部分的糧食都保住了。（功績 +30）' : '火撲滅了，可是燒掉了不少糧食……'); return; }
      f.food = Math.round(f.food * 0.85);
      const r = await s.battle([s.foe('奸細頭目', 'bandit', null, 3), s.foe('奸細', 'bandit', null, 2), s.foe('奸細', 'bandit', null, 2)], { title: '追捕奸細！', terrain: 'city', night: true });
      if (r !== 'win') return;
      const foes = Object.values(s.G.factions).filter((x) => x.alive && x.id !== f.id && citiesOf(s.G, x.id).length), e = foes.sort(() => Math.random() - 0.5)[0];
      s.merit(40); s.fame(30);
      await s.say('奸細', `別殺我！我說……是${e?.name || '敵國'}派我來的！${e ? `他們的${citiesOf(s.G, e.id).sort((a, b) => a.troops - b.troops)[0].name}現在只有 ${citiesOf(s.G, e.id).sort((a, b) => a.troops - b.troops)[0].troops} 個守兵……` : ''}`, LOOKS.bandit());
    } },
  // ---------------------------------------------------------------- 天降隕石
  { id: 't_meteor', when: 'month', ok: (s) => cool(s) && s.onLand() && s.chance(0.05),
    async run(s) {
      begin(s);
      await s.say('', '夜空中劃過一道火光，轟隆一聲，落在不遠處的山谷裡。地上燒出了一個大坑，坑底有一塊黑得發亮的石頭。');
      const c = await s.ask('附近的村民跪了一地：「天降異象……」', [{ k: 'take', n: '把隕石帶走', d: '鐵匠能用它打造兵器' }, { k: 'altar', n: '讓村民建祠祭祀', d: '名聲上升' }]);
      if (c === 'take') { s.item('ore2', 3); s.item('ore', 3); await s.say('', '得到了玄鐵三塊、鐵礦石三塊。\n鐵匠一定會喜歡這東西的。'); return; }
      s.fame(60); await s.say('', '村民們在坑邊蓋了一座「天石祠」，到處傳說你是應天命而生的人。（名聲 +60）');
    } },
  // ---------------------------------------------------------------- 賭坊風雲
  { id: 't_gamble', when: 'town', ok: (s) => cool(s) && s.bigCity() && s.H.gold >= 200 && s.chance(0.1),
    async run(s) {
      begin(s); const boss = LOOKS.bandit();
      await s.say('賭坊老闆', '這位爺，來玩兩把？擲骰子比大小，押多少賠多少！', boss);
      if (!await s.yes('要進賭坊玩玩嗎？')) return;
      let won = 0;
      for (let i = 0; i < 3; i++) {
        const bet = await s.ask(`第 ${i + 1} 把。　（手氣 ${won >= 0 ? '+' : ''}${won} 金）`, [{ k: 100, n: '押 100 金', off: s.H.gold < 100 }, { k: 300, n: '押 300 金', off: s.H.gold < 300 }, { k: 0, n: '不玩了' }], boss);
        if (!bet) break;
        const me = 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6), house = Math.min(12, 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + (i ? 2 : 0));
        if (me > house) { s.gold(bet); won += bet; await s.say('', `你擲出 ${me} 點，莊家 ${house} 點——你贏了！`); } else { s.gold(-bet); won -= bet; await s.say('', `你擲出 ${me} 點，莊家 ${house} 點——輸了。`); }
      }
      if (won < 0 && s.check('int', 75)) {
        await s.say('', '你越看越不對勁：莊家的骰子落地的聲音特別沉——灌了鉛！');
        if (await s.yes('要當場揭穿他嗎？')) { const r = await s.battle([s.foe('賭坊打手', 'bandit', null, 2), s.foe('賭坊打手', 'bandit', null, 2), s.foe('賭坊老闆', 'bandit', null, 3)], { title: '大鬧賭坊！', terrain: 'city' }); if (r === 'win') { s.gold(-won * 2); s.fame(40); await s.say('', `賭坊老闆跪地求饒，加倍賠了你 ${-won * 2} 金。被他坑過的人都來向你道謝。（名聲 +40）`); } }
      }
    } },
  // ---------------------------------------------------------------- 蒙面劍客
  { id: 't_swordsman', when: 'month', ok: (s) => cool(s) && s.onLand() && s.H.fame >= 200 && s.chance(0.07),
    async run(s) {
      begin(s); const look = LOOKS.villager('蒙面劍客');
      await s.say('蒙面劍客', `${s.me.name}？聽說你的武藝天下聞名。\n拔劍吧，讓我看看名聲是不是虛的。`, look);
      if (!await s.yes('要接受挑戰嗎？')) { s.fame(-10); await s.say('蒙面劍客', '……原來如此。', look); return; }
      const r = await s.duelWith('蒙面劍客', look, s.H.rec[s.me.id].lv + 4, 96, 70, 70);
      if (r !== 'win') { await s.say('蒙面劍客', '劍法還太嫩了。十年後再來找我吧。', look); return; }
      s.stat('war'); s.stat('war'); s.fame(100);
      await s.say('王越', '好劍法！我是王越——當年在洛陽教過天子劍術的那個王越。\n老夫隱居多年，總算遇到一個像樣的對手。這幾招，傳給你吧。\n（武力 +2、名聲 +100）', look);
    } },
];
