// The equipment screen: the party on the left, the chosen general's four slots and numbers in the middle, and the bag
// on the right with what each piece would change. Arrow keys move, Z chooses, X goes back; the mouse works too.
import { personSheet, frameCanvas } from './sprites.js';
import { bstats, solMax, spMax, forgeOf } from './hero.js';
import { itemOf, isRelic, relicFx, powerLines, bagFor, wear, nextExp, RELICS, POWERS, GRADE_N, GRADE_C, SLOT_N } from './relics.js';

const SLOTS = ['w', 'a', 'h', 'x'];
const STATS = [['atk', '攻擊'], ['def', '防禦'], ['spd', '速度'], ['int', '智力'], ['sol', '兵力上限'], ['sp', '策略上限']];
function numbers(g, rec) { const b = bstats(g, rec); return { atk: Math.round(b.atk), def: Math.round(b.def), spd: Math.round(b.spd), int: Math.round(b.int), sol: solMax(g, rec), sp: spMax(g, rec) }; }
// what the numbers would be with entry e in slot k
function tryOn(rec, k, e) { const r2 = { ...rec, eq: { ...rec.eq, [k]: e ? (e.sid ? e.sid : { id: e.id, lv: e.lv || 1, exp: e.exp || 0 }) : null }, forge: { ...(rec.forge || {}), [k]: e ? e.forge || 0 : 0 } }; return r2; }
function pieceHTML(e, forge) {
  const it = itemOf(e); if (!it) return '<span class="dim">（空）</span>';
  return `<b style="color:${it.color}">${it.n}</b>${it.lv > 1 ? `<small> Lv${it.lv}</small>` : ''}${forge ? `<small> +${forge}</small>` : ''}`;
}
function infoHTML(e) {
  const it = itemOf(e); if (!it) return '';
  if (it.shop) return `<div class="eq-d"><b>${it.n}</b>　<small>${SLOT_N[it.slot]}・商店貨</small><p>${{ w: '攻擊', a: '防禦', h: '速度' }[it.slot]} +${it.v}</p></div>`;
  const R = it.R, nx = nextExp(e);
  return `<div class="eq-d"><b style="color:${it.color}">${it.n}</b>　<small>${GRADE_N[R.grade]}・${SLOT_N[R.slot]}　Lv${it.lv}${nx ? `（經驗 ${e.exp || 0}/${nx}）` : '（最高）'}</small>
    <p class="dim">${R.d}</p><p>${R.slot === 'x' ? `${{ int: '智力', war: '武力', lead: '統率', cha: '魅力', pol: '政治' }[R.stat]} +${it.v}` : `${{ w: '攻擊', a: '防禦', h: '速度' }[R.slot]} +${it.v}`}</p>
    ${powerLines(e).map((l) => `<p class="pw">【${l.n}】${l.d}</p>`).join('')}</div>`;
}
export async function equipScreen(game, start = 0) {
  const ui = game.ui, H = game.H;
  let col = 0, mi = Math.min(start, game.partyList().length - 1), si = 0, bi = 0;
  return ui.panel('<div class="eqs"></div>', { title: '裝備', cls: 'wide eq-panel', keepOk: true,
    onOpen: (box) => { const root = box.querySelector('.eqs'), list = () => game.partyList();
      const draw = () => {
        const L = list(), p = L[mi], rec = p.rec, slot = SLOTS[si], bag = bagFor(H, slot);
        const opts = col === 2 ? [null, ...bag] : [];
        const pre = col === 2 ? tryOn(rec, slot, opts[bi]) : null, now = numbers(p.g, rec), then = pre && numbers(p.g, pre);
        const powers = (r) => { const fx = relicFx(r), o = []; for (const k in POWERS) if (fx[k]) o.push(POWERS[k][2](fx[k])); return o; };
        root.innerHTML = `
          <div class="eqs-col eqs-party${col === 0 ? ' on' : ''}">${L.map((q, i) => `<div class="eqs-it${i === mi ? ' sel' : ''}" data-m="${i}"><img src="${frameCanvas(personSheet(q.look), 0, 1).toDataURL()}"><span>${q.g.name}<small>Lv${q.rec.lv}</small></span></div>`).join('')}</div>
          <div class="eqs-col eqs-main${col === 1 ? ' on' : ''}">
            <div class="eqs-head"><img src="${frameCanvas(personSheet(p.look), 0, 1).toDataURL()}"><div><h3>${p.g.name}</h3><div class="eqs-stats">${STATS.map(([k, n]) => { const dv = then ? then[k] - now[k] : 0; return `<span>${n} <b>${then ? then[k] : now[k]}</b>${dv ? `<em class="${dv > 0 ? 'up' : 'dn'}">${dv > 0 ? '▲' : '▼'}${Math.abs(dv)}</em>` : ''}</span>`; }).join('')}</div></div></div>
            ${SLOTS.map((k, i) => `<div class="eqs-it slot${i === si && col >= 1 ? ' sel' : ''}" data-s="${i}"><i>${SLOT_N[k]}</i>${pieceHTML(rec.eq?.[k], forgeOf(rec, k))}</div>`).join('')}
            <div class="eqs-pw"><h4>妙用</h4>${powers(pre || rec).map((t) => `<p>${t}</p>`).join('') || '<p class="dim">沒有寶物的特殊效果。</p>'}</div>
          </div>
          <div class="eqs-col eqs-bag${col === 2 ? ' on' : ''}">
            <h4>背包・${SLOT_N[slot]}（${bag.length}）</h4>
            ${col === 2 ? opts.map((e, i) => `<div class="eqs-it${i === bi ? ' sel' : ''}" data-b="${i}">${e ? pieceHTML(e, e.forge) : '<span class="dim">卸下</span>'}${e && isRelic(e) ? `<small class="g" style="color:${GRADE_C[RELICS[e.id].grade]}">${GRADE_N[RELICS[e.id].grade]}</small>` : ''}</div>`).join('') : bag.slice(0, 12).map((e) => `<div class="eqs-it dim">${pieceHTML(e, e.forge)}</div>`).join('') || '<p class="dim">沒有可以換的東西。<br>寶物可以在洞穴、戰鬥、任務和大城的寶物商人那裡得到。</p>'}
            <div class="eqs-info">${col === 2 ? (opts[bi] ? infoHTML(opts[bi]) : '<p class="dim">把這個部位的裝備卸下，放回背包。</p>') : infoHTML(rec.eq?.[slot])}</div>
          </div>
          <div class="eqs-help">↑↓ 選擇　→ / Z 決定　← / X 返回</div>`;
        root.querySelector('.eqs-bag .sel')?.scrollIntoView({ block: 'nearest' });
      };
      const choose = () => {
        const L = list(), p = L[mi], slot = SLOTS[si];
        if (col === 0) { col = 1; si = 0; }
        else if (col === 1) { col = 2; bi = 0; }
        else { const bag = bagFor(H, slot), e = [null, ...bag][bi]; if (e || p.rec.eq?.[slot]) { wear(H, p.rec, slot, e); p.rec.sol = Math.min(p.rec.sol, solMax(p.g, p.rec)); p.rec.sp = Math.min(p.rec.sp, spMax(p.g, p.rec)); game.audio?.sfx('ok'); } col = 1; game.hud(); }
        draw();
      };
      const back = () => { if (col === 0) return false; col--; draw(); return true; };
      const move = (d) => {
        const L = list();
        if (col === 0) mi = (mi + d + L.length) % L.length; else if (col === 1) si = (si + d + 4) % 4; else { const n = bagFor(H, SLOTS[si]).length + 1; bi = (bi + d + n) % n; }
        game.audio?.sfx('move'); draw();
      };
      box._eq = { choose, back, move };
      root.addEventListener('click', (ev) => {
        const el = ev.target.closest('[data-m],[data-s],[data-b]'); if (!el) return;
        if (el.dataset.m != null) { mi = +el.dataset.m; col = 0; choose(); }
        else if (el.dataset.s != null) { si = +el.dataset.s; col = 1; choose(); }
        else { bi = +el.dataset.b; col = 2; choose(); }
      });
      draw();
    },
    onKey: (k, box) => { const E = box._eq; if (!E) return; if (k === 'up') E.move(-1); if (k === 'down') E.move(1); if (k === 'ok' || k === 'right') E.choose(); if (k === 'left') E.back(); },
    onBack: (box) => box._eq?.back() });
}
