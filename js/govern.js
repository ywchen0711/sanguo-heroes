// 內政 as the player does it: a hero's ten days of work go much further than an officer's month, a work that lasts
// (水利, 市集, 城郭, 校場, 屯田, 書院) changes a city for good, and a general of rank may govern a city as its 太守 —
// every month it grows by the governor's own gifts, and a fifth of its tax is the governor's.
import { BUILD, BUILD_COST, bLv, build, taxOf, harvestOf } from './sim/build.js';
import { citiesOf } from './sim/engine.js';
import { partyFx } from './relics.js';
import { gainExp } from './hero.js';

const JOBS = [['farm', '開墾', '農業'], ['comm', '商業', '商業'], ['def', '築城', '城防'], ['train', '練兵', '訓練'], ['morale', '安民', '民心']];
export const FOCUS = { bal: ['均衡', '各方面都顧到'], farm: ['重農', '農業大幅成長（秋收）'], comm: ['重商', '商業大幅成長（稅收）'], def: ['築城', '城防大幅成長'], train: ['練兵', '訓練成長，每月還會募到新兵'], morale: ['安民', '民心成長（稅收、秋收都更多）'] };
const maxOf = (C, k) => (k === 'train' || k === 'morale' ? 100 : C[k + 'Max']);
// how much a job raises a stat: the player in person, ten days
const jobGain = (me, k, r = 0.5) => ({ farm: 10 + me.pol / 2.4 + r * 15, comm: 10 + me.pol / 2.4 + r * 15, def: 12 + me.lead / 2.8 + r * 15, train: 5 + me.lead / 6 + r * 6, morale: 4 + me.cha / 9 + r * 6 })[k];
// what a change is worth: gold a month, grain each autumn
function worth(C, k, n) { const t0 = taxOf(C), h0 = harvestOf(C), v = C[k]; C[k] = Math.min(maxOf(C, k), v + n); const d = [taxOf(C) - t0, harvestOf(C) - h0]; C[k] = v; return d; }
const worthTxt = ([t, h]) => [t >= 0.5 ? `稅收 +${Math.round(t)} 金／月` : '', h >= 1 ? `秋收 +${Math.round(h)} 糧` : ''].filter(Boolean).join('、');
// the rank a level of a work needs: the first anyone, the second 都尉, the third 中郎將
const canLv = (game, l) => game.isLord() || l <= 1 || (l === 2 ? game.perk().dom : game.perk().inv >= 1);
export const cityLine = (G, C, f) => { const all = citiesOf(G, f.id), ft = all.reduce((s, c) => s + taxOf(c), 0), tax = taxOf(C); return `${C.name}：每月稅收 ${Math.round(tax)} 金（全勢力的 ${Math.round(tax / Math.max(1, ft) * 100)}%）　秋收約 ${Math.round(harvestOf(C))} 糧　兵 ${C.troops}　訓練 ${C.train}`; };
export const bldLine = (C) => Object.keys(BUILD).filter((k) => bLv(C, k)).map((k) => `${BUILD[k].n}${bLv(C, k)}`).join('　') || '還沒有建設';

export async function jobMenu(act, C, f) {
  const game = act.g, me = act.me, H = act.H, ui = act.ui;
  const opts = [];
  for (const [k, n, s] of JOBS) {
    const g = Math.round(jobGain(me, k) * (1 + partyFx(game, k === 'def' ? 'build' : k))), full = C[k] >= maxOf(C, k);
    opts.push({ k, n, sub: `${s} ${C[k]}／${maxOf(C, k)}`, d: full ? '已經到上限了（蓋建設可以提高上限）' : `約 +${g}${worthTxt(worth(C, k, g)) ? '：' + worthTxt(worth(C, k, g)) : ''}`, off: full });
  }
  for (const [k, B] of Object.entries(BUILD)) {
    const l = bLv(C, k); if (l >= 3) { opts.push({ k: 'done:' + k, n: `${B.n}（已滿級）`, sub: 'Lv3', d: B.d(3), off: true }); continue; }
    const cost = BUILD_COST[l], pay = f.gold >= cost ? 'f' : H.gold >= cost ? 'm' : null, rk = canLv(game, l + 1);
    opts.push({ k: (pay === 'm' ? 'bm:' : 'bf:') + k, n: `興建${B.n}`, sub: `Lv${l}→${l + 1}　${cost} 金${pay === 'm' ? '（自掏腰包）' : ''}`, d: !rk ? `第 ${l + 1} 級要${l + 1 === 2 ? '都尉' : '中郎將'}以上才能主持` : !pay ? `金不夠（勢力 ${f.gold}、你 ${H.gold}）` : `${B.d(l + 1)}（二十天）`, off: !rk || !pay });
  }
  const k = await ui.choose(opts.concat([{ k: null, n: '返回' }]), { title: `內政　${cityLine(act.G, C, f)}<br><small>建設：${bldLine(C)}</small>` }); if (!k) return;
  const merit = (n) => { if (game.isLord()) return 0; const v = Math.round((n + (game.perk().dom ? 1 : 0) + bLv(C, 'acad')) * (1 + partyFx(game, 'merit'))); me.merit += v; return v; };
  if (k.startsWith('b')) {
    const bk = k.slice(3), l = bLv(C, bk), cost = BUILD_COST[l];
    if (k[1] === 'm') { H.gold -= cost; H.fame += 5 * (l + 1); } else f.gold -= cost;
    build(C, bk); const m = merit(6 * (l + 1)); gainExp(act.G, me, H.rec[me.id], 40); game.audio.sfx('level');
    await act.passDays(20, `${me.name}主持興建${BUILD[bk].n}（Lv${l + 1}）。\n${BUILD[bk].d(l + 1)}${m ? `\n功績 +${m}` : ''}${k[1] === 'm' ? `　名聲 +${5 * (l + 1)}（自掏腰包，百姓感念）` : ''}`);
    act.promote(); return;
  }
  if (f.gold < 20 && k !== 'train') { ui.toast('勢力的金不夠'); return; }
  const n = Math.round(jobGain(me, k, Math.random()) * (1 + partyFx(game, k === 'def' ? 'build' : k))), before = C[k], w = worth(C, k, n);
  C[k] = Math.min(maxOf(C, k), before + n); if (k !== 'train') f.gold -= k === 'morale' ? 10 : 20;
  const m = merit(3); gainExp(act.G, me, H.rec[me.id], 20);
  await act.passDays(10, `${me.name}努力${JOBS.find((j) => j[0] === k)[1]}。${JOBS.find((j) => j[0] === k)[2]} ${before} → ${C[k]}${worthTxt(w) ? `\n${worthTxt(w)}` : ''}${m ? `（功績 +${m}）` : ''}`);
  act.promote();
}

