// What a treasure does, and where the party's equipment lives. An equipment slot (rec.eq.w / a / h / x) holds either a
// piece bought in a shop (its id, a string, as before) or an entry of the bag: { id, lv, exp } for a treasure, or
// { sid } for a shop piece taken off. The bag (H.bag) holds everything not being worn.
import { RELICS, RELIC_IDS, POWERS, GRADE_N, GRADE_C, SLOT_N, PRICE } from './data/relics.js';
import { EQUIP } from './hero.js';

export { RELICS, POWERS, GRADE_N, GRADE_C, SLOT_N, PRICE };
const LV_EXP = [0, 0, 20, 60, 130, 240];
export const lvMul = (lv) => 1 + 0.12 * ((lv || 1) - 1);
const CAP = { crit: 0.4, combo: 0.6, pierce: 0.7, dodge: 0.45, block: 0.6, physRes: 0.5, tacRes: 0.7, again: 0.4, counter: 0.7, stun: 0.4, tacCost: 0.6, encounter: 0.7, steal: 0.5 };
const FLAG = new Set(['first', 'noConfuse', 'flee']);
const INT = new Set(['spRegen', 'spd', 'startRouse']);
// the strength of one power of a treasure (its second power is a little weaker)
export function powerVal(R, key, lv, second) {
  const raw = POWERS[key][1][R.grade - 1]; if (FLAG.has(key)) return 1;
  const v = raw * (second ? 0.6 : 1) * (key === 'startRouse' ? 1 : lvMul(lv));
  return INT.has(key) ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000;
}
// ---------------------------------------------------------------- what is in a slot
export const isRelic = (e) => !!e && typeof e === 'object' && !!e.id;
export function itemOf(e) {
  if (!e) return null;
  if (typeof e === 'string' || e.sid) { const sid = typeof e === 'string' ? e : e.sid, E = EQUIP[sid]; return E && { n: E.n, slot: E.kind, v: E.v, grade: 0, color: '#f4ead2', shop: true, sid, price: E.price }; }
  const R = RELICS[e.id]; if (!R) return null;
  return { n: R.n, slot: R.slot, v: Math.round(R.v * lvMul(e.lv)), grade: R.grade, color: GRADE_C[R.grade], R, lv: e.lv || 1, price: PRICE[R.grade] };
}
export const slotV = (r, k) => itemOf(r.eq?.[k])?.v || 0;
// the powers of everything a general wears, added together: { crit: 0.12, stat: { int: 3 }, ... }
export function relicFx(r) {
  const o = { stat: {} };
  for (const k of ['w', 'a', 'h', 'x']) {
    const e = r?.eq?.[k]; if (!isRelic(e)) continue; const R = RELICS[e.id]; if (!R) continue;
    if (R.stat) o.stat[R.stat] = (o.stat[R.stat] || 0) + Math.round(R.v * lvMul(e.lv));
    for (const [key, second] of [[R.p1, false], [R.p2, true]]) if (key) o[key] = FLAG.has(key) ? 1 : (o[key] || 0) + powerVal(R, key, e.lv, second);
  }
  for (const k in CAP) if (o[k] > CAP[k]) o[k] = CAP[k];
  return o;
}
// the lines that describe a treasure's powers
export function powerLines(e) {
  const R = RELICS[e.id]; if (!R) return [];
  return [[R.p1, false], [R.p2, true]].filter(([k]) => k).map(([k, s]) => ({ n: POWERS[k][0], d: POWERS[k][2](powerVal(R, k, e.lv, s)) }));
}
export function relicLabel(e) {
  const it = itemOf(e); if (!it) return '—';
  return it.shop ? it.n : `<span style="color:${it.color}">${it.n}</span>${it.lv > 1 ? `<small> Lv${it.lv}</small>` : ''}`;
}
// ---------------------------------------------------------------- finding them
// even early on there is a thin chance of something wonderful (the last two numbers): that is the fun of it
const WEIGHTS = (lv) => lv < 8 ? [58, 30, 9, 2.4, 0.6] : lv < 16 ? [35, 37, 20, 6.5, 1.5] : lv < 25 ? [20, 32, 30, 14, 4] : [10, 25, 33, 22, 10];
export function rollGrade(lv, min = 1) {
  const w = WEIGHTS(lv).map((x, i) => (i + 1 < min ? 0 : x)), tot = w.reduce((a, b) => a + b, 0) || 1; let r = Math.random() * tot;
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r < 0) return i + 1; } return Math.max(min, 1);
}
export function rollRelic(lv, min = 1, slot = null) {
  const g = rollGrade(lv, min), pool = RELIC_IDS.filter((id) => RELICS[id].grade === g && (!slot || RELICS[id].slot === slot));
  return pool[Math.floor(Math.random() * pool.length)];
}
// a jackpot: a treasure of the top grades, whatever the level, with a fanfare
export function jackpot(game, slot = null) {
  const g = Math.random() < 0.35 ? 5 : 4, pool = RELIC_IDS.filter((id) => RELICS[id].grade === g && (!slot || RELICS[id].slot === slot)), id = pool[Math.floor(Math.random() * pool.length)];
  const R = RELICS[id]; giveRelic(game, id, true);
  game.ui.banner(`<b style="color:${GRADE_C[g]};font-size:20px">★ ${g === 5 ? '天降神兵' : '稀世珍寶'} ★</b><br>得到 <b style="color:${GRADE_C[g]}">${R.n}</b>　<small>${GRADE_N[g]}・${SLOT_N[R.slot]}</small>`, 7000);
  game.audio?.sfx('level'); setTimeout(() => game.audio?.sfx('coin'), 250); setTimeout(() => game.audio?.sfx('level'), 500);
  (game.H.jackpots ||= []).push({ id, y: game.G.year });
  return id;
}
export function giveRelic(game, id, quiet) {
  const H = game.H, R = RELICS[id]; H.bag ||= [];
  const e = { id, lv: 1, exp: 0 }; H.bag.push(e); (H.relicSeen ||= {})[id] = 1;
  if (!quiet) { game.ui.toast(`得到寶物 <b style="color:${GRADE_C[R.grade]}">${R.n}</b>　<small>${GRADE_N[R.grade]}・${SLOT_N[R.slot]}</small>`, 4000); game.audio?.sfx('level'); }
  return e;
}
// equipped treasures grow with the battles they see
export function relicExp(game, n) {
  const out = [];
  for (const p of game.partyList()) for (const k of ['w', 'a', 'h', 'x']) {
    const e = p.rec.eq?.[k]; if (!isRelic(e) || (e.lv || 1) >= 5) continue;
    e.exp = (e.exp || 0) + n; e.lv ||= 1;
    while (e.lv < 5 && e.exp >= LV_EXP[e.lv + 1]) { e.lv++; out.push(`${p.g.name}的「${RELICS[e.id].n}」升到 Lv${e.lv}！`); }
  }
  return out;
}
export const nextExp = (e) => (e.lv >= 5 ? null : LV_EXP[(e.lv || 1) + 1]);
// ---------------------------------------------------------------- putting things on and taking them off
// returns what came off (now in the bag), or null
export function wear(H, rec, slot, e) {
  H.bag ||= []; rec.eq ||= {}; rec.forge ||= {};
  const old = rec.eq[slot];
  if (old) H.bag.push(typeof old === 'string' ? { sid: old, forge: rec.forge[slot] || 0 } : { ...old, forge: rec.forge[slot] || 0 });
  if (e) { H.bag = H.bag.filter((x) => x !== e); rec.eq[slot] = e.sid ? e.sid : { id: e.id, lv: e.lv || 1, exp: e.exp || 0 }; rec.forge[slot] = e.forge || 0; }
  else { rec.eq[slot] = null; rec.forge[slot] = 0; }
  return old || null;
}
export const bagFor = (H, slot) => (H.bag || []).filter((e) => itemOf(e)?.slot === slot).sort((a, b) => (itemOf(b).grade - itemOf(a).grade) || (itemOf(b).v - itemOf(a).v));
// the party's map-side powers, added together
export function partyFx(game, key) { let v = 0; for (const p of game.partyList()) v += relicFx(p.rec)[key] || 0; return CAP[key] ? Math.min(CAP[key], v) : v; }
