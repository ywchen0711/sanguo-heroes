// 時代大事 and 合縱: what changes the best thing to do for a while.
// Now and then the age itself turns (a great plague, a drought, the Yellow Turbans again, an imperial edict against
// one warlord, raiders on the border, years of plenty) for half a year to a year; each one makes some ways of playing
// pay twice and others cost dear, for the computer's realms as much as for the player. And a realm grown too big
// frightens the others into a coalition (合縱) that fights it together until it is cut back down.
export const ERAS = {
  plague: { n: '大疫', months: 8, d: '瘟疫橫行。各地常爆發瘟疫；攻城前兵力 -15%（士兵病倒）；救治病人名聲加倍。諸侯無心用兵。' },
  drought: { n: '大旱', months: 12, d: '旱災連年。秋收減半、蝗災頻繁；賑濟饑民名聲加倍；盜賊四起，討賊報酬 +50%。' },
  turban: { n: '黃巾再起', months: 10, d: '黃巾餘黨再度起事。各城暴動、守軍減少，太守更容易叛亂；討伐黃巾報酬 +80%。' },
  edict: { n: '天子詔討', months: 12, d: '天子下詔討伐{f}。天下諸侯都與{f}交惡；攻下{f}軍的城，名聲與功績加倍。' },
  barbarian: { n: '外族入寇', months: 8, d: '{r}大舉入寇{a}。邊境諸城屢遭劫掠；到{a}的城擊退外族，報酬豐厚。' },
  peace: { n: '豐年太平', months: 12, d: '風調雨順、天下思安。收成與商稅增加、物價便宜；攻城的名聲減半（百姓厭戰）。諸侯少有征戰。' },
};
const AREAS = [['north', '北方', '烏桓、鮮卑', (c) => c.y < 28], ['west', '西涼', '羌、氐', (c) => c.x < 26], ['south', '南中', '南蠻', (c) => c.y > 78]];
export const eraOf = (G) => (G.era && G.era.until > G.t ? G.era : null);
export const eraIs = (G, k) => eraOf(G)?.k === k;
export const eraArea = (G) => { const e = eraOf(G); return e?.k === 'barbarian' ? AREAS.find((a) => a[0] === e.a) : null; };
export const inEraArea = (G, c) => { const a = eraArea(G); return !!a && a[3](c); };
export function eraText(G, e = eraOf(G)) {
  if (!e) return ''; const a = e.k === 'barbarian' && AREAS.find((x) => x[0] === e.a);
  return ERAS[e.k].d.replaceAll('{f}', e.fn || '').replaceAll('{r}', a ? a[2] : '').replaceAll('{a}', a ? a[1] : '');
}
// what the realm earns: the harvest and the taxes in these times
export const harvestMul = (G) => (eraIs(G, 'drought') ? 0.5 : eraIs(G, 'peace') ? 1.4 : 1);
export const taxMul = (G) => (eraIs(G, 'peace') ? 1.2 : 1);
export const rebelMul = (G) => (eraIs(G, 'turban') ? 2.2 : 1);
// whether a realm goes to war this month at all, and how keen it is on one target: [want, need] multipliers
export const warPause = (G, r) => (eraIs(G, 'peace') && r() < 0.5) || (eraIs(G, 'plague') && r() < 0.4);
export function warBias(G, fid, oid) {
  let want = 1, need = 1; const c = G.coal, e = eraOf(G);
  if (c && c.until > G.t && oid === c.target && c.members.includes(fid)) { want *= 1.4; need *= 0.9; }
  if (e?.k === 'edict' && oid === e.f) { want *= 1.3; need *= 0.95; }
  return [want, need];
}

