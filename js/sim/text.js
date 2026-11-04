// The chronicle in Chinese or English, and names in pinyin for the English interface.
import { PY, COMPOUND, SPECIAL } from '../data/pinyin.js';
import { ITEMS, SPELLS } from '../data/treasures.js';
import { SCEN } from '../data/scenarios.js';
const ITEM = Object.fromEntries(ITEMS.map(([key, zh, en]) => [key, [zh, en]]));
export const itemName = (key, lang) => (ITEM[key] ? ITEM[key][lang === 'en' ? 1 : 0] : key);
export const spellName = (key, lang) => (SPELLS[key] ? SPELLS[key][lang === 'en' ? 1 : 0] : key);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const py = (chars) => [...chars].map((c) => PY[c] || c).join('');
// a person: "Zhuge Liang"; a place: "Xiangyang"
export function romanize(name, place = false) {
  if (!name) return name;
  if (SPECIAL[name]) return SPECIAL[name];
  if (/^[A-Za-z]/.test(name)) return name;         // the hidden generals already have English names
  if (place) return cap(py(name));
  const sur = COMPOUND.find((s) => name.startsWith(s)) || name[0];
  const rest = name.slice(sur.length);
  return rest ? `${cap(py(sur))} ${cap(py(rest))}` : cap(py(sur));
}
export const nameIn = (name, lang, place) => (lang === 'en' ? romanize(name, place) : name);

const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateStr = (year, month, lang) => (lang === 'en' ? `${MON[month]} ${year}` : `${year}年${month}月`);

const TAC = { fire: ['火計', 'a fire attack'], ambush: ['伏兵之計', 'an ambush'], flood: ['水攻之計', 'a flood'], rumor: ['偽報之計', 'false reports'],
  night: ['夜襲', 'a night raid'], rocks: ['落石之計', 'falling rocks'], raid: ['奇襲', 'a surprise attack'] };
for (const [k, v] of Object.entries(SPELLS)) TAC['sp_' + k] = [`法術「${v[0]}」`, v[1]];

