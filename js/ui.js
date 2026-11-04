// Menus, dialogue boxes, toasts, the HUD and the panels, all in the DOM over the 3D view. Every menu works with the
// keyboard (arrows, Z / Enter to choose, X / Esc to go back), the mouse and touch.
import { personSheet, frameCanvas } from './sprites.js';

export class UI {
  constructor(game) {
    this.game = game; this.stack = [];
    this.layer = document.getElementById('ui');
    addEventListener('keydown', (e) => {
      const top = this.stack[this.stack.length - 1]; if (!top) return;
      const k = e.key; const map = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', Enter: 'ok', z: 'ok', Z: 'ok', ' ': 'ok', Escape: 'back', x: 'back', X: 'back', Backspace: 'back' };
      if (map[k]) { e.preventDefault(); e.stopImmediatePropagation(); top(map[k]); }
    }, true);
  }
  get busy() { return this.stack.length > 0; }
  push(fn) { this.stack.push(fn); }
  pop(fn) { this.stack = this.stack.filter((x) => x !== fn); }
  key(k) { const top = this.stack[this.stack.length - 1]; if (top) top(k); }
  // ---------------------------------------------------------------- a list to choose from: opts [{ k, n, sub, d, off }]; resolves k (or null for back)
  choose(opts, o = {}) {
    return new Promise((res) => {
      const host = o.host || this.layer, box = document.createElement('div'); box.className = 'menu ' + (o.cls || '');
      let sel = Math.max(0, opts.findIndex((x, i) => !x.off && i >= (o.start || 0)));
      const draw = () => {
        box.innerHTML = `${o.title ? `<div class="m-title">${o.title}</div>` : ''}<div class="m-list">${opts.map((x, i) => `<div class="m-it${i === sel ? ' sel' : ''}${x.off ? ' off' : ''}" data-i="${i}"><span>${x.n}</span>${x.sub != null ? `<small>${x.sub}</small>` : ''}</div>`).join('')}</div>${opts[sel]?.d ? `<div class="m-desc">${opts[sel].d}</div>` : o.info ? `<div class="m-desc">${o.info(sel) || ''}</div>` : ''}`;
        box.querySelectorAll('.m-it').forEach((el) => { el.onclick = () => { const i = +el.dataset.i; if (opts[i].off) return; if (sel === i || !o.info) done(opts[i].k); else { sel = i; draw(); o.hover?.(sel); } }; el.onmouseenter = () => { const i = +el.dataset.i; if (i !== sel && !('ontouchstart' in window)) { sel = i; draw(); o.hover?.(sel); } }; });
        box.querySelector('.m-it.sel')?.scrollIntoView({ block: 'nearest' });
      };
      const move = (d) => { if (!opts.length) return; let i = sel; for (let n = 0; n < opts.length; n++) { i = (i + d + opts.length) % opts.length; if (!opts[i].off) break; } sel = i; draw(); o.hover?.(sel); this.game.audio?.sfx('move'); };
      const done = (v) => { this.pop(h); box.remove(); this.game.audio?.sfx(v == null ? 'cancel' : 'ok'); res(v); };
      const h = (k) => { if (k === 'up') move(-1); if (k === 'down') move(1); if (k === 'left' && o.lr) o.lr(-1, sel, done); if (k === 'right' && o.lr) o.lr(1, sel, done); if (k === 'ok' && opts[sel] && !opts[sel].off) done(opts[sel].k); if (k === 'back' && !o.noBack) done(null); };
      this.push(h); host.appendChild(box); draw(); o.hover?.(sel);
      if (o.onOpen) o.onOpen(box, done);
    });
  }
  // ---------------------------------------------------------------- dialogue: a name, a portrait, and text that types itself out
  say(name, text, look) {
    return new Promise((res) => {
      const box = document.createElement('div'); box.className = 'talk';
      const port = look ? this.portrait(look) : '';
      box.innerHTML = `${port}<div class="t-body">${name ? `<div class="t-name">${name}</div>` : ''}<div class="t-text"></div><i class="t-more">▼</i></div>`;
      this.layer.appendChild(box);
      const el = box.querySelector('.t-text'), chars = [...text]; let n = 0, full = false;
      const tick = setInterval(() => { n += 2; el.innerHTML = chars.slice(0, n).join('').replace(/\n/g, '<br>'); if (n >= chars.length) { clearInterval(tick); full = true; box.classList.add('done'); } }, 22);
      const h = (k) => { if (k !== 'ok' && k !== 'back') return; if (!full) { n = chars.length; return; } clearInterval(tick); this.pop(h); box.remove(); res(); };
      box.onclick = () => h('ok'); this.push(h);
    });
  }
  async yesno(q, name, look) { return (await this.ask(q, [{ k: true, n: '是' }, { k: false, n: '否' }], name, look)) === true; }
  async ask(q, opts, name, look) { const el = document.createElement('div'); el.className = 'talk done'; el.innerHTML = `${look ? this.portrait(look) : ''}<div class="t-body">${name ? `<div class="t-name">${name}</div>` : ''}<div class="t-text">${q.replace(/\n/g, '<br>')}</div></div>`; this.layer.appendChild(el); const r = await this.choose(opts, { cls: 'small yn' }); el.remove(); return r; }
  portrait(look) { const c = frameCanvas(personSheet(look), 0, 1); return `<img class="t-port" src="${c.toDataURL()}">`; }
  toast(html, ms = 2600) { const host = document.getElementById('toasts'); while (host.children.length >= 5) host.firstChild.remove(); const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; host.appendChild(t); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 500); }
  // ---------------------------------------------------------------- a full panel (status, chronicle, map …); resolves when closed
  panel(html, o = {}) {
    return new Promise((res) => {
      const box = document.createElement('div'); box.className = 'panel ' + (o.cls || ''); box.innerHTML = `<div class="p-head"><b>${o.title || ''}</b><span class="p-x">✕</span></div><div class="p-body">${html}</div>`;
      this.layer.appendChild(box);
      const body = box.querySelector('.p-body');
      const close = () => { this.pop(h); box.remove(); res(); };
      const h = (k) => { if (k === 'back' || (k === 'ok' && !o.keepOk)) close(); if (k === 'up') body.scrollTop -= 60; if (k === 'down') body.scrollTop += 60; if (o.onKey) o.onKey(k, box); };
      box.querySelector('.p-x').onclick = close; this.push(h); o.onOpen?.(box, close);
    });
  }
  fade(on, ms = 300) { const f = document.getElementById('fade'); f.style.transition = `opacity ${ms}ms`; f.style.opacity = on ? 1 : 0; return new Promise((r) => setTimeout(r, ms)); }
}
