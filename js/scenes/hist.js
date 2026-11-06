// 歷史名場面 (more of them): the famous moments of the Romance, each when its time, its place and its people are
// right; take part, and the story may go another way. Same shape as story.js: { id, when, yr, hint, ok(s), run(s) },
// s the toolkit (story.js Kit).
import { citiesOf } from '../sim/engine.js';
import { LOOKS } from '../sprites.js';

const cut = (s, fid, k) => { if (s.fac(fid)) for (const c of citiesOf(s.G, fid)) c.troops = Math.round(c.troops * k); };
const alivePlace = (s, n) => s.alive(n) && !s.inParty(s.gen(n));

export const HIST = [
  // ---------------------------------------------------------------- 溫酒斬華雄
  { id: 'huaxiong', when: 'month', yr: [190, 191], hint: '董卓的猛將華雄在汜水關前連斬諸侯大將，聯軍沒有人敢出戰。',
    ok: (s) => s.year <= 191 && s.alive('華雄') && s.facOf('華雄') === 'dong' && s.me.fac !== 'dong' && s.near('洛陽', 40) && !s.isOne('華雄'),
    async run(s) {
      const hx = s.gen('華雄');
      await s.say('', '汜水關前，董卓的大將華雄連斬了俞涉、潘鳳兩員大將，諸侯們面面相覷。\n袁紹嘆道：「可惜我的上將顏良、文醜不在！」');
      if (!await s.yes(`要出陣迎戰華雄嗎？（武力 ${hx.war}）`)) { await s.say('', '最後是一位紅臉長鬚的馬弓手提刀出陣——酒還溫著，他已經提著華雄的頭回來了。'); return; }
      await s.say('曹操', '壯哉！先飲了這杯熱酒再去！', '曹操');
      await s.say(s.me.name, '酒且斟下，某去便來！', s.me);
      const r = await s.duel(hx);
      if (r !== 'win') { s.fame(10); await s.say('', '你敗下陣來……'); return; }
      s.kill(hx, 'duel'); s.fame(130); s.merit(30); s.exp(40);
      await s.say('', `鸞鈴響處，${s.me.name}提著華雄的頭擲在地上——那杯酒還是溫的。\n諸侯們都驚呆了。`);
      if (!s.isOne('關羽')) s.changed(`溫酒斬華雄的不是關羽，而是${s.me.name}`);
    } },
  // ---------------------------------------------------------------- 傳國玉璽
  { id: 'yuxi', when: 'town', yr: [190, 192], hint: '洛陽被董卓燒成了廢墟，聽說宮裡的井中夜夜放出五色毫光。',
    ok: (s) => s.year <= 192 && s.inCity('洛陽') && (() => { const it = s.G.items.find((x) => x.key === 'yuxi'); return it && it.holder !== s.me.id && (it.holder == null || s.G.gens[it.holder].name === '孫堅'); })(),
    async run(s) {
      await s.say('', '洛陽宮殿的廢墟裡，有一口井在夜裡放出五色毫光。\n士兵從井裡撈起一具宮女的屍體，她的頸下掛著一個朱紅小匣——裡面是一方玉璽，上面刻著八個字：\n「受命於天，既壽永昌」。');
      const c = await s.ask('這是傳國玉璽！', [{ k: 'take', n: '收下玉璽', d: '魅力大增，但會招人嫉恨' }, { k: 'give', n: '獻給聯軍盟主', d: '名聲上升' }, { k: 'no', n: '放回井裡' }]);
      if (c === 'take') { const n = s.treasure('yuxi'); s.fame(60); await s.say('', `得到了「${n || '傳國玉璽'}」！\n可是消息很快就傳開了，袁術派人到處打聽玉璽的下落……`); s.H.wanted = (s.H.wanted || 0) + 15; return; }
      if (c === 'give') { s.fame(90); await s.say('袁紹', '好！你的忠義，天下都會知道的。', '袁紹'); }
    } },
  // ---------------------------------------------------------------- 衣帶詔
  { id: 'yidai', when: 'town', yr: [199, 200], hint: '許昌的國舅董承，據說收到了天子藏在衣帶裡的密詔。',
    ok: (s) => s.year >= 199 && s.year <= 200 && s.inCity('許昌') && s.alive('董承', '曹操') && s.lordOf(s.gen('曹操')) && !s.isOne('曹操') && !s.isOne('董承'),
    async run(s) {
      const dc = s.gen('董承');
      await s.say('董承', '將軍，請看——這是天子咬破手指，用血寫在衣帶裡的密詔：\n「曹操弄權，欺壓君父……卿乃國之大臣，朕之至戚，當念高帝創業之艱難，糾合忠義兩全之烈士，殄滅奸黨！」', dc);
      if (!await s.yes('要在密詔上簽名，一起除掉曹操嗎？（非常危險）')) { await s.say('董承', '……今天的事，請你一個字也不要說出去。', dc); return; }
      s.fame(30);
      if (s.check('int', 85) && s.chance(0.35)) {
        await s.say('', '太醫吉平在曹操的藥裡下了毒。你在宮門外接應，看著曹操喝下了那碗藥……');
        s.kill(s.gen('曹操'), 'executed', dc); s.fame(200); s.changed('衣帶詔成功了，曹操死於許昌'); return;
      }
      await s.say('', '家奴秦慶童向曹操告了密。董承、吉平和王子服都被抓了起來……\n你連夜逃出了許昌。');
      for (const n of ['董承', '王子服', '吉平']) { const x = s.gen(n); if (x && (x.status === 'serving' || x.status === 'free')) s.kill(x, 'executed', s.gen('曹操')); }
      if (s.me.fac === 'cao') { s.me.status = 'free'; s.me.fac = null; s.H.gov = null; } s.H.wanted = (s.H.wanted || 0) + 30; s.leave();
    } },
  // ---------------------------------------------------------------- 轅門射戟
  { id: 'yuanmen', when: 'month', yr: [196, 197], hint: '袁術派紀靈率大軍攻打小沛的劉備，呂布說要替兩家講和。',
    ok: (s) => s.year >= 196 && s.year <= 197 && s.alive('呂布', '劉備', '紀靈') && (s.near('小沛', 35) || s.near('下邳', 35)) && (s.myFac('lubu', 'liubei') || !s.serving() || s.isOne('呂布')) && !s.isOne('紀靈'),
    async run(s) {
      const lb = s.gen('呂布');
      await s.say('呂布', '我叫人把畫戟插在一百五十步外的轅門。我一箭射中戟上的小枝，你們兩家就罷兵；射不中，你們各自去廝殺，我不管！', lb);
      const shooter = s.isOne('呂布') ? s.me : null;
      if (!shooter && !await s.yes('呂布笑道：「不如請這位英雄來射？」要接下弓嗎？')) { await s.say('', '呂布拉滿了弓——一箭正中小枝！紀靈只好退兵。'); return; }
      const ok = s.check('war', 82) || s.me.war >= 90;
      if (ok) { s.fame(90); s.exp(30); s.bond(s.gen('劉備'), 20); await s.say('', '弓弦響處，那支箭正正射中了戟上的小枝！\n帳上帳下的將士齊聲喝采。紀靈只好退兵。'); if (!shooter) s.changed(`轅門射戟的不是呂布，而是${s.me.name}`); return; }
      await s.say('紀靈', '射偏了！哈哈，那就別怪我不客氣了！', '紀靈');
      const r = await s.battle([s.enemy('紀靈', 1600, '#c8a040'), s.foe('袁術軍', 'soldier', '#c8a040', 1), s.foe('袁術軍', 'soldier', '#c8a040', 1)], { title: '紀靈的大軍殺過來了！', terrain: 'plain' });
      if (r === 'win') { s.fame(70); s.merit(20); }
    } },
  // ---------------------------------------------------------------- 煮酒論英雄
  { id: 'zhujiu', when: 'town', yr: [198, 200], hint: '寄身許昌的劉備每天在後園種菜，曹操卻常常請他喝酒。',
    ok: (s) => s.year >= 198 && s.year <= 200 && s.inCity('許昌') && s.alive('曹操', '劉備') && s.lordOf(s.gen('曹操')) && (s.isOne('劉備') || (s.me.fac === 'cao' && s.facOf('劉備') === 'cao')),
    async run(s) {
      const cc = s.gen('曹操'), lb = s.gen('劉備');
      await s.say('', '青梅煮酒。天邊烏雲翻滾，曹操指著天上的龍捲雲，問起當世的英雄。');
      if (s.isOne('劉備')) {
        await s.say('曹操', '今天下英雄，惟使君與操耳！', cc);
        const c = await s.ask('手中的筷子差點掉下來——', [{ k: 'thunder', n: '趁雷聲大作，假裝被嚇掉筷子', d: '看智力' }, { k: 'own', n: '坦然承認自己的志向' }], cc);
        if (c === 'thunder' && s.check('int', 70)) { await s.say('劉備', '聖人說「迅雷風烈必變」，一聲雷竟然嚇成這樣……', lb); await s.say('曹操', '大丈夫也怕雷嗎？哈哈哈！', cc); s.fame(20); s.exp(30); return; }
        await s.say('曹操', '……原來使君也有這樣的大志。', cc); s.H.susp = Math.min(100, (s.H.susp || 0) + 45); s.toast('曹操對你起了疑心！');
        return;
      }
      await s.say('曹操', `${s.me.name}，你看劉玄德這個人怎麼樣？`, cc);
      const c = await s.ask('曹操的眼神很深。', [{ k: 'kill', n: '「此人有英雄之志，不可留。」', d: '勸曹操除掉劉備' }, { k: 'keep', n: '「玄德仁厚，可為明公所用。」' }], cc);
      if (c === 'kill' && s.smart(75, '郭嘉', '程昱')) {
        await s.say('曹操', '……你說得對。今天就把他留在許昌，一步也不許離開。', cc);
        lb.loyalty = 100; s.extend('劉備', 0); s.merit(40); s.fame(20);
        s.changed('曹操聽從勸告，沒有放劉備離開許昌'); return;
      }
      await s.say('', '過了幾天，劉備藉口截擊袁術，帶著關羽、張飛離開了許昌——再也沒有回來。');
    } },
  // ---------------------------------------------------------------- 千里走單騎・過五關斬六將
  { id: 'guanwu', when: 'month', yr: [200, 202], hint: '關羽身在曹營心在漢，聽說他一知道劉備的下落就要走。',
    ok: (s) => s.year >= 200 && s.year <= 202 && s.isOne('關羽') && s.me.fac === 'cao' && s.alive('劉備') && s.facOf('劉備') !== 'cao',
    async run(s) {
      const lb = s.gen('劉備');
      await s.say('', `終於打聽到了大哥的下落——劉備在${s.G.cities[lb.city].name}！\n你封金掛印，留書辭別曹操，護著兩位嫂嫂上路了。`);
      if (!await s.yes('要闖過曹操的五道關卡，去找大哥嗎？')) return;
      const gates = [['東嶺關', '孔秀'], ['洛陽', '韓福'], ['汜水關', '卞喜'], ['滎陽', '王植'], ['黃河渡口', '秦琪']];
      for (const [g, n] of gates) {
        await s.say(n, `沒有丞相的文書，誰也不准過${g}！`, n);
        const x = s.gen(n), r = x && x.status !== 'dead' ? await s.duel(x) : await s.duelWith(n, LOOKS.soldier('#2a5ad8'), Math.max(5, s.H.rec[s.me.id].lv - 3), 72, 62);
        if (r !== 'win') { await s.say('', `闖關失敗了，只好退回去……`); return; }
        if (x && x.status !== 'dead') s.kill(x, 'duel');
      }
      s.me.status = 'free'; s.me.fac = null; s.H.gov = null; if (lb.status === 'serving') s.serve(s.me, lb.fac, lb.city, 100); s.fame(250);
      await s.say('劉備', '二弟！', lb); await s.say('', '過五關、斬六將，千里走單騎——兄弟終於重逢了。'); s.toast(lb.status === 'serving' ? `你回到了${s.G.factions[lb.fac].name}軍！` : '你回到了大哥身邊！');
    } },
  // ---------------------------------------------------------------- 長坂橋
  { id: 'changbanqiao', when: 'month', yr: [207, 209], hint: '曹操的大軍南下荊州，劉備帶著十萬百姓且戰且走。',
    ok: (s) => s.year >= 207 && s.year <= 209 && s.fac('cao') && (s.isOne('張飛') || (s.myFac('liubei') && s.alive('張飛'))) && (s.near('新野', 40) || s.near('襄陽', 40) || s.near('江陵', 40)),
    async run(s) {
      await s.say('', '當陽長坂橋。身後是逃難的百姓，眼前是曹操的大軍。\n橋上只剩一人一騎。');
      const me = s.isOne('張飛');
      if (!me && !await s.yes('要和張飛一起守在橋上嗎？')) return;
      const ok = s.me.war >= 90 || s.check('war', 85) || me;
      if (ok) {
        await s.say(s.me.name, `${me ? '我乃燕人張翼德也！' : `我乃${s.me.name}！`}誰敢與我決一死戰？！`, s.me);
        await s.say('', '喝聲如雷，橋下的河水倒流。曹操身邊的夏侯傑嚇得肝膽碎裂，摔下馬來。\n曹軍一齊回頭就跑！');
        const xj = s.gen('夏侯傑'); if (xj && xj.status !== 'dead') s.kill(xj, 'natural');
        s.fame(160); s.merit(30); if (!me) s.changed(`在長坂橋上喝退曹軍的，還有${s.me.name}`); return;
      }
      const r = await s.battle([s.foe('曹軍虎豹騎', 'soldier', '#2a5ad8', 3), s.foe('曹軍', 'soldier', '#2a5ad8', 2), s.foe('曹軍', 'soldier', '#2a5ad8', 2)], { title: '死守長坂橋！', terrain: 'river', noFlee: true });
      if (r === 'win') { s.fame(100); s.merit(25); }
    } },
  // ---------------------------------------------------------------- 草船借箭
  { id: 'caochuan', when: 'town', yr: [208, 209], hint: '曹操的水軍屯在江北，江東的周瑜卻說箭不夠用。',
    ok: (s) => s.year >= 208 && s.year <= 209 && s.fac('cao') && citiesOf(s.G, 'cao').length >= 8 && s.myFac('sun', 'liubei') && (s.inCity('柴桑') || s.inCity('江夏') || s.inCity('江陵') || s.inCity('建業')),
    async run(s) {
      await s.say('周瑜', '水上交戰，弓箭最要緊。我限你十天之內造好十萬支箭，辦得到嗎？', '周瑜');
      const c = await s.ask('十天，十萬支箭……', [{ k: 'boat', n: '「不用十天，三天就夠。」', d: '借二十條船、草人和大霧（看智力）' }, { k: 'make', n: '老老實實日夜趕工', d: '花五天和 300 金' }]);
      if (c === 'make') { if (s.H.gold < 300) { await s.say('周瑜', '軍中無戲言！', '周瑜'); s.fame(-20); return; } s.gold(-300); await s.g.act.passDays(5); s.fame(30); await s.say('', '你日夜趕工，總算交上了十萬支箭。'); return; }
      if (!s.smart(80, '諸葛亮', '魯肅')) { await s.say('', '第三天夜裡沒有起霧……你只好硬著頭皮去領罰。'); s.fame(-30); return; }
      await s.say('', '第三天四更，江上大霧瀰漫。二十條紮滿草人的船擂鼓吶喊，駛向曹營。\n曹軍怕有埋伏，只敢放箭——天亮時，每條船上都插滿了箭。\n「謝丞相箭！」');
      s.fame(140); s.merit(30); s.item('book', 2); s.exp(40);
      if (!s.isOne('諸葛亮')) s.changed(`草船借箭的是${s.me.name}`);
    } },
  // ---------------------------------------------------------------- 群英會：蔣幹盜書
  { id: 'jianggan', when: 'town', yr: [208, 209], hint: '曹操的說客蔣幹要過江來見他的老同學周瑜。',
    ok: (s) => s.year >= 208 && s.year <= 209 && s.alive('蔡瑁', '張允') && s.facOf('蔡瑁') === 'cao' && s.fac('sun') && ((s.myFac('sun') && (s.inCity('柴桑') || s.inCity('建業') || s.inCity('江夏'))) || (s.myFac('cao') && (s.inCity('江陵') || s.inCity('襄陽')))),
    async run(s) {
      const cm = s.gen('蔡瑁'), zy = s.gen('張允');
      if (s.myFac('sun')) {
        await s.say('', '蔣幹來了。周瑜大擺筵席，喝得爛醉，還把蔣幹留在帳中同睡。\n案上放著一封「蔡瑁、張允」寫來的降書……');
        if (!await s.yes('要協助周瑜，讓蔣幹把這封假信偷回去嗎？')) return;
        if (!s.smart(65, '周瑜', '魯肅') && !s.isOne('周瑜')) { await s.say('', '蔣幹好像起了疑心，那封信他沒有拿走。'); return; }
        s.kill(cm, 'executed', s.gen('曹操')); s.kill(zy, 'executed', s.gen('曹操')); cut(s, 'cao', 0.92); s.fame(100); s.merit(30);
        await s.say('', '曹操看了信，勃然大怒，當場斬了蔡瑁和張允——曹軍裡最懂水戰的兩個人。\n等他回過神來，已經後悔莫及。'); return;
      }
      await s.say('', '蔣幹從江東回來，得意地交上了一封信：「蔡瑁、張允要投降周瑜！」\n曹操大怒，就要下令斬了他們兩人。');
      if (!await s.yes('要出面勸阻嗎？')) { s.kill(cm, 'executed', s.gen('曹操')); s.kill(zy, 'executed', s.gen('曹操')); return; }
      if (s.smart(75, '程昱', '荀攸', '賈詡')) { s.fame(80); s.merit(40); await s.say('曹操', '……你說這是周瑜的反間計？好險！差點中了這小子的計。', '曹操'); s.changed('曹操識破了蔣幹帶回的假信，蔡瑁、張允沒有被斬'); return; }
      await s.say('曹操', '不必多說！', '曹操'); s.kill(cm, 'executed', s.gen('曹操')); s.kill(zy, 'executed', s.gen('曹操'));
    } },
  // ---------------------------------------------------------------- 甘露寺招親
  { id: 'ganlu', when: 'month', yr: [209, 211], hint: '孫權說要把妹妹孫尚香嫁給劉備——但這可能是周瑜的計策。',
    ok: (s) => s.year >= 209 && s.year <= 211 && s.myFac('liubei') && s.alive('劉備', '孫尚香') && s.lordOf(s.gen('劉備')) && s.facOf('孫尚香') === 'sun' && !s.isOne('劉備') && (s.near('吳', 60) || s.near('建業', 60) || s.near('柴桑', 50)),
    async run(s) {
      const lb = s.gen('劉備'), sx = s.gen('孫尚香');
      await s.say('', '甘露寺裡，吳國太一眼就看中了劉備。婚事辦成了，可是孫權和周瑜的人馬已經在路上埋伏。\n要護送主公和孫夫人回荊州！');
      if (!await s.yes('要擔任護衛，殺出一條路嗎？')) return;
      const ok = await s.waves([() => [s.enemy('丁奉', 1500, '#d84a3a'), s.foe('吳軍', 'soldier', '#d84a3a', 1)], () => [s.enemy('徐盛', 1600, '#d84a3a'), s.foe('吳軍', 'soldier', '#d84a3a', 2), s.foe('吳軍', 'soldier', '#d84a3a', 1)]], { titles: ['吳軍追兵！', '江邊又有一支伏兵！'], terrain: 'river' });
      if (!ok) { await s.say('', '追兵太多了……主公和夫人被攔了回去。'); return; }
      await s.say('孫尚香', '我是吳侯的親妹妹，看你們誰敢攔我！', sx);
      s.serve(sx, lb.fac, lb.city, 95); s.fame(120); s.merit(40); s.bond(lb, 30);
      await s.say('劉備', '這一路多虧了你。', lb); s.toast('孫尚香加入了劉備軍！');
    } },
  // ---------------------------------------------------------------- 許褚裸衣鬥馬超
  { id: 'xuchu', when: 'month', yr: [211, 212], hint: '馬超為父報仇，率西涼大軍殺到了潼關。',
    ok: (s) => s.year >= 211 && s.year <= 212 && s.alive('許褚', '馬超') && (s.isOne('許褚') || s.isOne('馬超')) && (s.near('長安', 50) || s.near('弘農', 50)) && s.facOf('許褚') !== s.facOf('馬超'),
    async run(s) {
      const o = s.gen(s.isOne('許褚') ? '馬超' : '許褚');
      await s.say('', `潼關前，${o.name}出陣叫戰。兩人從早上打到中午，換了馬再打，打得渾身是汗。\n${s.isOne('許褚') ? '你乾脆脫下盔甲，赤著上身提刀再戰！' : '許褚竟然脫下了盔甲，赤膊衝了上來！'}`);
      const r = await s.duel(o);
      if (r === 'win') { s.fame(150); s.exp(60); await s.say('', `${o.name}終於撐不住了，撥馬敗走。\n兩軍將士看得目瞪口呆。`); }
      else await s.say('', '兩人打到天黑，不分勝負，各自收兵。');
    } },
  // ---------------------------------------------------------------- 落鳳坡
  { id: 'luofeng', when: 'month', yr: [213, 214], hint: '劉備入川，龐統和他分兵兩路取雒城，小路上有一個叫落鳳坡的地方。',
    ok: (s) => s.year >= 213 && s.year <= 214 && s.alive('龐統') && s.sameSide('龐統') && !s.isOne('龐統') && (s.near('梓潼', 50) || s.near('成都', 50)),
    async run(s) {
      const pt = s.gen('龐統');
      await s.say('', '龐統騎著劉備的白馬「的盧」，走小路去取雒城。山路狹窄，兩邊林木茂密。\n嚮導說：「這裡叫落鳳坡。」');
      const c = await s.ask('龐統的道號是「鳳雛」……', [{ k: 'warn', n: '勸軍師別走這條路', d: '看智力或魅力' }, { k: 'guard', n: '帶兵搶先搜山', d: '和張任的伏兵打一仗' }, { k: 'no', n: '不過是個地名' }]);
      if (c === 'warn' && (s.check('int', 70) || s.check('cha', 75))) { s.extend('龐統', 15); s.fame(80); await s.say('龐統', '……好，就聽你的，改走大路。', pt); s.changed('龐統沒有死在落鳳坡'); return; }
      if (c === 'guard') { const r = await s.battle([s.enemy('張任', 1700, '#8a6a4a'), s.foe('益州弓兵', 'soldier', '#8a6a4a', 2), s.foe('益州弓兵', 'soldier', '#8a6a4a', 2)], { title: '落鳳坡的伏兵！', terrain: 'forest' }); if (r === 'win') { s.extend('龐統', 15); s.fame(120); s.merit(40); s.changed('龐統沒有死在落鳳坡'); return; } }
      if (pt.status !== 'dead') s.kill(pt, 'battle', s.gen('張任'));
      await s.say('', '「射那騎白馬的！」——亂箭齊發，鳳雛龐統死在了落鳳坡，年僅三十六歲。');
    } },
  // ---------------------------------------------------------------- 單刀赴會
  { id: 'dandao', when: 'month', yr: [214, 216], hint: '江東的魯肅要討回荊州，請關羽過江赴宴。',
    ok: (s) => s.year >= 214 && s.year <= 216 && s.alive('關羽', '魯肅') && s.facOf('魯肅') === 'sun' && (s.isOne('關羽') || s.sameSide('關羽')) && (s.near('江夏', 50) || s.near('江陵', 50) || s.near('長沙', 50)),
    async run(s) {
      const gy = s.gen('關羽'), ls = s.gen('魯肅'), me = s.isOne('關羽');
      await s.say('魯肅', '荊州本是借的，如今西川已得，也該還給我們了吧？', ls);
      if (!me && !await s.yes('關羽只帶一口刀、幾個隨從就要過江赴宴。要跟去嗎？')) { await s.say('', '關羽一手提刀、一手挽住魯肅，安然回到了船上。'); return; }
      const c = await s.ask('帳外刀斧手已經埋伏好了。', [{ k: 'grab', n: me ? '一把挽住魯肅，提刀走出去' : '護著關羽，挽住魯肅走出去', d: '看武力和魅力' }, { k: 'fight', n: '殺出去！' }]);
      if (c === 'grab' && (s.check('war', 85) || s.check('cha', 85) || me)) { s.fame(130); s.merit(25); await s.say('', '江東的伏兵投鼠忌器，眼睜睜看著你們上了船。\n「單刀赴會」的故事，從此傳遍天下。'); return; }
      const r = await s.battle([s.foe('刀斧手', 'soldier', '#d84a3a', 2), s.foe('刀斧手', 'soldier', '#d84a3a', 2), s.foe('刀斧手', 'soldier', '#d84a3a', 2)], { title: '殺出宴席！', terrain: 'city', noFlee: true });
      if (r === 'win') { s.fame(100); if (!me) s.bond(gy, 30); }
    } },
  // ---------------------------------------------------------------- 雞肋
  { id: 'jilei', when: 'month', yr: [219, 219], hint: '曹操和劉備在漢中相持不下。軍中的口令是「雞肋」。',
    ok: (s) => s.year === 219 && s.alive('楊修', '曹操') && s.facOf('楊修') === 'cao' && s.myFac('cao') && !s.isOne('楊修') && s.near('漢中', 60),
    async run(s) {
      const yx = s.gen('楊修');
      await s.say('楊修', '「雞肋」——食之無味，棄之可惜。丞相想退兵了，大家快收拾行裝吧！', yx);
      const c = await s.ask('曹操聽說了，臉色鐵青：「楊修惑亂軍心，推出去斬了！」', [{ k: 'save', n: '替楊修求情', d: '看魅力' }, { k: 'no', n: '不說話' }]);
      if (c === 'save' && s.check('cha', 75)) { s.extend('楊修', 15); s.fame(50); await s.say('曹操', '……看在你的面上，饒他這一次。', '曹操'); s.changed('楊修沒有因為「雞肋」被殺'); return; }
      s.kill(yx, 'executed', s.gen('曹操'));
    } },
  // ---------------------------------------------------------------- 水淹七軍
  { id: 'shuiyan', when: 'month', yr: [219, 219], hint: '關羽北伐樊城，秋雨連綿，漢水暴漲。',
    ok: (s) => s.year === 219 && s.season(7, 8, 9, 10) && s.alive('關羽', '于禁') && s.facOf('于禁') === 'cao' && (s.isOne('關羽') || s.sameSide('關羽')) && (s.near('襄陽', 50) || s.near('宛', 50)),
    async run(s) {
      const yj = s.gen('于禁');
      await s.say('', '秋雨下了十幾天。于禁的七路大軍屯在罾口川的低地上，漢水一天比一天高。');
      if (!await s.yes('要趁夜掘開堤防，水淹七軍嗎？')) return;
      await s.say('', '大水從四面八方湧來，七路大軍頃刻間泡在水裡。只有幾座小山頭上還擠著人。');
      const r = await s.battle([s.enemy('于禁', 1400, '#2a5ad8', 1), s.enemy('龐德', 1500, '#2a5ad8', 2), s.foe('曹軍', 'soldier', '#2a5ad8', 0)], { title: '水淹七軍！', terrain: 'marsh', wx: 'rain' });
      if (r !== 'win') return;
      cut(s, 'cao', 0.85); s.fame(200); s.merit(60);
      if (s.serving() && yj.status === 'serving') { s.serve(yj, s.me.fac, s.me.city, 50); await s.say('于禁', '……我投降。', yj); }
      const pd = s.gen('龐德'); if (pd && pd.status === 'serving' && pd.fac === 'cao') { s.kill(pd, 'executed'); await s.say('龐德', '我寧為國家鬼，不為賊將！', pd); }
      s.record('war', 'warWin', { f: s.G.factions[s.me.fac]?.name || s.me.name, g: s.me.name, c: '樊城', o: s.G.factions.cao.name, notes: [{ who: s.me.name, tac: 'flood' }] }, s.me.fac);
    } },
  // ---------------------------------------------------------------- 刮骨療毒
  { id: 'guagu', when: 'month', yr: [219, 220], hint: '關羽右臂中了毒箭，毒已入骨。',
    ok: (s) => s.year >= 219 && s.year <= 220 && s.alive('關羽') && (s.isOne('關羽') || s.inParty(s.gen('關羽')) || s.sameSide('關羽')) && s.flagged('guagu') !== 1 && (s.near('襄陽', 50) || s.near('江陵', 50)),
    async run(s) {
      const gy = s.gen('關羽'), ht = s.gen('華佗'), me = s.isOne('關羽'); s.flag('guagu', 1);
      await s.say('', `${me ? '你' : '關羽'}的右臂中了一支毒箭，整條手臂又青又腫，抬不起來了。`);
      const can = ht && ht.status !== 'dead';
      const c = await s.ask('毒已入骨，一般的大夫都搖頭。', [{ k: 'hua', n: `找神醫華佗（${can ? '去請他來' : '華佗已經不在人世'}）`, off: !can }, { k: 'self', n: '自己動手刮骨', d: '看智力（有治癒之術更好）' }, { k: 'no', n: '先撐著' }]);
      if (c === 'hua' || (c === 'self' && (s.check('int', 70) || s.me.spells.includes('zhi')))) {
        await s.say(c === 'hua' ? '華佗' : s.me.name, '要用尖刀割開皮肉，把骨頭上的毒刮掉。怕的話，我把手臂綁在柱子上……', c === 'hua' ? ht : s.me);
        await s.say('', `刀刮在骨頭上，嚓嚓作響，帳下的人都掩面失色。\n${me ? '你' : '關羽'}卻一邊喝酒，一邊和馬良下棋，談笑自若。`);
        s.extend('關羽', 6); gy.base.war = Math.min(100, gy.base.war + 1); s.fame(me ? 120 : 60); s.heal(); return;
      }
      gy.base.war = Math.max(50, gy.base.war - 3); await s.say('', '毒越來越深了……（關羽的武力下降）');
    } },
  // ---------------------------------------------------------------- 白帝城託孤
  { id: 'baidi', when: 'month', yr: [222, 224], hint: '劉備兵敗夷陵，病倒在白帝城永安宮。',
    ok: (s) => s.year >= 222 && s.year <= 224 && s.alive('劉備') && s.lordOf(s.gen('劉備')) && s.sameSide('劉備') && !s.isOne('劉備') && s.gen('劉備').died <= s.year + 1 && (s.near('永安', 70) || s.near('成都', 60)),
    async run(s) {
      const lb = s.gen('劉備');
      await s.say('劉備', `${s.me.name}……我快不行了。\n嗣子劉禪年幼，若可輔，則輔之；如其不才，君可自為成都之主。`, lb);
      const c = await s.ask('劉備握著你的手。', [{ k: 'loyal', n: '跪地流淚：「臣敢不竭股肱之力，效忠貞之節，繼之以死！」' }, { k: 'heal', n: '「主公一定會好起來的！」', d: '去找名醫（看運氣）' }]);
      if (c === 'heal' && (s.chance(0.25) || s.partyHas('華佗'))) { s.extend('劉備', 5); s.fame(80); await s.say('', '經過名醫的調理，劉備的病竟然一天天好了起來。'); s.changed('劉備沒有病死在白帝城'); return; }
      s.merit(150); s.fame(150); s.H.susp = 0; s.me.loyalty = 100;
      await s.say('', '劉備含笑而逝。你成了託孤重臣，全國上下都看著你。');
    } },
  // ---------------------------------------------------------------- 街亭
  { id: 'jieting', when: 'month', yr: [227, 229], hint: '丞相北伐，要派人守住街亭——那是大軍的咽喉。',
    ok: (s) => s.year >= 227 && s.year <= 229 && s.alive('諸葛亮', '馬謖') && s.sameSide('諸葛亮') && s.sameSide('馬謖') && !s.isOne('馬謖') && s.near('天水', 60),
    async run(s) {
      const ms = s.gen('馬謖');
      await s.say('馬謖', '兵法說「憑高視下，勢如破竹」。我要把營寨紮在山上！', ms);
      const c = await s.ask('王平急得直跺腳。', [{ k: 'warn', n: '「山上沒有水源，魏軍一圍就完了！應該當道紮營！」', d: '看智力和魅力' }, { k: 'no', n: '參軍熟讀兵書，就聽他的' }], ms);
      if (c === 'warn' && (s.check('int', 75) || s.check('cha', 80))) {
        await s.say('馬謖', '……好，就當道紮營。', ms);
        const r = await s.battle([s.enemy('張郃', 1900, '#2a5ad8', 3), s.foe('魏軍', 'soldier', '#2a5ad8', 2), s.foe('魏軍', 'soldier', '#2a5ad8', 2)], { title: '守住街亭！', terrain: 'hill' });
        if (r === 'win') { s.flag('jieting', 'held'); s.extend('馬謖', 10); s.fame(150); s.merit(50); s.changed('街亭沒有失守，馬謖也沒有被斬'); return; }
      }
      s.flag('jieting', 'lost'); await s.say('', '魏將張郃圍住了山，斷了水道。蜀軍不戰自亂——街亭失守了。');
      s.kill(ms, 'executed', s.gen('諸葛亮')); await s.say('諸葛亮', '……揮淚斬馬謖。', '諸葛亮');
    } },
  // ---------------------------------------------------------------- 空城計
  { id: 'kongcheng', when: 'month', yr: [227, 230], hint: '街亭一旦失守，司馬懿的大軍就會直撲西城。',
    ok: (s) => s.year >= 227 && s.year <= 230 && s.flagged('jieting') === 'lost' && s.alive('諸葛亮', '司馬懿') && s.facOf('司馬懿') !== s.facOf('諸葛亮') && (s.isOne('諸葛亮') || s.sameSide('諸葛亮') || s.sameSide('司馬懿')) && s.near('天水', 70),
    async run(s) {
      const kl = s.gen('諸葛亮'), sy = s.gen('司馬懿');
      if (s.sameSide('司馬懿') || s.isOne('司馬懿')) {
        await s.say('', '西城的城門大開，城頭上一個人在焚香撫琴，二十個老兵在門口掃地——是諸葛亮！\n司馬懿勒住了馬：「亮平生謹慎，不曾弄險。必有埋伏，退兵！」');
        const c = await s.ask('你怎麼看？', [{ k: 'go', n: '「城裡根本沒有兵！讓我帶人衝進去！」' }, { k: 'no', n: '聽都督的，退兵' }], sy);
        if (c !== 'go') return;
        if (!s.check('int', 80)) { await s.say('司馬懿', '你懂什麼？退！', sy); return; }
        const r = await s.battle([s.foe('西城老兵', 'soldier', '#3aa85a', 0), s.foe('西城老兵', 'soldier', '#3aa85a', 0)], { title: '衝進西城！', terrain: 'city' });
        if (r === 'win') { cut(s, kl.fac, 0.6); s.fame(200); s.merit(80); s.changed('司馬懿看穿了空城計，蜀軍大敗'); await s.say('', '城裡果然只有幾個老兵！諸葛亮從後門逃走了，蜀軍元氣大傷。'); }
        return;
      }
      await s.say('', '街亭失守了。司馬懿的十五萬大軍正朝西城殺來，城裡只有兩千五百老弱殘兵。');
      const c = await s.ask('怎麼辦？', [{ k: 'qin', n: '大開城門，在城頭焚香撫琴', d: s.isOne('諸葛亮') ? '' : '看智力（丞相在身邊更好）' }, { k: 'run', n: '棄城逃走' }, { k: 'fight', n: '死守西城' }]);
      if (c === 'qin' && (s.isOne('諸葛亮') || s.check('int', 90) || s.chance(0.6))) { s.fame(180); s.exp(60); await s.say('', '琴聲悠揚，不慌不忙。司馬懿在城下聽了半天，越聽越怕——\n「必有埋伏！快退！」\n十五萬大軍，就這樣被一張琴嚇退了。'); return; }
      if (c === 'run') { s.fame(-20); return; }
      const r = await s.battle([s.enemy('司馬懿', 3500, '#2a5ad8', 5), s.enemy('司馬昭', 2000, '#2a5ad8', 3), s.foe('魏軍', 'soldier', '#2a5ad8', 3), s.foe('魏軍', 'soldier', '#2a5ad8', 3)], { title: '司馬懿的大軍兵臨城下！', terrain: 'city' });
      if (r === 'win') { s.fame(250); s.merit(60); s.changed('西城守住了，司馬懿大敗而回'); }
    } },
  // ---------------------------------------------------------------- 高平陵之變
  { id: 'gaoping', when: 'month', yr: [248, 250], hint: '司馬懿裝病在家，曹爽兄弟卻要陪天子出城祭掃高平陵。',
    ok: (s) => s.year >= 248 && s.year <= 250 && s.alive('司馬懿', '曹爽') && s.facOf('司馬懿') === s.facOf('曹爽') && s.sameSide('曹爽') && !s.isOne('曹爽') && !s.isOne('司馬懿'),
    async run(s) {
      const sy = s.gen('司馬懿'), cs = s.gen('曹爽');
      await s.say('', '曹爽兄弟陪著天子出城祭掃高平陵。洛陽城裡，「病重」的司馬懿忽然披甲上馬，關閉了城門。');
      const c = await s.ask('你在洛陽城中。', [{ k: 'sima', n: '支持司馬懿', d: '功績大增' }, { k: 'cao', n: '殺出城去，通知曹爽', d: '和司馬家的人馬交戰' }, { k: 'no', n: '閉門不出' }]);
      if (c === 'sima') { s.kill(cs, 'executed', sy); s.merit(100); s.fame(30); await s.say('', '曹爽交出了兵權，以為能保住富貴——幾天後，曹爽三族被誅。司馬氏從此大權在握。'); return; }
      if (c !== 'cao') return;
      const r = await s.battle([s.enemy('司馬師', 2200, '#3a3a6a', 3), s.foe('司馬家死士', 'soldier', '#3a3a6a', 3), s.foe('司馬家死士', 'soldier', '#3a3a6a', 3)], { title: '殺出洛陽！', terrain: 'city' });
      if (r !== 'win') return;
      if (s.check('cha', 70) || s.check('int', 75)) { s.kill(sy, 'executed', cs); s.fame(220); s.merit(80); s.changed('高平陵之變失敗了，司馬懿被誅'); await s.say('曹爽', '有你在，我就不怕司馬懿！傳令：挾天子以討逆賊！', cs); return; }
      await s.say('', '你趕到了曹爽的營中，可他猶豫了一整夜，最後還是交出了兵權……'); s.kill(cs, 'executed', sy);
    } },
  // ---------------------------------------------------------------- 偷渡陰平
  { id: 'yinping', when: 'month', yr: [262, 264], hint: '姜維死守劍閣。魏將鄧艾在找一條沒有人走過的小路。',
    ok: (s) => s.year >= 262 && s.year <= 264 && s.alive('鄧艾') && (s.isOne('鄧艾') || s.sameSide('鄧艾')) && s.fac('liubei') && (s.near('漢中', 60) || s.near('梓潼', 60)),
    async run(s) {
      await s.say('', '陰平小道，七百里無人之地。鑿山開路，架木為橋。到了摩天嶺，前面是萬丈懸崖。');
      const c = await s.ask('鄧艾裹著毛氈，第一個滾了下去——', [{ k: 'go', n: '跟著滾下去！', d: '看武力和統率' }, { k: 'no', n: '這太瘋狂了' }]);
      if (c !== 'go') return;
      if (!s.check('war', 70) && !s.check('lead', 75)) { for (const p of s.g.partyList()) p.rec.sol = Math.round(p.rec.sol * 0.6); await s.say('', '摔下去的時候受了重傷……（兵力 -40%）'); }
      const r = await s.battle([s.enemy('諸葛瞻', 2200, '#3aa85a', 3), s.foe('江油守軍', 'soldier', '#3aa85a', 2), s.foe('綿竹守軍', 'soldier', '#3aa85a', 2)], { title: '奇兵天降！', terrain: 'hill' });
      if (r !== 'win') return;
      cut(s, 'liubei', 0.5); s.fame(220); s.merit(80);
      await s.say('', '江油不戰而降，綿竹的諸葛瞻戰死。成都城裡一片大亂……');
    } },
];
