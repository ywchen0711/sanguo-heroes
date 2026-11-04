// Disasters as the player meets them: the simulation's locusts, floods, plagues and earthquakes linger in a city for a
// few months. A famine makes food dear and the starving crowd the streets — open the granaries, buy grain for them, or
// sell your own at ten times the price; a plague sickens a party that walks in, unless a healer is with it; a
// famished garrison fights badly, so a disaster is also a chance for a siege. A comet foretells a great man's death.
import { deed, bump, checkTitles, hasT } from './deeds.js';

const DUR = { locust: 4, flood: 3, plague: 2, quake: 2 };
export const DIS_N = { locust: '蝗災', flood: '水災', plague: '瘟疫', quake: '地震' };
export const famine = (k) => k === 'locust' || k === 'flood';
// a city's disaster now, or null
export function disasterAt(game, cid) { const d = game.H.dis?.[cid]; return d && d.until > game.G.t ? d : null; }
// the month's news: note where disaster struck, and what a comet means for those close to the player
export function noteDisasters(game, logs) {
  const H = game.H, G = game.G; H.dis ||= {};
  for (const e of logs) {
    if (DUR[e.key] && e.city != null) H.dis[e.city] = { k: e.key, until: G.t + DUR[e.key], helped: false };
    if (e.key === 'comet') { const g = G.byName[e.p.g], mine = game.myFaction(); if (g && (H.party.includes(g.id) || (H.sworn || []).includes(g.id) || (mine && G.factions[mine].lord === g.id && !game.isLord()))) setTimeout(() => game.ui.toast(`<b style="color:#c8a0ff">觀星者說，這顆彗星應在${g.name}身上……</b><br><small>聽說管輅能替人延壽</small>`, 6000), 2500); }
  }
}
// prices in a hungry city
export function priceMul(game, cid) { const d = cid != null && disasterAt(game, cid); return (d && famine(d.k) ? 1.6 : 1) * (hasT(game.H, 'renyi') ? 0.9 : 1); }
// the garrison of a stricken city is weaker
export const garrisonMul = (game, cid) => { const d = disasterAt(game, cid); return d ? (famine(d.k) ? 0.78 : d.k === 'plague' ? 0.85 : 0.92) : 1; };
// walking into a stricken city
export async function enterStricken(game, C) {
  const H = game.H, G = game.G, ui = game.ui, d = disasterAt(game, C.id); if (!d) return false;
  const mine = game.myFaction(), own = mine && C.owner === mine, f = own && G.factions[mine];
  if (d.k === 'plague') {
    const healer = game.partyList().some((p) => p.g.spells.includes('zhi') || p.g.name === '華佗') || hasT(H, 'xuanhu');
    if (!healer && !d.sick) { d.sick = true; for (const p of game.partyList()) p.rec.sol = Math.max(10, Math.round(p.rec.sol * 0.88)); ui.toast(`<b style="color:#c8a0ff">${C.name}正在鬧瘟疫，隊伍裡有人病倒了（兵力 -12%）</b>`, 4000); }
    if (d.helped) return false;
    const canCure = game.partyList().some((p) => p.g.spells.includes('zhi')) || (H.items.med2 || 0) >= 2;
    const c = await ui.ask(`${C.name}爆發了瘟疫，街上到處是病倒的人，哭聲不斷。`, [{ k: 'cure', n: canCure ? '救治病人' : '救治病人（需要治癒之術或金創藥兩份）', off: !canCure }, { k: 'gold', n: '捐錢請大夫（200 金）', off: H.gold < 200 }, { k: null, n: '趕快離開這裡' }]);
    if (!c) return true;
    if (c === 'cure') { if (!game.partyList().some((p) => p.g.spells.includes('zhi'))) H.items.med2 -= 2; await game.act.passDays(3); }
    else H.gold -= 200;
    d.helped = true; C.morale = Math.min(100, C.morale + 8); H.fame += c === 'cure' ? 45 : 25; bump(H, 'ren'); bump(H, 'relief');
    if (own && game.me.status === 'serving') { game.me.merit += 8; game.act.promote(); }
    deed(game, `${C.name}大疫，${game.me.name}${c === 'cure' ? '親自救治，活者甚眾' : '捐金延醫'}`);
    await ui.say('', `${c === 'cure' ? '你們花了三天，救治了上百名病人。' : '你出錢請來了大夫。'}\n百姓們跪在路邊感謝你。（名聲 +${c === 'cure' ? 45 : 25}，${C.name}民心 +8）`);
    checkTitles(game); return true;
  }
  if (!famine(d.k) || d.helped) return false;
  const rice = H.items.rice || 0;
  const opts = [...(own && f ? [{ k: 'granary', n: `開倉賑災（勢力糧 ${f.food}，用 1500）`, off: f.food < 1500 }] : []), { k: 'buy', n: '出錢買糧施粥（300 金）', off: H.gold < 300 }, ...(rice ? [{ k: 'sell', n: `把兵糧高價賣給饑民（${rice} 份，每份 400 金）` }] : []), { k: null, n: '視而不見' }];
  const c = await ui.ask(`${C.name}遭了${DIS_N[d.k]}，田裡顆粒無收。\n城門口擠滿了逃荒的饑民，糧價漲了好幾倍。`, opts);
  if (!c) return true;
  d.helped = true;
  if (c === 'sell') { H.items.rice = 0; H.gold += rice * 400; H.fame = Math.max(0, H.fame - 25); bump(H, 'cruel'); C.morale = Math.max(0, C.morale - 5); deed(game, `${C.name}饑荒，${game.me.name}囤糧高價賣給饑民`); await ui.say('', `賺了 ${rice * 400} 金。\n饑民們背地裡都在罵你。（名聲 -25）`); checkTitles(game); return true; }
  if (c === 'granary') { f.food -= 1500; C.morale = Math.min(100, C.morale + 15); H.fame += 50; game.me.merit += 12; game.act.promote(); }
  else { H.gold -= 300; C.morale = Math.min(100, C.morale + 8); H.fame += 35; }
  bump(H, 'ren'); bump(H, 'relief');
  deed(game, `${C.name}饑荒，${game.me.name}${c === 'granary' ? '開倉賑濟' : '出錢施粥'}，活者甚眾`);
  await ui.say('', `${c === 'granary' ? '糧倉打開了，饑民們排著長隊領糧。' : '你在城門口搭起粥棚，從早到晚施粥。'}\n「恩公！您是活菩薩啊！」（名聲 +${c === 'granary' ? 50 : 35}，${C.name}民心 +${c === 'granary' ? 15 : 8}）`);
  checkTitles(game); return true;
}
