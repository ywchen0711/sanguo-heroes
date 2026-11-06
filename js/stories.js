// 同伴的心事: a companion close enough to you (好感 60) tells you, one month, what weighs on him, and asks for help:
// - 報仇: the bandit chief who killed his family is still out there (a black banner on the map: beat him);
// - 尋親: a brother or sister lost in the wars is said to be living in a village (go there);
// - 求藝: his old master waits in a cave to see what he has become (go there and pass the master's test).
// Done, he comes into his own: his best strengths grow, a clever one learns a stratagem, and he is closer to you than
// ever (on the way to swearing brotherhood). State: H.story = { id: { kind, at, boss, done } }.
import { CITY_POS } from './world.js';
import { addBond, bondOf } from './bonds.js';
import { deed } from './deeds.js';
import { refresh } from './sim/engine.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const KIN = ['弟弟', '妹妹', '兄長', '姊姊', '老母親'];
const ULT = { war: ['破軍', '一騎當千', '萬夫莫敵', '龍膽'], int: ['神機', '鬼謀', '天機', '妙算'] };

export class Stories {
  constructor(game) { this.g = game; }
  get G() { return this.g.G; }
  get H() { return this.g.H; }
  st() { return (this.H.story ||= {}); }
  // the month: one companion close enough, with nothing told yet, may open his heart
  async month() {
    const H = this.H, G = this.G, S = this.st();
    if (Object.values(S).some((s) => !s.done) || Math.random() > 0.45) return;
    const cand = H.party.filter((id) => !S[id] && bondOf(H, id) >= 60 && G.gens[id]?.status !== 'dead'); if (!cand.length) return;
    await this.open(G.gens[pick(cand)]);
  }
  async open(x) {
    const game = this.g, ui = game.ui, H = this.H, G = this.G, look = game.lookOf(x), kind = pick(['revenge', 'kin', 'master']), places = game.world.places, P = game.pos;
    const far = (q) => { const d = Math.hypot(q.x - P.x, q.y - P.z); return d > 25 && d < 140; };
    let s = null;
    if (kind === 'revenge') {
      const C = G.cities[x.city] || G.cities[game.me.city], m = game.act.newMission(C, false); if (!m) return;
      const boss = `${pick(['血手', '黑煞', '鬼面', '屠夫', '毒蠍'])} ${pick(['王', '張', '李', '趙', '馬', '孫'])}${pick(['魁', '彪', '豹', '狼', '霸'])}`;
      Object.assign(m, { boss, lv: m.lv + 4, gold: Math.round(m.gold * 0.6), fame: Math.round(m.fame * 0.8), story: x.id, kind: 'bandit', minion: '惡匪' }); H.missions.push(m); if (game.mode === 'world') game.missionMarks([m]);
      s = { kind, boss, mid: m.id };
      await ui.say(x.name, `${game.me.name}，有件事我一直沒說……\n我的家人，是被一個叫「${boss}」的賊頭殺的。那年我躲在稻草堆裡，眼睜睜看著……\n最近聽說他在${C.name}一帶作亂。求你，陪我去報這個仇！`, look);
    } else {
      const qs = places.filter((q) => q.kind === (kind === 'kin' ? 'village' : 'cave') && far(q) && (kind === 'kin' || q.tier <= 3)); if (!qs.length) return;
      const q = pick(qs), who = pick(KIN);
      H.missions.push({ id: Date.now(), city: q.near ?? x.city, x: q.x, z: q.y, boss: kind === 'kin' ? `${x.name}的${who}` : `${x.name}的師父`, story: x.id, at: q.id, quiet: true, lv: 1, gold: 0, fame: 0 }); if (game.mode === 'world') game.missionMarks([H.missions[H.missions.length - 1]]);
      s = { kind, at: q.id, who };
      await ui.say(x.name, kind === 'kin' ? `${game.me.name}……戰亂那年，我和${who}走散了。\n前些日子有人說，在${q.name}看到一個很像的人。能不能陪我去看看？` : `我年輕時跟一位隱居的高人學過藝，他說等我學有所成，再回去見他。\n師父住在${q.name}。我想讓他看看，我現在有沒有出息。`, look);
    }
    this.st()[x.id] = s; ui.toast(`<b>${x.name}的心事</b>：${{ revenge: `討伐仇人「${s.boss}」`, kin: `到${places[s.at]?.name}尋找${s.who}`, master: `到${places[s.at]?.name}拜見師父` }[kind]}（地圖上以黑旗標示）`, 5000);
  }
  // a place reached: the lost one found, or the master's test
  async arrive(q) {
    const S = this.st(), H = this.H, G = this.G, ui = this.g.ui;
    for (const id in S) {
      const s = S[id], x = G.gens[id]; if (s.done || s.at !== q.id || !x || !H.party.includes(+id)) continue;
      if (s.kind === 'kin') { await ui.say(x.name, `……是你嗎？${s.who}！\n（兩人抱頭痛哭。這麼多年了，終於找到了。）`, this.g.lookOf(x)); await this.done(+id); return true; }
      if (s.kind === 'master') {
        await ui.say('隱世高人', `${x.name}，你回來了。讓我看看你這些年學了些什麼——還有你身邊這些人，配不配做你的同伴！`);
        const act = this.g.act, lv = act.avgLv() + 4, foes = [act.foe('隱世高人', 'turban', lv + 2, null, true), act.foe('門下弟子', 'bandit', lv), act.foe('門下弟子', 'bandit', lv)];
        foes[0].int = Math.min(98, 80 + lv / 3); foes[0].spells = ['feng', 'lei'];
        const r = await act.fight(foes, { terrain: 'forest', title: '師父的考驗' });
        if (r === 'win') { await ui.say('隱世高人', '好，好！你沒有辜負我。這最後一招，我傳給你。'); await this.done(+id); }
        else await ui.say('隱世高人', '還差得遠呢。再練練，下次再來吧。');
        return true;
      }
    }
    return false;
  }
  // the story ends: he comes into his own
  async done(id) {
    const G = this.G, H = this.H, x = G.gens[id], s = this.st()[id]; if (!x || !s || s.done) return; s.done = true;
    for (const m of H.missions.filter((m) => m.story === id)) this.g.act.dropBanner(m); H.missions = H.missions.filter((m) => m.story !== id);
    const smart = x.int > x.war, ult = pick(ULT[smart ? 'int' : 'war']), up = smart ? { int: 5, lead: 3 } : { war: 5, lead: 3 };
    for (const k in up) x.base[k] = Math.min(110, x.base[k] + up[k]); refresh(G, x); s.ult = ult;
    let learnt = ''; if (smart && x.int >= 65) { const sp = ['feng', 'huan', 'dun', 'lei'].find((k) => !x.spells.includes(k)); if (sp) { x.spells.push(sp); learnt = '，學會了新的法術'; } }
    addBond(this.g, id, 25); deed(this.g, `助${x.name}了卻心願`); this.g.audio.sfx('level');
    await this.g.ui.say(x.name, `${pick([`${this.g.me.name}，這份恩情，我一輩子都還不了。`, '心裡的石頭終於放下了。從今以後，我的命就是你的。', '多虧有你。以後不管去哪裡，我都跟著你！'])}\n（${x.name}領悟了絕招「${ult}」：${Object.entries(up).map(([k, v]) => ({ war: '武力', int: '智力', lead: '統率' }[k] + ' +' + v)).join('、')}${learnt}，好感 +25）`, this.g.lookOf(x));
    this.g.hud();
  }
  // the people panel: whose stories are open
  html() {
    const S = this.H.story || {}, G = this.G, rows = Object.entries(S).map(([id, s]) => { const x = G.gens[id]; if (!x) return ''; const what = { revenge: `討伐仇人「${s.boss}」`, kin: `尋找${s.who}（${this.g.world.places[s.at]?.name}）`, master: `拜見師父（${this.g.world.places[s.at]?.name}）` }[s.kind]; return `<p><b>${x.name}</b>　${what}　${s.done ? `<span style="color:#8aff8a">完成・絕招「${s.ult}」</span>` : '<span style="color:#ffd86a">進行中</span>'}</p>`; }).join('');
    return rows ? `<h4>同伴的心事</h4>${rows}` : '';
  }
}
