// 地利: the ground a battle is fought on, before the first blow. On a hill both sides race for the high ground (統率);
// in a forest one side may hide men among the trees to fall on the other in the second round (智力) — or search the
// woods for the enemy's; at a river, fight with it at your back (no retreat, every blow harder) or strike as they
// cross (智力: the first two rounds go hard against them); a marsh bogs the horses down, sand blinds the archers, open
// plain lets the cavalry run. Returns { dmg(u, t, round), round(n), tag } for battle.js.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const best = (L, k) => Math.max(0, ...L.filter((u) => u.sol > 0).map((u) => u.st?.[k] ?? u[k] ?? 0));

export async function setupField(b) {
  const o = b.o, T = o.terrain, H = b.game.H; if (!H || o.drill || o.siege || o.duelOnly) return null;
  const auto = !!b.auto || b.game.auto?.on, P = b.party, F = b.foes, named = F.some((f) => f.gid != null);
  const fx = { high: null, back: false, ford: false, amb: null, foeAmb: false, cav: 1, bow: 1, tag: '' };
  const say = (t, ms = 1100) => b.say(t, ms);
  if (T === 'hill') {
    const k = auto ? 'race' : await b.menu('山地：要搶佔高地嗎？', [{ k: 'race', n: '搶佔高地', d: '比雙方統率：搶到的一方攻擊上升，弓兵更強' }, { k: 'stay', n: '在山下列陣', d: '不搶，敵人可能會佔去' }]);
    if (k === 'race') { const me = best(P, 'lead') + Math.random() * 30, them = best(F, 'lead') + Math.random() * 30; fx.high = me >= them ? 'party' : 'foe'; }
    else if (named && Math.random() < 0.6) fx.high = 'foe';
    if (fx.high) { await say(fx.high === 'party' ? '我軍搶先佔據了高地！（攻擊上升、弓兵更強）' : '敵軍搶先佔據了高地……（敵軍攻擊上升）'); fx.tag = fx.high === 'party' ? '我軍據高地' : '敵據高地'; }
  }
  if (T === 'forest') {
    const myInt = best(P, 'int'), foeInt = best(F, 'int'); fx.foeAmb = foeInt > myInt + 5 && Math.random() < 0.5;
    const k = auto ? (myInt >= 60 ? 'amb' : 'search') : await b.menu('樹林：怎麼打？', [{ k: 'amb', n: '埋伏奇兵', d: `第二回合從林中殺出（智力 ${myInt}）`, off: myInt < 45 }, { k: 'search', n: '搜索林中伏兵', d: '找出敵人可能埋下的伏兵' }, { k: 'go', n: '直接開戰' }]);
    if (k === 'amb') fx.amb = clamp(0.06 + (myInt - 50) / 400, 0.05, 0.18);
    if (k === 'search') { if (fx.foeAmb) { fx.foeAmb = false; await say('在林子裡搜出了敵軍的伏兵，把他們趕跑了！'); } else await say('林子裡沒有發現伏兵。'); }
    fx.tag = fx.amb ? '林中伏兵' : '';
  }
  if (T === 'river') {
    const k = auto ? 'ford' : await b.menu('河邊：怎麼打？', [{ k: 'back', n: '背水一戰', d: '不能撤退，全軍攻擊上升兩成' }, { k: 'ford', n: '半渡而擊', d: '趁敵人渡河時進攻（看智力）：成功的話前兩回合攻擊大升' }, { k: 'go', n: '正常交戰' }]);
    if (k === 'back') { fx.back = true; o.noFlee = true; await say('背水列陣，已無退路！全軍拚死一戰！'); fx.tag = '背水一戰'; }
    if (k === 'ford') { fx.ford = Math.random() < clamp(0.45 + (best(P, 'int') - best(F, 'int')) / 100, 0.15, 0.9); await say(fx.ford ? '敵軍渡河到一半，我軍殺了過去！（前兩回合攻擊大升）' : '敵軍早有防備，沒能趁他們渡河時進攻。'); if (fx.ford) fx.tag = '半渡而擊'; }
  }
  if (T === 'marsh') { fx.cav = 0.8; await say('泥沼難行：騎兵威力下降'); }
  if (T === 'desert') { fx.bow = 0.85; await say('風沙蔽日：弓兵威力下降'); }
  if (T === 'plain' && named) { fx.cav = 1.1; await say('開闊的平原：騎兵威力上升', 900); }
  fx.dmg = (u, t, round) => {
    let d = 1; const mine = u.side === 'party';
    if (fx.high) d *= fx.high === u.side ? (u.troop === 'bow' ? 1.3 : 1.12) : 0.92;
    if (fx.back && mine) d *= 1.2;
    if (fx.ford && mine && round <= 2) d *= 1.3;
    if (u.troop === 'cav') d *= fx.cav; if (u.troop === 'bow') d *= fx.bow;
    return d;
  };
  // the second round: men hidden in the woods fall on one side
  fx.round = async (n) => {
    if (n !== 2) return;
    const hit = async (side, k, text) => { await say(text, 1000); for (const t of side) if (t.sol > 0) b.hit(t, Math.max(1, Math.round(t.solMax * k)), null, true); };
    if (fx.amb) await hit(F, fx.amb, '伏兵從林中殺出！敵軍大亂！');
    if (fx.foeAmb) await hit(P, 0.08, '林中殺出了敵軍的伏兵！');
  };
  return fx;
}
