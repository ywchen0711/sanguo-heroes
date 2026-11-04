// The screens around the game: the title, choosing a scenario, how many years and which general to be, the status of
// the party, the chronicle, the map of the realm, missions, the minimap, and the reckoning at the end.
import { SCENARIOS } from './data/scenarios.js';
import { newGame, citiesOf, gensOf, power } from './sim/engine.js';
import { fmt, dateStr, itemName } from './sim/text.js';
import { CITY_POS, W, H, T } from './world.js';
import { personSheet, frameCanvas, lookFor } from './sprites.js';
import { RANKS, rankOf, solMax, spMax, bstats, EQUIP, score, expNeed, tacticsOf, TACTICS, STAT_N } from './hero.js';

const BEST = 'sanguo-heroes-best';
export class Screens {
  constructor(game) { this.g = game; }
  get ui() { return this.g.ui; }
  // ---------------------------------------------------------------- title
  async title() {
    this.g.mode = 'title'; document.body.classList.remove('playing');
    const el = document.getElementById('title'); el.classList.add('on');
    let best = null; try { best = JSON.parse(localStorage.getItem(BEST) || 'null'); } catch (e) {}
    el.querySelector('.t-best').innerHTML = best ? `最佳紀錄：${best.name}　${best.total} 分「${best.title}」` : '';
    const k = await this.ui.choose([...(this.g.hasSave() ? [{ k: 'load', n: '繼續遊戲' }] : []), { k: 'new', n: '新的天下' }, { k: 'help', n: '遊戲說明' }], { host: el.querySelector('.t-menu'), cls: 'title-menu', noBack: true });
    if (k === 'help') { await this.help(); return this.title(); }
    if (k === 'load') { el.classList.remove('on'); try { this.g.loadGame(); } catch (e) { console.error(e); this.ui.toast('讀檔失敗'); return this.title(); } return; }
    const o = await this.setup(); if (!o) return this.title();
    el.classList.remove('on'); this.g.start(o);
  }
  async help() {
    await this.ui.panel(`<p><b>三國英傑傳</b>：扮演三國時代的任何一位武將。天下會自己運轉：群雄征戰、外交、內政、武將生老病死，每個月都在改變。</p>
      <p>🗺 <b>大地圖</b>：走一步是一天，三十天是一個月。野外會遇到山賊、異族和猛獸。走進城池就能進城。</p>
      <p>🏯 <b>城裡</b>：太守府（仕官、內政、徵兵、任務）、武具店、道具店、客棧（休息、存檔）、酒館（招募在野武將、打聽消息、尋寶、懸賞、募兵）、練兵場。和城裡的武將對話可以招募、切磋或挑戰生死決鬥。</p>
      <p>⚔ <b>戰鬥</b>：兵力就是武將的體力。攻擊、策略（看智力）、道具、一騎討（看武力）、撤退。</p>
      <p>👑 <b>改變歷史</b>：投靠明主立功升官，升為校尉就能率軍攻城；在野時名聲夠高，也能攻下城池自立為王。斬殺名將、攻陷城池、滅掉勢力，歷史就會改變。</p>
      <p>🏁 <b>結束</b>：選定的年數到了、天下統一、或是提前結算時，計算你一生的功績。</p>
      <p>操作：方向鍵／WASD 移動，Z／Enter 確認，X／Esc 取消，C 選單。手機用畫面上的按鈕。</p>`, { title: '遊戲說明' });
  }
  async setup() {
    const sc = await this.ui.choose(SCENARIOS.map((s) => ({ k: s.id, n: `${s.year}年　${s.name[0]}`, d: s.desc[0] })).concat([{ k: null, n: '← 返回' }]), { title: '選擇劇本', cls: 'wide' });
    if (!sc) return null;
    const years = await this.ui.choose([10, 20, 30, 50].map((y) => ({ k: y, n: `${y} 年`, d: y === 10 ? '短局：專心闖出一番名堂' : y === 50 ? '長局：看看天下最後歸誰' : '' })).concat([{ k: null, n: '← 返回' }]), { title: '遊戲時間' });
    if (!years) return this.setup();
    // the generals alive and of age when the scenario starts
    const seed = Date.now() & 0x7fffffff, G = newGame({ seed, scenario: sc });
    const pool = G.gens.filter((g) => (g.status === 'serving' || g.status === 'free') && !g.hidden);
    for (;;) {
      const how = await this.ui.choose([{ k: 'rand', n: '隨機武將' }, { k: 'famous', n: '從名將中挑選' }, { k: 'faction', n: '依勢力挑選' }, { k: 'search', n: '搜尋名字' }, { k: null, n: '← 返回' }], { title: '扮演哪一位武將？' });
      if (!how) return this.setup();
      let pid = null;
      if (how === 'rand') pid = pool[Math.floor(Math.random() * pool.length)].id;
      if (how === 'famous') pid = await this.pickGen(G, pool.slice().sort((a, b) => tot(b) - tot(a)).slice(0, 80), '名將');
      if (how === 'faction') { const fs = Object.values(G.factions).filter((f) => f.alive); const fid = await this.ui.choose([...fs.map((f) => ({ k: f.id, n: `<span style="color:${f.color}">■</span> ${f.name}軍`, sub: `${citiesOf(G, f.id).length} 城　${gensOf(G, f.id).length} 人` })), { k: '-', n: '在野武將' }, { k: null, n: '← 返回' }], { title: '勢力' }); if (fid) pid = await this.pickGen(G, pool.filter((g) => fid === '-' ? g.status === 'free' : g.fac === fid).sort((a, b) => tot(b) - tot(a)), fid === '-' ? '在野' : G.factions[fid].name + '軍'); }
      if (how === 'search') { const q = prompt('輸入武將名字（例如：趙雲）'); if (q) { const hits = pool.filter((g) => g.name.includes(q.trim())); if (!hits.length) { this.ui.toast('找不到這位武將（可能還沒出生，或已經去世）'); continue; } pid = await this.pickGen(G, hits, '搜尋結果'); } }
      if (pid == null) continue;
      const g = G.gens[pid], f = g.status === 'serving' && G.factions[g.fac];
      const ok = await this.ui.ask(`${g.name}　${G.year - g.born}歲\n${f ? `${f.name}軍${f.lord === g.id ? '・君主' : ''}` : '在野'}　所在：${G.cities[g.city].name}\n統率 ${g.lead}　武力 ${g.war}　智力 ${g.int}　政治 ${g.pol}　魅力 ${g.cha}`, [{ k: true, n: '就是他了' }, { k: false, n: '重新選擇' }], g.name, lookFor(g, f ? f.color : '#7a6a5a'));
      if (ok) return { scenario: sc, years, pid, seed };
    }
  }
  pickGen(G, list, title) {
    return this.ui.choose(list.map((g) => { const f = g.status === 'serving' && G.factions[g.fac]; return { k: g.id, n: g.name, sub: `統${g.lead} 武${g.war} 智${g.int} 政${g.pol} 魅${g.cha}`, d: `${G.year - g.born}歲　${f ? f.name + '軍' + (f.lord === g.id ? '・君主' : '') : '在野'}　${G.cities[g.city].name}` }; }).concat([{ k: null, n: '← 返回' }]), { title: `${title}（${list.length}）`, cls: 'wide tall' });
  }
  // ---------------------------------------------------------------- status of a general
  async status(id) {
    const G = this.g.G, H = this.g.H, ids = id != null ? [id] : [H.pid, ...H.party];
    const html = ids.map((gid) => {
      const g = G.gens[gid], r = H.rec[gid], st = bstats(g, r), look = this.g.lookOf(g), img = frameCanvas(personSheet(look), 0, 1).toDataURL();
      const items = G.items.filter((it) => it.holder === gid).map((it) => `${itemName(it.key)}（${Object.entries(it.fx).map(([k, v]) => STAT_N[k] + '+' + v).join(' ')}）`);
      const tac = tacticsOf(g).map((k) => TACTICS[k].n);
      return `<div class="st-card"><img src="${img}"><div><h3>${g.name}　<small>Lv ${r.lv}　${G.year - g.born}歲</small></h3>
        <div class="st-grid"><span>統率 <b>${g.lead}</b></span><span>武力 <b>${g.war}</b></span><span>智力 <b>${g.int}</b></span><span>政治 <b>${g.pol}</b></span><span>魅力 <b>${g.cha}</b></span></div>
        <div>兵力 ${r.sol}/${solMax(g, r)}　策略 ${r.sp}/${spMax(g, r)}　經驗 ${r.exp}/${expNeed(r.lv)}</div>
        <div>攻擊 ${Math.round(st.atk)}　防禦 ${Math.round(st.def)}　速度 ${Math.round(st.spd)}</div>
        <div>裝備：${['w', 'a', 'h'].map((k) => r.eq[k] ? EQUIP[r.eq[k]].n : '—').join('／')}</div>
        ${items.length ? `<div>寶物：${items.join('、')}</div>` : ''}<div class="dim">策略：${tac.join('、') || '無'}</div>
        ${gid === H.pid ? `<div>功績 ${g.merit}　名聲 ${H.fame}　${this.g.rank()}　戰績 ${H.st.wins} 勝／一騎討 ${H.st.duels} 勝／討取 ${H.st.kills.length} 將／攻城 ${H.st.cities.length}</div>` : ''}</div></div>`;
    }).join('');
    await this.ui.panel(html, { title: '狀態', cls: 'wide' });
  }
  async missions() {
    const G = this.g.G, H = this.g.H, open = H.missions.filter((m) => !m.done);
    await this.ui.panel(open.length ? open.map((m) => `<p><b>${m.boss}</b>　${G.cities[m.city].name}附近（地圖座標 ${m.x}, ${m.z}）　報酬 ${m.gold} 金${m.official ? `、功績 ${m.merit}` : ''}</p>`).join('') + '<p class="dim">黑色旗子標示在大地圖和小地圖上。</p>' : '<p>沒有進行中的任務。到太守府或酒館的懸賞告示接任務。</p>', { title: '任務' });
  }
  async news() {
    const G = this.g.G, list = G.log.slice(-160).reverse().filter((e) => e.level >= 1);
    await this.ui.panel(list.map((e) => `<p class="lv${e.level}"><small>${dateStr(e.year, e.month)}</small>　${fmt(e)}</p>`).join(''), { title: '年表', cls: 'wide' });
  }
  // the realm: a map of who holds what, and the warlords ranked
  async realm() {
    const G = this.g.G, fs = Object.values(G.factions).filter((f) => f.alive && citiesOf(G, f.id).length).sort((a, b) => citiesOf(G, b.id).length - citiesOf(G, a.id).length);
    const list = fs.map((f) => `<div class="rf"><i style="background:${f.color}"></i><b>${f.name}</b><span>${citiesOf(G, f.id).length} 城</span><span>${gensOf(G, f.id).length} 將</span><span>兵 ${citiesOf(G, f.id).reduce((s, c) => s + c.troops, 0)}</span></div>`).join('');
    await this.ui.panel(`<div class="realm"><canvas width="400" height="400"></canvas><div class="rlist">${list}</div></div>`, { title: `天下　${dateStr(G.year, G.month)}`, cls: 'wide', onOpen: (box) => this.drawMap(box.querySelector('canvas'), 2, true) });
  }
  drawMap(cv, k, big) {
    const G = this.g.G, M = this.g.world, x = cv.getContext('2d');
    // the land itself is drawn once and kept
    if (!this.base) { const img = new ImageData(W, H), C = { 0: [46, 96, 160], 1: [70, 130, 190], 2: [120, 160, 80], 3: [110, 150, 72], 4: [60, 110, 60], 5: [140, 140, 90], 6: [130, 120, 110], 7: [230, 236, 240], 8: [210, 180, 120], 9: [190, 170, 130], 10: [150, 110, 70], 11: [200, 190, 170], 12: [220, 210, 160], 13: [90, 120, 90], 14: [160, 170, 80] };
      for (let i = 0; i < W * H; i++) { const c = C[M.t[i]], j = i * 4; img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255; }
      this.base = document.createElement('canvas'); this.base.width = W; this.base.height = H; this.base.getContext('2d').putImageData(img, 0, 0); }
    x.imageSmoothingEnabled = false; x.drawImage(this.base, 0, 0, cv.width, cv.height);
    const s = cv.width / W;
    // territory: a soft disc of the owner's colour round each city
    for (const c of CITY_POS) { const o = G.cities[c.id].owner, f = o && G.factions[o]; if (!f) continue; x.fillStyle = f.color + '55'; x.beginPath(); x.arc(c.x * s, c.y * s, (big ? 9 : 7) * s, 0, Math.PI * 2); x.fill(); }
    for (const c of CITY_POS) { const o = G.cities[c.id].owner, f = o && G.factions[o]; x.fillStyle = f ? f.color : '#ddd'; x.strokeStyle = '#000'; x.lineWidth = 1; x.fillRect(c.x * s - 3, c.y * s - 3, 6, 6); x.strokeRect(c.x * s - 3, c.y * s - 3, 6, 6); if (big) { x.fillStyle = '#fff'; x.font = '10px sans-serif'; x.strokeStyle = '#000'; x.lineWidth = 2.5; x.strokeText(G.cities[c.id].name, c.x * s + 5, c.y * s + 4); x.fillText(G.cities[c.id].name, c.x * s + 5, c.y * s + 4); } }
    for (const m of this.g.H.missions.filter((m) => !m.done)) { x.fillStyle = '#111'; x.fillRect(m.x * s - 2, m.z * s - 2, 4, 4); }
    const P = this.g.pos, px = P.town != null ? CITY_POS[P.town].x : P.x, pz = P.town != null ? CITY_POS[P.town].y : P.z;
    x.fillStyle = '#ffec4a'; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.arc(px * s, pz * s, big ? 5 : 3.5, 0, Math.PI * 2); x.fill(); x.stroke();
  }
  minimap() { const cv = document.getElementById('minimap'); if (!cv || !this.g.world) return; this.drawMap(cv, 1, false); }
  // ---------------------------------------------------------------- the end: what happened to the realm, and what you did in it
  async ending() {
    const G = this.g.G, H = this.g.H, g = G.gens[H.pid];
    this.g.mode = 'end'; this.g.locked = true;
    const sc = score(G, H);
    const fs = Object.values(G.factions).filter((f) => f.alive && citiesOf(G, f.id).length).sort((a, b) => citiesOf(G, b.id).length - citiesOf(G, a.id).length);
    const realm = G.over && G.over !== 'time' ? `<p class="big">${G.factions[G.over].name}統一了天下！</p>` : `<p class="big">${G.year}年，天下仍未統一。</p><p>${fs.slice(0, 5).map((f) => `<span style="color:${f.color}">■</span>${f.name}（${citiesOf(G, f.id).length} 城）`).join('　')}</p>`;
    const rows = sc.rows.map(([n, v, p]) => `<tr><td>${n}</td><td>${v}</td><td>${p >= 0 ? '+' : ''}${p}</td></tr>`).join('');
    const kills = H.st.kills.length ? `<p>討取：${H.st.kills.join('、')}</p>` : '', cities = H.st.cities.length ? `<p>攻陷：${H.st.cities.join('、')}</p>` : '';
    let best = null; try { best = JSON.parse(localStorage.getItem(BEST) || 'null'); } catch (e) {}
    if (!best || sc.total > best.total) { try { localStorage.setItem(BEST, JSON.stringify({ name: g.name, total: sc.total, title: sc.title })); } catch (e) {} }
    try { localStorage.removeItem('sanguo-heroes-save-v1'); } catch (e) {}
    await this.ui.panel(`${realm}<h3>${g.name}的一生</h3><table class="score">${rows}<tr class="tot"><td>總計</td><td></td><td>${sc.total}</td></tr></table><p class="big">評價：「${sc.title}」</p>${kills}${cities}<p class="dim">按確定回到標題畫面。</p>`, { title: '功績結算', cls: 'wide' });
    location.reload();
  }
}
const tot = (g) => g.lead + g.war + g.int + g.pol + g.cha;
