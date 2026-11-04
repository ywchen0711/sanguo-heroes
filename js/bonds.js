// The people in a general's life. Companions grow close fighting side by side and drinking together, and once close
// enough they may swear brotherhood in the manner of the peach garden; a sworn brother's death sends the party into a
// grief-stricken fury, and his killer becomes the man to hunt down. A general who beats you three times — or whom
// you beat three times — becomes your rival, and the two of you fight the harder whenever you meet.
import { deed, checkTitles, hasT } from './deeds.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const bondOf = (H, id) => (H.bond || {})[id] || 0;
export const isSworn = (H, id) => (H.sworn || []).includes(id);
export const isRival = (H, id) => (H.rivals || []).includes(id);

export function addBond(game, id, n) {
  const H = game.H; H.bond ||= {};
  const cap = H.party.includes(id) || isSworn(H, id) ? 100 : 40;
  H.bond[id] = Math.min(cap, (H.bond[id] || 0) + n);
}
// after a fight or a drink: a companion close enough is ready to swear brotherhood
export async function offerOaths(game) {
  const H = game.H, G = game.G, ui = game.ui;
  for (const id of H.party) {
    const x = G.gens[id]; if (isSworn(H, id) || bondOf(H, id) < 100 || (H.oathAsked || {})[id] === G.year) continue;
    (H.oathAsked ||= {})[id] = G.year;
    await ui.say(x.name, pick([`${game.me.name}，我們出生入死這麼久，我早就把你當成親兄弟了。`, '這一路走來，同甘共苦。你我何不效法古人，結為兄弟？', '亂世之中，能有一個真心相待的人，不容易啊。']), game.lookOf(x));
    if (!await ui.yesno(`要和${x.name}結為異姓兄弟嗎？`)) { await ui.say(x.name, '……也好。不管怎樣，我都會跟著你。', game.lookOf(x)); continue; }
    await swear(game, x);
  }
}
export async function swear(game, x, quiet) {
  const H = game.H, me = game.me; H.sworn ||= []; if (H.sworn.includes(x.id)) return;
  H.sworn.push(x.id); x.loyalty = 100; x.sworn = true; H.bond ||= {}; H.bond[x.id] = 100;
  if (!quiet) {
    await game.ui.say('', `${me.name}與${x.name}焚香禱告，對天盟誓：\n「雖然異姓，結為兄弟，同心協力，救困扶危。不求同年同月同日生，但願同年同月同日死。」`);
    game.ui.toast(`<b style="color:#ffd86a">${me.name}與${x.name}結為兄弟！</b><br><small>同隊作戰時攻擊上升；兄弟不會離隊</small>`, 5000);
    game.audio?.sfx('level');
  }
  deed(game, `與${x.name}結為兄弟`, true); checkTitles(game);
}
// the month's deaths: a sworn brother gone is grief, then fury, and a name to hunt
export async function mourn(game) {
  const H = game.H, G = game.G;
  for (const id of H.sworn || []) {
    const x = G.gens[id]; if (!x || x.status !== 'dead' || (H.mourned || []).includes(x.id)) continue;
    const e = [...G.log].reverse().find((l) => l.kind === 'death' && l.p.g === x.name) || { p: {} };
    (H.mourned ||= []).push(x.id); H.rage = 3;
    const by = e.p.by && G.byName[e.p.by];
    if (by && by.status !== 'dead') { H.vendetta = by.id; deed(game, `義弟${x.name}死於${by.name}之手，${game.me.name}誓報此仇`, true); }
    else deed(game, `義弟${x.name}卒，${game.me.name}痛哭不已`, true);
    if (H.party.includes(x.id)) { H.party = H.party.filter((i) => i !== x.id); game.respawnParty(); }
    await game.ui.say('', `噩耗傳來：結義兄弟${x.name}${by ? `死在${by.name}手中` : '去世了'}……\n${game.me.name}悲痛欲絕。${by ? `\n「${by.name}！此仇不報，誓不為人！」` : ''}\n（之後三場戰鬥，全隊攻擊大幅上升）`);
  }
}
// wins and losses against a named general; three either way makes a rival
export function versus(game, gid, won) {
  const H = game.H, G = game.G, x = G.gens[gid]; if (!x || x.isPlayer || H.party.includes(gid)) return;
  H.vs ||= {}; const v = H.vs[gid] ||= { w: 0, l: 0 }; won ? v.w++ : v.l++;
  if (!isRival(H, gid) && (v.l >= 3 || v.w >= 3)) {
    (H.rivals ||= []).push(gid);
    deed(game, `與${x.name}${v.l >= 3 ? '屢戰屢敗' : '屢次交鋒'}，結為宿敵`);
    game.ui.toast(`<b style="color:#ff9a6a">${x.name}成了你的宿敵！</b><br><small>再次交手時，雙方都會全力以赴</small>`, 5000);
  }
  if (won && H.vendetta === gid && x.status === 'dead') { H.vendetta = null; deed(game, `手刃${x.name}，為兄弟報了大仇`, true); }
}
// what the people in your life bring to a battle: { atk, foeAtk, lines }
export function battleMods(game, foes) {
  const H = game.H, G = game.G, o = { atk: 1, foeAtk: 1, lines: [] };
  const swornIn = H.party.some((id) => isSworn(H, id));
  if (swornIn) o.atk *= hasT(H, 'yibo') ? 1.1 : 1.05;
  if (H.rage > 0) { o.atk *= 1.4; o.lines.push('為兄弟報仇！全軍悲憤，攻擊大幅上升！'); H.rage--; }
  for (const f of foes) {
    if (f.gid == null) continue;
    if (H.vendetta === f.gid) { o.atk *= 1.25; o.lines.push(`${f.name}！納命來！`); }
    else if (isRival(H, f.gid)) { o.atk *= 1.1; o.foeAtk *= 1.1; o.lines.push(`${f.name}：「又是你！今天做個了斷！」`); }
  }
  return o;
}
// a night of drinking with the companions at the tavern
export async function drink(game) {
  const H = game.H, ui = game.ui, n = H.party.length; if (!n) { ui.toast('沒有同伴可以一起喝酒'); return; }
  const cost = 10 * (n + 1); if (H.gold < cost) { ui.toast('錢不夠'); return; }
  if (H.drankDay === H.days) { await ui.say('酒館老闆', '各位今天已經喝了不少了，明天再來吧。'); return; }
  H.gold -= cost; H.drankDay = H.days;
  const x = game.G.gens[pick(H.party)];
  const talk = pick([`${x.name}喝得滿臉通紅，說起了小時候的事。`, `${x.name}舉杯說：「願天下早日太平！」`, `${x.name}和你比起了酒量，最後兩個人都醉倒了。`, `${x.name}唱起了家鄉的歌，大家都安靜下來聽。`, `${x.name}說：「跟著你，是我這輩子做得最對的事。」`, `${x.name}和店小二吵了起來，你好不容易才把他勸住。`]);
  for (const id of H.party) addBond(game, id, 8 + Math.floor(Math.random() * 5));
  await ui.say('', `和同伴們痛飲了一晚。（${cost} 金）\n${talk}\n（同伴的好感上升了）`);
  await offerOaths(game);
}
// a panel: who the player's general is close to, sworn to, and against
export function bondsHTML(game) {
  const H = game.H, G = game.G, row = (id, tag) => { const x = G.gens[id]; if (!x) return ''; const b = bondOf(H, id), v = (H.vs || {})[id]; return `<div class="rf"><b>${x.name}</b><span>${tag}</span><span>${x.status === 'dead' ? '已故' : x.status === 'serving' ? (G.factions[x.fac]?.name || '') + '軍' : '在野'}</span>${v ? `<span>${v.w} 勝 ${v.l} 敗</span>` : `<span class="bar"><i style="width:${b}%"></i></span>`}</div>`; };
  const sw = (H.sworn || []).map((id) => row(id, '結義兄弟')).join(''), rv = (H.rivals || []).map((id) => row(id, H.vendetta === id ? '仇人' : '宿敵')).join('');
  const pa = H.party.filter((id) => !isSworn(H, id)).map((id) => row(id, `好感 ${bondOf(H, id)}`)).join('');
  const vd = H.vendetta != null && !(H.rivals || []).includes(H.vendetta) ? row(H.vendetta, '仇人') : '';
  return `${sw ? `<h4>結義兄弟</h4>${sw}` : ''}${pa ? `<h4>同伴（好感到 100 可以結義）</h4>${pa}` : ''}${rv || vd ? `<h4>宿敵與仇人</h4>${rv}${vd}` : ''}${!sw && !pa && !rv && !vd ? '<p>還沒有特別的人際關係。和同伴一起戰鬥、到酒館喝酒，好感就會上升。</p>' : ''}`;
}
