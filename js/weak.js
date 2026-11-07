// What an enemy fears and what it shrugs off. Every stratagem has an element (火 fire, 水 water, 雷 thunder, 石 earth),
// blows are 兵刃 (steel) and confusion works on the 心 (mind). A foe may be weak to some (×1.6, or confused far more
// easily), resist some (×0.5) or be untouched by them. Bandits of each kind have their own (beasts fear fire, pirates
// the lightning, horsemen the falling rocks, the Yellow Turbans are easily thrown into disorder); the chiefs of the
// story mode have theirs (saga.js). The undead (陰兵) shrug off steel and are burnt by healing.
// 看破 (a battle order) shows them; what was seen once is remembered (H.lore) and shown in every battle after.
export const EL = { fire: 'fire', blaze: 'fire', feng: 'fire', flood: 'water', lei: 'thunder', rock: 'earth' };
export const EL_N = { fire: '火', water: '水', thunder: '雷', earth: '石', phys: '兵刃', mind: '心' };

// the defaults for a foe that has none of its own
export function defaults(f) {
  if (f.weak || f.res || f.immune) return;
  const w = [], r = [], im = [];
  if (f.beast) { if (f.beast === 'snake') w.push('earth'); else if (f.beast === 'bat') w.push('thunder'); else w.push('fire'); }
  else if (f.solKind === 'pirate') { w.push('thunder'); r.push('water'); }
  else if (f.solKind === 'nomad') w.push('earth');
  else if (f.solKind === 'turban') w.push('mind');
  else if (f.solKind === 'barbarian') w.push('fire');
  else if (f.gid != null) { if (f.int < 45) w.push('mind'); else if (f.int >= 88) r.push('mind'); if (f.war >= 92) r.push('phys'); }
  f.weak = w; f.res = r; f.immune = im;
}
export const loreKey = (f) => f.lore || (f.gid != null ? 'g' + f.gid : f.beast || f.name);
// how much an element does to a foe
export function elMul(t, el) {
  if (!el || t.side !== 'foe') return 1;
  if (t.immune?.includes(el)) return 0;
  if (t.weak?.includes(el)) return el === 'phys' ? 1.35 : 1.6;
  if (t.res?.includes(el)) return el === 'phys' ? 0.6 : 0.5;
  return 1;
}
// the little tags on a foe's bar once seen
export function tagsHTML(f) {
  if (!f.seen) return '';
  const t = (cls, a, p) => (a?.length ? `<em class="wk ${cls}">${p}${a.map((k) => EL_N[k]).join('')}</em>` : '');
  const s = t('w', f.weak, '弱') + t('r', f.res, '抗') + t('i', f.immune, '免') + (f.undead ? '<em class="wk w">怕治癒</em>' : '');
  return s || '<em class="wk n">無弱點</em>';
}
export function tagsText(f) {
  if (!f.seen) return '弱點：？（用「看破」看穿）';
  const p = (n, a) => (a?.length ? `${n}${a.map((k) => EL_N[k]).join('、')}` : '');
  return [p('弱：', f.weak), p('抗：', f.res), p('免疫：', f.immune), f.undead ? '治癒之術會傷到它' : '', f.ult ? `大招「${f.ult.n}」` : ''].filter(Boolean).join('　') || '沒有明顯的弱點';
}
