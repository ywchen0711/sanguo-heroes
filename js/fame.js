// 名聲 (renown) in seven grades, each opening something more: prices come down, volunteers walk in every month,
// recruiting gets easier, bandits run at the sound of your name, innkeepers will not take your money, men of talent
// come looking for you, captives are readier to change sides, and a lord will hear your petition for promotion.
export const FAME = [
  [0, '無名小卒', {}],
  [50, '小有名氣', { price: 0.03, vol: 0.01 }],
  [150, '鄉里聞名', { price: 0.05, vol: 0.02, recruit: 0.04, awe: 0.1 }],
  [300, '一州知名', { price: 0.08, vol: 0.03, recruit: 0.07, awe: 0.2, inn: 1, seek: 0.15, defect: 0.05 }],
  [600, '名動天下', { price: 0.1, vol: 0.04, recruit: 0.1, awe: 0.3, inn: 1, seek: 0.25, defect: 0.1, petition: 1 }],
  [1000, '天下景仰', { price: 0.12, vol: 0.05, recruit: 0.13, awe: 0.4, inn: 1, seek: 0.35, defect: 0.15, petition: 1 }],
  [1600, '萬世流芳', { price: 0.15, vol: 0.06, recruit: 0.16, awe: 0.5, inn: 1, seek: 0.45, defect: 0.2, petition: 1 }],
];
export const fameIdx = (H) => { let k = 0; FAME.forEach((f, i) => { if ((H?.fame || 0) >= f[0]) k = i; }); return k; };
export const fameOf = (H) => FAME[fameIdx(H)][2];
export const fameName = (H) => FAME[fameIdx(H)][1];
const pc = (v) => `${Math.round(v * 100)}%`;
const LINES = { price: (v) => `買東西便宜 ${pc(v)}`, vol: (v) => `每月義勇兵來投（全隊兵力 +${pc(v)}）`, recruit: (v) => `招募成功率 +${pc(v)}`, awe: (v) => `${pc(v)} 機率威名嚇退山賊（不戰而勝）`,
  inn: () => '住客棧不用錢', seek: (v) => `每月 ${pc(v)} 機率有名士慕名來投（情勢裡的「訪賢」）`, defect: (v) => `俘虜的招降成功率 +${pc(v)}`, petition: () => '可以每年上書自薦一次（在太守府，換功績）' };
export const fameLines = (P) => Object.entries(P).map(([k, v]) => LINES[k](v));
export function fameHTML(H) {
  const i = fameIdx(H), [, n, P] = FAME[i], next = FAME[i + 1];
  return `<div class="fame"><b style="color:#ffd86a">名聲 ${H.fame}「${n}」</b>${next ? `<small>　再 ${next[0] - H.fame} 點成為「${next[1]}」</small>` : ''}${fameLines(P).length ? `<div class="dim">${fameLines(P).join('　')}</div>` : '<div class="dim">還沒有什麼人知道你。打勝仗、討賊、救災都能揚名。</div>'}${next ? `<div class="dim">下一級：${fameLines(next[2]).filter((l, j) => !fameLines(P)[j] || fameLines(P)[j] !== l).slice(0, 4).join('　')}</div>` : ''}</div>`;
}
// checked often: a new grade is announced
export function fameCheck(game) {
  const H = game.H; if (!H) return; const i = fameIdx(H);
  if (H.fameIdx == null) { H.fameIdx = i; return; }
  if (i > H.fameIdx) { H.fameIdx = i; const [, n, P] = FAME[i]; game.audio?.sfx('level'); game.ui.banner(`<b style="color:#ffc84a;font-size:20px">★ 名聲遠播 ★</b><br>${game.me.name}成為「${n}」<br><small>${fameLines(P).slice(-3).join('、')}</small>`, 6500); }
  else if (i < H.fameIdx) H.fameIdx = i;
}