// ---------------------------------------------------------------- 太守
export const canGovern = (game, C) => { const f = game.myFaction() && game.G.factions[game.myFaction()]; return !!f && C.owner === f.id && game.me.status === 'serving' && (game.isLord() || (game.perk().dom && f.capital !== C.id)); };
export async function governor(act, C, f) {
  const game = act.g, H = act.H, me = act.me, ui = act.ui, mine = H.gov?.cid === C.id;
  if (!mine && H.gov) { const old = act.G.cities[H.gov.cid]; if (!await ui.yesno(`你現在是${old.name}的太守。要改到${C.name}嗎？`)) return; }
  const k = await ui.choose(Object.entries(FOCUS).map(([k, [n, d]]) => ({ k, n, sub: mine && H.gov.focus === k ? '目前' : '', d })).concat(mine ? [{ k: 'quit', n: '辭去太守', d: '' }] : [], [{ k: null, n: '返回' }]), { title: `${mine ? '太守方針' : game.isLord() ? '親領此城' : '請命為太守'}　${cityLine(act.G, C, f)}` });
  if (!k) return;
  if (k === 'quit') { H.gov = null; ui.toast(`你辭去了${C.name}太守。`); return; }
  if (!mine) {
    H.gov = { cid: C.id, focus: k, since: act.G.t };
    const lord = act.G.gens[f.lord];
    if (!game.isLord()) await ui.say(lord.name, `好，${C.name}就交給你了。好好治理，別讓我失望。\n（每月依你的政治、統率、魅力治理這座城，分得兩成的稅收；方針可以隨時到太守府更改）`, game.lookOf(lord));
    else ui.toast(`你親自治理${C.name}（${FOCUS[k][0]}）。`);
  } else { H.gov.focus = k; ui.toast(`${C.name}的方針改為「${FOCUS[k][0]}」。`); }
}
// each month: the city grows by the governor's gifts
export function govern(game) {
  const H = game.H, G = game.G, me = game.me, gv = H.gov; if (!gv) return;
  const C = G.cities[gv.cid];
  if (!canGovern(game, C) && !(game.isLord() && C.owner === game.myFaction())) { H.gov = null; game.ui.toast(`<b style="color:#ff9a6a">你不再是${C.name}的太守了。</b>`, 4000); return; }
  const K = gv.focus, r = Math.random, t0 = taxOf(C), h0 = harvestOf(C);
  const pw = { farm: 3 + me.pol / 12, comm: 3 + me.pol / 12, def: 4 + me.lead / 12, train: 1 + me.lead / 30, morale: 0.6 + me.cha / 45 };
  for (const k in pw) C[k] = Math.min(maxOf(C, k), C[k] + Math.round(pw[k] * (K === k ? 3 : K === 'bal' ? 1.3 : 0.5) * (0.8 + r() * 0.4)));
  if (K === 'train' && C.pop > 30000) { const n = Math.round(150 + me.cha * 4); C.train = Math.round((C.train * C.troops + 40 * n) / (C.troops + n)); C.troops += n; C.pop -= Math.round(n / 2); }
  const share = Math.round(taxOf(C) * 0.2); H.gold += share; if (!game.isLord()) { me.merit += 2; game.act.promote(); }
  gv.share = share; gv.months = (gv.months || 0) + 1; gv.dTax = Math.round((gv.dTax || 0) + taxOf(C) - t0); gv.dCrop = Math.round((gv.dCrop || 0) + harvestOf(C) - h0);
  if (G.month === 7) setTimeout(() => game.ui.toast(`<b>秋收</b>　你治理的${C.name}收成約 ${Math.round(harvestOf(C))} 糧`, 4000), 1800);
}
export function govHTML(game) {
  const gv = game.H.gov; if (!gv) return '';
  const C = game.G.cities[gv.cid];
  return `<div class="dim">${C.name}太守（${FOCUS[gv.focus][0]}，${gv.months || 0} 個月）：每月稅收 ${Math.round(taxOf(C))} 金，你分得 ${gv.share || 0} 金　上任以來稅收 +${gv.dTax || 0}、秋收 +${gv.dCrop || 0}<br>建設：${bldLine(C)}</div>`;
}
