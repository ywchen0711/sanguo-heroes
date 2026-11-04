// The player's side of things on top of the simulation: levels and experience, soldiers (the hit points of a general in
// battle, as in the old Famicom games), stratagem points, equipment bought in shops, the party, ranks and fame.
// A general's 統率 / 武力 / 智力 come from the simulation (with their famous treasures); levels add to them for good.
import { refresh } from './sim/engine.js';

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

// ---------------------------------------------------------------- levels
export const expNeed = (lv) => 30 + lv * lv * 18;
// a general's record in the party: level, experience, soldiers, stratagem points and equipment
export function newRec(g, lv) { const r = { lv: lv || startLv(g), exp: 0, sol: 0, sp: 0, eq: { w: null, a: null, h: null } }; r.sol = solMax(g, r); r.sp = spMax(g, r); return r; }
// how seasoned a general is when we meet them: the able ones a little more
export const startLv = (g) => Math.max(1, Math.round((g.lead + g.war + g.int) / 30 - 3));
export const solMax = (g, r) => Math.round(150 + g.lead * 6 + r.lv * 40 + (r.eq?.h ? EQUIP[r.eq.h].v * 25 : 0));
export const spMax = (g, r) => Math.round(g.int * 0.9 + r.lv * 2);
// battle numbers
export function bstats(g, r) {
  const w = r.eq?.w ? EQUIP[r.eq.w].v : 0, a = r.eq?.a ? EQUIP[r.eq.a].v : 0, h = r.eq?.h ? EQUIP[r.eq.h].v : 0;
  return { atk: g.war + w, def: g.lead * 0.6 + a * 1.6 + r.lv, int: g.int, spd: (g.war + g.lead) / 2 + h * 2 + r.lv * 0.3, lead: g.lead, war: g.war };
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
  if (G.over && G.over !== 'time') {
    if (myF && G.over === myF) rows.push(['天下統一', lord ? '親手統一天下' : '輔佐主公統一天下', lord ? 6000 : 2000]);
  }
  if (g.status === 'dead') rows.push(['結局', '死亡', -300]);
  const total = rows.reduce((t, r) => t + r[2], 0);
  const title = total >= 15000 ? '天下無雙' : total >= 8000 ? '一代霸主' : total >= 4500 ? '蓋世英雄' : total >= 2500 ? '一方名將' : total >= 1200 ? '亂世豪傑' : total >= 500 ? '無名之輩' : '一介草民';
  return { rows, total, title };
}
