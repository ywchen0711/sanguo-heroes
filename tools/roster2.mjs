// Turns tools/roster2.txt (700 more generals, by group) into lines of js/data/generals.js, and writes the list of the
// women among all the generals to js/data/ladies.js (the art draws them differently). Run once: node tools/roster2.mjs
import fs from 'fs';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const gpath = ROOT + 'js/data/generals.js', src = fs.readFileSync(gpath, 'utf8');
if (src.includes('// ---- 700 more')) { console.log('already added'); process.exit(0); }
const { CITIES } = await import('file:///' + ROOT + 'js/data/world.js');
const cityOK = new Set(CITIES.map((c) => c[0]));
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const BASE = { W: [60, 72, 35, 28, 45], S: [45, 28, 75, 62, 55], P: [35, 22, 62, 74, 58], L: [70, 62, 52, 42, 52], B: [55, 52, 52, 50, 55], X: [35, 30, 60, 52, 82] };
const MAIN = { W: [1], S: [2], P: [3], L: [0, 1], B: [0, 1, 2], X: [4] };
// the famous few get their numbers by hand: lead war int pol cha
const OVER = {
  陶侃: [90, 70, 82, 85, 80], 祖逖: [86, 78, 72, 70, 82], 劉琨: [80, 65, 70, 66, 78], 王導: [70, 30, 88, 93, 88], 戲志才: [55, 20, 90, 70, 60], 關索: [72, 84, 55, 45, 70],
  孫尚香: [62, 74, 58, 45, 82], 關銀屏: [60, 72, 50, 40, 75], 鮑三娘: [58, 70, 48, 38, 72], 花鬘: [55, 68, 45, 30, 70], 馬雲騄: [62, 76, 50, 35, 74], 甄姬: [30, 15, 72, 60, 96],
  黃月英: [50, 30, 92, 76, 70], 蔡琰: [30, 10, 86, 62, 88], 貂蟬: [30, 25, 78, 60, 99], 大喬: [25, 15, 62, 50, 94], 小喬: [25, 15, 66, 52, 95], 張春華: [45, 40, 72, 62, 66],
  王元姬: [35, 20, 80, 72, 74], 辛憲英: [35, 15, 88, 70, 72], 步練師: [25, 10, 64, 58, 90], 吳國太: [40, 15, 74, 70, 85], 卞夫人: [35, 12, 70, 72, 84], 劉協: [30, 22, 70, 72, 80],
  陸機: [72, 40, 86, 78, 76], 劉弘: [76, 60, 72, 80, 78], 馬隆: [84, 74, 72, 55, 66], 陳騫: [78, 60, 74, 70, 62], 張承: [72, 58, 68, 72, 74], 陶璜: [80, 66, 70, 72, 70],
  荀顗: [40, 15, 75, 80, 66], 王祥: [30, 20, 70, 80, 88], 何曾: [40, 20, 70, 78, 60], 山濤: [45, 20, 80, 86, 82], 嵇康: [20, 30, 86, 40, 90], 阮籍: [25, 35, 84, 45, 80],
  鄭玄: [20, 10, 95, 70, 92], 華覈: [30, 20, 80, 82, 66], 韋昭: [30, 15, 84, 76, 64], 孫皎: [74, 66, 60, 58, 70], 駱統: [55, 35, 74, 80, 72], 董和: [40, 20, 72, 84, 76],
};
const out = [], ladies = [];
let fac = '-', city = '洛陽', kin = '';
for (const line of fs.readFileSync(ROOT + 'tools/roster2.txt', 'utf8').split('\n')) {
  const l = line.trim(); if (!l || l.startsWith('# ')) continue;
  if (l.startsWith('#')) { [fac, city, , kin = ''] = l.slice(1).split(','); if (!cityOK.has(city)) throw new Error('no city ' + city); continue; }
  for (const t of l.split(/\s+/)) {
    const [name, role, tier, b, d] = t.split(':'), h = hash(name), r = (k) => ((h >>> (k * 4)) & 15) / 15 - 0.5;
    const born = +b || 160 + (h % 40), died = +d || born + 45 + (h % 25);
    let st = OVER[name];
    if (!st) { const bonus = { 1: 12, 2: 5, 3: -2 }[tier] || 0; st = BASE[role].map((v, i) => Math.max(5, Math.min(96, Math.round(v + (MAIN[role].includes(i) ? bonus : bonus / 3) + r(i) * 18)))); }
    if (role === 'X') ladies.push(name);
    out.push([name, born, died, ...st, fac, city, kin].join(','));
  }
}
const add = `\n// ---- 700 more (tools/roster2.mjs from tools/roster2.txt): family members, officers, scholars, rebels, the court, women\n${out.join('\n')}\n`;
fs.writeFileSync(gpath, src.replace(/\n`;\s*$/, add + '`;\n').replace('// 500 generals of the Three Kingdoms.', '// 1200 generals of the Three Kingdoms.'));
// the women among all the generals
const old = ['王異', '祝融', '貂蟬', '蔡琰', '孫尚香', '大喬', '小喬'];
fs.writeFileSync(ROOT + 'js/data/ladies.js', `// The women among the generals: the art draws them with a lady's hair and robe.\nexport const LADIES = new Set(${JSON.stringify([...new Set([...old, ...ladies])])});\n`);
console.log('added', out.length, 'ladies', ladies.length);
