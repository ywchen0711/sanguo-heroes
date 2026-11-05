// The encyclopedia of generals (武將圖鑑): everyone you have met (見), fought (戰) or had at your side (收), with what
// history says of them. How full it is counts at the end.
import { BIOS } from './data/bios.js';
import { itemName } from './sim/text.js';
import { frameCanvas, personSheet } from './sprites.js';
import { checkTitles } from './deeds.js';
import { TYPE_N, TYPE_D, lifeLine, lvNeed } from './sim/life.js';
import { fmt } from './sim/text.js';
import { traitsOf, traitHTML, combosWith, TRAITS, TRAIT, SCHOOLS, COMBOS, groupTraits, actHTML, fxLine, chip } from './traits.js';
import { RESONANCE, SYNERGY, fxText } from './data/traits.js';
import { POWERS, RELICS, ULT_IDS, GRADE_C, SLOT_N, powerLines } from './relics.js';

const BIO = Object.fromEntries(BIOS.map(([n, zi, t]) => [n, { zi: zi === '—' ? '' : zi, t }]));
export const DEX_N = ['', '見過', '交過手', '曾為同伴'];
// level: 1 met, 2 fought, 3 fought alongside
export function mark(game, id, level) {
  const H = game.H, g = game.G.gens[id]; if (!g || g.isPlayer || id === H.pid) return;
  H.dex ||= {}; const was = H.dex[id] || 0; if (level <= was) return;
  H.dex[id] = level;
  if (!was) { const n = Object.keys(H.dex).length; if (n % 50 === 0) game.ui.toast(`<b>武將圖鑑收錄了 ${n} 人</b>`, 3000); if (n === 150) checkTitles(game); }
}
export const dexCount = (H) => Object.keys(H.dex || {}).length;
const best = (g) => { const k = [['lead', '統率'], ['war', '武力'], ['int', '智力'], ['pol', '政治'], ['cha', '魅力']].sort((a, b) => g[b[0]] - g[a[0]]); return k; };
function bioOf(G, g) {
  const b = BIO[g.name];
  if (b) return b;
  const [[, s1], [, s2]] = best(g), f0 = g.fac0 && G.factions[g.fac0];
  const kind = g.war >= 80 ? '勇將' : g.int >= 80 ? '謀士' : g.pol >= 80 ? '能臣' : g.lead >= 75 ? '將領' : g.cha >= 80 ? '名士' : '人物';
  return { zi: '', t: `${g.born}年生，${G.cities[g.home]?.name || ''}人。${f0 ? `最初效力於${f0.name}軍的` : '亂世中的'}${kind}，以${s1}和${s2}見長。` };
}
export async function dexScreen(game) {
  const G = game.G, H = game.H, ui = game.ui, ids = Object.keys(H.dex || {}).map(Number);
  if (!ids.length) { ui.toast('圖鑑還是空的：和武將交談、交手或並肩作戰，就會收錄'); return; }
  const tot = (g) => g.lead + g.war + g.int + g.pol + g.cha;
  let sort = 'tot', start = 0;
  for (;;) {
    const list = ids.map((id) => G.gens[id]).sort(sort === 'tot' ? (a, b) => tot(b) - tot(a) : (a, b) => (H.dex[b.id] - H.dex[a.id]) || tot(b) - tot(a));
    const opts = [{ k: 'sort', n: sort === 'tot' ? '↕ 依能力排序（按此改為依關係）' : '↕ 依關係排序（按此改為依能力）' }, ...list.map((g) => ({ k: g.id, n: `${g.name}${BIO[g.name] ? ' ★' : ''}`, sub: `${DEX_N[H.dex[g.id]]}　統${g.lead} 武${g.war} 智${g.int}`, d: g.status === 'dead' ? '已故' : g.status === 'serving' ? `${G.factions[g.fac]?.name || ''}軍` : g.status === 'free' ? '在野' : '' })), { k: null, n: '關閉' }];
    const k = await ui.choose(opts, { title: `武將圖鑑　${ids.length}／${G.gens.filter((g) => !g.hidden || g.known).length}`, cls: 'wide tall', start });
    if (k == null) return;
    if (k === 'sort') { sort = sort === 'tot' ? 'rel' : 'tot'; start = 0; continue; }
    start = opts.findIndex((o) => o.k === k);
    const g = G.gens[k], b = bioOf(G, g), img = frameCanvas(personSheet(game.lookOf(g)), 0, 1).toDataURL();
    const items = G.items.filter((it) => it.holder === g.id).map((it) => itemName(it.key));
    const st = g.status === 'dead' ? `已故（${g.cause === 'natural' ? '壽終' : '戰歿'}）` : g.status === 'serving' ? `${G.factions[g.fac]?.name || ''}軍${G.factions[g.fac]?.lord === g.id ? '・君主' : ''}` : g.status === 'free' ? '在野' : '';
    await ui.panel(`<div class="st-card"><img src="${img}"><div><h3>${g.name}${b.zi ? `　<small>字${b.zi}</small>` : ''}</h3>
      <div class="st-grid"><span>統率 <b>${g.lead}</b></span><span>武力 <b>${g.war}</b></span><span>智力 <b>${g.int}</b></span><span>政治 <b>${g.pol}</b></span><span>魅力 <b>${g.cha}</b></span></div>
      <div>${g.born}年生　${st}　<span class="dim">${DEX_N[H.dex[g.id]]}</span></div>${items.length ? `<div>寶物：${items.join('、')}</div>` : ''}
      <div class="traits">${traitsOf(g).map((n) => traitHTML(n)).join('')}</div>${(() => { const c = combosWith(G, g, game.partyList().map((p) => p.g)); return (c.own ? `<div class="combo-tip">★ 個人絕技「${c.own}」</div>` : '') + c.with.map((w) => `<div class="combo-tip">★ 和${w.g.name}能組成「${w.n}」</div>`).join(''); })()}
      <p class="bio">${b.t}</p></div></div>${lifeHTML(G, g)}`, { title: '武將圖鑑', cls: 'wide' });
  }
}

