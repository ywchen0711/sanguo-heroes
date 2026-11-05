// The player's side of things on top of the simulation: levels and experience, soldiers (the hit points of a general in
// battle, as in the old Famicom games), stratagem points, equipment bought in shops, the party, ranks and fame.
// A general's 統率 / 武力 / 智力 come from the simulation (with their famous treasures); levels add to them for good.
import { refresh } from './sim/engine.js';
import { slotV, itemOf, relicFx } from './relics.js';

// ---------------------------------------------------------------- shops: [id, name, value, price, tier]
export const WEAPONS = [['w1', '鐵劍', 4, 120, 1], ['w2', '長槍', 7, 300, 1], ['w3', '大刀', 10, 650, 2], ['w4', '鋼戟', 14, 1300, 3], ['w5', '精鋼劍', 18, 2600, 4], ['w6', '斬馬刀', 23, 4800, 5], ['w7', '龍鱗槍', 29, 8500, 6]];
export const ARMORS = [['a1', '布衣', 2, 80, 1], ['a2', '皮甲', 5, 260, 1], ['a3', '鎖子甲', 9, 650, 2], ['a4', '鐵甲', 13, 1400, 3], ['a5', '明光鎧', 18, 3000, 4], ['a6', '玄鐵鎧', 23, 5500, 5], ['a7', '龍鱗甲', 29, 9000, 6]];
export const HORSES = [['h1', '駑馬', 3, 400, 1], ['h2', '良馬', 6, 1600, 3], ['h3', '大宛馬', 10, 5200, 5]];
export const ITEMS = {
  med: { n: '傷藥', d: '一名武將回復 35% 兵力', price: 30, heal: 0.35 },
  med2: { n: '金創藥', d: '一名武將回復 80% 兵力', price: 120, heal: 0.8 },
  rice: { n: '兵糧', d: '全隊回復 30% 兵力', price: 180, healAll: 0.3 },
  book: { n: '竹簡', d: '一名武將回復 30 策略點', price: 80, sp: 30 },
  wine: { n: '美酒', d: '送給在野武將，招募更容易', price: 200, gift: true },
  // materials for the smith: found in caves, never sold
  ore: { n: '鐵礦石', d: '鐵匠用來鍛造強化武器和防具（+1～+3）', price: 0, mat: true },
  ore2: { n: '玄鐵', d: '罕見的黑鐵，鍛造 +4、+5 時需要', price: 0, mat: true },
  pill: { n: '仙丹', d: '一名武將回復全部兵力和策略點', price: 0, heal: 1, full: true, rare: true },
  xisui: { n: '洗髓丹', d: '重新抽一位武將的一個特性', price: 0, rare: true, reroll: true },
};
export const shopItems = () => Object.entries(ITEMS).filter(([, I]) => !I.mat && !I.rare);
export const usable = (k) => ITEMS[k] && !ITEMS[k].gift && !ITEMS[k].mat;

// ---------------------------------------------------------------- the smith: each level adds to a weapon's attack or an armour's defence.
// [gold, ore, black iron, chance of success]
export const FORGE = [null, [150, 1, 0, 1], [400, 2, 0, 0.9], [900, 3, 0, 0.75], [2000, 2, 1, 0.6], [4000, 3, 2, 0.45]];
export const forgeOf = (r, k) => (r.forge && r.forge[k]) || 0;
export const eqName = (r, k) => { const it = itemOf(r.eq?.[k]); return it ? it.n + (it.lv > 1 ? ` Lv${it.lv}` : '') + (forgeOf(r, k) ? '+' + forgeOf(r, k) : '') : '—'; };

