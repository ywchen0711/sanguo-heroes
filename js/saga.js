// 英傑傳奇: the story mode. Jeff, Erin, Josh and Jasper — one family — are looking at a bronze mirror in a museum
// when it pulls them into the year 190 and scatters them across the realm. The player leads one of them: find the
// other three (下邳, 宛, 洛陽, 吳), then take back the three shards of the mirror from 玄冥子's disciples (幽州, 涼州,
// 南中), then climb 泰山 to his hall and end it. The realm runs on as in any other game around the story.
// Goals are black banners (H.missions with .saga): a city's banner is reached by walking into the city, a field
// banner by stepping on it. State: H.saga = { lead, ch: 'find' | 'shards' | 'final' | 'done', fam: { name: 0 waiting,
// 1 found, 2 done }, shards: { tian, di, ren }, log: [], ambush, lgz: the side story with 劉關張 (0 not yet, 1 their city,
// 2 the impostors' camp, 3 done: they come to the last battle) }.
// Every chief of the story has weaknesses and resistances (TRAIT, see weak.js) and a great move it gathers itself for.
// 第二部「鏡影亂世」 (after choosing to stay): two months later the mirror cracks and four shadows of the family get out
// (ch 'shadows': each one is met in a city, then fought at a banner outside it), 水鏡先生 in 襄陽 tells who 鏡翁 really is
// (ch 'sage': the city, then 鏡湖 for the 照心燈), and the last battle is inside the mirror, back in 許昌 (ch 'mirror').
// Part two state: H.saga.stay, p2, wait, sh: { name: 0 waiting, 1 met, 2 done }, sage (1 = visited), amb2; ch 'end' when over.
import { LOOKS } from './sprites.js';
import { CITY_POS, T, K } from './world.js';
import { refresh } from './sim/engine.js';
import { addBond, swear } from './bonds.js';
import { deed } from './deeds.js';
import { newRec } from './hero.js';

export const FAMILY = ['Jeff', 'Erin', 'Josh', 'Jasper'];
const ROLE = { Jeff: 'dad', Erin: 'mom', Josh: 'big', Jasper: 'small' };
// how a calls b
export const call = (a, b) => {
  const ra = ROLE[a], rb = ROLE[b];
  if (rb === 'dad') return ra === 'mom' ? '老公' : '爸';
  if (rb === 'mom') return ra === 'dad' ? '老婆' : '媽';
  if (rb === 'big') return ra === 'small' ? '哥' : b;
  return b;
};
// where each of them comes down, and their chapter
const HOME = { Jeff: '下邳', Erin: '宛', Josh: '洛陽', Jasper: '吳' };
const START = '許昌';
const CH_N = { Jeff: '下邳軍師', Erin: '瘟城醫心', Josh: '天牢少年', Jasper: '雙劍俠盜' };
const VISION = {
  Jeff: '一位手持干將劍的軍師，在下邳城頭指揮守軍。城外全是頭裹黑巾的賊兵。',
  Erin: '一位女子在宛城的瘟疫裡救人。可是她救得越多，病倒的人反而越多。',
  Josh: '一個少年被關在洛陽的天牢裡。他向天下第一的猛將下了戰書。',
  Jasper: '一個蒙面的雙劍俠盜，在吳郡的大戶之間來去無蹤。',
};
const SHARD = {
  tian: { n: '天', city: '薊', where: '幽州', boss: '冰魄夫人', place: '幽州・冰魄宮', stat: 'lead', terrain: 'snow' },
  di: { n: '地', city: '武威', where: '涼州', boss: '赤炎童子', place: '涼州・赤炎谷', stat: 'war', terrain: 'desert' },
  ren: { n: '人', city: '建寧', where: '南中', boss: '萬蠱婆婆', place: '南中・萬蠱林', stat: 'int', terrain: 'forest' },
};
const STAT_N = { lead: '統率', war: '武力', int: '智力', pol: '政治', cha: '魅力' };
// 第二部: where each shadow makes trouble, the banner outside, what its owner gains back
const SHADOW = {
  Jeff: { city: '鄴', place: '漳河大堤', stat: 'int', terrain: 'river', form: 'fangyuan', ch: '冷鏡軍師' },
  Erin: { city: '長安', place: '藥王廟', stat: 'pol', terrain: 'forest', form: 'heyi', ch: '迷心藥師' },
  Josh: { city: '陳留', place: '虎牢關・擂台', stat: 'war', terrain: 'hill', form: 'fengshi', ch: '無雙狂徒' },
  Jasper: { city: '江陵', place: '長江・黑帆船', stat: 'cha', terrain: 'river', form: 'changshe', ch: '獨行影盜' },
};
const CH2 = { shadows: '第四章　四道鏡影', sage: '第五章　水鏡先生', mirror: '第六章　鏡中天下', end: '終章　鏡中之後' };