// a general's own life: who they are, how far they have come, the people in it and their chronicle
function lifeHTML(G, g) {
  const L = g.life; if (!L) return '';
  const nm = (id) => G.gens[id]?.name, fr = Object.entries(L.friends || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => nm(id)).filter(Boolean);
  const STN = ['統率', '武力', '智力', '政治', '魅力'], keys = ['lead', 'war', 'int', 'pol', 'cha'];
  const room = keys.map((k, i) => (L.pot?.[i] > g.base[k] ? `${STN[i]}還能到 ${L.pot[i]}` : null)).filter(Boolean);
  const mine = (L.log || []).map((e) => ({ y: e[0], t: lifeLine(e).replace(/^\d+年　/, '') }));
  const world = G.log.filter((e) => e.g === g.id && e.level >= 2).slice(-8).map((e) => ({ y: e.year, t: fmt(e) }));
  const told = new Set(world.map((e) => e.y)), mine2 = mine.filter((e, i) => !(L.log[i][1] === 'join' && told.has(e.y))); // the realm's own record says it better
  const all = [...mine2, ...world].sort((a, b) => a.y - b.y).slice(-14);
  return `<div class="life"><h4>【${TYPE_N[L.type]}】Lv ${L.lv}　<small>${TYPE_D[L.type]}</small></h4>
    <div class="dim">經驗 ${L.exp}/${lvNeed(L.lv)}${room.length ? '　潛力：' + room.join('、') : '　已經到達極限'}</div>
    ${L.mentor != null && nm(L.mentor) ? `<div>師父：${nm(L.mentor)}</div>` : ''}${L.pupil != null && nm(L.pupil) ? `<div>徒弟：${nm(L.pupil)}</div>` : ''}${L.sworn != null && nm(L.sworn) ? `<div>結義兄弟：${nm(L.sworn)}</div>` : ''}${fr.length ? `<div>好友：${fr.join('、')}</div>` : ''}
    ${all.length ? `<h4>年表</h4>${all.map((e) => `<p><small>${e.y}年</small>　${e.t}</p>`).join('')}` : ''}</div>`;
}

