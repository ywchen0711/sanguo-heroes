// Strange and gifted people who wander the realm: 左慈 the trickster immortal, 管輅 who reads fates (and knows how
// to beg the Northern Dipper for more years), 南華老仙 who gives a book from heaven to the worthy, and two of the
// simulation's own: the healer 華佗 and the Taoist 于吉. Where the wanderers are changes every few months; the
// tavern hears rumours of them.
import { LOOKS } from './sprites.js';
import { give } from './sim/engine.js';
import { itemName, spellName } from './sim/text.js';
import { deed, changed, bump, checkTitles, FAMOUS } from './deeds.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const SAGES = {
  zuoci: { n: '左慈', look: () => ({ ...LOOKS.villager('左慈'), body: '#e8e8f0', cape: '#5a5a8a', hat: 'taoist', hatC: '#3a3a5a', beard: 'long', beardC: '#e8e8e8', hair: '#d8d8d8', lady: false, wpn: 'staff', key: 'sage-zuoci' }), every: 3, where: 'city' },
  guanlu: { n: '管輅', look: () => ({ ...LOOKS.villager('管輅'), body: '#5a4a8a', cape: '#2a2a4a', hat: 'scholar', hatC: '#2a2a3a', beard: 'goatee', beardC: '#3a3a3a', lady: false, key: 'sage-guanlu' }), every: 4, where: 'town' },
  nanhua: { n: '南華老仙', look: () => ({ ...LOOKS.villager('南華'), body: '#f0f0e0', cape: '#8ab88a', hat: 'taoist', hatC: '#e8e8d8', beard: 'long', beardC: '#ffffff', skin: '#f8dcc0', hair: '#f0f0f0', lady: false, wpn: 'staff', key: 'sage-nanhua' }), every: 12, where: 'cave' },
};
// where a wanderer is this season: one city (or county, or deep cave) picked by the date
export function sageWhere(game, id) {
  const S = SAGES[id], G = game.G, W = game.world, k = Math.floor(G.t / S.every), h = hash(id + k);
  if (S.where === 'city') { const cs = G.cities.filter((c) => c.size >= 2); return { city: cs[h % cs.length].id }; }
  if (S.where === 'town') { const opts = [...G.cities.map((c) => ({ city: c.id })), ...W.places.filter((q) => q.kind === 'county').map((q) => ({ place: q.id }))]; return opts[h % opts.length]; }
  const caves = W.places.filter((q) => q.kind === 'cave' && q.tier >= 2); return { place: caves[h % caves.length].id };
}
export function sagesHere(game) {
  const M = game.town; if (!M) return [];
  return Object.keys(SAGES).filter((id) => { const w = sageWhere(game, id); return M.place ? w.place === M.place.id : w.city === M.city; }).filter((id) => !(id === 'nanhua' && game.H.nanhua));
}
export function sageRumor(game) {
  const id = pick(Object.keys(SAGES).filter((x) => !(x === 'nanhua' && game.H.nanhua))), w = sageWhere(game, id), G = game.G, W = game.world;
  const at = w.city != null ? G.cities[w.city].name : W.places[w.place].name;
  return { zuoci: `聽說有個瞎了一隻眼、跛了一隻腳的道人在${at}出沒，會變戲法，還能從空盤子裡釣出鱸魚。`, guanlu: `有個叫管輅的術士在${at}替人算命，聽說非常靈驗，連生死都算得出來。`, nanhua: `樵夫說在「${at}」的深處見過一位碧眼童顏的老神仙。`, }[id];
}
// ---------------------------------------------------------------- meeting one
export async function meetSage(game, id) {
  const H = game.H, G = game.G, ui = game.ui, me = game.me, S = SAGES[id], look = S.look(); H.sageMet ||= {};
  const once = (key) => { if (H.sageMet[key] === G.year) return false; H.sageMet[key] = G.year; return true; };
  if (id === 'zuoci') {
    if (!once('zuoci')) { await ui.say('左慈', '哈哈，又見面了。今年的緣分已經盡了，明年再來吧。', look); return; }
    await ui.say('左慈', `${me.name === '曹操' ? '孟德，你殺人無數，還想求仙？' : '貧道左慈，在峨眉山修道三十年。'}\n（他把一個空盤子放在桌上，竟然從裡面釣出一條鮮活的鱸魚！）`, look);
    const c = await ui.ask('「我這裡有三樣東西，你只能挑一樣。」', [{ k: 'book', n: '遁甲天書' }, { k: 'pill', n: '仙丹' }, { k: 'word', n: '一句忠告' }], '左慈', look);
    if (c === 'book') {
      const learn = ['dun', 'huan'].filter((x) => !me.spells.includes(x));
      if (me.int >= 40 && learn.length) { const sp = learn[0]; me.spells.push(sp); deed(game, `遇左慈，得傳${spellName(sp)}之術`); await ui.say('左慈', `你還算有點慧根。這招「${spellName(sp)}」，好好修習吧。\n（學會了法術「${spellName(sp)}」）`, look); game.audio.sfx('level'); }
      else { H.items.pill = (H.items.pill || 0) + 1; await ui.say('左慈', learn.length ? '你的資質讀不懂天書。這顆仙丹給你吧。（仙丹 +1）' : '天書上的東西你都會了。這顆仙丹給你吧。（仙丹 +1）', look); }
    }
    if (c === 'pill') { H.items.pill = (H.items.pill || 0) + 2; await ui.say('左慈', '吃了它，再重的傷也能好。（仙丹 +2）', look); }
    if (c === 'word') await ui.say('左慈', foresight(game), look);
    bump(H, 'sages'); checkTitles(game); return;
  }
  if (id === 'guanlu') {
    const c = await ui.ask('「我管輅替人算命，不收錢，只看緣分。你要問什麼？」', [{ k: 'fate', n: '問天下大勢' }, { k: 'life', n: '問生死（延壽）' }, { k: 'me', n: '問自己的前程' }, { k: null, n: '告辭' }], '管輅', look);
    if (c === 'fate') await ui.say('管輅', fate(game), look);
    if (c === 'me') await ui.say('管輅', future(game), look);
    if (c === 'life') await prolong(game, look);
    if (c && once('guanlu')) { bump(H, 'sages'); checkTitles(game); }
    return;
  }
  if (id === 'nanhua') {
    if (H.fame < 150) { await ui.say('', '一位碧眼童顏的老人看了你一眼，搖搖頭，化作一陣清風消失了。\n（名聲還不夠。名聲 150 以上再來吧）'); return; }
    await ui.say('南華老仙', `我是南華老仙。你在亂世之中闖出了名號，我等你很久了。\n此書名為《太平要術》，得此書，當代天宣化，普救世人；若萌異心，必獲惡報。`, look);
    const c = await ui.ask('要怎麼回答老仙？', [{ k: 'save', n: '「我願以此書普救世人。」' }, { k: 'rule', n: '「得此書者，當為天下之主！」' }], '南華老仙', look);
    H.nanhua = true;
    const tp = G.items.find((it) => it.key === 'taiping');
    if (tp && tp.holder == null) give(G, tp, me);
    for (const sp of c === 'save' ? ['zhi', 'feng'] : ['lei', 'yao']) if (!me.spells.includes(sp)) me.spells.push(sp);
    if (c === 'save') { bump(H, 'ren', 3); H.fame += 60; me.base.int = Math.min(100, me.base.int + 3); }
    else { bump(H, 'cruel', 2); H.fame += 30; me.base.lead = Math.min(100, me.base.lead + 3); }
    game.act.refreshMe();
    deed(game, `遇南華老仙，得天書${tp && tp.holder === me.id ? `《${itemName(tp.key)}》` : ''}`, true); bump(H, 'sages'); checkTitles(game);
    await ui.say('', `老仙把書交給你，化作一陣清風而去。\n${tp && tp.holder === me.id ? `得到了「${itemName(tp.key)}」！\n` : ''}學會了法術「${(c === 'save' ? ['zhi', 'feng'] : ['lei', 'yao']).map(spellName).join('」「')}」！${c === 'save' ? '\n智力 +3' : '\n統率 +3'}`);
    game.audio.sfx('level');
  }
}
// what is coming: the next turn of history the player can take part in, and a famous life near its end
function foresight(game) {
  const G = game.G, lines = [];
  const near = FAMOUS.map((n) => G.byName[n]).filter((g) => g && (g.status === 'serving' || g.status === 'free') && !g.isPlayer && g.died <= G.year + 2).sort((a, b) => a.died - b.died)[0];
  if (near) lines.push(`我看${near.name}的將星黯淡，大概活不過${near.died}年了。要救他，去找管輅吧。`);
  const next = game.story.upcoming(); if (next) lines.push(next);
  lines.push(pick(['記住：做人留一線，日後好相見。', '天下大勢，分久必合，合久必分。', '不要小看路邊的乞丐。']));
  return lines.join('\n');
}
function fate(game) {
  const G = game.G, fs = Object.values(G.factions).filter((f) => f.alive).map((f) => ({ f, n: G.cities.filter((c) => c.owner === f.id).length })).sort((a, b) => b.n - a.n);
  if (!fs.length) return '天下大亂，群龍無首。';
  const [a, b] = fs; return `紫微星照在${a.f.name}的上空。${b ? `${b.f.name}和它分庭抗禮，` : ''}${a.n >= 25 ? '不出十年，天下將歸於一。' : '天下還要亂上很多年。'}`;
}
function future(game) {
  const H = game.H, G = game.G, me = game.me, left = H.endYear - G.year, sc = H.fame + me.merit * 2 + H.st.cities.length * 200;
  return `你還有 ${left} 年。${sc > 3000 ? '你的命格貴不可言，將來必定名留青史。' : sc > 1000 ? '你會成為一方豪傑，但要成大業，還差得遠。' : '你的命格平平，要多立戰功、多結善緣。'}\n${(H.rivals || []).length ? `小心${G.gens[H.rivals[0]].name}，他是你命中的剋星。` : ''}`;
}
// 南斗注生，北斗注死: offer wine and venison to the two old men playing go under the mulberry tree, and a name gets more years
async function prolong(game, look) {
  const H = game.H, G = game.G, ui = game.ui, mine = game.myFaction(), f = mine && G.factions[mine];
  const who = [...H.party, ...(H.sworn || []), ...(f ? [f.lord] : [])].map((id) => G.gens[id]).filter((g, i, a) => g && !g.isPlayer && g.status !== 'dead' && a.indexOf(g) === i && g.died <= G.year + 3 && !(H.prolonged || []).includes(g.id));
  if (!who.length) { await ui.say('管輅', '你身邊的人都還有好些年可活，不必擔心。', look); return; }
  const g = who[0];
  await ui.say('管輅', `${g.name}的大限就在${g.died}年。\n不過……南斗注生，北斗注死。明天南山的大桑樹下，有兩位老人在下棋，北邊那位是北斗星君。\n你帶上美酒和鹿肉，靜靜地替他們斟酒，等他們吃完了，再求情。`, look);
  if (!await ui.yesno(`要去求北斗星君替${g.name}延壽嗎？（需要美酒一壺、300 金，花七天）`)) return;
  if ((H.items.wine || 0) < 1 || H.gold < 300) { await ui.say('管輅', '美酒和鹿肉都沒有，怎麼求神仙？（要美酒一壺和 300 金）', look); return; }
  H.items.wine--; H.gold -= 300; await game.act.passDays(7);
  (H.prolonged ||= []).push(g.id); g.died += 12;
  await ui.say('', `兩位老人吃完了酒肉，北邊的老人嘆了口氣，拿出生死簿，在${g.name}的名字旁邊寫了個「九」字。\n「吃了人家的東西，總要還人情。」\n${g.name}的壽命延長了十二年！`);
  deed(game, `求北斗星君，為${g.name}延壽`, true);
  if (FAMOUS.includes(g.name)) changed(game, `${g.name}得以延壽，沒有在${g.died - 12}年去世`);
}
// ---------------------------------------------------------------- the healer and the Taoist, who are generals of the simulation
export function sageOpts(x) { return x.name === '華佗' ? [{ k: 'heal', n: '求醫' }, { k: 'wuqin', n: '學五禽戲' }] : x.name === '于吉' ? [{ k: 'fu', n: '求符水' }] : []; }
export async function sageGen(game, x, k) {
  const H = game.H, G = game.G, ui = game.ui, look = game.lookOf(x), me = game.me; H.sageMet ||= {};
  if (k === 'heal') { const w = H.wound > G.t; for (const p of game.partyList()) p.rec.sol = p.solMax; H.wound = 0; await ui.say('華佗', w ? '傷到了筋骨……忍著點，我替你刮骨療毒。\n（你咬著牙一聲不吭。傷完全好了，全隊兵力回復）' : '你們的傷兵我都看過了，休養幾天就好。（全隊兵力回復）', look); return; }
  if (k === 'wuqin') {
    if (H.sageMet.wuqin) { await ui.say('華佗', '五禽戲你已經學會了，每天練習就好。', look); return; }
    H.sageMet.wuqin = true; await game.act.passDays(5);
    for (const p of game.partyList()) for (const s of ['lead', 'war']) if (p.g.base[s] < 100) p.g.base[s]++;
    game.act.refreshMe(); bump(H, 'sages'); checkTitles(game); deed(game, '從華佗學五禽戲');
    await ui.say('華佗', '虎、鹿、熊、猿、鳥，模仿五種動物活動身體。\n（五天之後，全隊統率、武力 +1）', look); return;
  }
  if (k === 'fu') {
    if (H.sageMet.fu === G.t) { await ui.say('于吉', '符水一個月只能喝一次。', look); return; }
    H.sageMet.fu = G.t; for (const p of game.partyList()) { p.rec.sol = p.solMax; p.rec.sp = p.spMax; } H.wound = 0;
    let more = '';
    if (me.int >= 60 && !me.spells.includes('zhi') && !H.sageMet.fuSpell) { H.sageMet.fuSpell = true; me.spells.push('zhi'); more = '\n于吉看你資質不錯，傳授了「治癒」之術！'; deed(game, '從于吉學治癒之術'); bump(H, 'sages'); checkTitles(game); }
    await ui.say('于吉', `喝下這碗符水，百病全消。\n（全隊完全回復）${more}`, look);
  }
}