// ---------------------------------------------------------------- the famous horses and weapons do more than add to the numbers
export const ARMS = {
  chitu: { n: '赤兔馬', d: '日行千里：每回合必定最先行動，騎兵威力上升', first: true, cav: 1.15 },
  dilu: { n: '的盧', d: '躍過檀溪：撤退必定成功', flee: true },
  jueying: { n: '絕影', d: '來去如影：兩成五的機會閃過攻擊', dodge: 0.25 },
  zhuahuang: { n: '爪黃飛電', d: '疾如閃電：速度大幅上升', spd: 30 },
  qinglong: { n: '青龍偃月刀', d: '一刀斬：會心一擊的機會大增', crit: 0.14 },
  shemao: { n: '丈八蛇矛', d: '連刺：三成的機會連擊', combo: 0.3 },
  huaji: { n: '方天畫戟', d: '橫掃千軍：攻擊時波及相鄰的敵軍', sweep: 0.45 },
  yitian: { n: '倚天劍', d: '削鐵如泥：無視四成防禦', pierce: 0.4 },
  qinggang: { n: '青釭劍', d: '削鐵如泥：無視四成防禦', pierce: 0.4 },
  guding: { n: '古錠刀', d: '會心一擊的機會上升', crit: 0.08 },
  shuanggu: { n: '雌雄雙股劍', d: '雙劍：兩成的機會連擊', combo: 0.2 },
  shuangji: { n: '雙鐵戟', d: '雙戟：兩成五的機會連擊', combo: 0.25 },
  qixing: { n: '七星寶刀', d: '會心一擊的機會上升', crit: 0.06 },
};
// what the famous things a general carries add up to
export function armsOf(G, g) {
  const o = { crit: 0, combo: 0, sweep: 0, pierce: 0, dodge: 0, spd: 0, cav: 1, first: false, flee: false, list: [] };
  for (const it of G.items) if (it.holder === g.id && ARMS[it.key]) { const A = ARMS[it.key]; o.list.push(A); for (const k of ['crit', 'combo', 'sweep', 'pierce', 'dodge', 'spd']) o[k] += A[k] || 0; if (A.cav) o.cav *= A.cav; if (A.first) o.first = true; if (A.flee) o.flee = true; }
  return o;
}
export const hasHorse = (G, g, r) => !!(r?.eq?.h) || G.items.some((it) => it.holder === g.id && it.slot === 'h');

// ---------------------------------------------------------------- troops: cavalry beats foot, foot beats bows, bows beat cavalry; sailors
// rule the water and flounder on land. Terrain favours some: horses on open ground, bows on the heights, foot in the woods.
export const TROOPS = {
  cav: { n: '騎兵', d: '克制步兵；平原、沙漠威力大，森林、山地、沼澤、城內吃虧（需要坐騎）', beats: 'inf' },
  inf: { n: '步兵', d: '克制弓兵；森林、山地稍強', beats: 'bow' },
  bow: { n: '弓兵', d: '克制騎兵；山地、攻守城時稍強', beats: 'cav' },
  navy: { n: '水軍', d: '水邊、沼澤威力大增；在陸地上稍弱', beats: null },
};
export const WATER = ['coast', 'marsh', 'river'];
export function troopMul(a, b, terrain) {
  let m = 1;
  if (a && b && TROOPS[a]?.beats === b) m *= 1.25; else if (a && b && TROOPS[b]?.beats === a) m *= 0.82;
  const wet = WATER.includes(terrain);
  if (a === 'cav') m *= ['plain', 'desert', 'snow'].includes(terrain) ? 1.15 : ['forest', 'hill', 'marsh', 'cave', 'city'].includes(terrain) ? 0.85 : 1;
  if (a === 'bow') m *= ['hill', 'city'].includes(terrain) ? 1.12 : 1;
  if (a === 'inf') m *= ['forest', 'hill'].includes(terrain) ? 1.1 : 1;
  if (a === 'navy') m *= wet ? 1.35 : 0.88; else if (wet && a) m *= 0.85;   // northerners on the water
  return m;
}
// formations, chosen before a battle: each has its strengths, and one it overwhelms
export const FORMS = {
  yulin: { n: '魚鱗', d: '穩紮穩打：攻防皆略升。克制雁行', atk: 1.05, def: 1.05, spd: 1, beats: 'yanxing' },
  heyi: { n: '鶴翼', d: '兩翼包抄：策略威力上升。克制鋒矢', atk: 1, def: 1, spd: 1, tac: 1.2, beats: 'fengshi' },
  fengshi: { n: '鋒矢', d: '中央突破：攻擊大升、防禦下降。克制方圓', atk: 1.25, def: 0.85, spd: 1.05, beats: 'fangyuan' },
  fangyuan: { n: '方圓', d: '圓陣固守：防禦大升、攻擊下降。克制鶴翼', atk: 0.88, def: 1.3, spd: 0.95, beats: 'heyi' },
  yanxing: { n: '雁行', d: '弓弩齊發：弓兵威力大升。克制魚鱗', atk: 1, def: 0.95, spd: 1, bow: 1.3, beats: 'yulin' },
  changshe: { n: '長蛇', d: '首尾相應：速度上升，撤退容易', atk: 1, def: 0.95, spd: 1.2, flee: 0.2, beats: null },
};

