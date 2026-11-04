// Checks every event row: its shape, where it happens, and that each effect token is one the game understands.
//   node tools/evcheck.mjs
const FILES = ['talk', 'talk2', 'talk3', 'town', 'town2', 'field', 'field2'];
const TOKEN = /^(\?[\w.:]+|\$\d+|&\w+|(gold|fame|exp|merit|morale|troops|sp|days)[+-]\d+|sol[+-]\d+|heal|item:(med|med2|rice|book|wine)(\*\d+)?|eq:[wah]\d|stat:(war|lead|int|pol|cha)|hint:(treasure|gen|weak|war)|recruit|mission|win|fight:(bandit|turban|nomad|barbarian|pirate|wolf|tiger|bear|boar|soldier):\d+(:\+\d+)?)$/;
const REQ = /^(t|w|f|serve|free|lord|own|enemy|none|big|small|spring|summer|autumn|winter|north|south|west|central|coast|party|once|(fame|gold|lv|year|war|int|pol|cha|lead)>\d+)$/;
let total = 0; const bad = [], by = { t: 0, w: 0, f: 0 };
for (const f of FILES) {
  const m = await import(`../js/ev/${f}.js`), rows = Object.values(m)[0];
  rows.forEach((r, i) => {
    total++;
    const at = `${f}#${i}`;
    if (!Array.isArray(r) || r.length < 3 || typeof r[2] !== 'string') { bad.push(at + ' shape'); return; }
    const req = r[0].split(/\s+/).filter(Boolean);
    for (const t of req) if (!REQ.test(t)) bad.push(`${at} req ${t}`);
    for (const k of ['t', 'w', 'f']) if (req.includes(k)) by[k]++;
    if (!req.some((t) => 't w f'.split(' ').includes(t))) bad.push(at + ' no place');
    for (const o of r[3] || []) {
      if (!Array.isArray(o) || o.length < 2) { bad.push(at + ' option'); continue; }
      for (const t of o[1].split(/\s+/).filter((x) => x && x !== '/')) if (!TOKEN.test(t)) bad.push(`${at} token ${t}`);
      if ((o[2] || '').includes(' / ') && !o[1].includes('?')) bad.push(`${at} message has two outcomes but no gamble`);
    }
  });
}
console.log(`${total} events (talking ${by.t}, in town ${by.w}, on the land ${by.f})`);
console.log(bad.length ? 'problems:\n' + bad.join('\n') : 'no problems');
