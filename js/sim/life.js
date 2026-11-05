// Every general lives a life of their own. Each month each one (of age, alive, not travelling with the player) does
// one thing that suits who they are: a warrior trains and seeks duels, a strategist studies and visits scholars, an
// administrator governs, the ambitious gather friends and wait for their chance, wanderers travel and look for a
// master. What they do gives experience; levels raise their numbers towards what they could become (their
// potential), the young grow fast, the old slowly fade, and a young officer who follows a great one learns from them.
// Comrades become friends and sworn brothers. The milestones go into each general's own chronicle.
//
// g.life = { type, lv, exp, pot ([lead, war, int, pol, cha] they could reach), mentor, pupil, sworn, friends: {id: n}, log: [[year, code, arg]] }

const STAT = ['lead', 'war', 'int', 'pol', 'cha'];
export const TYPE_N = { W: '武人', S: '謀士', P: '能臣', A: '野心家', H: '遊俠' };
export const TYPE_D = { W: '練武、挑戰強者、請纓出征', S: '研讀兵書、拜訪名士、獻策', P: '治理城池、舉薦人才', A: '結交黨羽、伺機而動', H: '雲遊四方、拜師學藝、行俠仗義' };
// some by hand
const TYPES = {
  呂布: 'W', 張飛: 'W', 關羽: 'W', 趙雲: 'W', 典韋: 'W', 許褚: 'W', 馬超: 'W', 甘寧: 'W', 太史慈: 'W', 黃忠: 'W', 夏侯惇: 'W', 張遼: 'W', 文醜: 'W', 顏良: 'W', 華雄: 'W', 龐德: 'W', 魏延: 'W', 孫策: 'W',
  諸葛亮: 'S', 郭嘉: 'S', 龐統: 'S', 賈詡: 'S', 荀攸: 'S', 周瑜: 'S', 陸遜: 'S', 法正: 'S', 徐庶: 'S', 田豐: 'S', 沮授: 'S', 陳宮: 'S', 程昱: 'S', 姜維: 'S', 鄧艾: 'S',
  荀彧: 'P', 張昭: 'P', 蔣琬: 'P', 費禕: 'P', 董允: 'P', 顧雍: 'P', 鍾繇: 'P', 陳群: 'P', 魯肅: 'P', 諸葛瑾: 'P', 糜竺: 'P', 孫乾: 'P', 簡雍: 'P',
  司馬懿: 'A', 曹操: 'A', 劉備: 'A', 孫權: 'A', 袁紹: 'A', 袁術: 'A', 董卓: 'A', 孟達: 'A', 鍾會: 'A', 司馬昭: 'A', 司馬炎: 'A', 曹丕: 'A', 李傕: 'A', 韓遂: 'A',
  華佗: 'H', 于吉: 'H', 許劭: 'H', 管寧: 'H', 司馬徽: 'H', 龐德公: 'H', 黃承彥: 'H', 崔州平: 'H', 石韜: 'H', 孟建: 'H', 周倉: 'H', 裴元紹: 'H',
};
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pickW = (r, w) => { let t = 0; for (const k in w) t += w[k]; let x = r() * t; for (const k in w) { x -= w[k]; if (x < 0) return k; } return Object.keys(w)[0]; };
const total = (g) => g.lead + g.war + g.int + g.pol + g.cha;
export const lvNeed = (lv) => 60 + lv * 25;
function typeOf(g) {
  if (TYPES[g.name]) return TYPES[g.name];
  const h = hash(g.name), best = STAT.slice(0, 4).reduce((a, k) => (g.base[k] > g.base[a] ? k : a), 'lead');
  if (h % 9 === 0) return 'A'; if (h % 11 === 0) return 'H';
  return best === 'war' ? 'W' : best === 'int' ? 'S' : best === 'pol' ? 'P' : g.base.war > g.base.int ? 'W' : 'S';
}
export function initLife(G, g) {
  if (g.life) return g.life;
  const h = hash(g.name + 'pot'), age = G.year - g.born, young = age < 25;
  const pot = STAT.map((k, i) => Math.min(100, g.base[k] + 3 + ((h >>> (i * 3)) % 7) + (young ? 6 : age < 35 ? 3 : 0)));
  const lv = Math.max(1, Math.min(45, Math.round((g.base.lead + g.base.war + g.base.int) / 30 - 3 + Math.max(0, age - 18) / 3)));
  const L = (g.life = { type: typeOf(g), lv, exp: 0, pot, mentor: null, friends: {}, log: [] });
  // a few have already seen a lot of fighting: Lv20, 30, 40 or 50 from the start, their numbers grown to match
  G.lifeSalt ??= Math.floor(G.r() * 1e9);
  const roll = (hash(g.name + 'vet' + G.lifeSalt) % 10000) / 10000, vet = age < 18 ? 0 : roll < 0.006 ? 50 : roll < 0.021 ? 40 : roll < 0.051 ? 30 : roll < 0.111 ? 20 : 0;
  if (vet > lv) {
    pot.forEach((v, i) => (pot[i] = Math.min(100, v + Math.round(vet / 10))));
    for (let n = Math.round((vet - lv) / 2), i = 0; n > 0 && i < 200; i++) { const k = STAT[(hash(g.name + i + G.lifeSalt) >>> 0) % 5], j = STAT.indexOf(k); if (g.base[k] < pot[j]) { g.base[k]++; g[k]++; n--; } }
    L.lv = vet; L.vet = vet;
  }
  return L;
}
export function note(G, g, code, arg) {
  const L = g.life || initLife(G, g), last = L.log[L.log.length - 1];
  if (L.log.slice(-6).some((e) => e[1] === code && e[2] === arg)) return;                       // the same thing again: once is enough
  if (code === 'join' && last && last[1] === 'join' && last[0] === G.year) { last[2] = arg; return; } // a faction merging or renamed in the same year
  if ((code === 'duelWin' || code === 'duelLose') && L.log.slice(-4).filter((e) => e[1] === code).length >= 2) return;
  L.log.push([G.year, code, arg]); if (L.log.length > 10) L.log.splice(1, 1);
}
// experience, and levels that raise a number towards its potential (most of all the one that suits them)
export function gainLife(G, g, n, favour, refresh) {
  const L = g.life || initLife(G, g); L.exp += n;
  while (L.exp >= lvNeed(L.lv)) {
    L.exp -= lvNeed(L.lv); L.lv++;
    const ks = favour ? [favour, favour, ...STAT] : STAT;
    const k = ks[Math.floor(G.r() * ks.length)];
    if (g.base[k] < L.pot[STAT.indexOf(k)]) { g.base[k]++; refresh(G, g); if (g.base[k] >= 90 && g.base[k] - 1 < 90) note(G, g, 'peak', k); }
  }
}
// how fast the land's generals grow: about a level a month at first, Lv35-45 after ten years
const GROW = 12;
const FAV = { W: 'war', S: 'int', P: 'pol', A: 'cha', H: 'war' };
// ---------------------------------------------------------------- the month
export function lifeMonth(G, H) {
  const { r, refresh, gensIn, busy, citiesOf } = H;
  // a month of a life is worth GROW times what it says (a rival hero keeps its own pace, see rivals.js)
  const grow = (x, n, fav, f) => gainLife(G, x, x.rivalHero ? n : n * GROW, fav, f);
  const active = G.gens.filter((g) => (g.status === 'serving' || g.status === 'free') && !g.isPlayer && G.year - g.born >= 15);
  // who is in each city (for duels, teachers and friends)
  const byCity = new Map(); for (const g of active) { if (!byCity.has(g.city)) byCity.set(g.city, []); byCity.get(g.city).push(g); }
  for (const g of active) {
    const L = g.life || initLife(G, g), age = G.year - g.born, withPlayer = g.follow != null;
    // the old fade a little each year
    if (G.month === 1 && age >= 58) for (const k of ['war', 'lead']) if (r() < (age - 55) / 25 && g.base[k] > 30) { g.base[k]--; refresh(G, g); }
    // a pupil learns from a master in the same city
    if (L.mentor != null) { const m = G.gens[L.mentor]; if (!m || m.status === 'dead' || m.city !== g.city) { if (m && m.status === 'dead') note(G, g, 'mentorDied', m.name); L.mentor = null; } else grow(g, 14, bestOf(m), refresh); }
    const here = byCity.get(g.city) || [], young = age < 30;
    const w = { W: { train: 5, duel: 3, drill: 2, friend: 1, mentor: young ? 2 : 0, rest: 1 }, S: { study: 5, visit: 2, drill: 1, friend: 1, mentor: young ? 2 : 0, rest: 1 },
      P: { govern: 5, study: 2, friend: 2, rest: 1 }, A: { friend: 4, study: 2, drill: 2, plot: g.status === 'serving' ? 2 : 0, rest: 1 }, H: { travel: withPlayer ? 0 : 4, train: 2, study: 2, mentor: 3, friend: 1, rest: 1 } }[L.type];
    if (g.status === 'free') { w.govern = 0; w.plot = 0; } if (withPlayer) { w.duel = 0; w.travel = 0; w.plot = 0; w.mentor = 0; }
    const act = pickW(r, w), youth = age < 22 ? 1.6 : age < 30 ? 1.25 : age > 55 ? 0.6 : 1, rival = g.rival ? 1.6 : 1, k = youth * rival;
    if (act === 'train') grow(g, Math.round(18 * k), 'war', refresh);
    if (act === 'study') grow(g, Math.round(18 * k), 'int', refresh);
    if (act === 'drill') grow(g, Math.round(16 * k), 'lead', refresh);
    if (act === 'govern') { grow(g, Math.round(16 * k), 'pol', refresh); const c = G.cities[g.city]; if (c && c.owner === g.fac && r() < 0.3) { c.farm = Math.min(c.farmMax, c.farm + 1); c.comm = Math.min(c.commMax, c.comm + 1); } }
    if (act === 'rest') grow(g, 4, null, refresh);
    if (act === 'visit') { grow(g, Math.round(14 * k), 'int', refresh); const sage = here.find((x) => x !== g && x.life?.type === 'H' && x.base.int >= 75); if (sage && r() < 0.3) { grow(g, 30, 'int', refresh); note(G, g, 'visit', sage.name); } }
    if (act === 'travel' && g.status === 'free' && !busy(g)) { const c = G.cities[g.city]; if (c && c.adj.length) g.city = c.adj[Math.floor(r() * c.adj.length)]; grow(g, 10, null, refresh); }
    if (act === 'mentor' && L.mentor == null) {
      const fav = FAV[L.type], m = here.filter((x) => x !== g && x.follow == null && total(x) > total(g) + 40 && G.year - x.born > age + 8 && (x.fac === g.fac || x.status === 'free') && !x.life?.pupil).sort((a, b) => b.base[fav] - a.base[fav])[0];
      if (m && r() < 0.5) { L.mentor = m.id; (m.life || initLife(G, m)).pupil = g.id; note(G, g, 'mentor', m.name); note(G, m, 'pupil', g.name); }
      else grow(g, 8, fav, refresh);
    }
    if (act === 'duel') {
      const cand = here.filter((x) => x !== g && !x.isPlayer && x.follow == null && Math.abs(x.base.war - g.base.war) < 15), o = cand[Math.floor(r() * cand.length)];
      if (o) { const win = g.war + r() * 20 > o.war + r() * 20, [a, b] = win ? [g, o] : [o, g]; grow(a, 30, 'war', refresh); grow(b, 14, 'war', refresh); if ((b.base.war >= 85 && r() < 0.5) || r() < 0.04) { note(G, a, 'duelWin', b.name); if (a.base.war >= 85) note(G, b, 'duelLose', a.name); } }
      else grow(g, 12, 'war', refresh);
    }
    if (act === 'friend') {
      const cand = here.filter((x) => x !== g && x.fac === g.fac && x.status === g.status), o = cand[Math.floor(r() * cand.length)];
      if (o) { const LO = o.life || initLife(G, o); L.friends[o.id] = (L.friends[o.id] || 0) + 4 + Math.round(g.cha / 20); LO.friends[g.id] = (LO.friends[g.id] || 0) + 3;
        if (L.friends[o.id] >= 160 && L.sworn == null && LO.sworn == null && r() < 0.5) { L.sworn = o.id; LO.sworn = g.id; g.loyalty = Math.min(100, g.loyalty + 5); note(G, g, 'sworn', o.name); note(G, o, 'sworn', g.name); }
        trimFriends(L); }
      grow(g, 6, 'cha', refresh);
    }
    if (act === 'plot') { // the ambitious cool towards a weak lord, and gather the like-minded
      const f = G.factions[g.fac], lord = f && G.gens[f.lord]; if (lord && lord !== g && total(lord) < total(g)) g.loyalty = Math.max(10, g.loyalty - 2);
      grow(g, 10, 'cha', refresh);
    }
  }
}
const bestOf = (m) => ['lead', 'war', 'int', 'pol'].reduce((a, k) => (m.base[k] > m.base[a] ? k : a), 'lead');
function trimFriends(L) { const ks = Object.keys(L.friends); if (ks.length > 8) { ks.sort((a, b) => L.friends[a] - L.friends[b]); for (const k of ks.slice(0, ks.length - 8)) delete L.friends[k]; } }
// a battle: everyone who was in it learns from it
export function lifeBattle(G, gs, won, refresh) { for (const g of gs) if (g && g.status === 'serving' && !g.isPlayer) gainLife(G, g, (won ? 40 : 22) * (g.rivalHero ? 1 : 3), won ? 'lead' : 'war', refresh); }
// how one line of a general's chronicle reads
export function lifeLine([y, code, a]) {
  const S = { lead: '統率', war: '武力', int: '智力', pol: '政治', cha: '魅力' };
  return `${y}年　` + ({ mentor: `拜${a}為師`, pupil: `收${a}為徒`, mentorDied: `師父${a}去世`, visit: `拜訪名士${a}，受益良多`, duelWin: `與${a}比武，勝`, duelLose: `與${a}比武，敗`, sworn: `與${a}結為兄弟`, peak: `${S[a]}到達 90，成為一時之選`, join: `投效${a}`, took: `攻下${a}` }[code] || code);
}
