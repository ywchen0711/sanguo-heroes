// Random events: hundreds of small stories that happen when you talk to someone, walk in a town or travel the land.
// Each is written as one row of data (see js/ev/*.js):
//
//   [req, speaker, text, options]
//     req      where it can happen — t (talking to someone), w (in a town), f (on the land) — and conditions:
//              serve / free / lord (the player), own / enemy / none (whose town), big / small (town size),
//              spring summer autumn winter, north south west central coast (region), fame>N gold>N lv>N year>N,
//              war>N int>N pol>N cha>N lead>N, party (has companions), once (happens only once a game)
//     speaker  who says it: '' for narration, '@' for the person you are talking to, or a name (a look is drawn for them)
//     text     with {me} {city} {lord} {fac} {gen} (a famous general alive) {free} (a free officer and {fcity} where)
//              {item} (a hidden treasure and {icity} where) {season} {n}
//     options  [label, effects, message] (no options: one 確定)
//
//   effects: tokens separated by spaces; '?0.6' or '?int:70' first makes it a gamble (by chance, or by the player's
//   stat against a level), with ' / ' between what happens on success and on failure (the message too).
//     gold+N gold-N fame+N fame-N exp+N sol+P sol-P (percent of the party's soldiers) sp+N heal
//     item:ID item:ID*N stat:war|lead|int|pol|cha merit+N morale+N morale-N troops+N troops-N days+N
//     hint:treasure|gen|weak|war recruit mission eq:ID   $N (costs N gold; the option is off without it)
//     &ID (gives up an item; off without it)   fight:KIND:N[:+L] ... win ... (what follows 'win' needs a victory)
import { EV_TALK } from './ev/talk.js';
import { EV_TALK2 } from './ev/talk2.js';
import { EV_TOWN } from './ev/town.js';
import { EV_FIELD } from './ev/field.js';
import { EV_TALK3 } from './ev/talk3.js';
import { EV_TOWN2 } from './ev/town2.js';
import { EV_FIELD2 } from './ev/field2.js';
import { ITEMS, EQUIP, STAT_N, gainExp, solMax, spMax } from './hero.js';
import { itemName } from './sim/text.js';
import { citiesOf, power, busy } from './sim/engine.js';
import { regionAt, CITY_POS } from './world.js';
import { LOOKS } from './sprites.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const EVENTS = [...EV_TALK, ...EV_TALK2, ...EV_TALK3, ...EV_TOWN, ...EV_TOWN2, ...EV_FIELD, ...EV_FIELD2].map(([req, who, text, opts], id) => ({ id, req: req.split(/\s+/).filter(Boolean), who, text, opts: opts || [] }));
const SEASON = (m) => (m <= 3 ? 'spring' : m <= 6 ? 'summer' : m <= 9 ? 'autumn' : 'winter');
const SEASON_N = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

