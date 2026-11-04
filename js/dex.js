// The encyclopedia of generals (武將圖鑑): everyone you have met (見), fought (戰) or had at your side (收), with what
// history says of them. How full it is counts at the end.
import { BIOS } from './data/bios.js';
import { itemName } from './sim/text.js';
import { frameCanvas, personSheet } from './sprites.js';
import { checkTitles } from './deeds.js';

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
      <p class="bio">${b.t}</p></div></div>`, { title: '武將圖鑑', cls: 'wide' });
  }
}