// the sentence for a chronicle entry (without the date)
export function fmt(e, lang = 'zh') {
  const p = e.p || {}, en = lang === 'en';
  const N = (k) => (en ? romanize(p[k]) : p[k]), C = (k) => (en ? romanize(p[k], true) : p[k]);
  const I = () => { if (!en) return `「${itemName(p.it, 'zh')}」`; const n = itemName(p.it, 'en'); return n.startsWith('The ') ? 'the ' + n.slice(4) : 'the ' + n; }, SP = () => (en ? spellName(p.s, 'en') : `「${spellName(p.s, 'zh')}」`);
  const notes = () => {
    if (!p.notes || !p.notes.length) return '';
    const parts = p.notes.map((n) => (n.tac === 'sp_zhi' ? (en ? `${romanize(n.who)} heals the wounded` : `${n.who}以治癒之術救治傷兵`)
      : en ? (n.def ? `${romanize(n.who)} counters with ${TAC[n.tac][1]}` : `${romanize(n.who)} uses ${TAC[n.tac][1]}`)
      : n.def ? `守將${n.who}以${TAC[n.tac][0]}反擊` : `${n.who}施展${TAC[n.tac][0]}`));
    return en ? ` (${parts.join('; ')})` : `（${parts.join('，')}）`;
  };
  switch (e.key) {
    case 'start': {
      if (!p.s || p.s === '190') return en ? 'Dong Zhuo seizes the court. Warlords rise across the land, and the lords east of the passes march against him.' : '董卓專權，天下群雄並起。關東諸侯起兵討伐董卓。';
      const S = SCEN[p.s]; return S ? S.desc[en ? 1 : 0] : '';
    }
    case 'unify': return en ? `${N('g')} unifies the realm! The ${N('f')} army brings peace within the four seas.` : `${p.g}統一天下！${p.f}軍平定四海。`;
    case 'end': return en ? 'The realm remains divided, and the age of warlords goes on…' : '天下未定，群雄割據之世仍將延續……';
    case 'seek': return en ? `${N('g')} seeks out the ${N('f')} army and joins it.` : `${p.g}慕名投奔${p.f}軍。`;
    case 'kinJoin': return en ? `${N('g')} comes of age and joins the family's ${N('f')} army.` : `${p.g}長大成人，投效${p.f}軍。`;
    case 'serve': return en ? `${N('g')} enters the service of the ${N('f')} army.` : `${p.g}出仕${p.f}軍。`;
    case 'appear': return en ? `${N('g')} makes a name in ${C('c')}.` : `${p.g}於${p.c}嶄露頭角。`;
    case 'death': {
      const how = { natural: ['病逝', 'dies of illness'], duel: [`於一騎討中被${p.by || '敵將'}所斬`, `is slain by ${p.by ? romanize(p.by) : 'an enemy'} in a duel`],
        battle: ['戰死沙場', 'falls in battle'], executed: [`被${p.by || '敵軍'}處斬`, `is executed by ${p.by ? romanize(p.by) : 'the enemy'}`],
        lightning: [`被${p.by || '敵軍'}的落雷擊中身亡`, `is struck down by ${p.by ? romanize(p.by) : 'an enemy'}'s lightning`], plague: ['染上瘟疫病逝', 'dies of the plague'] }[p.cause] || ['去世', 'dies'];
      const lord = p.f && p.f === p.g;     // the lord himself: "曹操（曹操軍之主）" reads oddly, so just the name
      return en ? `${lord ? 'The warlord ' : ''}${N('g')}${p.f && !lord ? ` of the ${N('f')} army` : ''} ${how[1]}${p.age > 0 ? `, aged ${p.age}` : ''}.` : `${lord ? '群雄' : p.f ? p.f + '軍的' : ''}${p.g}${how[0]}${p.age > 0 ? `，享年${p.age}歲` : ''}。`;
    }
    case 'succession': return en ? `${N('g')} succeeds ${N('old')} as lord of the ${N('f')} army.` : `${p.g}繼承${p.old}之位，成為${p.f}軍之主。`;
    case 'noHeir': return en ? `With no heir, the ${N('f')} army falls apart.` : `${p.f}後繼無人，勢力瓦解。`;
    case 'lastCity': return en ? `${C('c')}, the last stronghold of the ${N('f')} army, falls. The ${N('f')} army is destroyed.` : `${p.f}軍最後的據點${p.c}失守，${p.f}軍滅亡。`;
    case 'scatter': return en ? `Having lost every city, the officers of the ${N('f')} army scatter.` : `${p.f}軍失去所有城池，眾將離散。`;
    case 'famine': return en ? `The ${N('f')} army runs out of food, and soldiers desert.` : `${p.f}軍糧草不足，士兵逃散。`;
    case 'recruit': return en ? `${N('g')} recruits ${N('x')} into the ${N('f')} army.` : `${p.g}登用${p.x}，${p.x}加入${p.f}軍。`;
    case 'betray': return en ? `${N('g')} tears up the alliance with ${N('x')}!` : `${p.g}撕毀與${p.x}的盟約！`;
    case 'ally': return en ? `The ${N('f')} and ${N('o')} armies ally against ${N('t')}. (Envoy: ${N('g')})` : `${p.f}與${p.o}結盟，共抗${p.t}。（使者：${p.g}）`;
    case 'truce': return en ? `The ${N('f')} army sues ${N('o')} for peace: a one-year truce.` : `${p.f}向${p.o}求和，雙方停戰一年。`;
    case 'defect': return en ? `Persuaded by ${N('x')}, ${N('g')} leaves the ${N('o')} army for the ${N('f')} army.` : `${p.g}受${p.x}勸誘，離開${p.o}軍，投奔${p.f}軍。`;
    case 'surrender': return en ? `${N('g')} heeds ${N('x')}'s call to surrender and brings the ${N('o')} army over to the ${N('f')} army.` : `${p.g}接受${p.x}的勸降，率${p.o}軍歸順${p.f}軍。`;
    case 'duel': return en ? `Before the walls of ${C('c')}, ${N('a')} and ${N('d')} duel! ${N('w')} ${p.killed ? `slays ${N('l')}` : `wins, and ${N('l')} flees`}.`
      : `${p.c}城下，${p.a}與${p.d}一騎討！${p.w}${p.killed ? `斬殺${p.l}` : `獲勝，${p.l}敗走`}。`;
    case 'warWin': return en ? `The ${N('f')} army (${N('g')}) takes ${C('c')} from ${p.o ? `the ${N('o')} army` : 'its garrison'}${notes()}.` : `${p.f}軍（${p.g}）攻陷${p.c}，擊破${p.o ? p.o + '軍' : '守軍'}${notes()}。`;
    case 'warLose': return en ? `The ${N('f')} army (${N('g')}) attacks ${C('c')} but is driven back by ${p.o ? `the ${N('o')} army` : 'its garrison'}${notes()}.` : `${p.f}軍（${p.g}）進攻${p.c}，被${p.o ? p.o + '軍' : '守軍'}擊退${notes()}。`;
    case 'captive': return en ? `${N('g')} is captured and joins the ${N('f')} army.` : `${p.g}被俘，歸順${p.f}軍。`;
    case 'releaseHome': return en ? `${N('x')} releases the captured ${N('g')}, who returns to ${C('c')}.` : `${p.x}釋放了被俘的${p.g}，${p.g}返回${p.c}。`;
    case 'release': return en ? `${N('x')} releases the captured ${N('g')}.` : `${p.x}釋放了被俘的${p.g}。`;
    case 'refuse': return en ? `The captured ${N('g')} refuses to serve ${N('x')} and is let go.` : `被俘的${p.g}不肯歸順${p.x}，被放走了。`;
    case 'rebel': return en ? `${N('g')} seizes ${C('c')} and rebels against the ${N('f')} army!` : `${p.g}據${p.c}自立，反叛${p.f}軍！`;
    case 'rise': return en ? `The ${N('f')} army seizes ${C('c')} and rises again.` : `${p.f}軍輾轉奪取${p.c}，東山再起。`;
    // the four hidden generals
    case 'hiddenAppear': return en ? `A stranger of rare talent, ${N('g')}, suddenly appears in ${C('c')}! No one knows where they came from.` : `來歷不明的奇才${p.g}突然現身${p.c}！`;
    // items and spells
    case 'itemFind': return en ? `${N('g')} finds ${I()} in ${C('c')}!` : `${p.g}在${p.c}尋得寶物${I()}！`;
    case 'itemTake': return en ? `${N('g')} takes ${I()} from the fallen ${N('x')}.` : `${p.g}從${p.x}手中奪得${I()}。`;
    case 'itemGive': return en ? `${N('x')} rewards ${N('g')} with ${I()}.` : `${p.x}將${I()}賜給${p.g}。`;
    case 'bookSpell': return en ? `Studying ${I()}, ${N('g')} masters ${SP()}.` : `${p.g}研讀${I()}，習得法術${SP()}。`;
    case 'immortal': return en ? `An immortal visits ${N('g')} and teaches ${SP()}.` : `仙人造訪${p.g}，傳授法術${SP()}。`;
    // random events
    case 'locust': return en ? `Locusts swarm over ${C('c')}; the ${N('f')} army's granaries suffer.` : `${p.c}爆發蝗災，${p.f}軍糧草受損。`;
    case 'plague': return en ? `Plague breaks out in ${C('c')}, and many die.` : `${p.c}爆發瘟疫，死者甚眾。`;
    case 'plagueCured': return en ? `Plague breaks out in ${C('c')}, but ${N('g')}'s healing arts stop it.` : `${p.c}爆發瘟疫，幸得${p.g}施術救治，疫情平息。`;
    case 'flood': return en ? `The rivers flood around ${C('c')}, ruining fields and walls.` : `${p.c}大水氾濫，農田與城牆受損。`;
    case 'harvest': return en ? `A bumper harvest in ${C('c')} fills the ${N('f')} army's granaries.` : `${p.c}大豐收，${p.f}軍糧倉充盈。`;
    case 'quake': return en ? `An earthquake shakes ${C('c')}, and its walls crumble.` : `${p.c}發生地震，城牆崩塌。`;
    case 'bandits': return en ? `Bandits rise near ${C('c')} and the garrison takes losses.` : `${p.c}一帶山賊作亂，守軍損兵折將。`;
    case 'banditsBeaten': return en ? `Bandits rise near ${C('c')}; ${N('g')} crushes them.` : `${p.c}一帶山賊作亂，${p.g}親自率兵平定。`;
    case 'caravan': return en ? `A great caravan reaches ${C('c')}, bringing the ${N('f')} army ${p.n} gold.` : `大商隊來到${p.c}，${p.f}軍獲得${p.n}金。`;
    case 'omen': return en ? `Auspicious signs appear over the ${N('f')} army's lands, and the people rejoice.` : `${p.f}軍領地出現祥瑞，百姓歡欣。`;
    case 'comet': return en ? `A comet crosses the sky. The stargazers say it foretells the fall of ${N('g')}…` : `彗星劃過夜空，觀星者說這是${p.g}將星墜落的徵兆……`;
    case 'sage': return en ? `A famous scholar instructs ${N('g')} (INT +${p.n}).` : `名士指點${p.g}，智力提升${p.n}。`;
    case 'training': return en ? `${N('g')} trains hard in the martial arts (WAR +${p.n}).` : `${p.g}苦練武藝，武力提升${p.n}。`;
    case 'refugees': return en ? `Refugees pour into ${C('c')}.` : `大批流民湧入${p.c}。`;
    case 'tournament': return en ? `The ${N('f')} army holds a martial tournament; ${N('g')} carries the day.` : `${p.f}軍舉辦比武大會，${p.g}技壓群雄。`;
    case 'oath': return en ? `${N('a')} and ${N('b')} swear brotherhood.` : `${p.a}與${p.b}義結金蘭。`;
    case 'edict': return en ? `An imperial edict praises the ${N('f')} army; its standing rises.` : `天子下詔嘉獎${p.f}軍，聲望大振。`;
    case 'assassinFail': return en ? `An assassin strikes at ${N('g')}, but is cut down.` : `刺客行刺${p.g}，當場伏誅。`;
    case 'assassinWound': return en ? `An assassin wounds ${N('g')}, who survives.` : `刺客行刺${p.g}，${p.g}負傷逃過一劫。`;
    case 'granary': return en ? `Fire sweeps the granaries of ${C('c')}; the ${N('f')} army loses much of its food.` : `${p.c}糧倉失火，${p.f}軍損失大量糧草。`;
    default: return e.key;
  }
}

