// Stories from the Romance, which happen when the time, the place and the people are right — and whose ending the
// player can change: the oath in the peach garden, three heroes against Lü Bu, the chain of beauty that brought down
// Dong Zhuo, three visits to a thatched cottage, the raid on Wuchao, Changban, the east wind at Red Cliffs, and more.
// Each: { id, when: 'town' | 'month', ok(s) -> bool, run(s) }; s is a small toolkit over the game (see Story below).
import { die, serve, record, citiesOf, give, busy } from './sim/engine.js';
import { newRec, bstats, gainExp } from './hero.js';
import { itemName } from './sim/text.js';
import { LOOKS } from './sprites.js';
import { CITY_POS } from './world.js';
import { changed, deed } from './deeds.js';
import { relicFx } from './relics.js';
import { swear, addBond } from './bonds.js';

const STORIES = [
  // ---------------------------------------------------------------- 桃園結義
  { id: 'taoyuan', when: 'town', ok: (s) => s.year <= 196 && s.isOne('劉備', '關羽', '張飛') && s.alive('劉備', '關羽', '張飛') && s.others('劉備', '關羽', '張飛').every((x) => !s.inParty(x) && (x.status === 'free' || x.fac === s.me.fac)),
    async run(s) {
      const [a, b] = s.others('劉備', '關羽', '張飛');
      await s.say('', '城外有一座桃園，桃花開得正盛。');
      await s.say('張飛', '我家莊後有一座桃園，花開正盛。明日我們在園中祭告天地，結為兄弟，同心協力，然後再圖大事！', '張飛');
      await s.say('劉備', '念劉備、關羽、張飛，雖然異姓，既結為兄弟，則同心協力，救困扶危；上報國家，下安黎庶。', '劉備');
      await s.say('關羽', '不求同年同月同日生，但願同年同月同日死。皇天后土，實鑒此心！', '關羽');
      for (const x of [a, b]) { s.join(x, 100); await swear(s.g, x, true); }
      s.fame(60); s.toast(`${a.name}、${b.name}加入了隊伍！三兄弟桃園結義。`);
    } },
  // ---------------------------------------------------------------- 虎牢關
  { id: 'hulao', when: 'month', yr: [190, 191], hint: '洛陽附近的虎牢關，將有天下無雙的猛將出陣叫戰。', ok: (s) => s.year <= 191 && s.alive('呂布') && s.gen('呂布').fac === 'dong' && s.me.fac !== 'dong' && s.near('洛陽', 30) && !s.isOne('呂布'),
    async run(s) {
      const lb = s.gen('呂布');
      await s.say('', '虎牢關前，一員大將頭戴紫金冠，身披百花袍，手持方天畫戟，坐下赤兔馬，耀武揚威——正是呂布！\n「人中呂布，馬中赤兔」，諸侯的將領一個個敗下陣來。');
      const c = await s.ask(`${lb.name}在關前叫陣：「誰敢與我一戰！」`, [{ k: 'duel', n: '出陣迎戰呂布' }, { k: 'watch', n: '在陣中觀戰' }], lb);
      if (c !== 'duel') { await s.say('', '最後是劉備、關羽、張飛三人一起上陣，才把呂布逼回關內。'); s.exp(30); return; }
      const r = await s.duel(lb);
      if (r === 'win') { s.fame(150); s.merit(30); s.toast('你擊敗了天下無雙的呂布！名震天下。'); if (await s.yes('呂布落馬，要斬殺他嗎？（歷史將會改變）')) { s.kill(lb, 'duel'); s.fame(80); s.changed('呂布死在虎牢關前，沒有活到白門樓'); await s.say('', '一代飛將呂布，竟死在你的手中！'); } }
      else { s.fame(30); await s.say('呂布', '哼，還算有點本事。', lb); }
    } },
  // ---------------------------------------------------------------- 連環計
  { id: 'lianhuan', when: 'town', ok: (s) => s.year >= 191 && s.year <= 193 && s.alive('董卓', '呂布', '王允') && s.factionLord('dong') === '董卓' && (s.inCity('長安') || s.inCity('洛陽')) && !s.isOne('董卓'),
    async run(s) {
      const wy = s.gen('王允');
      await s.say('王允', '老夫有一計：府中歌女貂蟬，美貌無雙。我先許給呂布，再獻給董卓，叫他父子反目……只是此事需要一位可靠的人在中間周旋。', wy);
      if (s.isOne('呂布')) {
        const c = await s.ask('王允看著你：「將軍，董卓奪你所愛，你還要認賊作父嗎？」', [{ k: 'kill', n: '殺董卓！' }, { k: 'no', n: '我不能背叛義父' }], wy);
        if (c === 'kill') { s.kill(s.gen('董卓'), 'executed', s.me); s.fame(120); await s.say('', '你一戟刺死了董卓！長安城的百姓載歌載舞。'); }
        return;
      }
      const c = await s.ask('要幫王允嗎？', [{ k: 'yes', n: '願效犬馬之勞' }, { k: 'no', n: '此事太危險' }], wy);
      if (c !== 'yes') return;
      if (s.check('int', 55) || s.check('cha', 60)) { s.kill(s.gen('董卓'), 'executed', s.gen('呂布')); s.fame(100); await s.say('', '連環計成功了！呂布在鳳儀亭外為貂蟬殺了董卓。\n「董卓已死」的消息傳遍天下。'); }
      else { s.fame(-10); await s.say('', '計策被董卓的謀士李儒看穿了，你連夜逃出城去。'); s.leave(); }
    } },
  // ---------------------------------------------------------------- 水鏡先生
  { id: 'shuijing', when: 'town', ok: (s) => s.inCity('襄陽') && s.year >= 200 && (s.free('諸葛亮') || s.free('龐統')),
    async run(s) {
      await s.say('水鏡先生', '好！好！你就是那位四處闖蕩的英雄吧？\n「臥龍、鳳雛，兩人得一，可安天下。」', LOOKS.villager('水鏡'));
      const w = s.gen('諸葛亮'), f = s.gen('龐統'), lines = [];
      if (w && w.status === 'free') lines.push(`臥龍，就是${w.name}，字孔明，住在${s.G.cities[w.city].name}附近的隆中。`);
      if (f && f.status === 'free') lines.push(`鳳雛，就是${f.name}，字士元，現在在${s.G.cities[f.city].name}。`);
      await s.say('水鏡先生', lines.join('\n') + '\n要請他們出山，可得有十足的誠意。', LOOKS.villager('水鏡'));
      s.exp(20);
    } },
  // ---------------------------------------------------------------- 三顧茅廬 (anyone famous enough can try)
  { id: 'sangu', when: 'town', repeat: true, yr: [200, 215], hint: '襄陽附近的隆中，住著一位臥龍先生。名聲夠響亮的人，去三次就能請他出山。', ok: (s) => s.free('諸葛亮') && s.gen('諸葛亮').city === s.cityId && !s.inParty(s.gen('諸葛亮')) && s.H.fame >= 250 && s.H.party.length < 4 && (s.H.sangu || 0) < 3,
    async run(s) {
      const kl = s.gen('諸葛亮'); s.H.sangu = (s.H.sangu || 0) + 1;
      if (s.H.sangu === 1) { await s.say('書童', '先生今早出門了，不知道什麼時候回來。', LOOKS.villager('書童')); await s.say('', '第一次拜訪，沒有見到諸葛亮。（再來兩次吧）'); return; }
      if (s.H.sangu === 2) { await s.say('', '大雪紛飛，你又來到隆中。'); await s.say('書童', '先生昨天和朋友出遊去了……', LOOKS.villager('書童')); await s.say('', '第二次拜訪，又沒有見到。'); s.fame(10); return; }
      await s.say('', '第三次來到隆中。諸葛亮正在草堂午睡，你在階下靜靜等候，一直等到他醒來。');
      await s.say('諸葛亮', '將軍三顧茅廬，誠意感人。天下三分之勢，亮已看清……願效犬馬之勞！', kl);
      s.join(kl, 95); s.fame(100); s.toast('諸葛亮加入了隊伍！'); if (!s.isOne('劉備')) s.changed(`諸葛亮沒有輔佐劉備，而是跟隨了${s.me.name}`);
    } },
  // ---------------------------------------------------------------- 官渡・烏巢
  { id: 'wuchao', when: 'month', ok: (s) => s.year >= 199 && s.year <= 202 && s.fac('cao') && s.fac('yuanshao') && s.me.fac === 'cao' && s.alive('淳于瓊') && s.gen('淳于瓊').fac === 'yuanshao',
    async run(s) {
      await s.say('許攸', '袁紹的糧草全都囤在烏巢，守將淳于瓊嗜酒無備。若派輕騎夜襲，燒掉他的糧草，袁軍不戰自潰！', LOOKS.villager('許攸'));
      if (!await s.yes('要率軍夜襲烏巢嗎？')) return;
      const cq = s.gen('淳于瓊');
      const r = await s.battle([s.foeGen(cq, 1200), s.foe('袁軍', 'soldier', '#d8b02a'), s.foe('袁軍', 'soldier', '#d8b02a')], { title: '夜襲烏巢！', terrain: 'plain' });
      if (r !== 'win') return;
      for (const c of citiesOf(s.G, 'yuanshao')) c.troops = Math.round(c.troops * 0.6);
      s.G.factions.yuanshao.food = Math.round(s.G.factions.yuanshao.food * 0.3);
      s.record('war', 'warWin', { f: s.G.factions.cao.name, g: s.me.name, c: '烏巢', o: s.G.factions.yuanshao.name, notes: [{ who: s.me.name, tac: 'fire' }] }, 'cao');
      s.fame(120); s.merit(50); await s.say('', '烏巢的糧草燒了一整夜。袁軍的士兵沒了糧食，人心大亂！');
    } },
  // ---------------------------------------------------------------- 長坂坡
  { id: 'changban', when: 'month', ok: (s) => s.year >= 207 && s.year <= 209 && s.isOne('趙雲') && s.me.fac === 'liubei' && s.fac('cao'),
    async run(s) {
      await s.say('', '曹操的大軍追到了長坂坡，劉備的家眷在亂軍中失散了。\n少主阿斗還在敵陣之中！');
      if (!await s.yes('要單騎殺入曹軍救出少主嗎？')) return;
      const foes = [s.foe('曹軍', 'soldier', '#2a5ad8', 2), s.foe('曹軍', 'soldier', '#2a5ad8', 2), s.foe('曹軍', 'soldier', '#2a5ad8', 2), s.foe('曹軍', 'soldier', '#2a5ad8', 3)];
      const r = await s.battle(foes, { title: '長坂坡，七進七出！', terrain: 'hill', solo: true });
      if (r === 'win') { s.fame(200); s.stat('war'); s.stat('lead'); await s.say('', '趙雲懷抱阿斗，在曹軍中七進七出，斬將五十餘員！\n曹操在山上看見，讚嘆道：「真虎將也！」'); }
    } },
  // ---------------------------------------------------------------- 赤壁・借東風
  { id: 'chibi', when: 'town', yr: [208, 210], hint: '曹操的大軍將會南下。若在江陵、江夏或柴桑，或許能借到東風。', ok: (s) => s.year >= 208 && s.year <= 210 && s.fac('cao') && citiesOf(s.G, 'cao').length >= 8 && (s.me.fac === 'sun' || s.me.fac === 'liubei') && (s.inCity('江夏') || s.inCity('柴桑') || s.inCity('江陵')),
    async run(s) {
      await s.say('', '曹操率八十萬大軍南下，戰船連成一片，停在赤壁江面上。\n周瑜定下火攻之計，萬事俱備，只欠東風——冬天只吹西北風。');
      const wise = s.check('int', 80) || s.H.party.some((id) => ['諸葛亮', '周瑜', '龐統'].includes(s.G.gens[id].name)) || s.isOne('諸葛亮', '周瑜');
      const c = await s.ask('要怎麼辦？', [{ k: 'wind', n: '登上七星壇，借東風' }, { k: 'fire', n: '不等東風，直接放火' }, { k: 'no', n: '按兵不動' }]);
      if (c === 'no') return;
      if (c === 'wind' && wise || c === 'fire' && Math.random() < 0.3) {
        let burned = 0; for (const cc of citiesOf(s.G, 'cao')) if (s.G.cities[cc.id].y > 50) { burned += Math.round(cc.troops * 0.55); cc.troops = Math.round(cc.troops * 0.45); }
        s.record('war', 'warWin', { f: s.G.factions[s.me.fac].name, g: s.me.name, c: '赤壁', o: s.G.factions.cao.name, notes: [{ who: s.me.name, tac: 'sp_feng' }] }, s.me.fac);
        s.fame(250); s.merit(60); await s.say('', `東南風大起！黃蓋的火船衝入曹軍水寨，連環船燒成一片火海。\n曹軍死傷 ${burned} 人，曹操狼狽北逃！`);
      } else await s.say('', '風向不對，火燒到了自己的船……火攻失敗了。');
    } },
  // ---------------------------------------------------------------- 華佗
  { id: 'huatuo', when: 'town', repeat: true, ok: (s) => s.free('華佗') && s.gen('華佗').city === s.cityId && !s.inParty(s.gen('華佗')) && (s.H.huatuo || 0) < s.G.year,
    async run(s) {
      const ht = s.gen('華佗'); s.H.huatuo = s.G.year;
      await s.say('華佗', '我是行醫的華佗。看你的部下傷兵不少，讓我來看看吧。', ht);
      s.heal(); s.toast('華佗治好了全隊的傷兵！');
      if (s.H.party.length < 4 && await s.yes('要邀請華佗同行嗎？')) { if (Math.random() < 0.35 + s.me.cha / 400) { s.join(ht, 80); await s.say('華佗', '好，跟著你，可以救更多的人。', ht); } else await s.say('華佗', '我還要去別處救人，就此別過。', ht); }
    } },
  // ---------------------------------------------------------------- 小霸王與太史慈
  { id: 'taishici', when: 'month', ok: (s) => s.year >= 194 && s.year <= 198 && s.isOne('孫策') && s.alive('太史慈') && s.gen('太史慈').fac !== s.me.fac && s.near('建業', 40),
    async run(s) {
      const ts = s.gen('太史慈');
      await s.say('太史慈', '久聞小霸王之名，今日特來一會！', ts);
      const r = await s.duel(ts);
      if (r === 'win') { await s.say('太史慈', '……將軍神勇，我服了。願追隨將軍！', ts); if (s.H.party.length < 4) s.join(ts, 95); s.fame(80); }
      else await s.say('太史慈', '小霸王，不過如此！', ts);
    } },
  // ---------------------------------------------------------------- 定軍山
  { id: 'dingjun', when: 'town', ok: (s) => s.year >= 215 && s.isOne('黃忠') && s.alive('夏侯淵') && s.gen('夏侯淵').fac !== s.me.fac && s.inCity('漢中'),
    async run(s) {
      const xy = s.gen('夏侯淵');
      await s.say('法正', '夏侯淵就在定軍山下紮營。將軍可以趁他輕敵，一舉斬之！', LOOKS.villager('法正'));
      if (!await s.yes('要出戰夏侯淵嗎？')) return;
      const r = await s.duel(xy);
      if (r === 'win') { s.kill(xy, 'duel'); s.fame(150); await s.say('', '黃忠老當益壯，在定軍山一刀斬了夏侯淵！'); }
    } },
  // ---------------------------------------------------------------- 逍遙津
  { id: 'xiaoyao', when: 'month', ok: (s) => s.year >= 213 && s.isOne('張遼') && s.alive('孫權') && s.gen('孫權').fac !== s.me.fac && s.near('壽春', 30),
    async run(s) {
      const sq = s.gen('孫權');
      await s.say('', '孫權率十萬大軍來攻合肥。你只有八百敢死之士。');
      if (!await s.yes('要率八百騎兵突襲孫權嗎？')) return;
      const r = await s.battle([s.foeGen(sq, 1500), s.foe('吳軍', 'soldier', '#d84a3a', 2), s.foe('吳軍', 'soldier', '#d84a3a', 2)], { title: '八百破十萬！', terrain: 'marsh' });
      if (r === 'win') { s.fame(200); s.stat('lead'); await s.say('', '張遼直衝孫權的大旗，吳軍大亂！從此江東的孩子哭鬧，只要說一聲「張遼來了」，就不敢再哭。'); }
    } },
  // ---------------------------------------------------------------- 七擒孟獲
  { id: 'menghuo', when: 'town', repeat: true, ok: (s) => s.alive('孟獲') && s.gen('孟獲').status === 'serving' && s.G.factions[s.gen('孟獲').fac]?.lord === s.gen('孟獲').id && (s.inCity('建寧') || s.inCity('雲南')) && (s.H.menghuo || 0) < 7 && s.me.fac !== s.gen('孟獲').fac,
    async run(s) {
      const mh = s.gen('孟獲'); s.H.menghuo = (s.H.menghuo || 0) + 1; const n = s.H.menghuo;
      await s.say('孟獲', n === 1 ? '漢人也敢來我的地盤？看我把你們趕出去！' : `這次是我大意了！再來！（第 ${n} 次交鋒）`, mh);
      const r = await s.battle([s.foeGen(mh, 900 + n * 150), s.foe('蠻兵', 'barbarian', null, 1), s.foe('蠻兵', 'barbarian', null, 1)], { title: `第 ${n} 次擒孟獲`, terrain: 'forest' });
      if (r !== 'win') { s.H.menghuo--; return; }
      if (n < 7) { await s.say('', `擒住了孟獲！你放了他回去。（${n}/7）`); s.fame(15); return; }
      await s.say('孟獲', '七擒七縱，自古未有。我們南人再也不反了！', mh);
      const f = s.G.factions[mh.fac], mine = s.me.fac;
      if (mine) { for (const c of citiesOf(s.G, f.id)) c.owner = mine; for (const g of s.G.gens.filter((x) => x.status === 'serving' && x.fac === f.id)) serve(s.G, g, mine, g.city, 80); f.alive = false; s.record('fall', 'surrender', { g: mh.name, x: s.me.name, o: f.name, f: s.G.factions[mine].name }, mine); }
      s.fame(200); s.toast('南中歸順了！');
    } },

  // ================================================================ turning points: take part, and history goes another way
  // ---------------------------------------------------------------- 宛城：典韋死守營門
  { id: 'wancheng', when: 'month', yr: [197, 198], hint: '宛城的張繡投降了曹操，但他的心裡並不服氣……要小心夜裡。',
    ok: (s) => s.year >= 197 && s.year <= 198 && s.alive('張繡', '典韋') && s.gen('典韋').status === 'serving' && s.me.fac && s.me.fac === s.gen('典韋').fac && s.near('宛', 40) && !s.isOne('張繡'),
    async run(s) {
      const zx = s.gen('張繡'), dw = s.gen('典韋');
      await s.say('', '宛城的夜裡，營外忽然火光沖天。張繡降而復叛，率兵殺進了曹營！\n典韋提著雙戟擋在營門前，但他的戟早被人偷走了……');
      if (s.isOne('典韋')) { const r = await s.battle([s.foeGen(zx, 1400), s.foe('張繡軍', 'soldier', '#8a6a4a', 1), s.foe('張繡軍', 'soldier', '#8a6a4a', 1)], { title: '宛城夜襲！死守營門！', terrain: 'city' }); if (r === 'win') { s.fame(150); s.changed('典韋在宛城殺退張繡，曹操和曹昂都平安無事'); } return; }
      if (!await s.yes('要衝到營門和典韋一起死守嗎？')) return;
      const r = await s.battle([s.foeGen(zx, 1400), s.foe('張繡軍', 'soldier', '#8a6a4a', 1), s.foe('張繡軍', 'soldier', '#8a6a4a', 1)], { title: '宛城夜襲！', terrain: 'city' });
      if (r !== 'win') { await s.say('', '你沒能擋住張繡……典韋身中數十槍，至死仍站在營門前。'); return; }
      s.extend('典韋', 18); s.extend('曹昂', 30); s.fame(120); s.merit(30); s.bond(dw, 40);
      await s.say('典韋', '好兄弟！今天要不是你，主公就危險了！', dw);
      s.changed('典韋沒有戰死在宛城，曹昂也活了下來');
    } },
  // ---------------------------------------------------------------- 白門樓：守住下邳
  { id: 'xiapi', when: 'month', yr: [198, 199], hint: '曹操和劉備正在聯手，要把呂布困死在下邳。',
    ok: (s) => s.year >= 198 && s.year <= 199 && s.alive('呂布') && s.gen('呂布').status === 'serving' && s.lordOf(s.gen('呂布')) && s.me.fac === s.gen('呂布').fac && s.near('下邳', 45) && s.fac('cao'),
    async run(s) {
      const lb = s.gen('呂布'), cc = s.gen('曹操');
      await s.say('陳宮', '曹操決泗水、沂水灌城，下邳已經被圍了三個月。再這樣下去，將士們要叛變了！', s.gen('陳宮') || '陳宮');
      if (!await s.yes('要率軍出城，突破曹軍的包圍嗎？')) return;
      const foes = [cc && cc.status === 'serving' && !s.isOne('曹操') ? s.foeGen(cc, 1800) : s.foe('曹軍大將', 'soldier', '#2a5ad8', 3), s.foe('曹軍', 'soldier', '#2a5ad8', 2), s.foe('劉備軍', 'soldier', '#3aa85a', 2)];
      const r = await s.battle(foes, { title: '突破下邳之圍！', terrain: 'river' });
      if (r !== 'win') { await s.say('', '突圍失敗了……'); return; }
      if (!s.isOne('呂布')) s.extend('呂布', 10); s.extend('陳宮', 10); s.extend('高順', 10);
      for (const c of citiesOf(s.G, 'cao')) c.troops = Math.round(c.troops * 0.8);
      s.fame(150); s.merit(40);
      s.changed('呂布守住了下邳，沒有在白門樓殞命');
    } },
  // ---------------------------------------------------------------- 官渡：袁紹的一方
  { id: 'guandu', when: 'month', yr: [199, 201], hint: '官渡對峙之際，袁紹的謀士許攸對主公心懷不滿。',
    ok: (s) => s.year >= 199 && s.year <= 201 && s.me.fac === 'yuanshao' && s.fac('cao') && s.fac('yuanshao') && s.alive('袁紹'),
    async run(s) {
      await s.say('', '官渡前線。袁紹的謀士許攸因為家人犯法被抓，正氣沖沖地要去投奔曹操。\n他知道烏巢的糧草佈置——要是讓他到了曹營，後果不堪設想。');
      const c = await s.ask('要怎麼辦？', [{ k: 'talk', n: '勸許攸留下（魅力）' }, { k: 'guard', n: '派兵加強烏巢的守備' }, { k: 'no', n: '不關我的事' }]);
      if (c === 'no') return;
      if (c === 'talk' && !s.check('cha', 65)) { await s.say('許攸', '袁本初不聽我的，我又何必留在這裡！', '許攸'); return; }
      await s.say('', c === 'talk' ? '你好說歹說，許攸終於留了下來，還獻上一計：「曹操的大軍都在官渡，許昌空虛，可以奇襲！」' : '烏巢的守備加強了。曹軍夜裡果然來偷襲，被打了回去。\n接下來，就是反攻的時候了！');
      const cr = s.gen('曹仁'), r = await s.battle([cr && cr.status === 'serving' && cr.fac === 'cao' ? s.foeGen(cr, 1500) : s.foe('曹軍大將', 'soldier', '#2a5ad8', 3), s.foe('曹軍', 'soldier', '#2a5ad8', 2), s.foe('曹軍', 'soldier', '#2a5ad8', 2)], { title: '官渡決戰！', terrain: 'plain' });
      if (r !== 'win') return;
      for (const cc of citiesOf(s.G, 'cao')) cc.troops = Math.round(cc.troops * 0.55);
      s.G.factions.cao.food = Math.round(s.G.factions.cao.food * 0.4);
      s.record('war', 'warWin', { f: s.G.factions.yuanshao.name, g: s.me.name, c: '官渡', o: s.G.factions.cao.name, notes: [] }, 'yuanshao');
      s.extend('袁紹', 10); s.fame(200); s.merit(60);
      s.changed('袁紹在官渡擊敗了曹操');
    } },
  // ---------------------------------------------------------------- 孫策遇刺
  { id: 'sunce', when: 'month', yr: [199, 200], hint: '小霸王孫策殺了吳郡太守許貢，許貢的門客發誓要報仇。',
    ok: (s) => s.year >= 199 && s.year <= 200 && s.alive('孫策') && s.gen('孫策').status === 'serving' && (s.isOne('孫策') || s.me.fac === s.gen('孫策').fac) && (s.near('吳', 40) || s.near('建業', 40) || s.near('會稽', 40)),
    async run(s) {
      const sc = s.gen('孫策');
      await s.say('', `${s.isOne('孫策') ? '你' : '孫策'}獨自騎馬到丹徒山打獵，在林子裡遇到三個陌生人，自稱是韓當的部下。\n他們的眼神不太對勁……`);
      if (!s.isOne('孫策') && !await s.yes('要追上去保護孫策嗎？')) return;
      const r = await s.battle([s.foe('許貢門客', 'bandit', null, 3), s.foe('許貢門客', 'bandit', null, 3), s.foe('許貢門客', 'bandit', null, 3)], { title: '許貢的門客行刺！', terrain: 'forest', noFlee: true });
      if (r !== 'win') return;
      if (!s.isOne('孫策')) { s.extend('孫策', 25); s.bond(sc, 40); await s.say('孫策', '多虧了你！這份恩情，孫伯符記下了。', sc); }
      s.fame(120); s.merit(30);
      s.changed('孫策沒有在丹徒遇刺，小霸王繼續稱雄江東');
    } },
  // ---------------------------------------------------------------- 赤壁：曹操的一方
  { id: 'chibi_cao', when: 'town', yr: [208, 210], hint: '曹操南下之際，江東的老將黃蓋似乎有投降的意思……',
    ok: (s) => s.year >= 208 && s.year <= 210 && s.me.fac === 'cao' && s.fac('cao') && citiesOf(s.G, 'cao').length >= 8 && s.fac('sun') && (s.inCity('江陵') || s.inCity('江夏') || s.inCity('襄陽')),
    async run(s) {
      await s.say('', '曹軍的戰船用鐵索連在一起，士兵再也不會暈船了。\n這時江東老將黃蓋派人送來降書，說要帶著糧船來投降。');
      const wise = s.check('int', 75) || s.H.party.some((id) => ['程昱', '賈詡', '荀攸', '郭嘉'].includes(s.G.gens[id].name));
      const c = await s.ask('黃蓋的降書擺在桌上。', [{ k: 'warn', n: '「這是詐降！而且連環船怕火攻！」' }, { k: 'no', n: '黃蓋都快七十了，應該是真心的吧' }]);
      if (c !== 'warn') return;
      if (!wise) { await s.say('曹操', '隆冬時節只有西北風，他們要放火，只會燒到自己。不必多慮！', '曹操'); return; }
      await s.say('', '曹操聽了你的話，連夜解開鐵索，在船上堆滿沙土。\n黃蓋的火船衝過來時，曹軍萬箭齊發，火船在江心燒成一片——燒的是江東的船。');
      for (const id of ['sun', 'liubei']) if (s.fac(id)) for (const cc of citiesOf(s.G, id)) cc.troops = Math.round(cc.troops * 0.6);
      s.record('war', 'warWin', { f: s.G.factions.cao.name, g: s.me.name, c: '赤壁', o: s.G.factions.sun.name, notes: [{ who: s.me.name, tac: 'ambush' }] }, 'cao');
      s.fame(220); s.merit(60);
      s.changed('曹操識破了黃蓋的詐降，赤壁沒有起火');
    } },
  // ---------------------------------------------------------------- 麥城
  { id: 'maicheng', when: 'month', yr: [219, 220], hint: '關羽北伐樊城，荊州的後方卻空虛了。江東的呂蒙正在等待機會。',
    ok: (s) => s.year >= 219 && s.year <= 220 && s.alive('關羽') && s.gen('關羽').status === 'serving' && (s.isOne('關羽') || s.me.fac === s.gen('關羽').fac) && (s.near('江陵', 45) || s.near('襄陽', 45)),
    async run(s) {
      const gy = s.gen('關羽'), lm = s.gen('呂蒙');
      await s.say('', '呂蒙白衣渡江，偷襲了荊州。關羽腹背受敵，退守麥城，城中只剩幾百人……');
      if (!s.isOne('關羽') && !await s.yes('要殺進重圍，救出關羽嗎？')) return;
      const r = await s.battle([lm && lm.status === 'serving' && lm.fac !== s.me.fac ? s.foeGen(lm, 1800) : s.foe('吳軍大將', 'soldier', '#d84a3a', 3), s.foe('吳軍', 'soldier', '#d84a3a', 2), s.foe('吳軍伏兵', 'soldier', '#d84a3a', 2)], { title: '麥城突圍！', terrain: 'forest' });
      if (r !== 'win') { await s.say('', '吳軍的伏兵太多了……'); return; }
      if (!s.isOne('關羽')) { s.extend('關羽', 12); s.extend('關平', 20); s.extend('周倉', 15); s.bond(gy, 50); await s.say('關羽', '大丈夫恩怨分明。今日救命之恩，關某永世不忘！', gy); }
      s.fame(220); s.merit(50);
      s.changed('關羽沒有敗走麥城');
    } },
  // ---------------------------------------------------------------- 夷陵
  { id: 'yiling', when: 'month', yr: [221, 223], hint: '劉備要為關羽報仇，御駕東征。陸遜正在等著他在山林裡紮營。',
    ok: (s) => s.year >= 221 && s.year <= 223 && s.alive('劉備') && s.gen('劉備').status === 'serving' && s.lordOf(s.gen('劉備')) && !s.isOne('劉備') && (s.me.fac === s.gen('劉備').fac || s.me.fac === 'sun') && (s.near('永安', 50) || s.near('江陵', 50)),
    async run(s) {
      const lb = s.gen('劉備');
      if (s.me.fac === 'sun') {
        await s.say('', '劉備的大軍在夷陵連營七百里，正是盛夏，營寨都紮在樹林裡。');
        if (!await s.yes('要向陸遜建議火燒連營嗎？')) return;
        if (!s.check('int', 65) && !s.H.party.some((id) => s.G.gens[id].name === '陸遜')) { await s.say('', '時機還沒到，你的建議被擱置了。'); return; }
        for (const c of citiesOf(s.G, lb.fac)) c.troops = Math.round(c.troops * 0.55);
        s.record('war', 'warWin', { f: s.G.factions.sun.name, g: s.me.name, c: '夷陵', o: s.G.factions[lb.fac].name, notes: [{ who: s.me.name, tac: 'fire' }] }, 'sun');
        s.fame(180); s.merit(50); await s.say('', '大火從一座營燒到另一座營，七百里連營化為灰燼！'); return;
      }
      await s.say('', '大軍在夷陵連營七百里。天氣炎熱，主公下令把營寨都移到樹林裡乘涼。');
      const c = await s.ask('這樣紮營……', [{ k: 'warn', n: '勸主公：「樹林裡紮營，怕敵人火攻！」' }, { k: 'no', n: '主公自有打算' }], lb);
      if (c !== 'warn') return;
      const wise = s.check('int', 70) || s.check('cha', 80) || s.H.party.some((id) => ['諸葛亮', '馬良', '黃權'].includes(s.G.gens[id].name));
      if (!wise) { await s.say('劉備', '我用兵多年，難道還要你來教？', lb); return; }
      await s.say('劉備', '……你說得對。傳令下去，全軍移營到平地，連夜挖好防火溝！', lb);
      s.extend('劉備', 8); s.fame(150); s.merit(40);
      s.changed('劉備沒有在夷陵被火燒連營，也沒有在白帝城託孤');
    } },
  // ---------------------------------------------------------------- 五丈原：七星燈
  { id: 'wuzhang', when: 'month', yr: [232, 235], hint: '丞相積勞成疾。據說點起七星燈祈禳，七天燈不滅，就能延壽一紀。',
    ok: (s) => s.year >= 232 && s.year <= 235 && s.alive('諸葛亮') && s.gen('諸葛亮').status === 'serving' && (s.isOne('諸葛亮') || s.me.fac === s.gen('諸葛亮').fac) && s.gen('諸葛亮').died <= s.year + 1,
    async run(s) {
      const kl = s.gen('諸葛亮');
      await s.say('', '五丈原的軍帳裡，丞相病得很重。他在帳中點起七盞大燈，中間一盞是本命燈：\n「七天之內主燈不滅，我的壽命就能再延長一紀（十二年）。」');
      if (!await s.yes('要在帳外守護七星燈七天嗎？')) return;
      await s.say('', '第七天的夜裡，魏延忽然慌慌張張地衝進帳來：「魏兵殺來了！」');
      const c = await s.ask('魏延就要踩到燈了——', [{ k: 'stop', n: '一把攔住魏延（武力）' }, { k: 'shield', n: '用身體護住主燈（統率）' }]);
      const ok = c === 'stop' ? s.check('war', 75) : s.check('lead', 75);
      if (!ok) { await s.say('諸葛亮', '死生有命，不可得而禳也……', kl); return; }
      if (!s.isOne('諸葛亮')) s.extend('諸葛亮', 12); s.fame(200); s.merit(50);
      await s.say('', '主燈的火苗搖了幾搖，又亮了起來。\n七天七夜過去，丞相的氣色一天天好轉了。');
      s.changed('諸葛亮在五丈原祈禳成功，沒有「出師未捷身先死」');
    } },
];

