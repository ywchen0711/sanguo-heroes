// 情勢: what makes this month different from the last. Each month a few chances turn up around the player (bandits to
// put down, a stricken city to relieve, a talent passing through, an enemy city whose garrison has marched away, a
// caravan to escort, raiders on the border) and each has a deadline, so not all of them can be taken; one missed has
// its price. Doing the same kind of thing again and again pays less (疲乏). A city taken by storm is restless for half
// a year (民心不穩) and may rise and throw the new master out unless it is calmed; a long march from home costs men.
// The age (sim/era.js) and coalitions against a realm grown too big change what pays.
import { CITY_POS } from './world.js';
import { hostile, allied, citiesOf, serve, record } from './sim/engine.js';
import { eraOf, eraIs, eraText, ERAS, eraArea } from './sim/era.js';
import { disasterAt, DIS_N } from './disaster.js';
import { deed } from './deeds.js';
import { rankOf } from './hero.js';
import { fameOf } from './fame.js';

export const KIND_N = { bandit: '剿匪', relief: '賑災', talent: '訪賢', gap: '敵城空虛', escort: '護送商隊', border: '抵禦外族' };
const KIND_C = { bandit: '#e0a050', relief: '#7ad07a', talent: '#7ac0ff', gap: '#ff6a5a', escort: '#e8d070', border: '#c890ff' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SUR = '張王李趙劉陳楊黃周吳孫馬朱胡郭何高林';
// 疲乏: each recent job of a kind takes 15% off the next one's pay (down to 40%); it fades by a fifth each month
export const tire = (H, k) => Math.max(0.4, 1 - 0.15 * ((H.tired || {})[k] || 0));
export const tired = (H, k) => { (H.tired ||= {})[k] = (H.tired[k] || 0) + 1; };
// what the age does to the pay of a kind of job
export function eraBonus(G, k) {
  const e = eraOf(G)?.k;
  if (k === 'bandit') return e === 'turban' ? 1.8 : e === 'drought' ? 1.5 : 1;
  if (k === 'relief') return e === 'plague' || e === 'drought' ? 2 : 1;
  if (k === 'conquer') return e === 'peace' ? 0.5 : 1;
  return 1;
}

export class Board {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; }
  list() { return (this.H.opps ||= []); }
  here() { const g = this.g, P = g.pos; if (P?.town != null) return CITY_POS[P.town]; if (g.town?.C?.pos) return g.town.C.pos; return { x: P.x, y: P.z }; }
  dist(c) { const h = this.here(); return Math.hypot(c.x - h.x, c.y - h.y); }
  near(min, max, ok = () => true) { return this.G.cities.filter((c) => { const d = this.dist(CITY_POS[c.id]); return d >= min && d <= max && ok(c); }); }
  mine() { return this.g.myFaction(); }
  canSiege(C) { const G = this.G, mine = this.mine(), me = this.g.me; return !!C.owner && C.owner !== mine && !(mine && allied(G, mine, C.owner)) && (mine ? (this.g.isLord() || rankOf(me.merit) >= 2) : this.H.fame >= 100); }
  // ---------------------------------------------------------------- the month
  month() {
    const G = this.G, H = this.H;
    for (const k in H.tired || {}) { H.tired[k] *= 0.8; if (H.tired[k] < 0.05) delete H.tired[k]; }
    for (const o of this.list()) if (!o.done && !o.missed && o.until <= G.t) this.miss(o);
    H.opps = this.list().filter((o) => !o.done && !o.missed);
    this.unrest();
    const fresh = [];
    for (let k = 0; k < 12 && H.opps.length < 4; k++) { const o = this.make(); if (o) { H.opps.push(o); fresh.push(o); } }
    if (Math.random() < (fameOf(H).seek || 0)) for (let k = 0; k < 6; k++) { const o = this.make('talent'); if (o) { o.title = '慕名而來：' + o.title; H.opps.push(o); fresh.push(o); break; } }
    if (fresh.length) setTimeout(() => this.g.ui.toast(`<b style="color:#ffd86a">新的機會</b>　${fresh.map((o) => `<span style="color:${KIND_C[o.k]}">${KIND_N[o.k]}</span>`).join('、')}<br><small>選單「情勢」看詳情（有期限）</small>`, 5000), 3200);
  }
  // a new chance, of a kind the times favour
  make(only) {
    const G = this.G, H = this.H, e = eraOf(G)?.k, have = new Set(this.list().map((o) => o.k + ':' + o.cid));
    const w = { bandit: e === 'turban' || e === 'drought' ? 5 : 3, relief: 3, talent: 2, gap: 2, escort: 2, border: e === 'barbarian' ? 5 : 0 };
    let t = 0; for (const k in w) t += w[k]; let x = Math.random() * t, k = 'bandit'; for (const kk in w) { x -= w[kk]; if (x < 0) { k = kk; break; } }
    if (only) k = only;
    const id = (H.oppN = (H.oppN || 0) + 1), base = { id, k, t0: G.t };
    if (k === 'bandit' || k === 'border') {
      const area = eraArea(G), cs = k === 'border' ? this.near(0, 70, (c) => area && area[3](c)) : this.near(0, 35);
      const C = pick(cs.filter((c) => !have.has(k + ':' + c.id))); if (!C) return null;
      const m = this.g.act.newMission(C, !!this.mine() && C.owner === this.mine()); if (!m) return null;
      if (k === 'border') { m.kind = 'nomad'; m.boss = `${area[2].split('、')[0]}頭領 ${pick([...'阿蹋丘骨律那樓'])}${pick([...'力頓居烈渠紇'])}`; m.minion = area[2].split('、')[0] + '騎兵'; m.lv += 3; m.gold = Math.round(m.gold * 1.6); m.fame = Math.round(m.fame * 2); m.merit = Math.round((m.merit || 0) * 2); }
      else if (e === 'turban') { m.kind = 'turban'; m.boss = `黃巾 ${pick([...SUR])}${pick([...'角寶梁燕儀曼成'])}`; }
      m.until = G.t + 2; m.opp = id; H.missions.push(m); if (this.g.mode === 'world') this.g.missionMarks([m]);
      return { ...base, cid: C.id, until: m.until, mid: m.id, title: k === 'border' ? `${m.boss}率眾劫掠${C.name}一帶` : `「${m.boss}」在${C.name}附近作亂`, rw: `${m.gold} 金、名聲 ${m.fame}${m.official ? `、功績 ${m.merit}` : ''}`, miss: `${C.name}遭劫掠（兵與民心下降）` };
    }
    if (k === 'relief') {
      const C = pick(this.near(0, 45, (c) => { const d = disasterAt(this.g, c.id); return d && !d.helped && d.until > G.t + 0; }).filter((c) => !have.has('relief:' + c.id))); if (!C) return null;
      const d = disasterAt(this.g, C.id);
      return { ...base, cid: C.id, until: d.until, title: `${C.name}鬧${DIS_N[d.k]}，百姓等著救濟`, rw: `名聲（${eraBonus(G, 'relief') > 1 ? '時局所需，加倍' : '一般'}）、民心`, miss: `${C.name}民心大跌，你見死不救的名聲傳開` };
    }
    if (k === 'talent') {
      const free = G.gens.filter((x) => x.status === 'free' && x.follow == null && !x.isPlayer && !H.party.includes(x.id) && !(x.seek > G.t) && x.lead + x.war + x.int >= 180).sort((a, b) => (b.lead + b.war + b.int) - (a.lead + a.war + a.int)).slice(0, 25);
      const x = pick(free), C = pick(this.near(8, 40)); if (!x || !C) return null;
      x.city = C.id; x.seek = G.t + 2;
      return { ...base, cid: C.id, gid: x.id, until: G.t + 2, title: `${x.name}（統${x.lead} 武${x.war} 智${x.int}）路過${C.name}，聽說想見你`, rw: `招募他（成功率大增）`, miss: `${x.name}投靠了別人` };
    }
    if (k === 'gap') {
      const mine = this.mine(), C = pick(this.near(0, 40, (c) => this.canSiege(c) && (!mine || hostile(G, mine, c.owner)) && !have.has('gap:' + c.id))); if (!C) return null;
      (H.gap ||= {})[C.id] = G.t + 2; const f = G.factions[C.owner];
      return { ...base, cid: C.id, until: G.t + 2, title: `${f.name}軍的${C.name}主力出征，城中空虛`, rw: `攻城時守軍只剩六成，攻下名聲 +60`, miss: '守軍回城了' };
    }
    if (k === 'escort') {
      const A = pick(this.near(0, 25)), B = A && pick(G.cities.filter((c) => { const d = Math.hypot(CITY_POS[c.id].x - CITY_POS[A.id].x, CITY_POS[c.id].y - CITY_POS[A.id].y); return d >= 22 && d <= 50; })); if (!A || !B) return null;
      const d = Math.round(Math.hypot(CITY_POS[B.id].x - CITY_POS[A.id].x, CITY_POS[B.id].y - CITY_POS[A.id].y)), gold = Math.round((250 + d * 12) * tire(H, 'escort'));
      return { ...base, cid: A.id, to: B.id, until: G.t + 3, stage: 0, gold, title: `${A.name}的商隊要去${B.name}，請人護送`, rw: `${gold} 金、名聲 20（路上會有劫匪）`, miss: '商隊另請了鏢師' };
    }
    return null;
  }
  // a chance gone by: what it costs
  miss(o) {
    const G = this.G, H = this.H, C = G.cities[o.cid], mine = this.mine(); o.missed = true;
    let note = '';
    if (o.k === 'bandit' || o.k === 'border') {
      const m = H.missions.find((x) => x.id === o.mid); if (m) { H.missions = H.missions.filter((x) => x !== m); this.g.act.dropBanner(m); }
      C.troops = Math.max(0, C.troops - (o.k === 'border' ? 1200 : 400)); C.morale = Math.max(0, C.morale - 6); note = `${C.name}一帶遭賊寇劫掠。`;
      if (C.owner && C.owner === mine) { H.fame = Math.max(0, H.fame - 8); note += '（名聲 -8）'; }
    }
    if (o.k === 'relief') { C.morale = Math.max(0, C.morale - 8); if (C.owner && C.owner === mine) { H.fame = Math.max(0, H.fame - 15); note = `${C.name}的百姓怨你們見死不救。（名聲 -15）`; } else note = `${C.name}的災情沒人管，餓殍遍野。`; }
    if (o.k === 'talent') {
      const x = G.gens[o.gid]; x.seek = 0;
      if (x.status === 'free' && x.follow == null) {
        const R = (G.rivals || []).find((R) => R.alive && R.party.length < 4 && G.gens[R.id].status !== 'dead');
        if (R && Math.random() < 0.4) { x.follow = R.id; x.city = G.gens[R.id].city; R.party.push(x.id); note = `${x.name}跟著${G.gens[R.id].name}走了！`; }
        else if (C.owner && Math.random() < 0.6) { serve(G, x, C.owner, C.id, 70); note = `${x.name}投靠了${G.factions[C.owner].name}軍。`; }
        else { x.city = pick(C.adj); note = `${x.name}等不到你，離開了${C.name}。`; }
      }
    }
    if (o.k === 'escort') note = o.stage === 1 ? '商隊沒能按時到達，貨主很失望。（名聲 -10）' : '';
    if (o.k === 'escort' && o.stage === 1) H.fame = Math.max(0, H.fame - 10);
    if (note) setTimeout(() => this.g.ui.toast(`<b style="color:#ff9a6a">錯過了：${KIND_N[o.k]}</b>　${note}`, 5000), 2000);
  }
  // ---------------------------------------------------------------- checking: called a few times a second while the game runs
  check() {
    const G = this.G, H = this.H; if (!H?.opps) return;
    for (const o of H.opps) {
      if (o.done || o.missed) continue;
      let ok = false, bonus = '';
      if (o.k === 'bandit' || o.k === 'border') ok = !H.missions.some((x) => x.id === o.mid);
      if (o.k === 'relief') { const d = H.dis?.[o.cid]; ok = !!d?.helped; if (ok) { const f = Math.round(20 * eraBonus(G, 'relief') * tire(H, 'relief')) + (eraBonus(G, 'relief') > 1 ? 40 : 0); H.fame += f; tired(H, 'relief'); bonus = `名聲再 +${f}`; } }
      if (o.k === 'talent') { const x = G.gens[o.gid]; ok = H.party.includes(x.id) || x.follow === H.pid; if (ok) { H.fame += 15; x.seek = 0; bonus = `${x.name}加入了隊伍`; } else if (x.status !== 'free' || x.follow != null) { o.missed = true; x.seek = 0; } }
      if (o.k === 'gap') { const C = G.cities[o.cid], mine = this.mine(); ok = !!mine && C.owner === mine; if (ok) { H.fame += 60; bonus = '名聲 +60'; } }
      if (ok) { o.done = true; this.g.audio.sfx('level'); this.g.ui.toast(`<b style="color:${KIND_C[o.k]}">完成：${KIND_N[o.k]}</b>　${o.title}${bonus ? `<br><small>${bonus}</small>` : ''}`, 4500); }
    }
    H.opps = H.opps.filter((o) => !o.done && !o.missed);
  }
  // walking into a town: the caravan
  onTown(C) {
    const G = this.G, H = this.H;
    for (const o of this.list()) {
      if (o.k !== 'escort' || o.done || o.missed) continue;
      if (o.stage === 0 && o.cid === C.id) { o.stage = 1; this.g.ui.toast(`<b style="color:${KIND_C.escort}">護送開始</b>　商隊管事：「貨都裝好車了，全靠將軍了！」<br>把商隊送到${G.cities[o.to].name}（${o.until - G.t} 個月內，路上會有劫匪）`, 6000); }
      else if (o.stage === 1 && o.to === C.id) {
        o.done = true; const gold = Math.round(o.gold), fame = 20; H.gold += gold; H.fame += fame; tired(H, 'escort'); H.opps = this.list().filter((x) => x !== o);
        this.g.audio.sfx('coin'); this.g.ui.toast(`<b style="color:${KIND_C.escort}">完成：護送商隊</b>　平安送到${C.name}！<br><small>得到 ${gold} 金、名聲 ${fame}</small>`, 5000);
      }
    }
  }
  // walking on the land with a caravan: robbers now and then (true if a fight started)
  walk() {
    const o = this.list().find((o) => o.k === 'escort' && o.stage === 1 && !o.done && !o.missed); if (!o || Math.random() > 1 / 70) return false;
    this.robbed(o); return true;
  }
  async robbed(o) {
    const A = this.g.act, lv = Math.round(this.g.partyList().reduce((s, p) => s + p.rec.lv, 0) / (this.H.party.length + 1)) + 1;
    const foes = [A.foe('劫匪頭目', 'bandit', lv + 2, null, true), ...Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => A.foe('劫匪', 'bandit', lv))];
    const r = await A.fight(foes, { terrain: A.terrainAt(), title: '劫匪盯上了商隊！' });
    if (r !== 'win') { o.missed = true; this.H.opps = this.list().filter((x) => x !== o); this.H.fame = Math.max(0, this.H.fame - 15); this.g.ui.toast(`<b style="color:#ff9a6a">商隊的貨被劫走了……</b>（名聲 -15）`, 5000); }
  }
  // ---------------------------------------------------------------- conquest: restless cities, long marches, the age
  conquered(C, prev) {
    const G = this.G, H = this.H; (H.held ||= {})[C.id] = { until: G.t + 6, from: prev };
    const lines = [`新佔領的${C.name}民心不穩（民心 ${C.morale}）。半年內可能民變，到太守府「安撫百姓」。`];
    const e = eraOf(G);
    if (e?.k === 'edict' && prev === e.f) { const n = 80 + C.size * 30; H.fame += n; if (!this.g.isLord()) this.g.me.merit += 40 + C.size * 15; lines.push(`奉詔討伐有功！名聲再 +${n}${this.g.isLord() ? '' : '、功績加倍'}。`); }
    if (e?.k === 'peace') { const n = Math.round((80 + C.size * 30) / 2); H.fame = Math.max(0, H.fame - n); lines.push(`太平年間興兵，百姓厭戰。（名聲 -${n}）`); }
    if (H.gap?.[C.id]) delete H.gap[C.id];
    return lines.join('\n');
  }
  // the men a siege costs before it begins: a long march from home, a plague in the camp
  async beforeSiege(C) {
    const G = this.G, mine = this.mine(), notes = []; let mul = 1;
    if (mine && citiesOf(G, mine).length && !C.adj.some((a) => G.cities[a].owner === mine)) { mul *= 0.9; notes.push('離自己的城太遠，補給線拉長（兵力 -10%）'); }
    if (eraIs(G, 'plague')) { mul *= 0.85; notes.push('軍中瘟疫流行，士兵病倒（兵力 -15%）'); }
    if (mul < 1) { for (const p of this.g.partyList()) p.rec.sol = Math.max(50, Math.round(p.rec.sol * mul)); this.g.ui.toast(`<b style="color:#ff9a6a">${notes.join('<br>')}</b>`, 4500); }
  }
  gapMul(cid) { return this.H.gap?.[cid] > this.G.t ? 0.6 : 1; }
  // the restless cities: each month one may rise
  unrest() {
    const G = this.G, H = this.H, mine = this.mine();
    for (const [cid, h] of Object.entries(H.held || {})) {
      const C = G.cities[cid];
      if (!mine || C.owner !== mine || h.until <= G.t) { delete H.held[cid]; continue; }
      C.morale = Math.min(100, C.morale + 2);
      const p = Math.max(0, (55 - C.morale) / 110) * (eraIs(G, 'turban') ? 1.6 : 1);
      if (Math.random() > p) continue;
      const back = h.from && G.factions[h.from]?.alive && C.adj.some((a) => G.cities[a].owner === h.from);
      if (C.troops < 2500 || Math.random() < 0.35) {
        delete H.held[cid]; C.owner = back ? h.from : null; C.troops = 2000 + Math.round(Math.random() * 1500); C.morale = 50; C.gov = null;
        for (const g of G.gens) if (g.status === 'serving' && g.fac === mine && g.city === C.id && !H.party.includes(g.id) && g.id !== H.pid) { const home = citiesOf(G, mine)[0]; if (home) g.city = home.id; }
        record(G, 'event', 'txt', { zh: back ? `${C.name}的百姓叛亂，開城迎回${G.factions[h.from].name}軍！` : `${C.name}的豪族煽動民變，趕走了守軍，據城自守！`, en: `${C.name} rises in revolt.` }, mine, 2, { city: C.id });
        deed(this.g, `${C.name}民變失守`);
        setTimeout(() => this.g.ui.toast(`<b style="color:#ff6a5a">${C.name}民變！城池失守了。</b><br><small>新佔領的城要記得安撫</small>`, 6000), 1500);
        this.g.refreshCities?.();
      } else {
        const n = Math.round(C.troops * 0.25); C.troops -= n; C.morale = Math.max(0, C.morale - 3);
        setTimeout(() => this.g.ui.toast(`<b style="color:#ff9a6a">${C.name}發生民變</b>，守軍死傷 ${n} 人。（民心 ${C.morale}）`, 5000), 1500);
      }
    }
  }
  restless(C) { const h = this.H.held?.[C.id]; return h && h.until > this.G.t && C.owner === this.mine() ? h : null; }
  async calm(C) {
    const H = this.H, ui = this.g.ui;
    if (H.gold < 200) { await ui.say('', '安撫百姓需要 200 金（發糧、減稅、修屋）。'); return false; }
    H.gold -= 200; await this.g.act.passDays(5, `${this.g.me.name}在${C.name}安撫百姓……`);
    const n = 10 + Math.round(this.g.me.cha / 10); C.morale = Math.min(100, C.morale + n);
    if (C.morale >= 70) delete H.held[C.id];
    await ui.say('', `你開倉發糧、減免賦稅，親自到街上慰問百姓。\n${C.name}民心 +${n}（現在 ${C.morale}）${C.morale >= 70 ? '\n百姓已經安定下來了。' : ''}`); this.g.hud(); return true;
  }
  // ---------------------------------------------------------------- the screen
  async screen() {
    const G = this.G, H = this.H, mine = this.mine(), e = eraOf(G), c = G.coal && !G.coal.over && G.coal.until > G.t ? G.coal : null;
    const dirTo = (C) => { const h = this.here(), p = CITY_POS[C.id], dx = p.x - h.x, dz = p.y - h.y, d = Math.round(Math.hypot(dx, dz)); if (d < 3) return '就在這裡'; return `${(Math.abs(dz) > Math.abs(dx) / 2 ? (dz < 0 ? '北' : '南') : '') + (Math.abs(dx) > Math.abs(dz) / 2 ? (dx < 0 ? '西' : '東') : '')}方 ${d} 里`; };
    let h = `<h4>時局</h4>${e ? `<p><b style="color:#ffd86a">【${ERAS[e.k].n}】</b>　<small>還有 ${e.until - G.t} 個月</small><br>${eraText(G)}</p>` : '<p class="dim">天下大勢平穩，沒有特別的大事。</p>'}`;
    if (c) { const t = G.factions[c.target]; h += `<p><b style="color:${c.target === mine ? '#ff6a5a' : '#ffd86a'}">【合縱】</b>${c.members.map((id) => G.factions[id]?.name).filter(Boolean).join('、')}聯手討伐${t.name}${c.target === mine ? '——<b style="color:#ff6a5a">就是你們！</b>四面受敵，要小心' : ''}。<small>還有 ${c.until - G.t} 個月</small></p>`; }
    h += '<h4>機會</h4>';
    const L = this.list().filter((o) => !o.done && !o.missed);
    h += L.length ? L.map((o) => { const C = G.cities[o.cid], left = o.until - G.t, where = o.k === 'escort' ? (o.stage ? `送到${G.cities[o.to].name}（${dirTo(G.cities[o.to])}）` : `到${C.name}接商隊（${dirTo(C)}）`) : `${C.name}（${dirTo(C)}）`;
      return `<p><b style="color:${KIND_C[o.k]}">［${KIND_N[o.k]}］</b>${o.title}<br><small>地點 ${where}　期限 <b style="color:${left <= 1 ? '#ff8a6a' : 'inherit'}">${left <= 1 ? '這個月' : left + ' 個月'}</b>　報酬 ${o.rw}　錯過：${o.miss}</small></p>`; }).join('') : '<p class="dim">目前沒有特別的機會，每個月初會有新的。</p>';
    const hl = Object.entries(H.held || {}).filter(([cid, x]) => x.until > G.t && G.cities[cid].owner === mine);
    if (hl.length) h += `<h4>民心不穩</h4>${hl.map(([cid, x]) => `<p>${G.cities[cid].name}　民心 <b style="color:${G.cities[cid].morale < 45 ? '#ff8a6a' : '#ffd86a'}">${G.cities[cid].morale}</b>　還要 ${x.until - G.t} 個月才安定　<small>（到太守府安撫百姓）</small></p>`).join('')}`;
    const tk = Object.entries(H.tired || {}).filter(([k]) => tire(H, k) < 0.95);
    if (tk.length) h += `<h4>疲乏</h4><p>${tk.map(([k]) => `${({ bandit: '討賊', relief: '賑災', escort: '護送' })[k] || k} 報酬 ×${tire(H, k).toFixed(2)}`).join('　')}<br><small>同一種事一直做，報酬會越來越少；換點別的事做，每個月會慢慢恢復。</small></p>`;
    await this.g.ui.panel(h, { title: '情勢', cls: 'wide' });
  }
  // marks on the map
  marks(x, s) {
    const G = this.G;
    for (const o of this.list()) { if (o.done || o.missed || o.k === 'bandit' || o.k === 'border') continue; const C = CITY_POS[o.k === 'escort' && o.stage ? o.to : o.cid]; x.strokeStyle = KIND_C[o.k]; x.lineWidth = 2; x.beginPath(); x.arc(C.x * s, C.y * s, 6, 0, Math.PI * 2); x.stroke(); }
  }
}
