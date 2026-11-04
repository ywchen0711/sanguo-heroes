// Stories from the Romance, which happen when the time, the place and the people are right — and whose ending the
// player can change: the oath in the peach garden, three heroes against Lü Bu, the chain of beauty that brought down
// Dong Zhuo, three visits to a thatched cottage, the raid on Wuchao, Changban, the east wind at Red Cliffs, and more.
// Each: { id, when: 'town' | 'month', ok(s) -> bool, run(s) }; s is a small toolkit over the game (see Story below).
import { die, serve, record, citiesOf, give, busy } from './sim/engine.js';
import { newRec, bstats, gainExp } from './hero.js';
import { itemName } from './sim/text.js';
import { LOOKS } from './sprites.js';
import { CITY_POS } from './world.js';

const STORIES = [
  // ---------------------------------------------------------------- 桃園結義
  { id: 'taoyuan', when: 'town', ok: (s) => s.year <= 196 && s.isOne('劉備', '關羽', '張飛') && s.alive('劉備', '關羽', '張飛') && s.others('劉備', '關羽', '張飛').every((x) => !s.inParty(x) && (x.status === 'free' || x.fac === s.me.fac)),
    async run(s) {
      const [a, b] = s.others('劉備', '關羽', '張飛');
      await s.say('', '城外有一座桃園，桃花開得正盛。');
      await s.say('張飛', '我家莊後有一座桃園，花開正盛。明日我們在園中祭告天地，結為兄弟，同心協力，然後再圖大事！', '張飛');
      await s.say('劉備', '念劉備、關羽、張飛，雖然異姓，既結為兄弟，則同心協力，救困扶危；上報國家，下安黎庶。', '劉備');
      await s.say('關羽', '不求同年同月同日生，但願同年同月同日死。皇天后土，實鑒此心！', '關羽');
      for (const x of [a, b]) s.join(x, 100);
      s.fame(60); s.toast(`${a.name}、${b.name}加入了隊伍！三兄弟桃園結義。`);
    } },
  // ---------------------------------------------------------------- 虎牢關
  { id: 'hulao', when: 'month', ok: (s) => s.year <= 191 && s.alive('呂布') && s.gen('呂布').fac === 'dong' && s.me.fac !== 'dong' && s.near('洛陽', 30) && !s.isOne('呂布'),
    async run(s) {
      const lb = s.gen('呂布');
      await s.say('', '虎牢關前，一員大將頭戴紫金冠，身披百花袍，手持方天畫戟，坐下赤兔馬，耀武揚威——正是呂布！\n「人中呂布，馬中赤兔」，諸侯的將領一個個敗下陣來。');
      const c = await s.ask(`${lb.name}在關前叫陣：「誰敢與我一戰！」`, [{ k: 'duel', n: '出陣迎戰呂布' }, { k: 'watch', n: '在陣中觀戰' }], lb);
      if (c !== 'duel') { await s.say('', '最後是劉備、關羽、張飛三人一起上陣，才把呂布逼回關內。'); s.exp(30); return; }
      const r = await s.duel(lb);
      if (r === 'win') { s.fame(150); s.merit(30); s.toast('你擊敗了天下無雙的呂布！名震天下。'); if (await s.yes('呂布落馬，要斬殺他嗎？（歷史將會改變）')) { s.kill(lb, 'duel'); s.fame(80); await s.say('', '一代飛將呂布，竟死在你的手中！'); } }
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
  { id: 'sangu', when: 'town', repeat: true, ok: (s) => s.free('諸葛亮') && s.gen('諸葛亮').city === s.cityId && !s.inParty(s.gen('諸葛亮')) && s.H.fame >= 250 && s.H.party.length < 4 && (s.H.sangu || 0) < 3,
    async run(s) {
      const kl = s.gen('諸葛亮'); s.H.sangu = (s.H.sangu || 0) + 1;
      if (s.H.sangu === 1) { await s.say('書童', '先生今早出門了，不知道什麼時候回來。', LOOKS.villager('書童')); await s.say('', '第一次拜訪，沒有見到諸葛亮。（再來兩次吧）'); return; }
      if (s.H.sangu === 2) { await s.say('', '大雪紛飛，你又來到隆中。'); await s.say('書童', '先生昨天和朋友出遊去了……', LOOKS.villager('書童')); await s.say('', '第二次拜訪，又沒有見到。'); s.fame(10); return; }
      await s.say('', '第三次來到隆中。諸葛亮正在草堂午睡，你在階下靜靜等候，一直等到他醒來。');
      await s.say('諸葛亮', '將軍三顧茅廬，誠意感人。天下三分之勢，亮已看清……願效犬馬之勞！', kl);
      s.join(kl, 95); s.fame(100); s.toast('諸葛亮加入了隊伍！');
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
  { id: 'chibi', when: 'town', ok: (s) => s.year >= 208 && s.year <= 210 && s.fac('cao') && citiesOf(s.G, 'cao').length >= 8 && (s.me.fac === 'sun' || s.me.fac === 'liubei') && (s.inCity('江夏') || s.inCity('柴桑') || s.inCity('江陵')),
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
    const r0 = this.H.rec[this.me.id], a = { name: this.me.name, look: this.g.lookOf(this.me), lv: r0.lv, st: bstats(this.me, r0), isPlayer: true }, b = this.g.act.duelFoe(x);
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