// ---------------------------------------------------------------- 特性圖鑑: every trait, by school or by what it does, the
// named combinations, who you know that has each one (to build a party around one thing: 落雷, 尋寶…), and the 神器
const R_N = ['', '普通', '稀有', '傳說'];
const EFF_N = { war: '武力', int: '智力', lead: '統率', pol: '政治', cha: '魅力', horse: '相馬', farm: '開墾', comm: '經商', morale: '安民', train: '練兵', build: '築城', loyal: '忠誠', merit: '功績', price: '殺價', diplo: '外交', bond: '好感', event: '奇遇' };
const effName = (k) => POWERS[k]?.[0] || EFF_N[k] || k;
const fxOf = (fx) => Object.entries(fx).map(([k, v]) => fxText(POWERS, k, v)).join('、');
const holders = (G, n) => G.gens.filter((g) => g.status !== 'dead' && (!g.hidden || g.known) && traitsOf(g).includes(n));
const knownTo = (H, g) => g.isPlayer || H.dex?.[g.id] || H.party.includes(g.id);
// a general's traits, in full: what each does, what the two make together, and with whom in the party
export function traitCard(game, x) {
  const G = game.G, ts = traitsOf(x), mine = groupTraits([x]).get(x.id), c = combosWith(G, x, game.partyList().map((p) => p.g));
  const more = ts.flatMap((n) => COMBOS.filter((k) => (k[0] === n || k[1] === n) && !(ts.includes(k[0]) && ts.includes(k[1]))));
  return `<div class="traits">${ts.map((n) => `${traitHTML(n)}<p class="dim">${TRAIT[n]?.d || ''}　（${R_N[TRAIT[n]?.r] || ''}）</p>`).join('')}</div>
    ${mine?.act.length ? `<h4>本身的組合</h4>${actHTML(mine.act)}<p class="dim">合計：${fxLine(mine.fx)}</p>` : ''}
    ${c.with.length ? `<h4>和隊伍的組合</h4>${c.with.map((w) => `<div class="combo-tip">★ 和${w.g.name}能組成「${w.n}」：${fxOf(COMBOS.find((k) => k[2] === w.n)[3])}</div>`).join('')}` : ''}
    ${more.length ? `<h4>還能組成</h4>${more.map((k) => `<div class="dim">「${k[2]}」：${k[0]}＋${k[1]}（${fxOf(k[3])}）</div>`).join('')}` : ''}`;
}
async function traitPage(game, t) {
  const G = game.G, H = game.H, all = holders(G, t.n), known = all.filter((g) => knownTo(H, g)).sort((a, b) => (b.lead + b.war + b.int) - (a.lead + a.war + a.int));
  const where = (g) => (g.isPlayer ? '你自己' : H.party.includes(g.id) ? '隊伍中' : g.status === 'serving' ? `${G.factions[g.fac]?.name || ''}軍・${G.cities[g.city]?.name || ''}` : g.status === 'free' ? `在野・${G.cities[g.city]?.name || ''}` : '尚未出仕');
  const combos = COMBOS.filter((k) => k[0] === t.n || k[1] === t.n);
  await game.ui.panel(`${traitHTML(t.n)}<p>${t.d}　<span class="dim">${R_N[t.r]}・${t.s.map((s) => SCHOOLS[s][0]).join('、')}系</span></p>
    <h4>共鳴與相生</h4>${t.s.map((s) => `<div>${chip(s)} 一個人兩個特性都是${SCHOOLS[s][0]}系：共鳴「${RESONANCE[s][0]}」，兩個特性都 ×1.5，再加${fxOf(RESONANCE[s][1])}</div>`).join('')}
    ${SYNERGY.filter(([a, b]) => t.s.includes(a) || t.s.includes(b)).map(([a, b, n, , d]) => `<div class="dim">${a}＋${b}「${n}」：${d}</div>`).join('')}
    ${combos.length ? `<h4>名組合</h4>${combos.map((k) => `<div class="combo-tip">★「${k[2]}」＝${k[0]}＋${k[1]}：${fxOf(k[3])}　<span class="dim">${k[4]}</span></div>`).join('')}` : ''}
    <h4>有這個特性的人（${all.length} 人，你認識 ${known.length} 人）</h4>
    ${known.length ? known.slice(0, 30).map((g) => `<div>${g.name}　<span class="dim">${traitsOf(g).join('・')}　統${g.lead} 武${g.war} 智${g.int}　${where(g)}</span></div>`).join('') : '<div class="dim">還沒遇到。和更多武將交談，圖鑑就會收錄。</div>'}
    ${all.length > known.length ? `<div class="dim">還有 ${all.length - known.length} 人你還沒見過。</div>` : ''}`, { title: `特性・${t.n}`, cls: 'wide' });
}
async function traitList(game, list, title) {
  const G = game.G, H = game.H; let start = 0;
  const C = ['', '#e8e0d0', '#6ab0ff', '#ffc84a'];
  for (;;) {
    const opts = list.sort((a, b) => b.r - a.r).map((t) => { const all = holders(G, t.n); return { k: t.n, n: `<b style="color:${C[t.r]}">${t.n}</b> ${t.s.map(chip).join('')}`, sub: `${R_N[t.r]}　認識 ${all.filter((g) => knownTo(H, g)).length}/${all.length} 人`, d: fxOf(t.fx) }; });
    const k = await game.ui.choose(opts, { title, cls: 'wide tall', start }); if (k == null) return;
    start = opts.findIndex((o) => o.k === k); await traitPage(game, TRAIT[k]);
  }
}
export async function traitDex(game) {
  const ui = game.ui, H = game.H;
  for (;;) {
    const got = new Set([...(H.bag || []).map((e) => e.id), ...game.partyList().flatMap((p) => Object.values(p.rec.eq || {}).map((e) => e?.id)), ...(H.ults || []).map((u) => u.id)]);
    const k = await ui.choose([
      { k: 'school', n: '依流派', d: '十五個系；一個武將的兩個特性同系就會共鳴' },
      { k: 'fx', n: '依效果', d: '例如「雷法」「尋寶」：組一支特性隊' },
      { k: 'combo', n: '名組合', sub: `${COMBOS.length} 組`, d: '兩個特定的特性：同一人身上是絕技，隊裡兩人各有一個是合擊' },
      { k: 'ult', n: '神器錄', sub: `${ULT_IDS.filter((id) => got.has(id)).length}/${ULT_IDS.length}`, d: '寶箱、戰鬥、洞主極少掉落；隊伍的尋寶越高越容易' },
    ], { title: '特性圖鑑' });
    if (k == null) return;
    if (k === 'school') for (;;) {
      const s = await ui.choose(Object.entries(SCHOOLS).map(([s, [n]]) => ({ k: s, n: `${chip(s)} ${n}`, sub: `${TRAITS.filter((t) => t.s.includes(s)).length} 個`, d: `共鳴「${RESONANCE[s][0]}」：${fxOf(RESONANCE[s][1])}` })), { title: '依流派', cls: 'wide tall' });
      if (s == null) break; await traitList(game, TRAITS.filter((t) => t.s.includes(s)), `${SCHOOLS[s][0]}系`);
    }
    if (k === 'fx') for (;;) {
      const keys = [...new Set(TRAITS.flatMap((t) => Object.keys(t.fx).filter((x) => t.fx[x] > 0)))];
      const e = await ui.choose(keys.map((x) => ({ k: x, n: effName(x), sub: `${TRAITS.filter((t) => t.fx[x] > 0).length} 個` })), { title: '依效果', cls: 'wide tall' });
      if (e == null) break; await traitList(game, TRAITS.filter((t) => t.fx[e] > 0), `效果・${effName(e)}`);
    }
    if (k === 'combo') { let start = 0; for (;;) {
      const opts = COMBOS.map((c, i) => ({ k: i, n: `★ ${c[2]}`, sub: `${c[0]}＋${c[1]}`, d: `${fxOf(c[3])}　${c[4]}` }));
      const i = await ui.choose(opts, { title: '名組合', cls: 'wide tall', start }); if (i == null) break; start = i;
      const c = COMBOS[i], pick = await ui.choose([{ k: c[0], n: `看「${c[0]}」` }, { k: c[1], n: `看「${c[1]}」` }], { title: c[2] }); if (pick) await traitPage(game, TRAIT[pick]);
    } }
    if (k === 'ult') await ui.panel(ULT_IDS.map((id) => { const R = RELICS[id]; return `<div class="eq-d"><b style="color:${got.has(id) ? GRADE_C[6] : '#8a7a70'}">${R.n}</b>　<small>神器・${SLOT_N[R.slot]}　${got.has(id) ? '★ 已取得' : '未取得'}</small><p class="dim">${R.d}</p><p>${powerLines({ id, lv: 1 }).map((l) => `【${l.n}】${l.d}`).join('　')}</p></div>`; }).join(''), { title: `神器錄　${ULT_IDS.filter((id) => got.has(id)).length}/${ULT_IDS.length}`, cls: 'wide' });
  }
}