// ---------------------------------------------------------------- the player's court: what a general proposes, and how it turned out
export const JOB = { farm: ['開墾', 'Farming'], comm: ['振興商業', 'Trade'], def: ['修築城牆', 'Walls'], morale: ['巡察安民', 'Patrol'], train: ['操練士兵', 'Training'],
  draft: ['徵兵', 'Drafting'], reward: ['褒賞將士', 'Rewards'], search: ['搜索人才', 'Searching'], recruitGen: ['登用人才', 'Recruiting'] };
const FIELD = { farm: ['農業', 'farming'], comm: ['商業', 'commerce'], def: ['城防', 'walls'], morale: ['民心', 'morale'], train: ['訓練', 'training'], troops: ['兵力', 'troops'], gold: ['金', 'gold'] };
// [title, what the general says]
export function proposalText(prop, lang = 'zh') {
  const p = prop.p, en = lang === 'en', N = (k) => (en ? romanize(p[k]) : p[k]), C = (k) => (en ? romanize(p[k], true) : p[k]);
  const I = () => (en ? itemName(p.it, 'en') : `「${itemName(p.it, 'zh')}」`);
  switch (prop.type) {
    case 'job': {
      const say = {
        farm: [`「${p.c}的田地還有許多荒蕪，臣願前往開墾，以充軍糧。」`, `"Much of ${C('c')}'s land lies fallow. Let me clear it and fill our granaries."`],
        comm: [`「開市集、減商稅，${p.c}的府庫自然充實。」`, `"Open the markets and ease the merchants' taxes, and ${C('c')}'s treasury will fill."`],
        def: [`「${p.c}的城牆年久失修，萬一敵軍來犯，恐怕難守。」`, `"The walls of ${C('c')} are crumbling. If the enemy comes, we could not hold."`],
        morale: [`「${p.c}的百姓人心不安，臣願巡視四方，安撫民心。」`, `"The people of ${C('c')} are uneasy. Let me ride out and calm them."`],
        train: ['「新兵尚未熟悉陣法，臣願親自操練。」', '"The new recruits don\'t know their formations yet. Let me drill them myself."'],
        draft: [`「${p.c}兵力不足，難以成事，臣請募兵。」`, `"${C('c')} is short of soldiers. Let me raise more men."`],
        reward: ['「近來有將士心生不滿，請主公撥金賞賜，以安其心。」', '"Some officers have been grumbling. A gift of gold would set their hearts at ease."'],
        search: [`「${p.c}城中或有隱士與寶物，臣願四處訪查。」`, `"There may be hidden talent or treasure in ${C('c')}. Let me go and look."`],
        recruitGen: [`「${p.x || '城中的在野之士'}是難得的人才，臣願登門拜訪，請其出仕。」`, `"${p.x ? N('x') : 'A talent in this city'} would be a rare find. Let me call on them and invite them to serve."`],
      }[prop.job];
      return [en ? `${JOB[prop.job][1]} in ${C('c')}` : `${p.c}・${JOB[prop.job][0]}`, say[en ? 1 : 0]];
    }
    case 'war': return [en ? `Attack ${C('t')}` : `出征${p.t}`,
      en ? `"${C('t')} is open to attack. Give me ${p.troops} men${p.from.length > 1 ? ` from ${p.from.map((c) => romanize(c, true)).join(', ')}` : ''} and it is ours!"`
        : `「${p.t}${p.o ? `的${p.o}軍` : '的守軍'}防備有隙，臣願率兵${p.troops}${p.from.length > 1 ? `，從${p.from.join('、')}分路進擊` : ''}，必取此城！」`];
    case 'absorb': return [en ? `Demand that ${N('x')} surrender` : `勸降${p.x}`, en ? `"${N('x')} is weak and alone. Let me go as envoy and persuade them to bring the ${N('o')} army over to us."` : `「${p.x}勢單力薄，臣願出使，勸其率${p.o}軍歸順。」`];
    case 'betray': return [en ? `Break the alliance with the ${N('o')} army` : `撕毀與${p.o}的盟約`, en ? `"The ${N('o')} army has grown weak. The alliance only holds us back; let us end it and take what we can."` : `「${p.o}已衰，盟約只會束縛我軍，不如撕毀盟約，趁勢取之。」`];
    case 'ally': return [en ? `Ally with the ${N('o')} army` : `與${p.o}結盟`, en ? `"The ${N('t')} army grows too strong. Let us ally with the ${N('o')} army and stand against it together."` : `「${p.t}勢大，不如與${p.o}結盟，共抗強敵。」`];
    case 'truce': return [en ? `Sue the ${N('o')} army for peace` : `向${p.o}求和`, en ? `"The ${N('o')} army is at its height. Let us ask for a year's truce while we gather our strength."` : `「${p.o}兵鋒正盛，請暫且求和，停戰一年，養精蓄銳。」`];
    case 'lure': return [en ? `Lure ${N('x')} away` : `勸誘${p.x}來投`, en ? `"${N('x')} is unhappy in the ${N('o')} army. Let me go and win them over to our side."` : `「${p.x}在${p.o}軍中不得志，臣願前往遊說，請其來投。」`];
    case 'item': return [en ? `Give ${I()} to ${N('x')}` : `賞賜${I()}給${p.x}`, en ? `"${N('x')} has served with distinction. Grant them ${I()} as a mark of your favour."` : `「${p.x}功勞卓著，請將${I()}賜之，以示恩寵。」`];
    case 'captive': return [en ? `The captive ${N('x')}` : `處置俘虜${p.x}`, en ? `"We have captured ${N('x')}${p.o ? ` of the ${N('o')} army` : ''}. Shall we try to win them over, let them go, or put them to death?"` : `「我軍俘虜了${p.o ? p.o + '軍的' : ''}${p.x}。主公要勸降、釋放，還是處斬？」`];
    default: return [prop.type, ''];
  }
}
// how a decision turned out (a chronicle entry, the work done, or a refusal)
export function decisionText(res, lang = 'zh') {
  const en = lang === 'en', g = res.prop.p.g, G_ = en ? romanize(g) : g;
  if (res.void) return en ? 'Things have changed; the proposal no longer applies.' : '情勢已變，這份奏報作廢了。';
  if (res.broke) return en ? 'The treasury is too low to pay for it.' : '府庫金錢不足，無法執行。';
  if (res.rejected && res.prop.type !== 'captive') return en ? `${G_} bows and withdraws.` : `${g}：「……遵命。」默默退下。`;
  if (res.logs && res.logs.length) return res.logs.map((e) => fmt(e, lang)).join(' ');
  if (res.key === 'jobDone') {
    const d = res.p.d.filter(([k]) => FIELD[k]).map(([k, v]) => `${FIELD[k][en ? 1 : 0]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`);
    return en ? `${G_} sees to the ${JOB[res.p.job][1].toLowerCase()}${d.length ? ': ' + d.join(', ') : ', but nothing comes of it'}.` : `${g}完成了${JOB[res.p.job][0]}${d.length ? '：' + d.join('、') : '，但沒有收穫'}。`;
  }
  return en ? 'Done.' : '已執行。';
}