// a small toolkit for the stories
class Kit {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; } get me() { return this.g.me; } get year() { return this.G.year; }
  get cityId() { return this.g.town?.city ?? -1; }
  gen(n) { return this.G.byName[n]; }
  alive(...ns) { return ns.every((n) => { const g = this.gen(n); return g && (g.status === 'serving' || g.status === 'free'); }); }
  free(n) { const g = this.gen(n); return g && g.status === 'free' && !busy(g); }
  isOne(...ns) { return ns.includes(this.me.name); }
  others(...ns) { return ns.filter((n) => n !== this.me.name).map((n) => this.gen(n)); }
  inParty(g) { return this.H.party.includes(g.id); }
  fac(id) { const f = this.G.factions[id]; return f && f.alive && citiesOf(this.G, id).length > 0; }
  factionLord(id) { const f = this.G.factions[id]; return f && f.alive ? this.G.gens[f.lord].name : null; }
  inCity(n) { return !!this.g.town && this.g.town.C.name === n && this.g.town.city != null; }
  near(n, d) { const c = this.G.cities.find((x) => x.name === n), q = CITY_POS[c.id], P = this.g.pos, x = P.town != null ? CITY_POS[P.town].x : P.x, z = P.town != null ? CITY_POS[P.town].y : P.z; return Math.hypot(q.x - x, q.y - z) < d; }
  check(k, v) { return this.me[k] >= v || Math.random() < 0.15; }
  look(x) { return typeof x === 'string' ? (this.gen(x) ? this.g.lookOf(this.gen(x)) : LOOKS.villager(x)) : x?.name ? this.g.lookOf(x) : x; }
  say(who, text, look) { return this.g.ui.say(who, text, look ? this.look(look) : null); }
  ask(q, opts, look) { return this.g.ui.ask(q, opts, look?.name || '', look ? this.look(look) : null); }
  yes(q) { return this.g.ui.yesno(q); }
  toast(t) { this.g.ui.toast(`<b style="color:#ffd86a">${t}</b>`, 4500); }
  fame(n) { this.H.fame = Math.max(0, this.H.fame + n); }
  merit(n) { if (this.me.status === 'serving') { this.me.merit += n; this.g.act.promote(); } }
  exp(n) { for (const p of this.g.partyList()) gainExp(this.G, p.g, p.rec, n); }
  stat(k) { if (this.me.base[k] < 100) { this.me.base[k]++; this.me[k]++; } }
  heal() { for (const p of this.g.partyList()) { p.rec.sol = p.solMax; p.rec.sp = p.spMax; } }
  record(kind, key, p, fac) { record(this.G, kind, key, p, fac, 3, {}); }
  changed(t) { changed(this.g, t); }
  extend(n, y) { const x = this.gen(n); if (x && x.status !== 'dead') x.died = Math.max(x.died, this.year + y); }
  lordOf(x) { const f = x.status === 'serving' && this.G.factions[x.fac]; return !!f && f.lord === x.id; }
  bond(x, n) { addBond(this.g, x.id, n); }
  kill(x, cause, by = this.me) { const had = this.G.items.filter((it) => it.holder === x.id); die(this.G, x, cause, by); if (by === this.me) { this.H.st.kills.push(x.name); for (const it of had) if (it.holder !== this.me.id && it.holder == null) { give(this.G, it, this.me); this.toast(`得到了「${itemName(it.key)}」！`); } } }
  join(x, loyalty) {
    if (this.H.party.length >= 4 || this.H.party.includes(x.id)) return;
    x.follow = this.H.pid; this.H.party.push(x.id); this.H.rec[x.id] ||= newRec(x);
    if (this.me.status === 'serving') serve(this.G, x, this.me.fac, this.me.city, loyalty); else if (x.status === 'serving') { x.status = 'free'; x.fac = null; }
    this.g.respawnParty(); this.g.hud();
  }
  leave() { if (this.g.mode === 'town') this.g.leaveTown(); }
  // a duel with a named general, on a stage of its own
  async duel(x) {
    const r0 = this.H.rec[this.me.id], a = { name: this.me.name, look: this.g.lookOf(this.me), lv: r0.lv, st: bstats(this.me, r0), isPlayer: true, arms: relicFx(r0) }, b = this.g.act.duelFoe(x);
    const was = this.g.mode; this.g.mode = 'battle';
    const r = await this.g.battle.soloDuel(a, b, { noFlee: true }); this.g.battle.close(); this.g.mode = was; this.g.audio.music(was === 'town' ? 'town' : 'field');
    if (r === 'win') { this.H.st.duels++; this.me.duelsWon++; }
    return r;
  }
  foeGen(x, sol) { const lv = this.g.act.lvOf(x), f = x.status === 'serving' && this.G.factions[x.fac]; return { name: x.name, look: this.g.lookOf(x), lv, war: x.war, lead: x.lead, int: x.int, sol, solMax: sol, sp: Math.round(x.int), spells: x.spells, gid: x.id, color: f ? f.color : '#8a6a4a', wpn: Math.round(lv / 4), arm: Math.round(lv / 4) }; }
  foe(name, kind, color, plus = 0) { const lv = Math.round(this.g.partyList().reduce((t, p) => t + p.rec.lv, 0) / (this.H.party.length + 1)) + plus; return this.g.act.foe(name, kind, lv, color); }
  battle(foes, o) { return this.g.act.fight(foes, o); }
}

export class Story {
  constructor(game) { this.g = game; this.kit = new Kit(game); this.busy = false; }
  upcoming() {
    const y = this.g.G.year, done = this.g.H.storyDone || [];
    const st = STORIES.find((x) => x.hint && x.yr && !done.includes(x.id) && y <= x.yr[1] && y >= x.yr[0] - 2);
    return st ? `${st.yr[0] > y ? `再過${st.yr[0] - y}年，` : '最近'}${st.hint}` : '';
  }
  async check(when) {
    if (this.busy || this.g.ui.busy || !this.g.G) return false;
    const H = this.g.H; H.storyDone ||= [];
    for (const st of STORIES) {
      if (st.when !== when || (!st.repeat && H.storyDone.includes(st.id))) continue;
      let ok = false; try { ok = st.ok(this.kit); } catch (e) { ok = false; }
      if (!ok) continue;
      this.busy = true; this.g.locked = true;
      try { if (!st.repeat) H.storyDone.push(st.id); await st.run(this.kit); } catch (e) { console.error(e); } finally { this.busy = false; this.g.locked = false; this.g.hud(); }
      return true;
    }
    return false;
  }
}
