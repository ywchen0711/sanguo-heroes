// 建設: lasting works in a city, three levels each. The computer's governors build them too, so a realm that is well run
// pulls ahead over the years: more gold and grain each month, stronger walls, better-trained soldiers, more men of talent.
// A city keeps them in c.bld = { key: level }.
export const BUILD = {
  farm: { n: '水利', d: (l) => `農業上限 +25%、秋收 +${l * 20}%` },
  comm: { n: '市集', d: (l) => `商業上限 +25%、稅收 +${l * 20}%、城裡買東西便宜 ${l * 5}%` },
  def: { n: '城郭', d: (l) => `城防上限 +30%、守城更強（攻方難打 +${l * 12}%）` },
  train: { n: '校場', d: (l) => `每月自動練兵 +${l * 2}、新兵訓練 +${l * 10}` },
  tun: { n: '屯田', d: (l) => `駐軍吃的糧 -${l * 20}%、秋收 +${l * 250} 糧` },
  acad: { n: '書院', d: (l) => `招攬人才成功率 +${l * 6}%、內政功績 +${l * 1}` },
};
export const BUILD_COST = [300, 700, 1400];
export const bLv = (c, k) => c?.bld?.[k] || 0;
// the stored caps grow with a level
export function build(c, k) {
  c.bld ||= {}; const l = (c.bld[k] || 0) + 1; c.bld[k] = l;
  if (k === 'farm') c.farmMax = Math.round(c.farmMax * 1.25);
  if (k === 'comm') c.commMax = Math.round(c.commMax * 1.25);
  if (k === 'def') c.defMax = Math.round(c.defMax * 1.3);
  return l;
}
// a city's monthly tax and its harvest (the same formulas the economy uses, before the era's multipliers)
export const moraleMul = (c) => 0.4 + c.morale / 160;
export const taxOf = (c) => (c.comm * 0.13 + c.pop / 9000) * moraleMul(c) * (1 + bLv(c, 'comm') * 0.2);
export const harvestOf = (c) => (c.farm * 2.6 + c.pop / 320) * moraleMul(c) * (1 + bLv(c, 'farm') * 0.2) + bLv(c, 'tun') * 250;
export const upkeepOf = (c) => c.troops / 150 * (1 - bLv(c, 'tun') * 0.2);
// what the computer's governor builds next, if anything
export function aiBuild(G, f, c, isFront) {
  const order = isFront ? ['train', 'tun', 'comm', 'def', 'farm', 'acad'] : ['comm', 'farm', 'acad', 'tun', 'train', 'def'];
  for (const k of order) { const l = bLv(c, k); if (l >= 3 || l >= c.size) continue; const cost = BUILD_COST[l]; if (f.gold < cost * 3 + 800) return; f.gold -= cost; build(c, k); return k; }
}
