// What the player's general did, as the histories would record it: deeds dated by the reign names of the age, the
// titles people gave them (which change how the world treats them), the history they rewrote, and at the end a
// biography in the manner of the Records of the Three Kingdoms (列傳), with the historian's verdict (評曰).
import { RANKS } from './hero.js';

// ---------------------------------------------------------------- reign names: Han until 220, then Wei, then Jin
const ERAS = [[184, '中平'], [190, '初平'], [194, '興平'], [196, '建安'], [220, '黃初'], [227, '太和'], [233, '青龍'], [237, '景初'], [240, '正始'], [249, '嘉平'], [254, '正元'], [256, '甘露'], [260, '景元'], [264, '咸熙'], [265, '泰始'], [275, '咸寧'], [280, '太康'], [290, '太熙'], [291, '元康'], [300, '永康']];
const NUM = '〇一二三四五六七八九十';
const cn = (n) => (n === 1 ? '元' : n <= 10 ? NUM[n] : n < 20 ? '十' + NUM[n - 10] : NUM[Math.floor(n / 10)] + '十' + (n % 10 ? NUM[n % 10] : ''));
export function era(y) { let e = ERAS[0]; for (const x of ERAS) if (y >= x[0]) e = x; return `${e[1]}${cn(y - e[0] + 1)}年`; }

// ---------------------------------------------------------------- deeds
export function deed(game, text, big) {
  const H = game.H, G = game.G; H.deeds ||= [];
  H.deeds.push({ y: G.year, m: G.month, t: text, big: !!big }); if (H.deeds.length > 240) H.deeds.splice(1, 1);
}
// a page of history rewritten by the player
export function changed(game, text) {
  const H = game.H, G = game.G; H.changed ||= [];
  if (H.changed.some((c) => c.t === text)) return;
  H.changed.push({ y: G.year, t: text }); deed(game, text, true);
  game.ui.toast(`<b style="color:#ff9a6a">歷史改變了：${text}</b>`, 5000);
}
export const stat = (H, k) => (H.st[k] ||= 0);
export const bump = (H, k, n = 1) => { H.st[k] = (H.st[k] || 0) + n; };

// ---------------------------------------------------------------- titles: earned by what one does, and they change how the world treats you
export const TITLES = [
  { id: 'wanren', n: '萬人敵', d: '戰鬥中攻擊 +5%；敵將聽到你的名字會膽寒', ok: (H) => H.st.kills.length >= 5 || H.st.duels >= 15 },
  { id: 'wushuang', n: '一騎當千', d: '一騎討時體力 +15%', ok: (H) => H.st.duels >= 30 },
  { id: 'renyi', n: '仁義之士', d: '招募成功率 +10%，買東西打九折', ok: (H) => stat(H, 'ren') >= 8 },
  { id: 'jianu', n: '三姓家奴', d: '反覆無常：招募與仕官的成功率下降', bad: true, ok: (H) => stat(H, 'turns') >= 3 },
  { id: 'canbao', n: '殘暴之徒', d: '招募成功率下降；但賊寇聞風而逃，野外遇敵減少', bad: true, ok: (H) => stat(H, 'cruel') >= 5 },
  { id: 'zhiduo', n: '神機妙算', d: '策略威力 +10%', ok: (H) => stat(H, 'tacs') >= 60 },
  { id: 'tanxian', n: '探險奇才', d: '寶箱更容易開出名寶', ok: (H) => stat(H, 'caves') >= 5 },
  { id: 'xiake', n: '江湖俠客', d: '討伐任務的報酬 +25%', ok: (H) => H.st.bandits >= 60 || H.st.missions >= 15 },
  { id: 'gongcheng', n: '攻城名將', d: '攻城時攻擊 +10%', ok: (H) => H.st.cities.length >= 5 },
  { id: 'baizhan', n: '百戰之將', d: '戰鬥經驗 +10%', ok: (H) => H.st.wins >= 150 },
  { id: 'bowen', n: '博聞強識', d: '打聽消息時，一次聽到更多', ok: (H) => Object.keys(H.dex || {}).length >= 150 },
  { id: 'yibo', n: '義薄雲天', d: '結義兄弟同隊時，全隊攻擊 +10%', ok: (H) => (H.sworn || []).length >= 2 },
  { id: 'xuanhu', n: '懸壺濟世', d: '瘟疫不會傷到你的隊伍', ok: (H) => stat(H, 'relief') >= 3 },
  { id: 'xianyuan', n: '仙緣', d: '策略消耗的策略點 -20%', ok: (H) => stat(H, 'sages') >= 3 },
  { id: 'bazhu', n: '一方霸主', d: '名聲每月 +3', ok: (H, game) => game.isLord() && game.G.cities.filter((c) => c.owner === game.myFaction()).length >= 10 },
];
export const hasT = (H, id) => !!H?.titles?.includes(id);
export const titleName = (id) => TITLES.find((t) => t.id === id)?.n || '';
// the best title to be known by: the last good one earned
export const knownAs = (H) => { const ts = (H.titles || []).map((id) => TITLES.find((t) => t.id === id)).filter(Boolean); return (ts.filter((t) => !t.bad).pop() || ts.pop())?.n || ''; };
export function checkTitles(game) {
  const H = game.H; H.titles ||= [];
  for (const T of TITLES) if (!H.titles.includes(T.id) && T.ok(H, game)) {
    H.titles.push(T.id); deed(game, `時人號為「${T.n}」`, true);
    game.ui.toast(`<b style="color:${T.bad ? '#ff8a6a' : '#ffd86a'}">得到稱號「${T.n}」</b><br><small>${T.d}</small>`, 5500); game.audio?.sfx('level');
  }
}