export const EQUIP = Object.fromEntries([...WEAPONS.map((w) => [w[0], { kind: 'w', n: w[1], v: w[2], price: w[3], tier: w[4] }]), ...ARMORS.map((w) => [w[0], { kind: 'a', n: w[1], v: w[2], price: w[3], tier: w[4] }]), ...HORSES.map((w) => [w[0], { kind: 'h', n: w[1], v: w[2], price: w[3], tier: w[4] }])]);

// ---------------------------------------------------------------- stratagems: who can use them (智力), their cost and what they do
export const TACTICS = {
  fire: { n: '火計', int: 20, sp: 5, kind: 'dmg', pow: 1.5, tgt: 'one', d: '火燒一隊敵軍' },
  cheer: { n: '激勵', int: 30, sp: 6, kind: 'heal', pow: 1.0, tgt: 'ally', d: '回復一隊我軍兵力' },
  rock: { n: '落石', int: 40, sp: 8, kind: 'dmg', pow: 2.1, tgt: 'one', d: '從高處落石（山地威力大）' },
  rouse: { n: '奮迅', int: 45, sp: 10, kind: 'buff', tgt: 'allies', d: '全軍攻擊上升三回合' },
  confuse: { n: '混亂', int: 50, sp: 8, kind: 'confuse', tgt: 'one', d: '使一隊敵軍混亂，無法行動' },
  blaze: { n: '烈火', int: 60, sp: 14, kind: 'dmg', pow: 1.25, tgt: 'all', d: '大火燒向全體敵軍' },
  rally: { n: '援軍', int: 70, sp: 16, kind: 'heal', pow: 0.75, tgt: 'allies', d: '回復全軍兵力' },
  flood: { n: '水計', int: 78, sp: 20, kind: 'dmg', pow: 1.6, tgt: 'all', d: '引水淹沒全體敵軍（近水威力大）' },
  // the spells of the simulation, for whoever knows them
  lei: { n: '落雷', spell: true, sp: 18, kind: 'dmg', pow: 2.3, tgt: 'all', d: '天降落雷，重創全體敵軍' },
  feng: { n: '呼風喚雨', spell: true, sp: 16, kind: 'dmg', pow: 1.7, tgt: 'all', d: '狂風助長火勢，焚燒全體敵軍' },
  yao: { n: '妖術', spell: true, sp: 14, kind: 'confuse', tgt: 'all', d: '妖術迷惑全體敵軍' },
  huan: { n: '幻術', spell: true, sp: 12, kind: 'evade', tgt: 'allies', d: '幻影使敵軍攻擊落空' },
  zhen: { n: '八陣圖', spell: true, sp: 16, kind: 'guard', tgt: 'allies', d: '全軍防禦大幅上升' },
  dun: { n: '奇門遁甲', spell: true, sp: 12, kind: 'evade', tgt: 'allies', d: '全軍迴避上升' },
  zhi: { n: '治癒', spell: true, sp: 14, kind: 'heal', pow: 1.1, tgt: 'allies', d: '救治全軍傷兵' },
};
export const tacticsOf = (g) => Object.keys(TACTICS).filter((k) => { const T = TACTICS[k]; return T.spell ? g.spells?.includes(k) : g.int >= T.int; });

