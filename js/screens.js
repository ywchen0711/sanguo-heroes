// The screens around the game: the title, choosing a scenario, how many years and which general to be, the status of
// the party, the chronicle, the map of the realm, missions, the minimap, and the reckoning at the end.
import { SCENARIOS } from './data/scenarios.js';
import { newGame, citiesOf, gensOf, power } from './sim/engine.js';
import { fmt, dateStr, itemName } from './sim/text.js';
import { CITY_POS, W, H, T, K } from './world.js';
import { personSheet, frameCanvas, lookFor, assignLooks } from './sprites.js';
import { RANKS, rankOf, solMax, spMax, bstats, EQUIP, score, expNeed, tacticsOf, TACTICS, STAT_N, eqName, armsOf, TROOPS } from './hero.js';
import { biography, rewritten, knownAs, titleName, TITLES } from './deeds.js';
import { rivalH, rankIdx, RANK_N } from './sim/rivals.js';
import { isSworn, bondOf } from './bonds.js';
import { dexCount } from './dex.js';
import { traitsOf, traitHTML, actHTML, syncParty } from './traits.js';
import { fameHTML } from './fame.js';
import { govHTML } from './govern.js';
import { PERKS, perkText } from './hero.js';

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
      <p>🗺 <b>大地圖</b>：走十步是一天，三十天是一個月。野外會遇到山賊、異族和猛獸。走進城池就能進城。</p>
      <p>🏯 <b>城裡</b>：太守府（仕官、內政、徵兵、任務）、武具店、道具店、客棧（休息、存檔）、酒館（招募在野武將、打聽消息、尋寶、懸賞、募兵）、練兵場。和城裡的武將對話可以招募、切磋或挑戰生死決鬥。</p>
      <p>⚔ <b>戰鬥</b>：兵力就是武將的體力。攻擊、策略（看智力）、道具、一騎討（看武力）、撤退。</p>
      <p>👑 <b>改變歷史</b>：投靠明主立功升官，升為校尉就能率軍攻城；在野時名聲夠高，也能攻下城池自立為王。斬殺名將、攻陷城池、滅掉勢力，歷史就會改變。</p>
      <p>🤝 <b>人物</b>：和同伴並肩作戰、一起喝酒，好感到 100 就能結為兄弟。被同一個人打敗三次（或打敗他三次），他就是你的宿敵。你的所作所為會讓人們給你稱號，例如「萬人敵」「仁義之士」「三姓家奴」，稱號會改變別人對你的態度。</p>
      <p>⚔ <b>兵種與陣型</b>：騎兵克步兵、步兵克弓兵、弓兵克騎兵；水軍在水邊最強。地形也有影響。戰鬥中第一位武將的指令可以變換陣型，陣型之間也有相剋。名馬和神兵各有特殊能力；鐵匠可以用洞穴裡找到的礦石強化裝備。</p>
      <p>🌾 <b>天災</b>：蝗災、水災、瘟疫和地震會讓城池陷入困境。你可以開倉賑災、施粥救人，也可以趁機攻城。</p>
      <p>🧙 <b>奇人異士</b>：左慈、管輅、南華老仙四處雲遊，華佗和于吉也能幫你。酒館裡能打聽到他們的下落。</p>
      <p>📜 <b>史書</b>：歷史轉折點（宛城、下邳、官渡、孫策遇刺、赤壁、麥城、夷陵、五丈原……）你都可以插手。遊戲結束時，史官會為你寫一篇列傳。</p>
      <p>🏁 <b>結束</b>：選定的年數到了、天下統一、或是提前結算時，計算你一生的功績。</p>
      <p>操作：方向鍵／WASD 移動，Z／Enter 確認，X／Esc 取消，C 選單。手機用畫面上的按鈕。</p>
      <p>🤖 <b>電腦代玩</b>：按 P（或選單裡的「電腦代玩」）讓電腦替你玩，按方向鍵取回控制。</p>
      <p>🎖 <b>官階</b>：官階越高，帶兵越多、同伴越多。同勢力的武將可以邀請同行（交談或太守府的「點將」）。</p>
      <p>🎥 <b>自由視角</b>：用滑鼠拖曳畫面旋轉，滾輪縮放；或是 Q／E 旋轉、＋／－ 縮放、R 還原。手機用兩指旋轉、捏合縮放。方向鍵永遠照著畫面上的方向走。</p>`, { title: '遊戲說明' });
  }
  async setup() {
    const sc = await this.ui.choose(SCENARIOS.map((s) => ({ k: s.id, n: `${s.year}年　${s.name[0]}`, d: s.desc[0] })).concat([{ k: null, n: '← 返回' }]), { title: '選擇劇本', cls: 'wide' });
    if (!sc) return null;
    const years = await this.ui.choose([10, 20, 30, 50].map((y) => ({ k: y, n: `${y} 年`, d: y === 10 ? '短局：專心闖出一番名堂' : y === 50 ? '長局：看看天下最後歸誰' : '' })).concat([{ k: null, n: '← 返回' }]), { title: '遊戲時間' });
    if (!years) return this.setup();
    // the generals alive and of age when the scenario starts
    const seed = Date.now() & 0x7fffffff, G = newGame({ seed, scenario: sc });
    assignLooks(G.gens);
    const pool = G.gens.filter((g) => (g.status === 'serving' || g.status === 'free') && !g.hidden);
    for (;;) {
      const how = await this.ui.choose([{ k: 'rand', n: '隨機武將' }, { k: 'super', n: '超級武將', d: 'Jeff、Erin、Josh、Jasper：五項能力全部 100，各有名劍與法術' }, { k: 'famous', n: '從名將中挑選' }, { k: 'faction', n: '依勢力挑選' }, { k: 'search', n: '搜尋名字' }, { k: null, n: '← 返回' }], { title: '扮演哪一位武將？' });
      if (!how) return this.setup();
      let pid = null;
      if (how === 'rand') pid = pool[Math.floor(Math.random() * pool.length)].id;
      if (how === 'super') pid = await this.pickGen(G, G.gens.filter((g) => g.hidden && g.status === 'free'), '超級武將');
      if (how === 'famous') pid = await this.pickGen(G, pool.slice().sort((a, b) => tot(b) - tot(a)).slice(0, 80), '名將');
      if (how === 'faction') { const fs = Object.values(G.factions).filter((f) => f.alive); const fid = await this.ui.choose([...fs.map((f) => ({ k: f.id, n: `<span style="color:${f.color}">■</span> ${f.name}軍`, sub: `${citiesOf(G, f.id).length} 城　${gensOf(G, f.id).length} 人` })), { k: '-', n: '在野武將' }, { k: null, n: '← 返回' }], { title: '勢力' }); if (fid) pid = await this.pickGen(G, pool.filter((g) => fid === '-' ? g.status === 'free' : g.fac === fid).sort((a, b) => tot(b) - tot(a)), fid === '-' ? '在野' : G.factions[fid].name + '軍'); }
      if (how === 'search') { const q = prompt('輸入武將名字（例如：趙雲）'); if (q) { const hits = pool.filter((g) => g.name.includes(q.trim())); if (!hits.length) { this.ui.toast('找不到這位武將（可能還沒出生，或已經去世）'); continue; } pid = await this.pickGen(G, hits, '搜尋結果'); } }
      if (pid == null) continue;
      const g = G.gens[pid], f = g.status === 'serving' && G.factions[g.fac];
      const ok = await this.ui.ask(`${g.name}　${G.year - g.born}歲\n${f ? `${f.name}軍${f.lord === g.id ? '・君主' : ''}` : '在野'}　所在：${G.cities[g.city].name}\n統率 ${g.lead}　武力 ${g.war}　智力 ${g.int}　政治 ${g.pol}　魅力 ${g.cha}`, [{ k: true, n: '就是他了' }, { k: false, n: '重新選擇' }], g.name, lookFor(g, f ? f.color : '#7a6a5a'));
      if (!ok) continue;
      const rivals = await this.ui.choose([0, 3, 5, 8].map((n) => ({ k: n, n: n ? `${n} 位電腦對手` : '不要對手', d: n ? `另外 ${n} 位武將也由電腦扮演：和你一樣闖蕩、投靠明主、升官、攻城，甚至自立為王。最後比誰統一天下，或誰的功績最高。` : '只有你一位主角，天下照常運轉。' })), { title: '對手', noBack: true });
      const rivalHow = rivals ? await this.ui.choose([{ k: 'famous', n: '知名英雄', d: '從名將裡挑：曹操、劉備、孫權、呂布這些人物最常出現' }, { k: 'random', n: '隨機', d: '所有在世的武將都可能被選上，連無名小卒也會來爭天下' }], { title: '對手人選', noBack: true }) : null;
      return { scenario: sc, years, pid, seed, rivals, rivalHow };
    }
  }
  pickGen(G, list, title) {
    return this.ui.choose(list.map((g) => { const f = g.status === 'serving' && G.factions[g.fac]; return { k: g.id, n: g.name, sub: `統${g.lead} 武${g.war} 智${g.int} 政${g.pol} 魅${g.cha}`, d: `${G.year - g.born}歲　${f ? f.name + '軍' + (f.lord === g.id ? '・君主' : '') : '在野'}　${G.cities[g.city].name}` }; }).concat([{ k: null, n: '← 返回' }]), { title: `${title}（${list.length}）`, cls: 'wide tall' });
  }
  // ---------------------------------------------------------------- status of a general
  async status(id) {
    const G = this.g.G, H = this.g.H, ids = id != null ? [id] : [H.pid, ...H.party], PT = syncParty(this.g);
    const html = ids.map((gid) => {
      const g = G.gens[gid], r = H.rec[gid], st = bstats(g, r), look = this.g.lookOf(g), img = frameCanvas(personSheet(look), 0, 1).toDataURL();
      const items = G.items.filter((it) => it.holder === gid).map((it) => `${itemName(it.key)}（${Object.entries(it.fx).map(([k, v]) => STAT_N[k] + '+' + v).join(' ')}）`);
      const tac = tacticsOf(g).map((k) => TACTICS[k].n);
      return `<div class="st-card"><img src="${img}"><div><h3>${g.name}　<small>Lv ${r.lv}　${G.year - g.born}歲</small></h3>
        <div class="st-grid"><span>統率 <b>${g.lead}</b></span><span>武力 <b>${g.war}</b></span><span>智力 <b>${g.int}</b></span><span>政治 <b>${g.pol}</b></span><span>魅力 <b>${g.cha}</b></span></div>
        <div>兵力 ${r.sol}/${solMax(g, r)}　策略 ${r.sp}/${spMax(g, r)}　經驗 ${r.exp}/${expNeed(r.lv)}</div>
        <div>攻擊 ${Math.round(st.atk)}　防禦 ${Math.round(st.def)}　速度 ${Math.round(st.spd)}</div>
        <div>裝備：${['w', 'a', 'h', 'x'].map((k) => eqName(r, k)).join('／')}　兵種：${TROOPS[this.g.act.troopOf({ g, rec: r, look })].n}</div>
        <div class="traits">${traitsOf(g).map((n) => traitHTML(n)).join('')}</div>${actHTML(PT?.get(gid)?.act || [])}
        ${armsOf(G, g).list.map((A) => `<div class="arms">✦ ${A.n}：${A.d}</div>`).join('')}
        ${items.length ? `<div>寶物：${items.join('、')}</div>` : ''}<div class="dim">策略：${tac.join('、') || '無'}</div>
        ${gid !== H.pid ? `<div>${isSworn(H, gid) ? '<b style="color:#ffd86a">結義兄弟</b>' : `好感 ${bondOf(H, gid)}／100`}</div>` : ''}
        ${gid === H.pid && (H.titles || []).length ? `<div>稱號：${H.titles.map((t) => `「${titleName(t)}」`).join('')}</div>` : ''}${gid === H.pid && H.wound > G.t ? '<div style="color:#ff8a6a">負傷中（攻擊、防禦 -15%）</div>' : ''}
        ${gid === H.pid ? `${fameHTML(H)}${govHTML(this.g)}<div class="dim">${this.g.rank()}${this.g.perk().noble ? `・${this.g.perk().noble}` : ''}：${perkText(this.g.perk())}${g.status === 'serving' && !this.g.isLord() && RANKS[rankOf(g.merit) + 1] ? `<br>下一級「${RANKS[rankOf(g.merit) + 1][0]}」還要功績 ${RANKS[rankOf(g.merit) + 1][1] - g.merit}` : ''}</div>` : ''}
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
  // the player and the computer players, ranked by the same reckoning as the end
  board(end) {
    const G = this.g.G, H = this.g.H; if (!(G.rivals || []).length) return '';
    const withTitles = (R) => { const RH = rivalH(G, R), g = G.gens[R.id], fake = { G, isLord: () => g.status === 'serving' && G.factions[g.fac]?.lord === g.id, myFaction: () => (g.status === 'serving' ? g.fac : null) }; RH.titles = TITLES.filter((t) => { try { return t.ok(RH, fake); } catch (e) { return false; } }).map((t) => t.id); return RH; };
    const rows = [{ me: true, g: G.gens[H.pid], sc: score(G, H), H }, ...G.rivals.map((R) => { const RH = withTitles(R); return { g: G.gens[R.id], sc: score(G, RH), R, RH }; })].sort((a, b) => b.sc.total - a.sc.total);
    const what = (x) => { const g = x.g, f = g.status === 'serving' && G.factions[g.fac]; if (g.status === 'dead') return '已故'; if (!f) return '在野'; if (f.lord === g.id) return `${f.name}軍之主（${citiesOf(G, f.id).length} 城）`; return `${f.name}軍・${RANK_N[rankIdx(g.merit)]}`; };
    const st = (x) => x.me ? x.H.st : x.R.st;
    return `<h3>${end ? '最終排名' : '群雄榜'}</h3><table class="score board">${rows.map((x, i) => `<tr class="${x.me ? 'me' : ''}"><td>${i + 1}</td><td><b>${x.g.name}</b>${x.me ? '（你）' : ''}</td><td>${what(x)}</td><td>Lv ${x.me ? x.H.rec[x.H.pid].lv : x.R.lv || 1}　勝 ${st(x).wins}　城 ${st(x).cities.length}　斬 ${st(x).kills.length}${(x.me ? x.H.titles : x.RH.titles)?.length ? `　稱號 ${(x.me ? x.H.titles : x.RH.titles).length}` : ''}</td><td>${x.sc.total} 分</td><td>${x.sc.title}</td></tr>`).join('')}</table>`;
  }
  async rivals() { await this.ui.panel(this.board(false) + '<p class="dim">對手和你用同樣的方式計分。對手的大事會出現在年表和消息裡。</p>', { title: '群雄榜', cls: 'wide' }); }
  // the realm: a map of who holds what, and the warlords ranked
  async realm() {
    const G = this.g.G, fs = Object.values(G.factions).filter((f) => f.alive && citiesOf(G, f.id).length).sort((a, b) => citiesOf(G, b.id).length - citiesOf(G, a.id).length);
    const list = fs.map((f) => `<div class="rf"><i style="background:${f.color}"></i><b>${f.name}</b><span>${citiesOf(G, f.id).length} 城</span><span>${gensOf(G, f.id).length} 將</span><span>兵 ${citiesOf(G, f.id).reduce((s, c) => s + c.troops, 0)}</span></div>`).join('');
    await this.ui.panel(`<div class="realm"><canvas width="400" height="400"></canvas><div class="rlist">${list}</div></div>`, { title: `天下　${dateStr(G.year, G.month)}`, cls: 'wide', onOpen: (box) => this.drawMap(box.querySelector('canvas'), 2, true) });
  }
  drawMap(cv, k, big) {
    const G = this.g.G, M = this.g.world, x = cv.getContext('2d');
    // the land itself is drawn once and kept
    if (!this.base) { const img = new ImageData(W, H), C = { 0: [46, 96, 160], 1: [70, 130, 190], 2: [120, 160, 80], 3: [110, 150, 72], 4: [60, 110, 60], 5: [140, 140, 90], 6: [130, 120, 110], 7: [230, 236, 240], 8: [210, 180, 120], 9: [190, 170, 130], 10: [150, 110, 70], 11: [200, 190, 170], 12: [220, 210, 160], 13: [90, 120, 90], 14: [160, 170, 80], 15: [230, 220, 200], 16: [200, 150, 90], 17: [40, 30, 30] };
      for (let i = 0; i < W * H; i++) { const c = C[M.t[i]], j = i * 4; img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255; }
      this.base = document.createElement('canvas'); this.base.width = W; this.base.height = H; this.base.getContext('2d').putImageData(img, 0, 0); }
    x.imageSmoothingEnabled = false; x.drawImage(this.base, 0, 0, cv.width, cv.height);
    const s = cv.width / W;
    // territory: a soft disc of the owner's colour round each city
    for (const c of CITY_POS) { const o = G.cities[c.id].owner, f = o && G.factions[o]; if (!f) continue; x.fillStyle = f.color + '55'; x.beginPath(); x.arc(c.x * s, c.y * s, (big ? 9 : 7) * K * s, 0, Math.PI * 2); x.fill(); }
    for (const c of CITY_POS) { const o = G.cities[c.id].owner, f = o && G.factions[o]; x.fillStyle = f ? f.color : '#ddd'; x.strokeStyle = '#000'; x.lineWidth = 1; x.fillRect(c.x * s - 3, c.y * s - 3, 6, 6); x.strokeRect(c.x * s - 3, c.y * s - 3, 6, 6); if (big) { x.fillStyle = '#fff'; x.font = '10px sans-serif'; x.strokeStyle = '#000'; x.lineWidth = 2.5; x.strokeText(G.cities[c.id].name, c.x * s + 5, c.y * s + 4); x.fillText(G.cities[c.id].name, c.x * s + 5, c.y * s + 4); } }
    if (big) for (const q of M.places) { x.fillStyle = q.kind === 'county' ? '#f0e8d0' : q.kind === 'village' ? '#c8955a' : this.g.H.places?.[q.id]?.boss ? '#6a6a6a' : '#1a1010'; x.strokeStyle = '#000'; x.lineWidth = 1; if (q.kind === 'cave') { x.beginPath(); x.moveTo(q.x * s, q.y * s - 3); x.lineTo(q.x * s + 3, q.y * s + 2); x.lineTo(q.x * s - 3, q.y * s + 2); x.closePath(); x.fill(); x.stroke(); } else { x.beginPath(); x.arc(q.x * s, q.y * s, q.kind === 'county' ? 2.5 : 1.8, 0, Math.PI * 2); x.fill(); x.stroke(); } }
    for (const m of this.g.H.missions.filter((m) => !m.done)) { x.fillStyle = '#111'; x.fillRect(m.x * s - 2, m.z * s - 2, 4, 4); }
    this.g.board?.marks(x, s); this.g.crowd?.marks(x, s); this.g.camps?.marks(x, s); this.g.outlaws?.marks(x, s); this.g.horses?.marks(x, s); this.g.roam?.marks(x, s);
    // where the party is: in a town, the town; on the land, where it is now (part-way through a step, too)
    const P = this.g.pos, tp = this.g.town?.C?.pos, px = P.town != null ? CITY_POS[P.town].x : tp ? tp.x : this.g.mode === 'world' ? P.fx ?? P.x : P.x, pz = P.town != null ? CITY_POS[P.town].y : tp ? tp.y : this.g.mode === 'world' ? P.fz ?? P.z : P.z;
    x.fillStyle = '#ffec4a'; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.arc(px * s, pz * s, big ? 5 : 3.5, 0, Math.PI * 2); x.fill(); x.stroke();
  }
  minimap() { const cv = document.getElementById('minimap'); if (!cv || !this.g.world) return; this.drawMap(cv, 1, false); }
  // ---------------------------------------------------------------- the end: what happened to the realm, and what you did in it
  async ending() {
    const G = this.g.G, H = this.g.H, g = G.gens[H.pid];
    this.g.mode = 'end'; this.g.locked = true; if (this.g.auto?.on) this.g.auto.toggle(false);
    const sc = score(G, H);
    const fs = Object.values(G.factions).filter((f) => f.alive && citiesOf(G, f.id).length).sort((a, b) => citiesOf(G, b.id).length - citiesOf(G, a.id).length);
    const board = this.board(true), uni = G.over && G.over !== 'time' && (G.rivals || []).find((R) => G.gens[R.id].fac === G.over && G.gens[R.id].status === 'serving');
    const realm = G.over && G.over !== 'time' ? `<p class="big">${G.factions[G.over].name}統一了天下！${uni ? `（對手${G.gens[uni.id].name}${G.factions[G.over].lord === uni.id ? '親手' : '輔佐'}統一）` : ''}</p>` : `<p class="big">${G.year}年，天下仍未統一。</p><p>${fs.slice(0, 5).map((f) => `<span style="color:${f.color}">■</span>${f.name}（${citiesOf(G, f.id).length} 城）`).join('　')}</p>`;
    const rows = sc.rows.map(([n, v, p]) => `<tr><td>${n}</td><td>${v}</td><td>${p >= 0 ? '+' : ''}${p}</td></tr>`).join('');
    const kills = H.st.kills.length ? `<p>討取：${H.st.kills.join('、')}</p>` : '', cities = H.st.cities.length ? `<p>攻陷：${H.st.cities.join('、')}</p>` : '';
    let best = null; try { best = JSON.parse(localStorage.getItem(BEST) || 'null'); } catch (e) {}
    if (!best || sc.total > best.total) { try { localStorage.setItem(BEST, JSON.stringify({ name: g.name, total: sc.total, title: sc.title })); } catch (e) {} }
    try { localStorage.removeItem('sanguo-heroes-save-v1'); } catch (e) {}
    const bio = biography(this.g, sc), rw = rewritten(G, H);
    const bioHTML = `<div class="bio-scroll"><h3>《${g.name}傳》</h3>${bio.map((l) => `<p>${l}</p>`).join('')}</div>`;
    const rwHTML = rw.length ? `<h3>改寫的歷史</h3>${rw.map((t) => `<p>✦ ${t}</p>`).join('')}` : '<p class="dim">這一生沒有改變歷史的大勢。</p>';
    await this.ui.panel(`${realm}${board}${bioHTML}${rwHTML}<h3>${g.name}的一生</h3><table class="score">${rows}<tr class="tot"><td>總計</td><td></td><td>${sc.total}</td></tr></table><p class="big">評價：「${sc.title}」</p>${kills}${cities}<p>武將圖鑑：${dexCount(H)} 人</p><p><button class="copy-bio">複製列傳文字</button></p><p class="dim">按確定回到標題畫面。</p>`, { title: '功績結算', cls: 'wide',
      onOpen: (box) => { const b = box.querySelector('.copy-bio'); b.onclick = () => { navigator.clipboard?.writeText(`《${g.name}傳》\n` + bio.join('\n') + (rw.length ? '\n\n改寫的歷史：\n' + rw.join('\n') : '')).then(() => { b.textContent = '已複製！'; }, () => { b.textContent = '無法複製'; }); }; } });
    location.reload();
  }
}
const tot = (g) => g.lead + g.war + g.int + g.pol + g.cha;