// ---------------------------------------------------------------- the people of the story
const V = (seed, o) => ({ ...LOOKS.villager(seed), lady: false, mark: null, ...o, key: 'saga-' + seed });
const LK = {
  jingweng: () => V('鏡翁', { hat: 'taoist', hatC: '#c8a860', body: '#e8e0c8', trim: '#c8a860', cape: '#a89060', beard: 'long', beardC: '#f8f8f8', hair: '#f0f0f0', wpn: 'staff', robe: true }),
  bandit0: () => LOOKS.bandit(),
  cult: () => ({ ...LOOKS.bandit(), beard: null, hatC: '#1a1a2a', body: '#2a2a3a', trim: '#6a3a8a', key: 'saga-cult' }),
  xuefu: () => V('血蝠', { hat: 'taoist', hatC: '#3a1a2a', body: '#3a1a2a', trim: '#8a1a2a', cape: '#8a1a2a', beard: 'goatee', beardC: '#1a1410', skin: '#d8c8b8', wpn: 'fan', robe: true }),
  black: () => ({ ...LOOKS.turban(), hatC: '#1a1a1a', body: '#4a4a4a', trim: '#2a2a2a', key: 'saga-black' }),
  heitian: () => ({ ...LOOKS.turbanBoss(), hatC: '#1a1a1a', body: '#2a2a2a', trim: '#8a1a1a', cape: '#5a1a1a', key: 'saga-heitian' }),
  guard: () => ({ ...LOOKS.soldier('#8a2a2a'), key: 'saga-guard' }),
  jiao: () => ({ ...LOOKS.pirate(), hatC: '#1a3a3a', body: '#1a4a4a', cape: '#2a2a2a', beard: 'long', key: 'saga-jiao' }),
  mask: (game) => ({ ...game.lookOf(game.G.byName.Jasper), hat: 'band', hatC: '#1a1a1a', cape: '#1a1a1a', body: '#2a2a2a', key: 'saga-mask' }),
  bingpo: () => V('冰魄', { lady: true, hat: 'lady', hatC: '#c8f0ff', pin: '#e8ffff', body: '#a8d8f0', trim: '#ffffff', cape: '#e8f8ff', hair: '#e8f0ff', skin: '#f0f4f8', hairStyle: 'long', wpn: 'fan', robe: true, beard: null }),
  chiyan: () => V('赤炎', { hat: 'band', hatC: '#ff6a1a', body: '#d83a1a', trim: '#ffd86a', cape: '#8a1a0a', hair: '#e84a1a', wpn: 'staff', beard: null }),
  wangu: () => V('萬蠱', { lady: true, hat: 'lady', hatC: '#4a8a3a', pin: '#8ad84a', body: '#3a5a2a', trim: '#8ad84a', cape: '#2a3a1a', hair: '#d8d8d8', skin: '#c8b898', wpn: 'staff', robe: true, beard: null }),
  ice: () => ({ ...LOOKS.soldier('#8ac8e8'), skin: '#d8f0ff', key: 'saga-ice' }),
  fire: () => ({ ...LOOKS.nomad(), hatC: '#c84a1a', body: '#8a3a1a', key: 'saga-fire' }),
  gu: () => ({ ...LOOKS.barbarian(), hatC: '#4a8a3a', body: '#3a5a2a', key: 'saga-gu' }),
  xuanming: () => V('玄冥子', { hat: 'taoist', hatC: '#1a1a2a', body: '#1a1a2a', trim: '#8a5ad8', cape: '#3a1a5a', beard: 'long', beardC: '#d8d8e8', hair: '#d8d8e8', skin: '#d8d0d8', wpn: 'staff', robe: true }),
  ghost: () => ({ ...LOOKS.soldier('#3a3a4a'), skin: '#a8b8c8', key: 'saga-ghost' }),
  hufa: () => ({ ...LOOKS.bandit(), beard: 'long', beardC: '#d8d8e8', hat: 'helmet', hatC: '#3a1a5a', body: '#2a1a3a', trim: '#8a5ad8', cape: '#1a1a2a', key: 'saga-hufa' }),
  // 第二部
  shadow: (game, n) => ({ ...game.lookOf(game.G.byName[n]), body: '#1a1a24', trim: '#5a3a8a', cape: '#0a0a14', hatC: '#1a1a24', skin: '#8a8a9a', hair: '#0a0a0a', key: 'saga-shadow-' + n }),
  mirrorOf: (look) => ({ ...look, body: '#c8d0e0', trim: '#8a9ab0', cape: '#a8b0c0', skin: '#d8e0f0', hatC: '#b8c0d0', key: (look.key || 'x') + '-mirror' }),
  mirror: () => ({ ...LOOKS.soldier('#c8d0e0'), skin: '#d8e0f0', key: 'saga-mirror' }),
  shuijing: () => V('水鏡', { hat: 'taoist', hatC: '#5a7a6a', body: '#d8e0d0', trim: '#5a7a6a', cape: '#8aa898', beard: 'long', beardC: '#f0f0f0', hair: '#e8e8e8', wpn: 'fan', robe: true }),
  xiaoyan: () => V('小炎', { hat: 'band', hatC: '#e86a3a', body: '#e8a86a', trim: '#ffd86a', cape: null, hair: '#1a1410', wpn: null, beard: null }),
  jingling: () => V('鏡靈', { hat: 'taoist', hatC: '#c8d0e0', body: '#1a1a2a', trim: '#c8d0e0', cape: '#5a6a8a', beard: 'long', beardC: '#c8d0e0', hair: '#c8d0e0', skin: '#b8c0d0', wpn: 'staff', robe: true }),
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// what each of the story's enemies fears and shrugs off, and the great moves of the chiefs (battle.js: prep / ult)
const U = (n, prep, fx, pow = 0.4, every = 3, first = 2) => ({ ult: { n, prep, fx, pow, every, first } });
const TRAIT = {
  玄冥教徒: { weak: ['fire'] }, 血蝠: { weak: ['fire'], res: ['mind'], ...U('萬蝠噬血', '張開黑袍，滿廟的蝙蝠尖叫著飛起', 'feng', 0.28) },
  飛熊軍: { weak: ['earth'] }, 天牢守將: { weak: ['mind'] },
  翻江蛟: { weak: ['thunder'], res: ['water'], ...U('翻江倒海', '跳進湖裡，湖面捲起了巨浪', 'flood', 0.3) },
  黑巾軍: { weak: ['mind'] }, 黑巾護法: { weak: ['mind'] }, 黑天王: { weak: ['mind'], res: ['fire'], ...U('黑風捲地', '舉起黑旗，四野颳起了黑風', 'feng', 0.3) },
  假面郎君: { weak: ['mind'], res: ['phys'], ...U('千面幻殺', '的身影一分為十', 'feng', 0.32) }, 假劉備: { weak: ['mind'] }, 假關羽: { weak: ['mind'] }, 假張飛: { weak: ['mind'] },
  冰傀儡: { weak: ['fire'], res: ['phys'], immune: ['water'] }, 雪狼: { weak: ['fire'] },
  冰魄夫人: { weak: ['fire'], res: ['thunder', 'mind'], immune: ['water'], ...U('冰封千里', '雙袖一揮，冰宮裡的寒氣全往她身上聚', 'flood', 0.42) },
  火鴉騎: { weak: ['water'], immune: ['fire'] }, 赤炎童子: { weak: ['water'], immune: ['fire'], ...U('焚天烈焰', '拍著手笑，火圈越燒越高', 'blaze', 0.42) },
  巨蟒: { weak: ['earth'] }, 蠱人: { weak: ['fire'], immune: ['mind'] }, 萬蠱婆婆: { weak: ['fire'], res: ['water'], immune: ['mind'], ...U('萬蠱噬心', '打開了腰間最大的那個陶罐', 'feng', 0.4) },
  陰兵: { undead: true, weak: ['thunder'], res: ['phys'], immune: ['mind'] },
  玄冥左護法: { weak: ['fire'], res: ['thunder'], ...U('陰雷', '口中念念有詞，雲層裡雷聲滾滾', 'lei', 0.3, 3, 3) }, 玄冥右護法: { weak: ['thunder'], res: ['fire'], ...U('陰火', '袖中飛出點點鬼火', 'blaze', 0.3, 3, 2) },
  玄冥子: { weak: ['thunder'], res: ['fire', 'water'], immune: ['mind'], ...U('玄冥滅世', '高舉鏡心，整座玄冥宮都暗了下來', 'lei', 0.42, 3, 2) },
  刺客首領: { res: ['mind'] },
  // 第二部
  鏡兵: { weak: ['earth'], immune: ['mind'] }, 鏡兵隊長: { weak: ['earth'], res: ['phys'], immune: ['mind'] }, 鏡中: { weak: ['earth'], res: ['mind'] },
  Jeff之影: { weak: ['thunder'], res: ['mind'], ...U('決堤', '揮下令旗，漳河的大堤開始崩裂', 'flood', 0.4) },
  Erin之影: { weak: ['fire'], res: ['water'], immune: ['mind'], ...U('迷心香', '點起一爐紫色的香，煙霧飄滿了整座廟', 'feng', 0.36) },
  Josh之影: { weak: ['earth'], res: ['thunder'], ...U('無雙・影', '把赤霄劍的影子舉過頭頂，劍身爆出紅光', 'rock', 0.42) },
  Jasper之影: { weak: ['thunder'], res: ['phys'], ...U('千影亂舞', '的身影一分為八', 'feng', 0.36) },
  鏡湖龍王: { weak: ['earth'], res: ['water'], immune: ['mind'], ...U('鏡湖倒影', '沉進湖裡，湖面映出了你們每一個人的倒影', 'flood', 0.4) },
  鏡靈: { weak: ['earth'], res: ['thunder', 'fire', 'water'], immune: ['mind'], ...U('天命倒轉', '舉起古鏡，鏡面裡映出了整個天下', 'lei', 0.45, 3, 2) },
};

export class Saga {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; } get S() { return this.H?.saga; } get k() { return this.g.story.kit; }
  on() { return !!this.S && this.S.ch !== 'done' && this.S.ch !== 'end'; }
  part2() { return ['shadows', 'sage', 'mirror', 'end'].includes(this.S?.ch); }
  gen(n) { return this.G.byName[n]; }
  lead() { return this.S.lead; }
  // ---------------------------------------------------------------- a new story game: the family scattered
  static prepare(G, lead) {
    const city = (n) => G.cities.find((c) => c.name === n).id;
    for (const n of FAMILY) { const x = G.byName[n]; x.status = 'free'; x.fac = null; x.known = true; x.city = x.home = city(n === lead ? START : HOME[n]); if (n !== lead) x.saga = true; }
  }
  begin(lead) {
    this.H.saga = { lead, ch: 'find', fam: Object.fromEntries(FAMILY.filter((n) => n !== lead).map((n) => [n, 0])), shards: {}, log: [], ambush: 0 };
    this.H.food = Math.max(this.H.food || 0, 20); this.H.items.med = (this.H.items.med || 0) + 3;
  }
  // ---------------------------------------------------------------- the prologue
  async intro() {
    const k = this.k, L = this.lead(), S = this.S;
    await k.say('', '那是一個普通的週末。\n陳家四口——Jeff、Erin、Josh 和 Jasper——在博物館裡看一面青銅古鏡。展櫃裡，古鏡四周擺著四把古劍：干將、莫邪、赤霄、太阿。');
    await k.say('Jasper', '這面鏡子……是不是在發光？', 'Jasper');
    await k.say('Josh', '你又在亂講——欸，真的耶！', 'Josh');
    await k.say('', '鏡面像水一樣漾開。四道光從鏡子裡射出來，捲住了四個人——\n\n……\n\n不知道過了多久。');
    await k.say(L, { Jeff: '……這裡是哪裡？Erin？孩子們？\n手上這把劍……是展櫃裡的干將劍？', Erin: '……好痛。Jeff？Josh？Jasper？\n我手上怎麼會有一把劍？這是……莫邪劍？', Josh: '哇，我在哪？爸？媽？Jasper？\n這把劍好帥——赤霄劍！我是不是在做夢？', Jasper: '……哥？爸？媽？\n這裡怎麼都是穿古裝的人……我手上是太阿劍？' }[L], L);
    await k.say('鏡翁', '你終於醒了，持劍之人。', LK.jingweng());
    await k.say('鏡翁', `這裡是許昌，現在是東漢${this.G.year}年。董卓把持朝政，天下就要大亂了。\n你們看的那面「軒轅古鏡」，能照見天命。有人在這個時代把它打碎了——鏡子碎裂的力量，把你們一家人拉了進來，也把你們沖散到天下四方。`, LK.jingweng());
    await k.say('鏡翁', '打碎鏡子的人，叫做玄冥子。他想用鏡子的碎片改寫天命，讓自己坐上天子的位子。\n四把劍是鑄鏡時一起鑄的。四劍齊聚，鏡子才會回應你們——也才有機會送你們回家。', LK.jingweng());
    const lines = FAMILY.filter((n) => n !== L).map((n) => `・${VISION[n]}`).join('\n');
    await k.say('鏡翁', `我在鏡子裡看見了：\n${lines}\n\n先去找你的家人吧。`, LK.jingweng());
    await k.say('', '老人說完，身影就像水面的倒影一樣散去了。');
    await k.say(L, { Jeff: '下邳、宛、洛陽、吳……好，一個一個找回來。', Erin: '不管在哪裡，媽媽一定把你們找回來。', Josh: '好！我一定會把大家找回來！', Jasper: '下邳、宛、洛陽、吳……好遠喔。可是我一定要找到大家。' }[L], L);
    for (const n of Object.keys(S.fam)) this.mark('fam:' + n, HOME[n], `尋找${n}（${HOME[n]}）`);
    S.log.push('序章　鏡中天下');
    await k.say('', '【英傑傳奇】黑旗標出了家人所在的城市。順序隨你決定。\n天下照常運轉：可以一邊找人一邊練功、交朋友、投靠明主。打開選單的「劇情」可以看到目前的目標。\n\n【操作】方向鍵移動，Z 確認／對話，X 取消，C 打開選單。');
    this.g.hud();
  }
  // ---------------------------------------------------------------- goals on the map
  spot(cx, cz, d0, d1) {
    const W = this.g.world, ok = [T.PLAIN, T.MEADOW, T.FOREST, T.HILL, T.DESERT, T.FIELD, T.MARSH];
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * Math.PI * 2, d = (d0 + Math.random() * (d1 - d0)) * Math.sqrt(K), x = Math.round(cx + Math.cos(a) * d), z = Math.round(cz + Math.sin(a) * d);
      if (ok.includes(W.at(x, z)) && !this.H.missions.some((m) => m.x === x && m.z === z) && !W.placeAt(x, z)) return [x, z];
    }
    return this.g.landNear(Math.round(cx), Math.round(cz));
  }
  cityPos(n) { const c = this.G.cities.find((x) => x.name === n); return { c, p: CITY_POS[c.id] }; }
  // key: what the banner is for; at: a city's name (walk into it) or [x, z] (step on it)
  mark(key, at, label) {
    let x, z, city, inCity = false;
    if (typeof at === 'string') { const { c, p } = this.cityPos(at); x = p.x; z = p.y; city = c.id; inCity = true; }
    else { [x, z] = at; city = this.nearest(x, z); }
    const m = { id: Date.now() + Math.floor(Math.random() * 1e6), saga: key, city, x, z, boss: label, quiet: true, inCity, lv: 1, gold: 0, fame: 0, labelY: inCity ? 4.6 : 1.8 };
    this.H.missions.push(m); if (this.g.mode === 'world') this.g.missionMarks([m]);
    return m;
  }
  nearest(x, z) { let b = 0, bd = 1e9; for (const p of CITY_POS) { const d = Math.hypot(p.x - x, p.y - z); if (d < bd) { bd = d; b = p.id; } } return b; }
  unmark(key) { for (const m of this.H.missions.filter((m) => m.saga === key)) { this.g.act.dropBanner(m); m.done = true; } this.H.missions = this.H.missions.filter((m) => m.saga !== key); }
  field(key, city, label, d0 = 7, d1 = 13) { const { p } = this.cityPos(city); return this.mark(key, this.spot(p.x, p.y, d0, d1), label); }
  // ---------------------------------------------------------------- what to do now (the HUD and the 劇情 screen)
  goal() {
    const S = this.S; if (!S) return '';
    if (S.ch === 'find') { const left = Object.entries(S.fam).filter(([, v]) => v < 2); return '尋找家人：' + left.map(([n, v]) => `${n}（${v ? this.H.missions.find((m) => m.saga === 'fam2:' + n)?.boss || HOME[n] : HOME[n]}）`).join('、'); }
    if (S.ch === 'shards') return '奪回鏡片：' + Object.entries(SHARD).filter(([id]) => !S.shards[id]).map(([, s]) => `「${s.n}」${s.where}`).join('、');
    if (S.ch === 'final') return '討伐玄冥子：泰山・玄冥宮';
    if (S.ch === 'shadows') return '找回鏡影：' + FAMILY.filter((n) => S.sh[n] < 2).map((n) => `${n}之影（${S.sh[n] ? SHADOW[n].place : SHADOW[n].city}）`).join('、');
    if (S.ch === 'sage') return S.sage ? '取得照心燈：鏡湖（襄陽城外）' : '拜訪水鏡先生：襄陽';
    if (S.ch === 'mirror') return '走進鏡中天下：許昌';
    return '';
  }
  hudRow() { return this.on() ? `<div class="h-row h-saga">📜 ${this.goal()}</div>` : ''; }
  async screen() {
    const S = this.S, ch = { find: '第一章　四散天涯', shards: '第二章　三片鏡片', final: '第三章　泰山玄冥宮', done: '終章', ...CH2 }[S.ch];
    const fam = FAMILY.map((n) => `<span style="color:${n === S.lead || S.fam[n] === 2 ? '#8aff8a' : S.fam[n] ? '#ffd86a' : '#9a9a9a'}">${n}${n === S.lead ? '（你）' : S.fam[n] === 2 ? '　✔' : S.fam[n] ? '　同行中' : `　${HOME[n]}`}</span>`).join('　');
    const sh = Object.entries(SHARD).map(([id, s]) => `<span style="color:${S.shards[id] ? '#8aff8a' : '#9a9a9a'}">「${s.n}」${s.where}・${s.boss}${S.shards[id] ? '　✔' : ''}</span>`).join('　');
    const tip = { find: '建議等級 8 以上。', shards: '鏡片的守護者很強，建議等級 16 以上。', final: '玄冥宮是最後的決戰，建議等級 24 以上。', done: '', shadows: '鏡影和你們一樣強，建議等級 28 以上。', sage: '鏡湖的守護者建議等級 32 以上。', mirror: '鏡中天下是第二部最後的決戰，建議等級 36 以上。', end: '' }[S.ch];
    const over = S.ch === 'done' ? (S.stay && !S.p2 ? '<p>第一部完結。你們選擇留在亂世……過一陣子，古鏡好像有點不對勁。</p>' : '<p>故事已經完結。天下還在運轉，你們可以繼續闖蕩。</p>') : '<p>第二部「鏡影亂世」完結。天下還在運轉，你們可以繼續闖蕩。</p>';
    const shd = S.sh ? `<h4>鏡影</h4><p>${FAMILY.map((n) => `<span style="color:${S.sh[n] === 2 ? '#8aff8a' : '#9a9a9a'}">${n}之影・${SHADOW[n].ch}${S.sh[n] === 2 ? '　✔' : `　${SHADOW[n].city}`}</span>`).join('　')}</p>` : '';
    await this.g.ui.panel(`<h3>英傑傳奇　${ch}</h3>${this.on() ? `<p><b style="color:#ffd86a">目標：</b>${this.goal()}</p><p class="dim">${tip}黑旗標在大地圖和小地圖上。</p>` : over}${shd}
      <h4>家人</h4><p>${fam}</p>${S.ch !== 'find' && !this.part2() ? `<h4>軒轅古鏡的碎片</h4><p>${sh}</p>` : ''}${S.lgz ? `<h4>支線</h4><p>桃園之約（劉備、關羽、張飛）：${{ 1: `到${this.G.cities[this.gen('劉備')?.city]?.name || ''}拜訪`, 2: '討伐冒名的匪徒', 3: '<span style="color:#8aff8a">完成・決戰時會來助陣</span>', 9: '錯過了' }[S.lgz] || ''}</p>` : ''}<h4>經過</h4>${S.log.map((t) => `<p>✦ ${t}</p>`).join('')}`, { title: '劇情', cls: 'wide' });
  }
  // ---------------------------------------------------------------- the levels of the story's enemies: set by the chapter and the years, never by the party
  lv(base) { return Math.max(base, this.g.act.foeLv(false) + Math.round(base / 6)); }
  // the further along the story, the stronger its enemies: each one found, each shard taken
  findLv() { return 7 + 2 * Object.values(this.S.fam).filter((v) => v === 2).length; }
  shardLv() { return 20 + 2 * Object.keys(this.S.shards).length; }
  foe(name, kind, lv, look, o = {}) {
    const f = this.g.act.foe(name, kind, lv, o.color || null, !!o.boss);
    if (look && f.look) { f.look = look; f.solLook = { ...look, small: true, key: look.key + 's' }; }
    if (o.spells) { f.spells = o.spells; f.int = Math.max(f.int, o.int || 85); f.sp = Math.round(f.int * 1.2 + lv); }
    if (o.war) f.war = Math.max(f.war, o.war);
    if (o.sol) { f.solMax = Math.round(f.solMax * o.sol); f.sol = f.solMax; }
    const A = this.arms ?? 0; f.wpn += Math.round(A * lv / 3 * (o.boss ? 2 : 1)); f.arm += Math.round(A * lv / 4 * (o.boss ? 2 : 1));
    const T = TRAIT[name] || (name.startsWith('鏡中') ? TRAIT.鏡中 : null); if (T) { for (const k of ['weak', 'res', 'immune']) f[k] = (T[k] || []).slice(); if (T.ult) f.ult = { ...T.ult }; if (T.undead) f.undead = true; }
    return f;
  }
  // how well the story's enemies are armed: 0 in the first chapter, then more (set by the goal being fought)
  armed(a) { this.arms = a; }
  many(n, name, kind, lv, look) { return Array.from({ length: n }, () => this.foe(name, kind, lv, look)); }
  // ---------------------------------------------------------------- walking into a city
  async town() {
    if (!this.on() || !this.g.town) return false;
    if (await this.lgzTown()) return true;
    if (await this.p2Town()) return true;
    if (this.S.ch !== 'find') return false;
    const C = this.g.town.C, n = Object.keys(this.S.fam).find((x) => this.S.fam[x] === 0 && HOME[x] === C.name);
    if (!n) return false;
    this.g.locked = true;
    try { await this['meet' + n](); } catch (e) { console.error(e); } finally { this.g.locked = false; this.g.hud(); }
    return true;
  }
  // the one found joins; the second half of the chapter is a banner outside the city
  async found(n, label) {
    const x = this.gen(n); delete x.saga; this.k.join(x, 100); await swear(this.g, x, true); addBond(this.g, x.id, 100);
    if (!this.H.party.includes(x.id)) { this.H.party.push(x.id); x.follow = this.H.pid; this.g.respawnParty(); }
    this.S.fam[n] = 1; this.unmark('fam:' + n);
    this.field('fam2:' + n, HOME[n], label);
    this.k.toast(`${n}加入了隊伍！`);
  }
  async meetErin() {
    const k = this.k, L = this.lead(), hua = this.k.alive('華佗') && !this.gen('華佗').isPlayer ? '華佗' : null;
    await k.say('', '宛城裡瘟疫橫行，到處是咳嗽聲和哭聲。\n城南搭了一座義診的草棚，排隊的病人一直排到了街口。');
    await k.say('Erin', '下一位——先喝這碗藥，回去多喝熱水，三天就會退燒。', 'Erin');
    await k.say(L, `……${call(L, 'Erin')}！`, L);
    await k.say('Erin', `${call('Erin', L)}！你沒事！\n${ROLE[L] === 'dad' ? '孩子們呢？……還沒找到？' : '你有沒有受傷？讓我看看——'}`, 'Erin');
    await k.say('Erin', '我醒來就在這座城裡。到處都是病人，我只好先把他們顧好……\n可是這病很怪。我治好一個，第二天又多十個。病倒的人，都喝過城西那口井的水。', 'Erin');
    if (hua) await k.say('華佗', '這位夫人說得沒錯。老夫看過了，這不是天災——井裡有人下了蠱毒。', '華佗');
    else await k.say('老大夫', '這不是天災——井裡有人下了蠱毒。', '老大夫');
    await k.say('百姓', '昨晚有人看見一群黑衣人，提著陶罐從城西的荒廟出來！', '百姓');
    await k.say('Erin', '黑衣人……我們去看看。這次換我跟著你。', 'Erin');
    await this.found('Erin', '荒廟・血蝠');
  }
  async meetJosh() {
    const k = this.k, L = this.lead();
    await k.say('', '洛陽城裡人心惶惶，董卓的西涼兵在街上橫行。');
    await k.say('百姓', '聽說了沒？昨天有個少年在城門口大喊，要跟溫侯呂布單挑！\n兩個人打了一百多回合不分勝負，結果城樓上放冷箭，那少年被抓進天牢了。\n說是三天後要斬首示眾！', '百姓');
    await k.say(L, { Jeff: '……一定是 Josh。這孩子，從小就愛逞強。', Erin: '……一定是 Josh。這孩子，怎麼這麼衝動！', Jasper: '……一定是哥。他每次都這樣。' }[L], L);
    const c = await k.ask('天牢守衛森嚴。要怎麼救人？', [{ k: 'fight', n: '硬闖天牢（打一場仗）' }, { k: 'bribe', n: `買通獄卒（300 金${this.H.gold < 300 ? '，錢不夠' : ''}）` }, { k: 'trick', n: '假傳董卓的命令（智力）' }]);
    let ok = false;
    if (c === 'bribe' && this.H.gold >= 300) { this.k.gold(-300); ok = true; await k.say('獄卒', '嘿嘿，什麼少年？我今晚什麼都沒看見。', '獄卒'); }
    else if (c === 'trick' && k.check('int', 80)) { ok = true; await k.say('獄卒', '相國要提審犯人？……是、是！小的這就開門！', '獄卒'); }
    if (!ok) {
      if (c !== 'fight') await k.say('獄卒', '慢著——你們是什麼人？來人啊！有人劫獄！', '獄卒');
      const lv = this.lv(this.findLv() - 1), r = await k.battle([this.foe('天牢守將', 'soldier', lv + 2, LK.guard(), { boss: true }), ...this.many(3, '獄卒', 'soldier', lv, LK.guard())], { terrain: 'city', title: '劫天牢！', night: true, noFlee: true });
      if (r !== 'win') { await k.say('', '守衛越來越多，只好先退出天牢。……換個辦法再來吧。'); return this.retry('Josh'); }
    }
    await k.say('Josh', `${call('Josh', L)}！我就知道你會來！\n那個呂布真的超強，我跟他打了一百回合都分不出勝負——要不是他們放冷箭，我才不會被抓！`, 'Josh');
    if (ROLE[L] !== 'small') await k.say(L, '你啊……先別說了，快走！', L);
    else await k.say(L, '哥你小聲一點啦！快走！', L);
    await k.say('', '才剛逃出天牢，城門口就響起了馬蹄聲。\n一騎赤紅的快馬追了出來，馬上的人手持方天畫戟——');
    await this.found('Josh', '洛陽城外・呂布追兵');
  }
  async meetJasper() {
    const k = this.k, L = this.lead(), r0 = this.H.rec[this.H.pid];
    await k.say('', '吳郡的市集熱鬧非凡。忽然有人在你身上輕輕撞了一下——\n錢袋不見了！一個蒙面少年踩著屋簷，一溜煙跑遠了。');
    await k.say('蒙面俠盜', '多謝施捨啦！', LK.mask(this.g));
    const go = await k.ask('要追嗎？', [{ k: true, n: '追上去！' }, { k: false, n: '算了，錢再賺就有' }]);
    if (!go) { await k.say('', '你站在原地嘆了口氣。……這件事一直掛在心上，下次再來吳郡，一定要找到那個小偷。'); return this.retry('Jasper'); }
    await k.say('', '你一路追到城外的竹林，蒙面少年拔出雙劍，回身就砍！');
    const r = await k.duelWith('蒙面俠盜', LK.mask(this.g), Math.max(10, r0.lv), 96, 90, 95);
    await k.say('', r === 'win' ? '你挑飛了他的劍，順手扯下了他的面巾——' : '他的劍快得看不清。你一個踉蹌，卻也扯下了他的面巾——');
    await k.say('Jasper', `……${call('Jasper', L)}？！`, 'Jasper');
    await k.say(L, `Jasper？！你、你在這裡當小偷？`, L);
    await k.say('Jasper', '我只偷壞人的錢啦！剛剛……剛剛是認錯人。錢袋還你。', 'Jasper');
    await k.say('Jasper', '太湖上有一夥水賊，老大叫「翻江蛟」。他們把漁夫抓去，賣給一個叫玄冥教的地方，聽說是拿來煉丹的。\n我一個人打不過他們整座水寨，只好先偷他們的錢，拿去給漁夫的家人。', 'Jasper');
    await k.say(L, { Jeff: '……好孩子。這次，我們一起去。', Erin: '……傻孩子，一個人多危險。這次我們一起去。', Josh: '玄冥教？好，這次哥跟你一起去，把水寨整個拆了！' }[L], L);
    if (k.alive('孫策') && !this.gen('孫策').isPlayer) await k.say('孫策', '好身手！我叫孫策，總有一天要平定江東。太湖那夥水賊，我也看不順眼很久了——\n可惜我手下沒幾個人。你們若要去，我在岸邊替你們點起烽火引路！', '孫策');
    await this.found('Jasper', '太湖水寨・翻江蛟');
  }
  async meetJeff() {
    const k = this.k, L = this.lead();
    await k.say('', '下邳城被一群頭裹黑巾的賊兵圍了三天。\n城頭上，一位手持干將劍的人正在指揮守軍——');
    await k.say('Jeff', '弓手退後三步！等他們爬到一半再放箭——現在！', 'Jeff');
    await k.say('Jeff', `……${call('Jeff', L)}？是你！${ROLE[L] === 'mom' ? '你沒事就好。' : '你沒受傷吧？'}`, 'Jeff');
    await k.say('Jeff', '這些黑巾軍不是一般的黃巾餘黨。他們的首領叫「黑天王」，是一個叫玄冥教的人派來的。\n他們不要錢、不要糧，只要我手上這把干將劍。', 'Jeff');
    if (k.alive('陶謙') && !this.gen('陶謙').isPlayer) await k.say('陶謙', '這位先生守了下邳三天三夜，老夫感激不盡。只是城中兵少，再守下去……', '陶謙');
    await k.say('Jeff', '守是守不住的，要破城外的大營。\n我們從背後打過去，先破前營，再擒黑天王——一起去吧。', 'Jeff');
    await this.found('Jeff', '下邳城外・黑巾大營');
  }
  retry(n) { this.k.toast(`${n}還在${HOME[n]}，下次進城可以再試一次。`); }
  // ---------------------------------------------------------------- stepping on a banner
  async banner(m) {
    this.g.locked = true;
    try { const [kind, id] = m.saga.split(':'); this.armed({ fam: 0, fam2: 0, shard: 2, final: 1.8, sh2: 2.2, lake: 2.4 }[kind] ?? 0); if (kind === 'fam') await this.k.say('', `${HOME[id]}就在附近。走進城裡看看吧。`);
      if (kind === 'sh' || kind === 'sage' || kind === 'mirror') await this.k.say('', '就在附近了。走進城裡看看吧。'); if (kind === 'sh2') await this.shadowFight(id); if (kind === 'lake') await this.lake(); if (kind === 'fam2') await this['field' + id](); if (kind === 'shard') await this.shard(id); if (kind === 'final') await this.final(); if (kind === 'side') await this.lgzCamp(); }
    catch (e) { console.error(e); } finally { this.g.locked = false; this.g.hud(); }
  }
  // the second half of each chapter
  async fieldErin() {
    const k = this.k, lv = this.lv(this.findLv());
    await k.say('', '城西的荒廟裡點著幽綠的燈火。一個瘦得像竹竿的人，正把黑色的蟲子倒進陶罐裡。');
    await k.say('血蝠', '嘻……被發現了？無所謂。教主要的不是這座城的人命，是那把莫邪劍。\n把劍留下，我就讓這座城的人多活幾天。', LK.xuefu());
    await k.say('Erin', '我是醫生。害人的蠱，我一隻也不會留下。', 'Erin');
    const r = await k.battle([this.foe('血蝠', 'bandit', lv + 3, LK.xuefu(), { boss: true, spells: ['yao'], int: 80 }), ...this.many(3, '玄冥教徒', 'bandit', lv, LK.cult())], { terrain: 'forest', title: '荒廟的毒師！', night: true, foeForm: 'heyi' });
    if (r !== 'win') return this.lost();
    await k.say('血蝠', '玄冥……教主……會替我報仇的……鏡子……的力量……', LK.xuefu());
    await k.say('Erin', '玄冥教？鏡子？……看來把我們帶到這裡來的，就是他們。', 'Erin');
    await k.say('', '井水清了。不出十天，宛城的瘟疫就平息了。\n百姓在城南的義診棚前，給「Erin 娘娘」立了一塊小小的牌位。');
    await this.done('Erin', 300, 120);
  }
  async fieldJosh() {
    const k = this.k, lv = this.lv(this.findLv()), lu = this.k.enemy('呂布', 500 + lv * 60, '#8a2a2a', 6);
    await k.say('呂布', '小子，昨天的架還沒打完！\n還有你們——想從我呂奉先手上把人帶走？', '呂布');
    await k.say('Josh', '上次是你們放冷箭！這次我們一家人一起上，看你還怎麼囂張！', 'Josh');
    if (lu.gid != null || lu.name === '呂布') { lu.ult = { n: '天下無雙', prep: '勒住赤兔馬，方天畫戟高高舉起', fx: 'rock', pow: 0.32, every: 3, first: 2 }; lu.res = ['mind']; lu.weak = []; }
    const r = await k.battle([lu, ...this.many(2, '飛熊軍', 'soldier', lv, LK.guard())], { terrain: 'plain', title: '呂布追來了！', foeForm: 'fengshi' });
    if (r !== 'win') return this.lost();
    await k.say('呂布', '哼……那小子身邊的人也不簡單。今天就放你們一馬！', '呂布');
    await k.say('Josh', '下次我一個人就贏你！', 'Josh');
    await k.say('', '赤兔馬掉頭回城了。「天牢少年戰呂布」的事，很快就傳遍了天下。');
    await this.done('Josh', 200, 200);
  }
  async fieldJasper() {
    const k = this.k, lv = this.lv(this.findLv());
    await k.say('', '太湖上霧氣茫茫。水寨的木樁上綁著幾十個漁夫，岸邊停著一艘掛黑帆的大船。');
    await k.say('翻江蛟', '哪來的小鬼？這批人牲是玄冥教主訂下的，誰敢動，老子就把他也捆上船！', LK.jiao());
    await k.say('Jasper', '翻江蛟，你的錢我已經偷光了。現在換你的寨子。', 'Jasper');
    const r = await k.battle([this.foe('翻江蛟', 'pirate', lv + 3, LK.jiao(), { boss: true, war: 88 }), ...this.many(3, '水賊', 'pirate', lv)], { terrain: 'river', title: '太湖水寨！', foeForm: 'changshe' });
    if (r !== 'win') return this.lost();
    await k.say('', '水寨燒起來了。漁夫們一個一個被鬆綁，跪在岸邊磕頭。');
    await k.say('Jasper', '……其實我一直很怕。一個人在這裡，什麼人都不認識。\n還好你們來了。', 'Jasper');
    await this.done('Jasper', 400, 150);
  }
  async fieldJeff() {
    const k = this.k, lv = this.lv(this.findLv());
    await k.say('Jeff', '前營三千人，中軍是黑天王。前營一亂，中軍就會出來救——我們就在那時候打他。', 'Jeff');
    const ok = await k.waves([() => this.many(3, '黑巾軍', 'turban', lv - 1, LK.black()), () => [this.foe('黑天王', 'turban', lv + 4, LK.heitian(), { boss: true, war: 90, sol: 1.2 }), ...this.many(3, '黑巾護法', 'turban', lv + 1, LK.black())]], { terrain: 'plain', titles: ['先破前營！', '黑天王出陣了！'] });
    if (!ok) return this.lost();
    await k.say('黑天王', '干將……莫邪……赤霄……太阿……四劍要是聚在一起……教主……', LK.heitian());
    await k.say('Jeff', '四劍聚在一起，會怎麼樣？……他死了。', 'Jeff');
    await k.say('', '黑巾軍一哄而散。下邳城門大開，百姓提著酒肉出來迎接。');
    await this.done('Jeff', 500, 150);
  }
  lost() { return this.k.say('', '這一仗打不贏，只好先退下來。黑旗還在原地——練強一點再來吧。'); }
  // a chapter ends: and when the family is whole, the four swords sing
  async done(n, gold, fame) {
    const S = this.S; S.fam[n] = 2; this.unmark('fam2:' + n); this.k.gold(gold); this.k.fame(fame);
    S.log.push(`${CH_N[n]}：找到了 ${n}`); deed(this.g, `與${n}重逢`);
    await this.k.say('', `「${CH_N[n]}」完結！金 +${gold}、名聲 +${fame}`);
    if (Object.values(S.fam).every((v) => v === 2)) await this.reunion();
  }
  async reunion() {
    const k = this.k, S = this.S;
    await k.say('', '那天夜裡，一家四口第一次在同一堆營火旁坐下。\n忽然，四把劍同時發出嗡嗡的鳴聲。干將、莫邪、赤霄、太阿的劍光交會在一起——光裡浮現出鏡翁的身影。');
    await k.say('鏡翁', '四劍齊聚了。很好。\n現在你們該知道真相了：玄冥子打碎古鏡，鏡子碎成了四片。「鏡心」在他自己手上；另外三片「天」「地」「人」，交給了他的三個弟子看守。', LK.jingweng());
    await k.say('鏡翁', '・「天」之鏡片在幽州，冰魄夫人的冰宮裡。\n・「地」之鏡片在涼州，赤炎童子的火谷中。\n・「人」之鏡片在南中，萬蠱婆婆的密林深處。\n\n三片鏡片到手，才能破開泰山玄冥宮的結界。', LK.jingweng());
    await k.say('Josh', '三個地方？那我們分頭去，比較快——', 'Josh');
    await k.say('Erin', '不行。這次我們一家人，誰都不准再分開。', 'Erin');
    await k.say('Jeff', '聽媽媽的。北、西、南，一個一個來。', 'Jeff');
    await k.say('Jasper', '……嗯！', 'Jasper');
    S.ch = 'shards'; S.log.push('第一章完：一家人團聚，四劍共鳴');
    for (const [id, s] of Object.entries(SHARD)) this.field('shard:' + id, s.city, s.place, 9, 16);
    deed(this.g, '一家團聚，四劍共鳴', true); this.g.audio.sfx('level');
    k.toast('第二章「三片鏡片」開始！黑旗標出了三位守護者的所在。');
  }
  // ---------------------------------------------------------------- the three shards
  async shard(id) {
    const k = this.k, s = SHARD[id], lv = this.lv(this.shardLv());
    if (id === 'tian') {
      await k.say('', '風雪之中，一座整塊冰雕成的宮殿，冷得連呼出的氣都會結霜。');
      if (k.alive('趙雲') && !this.gen('趙雲').isPlayer && !k.inParty(this.gen('趙雲'))) await k.say('趙雲', '在下常山趙子龍。冰宮的妖人擄走了白馬義從的十幾個弟兄……諸位若要闖宮，雲在宮外替你們擋住援兵！', '趙雲');
      await k.say('冰魄夫人', '玄冥子說過，你們會來。\n「天」之鏡片就在我身後。想拿走它——除非這座冰宮塌了。', LK.bingpo());
      await k.say('Erin', '好冷……大家靠緊一點。', 'Erin');
    } else if (id === 'di') {
      await k.say('', '戈壁上燒著一圈永遠不滅的火。火圈中間，一個紅頭髮的孩子坐在大石頭上晃著腳。');
      if (k.alive('馬超') && !this.gen('馬超').isPlayer && !k.inParty(this.gen('馬超'))) await k.say('馬超', '西涼馬孟起！這火谷燒了我們好幾個牧場——你們若要進去，算我一份！', '馬超');
      await k.say('赤炎童子', '好玩好玩！又有人來陪我玩火了！\n上次來的人，一下子就燒成灰了。你們可不可以撐久一點？', LK.chiyan());
      await k.say('Jasper', '……他看起來比我還小。', 'Jasper');
    } else {
      await k.say('', '瘴氣瀰漫的密林深處，樹上掛著一串一串的陶罐，裡面窸窸窣窣地爬著東西。');
      await k.say('萬蠱婆婆', '嘻嘻嘻，四個細皮嫩肉的，正好拿來養我的寶貝蠱王。', LK.wangu());
      await k.say('Josh', '好噁心！Jasper，你負責那些蟲，我負責那個婆婆！', 'Josh');
    }
    const minions = { tian: () => [...this.many(2, '雪狼', 'wolf', lv), ...this.many(3, '冰傀儡', 'soldier', lv, LK.ice())], di: () => this.many(5, '火鴉騎', 'nomad', lv, LK.fire()), ren: () => [...this.many(2, '巨蟒', 'snake', lv), ...this.many(3, '蠱人', 'barbarian', lv, LK.gu())] }[id];
    const boss = { tian: () => [this.foe('冰魄夫人', 'bandit', lv + 5, LK.bingpo(), { boss: true, spells: ['feng', 'zhen'], int: 95, sol: 5 }), ...this.many(3, '冰傀儡', 'soldier', lv + 2, LK.ice())],
      di: () => [this.foe('赤炎童子', 'bandit', lv + 5, LK.chiyan(), { boss: true, spells: ['lei', 'yao'], int: 92, war: 92, sol: 5 }), ...this.many(3, '火鴉騎', 'nomad', lv + 2, LK.fire())],
      ren: () => [this.foe('萬蠱婆婆', 'bandit', lv + 5, LK.wangu(), { boss: true, spells: ['yao', 'huan'], int: 96, sol: 5 }), ...this.many(3, '蠱人', 'barbarian', lv + 2, LK.gu())] }[id];
    const ok = await k.waves([minions, boss], { terrain: s.terrain, foeForm: { tian: 'fangyuan', di: 'fengshi', ren: 'heyi' }[id], titles: [`闖入${s.place.split('・')[1]}！`, `${s.boss}出手了！`] });
    if (!ok) return this.lost();
    if (id === 'tian') {
      await k.say('冰魄夫人', '師父……玄冥子……他說只要我守住鏡片，就讓我永遠不老……\n原來，他根本不在乎我們……', LK.bingpo());
      await k.say('', '冰宮轟然崩塌。冰屑落定之處，一塊閃著白光的鏡片靜靜地躺著。');
    } else if (id === 'di') {
      await k.say('赤炎童子', '嗚……好痛……我、我只是想要有人陪我玩……', LK.chiyan());
      await k.say('Erin', '別怕。……你身上被下了咒，對不對？讓阿姨看看。', 'Erin');
      await k.say('', 'Erin 的手上亮起柔和的光。孩子的紅髮慢慢變黑，眼睛裡的火也熄了。\n他抱著 Erin 哭了好久，然後從懷裡掏出一塊溫熱的鏡片。');
    } else {
      await k.say('萬蠱婆婆', '我的蠱王……我養了四十年的蠱王……！', LK.wangu());
      await k.say('', '婆婆化成一灘黑水，滲進了泥土裡。密林的瘴氣散開，陽光第一次照了進來。\n樹根下，埋著一塊泛著綠光的鏡片。');
    }
    this.S.shards[id] = true; this.unmark('shard:' + id);
    const st = s.stat, ups = [];
    for (const n of FAMILY) { const x = this.gen(n); if (!x || x.status === 'dead') continue; x.base[st] = Math.min(110, x.base[st] + 3); refresh(this.G, x); ups.push(n); }
    const relic = k.relic(3, 8); k.gold(800); k.fame(150);
    this.S.log.push(`奪回「${s.n}」之鏡片：打倒${s.boss}`); deed(this.g, `打倒${s.boss}`);
    await k.say('', `得到了「${s.n}」之鏡片！\n鏡片的光照在四人身上：${ups.join('、')}的${STAT_N[st]} +3。\n金 +800、名聲 +150、得到寶物「${relic}」。`);
    this.g.audio.sfx('level');
    if (Object.keys(SHARD).every((x) => this.S.shards[x])) await this.toFinal();
  }
  async toFinal() {
    const k = this.k, S = this.S;
    await k.say('', '三片鏡片在 Jeff 的手心裡拼在一起，缺了中間一塊。裂縫裡透出一座高山的影子——泰山。');
    await k.say('鏡翁', '結界破了。玄冥子就在泰山之巔的玄冥宮裡，「鏡心」也在那裡。\n小心，他已經用鏡子的力量喚醒了戰死之人的魂魄。', LK.jingweng());
    await k.say('Jasper', '……打完這一仗，我們就可以回家了嗎？', 'Jasper');
    await k.say('Jeff', '打完這一仗再說。', 'Jeff');
    S.ch = 'final'; S.log.push('第二章完：三片鏡片到手，泰山的結界破了');
    const ps = ['平原', '濮陽', '小沛', '北海'].map((n) => this.cityPos(n).p), cx = ps.reduce((a, p) => a + p.x, 0) / 4, cz = ps.reduce((a, p) => a + p.y, 0) / 4;
    this.mark('final', this.spot(cx, cz, 0, 5), '泰山・玄冥宮');
    k.toast('第三章「泰山玄冥宮」開始！');
  }
  // ---------------------------------------------------------------- the end
  async final() {
    const k = this.k, L = this.lead(), lv = this.lv(27);
    await k.say('', '泰山之巔，烏雲翻滾。玄冥宮的大門敞開著，裡面傳出千萬人的哭號——那是被鏡子困住的戰死之魂。');
    await k.say('玄冥子', '歡迎，來自千年之後的人。\n你們知道這天下接下來會怎樣嗎？黃巾、董卓、群雄割據、三分天下……百年戰亂，死者以千萬計。', LK.xuanming());
    await k.say('玄冥子', '我只是想用鏡子改寫這一切。由我來做天子，一統天下，讓戰亂今天就結束。\n你們何必阻我？', LK.xuanming());
    const c = await k.ask('玄冥子問你——', [{ k: 'a', n: '「用千萬冤魂換來的太平，不是太平。」' }, { k: 'b', n: '「天下該怎麼走，不是你一個人說了算。」' }, { k: 'c', n: '「少廢話，把鏡心交出來！」' }]);
    await k.say(L, { a: '用千萬冤魂換來的太平，不是太平。', b: '天下該怎麼走，不是你一個人說了算。', c: '少廢話，把鏡心交出來！' }[c], L);
    await k.say('玄冥子', '……那就讓你們也變成我的陰兵吧！', LK.xuanming());
    const helpers = this.S.lgz === 3 ? ['劉備', '關羽', '張飛'].map((n) => this.gen(n)).filter((x) => x && (x.status === 'serving' || x.status === 'free') && !x.isPlayer && !this.H.party.includes(x.id)) : [];
    if (helpers.length) { await k.say('', '山道上傳來一陣急促的馬蹄聲——'); await k.say('劉備', '桃園之約，備不敢忘！雲長、翼德，隨我殺進去！', '劉備'); await k.say('張飛', '燕人張翼德在此！哪個妖道敢欺負俺的朋友！', '張飛'); this.guests(helpers); }
    let ok; try { ok = await k.waves([() => this.many(5, '陰兵', 'soldier', lv + 1, LK.ghost()),
      () => [this.foe('玄冥左護法', 'bandit', lv + 3, LK.hufa(), { boss: true, spells: ['lei'], int: 85, sol: 1.6 }), this.foe('玄冥右護法', 'bandit', lv + 3, LK.hufa(), { boss: true, spells: ['huan'], int: 85, sol: 1.6 }), ...this.many(3, '陰兵', 'soldier', lv + 2, LK.ghost())],
      () => [this.foe('玄冥子', 'bandit', lv + 8, LK.xuanming(), { boss: true, spells: ['lei', 'yao', 'feng', 'huan'], int: 99, war: 97, sol: 3.4 }), ...this.many(3, '陰兵', 'soldier', lv + 3, LK.ghost())]],
      { terrain: 'hill', noFlee: true, foeForm: 'heyi', titles: ['玄冥宮・陰兵出陣', '玄冥護法擋住了去路！', '決戰玄冥子！'] }); } finally { this.H.guests = []; }
    if (!ok) return this.lost();
    await k.say('玄冥子', '不可能……我的陰兵……\n——鏡心還在我手上！只要殺了你，四劍就湊不齊了！', LK.xuanming());
    await k.say('', `玄冥子化作一道黑影，直撲${L}！`);
    const r0 = this.H.rec[this.H.pid], r = await k.duelWith('玄冥子', LK.xuanming(), Math.max(lv + 6, r0.lv), 99, 95, 99);
    if (r === 'win') await k.say('', `${L}的劍光穿過黑影。玄冥子發出一聲長嘯——`);
    else { const hit = FAMILY.filter((n) => n !== L).map((n) => `${n} 的${{ Jeff: '八陣圖', Erin: '治癒之光', Josh: '落雷', Jasper: '幻影' }[n]}`); await k.say('', `${L}被打倒在地。黑影舉起了手——\n就在這時，${hit.slice(0, -1).join('、')}和${hit[hit.length - 1]}，同時落在玄冥子身上！`); }
    await k.say('玄冥子', '……我只是……不想再看到……那麼多人死……', LK.xuanming());
    await k.say('', '黑影散了。一塊漆黑的鏡片落在地上，慢慢褪成了清澈的銀色。\n四片鏡片自己飛了起來，在半空中合成一面完整的古鏡。宮裡的哭聲停了，千萬點光芒從鏡中飛出，散向四方。');
    this.H.st.kills.push('玄冥子'); this.unmark('final'); k.gold(3000); k.fame(500);
    const relic = k.relic(4, 10);
    this.S.log.push('第三章完：在泰山討伐玄冥子，軒轅古鏡復原');
    await k.say('', `金 +3000、名聲 +500、得到寶物「${relic}」。`);
    await k.say('鏡翁', '你們做到了。\n古鏡可以送你們回家——也可以不送。這個天下還很亂，可是因為你們，已經有很多人活了下來。', LK.jingweng());
    await k.say('Josh', '回家的話……就再也見不到呂布、趙雲那些人了耶。', 'Josh');
    await k.say('Jasper', '可是我想念我的床……', 'Jasper');
    await k.say('Erin', '不管去哪裡，我們一家人在一起就好。', 'Erin');
    const go = await k.ask('要怎麼做？', [{ k: 'home', n: '回到千年後的家（故事結束，結算一生）' }, { k: 'stay', n: '留在亂世（繼續在天下闖蕩）' }]);
    this.S.ch = 'done';
    if (go === 'home') {
      deed(this.g, '四劍歸鏡，回到了千年之後的家', true);
      await k.say('', '鏡面像水一樣漾開，四道光捲住了四個人——\n\n……\n\n「各位遊客，本館即將閉館。」\n一家四口站在展櫃前，手上空空的。展櫃裡，古鏡完整無缺，四把古劍靜靜地擺在旁邊。');
      await k.say('', '展櫃旁的說明牌上寫著：\n「相傳東漢末年，有四位來歷不明的英雄，持干將、莫邪、赤霄、太阿四劍，平定玄冥之亂，然後不知所終。」');
      await k.say('Jasper', '……喂，你們看，劍上是不是有一道新的刮痕？', 'Jasper');
      this.S.log.push('終章：回到了千年之後的家');
      this.g.screens.ending();
    } else {
      deed(this.g, '四劍歸鏡，選擇留在亂世', true); k.fame(300);
      await k.say('Jeff', '我們留下來。這個時代還有很多人需要幫忙。', 'Jeff');
      await k.say('鏡翁', '好。那麼這面鏡子，就留給你們吧。……天下的故事，才剛開始呢。', LK.jingweng());
      await k.say('', '鏡翁的身影散去之前，嘴角微微地揚了一下。\n那個笑容，Jasper 後來想了很久——好像和平常的鏡翁，有一點點不一樣。');
      this.S.stay = true; this.S.log.push('終章：選擇留在亂世'); k.toast('英傑傳奇第一部完結！天下還在運轉……第二部「鏡影亂世」即將開始。');
    }
  }
  // ---------------------------------------------------------------- 支線　桃園之約: 劉備、關羽、張飛
  // opens once one of the family is found; the banner follows 劉備 wherever he is
  lgzOk() { return ['劉備', '關羽', '張飛'].every((n) => { const x = this.gen(n); return x && (x.status === 'serving' || x.status === 'free') && !x.isPlayer && !x.saga && !this.H.party.includes(x.id); }); }
  lgzOpen() {
    const S = this.S; if (!this.on() || (S.lgz || 0) >= 2) return;
    if (!this.lgzOk()) { if (S.lgz === 1) { this.unmark('side:lgz'); S.lgz = 0; } return; }
    if (S.ch === 'find' && !Object.values(S.fam).some((v) => v === 2)) return;
    const c = this.G.cities[this.gen('劉備').city], m = this.H.missions.find((x) => x.saga === 'side:lgz');
    if (m && m.city === c.id) return;
    if (m) this.unmark('side:lgz'); else this.k.toast(`支線「桃園之約」：聽說${c.name}有三位結義兄弟，仁德之名傳遍四方。`);
    S.lgz = 1; this.mark('side:lgz', c.name, `支線：桃園三兄弟（${c.name}）`);
  }
  async lgzTown() {
    const S = this.S; this.lgzOpen(); if (S.lgz !== 1 || !this.lgzOk() || this.gen('劉備').city !== this.g.town.city) return false;
    this.g.locked = true;
    try {
      const k = this.k, L = this.lead(), josh = this.H.party.includes(this.gen('Josh').id) || L === 'Josh';
      await k.say('', '城門口貼著一張告示，墨跡還沒乾：「劉玄德招募義勇，共扶漢室。」\n旁邊一個賣草鞋的老伯說：「劉皇叔是好人啊，前年大旱，他把自家的糧都分給了我們。」');
      await k.say('劉備', '聽說有幾位持名劍的奇人在各地行俠仗義，備仰慕已久。今日一見，果然氣度不凡。\n這兩位是我的結義兄弟，關雲長、張翼德。', '劉備');
      await k.say('張飛', '大哥說你們厲害，俺老張就是不服！\n誰敢跟俺比劃比劃？', '張飛');
      const c = await k.ask('張飛捲起袖子，一副要打架的樣子——', [{ k: 'duel', n: josh ? 'Josh：「我來！」（一騎討）' : '跟他過幾招（一騎討）' }, { k: 'drink', n: '比喝酒（看武力與魅力）' }, { k: 'talk', n: '「張將軍息怒，我們是來交朋友的。」' }]);
      if (c === 'duel') { const r = await k.duel(this.gen('張飛')); await k.say('張飛', r === 'win' ? '……好！好身手！俺老張服了！' : '哈哈哈！你也不賴嘛，能在俺手下撐這麼久的人不多！', '張飛'); }
      else if (c === 'drink') { const ok = k.check('war', 90) && k.check('cha', 90); await k.say('', ok ? '一罈、兩罈、三罈……張飛「咚」的一聲趴在桌上，打起了呼嚕。' : '一罈、兩罈、三罈……你眼前一黑，醒來時張飛正拍著你的背大笑。'); await k.say('張飛', ok ? '（醒來後）俺老張這輩子，頭一回喝輸給別人！' : '酒量差了點，人倒是爽快！', '張飛'); }
      else await k.say('關羽', '三弟，不得無禮。……諸位，見笑了。', '關羽');
      await k.say('關羽', '實不相瞞，近來有一夥人打著我家兄長的旗號，在城外的村子強徵糧食、拉走壯丁。\n百姓都在說，劉玄德原來是個偽君子。', '關羽');
      await k.say('Jeff', '冒你們的名號，壞你們的名聲……這不是一般的山賊會做的事。', 'Jeff');
      await k.say('劉備', '備的名聲事小，百姓的性命事大。諸位若肯相助，備兄弟三人願與諸位同去！', '劉備');
      for (const n of ['劉備', '關羽', '張飛']) addBond(this.g, this.gen(n).id, 20);
      S.lgz = 2; this.unmark('side:lgz'); this.field('side:lgz', this.g.town.C.name, '冒名的匪徒', 6, 11);
      k.toast('黑旗標出了冒名匪徒的營地。到了那裡，劉關張會和你們並肩作戰。');
    } catch (e) { console.error(e); } finally { this.g.locked = false; this.g.hud(); }
    return true;
  }
  // the battle at the impostors' camp, 劉關張 fighting beside the family
  guests(xs) { const lv = this.H.rec[this.H.pid].lv; this.H.guests = xs.map((x) => x.id); for (const x of xs) { const r = this.H.rec[x.id] ||= newRec(x); r.lv = Math.max(r.lv, lv - 2); } this.g.partyList().forEach((p) => { if (this.H.guests.includes(p.g.id)) { p.rec.sol = p.solMax; p.rec.sp = p.spMax; } }); }
  async lgzCamp() {
    const k = this.k, S = this.S;
    if (!this.lgzOk()) { await k.say('', '劉關張已經不在這裡了……這件事只好作罷。'); this.unmark('side:lgz'); S.lgz = 9; return; }
    await k.say('', '營地裡插著一面「劉」字大旗。三個人坐在火堆旁喝酒——一個大耳垂肩，一個紅臉長鬚，一個豹頭環眼。\n可是仔細一看，耳朵是糊上去的，鬍子是馬尾巴做的。');
    await k.say('張飛', '呸！這也叫俺老張？俺哪有這麼醜！', '張飛');
    await k.say('假面郎君', '嘿嘿，正主兒來了？正好。教主說了，劉備的名聲壞不了，就讓他的人頭落地！', LK.cult());
    const lv = this.lv(this.findLv() + 4), mk = (n) => this.foe(n, 'bandit', lv, { ...LK.bandit0(), key: 'saga-fake-' + n });
    this.guests(['劉備', '關羽', '張飛'].map((n) => this.gen(n)));
    let r; try { r = await k.battle([this.foe('假面郎君', 'bandit', lv + 3, LK.cult(), { boss: true, sol: 1.5 }), mk('假劉備'), mk('假關羽'), mk('假張飛')], { terrain: 'forest', title: '桃園三兄弟 vs 冒牌三兄弟！', foeForm: 'yulin' }); } finally { this.H.guests = []; }
    if (r !== 'win') return this.lost();
    await k.say('假面郎君', '咳……教主在鏡中看見……你劉備將來會三分天下……\n他要你在那之前……身敗名裂……', LK.cult());
    await k.say('劉備', '三分天下？……備只想讓百姓過幾天安穩日子罷了。', '劉備');
    await k.say('', '那天晚上，城外的桃園裡擺了一桌酒。劉備把搶來的糧食一車一車還給了村民。');
    await k.say('劉備', '今日之恩，備沒齒難忘。\n日後諸位若有危難，不論天涯海角，備兄弟三人必來相助！', '劉備');
    await k.say('關羽', '關某這一生，只認信義二字。', '關羽');
    await k.say('張飛', '喝！今天不醉不歸！', '張飛');
    S.lgz = 3; this.unmark('side:lgz'); k.gold(500); k.fame(200);
    for (const n of FAMILY) { const x = this.gen(n); if (x && x.status !== 'dead') { x.base.cha = Math.min(110, x.base.cha + 2); refresh(this.G, x); } }
    for (const n of ['劉備', '關羽', '張飛']) addBond(this.g, this.gen(n).id, 30);
    S.log.push('支線　桃園之約：和劉備、關羽、張飛結為好友'); deed(this.g, '與劉關張桃園共飲');
    await k.say('', '支線「桃園之約」完成！金 +500、名聲 +200，四人的魅力 +2。\n最後的決戰時，劉關張會趕來助陣。');
  }
  // ================================================================ 第二部　鏡影亂世
  shadowLv() { return 26 + 2 * FAMILY.filter((n) => this.S.sh[n] === 2).length; }
  says(n, text) { return this.k.say(n, text, n); }
  shade(n, text) { return this.k.say(`${n}之影`, text, LK.shadow(this.g, n)); }
  async sequel() {
    const k = this.k, S = this.S, L = this.lead();
    S.p2 = true; S.ch = 'shadows'; S.sh = Object.fromEntries(FAMILY.map((n) => [n, 0])); S.amb2 = 0;
    await k.say('', '留在亂世的日子，一晃又是兩個月。\n一天夜裡，營火旁的軒轅古鏡忽然自己立了起來。鏡面上，「喀」地裂開了一道細細的縫。');
    await this.says('Jasper', '……鏡子裡面，有人在看我們。');
    await k.say('', '裂縫裡爬出了四道黑影。它們的身形、衣服、手上的劍，全都和一家四口一模一樣——只是顏色像墨一樣黑。');
    await this.shade('Josh', '嘿，本尊。謝謝你們把鏡子拼回來，我們在裡面等好久了。');
    await this.says('Jeff', '你們是什麼東西？');
    await this.shade('Jeff', '我們就是你們。你們心裡不敢說出來的那一半。');
    await this.shade('Erin', '你們做不到的事，就交給我們吧。');
    await k.say('', '四道黑影往四個方向散去，眨眼就不見了。');
    await this.says('Erin', '鏡翁！鏡翁，你在嗎？……鏡翁！');
    await k.say('', '鏡子沒有回答。鏡面黑得像一口深井。');
    await k.say(L, { Jeff: '鄴、長安、陳留、江陵……它們用的是我們的臉。不能讓它們用我們的名字去害人。', Erin: '那是我們自己的影子……我們自己去帶回來。', Josh: '冒牌貨！我要一個一個抓回來！', Jasper: '……它們跟我們長得一樣耶。好可怕。可是，我們四個人一起去。' }[L], L);
    for (const n of FAMILY) this.mark('sh:' + n, SHADOW[n].city, `${n}之影（${SHADOW[n].city}）`);
    S.log.push('第二部　序章　鏡子又裂了');
    deed(this.g, '古鏡又裂了，四道鏡影逃進了天下', true); this.g.audio.sfx('level');
    k.toast('英傑傳奇第二部「鏡影亂世」開始！黑旗標出了四道鏡影出沒的城市。');
  }
  async p2Town() {
    const S = this.S; if (!this.part2() || !this.on()) return false;
    const C = this.g.town.C.name;
    let fn = null;
    if (S.ch === 'shadows') { const n = FAMILY.find((x) => S.sh[x] === 0 && SHADOW[x].city === C); if (n) fn = () => this.shadowTown(n); }
    if (S.ch === 'sage' && !S.sage && C === '襄陽') fn = () => this.sage();
    if (S.ch === 'mirror' && C === '許昌') fn = () => this.mirrorWorld();
    if (!fn) return false;
    this.g.locked = true;
    try { await fn(); } catch (e) { console.error(e); } finally { this.g.locked = false; this.g.hud(); }
    return true;
  }
  // ---------------------------------------------------------------- 第四章　四道鏡影
  async shadowTown(n) {
    const k = this.k;
    if (n === 'Jeff') {
      await k.say('', '鄴城的城門口貼著一張告示，墨跡還沒乾：\n「奉軍師 Jeff 之令：三日後掘開漳河大堤，水淹敵軍。城南三村百姓，自行遷走。」');
      await k.say('百姓', '三個村子幾千口人，能遷到哪裡去？\n聽說那個 Jeff 軍師在大帳裡打算盤：淹死幾千人，可以少打三年仗——划算。', '百姓');
      await this.says('Jeff', '……我從來沒有說過這種話。');
      await this.says('Erin', '可是……這聽起來，有一點像你在算帳的樣子。');
      await this.says('Jeff', '……走，去大堤。');
    } else if (n === 'Erin') {
      await k.say('', '長安城裡的人排成長長的隊伍，等著喝一碗「Erin 娘娘的仙藥」。\n喝過的人臉上都掛著笑，不吵、不哭，也不說話。');
      await k.say('百姓', '喝了娘娘的藥，就不會痛、也不會怕了……\n娘娘說，只要大家都乖乖的，就再也不會有人受傷。', '百姓');
      await this.says('Erin', '這不是藥，是迷心散。他們不是不痛了，是什麼都感覺不到了。');
      await this.says('Josh', '媽，那個人用你的名字……');
      await this.says('Erin', '我知道。我去跟「她」談。');
    } else if (n === 'Josh') {
      await k.say('', '陳留城外搭起了一座擂台，台下躺滿了受傷的武人。\n擂台上插著一面大旗：「天下第一 Josh——不服的上來！」');
      await k.say('百姓', '聽說他把來比武的人全都打斷了手，還說要打到呂布跪下來叫他大哥……', '百姓');
      await this.says('Josh', '那不是我！……好啦，我是說過想打贏呂布，可是我才不會把人打成那樣！');
      await this.says('Jasper', '哥，你看擂台上那個人笑的樣子……跟你打遊戲贏的時候一模一樣。');
      await this.says('Josh', '……少囉嗦，走啦！');
    } else {
      await k.say('', '江陵的碼頭上停著一艘掛黑帆的船。蒙面的人把一箱一箱的金子搬上船——都是從城裡人家偷來的。');
      await k.say('商人', '雙劍俠盜？呸！什麼劫富濟貧，他連窮人家的米缸都偷！\n他還說：這世上誰都靠不住，只有握在手上的東西才是真的。', '商人');
      await this.says('Jasper', '……我、我從來沒有偷過窮人的東西。');
      await this.says('Erin', '我們知道。');
      await this.says('Jasper', '可是……一個人在吳郡的時候，我真的這樣想過。誰都不認識，誰都靠不住……');
    }
    this.S.sh[n] = 1; this.unmark('sh:' + n);
    this.field('sh2:' + n, SHADOW[n].city, `${SHADOW[n].place}（${n}之影）`, 6, 11);
    k.toast(`黑旗標出了${n}之影的所在：${SHADOW[n].place}`);
  }
  async shadowFight(n) {
    const k = this.k, s = SHADOW[n], lv = this.lv(this.shadowLv()), x = this.gen(n);
    const pre = {
      Jeff: [['Jeff之影', '你來了。你也算過的，對吧？一座城換十座城，幾千人換幾萬人。你只是不敢下令。'], ['Jeff', '算得出來的東西，不一定就是對的。']],
      Erin: [['Erin之影', '你不是也想過嗎？要是大家都乖乖聽話，就不會有人生病、不會有人打架，孩子們也不會亂跑。\n我只是把你想做的事做完而已。'], ['Erin', '我想要孩子們平安，不是要他們變成木頭人。\n會跌倒、會吵架、會不聽話——那才是活著。']],
      Josh: [['Josh之影', '本尊來了？太好了。你一直想當天下第一，對吧？\n贏了才有人看你，輸了就什麼都不是。'], ['Josh', '我是想變強……可是我想變強，是為了保護爸媽和 Jasper，不是為了讓別人跪下來！']],
      Jasper: [['Jasper之影', '你幹嘛要回去？他們以前還不是把你一個人丟在吳郡。\n靠自己就好了。東西要握在手上，才不會不見。'], ['Jasper', '我沒有被丟下。我們是被沖散的——而且他們每一個人都來找我了。']],
    }[n];
    await k.say('', { Jeff: '漳河大堤上插滿了令旗。一個和 Jeff 一模一樣的黑影站在堤頂，手上拿著一把算盤。', Erin: '藥王廟裡煙霧瀰漫。一個和 Erin 一模一樣的黑影，正溫柔地把藥碗遞給一個小孩。', Josh: '虎牢關下的擂台上，一個和 Josh 一模一樣的黑影扛著劍，腳下踩著一面打破的盾。', Jasper: '黑帆船的桅杆上，一個和 Jasper 一模一樣的黑影蹲在橫桿上，數著手上的金子。' }[n]);
    for (const [who, t] of pre) await (who === n ? this.says(n, t) : this.shade(n, t));
    const st = { Jeff: { spells: ['zhen', 'lei'], int: 99, war: 82 }, Erin: { spells: ['zhi', 'yao'], int: 96, war: 78 }, Josh: { war: 100 }, Jasper: { spells: ['huan'], war: 96, int: 80 } }[n];
    const minions = { Jeff: () => this.many(3, '鏡兵', 'soldier', lv + 1, LK.mirror()), Erin: () => this.many(3, '鏡兵', 'soldier', lv + 1, LK.mirror()), Josh: () => this.many(2, '鏡兵', 'soldier', lv + 2, LK.mirror()), Jasper: () => this.many(3, '黑帆盜', 'pirate', lv + 1) }[n];
    const r = await k.battle([this.foe(`${n}之影`, 'bandit', lv + 5, LK.shadow(this.g, n), { boss: true, sol: 4.5, ...st }), ...minions()], { terrain: s.terrain, title: `${n}之影！`, foeForm: s.form, night: n === 'Erin' });
    if (r !== 'win') return this.lost();
    const post = {
      Jeff: [['Jeff之影', '……那你告訴我，什麼才是對的？'], ['Jeff', '我不知道。所以我才要一直問、一直想——不能讓算盤替我做決定。'], ['', '黑影笑了一下，化成一縷黑煙，鑽回了 Jeff 的影子裡。\n大堤保住了。城南三個村子的人站在堤上，看著漳河平平靜靜地流過去。']],
      Erin: [['Erin之影', '……可是放手，好可怕。'], ['Erin', '我知道。我也很怕。……我們一起怕吧。'], ['', '黑影輕輕靠在 Erin 的肩上，慢慢淡去。廟裡的香熄了。\n長安城裡的人一個一個哭了出來——那是醒過來的哭聲。']],
      Josh: [['Josh之影', '……輸了也沒關係嗎？'], ['Josh', '輸了就再練啊！反正我有家人陪我練。'], ['', '黑影把劍插在擂台上，轉身走進了 Josh 的影子裡。\n受傷的武人們互相攙扶著站起來。有人對 Josh 抱拳：「小兄弟，你才是真正的天下第一。」']],
      Jasper: [['Jasper之影', '……那如果下次又走散了呢？'], ['Jasper', '那我就去找他們。就像他們來找我一樣。'], ['', '黑影把船上的金子一箱一箱推回岸上，然後縮成小小的一團，躲回了 Jasper 的影子裡。\n那天晚上，Jasper 把金子一戶一戶地還了回去——這次，他是敲門從大門走進去的。']],
    }[n];
    for (const [who, t] of post) await (who === '' ? k.say('', t) : who === n ? this.says(n, t) : this.shade(n, t));
    this.S.sh[n] = 2; this.unmark('sh2:' + n);
    if (x && x.status !== 'dead') { x.base[s.stat] = Math.min(110, x.base[s.stat] + 4); refresh(this.G, x); }
    k.gold(600); k.fame(150);
    this.S.log.push(`${s.ch}：${n}找回了自己的影子`); deed(this.g, `${n}找回了自己的影子`);
    await k.say('', `「${s.ch}」完結！${n}的${STAT_N[s.stat]} +4、金 +600、名聲 +150。`);
    if (FAMILY.every((m) => this.S.sh[m] === 2)) await this.toSage();
  }
  async toSage() {
    const k = this.k, S = this.S;
    await k.say('', '四道黑影都回到了主人的影子裡。那天晚上，古鏡上的裂縫沒有再變大，可是鏡面還是一片漆黑。');
    await this.says('Jeff', '鏡子裂開、影子跑出來，鏡翁卻一句話都沒說。……這不對勁。');
    await this.says('Jasper', '鏡翁會不會也被關在鏡子裡了？');
    await this.says('Erin', '有一個人，也許知道鏡子的事。聽說襄陽城外住著一位「水鏡先生」，天下的事他都知道。');
    S.ch = 'sage'; S.log.push('第四章完：四道鏡影都回來了');
    this.mark('sage', '襄陽', '拜訪水鏡先生（襄陽）');
    this.g.audio.sfx('level'); k.toast('第五章「水鏡先生」開始！');
  }
  // ---------------------------------------------------------------- 第五章　水鏡先生
  async sage() {
    const k = this.k, S = this.S, sm = k.alive('司馬徽') && !this.gen('司馬徽').isPlayer ? '司馬徽' : '水鏡先生', sl = sm === '司馬徽' ? '司馬徽' : LK.shuijing();
    const sy = (t) => k.say(sm, t, sl);
    await k.say('', '襄陽城外的山坳裡，有一座竹籬茅舍。院子裡，一位老先生一邊餵鶴，一邊念著：「好，好，好。」');
    await sy('好，好。持四劍的人，終於來了。老夫等你們很久了。');
    await sy('你們心裡的那四道影子，不是自己從鏡子裡跑出來的——是被人「照」出來的。\n照的那個人，你們也認識。');
    await this.says('Jeff', '……鏡翁。');
    await sy('鏡中之靈，自稱鏡翁。軒轅鏡能照見天命，那鏡靈看了幾千年的天下興亡，看得太久，就想自己當那個「天」。');
    await sy('玄冥子當年，只是一個不忍心看百姓受苦的道士。是鏡靈在他耳邊說：「打碎鏡子，你就能改寫天命。」\n鏡子碎了，鏡靈出不來。你們把鏡子拼好了，牠才有了出來的門——現在牠只差一步。');
    await this.says('Erin', '所以牠要我們去找鏡片……全都是在利用我們？');
    await this.says('Josh', '可惡！那個老頭還一臉慈祥的樣子！');
    await sy('那四道影子，是牠拿來試你們的。人若輸給了自己的影子，鏡靈就能借那個人的身體走出來。\n你們四個都贏了，牠只好親自動手。');
    await sy('要打倒鏡靈，就得走進鏡子裡。鏡中一片漆黑，要有「照心燈」才看得見路。\n那盞燈沉在城外的鏡湖底，有東西守著。');
    if (k.alive('諸葛亮') && !this.gen('諸葛亮').isPlayer && !k.inParty(this.gen('諸葛亮'))) {
      await k.say('', '籬笆邊上，一個拿著破蒲扇的少年一直在偷聽。');
      await k.say('諸葛亮', '老師，鏡湖的守護者是水裡的東西。水再深，也淹不過一座山——用落石，一定有用。', '諸葛亮');
      await this.says('Josh', '……等一下，你叫什麼名字？');
      await k.say('諸葛亮', '在下諸葛亮，字孔明。', '諸葛亮');
      await this.says('Josh', '諸、諸葛亮？！爸！是諸葛亮耶！活的！');
      await this.says('Jeff', '……小聲一點。');
      addBond(this.g, this.gen('諸葛亮').id, 30);
    }
    await sy('好，好。去吧。');
    S.sage = 1; this.unmark('sage'); this.field('lake', '襄陽', '鏡湖・照心燈', 6, 11);
    S.log.push('水鏡先生說出了鏡翁的真面目'); deed(this.g, '從水鏡先生口中得知鏡翁的真面目');
    k.toast('黑旗標出了鏡湖。湖底的守護者怕「石」。');
  }
  async lake() {
    const k = this.k, S = this.S, lv = this.lv(32);
    await k.say('', '鏡湖的水平得像一面鏡子，連一絲波紋都沒有。\n湖面上映著四個人的倒影——可是那些倒影，沒有跟著他們動。');
    const yan = !!S.shards?.di;
    if (yan) {
      await k.say('', '岸邊忽然冒出一團小小的火光，一個黑頭髮的孩子跑了過來——是赤炎童子！');
      await k.say('小炎', '阿姨！我聽說你們要去打壞人，我也要幫忙！\n我現在只會點小小的火……可是可以幫你們照路！', LK.xiaoyan());
      await this.says('Erin', '小炎！你怎麼一個人跑來了……好，跟緊我，不准亂跑。');
    }
    const ok = await k.waves([() => this.many(4, '鏡兵', 'soldier', lv, LK.mirror()), () => [this.foe('鏡湖龍王', 'snake', lv + 5, null, { boss: true, sol: 5 }), ...this.many(2, '鏡兵', 'soldier', lv + 2, LK.mirror())]],
      { terrain: 'river', foeForm: 'changshe', titles: ['湖面的倒影站起來了！', '鏡湖龍王！'] });
    if (!ok) return this.lost();
    await k.say('', '龍王沉回了湖底，湖水慢慢地往兩邊退開。湖心的石台上，一盞青銅小燈靜靜地擺著，燈芯是冷的。');
    if (yan) { await k.say('小炎', '我來點！我來點！', LK.xiaoyan()); await k.say('', '小炎伸出手指，一朵小小的火苗跳上燈芯。\n燈亮起來的那一瞬間，湖面上所有的倒影都散了。'); }
    else await k.say('', 'Jeff 用火摺子點亮了燈芯。燈亮起來的那一瞬間，湖面上所有的倒影都散了。');
    this.unmark('lake');
    for (const n of FAMILY) { const x = this.gen(n); if (x && x.status !== 'dead') { x.base.lead = Math.min(110, x.base.lead + 2); refresh(this.G, x); } }
    const relic = k.relic(4, 10); k.gold(1000); k.fame(200);
    S.log.push(`在鏡湖取得照心燈${yan ? '（小炎來幫忙）' : ''}`); deed(this.g, '在鏡湖取得照心燈');
    await k.say('', `得到了「照心燈」！燈光照在四人身上，四人的統率 +2。\n金 +1000、名聲 +200、得到寶物「${relic}」。`);
    await this.says('Jeff', '鏡靈最想要的，是這面鏡子和四把劍……那我們就帶著它們，回到一切開始的地方。');
    await this.says('Erin', '許昌。');
    S.ch = 'mirror'; S.log.push('第五章完：照心燈亮了');
    this.mark('mirror', '許昌', '許昌・鏡中天下');
    this.g.audio.sfx('level'); k.toast('第六章「鏡中天下」開始！');
  }
  // ---------------------------------------------------------------- 第六章　鏡中天下
  helpers2() {
    const ok = (x) => x && (x.status === 'serving' || x.status === 'free') && !x.isPlayer && !x.saga && !this.H.party.includes(x.id);
    const lgz = this.S.lgz === 3 ? ['劉備', '關羽', '張飛'].map((n) => this.gen(n)).filter(ok) : [];
    if (lgz.length) return lgz;
    return ['趙雲', '馬超', '孫策'].map((n) => this.gen(n)).filter(ok);
  }
  async mirrorWorld() {
    const k = this.k, S = this.S, L = this.lead(), lv = this.lv(34), jl = LK.jingling();
    this.armed(2.6);
    await k.say('', '許昌。一年多以前，他們就是在這裡醒過來的。\n四個人在城裡那間破廟點亮照心燈，把古鏡立在供桌上。燈光照進鏡子——鏡面像水一樣漾開了。');
    await k.say('', '鏡子裡是另一個天下：山河、城池、軍隊，全都是銀色的，一點聲音都沒有。');
    await k.say('鏡靈', '……你們果然來了。我還在想，要等到什麼時候呢。', jl);
    await this.says('Jasper', '鏡翁……你為什麼要騙我們？');
    await k.say('鏡靈', '騙？我說的每一句話都是真的。四劍齊聚，鏡子才會回應——只是它回應的，是我。', jl);
    await k.say('鏡靈', '我看了三千年的天下。戰亂、饑荒、背叛，一次又一次，人永遠學不會。\n所以，由我來當這個「天」。從此天下只有一個人說了算，再也不會亂。', jl);
    await this.says('Jeff', '玄冥子也說過一模一樣的話。');
    await k.say('鏡靈', '玄冥子是個好孩子。可惜，他的心太軟了。', jl);
    await this.says('Erin', '是你害死了他。');
    await k.say('鏡靈', '殺他的，是你們。……來吧。讓我看看，你們打不打得過這整個天下的倒影。', jl);
    const helpers = this.helpers2();
    if (helpers.length) {
      await k.say('', '鏡子外面，傳來一陣熟悉的聲音——');
      const ns = helpers.map((x) => x.name);
      if (ns.includes('劉備')) { await k.say('劉備', '桃園之約，備不敢忘！雲長、翼德，隨我進去！', '劉備'); if (ns.includes('張飛')) await k.say('張飛', '鏡子裡也有妖怪？正好，俺老張還沒砸過鏡子！', '張飛'); }
      else await k.say(ns[0], `${ns[0]}在此！諸位的恩情，今天來還了！`, ns[0]);
      this.guests(helpers);
    }
    const famous = ['呂布', '關羽', '張飛', '趙雲', '馬超', '典韋', '許褚', '黃忠', '夏侯惇', '甘寧', '張遼', '太史慈'].filter((n) => this.gen(n) && !helpers.some((x) => x.name === n)).slice(0, 4);
    let ok;
    try {
      ok = await k.waves([() => famous.map((n) => this.foe(`鏡中${n}`, 'soldier', lv + 2, LK.mirrorOf(k.look(n)), { war: Math.min(99, this.gen(n).war), sol: 1.4 }))], { terrain: 'plain', noFlee: true, foeForm: 'fengshi', titles: ['鏡中的千軍萬馬！'] });
      if (ok) {
        await k.say('', '銀色的大軍散開了。地上升起一面巨大的鏡子，鏡子裡走出一個人——\n那是你自己。');
        const me = this.gen(L), r0 = this.H.rec[this.H.pid];
        await k.say(`鏡中${L}`, '我就是你。你會的每一招我都會，你怕的每一件事我都知道。', LK.mirrorOf(this.g.lookOf(me)));
        await k.say(L, { Jeff: '那你也該知道——我最不怕的，就是輸給自己。', Erin: '那你一定也知道，我現在一點都不怕。因為他們都在我身後。', Josh: '那你一定知道——我最討厭輸了！', Jasper: '那你知道嗎？我現在不是一個人了。' }[L], L);
        const r = await k.duelWith(`鏡中${L}`, LK.mirrorOf(this.g.lookOf(me)), r0.lv + 2, Math.min(99, me.war), me.lead, me.int);
        if (r === 'win') await k.say('', `${L}的劍穿過了鏡子裡的自己。鏡中人笑了笑，碎成千萬片銀光。`);
        else { const o = FAMILY.filter((n) => n !== L); await k.say('', `${L}被逼到了角落。鏡子裡的自己舉起了劍——\n一隻手從後面抓住了${L}的肩膀。是${o[0]}。接著是${o[1]}、${o[2]}。\n「你不是一個人。」\n四個人站在一起，鏡中人晃了一下，碎了。`); }
        ok = await k.waves([() => [this.foe('鏡靈', 'bandit', lv + 8, jl, { boss: true, spells: ['lei', 'feng', 'yao', 'huan', 'zhen'], int: 99, war: 96, sol: 3.6 }), ...this.many(3, '鏡兵隊長', 'soldier', lv + 3, LK.mirror())]],
          { terrain: 'hill', noFlee: true, foeForm: 'heyi', titles: ['決戰鏡靈！'] });
      }
    } finally { this.H.guests = []; }
    if (!ok) return k.say('', '照心燈的火一暗，四個人被推出了鏡子，跌坐在破廟的地上。\n鏡子還在供桌上。練強一點，再進城來吧。');
    await k.say('鏡靈', '……為什麼……我明明看過那麼多次……人總是會輸給自己心裡的影子……', jl);
    await this.says('Jeff', '你看了三千年，只看到人輸的那一次。\n你沒有看到，他們又站起來的那一次。');
    await k.say('', '鏡靈的身影像冰一樣裂開，裂縫裡透出溫暖的光。\n一個很老、很老的聲音輕輕地說：「……原來，是這樣啊。」');
    await k.say('', '銀色的天下慢慢有了顏色。鏡子外面，許昌的晨鐘響了。');
    this.H.st.kills.push('鏡靈'); this.unmark('mirror'); k.gold(5000); k.fame(800);
    const relic = k.relic(4, 12);
    S.log.push('第六章完：在鏡中天下打倒了鏡靈');
    await k.say('', `金 +5000、名聲 +800、得到寶物「${relic}」。`);
    await this.says('Jeff', '現在，這面鏡子真的只是一面鏡子了。……它還能送我們回家，最後一次。');
    await this.says('Josh', '回家的話，就再也見不到劉備、趙雲、小炎他們了耶……');
    await this.says('Jasper', '可是我好想念我們家的床，還有學校的同學……');
    await this.says('Erin', '不管選哪一邊，我們一家人都在一起。');
    const go = await k.ask('要怎麼做？', [{ k: 'home', n: '回到千年後的家（故事結束，結算一生）' }, { k: 'stay', n: '打碎古鏡，永遠留在這個時代（繼續闖蕩）' }]);
    S.ch = 'end';
    if (go === 'home') {
      deed(this.g, '斬除鏡靈，回到了千年之後的家', true);
      await k.say('', '鏡面最後一次漾開——\n\n……\n\n「各位遊客，本館即將閉館。」\n一家四口站在展櫃前。古鏡完整無缺，四把古劍靜靜地擺在旁邊。');
      await k.say('', '展櫃旁的說明牌上寫著：\n「相傳東漢末年，有四位來歷不明的英雄，持干將、莫邪、赤霄、太阿四劍，平定玄冥之亂，又入鏡中斬除鏡妖，然後不知所終。」');
      if (S.shards?.di) { await this.says('Erin', '……你們看，展櫃的角落。'); await k.say('', '古鏡旁邊，多了一盞小小的青銅燈。燈座上刻著兩個歪歪扭扭的字：「小炎」。'); }
      await this.says('Josh', '……我好想再跟呂布打一次喔。');
      await this.says('Jasper', '我想先回家睡覺。');
      S.log.push('終章：斬除鏡靈，回到了千年後的家');
      this.g.screens.ending();
    } else {
      deed(this.g, '打碎古鏡，永遠留在了這個時代', true); k.fame(500);
      await this.says('Erin', '這裡，也是我們的家了。');
      await k.say('', '四把劍同時落下。古鏡碎成了滿天的星光，再也拼不回去了。\n星光落在許昌的屋頂上、落在田裡、落在每一個被他們救過的人身上。');
      for (const n of FAMILY) { const x = this.gen(n); if (x && x.status !== 'dead') { for (const st of ['lead', 'war', 'int', 'pol', 'cha']) x.base[st] = Math.min(110, x.base[st] + 1); refresh(this.G, x); } }
      await k.say('', '四人的所有能力 +1。');
      S.log.push('終章：打碎古鏡，永遠留在這個時代');
      k.toast('英傑傳奇第二部「鏡影亂世」完結！天下還在運轉，你們可以繼續闖蕩。');
    }
  }
  // the mirror's men on the road in part two
  async ambush2() {
    const S = this.S; S.amb2 = (S.amb2 || 0) + 1; this.g.locked = true; this.armed(1);
    try {
      const k = this.k, lv = this.lv(S.ch === 'mirror' ? 32 : 26);
      await k.say('', pick(['路邊的水窪裡，倒影一個一個站了起來——', '河面上映出了一整隊銀色的士兵。下一刻，他們走上了岸。', '客棧的銅鏡忽然亮了，鏡子裡伸出了一隻銀色的手——']));
      const r = await k.battle([this.foe('鏡兵隊長', 'soldier', lv + 2, LK.mirror(), { boss: true }), ...this.many(3, '鏡兵', 'soldier', lv, LK.mirror())], { terrain: this.g.act.terrainAt(), title: '鏡兵！' });
      if (r === 'win') { k.gold(300); await k.say('', '鏡兵碎成一地銀片，又化成水，滲進了泥土裡。'); }
    } catch (e) { console.error(e); } finally { this.g.locked = false; this.g.hud(); }
    return true;
  }
  // ---------------------------------------------------------------- the month: 玄冥子's men on the road
  async month() {
    const S0 = this.S;
    if (S0 && S0.ch === 'done' && !S0.p2 && (S0.stay || S0.log.includes('終章：選擇留在亂世')) && this.g.mode === 'world') {
      S0.wait = (S0.wait || 0) + 1;
      if (S0.wait >= 2) { this.g.locked = true; try { await this.sequel(); } catch (e) { console.error(e); } finally { this.g.locked = false; this.g.hud(); } return true; }
    }
    if (this.on() && this.part2() && this.g.mode === 'world' && (S0.amb2 || 0) < 3 && Math.random() < 0.3) return this.ambush2();
    this.lgzOpen();
    const S = this.S; if (!this.on() || (S.ch !== 'shards' && S.ch !== 'final') || S.ambush >= 4 || this.g.mode !== 'world' || Math.random() > 0.35) return false;
    S.ambush++; this.g.locked = true; this.armed(0.6);
    try {
      const k = this.k, lv = this.lv(S.ch === 'final' ? 22 : 16);
      await k.say('', pick(['夜裡，營火忽然一暗。十幾個黑衣人從四面八方圍了上來——', '山路上，一群戴著鬼面的人擋住了去路。', '路邊的茶棚裡，所有的客人同時放下了茶碗，抽出刀來——']));
      await k.say('玄冥刺客', '教主有令：四劍，一把也不准帶上泰山！', LK.cult());
      const r = await k.battle([this.foe('刺客首領', 'bandit', lv + 2, LK.cult(), { boss: true }), ...this.many(3, '玄冥刺客', 'bandit', lv, LK.cult())], { terrain: this.g.act.terrainAt(), title: '玄冥教的刺客！', night: true });
      if (r === 'win') { k.gold(200); await k.say('', '刺客們丟下兵器逃走了。看來玄冥子已經慌了。'); }
    } catch (e) { console.error(e); } finally { this.g.locked = false; this.g.hud(); }
    return true;
  }
}