export class Events {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; } get H() { return this.g.H; } get ui() { return this.g.ui; }
  // the situation an event is judged against
  ctx(where, npc) {
    const G = this.G, g = this.g.me, town = this.g.town ? this.g.town.C : null, mine = this.g.myFaction();
    const P = this.g.pos, tp = town ? town.pos || CITY_POS[town.id] : null, region = tp ? regionAt(tp.x, tp.y) : regionAt(P.x, P.z);
    return { where, npc, g, town, mine, region, season: SEASON(G.month),
      own: !!town && !!mine && town.owner === mine, none: !!town && !town.owner, enemy: !!town && !!town.owner && town.owner !== mine };
  }
  ok(ev, c) {
    const H = this.H, g = c.g;
    for (const t of ev.req) {
      if (t === 't' || t === 'w' || t === 'f') continue;
      const m = /^(\w+)>(\d+)$/.exec(t);
      if (m) { const [, k, v] = m, val = k === 'fame' ? H.fame : k === 'gold' ? H.gold : k === 'lv' ? H.rec[H.pid].lv : k === 'year' ? this.G.year : g[k]; if (!(val > +v)) return false; continue; }
      if (t === 'serve' && !(g.status === 'serving' && !this.g.isLord())) return false;
      if (t === 'free' && g.status === 'serving') return false;
      if (t === 'lord' && !this.g.isLord()) return false;
      if (t === 'own' && !c.own) return false; if (t === 'enemy' && !c.enemy) return false; if (t === 'none' && !c.none) return false;
      if (t === 'big' && !(c.town && c.town.size >= 3)) return false; if (t === 'small' && !(c.town && c.town.size <= 1)) return false;
      if (['spring', 'summer', 'autumn', 'winter'].includes(t) && c.season !== t) return false;
      if (['north', 'south', 'west', 'central', 'coast'].includes(t) && c.region !== t) return false;
      if (t === 'party' && !H.party.length) return false;
      if (t === 'once' && (H.evOnce || []).includes(ev.id)) return false;
    }
    return ev.req.includes(c.where);
  }
  // a random event for this place, or null; recent ones are skipped
  pick(where, npc) {
    const c = this.ctx(where, npc), H = this.H; H.evRecent ||= [];
    const pool = EVENTS.filter((e) => !H.evRecent.includes(e.id) && this.ok(e, c));
    if (!pool.length) return null;
    const ev = pick(pool); H.evRecent.push(ev.id); if (H.evRecent.length > 60) H.evRecent.shift();
    return { ev, c };
  }
  async maybe(where, chance, npc) { if (Math.random() >= chance) return false; const p = this.pick(where, npc); if (!p) return false; await this.run(p.ev, p.c); return true; }
  // ---------------------------------------------------------------- filling in the text
  fill(s, c, vars) {
    const G = this.G;
    return s.replace(/\{(\w+)\}/g, (_, k) => {
      if (k in vars) return vars[k];
      let v = '';
      if (k === 'me') v = c.g.name;
      if (k === 'city') v = c.town ? c.town.name : this.nearCity().name;
      if (k === 'season') v = SEASON_N[c.season];
      if (k === 'lord') { const f = c.mine ? G.factions[c.mine] : c.town?.owner ? G.factions[c.town.owner] : null; v = f ? G.gens[f.lord].name : '各路諸侯'; }
      if (k === 'fac') { const f = c.mine ? G.factions[c.mine] : c.town?.owner ? G.factions[c.town.owner] : null; v = f ? f.name : '朝廷'; }
      if (k === 'gen') { const gs = G.gens.filter((x) => (x.status === 'serving' || x.status === 'free') && x.lead + x.war + x.int > 230 && !x.isPlayer); v = gs.length ? pick(gs).name : '呂布'; }
      if (k === 'free' || k === 'fcity') { const fr = G.gens.filter((x) => x.status === 'free' && !busy(x) && x.lead + x.war + x.int > 180); const x = fr.length ? pick(fr) : null; vars.free = x ? x.name : '一位奇人'; vars.fcity = x ? G.cities[x.city].name : '某處'; vars._free = x; v = vars[k]; }
      if (k === 'item' || k === 'icity') { const hid = G.items.filter((it) => it.city != null); const it = hid.length ? pick(hid) : null; vars.item = it ? `「${itemName(it.key)}」` : '一件寶物'; vars.icity = it ? G.cities[it.city].name : '某處'; v = vars[k]; }
      if (k === 'n') v = String(vars.n ??= 50 + Math.floor(Math.random() * 10) * 25);
      vars[k] = v; return v;
    });
  }
  nearCity() { const P = this.g.pos, G = this.G; let best = G.cities[0], d = 1e9; for (const c of G.cities) { const q = CITY_POS[c.id], e = Math.hypot(q.x - P.x, q.y - P.z); if (e < d) { d = e; best = c; } } return best; }
  // ---------------------------------------------------------------- running one
  async run(ev, c) {
    const vars = {}, text = this.fill(ev.text, c, vars);
    const who = ev.who === '@' ? (c.npc?.gen != null ? this.G.gens[c.npc.gen].name : c.npc?.guard ? '守城士兵' : '百姓') : this.fill(ev.who || '', c, vars);
    const look = ev.who === '@' ? (c.npc?.gen != null ? this.g.lookOf(this.G.gens[c.npc.gen]) : c.npc?.look) : ev.who ? LOOKS.villager(ev.who) : null;
    if (ev.req.includes('once')) (this.H.evOnce ||= []).push(ev.id);
    if (!ev.opts.length) { await this.ui.say(who, text, look); return; }
    const opts = ev.opts.map(([n, fx], i) => ({ k: i, n: this.fill(n, c, vars), off: !this.can(fx) }));
    const i = await this.ui.ask(text, opts, who, look);
    if (i == null) return;
    const [, fx, msg] = ev.opts[i];
    await this.apply(fx, msg ? this.fill(msg, c, vars) : '', c, vars, who, look);
  }
  can(fx) { const H = this.H; for (const t of fx.split(/\s+/)) { if (/^\$\d+$/.test(t) && H.gold < +t.slice(1)) return false; if (t.startsWith('&') && !((H.items[t.slice(1)] || 0) > 0)) return false; } return true; }
  async apply(fx, msg, c, vars, who, look) {
    let [good, bad] = fx.split(' / '), [mGood, mBad] = msg.split(' / ');
    let win = true, toks = good, pre = '';
    const m = /(^|\s)\?(\S+)\s*/.exec(good);
    if (m) {
      pre = good.slice(0, m.index); good = good.slice(m.index + m[0].length);
      const q = m[2], st = /^(\w+):(\d+)$/.exec(q), p = st ? clamp(0.5 + (c.g[st[1]] - +st[2]) / 40, 0.05, 0.95) : +q;
      win = Math.random() < p; toks = pre + ' ' + (win ? good : bad || '');
    } else toks = good;
    const text = (win ? mGood : mBad ?? mGood) || '';
    const notes = await this.effects(toks.split(/\s+/).filter(Boolean), c, vars);
    if (text || notes.length) await this.ui.say(who && text ? who : '', [text, notes.join('　')].filter(Boolean).join('\n'), text ? look : null);
    this.g.hud();
  }
  // apply the tokens; returns notes like 金 +50
  async effects(toks, c, vars) {
    const H = this.H, G = this.G, g = c.g, notes = [], party = this.g.partyList();
    const k = toks.indexOf('win'); let after = [];
    if (k >= 0) { after = toks.slice(k + 1); toks = toks.slice(0, k); }
    for (const t of toks) {
      let m;
      if ((m = /^\$(\d+)$/.exec(t))) { H.gold -= +m[1]; notes.push(`金 -${m[1]}`); continue; }
      if ((m = /^&(\w+)$/.exec(t))) { H.items[m[1]]--; notes.push(`${ITEMS[m[1]]?.n || m[1]} -1`); continue; }
      if ((m = /^(gold|fame|exp|merit|morale|troops|sp|days)([+-])(\d+)$/.exec(t))) {
        const n = +m[3] * (m[2] === '-' ? -1 : 1), key = m[1];
        if (key === 'gold') { H.gold = Math.max(0, H.gold + n); notes.push(`金 ${n > 0 ? '+' : ''}${n}`); }
        if (key === 'fame') { H.fame = Math.max(0, H.fame + n); notes.push(`名聲 ${n > 0 ? '+' : ''}${n}`); }
        if (key === 'exp') { const ups = []; for (const p of party) for (const u of gainExp(G, p.g, p.rec, n)) ups.push(`${p.g.name}升到 Lv${u.lv}`); notes.push(`經驗 +${n}`, ...ups); if (ups.length) this.g.audio.sfx('level'); }
        if (key === 'merit' && g.status === 'serving') { g.merit += n; notes.push(`功績 +${n}`); this.g.act.promote(); }
        if (key === 'morale' && c.town) { c.town.morale = clamp(c.town.morale + n, 0, 100); notes.push(`${c.town.name}民心 ${n > 0 ? '+' : ''}${n}`); }
        if (key === 'troops' && c.town) { c.town.troops = Math.max(0, c.town.troops + n); notes.push(`${c.town.name}兵 ${n > 0 ? '+' : ''}${n}`); }
        if (key === 'sp') { for (const p of party) p.rec.sp = Math.min(p.spMax, p.rec.sp + n); notes.push(`策略 +${n}`); }
        if (key === 'days') { notes.push(`過了 ${n} 天`); await this.g.act.passDays(n); }
        continue;
      }
      if ((m = /^sol([+-])(\d+)$/.exec(t))) { const f = +m[2] / 100 * (m[1] === '-' ? -1 : 1); let tot = 0; for (const p of party) { const d = Math.round(p.solMax * f); const before = p.rec.sol; p.rec.sol = clamp(p.rec.sol + d, 10, p.solMax); tot += p.rec.sol - before; } notes.push(`兵力 ${tot >= 0 ? '+' : ''}${tot}`); continue; }
      if (t === 'heal') { for (const p of party) { p.rec.sol = p.solMax; p.rec.sp = p.spMax; } notes.push('全隊完全回復'); continue; }
      if ((m = /^item:(\w+)(?:\*(\d+))?$/.exec(t))) { const n = +(m[2] || 1); H.items[m[1]] = (H.items[m[1]] || 0) + n; notes.push(`${ITEMS[m[1]]?.n || m[1]} +${n}`); continue; }
      if ((m = /^eq:(\w+)$/.exec(t))) { const E = EQUIP[m[1]], r = H.rec[H.pid], old = r.eq[E.kind]; if (!old || EQUIP[old].v < E.v) { r.eq[E.kind] = m[1]; notes.push(`得到${E.n}，裝備上了`); } else { H.gold += Math.round(E.price / 2); notes.push(`得到${E.n}（比身上的差，賣了 ${Math.round(E.price / 2)} 金）`); } continue; }
      if ((m = /^stat:(\w+)$/.exec(t))) { if (g.base[m[1]] < 100) { g.base[m[1]]++; g[m[1]]++; } notes.push(`${STAT_N[m[1]]} +1`); continue; }
      if (t.startsWith('hint:')) { notes.push(this.hint(t.slice(5))); continue; }
      if (t === 'recruit') { const x = vars._free || G.gens.find((y) => y.status === 'free' && !busy(y) && y.city === (c.town?.id ?? -1)); if (x && H.party.length < 4) { x.follow = H.pid; H.party.push(x.id); const { newRec } = await import('./hero.js'); H.rec[x.id] ||= newRec(x); if (this.g.myFaction()) { const { serve } = await import('./sim/engine.js'); serve(G, x, this.g.myFaction(), g.city, 85); } notes.push(`${x.name}加入了隊伍！`); this.g.respawnParty(); } continue; }
      if (t === 'mission') { const C = c.town || this.nearCity(), ms = this.g.act.newMission(C, g.status === 'serving'); if (ms && H.missions.filter((x) => !x.done).length < 3) { H.missions.push(ms); notes.push(`接下了討伐「${ms.boss}」的任務`); if (this.g.mode === 'world') this.g.missionMarks(); } continue; }
      if ((m = /^fight:(\w+):(\d+)(?::\+(\d+))?$/.exec(t))) {
        const lv0 = Math.round(party.reduce((s, p) => s + p.rec.lv, 0) / party.length) + +(m[3] || 0), foes = [];
        const names = { bandit: '山賊', turban: '黃巾賊', nomad: '騎兵', barbarian: '蠻兵', pirate: '海賊', wolf: '野狼', tiger: '猛虎', bear: '棕熊', boar: '山豬', soldier: '官兵' };
        for (let i = 0; i < +m[2]; i++) foes.push(this.g.act.foe(names[m[1]] + (i === 0 && +m[2] > 2 ? '頭目' : ''), m[1], Math.max(1, lv0 + (i ? 0 : 1)), null, i === 0 && +m[2] > 2));
        const r = await this.g.act.fight(foes, { terrain: this.g.mode === 'town' ? 'city' : this.g.act.terrainAt() });
        if (r !== 'win') { after = []; notes.push('沒能打贏……'); }
        continue;
      }
    }
    if (after.length) notes.push(...await this.effects(after, c, vars));
    return notes;
  }
  // what a rumour tells: a hidden treasure, a free general, the weakest neighbour, the next war
  hint(kind) {
    const G = this.G;
    if (kind === 'treasure') { const hid = G.items.filter((it) => it.city != null); if (!hid.length) return '（天下的寶物都有主了）'; const it = pick(hid); return `聽說「${itemName(it.key)}」藏在${G.cities[it.city].name}。（到那裡的酒館四處探訪）`; }
    if (kind === 'gen') { const fr = G.gens.filter((x) => x.status === 'free' && !busy(x) && x.lead + x.war + x.int > 200); if (!fr.length) return '（最近沒有聽說在野的大人物）'; const x = pick(fr); return `${x.name}（統${x.lead} 武${x.war} 智${x.int}）正在${G.cities[x.city].name}。`; }
    if (kind === 'weak') { const fs = Object.values(G.factions).filter((f) => f.alive && citiesOf(G, f.id).length).sort((a, b) => power(G, a.id) - power(G, b.id)); const f = fs[0]; return f ? `${f.name}軍最弱，只剩 ${citiesOf(G, f.id).length} 座城。` : ''; }
    if (kind === 'war') { const fs = Object.values(G.factions).filter((f) => f.alive).sort((a, b) => power(G, b.id) - power(G, a.id)); return fs[0] ? `${fs[0].name}軍兵強馬壯，正虎視眈眈。` : ''; }
    return '';
  }
}