// ---------------------------------------------------------------- ranks of a serving officer, by merit (功績), and their monthly pay
export const RANKS = [['從事', 0, 20], ['校尉', 40, 50], ['都尉', 100, 90], ['中郎將', 200, 150], ['將軍', 350, 240], ['大將軍', 600, 400]];
export const rankOf = (merit) => { let k = 0; RANKS.forEach((r, i) => { if (merit >= r[1]) k = i; }); return k; };
// what a rank brings: soldiers led (x the base), companions who may travel along, recruiting, monthly reinforcement, attack, what it opens
export const PERKS = [
  { n: '在野', troop: 1, party: 4, recruit: 0, regen: 0.08, atk: 0, d: '' },
  { n: '從事', troop: 1, party: 4, recruit: 0, regen: 0.08, atk: 0, d: '領月俸' },
  { n: '校尉', troop: 1.15, party: 4, recruit: 0, regen: 0.1, atk: 0, d: '可以率軍攻城' },
  { n: '都尉', troop: 1.3, party: 5, recruit: 0.05, regen: 0.1, atk: 0, d: '內政的效果更好' },
  { n: '中郎將', troop: 1.5, party: 5, recruit: 0.1, regen: 0.12, atk: 0.03, d: '可以邀請同勢力的武將同行' },
  { n: '將軍', troop: 1.75, party: 6, recruit: 0.15, regen: 0.15, atk: 0.05, d: '同勢力武將幾乎都願意同行' },
  { n: '大將軍', troop: 2, party: 6, recruit: 0.2, regen: 0.18, atk: 0.08, d: '同勢力武將一定同行' },
  { n: '君主', troop: 2, party: 6, recruit: 0.2, regen: 0.18, atk: 0.08, d: '號令一國' },
];
export const perkText = (P) => `帶兵 ×${P.troop}　同伴最多 ${P.party} 人${P.recruit ? `　招募 +${Math.round(P.recruit * 100)}%` : ''}　每月補兵 ${Math.round(P.regen * 100)}%${P.atk ? `　全軍攻擊 +${Math.round(P.atk * 100)}%` : ''}${P.d ? '　' + P.d : ''}`;