// ---------------------------------------------------------------- what history would have been: famous lives whose ends the player may change
export const FAMOUS = ['孫堅', '董卓', '典韋', '呂布', '孫策', '袁紹', '郭嘉', '周瑜', '龐統', '夏侯淵', '關羽', '曹操', '張飛', '劉備', '黃忠', '馬超', '趙雲', '諸葛亮', '曹丕', '孫權', '司馬懿'];
export function histDeaths(G) { return Object.fromEntries(FAMOUS.map((n) => [n, G.byName[n]?.died]).filter(([, d]) => d)); }
// at the end: the rewritten pages, and how the famous lives went against what the histories record
export function rewritten(G, H) {
  const out = (H.changed || []).map((c) => `${era(c.y)}　${c.t}`);
  const hist = H.hist || {};
  for (const [n, d] of Object.entries(hist)) {
    const g = G.byName[n]; if (!g || g.isPlayer) continue;
    const deathE = g.status === 'dead' ? [...G.log].reverse().find((e) => e.kind === 'death' && e.p.g === n) : null;
    if (deathE && deathE.year < d - 1) out.push(`${n}死於${deathE.year}年（史實是${d}年）${deathE.p.by ? `，死在${deathE.p.by}手中` : ''}`);
    else if (g.status !== 'dead' && g.status !== 'unborn' && G.year > d + 1) out.push(`${n}活過了史實的${d}年，至今健在`);
  }
  if (G.over && G.over !== 'time') { const f = G.factions[G.over]; if (f && !/司馬/.test(f.name)) out.push(`天下歸於${f.name}（史實上是司馬炎的晉，在280年統一）`); }
  return out;
}

// ---------------------------------------------------------------- the biography
export function biography(game, sc) {
  const G = game.G, H = game.H, g = G.gens[H.pid], home = G.cities[g.home]?.name || G.cities[g.city]?.name || '';
  const age0 = H.startYear - g.born, lines = [];
  const f0 = H.startFac ? H.startFac : null;
  lines.push(`${g.name}，${home}人也。${era(H.startYear)}，天下大亂，${g.name}時年${cn(age0)}，${f0 ? `仕於${f0}` : '布衣在野'}。`);
  // the deeds year by year
  const byYear = new Map(); for (const d of H.deeds || []) { if (!byYear.has(d.y)) byYear.set(d.y, []); byYear.get(d.y).push(d.t); }
  for (const [y, ts] of byYear) { const uniq = [...new Set(ts)], shown = uniq.slice(0, 6); lines.push(`${era(y)}，${shown.join('；')}${uniq.length > 6 ? `，其餘戰功不可勝數` : ''}。`); }
  const sw = (H.sworn || []).map((id) => G.gens[id]?.name).filter(Boolean), rv = (H.rivals || []).map((id) => G.gens[id]?.name).filter(Boolean);
  if (rv.length) lines.push(`平生宿敵，${rv.join('、')}而已。`);
  if (H.st.kills.length) lines.push(`凡斬名將${H.st.kills.length}人，${H.st.kills.slice(0, 8).join('、')}皆死其手。`);
  if (H.st.cities.length) lines.push(`前後攻拔${H.st.cities.length}城。`);
  const lord = game.isLord(), f = game.myFaction() && G.factions[game.myFaction()];
  const end = g.status === 'dead' ? `${era(G.year)}，${g.name}卒，時年${cn(G.year - g.born)}。` : lord ? `${era(G.year)}，${g.name}據有${G.cities.filter((c) => c.owner === f.id).length}城，稱雄一方。` : f ? `${era(G.year)}，${g.name}官至${RANKS[H.st.bestRank]?.[0] || '從事'}，仍事${f.name}。` : `${era(G.year)}，${g.name}仍浪跡江湖。`;
  lines.push(end);
  if (G.over && G.over !== 'time' && f && G.over === f.id) lines.push(lord ? '遂一統天下，四海歸心。' : `從${f.name}一統天下，功在第一。`);
  const n = (H.changed || []).length;
  const verdict = { 天下無雙: '雄才大略，冠絕一時，古今罕有其匹', 一代霸主: '英雄蓋世，縱橫天下，可謂一代人傑', 蓋世英雄: '勇略過人，威震海內，亦一時之雄', 一方名將: '忠勇可嘉，名聞州郡，良將之才', 亂世豪傑: '奮身亂世，頗有可觀', 無名之輩: '生逢亂世，未能大展其志', 一介草民: '碌碌一生，史書幾無可記' }[sc.title] || '';
  lines.push(`評曰：${g.name}${verdict}。${n ? `其所作為，竟使史事為之改易者${cn(n).replace('元', '一')}端，` : ''}後世論者，稱為「${sc.title}」。`);
  return lines;
}
