// 野生名馬: five famous horses run wild on the plains (data/horses.js), each in its own stretch of country. Walk near
// and it runs: always away from you, as fast as you walk, but never far from home, so the way to catch one is to drive
// it into a corner of its range (or against water and mountains). Reach it and it must be tamed: three tries, and
// each horse gives way to one thing (a firm hand, a gentle one, a clever trick, or something to eat), which the
// rumours on the road hint at. Two of three and it is yours: a treasure horse for anyone in the party.
import { T, WALK, CITY_POS } from './world.js';
import { WILD } from './data/horses.js';
import { horseSheet } from './sprites.js';
import { give } from './sim/engine.js';
import { deed } from './deeds.js';
import { traitsOf } from './traits.js';

const SEE = 32, SCARE = 5, LEASH = 14;
const WHERE = { north: '北方的草原', west: '西涼的荒原', south: '南方的原野' };
const TEMPER = { war: ['烈性如火，誰也騎不上去', '強騎'], cha: ['膽小怕生，一有人靠近就跑', '安撫'], int: ['聰明得很，陷阱都騙不了牠', '智取'], feed: ['貪吃得很，常偷吃農家的豆子', '餵食'] };
const DIRW = ['東', '東南', '南', '西南', '西', '西北', '北', '東北'];
const dirWord = (dx, dz) => DIRW[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const face = (x0, x) => (x > x0 ? 2 : 1);

export class Horses {
  constructor(game) { this.g = game; this.drawn = new Map(); this.mapRef = null; }
  get G() { return this.g.G; }
  get H() { return this.g.H; }
  ok(x, z) { const M = this.g.world, k = M.at(x, z); return !!WALK[k] && k !== T.CITY && k !== T.COUNTY && k !== T.VILLAGE && k !== T.CAVE; }
  // where each one runs (found once for a game: open ground in its part of the land, away from the towns)
  list() {
    const H = this.H, M = this.g.world; if (H.wild && Object.keys(H.wild).length === WILD.length) return H.wild; H.wild ||= {};
    for (const w of WILD) {
      if (H.wild[w[0]]) continue;
      for (let k = 0; k < 4000; k++) {
        const x = R(10, M.W - 10), z = R(10, M.H - 10), at = w[8];
        if (at === 'north' && z > M.H * 0.3) continue; if (at === 'west' && x > M.W * 0.35) continue; if (at === 'south' && z < M.H * 0.6) continue;
        if (![T.PLAIN, T.MEADOW, T.DESERT].includes(M.at(x, z)) || Object.values(CITY_POS).some((c) => Math.hypot(c.x - x, c.y - z) < 18)) continue;
        H.wild[w[0]] = { x, z, hx: x, hz: z, caught: false }; break;
      }
    }
    return H.wild;
  }
  // a step of the player: the horses graze, or run from him
  step() {
    if (!this.G || !this.g.world) return; const P = this.g.pos, L = this.list();
    for (const w of WILD) {
      const h = L[w[0]]; if (!h || h.caught) continue; const d = Math.hypot(h.x - P.x, h.z - P.z);
      if (d <= SCARE && this.g.mode === 'world') {
        let best = null, bd = d;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = h.x + dx, z = h.z + dz; if (!this.ok(x, z) || Math.hypot(x - h.hx, z - h.hz) > LEASH) continue; const e = Math.hypot(x - P.x, z - P.z); if (e > bd) { bd = e; best = [x, z]; } }
        if (best) { h.x = best[0]; h.z = best[1]; h.scared = true; } else h.scared = 'corner';
      } else if (Math.random() < 0.3) { const x = h.x + R(-1, 1), z = h.z + R(-1, 1); if (this.ok(x, z) && Math.hypot(x - h.hx, z - h.hz) <= LEASH * 0.7) { h.x = x; h.z = z; } h.scared = false; }
    }
  }
  tick(dt) {
    const game = this.g, V = game.view; if (!V || !this.G || !game.world) return;
    if (V.M !== this.mapRef) { this.mapRef = V.M; this.drawn.clear(); }
    if (game.mode !== 'world') return;
    const P = game.pos, L = this.list(), live = new Set();
    for (const w of WILD) {
      const h = L[w[0]]; if (!h || h.caught || Math.hypot(h.x - P.x, h.z - P.z) > SEE) continue;
      live.add(w[0]); let a = this.drawn.get(w[0]);
      if (!a) { a = V.addActor(horseSheet(w[5], w[6]), h.x, h.z, { scale: 1.1 }); V.sizeActor(a, 1.6, 1.6); a.label = V.addLabel(`<b style="color:#ffd86a">${w[1]}</b><i>野馬</i>`, a.sprite, 1.7, 'npc'); this.drawn.set(w[0], a); (this.H.seenHorse ||= {})[w[0]] = 1; }
      const k = Math.min(1, dt * (h.scared ? 9 : 4)), x0 = a.x; a.x += (h.x - a.x) * k; a.z += (h.z - a.z) * k;
      const mv = Math.hypot(h.x - a.x, h.z - a.z); if (Math.abs(a.x - x0) > 0.002) a.dir = face(x0, a.x);
      a.walkT = (a.walkT || 0) + (mv > 0.02 ? dt * 10 : 0); a.frame = mv > 0.02 ? Math.floor(a.walkT) % 3 : 1;
      a.y = Math.max(0, game.world.hAt(Math.round(a.x), Math.round(a.z))); V.placeActor(a);
    }
    for (const [k, a] of this.drawn) if (!live.has(k)) { V.removeActor(a); this.drawn.delete(k); }
  }
  // the player reaches one
  meet() {
    const game = this.g, P = game.pos; if (game.mode !== 'world' || game.auto?.on || !this.G) return false; const L = this.list();
    for (const w of WILD) { const h = L[w[0]]; if (!h || h.caught || Math.max(Math.abs(h.x - P.x), Math.abs(h.z - P.z)) > 1) continue; this.tame(w, h); return true; }
    return false;
  }
  async tame(w, h) {
    const game = this.g, ui = game.ui, H = this.H, me = game.me, [key, zh, , fx, arms, , , temper] = w;
    const eye = game.partyList().some((p) => traitsOf(p.g).includes('相馬'));
    const acts = [{ k: 'cha', n: '安撫', d: `慢慢靠近，輕聲安撫（魅力 ${me.cha}）` }, { k: 'war', n: '強騎', d: `跳上馬背，硬是不放（武力 ${me.war}）` }, { k: 'int', n: '智取', d: `設下繩套，等牠自投羅網（智力 ${me.int}）` }, { k: 'feed', n: '餵食', d: `拿兵糧餵牠（剩 ${H.items.rice || 0}）`, off: !(H.items.rice > 0) }];
    let ok = 0;
    await ui.say('', `是${zh}！\n${arms.d.split('：')[0]}——這就是傳說中的名馬。牠盯著你，鼻子噴著氣……${eye ? `\n（你看得出來：這匹馬${TEMPER[temper][0]}。）` : ''}`);
    for (let round = 0; round < 3 && ok < 2; round++) {
      const k = await ui.ask(`${zh}（第 ${round + 1} 次，成功 ${ok}/2）`, [...acts, { k: null, n: '放棄' }], zh); if (!k) break;
      if (k === 'feed') H.items.rice--;
      const stat = { cha: me.cha, war: me.war, int: me.int, feed: 70 }[k], p = k === temper ? 0.5 + stat / 250 : 0.1 + stat / 600;
      if (Math.random() < Math.min(0.95, p + (eye ? 0.1 : 0))) { ok++; await ui.say('', k === temper ? `${zh}的眼神柔和了下來，慢慢低下了頭。` : '牠猶豫了一下，沒有跑開。'); }
      else await ui.say('', { war: '牠人立而起，把你甩了下來！', cha: '牠根本不理你，扭頭就踢。', int: '牠一眼就看穿了繩套，跳了過去。', feed: '牠聞了聞，嫌棄地走開了。' }[k] + (k !== temper ? `\n（看來這匹馬不吃這一套。）` : ''));
    }
    if (ok < 2) {
      // it bolts, somewhere else in its range
      for (let t = 0; t < 30; t++) { const x = h.hx + R(-LEASH, LEASH), z = h.hz + R(-LEASH, LEASH); if (this.ok(x, z) && Math.hypot(x - game.pos.x, z - game.pos.z) > 8) { h.x = x; h.z = z; break; } }
      await ui.say('', `${zh}長嘶一聲，跑得無影無蹤了……`); return;
    }
    h.caught = true; const list = game.partyList();
    const i = list.length > 1 ? await ui.choose(list.map((p, i) => ({ k: i, n: p.g.name, sub: `統${p.g.lead} 武${p.g.war}` })), { title: `誰來騎${zh}？` }) ?? 0 : 0;
    const G = this.G, it = { id: G.items.length, key, zh, en: w[2], slot: 'h', fx, teaches: [], holder: null, fac: null, city: null };
    for (const o of G.items.filter((x) => x.holder === list[i].g.id && x.slot === 'h')) { o.holder = null; o.city = list[i].g.city; }   // (the old one goes to the stables of his city)
    G.items.push(it); give(G, it, list[i].g); game.audio.sfx('level'); deed(game, `收服名馬${zh}`, true);
    await ui.say('', `收服了${zh}！\n${list[i].g.name}騎上了${zh}。\n（${Object.entries(fx).map(([k, v]) => ({ lead: '統率', war: '武力', int: '智力', cha: '魅力', pol: '政治' }[k] + ' +' + v)).join('、')}；${arms.d}）`);
    game.hud();
  }
  // what is said on the road about them
  rumor(x, z) {
    const L = this.H?.wild; if (!L) return null; const left = WILD.filter((w) => L[w[0]] && !L[w[0]].caught); if (!left.length) return null;
    const w = left[Math.floor(Math.random() * left.length)], h = L[w[0]];
    return Math.random() < 0.5 ? `聽說${dirWord(h.hx - x, h.hz - z)}邊${WHERE[w[8]]}上有一匹${w[1]}，誰也抓不到。` : `聽說那匹${w[1]}${TEMPER[w[7]][0]}。`;
  }
  marks(x, s) { const L = this.H?.wild; if (!L) return; for (const w of WILD) { const h = L[w[0]]; if (!h || h.caught || !this.H.seenHorse?.[w[0]]) continue; x.fillStyle = '#ffd86a'; x.beginPath(); x.arc(h.hx * s, h.hz * s, 3, 0, Math.PI * 2); x.fill(); } }
}
