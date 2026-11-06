// 天下武力排行榜: the twenty mightiest of the land (G.rank: their ids, first to last). It starts from strength and
// standing; after that it changes only by fighting: whoever beats one on the list takes his place, and he and those
// below him move down one. The ones on it fight among themselves (a month's news), and once the player is on it the
// ones below come looking for him: take the challenge or give way.
const N = 20;
const able = (g) => !!g && (g.status === 'serving' || g.status === 'free');
export const might = (g) => g.war * 1.2 + g.lead * 0.25 + (g.life?.lv || 0) * 0.9;

// the list as it is now: the fallen dropped, the gaps filled with the strongest not on it
export function rankList(game) {
  const G = game.G, L = (G.rank ||= []).filter((id) => able(G.gens[id]));
  if (L.length < N) { const have = new Set(L), cand = G.gens.filter((g) => able(g) && !g.isPlayer && !have.has(g.id)).sort((a, b) => might(b) - might(a)); while (L.length < N && cand.length) L.push(cand.shift().id); }
  G.rank = L; return L;
}
export const rankOf = (game, id) => { const i = (game.G?.rank || []).indexOf(id); return i < 0 ? null : i + 1; };
export const rankTag = (game, id) => { const n = rankOf(game, id); return n ? `<em class="rk${n <= 3 ? ' top' : ''}">天下第${n}</em>` : ''; };
// w beat x: if x is on the list above w, w takes his place; returns the place, or null
export function beat(game, w, x) {
  const L = rankList(game), i = L.indexOf(x.id); if (i < 0) return null; const j = L.indexOf(w.id); if (j >= 0 && j < i) return null;
  if (j >= 0) L.splice(j, 1); L.splice(i, 0, w.id); L.length = Math.min(L.length, N); return i + 1;
}
// the month: bouts among those on the list; and someone below the player comes to challenge him
export function rankMonth(game) {
  const G = game.G, H = game.H, L = rankList(game), r = Math.random, me = game.me;
  for (let t = 0; t < 2; t++) {
    const k = 1 + Math.floor(r() * (L.length - 1)), lo = G.gens[L[k]], hi = G.gens[L[k - 1]]; if (!lo || !hi || lo.isPlayer || hi.isPlayer) continue;
    if (r() < 1 / (1 + Math.exp(-(might(lo) - might(hi)) / 12))) { L[k - 1] = lo.id; L[k] = hi.id; H.news.unshift(`${G.year}年${G.month}月　${lo.name}擊敗${hi.name}，成為天下第${k}`); if (k <= 3) game.ui.toast(`⚔ <b>${lo.name}</b>擊敗${hi.name}，成為<b style="color:#ffd86a">天下第${k}</b>！`, 4200); }
  }
  const i = L.indexOf(me.id);
  if (H.challenger && H.challenger.t + 2 < G.t) H.challenger = null;
  if (i >= 0 && !H.challenger && r() < 0.12 + (N - i) * 0.012) {
    const below = L.slice(i + 1, i + 5).filter((id) => able(G.gens[id]) && !H.party.includes(id) && G.factions[G.gens[id].fac]?.lord !== id); if (below.length) H.challenger = { id: below[Math.floor(r() * below.length)], t: G.t };
  }
}
// the list
export function rankHTML(game) {
  const G = game.G, L = rankList(game), me = game.me, i = L.indexOf(me.id);
  const rows = L.map((id, k) => { const g = G.gens[id], f = g.status === 'serving' && G.factions[g.fac];
    return `<tr${g.isPlayer ? ' class="me"' : ''}><td>${k + 1}</td><td><b>${g.name}</b></td><td style="color:${f ? f.color : '#b8c8a0'}">${f ? f.name : '在野'}</td><td>${g.war}</td><td>${game.act.lvOf(g)}</td><td>${G.cities[g.city]?.name || ''}</td></tr>`; }).join('');
  return `<table class="rank"><tr><th>名次</th><th>姓名</th><th>勢力</th><th>武力</th><th>Lv</th><th>所在</th></tr>${rows}</table>
    <p class="dim">${i >= 0 ? `你是<b style="color:#ffd86a">天下第${i + 1}</b>。排在你後面的人會來挑戰你。` : '打贏榜上的人（切磋或決鬥都算），就換你坐上他的名次。'}</p>`;
}