const txt = (E, G, zh, en, fac, level, extra) => E.record(G, 'event', 'txt', { zh, en }, fac || null, level, extra || {});
const pick = (r, a) => a[Math.floor(r() * a.length)];
export function eraMonth(G, E) {
  const r = G.r, owned = G.cities.filter((c) => c.owner), alive = Object.values(G.factions).filter((f) => f.alive && E.citiesOf(G, f.id).length);
  // the age ends
  if (G.era && G.era.until <= G.t && !G.era.over) { G.era.over = true; G.eraEnd = G.t; txt(E, G, `${ERAS[G.era.k].n}的時代過去了，天下漸漸恢復了原來的樣子。`, `The time of ${G.era.k} has passed.`, null, 2); }
  // a new one begins
  if (!eraOf(G) && G.t >= 8 && G.t - (G.eraEnd ?? -99) >= 16 && r() < 0.07 && owned.length) {
    const ks = Object.keys(ERAS).filter((k) => k !== G.era?.k), k = pick(r, ks), e = { k, t: G.t, until: G.t + ERAS[k].months };
    if (k === 'edict') { const top = alive.sort((a, b) => E.citiesOf(G, b.id).length - E.citiesOf(G, a.id).length)[0]; if (!top) return; e.f = top.id; e.fn = top.name; for (const o of alive) if (o.id !== top.id) { o.rel[top.id] = Math.min(o.rel[top.id] || 0, -50); top.rel[o.id] = Math.min(top.rel[o.id] || 0, -30); delete o.allies[top.id]; delete top.allies[o.id]; } }
    if (k === 'barbarian') { const ok = AREAS.filter((a) => owned.some(a[3])); if (!ok.length) return; e.a = pick(r, ok)[0]; }
    G.era = e; txt(E, G, `【${ERAS[k].n}】${eraText(G, e)}`, `A new age: ${k}.`, null, 3);
  }
  const e = eraOf(G);
  if (e && owned.length) {
    if (e.k === 'plague' && r() < 0.35) { const c = pick(r, owned); c.pop = Math.round(c.pop * 0.9); c.troops = Math.round(c.troops * 0.9); E.record(G, 'event', 'plague', { c: c.name }, c.owner, 1, { city: c.id }); }
    if (e.k === 'drought' && r() < 0.35) { const c = pick(r, owned), f = G.factions[c.owner]; c.farm = Math.round(c.farm * 0.85); f.food = Math.max(0, f.food - 600 - c.size * 300); E.record(G, 'event', 'locust', { c: c.name, f: f.name }, c.owner, 1, { city: c.id }); }
    if (e.k === 'turban' && r() < 0.45) { const c = pick(r, owned), n = 500 + Math.round(r() * 1000); c.troops = Math.max(0, c.troops - n); c.morale = Math.max(0, c.morale - 8); txt(E, G, `黃巾餘黨在${c.name}暴動，守軍死傷 ${n} 人。`, `Yellow Turbans riot in ${c.name}.`, c.owner, 1, { city: c.id }); }
    if (e.k === 'barbarian') { const a = eraArea(G), hit = owned.filter(a[3]); if (hit.length && r() < 0.5) { const c = pick(r, hit), n = 1000 + Math.round(r() * 2000); c.troops = Math.max(0, c.troops - n); c.morale = Math.max(0, c.morale - 10); c.pop = Math.round(c.pop * 0.96); txt(E, G, `${a[2]}劫掠${c.name}，守軍損失 ${n} 人，百姓流離。`, `Raiders sack ${c.name}.`, c.owner, 1, { city: c.id }); } }
  }
  // 合縱: a realm with a quarter of the land and more frightens all the others into one alliance
  const C = G.coal;
  if (C && !C.over && (C.until <= G.t || !G.factions[C.target]?.alive || E.citiesOf(G, C.target).length < C.n * 0.8)) {
    C.over = true; G.coalEnd = G.t; txt(E, G, `討伐${G.factions[C.target]?.name || ''}的合縱同盟瓦解了，諸侯各回各的地盤。`, 'The coalition breaks up.', C.target, 2);
  }
  if ((!G.coal || G.coal.over) && G.t - (G.coalEnd ?? -99) >= 36 && G.month % 3 === 0) {
    const top = alive.sort((a, b) => E.citiesOf(G, b.id).length - E.citiesOf(G, a.id).length)[0], n = top ? E.citiesOf(G, top.id).length : 0;
    if (top && n >= 12 && n >= G.cities.length * 0.27 && n <= G.cities.length * 0.55 && alive.length >= 3) {
      const near = new Set(); for (const c of E.citiesOf(G, top.id)) for (const a of c.adj) { const o = G.cities[a].owner; if (o && o !== top.id) near.add(o); }
      const members = alive.filter((o) => near.has(o.id)).map((o) => o.id); if (members.length < 2) return;
      for (const a of members) { const fa = G.factions[a]; fa.rel[top.id] = -80; top.rel[a] = Math.min(top.rel[a] || 0, -60); delete fa.allies[top.id]; delete top.allies[a]; delete fa.truce[top.id]; delete top.truce[a];
        for (const b of members) if (a !== b) { fa.allies[b] = Math.max(fa.allies[b] || 0, G.t + 24); fa.rel[b] = Math.max(fa.rel[b] || 0, 20); } }
      G.coal = { target: top.id, t: G.t, until: G.t + 18, n, members };
      const names = members.slice(0, 4).map((id) => G.factions[id].name).join('、');
      txt(E, G, `【合縱】${top.name}勢力太大（${n} 城），${names}${members.length > 4 ? '等' : ''}諸侯結成同盟，共同討伐${top.name}！`, `A coalition forms against ${top.name}.`, top.id, 3);
    }
  }
}