// ---------------------------------------------------------------- levels
export const expNeed = (lv) => 30 + lv * lv * 18;
// a general's record in the party: level, experience, soldiers, stratagem points and equipment
export function newRec(g, lv) { const r = { lv: lv || startLv(g), exp: 0, sol: 0, sp: 0, eq: { w: null, a: null, h: null, x: null } }; r.sol = solMax(g, r); r.sp = spMax(g, r); return r; }
// how seasoned a general is when we meet them: the able ones a little more
export const startLv = (g) => Math.max(1, Math.round((g.lead + g.war + g.int) / 30 - 3));
export const solMax = (g, r) => { const fx = relicFx(r); return Math.round((150 + (g.lead + (fx.stat.lead || 0)) * 6 + r.lv * 40 + slotV(r, 'h') * 25) * (1 + (fx.solMax || 0)) * (r.cmd || 1)); }; // cmd: the rank of the party's leader
export const spMax = (g, r) => Math.round((g.int + (relicFx(r).stat.int || 0)) * 0.9 + r.lv * 2);
// battle numbers
export function bstats(g, r) {
  const w = slotV(r, 'w') + forgeOf(r, 'w') * 3, a = slotV(r, 'a') + forgeOf(r, 'a') * 2.5, h = slotV(r, 'h'), fx = relicFx(r), S = fx.stat;
  const war = g.war + (S.war || 0), lead = g.lead + (S.lead || 0), int = g.int + (S.int || 0);
  return { atk: war + w, def: lead * 0.6 + a * 1.6 + r.lv, int, spd: (war + lead) / 2 + h * 2 + r.lv * 0.3 + (fx.spd || 0), lead, war, cha: g.cha + (S.cha || 0), pol: g.pol + (S.pol || 0) };
}
// experience: returns the levels gained and the stats that grew (a level-up adds a point to 武力, 統率 or 智力 now and then)
export function gainExp(G, g, r, n, rand = Math.random) {
  r.exp += n; const ups = [];
  while (r.exp >= expNeed(r.lv)) {
    r.exp -= expNeed(r.lv); r.lv++;
    const grow = [];
    for (const [k, w] of [['war', g.base.war], ['lead', g.base.lead], ['int', g.base.int]]) if (g.base[k] < 100 && rand() < 0.25 + w / 400) { g.base[k]++; grow.push(k); }
    refresh(G, g); r.sol = Math.min(solMax(g, r), r.sol + 80); r.sp = spMax(g, r);
    ups.push({ lv: r.lv, grow });
  }
  return ups;
}
export const STAT_N = { lead: '統率', war: '武力', int: '智力', pol: '政治', cha: '魅力' };

// ---------------------------------------------------------------- the score at the end: what the player's general achieved
export function score(G, H) {
  const g = G.gens[H.pid], s = H.st, lord = g.status === 'serving' && G.factions[g.fac]?.lord === g.id;
  const myF = g.status === 'serving' ? g.fac : null, cities = myF ? G.cities.filter((c) => c.owner === myF).length : 0;
  const rows = [
    ['等級', H.rec[H.pid].lv, H.rec[H.pid].lv * 10],
    ['戰鬥勝利', s.wins, s.wins * 5],
    ['討伐賊寇', s.bandits, s.bandits * 15],
    ['一騎討勝利', s.duels, s.duels * 30],
    ['討取名將', s.kills.length, s.kills.length * 80],
    ['攻陷城池', s.cities.length, s.cities.length * 200],
    ['完成任務', s.missions, s.missions * 40],
    ['名聲', H.fame, Math.round(H.fame / 2)],
    ['功績', g.merit, g.merit * 2],
    ['最高官職', lord ? '君主' : RANKS[s.bestRank]?.[0] || '在野', lord ? 1500 : [0, 50, 150, 300, 600, 1000][s.bestRank] || 0],
    ['寶物', G.items.filter((it) => it.holder === g.id).length, G.items.filter((it) => it.holder === g.id).length * 100],
  ];
  if (lord) rows.push(['統治城池', cities, cities * 150]);
  const ts = (H.titles || []).length, sw = (H.sworn || []).length, dex = Object.keys(H.dex || {}).length, ch = (H.changed || []).length;
  if (ts) rows.push(['稱號', ts, ts * 100]);
  if (sw) rows.push(['結義兄弟', sw, sw * 120]);
  if (dex) rows.push(['武將圖鑑', `${dex} 人`, dex * 2]);
  if (ch) rows.push(['改寫歷史', `${ch} 件`, ch * 400]);
  if (G.over && G.over !== 'time') {
    if (myF && G.over === myF) rows.push(['天下統一', lord ? '親手統一天下' : '輔佐主公統一天下', lord ? 6000 : 2000]);
  }
  if (g.status === 'dead') rows.push(['結局', '死亡', -300]);
  const total = rows.reduce((t, r) => t + r[2], 0);
  const title = total >= 15000 ? '天下無雙' : total >= 8000 ? '一代霸主' : total >= 4500 ? '蓋世英雄' : total >= 2500 ? '一方名將' : total >= 1200 ? '亂世豪傑' : total >= 500 ? '無名之輩' : '一介草民';
  return { rows, total, title };
}
