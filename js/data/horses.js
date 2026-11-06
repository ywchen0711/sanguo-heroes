// The famous horses that run wild (js/horses.js): nobody's in the histories, to be found on the plains and tamed.
// [key, zh, en, stats, what it does in battle (hero.js ARMS), coat, mane, temper (what tames it), where it runs]
export const WILD = [
  ['wuzhui', '烏騅', 'Black Dapple', { lead: 2, war: 1 }, { n: '烏騅', d: '霸王之駒：會心一擊的機會上升，騎兵威力上升', crit: 0.08, cav: 1.08 }, '#2a2a30', '#101014', 'war', 'north'],
  ['zhaoye', '照夜玉獅子', 'Night-Shining Lion', { lead: 1, cha: 2 }, { n: '照夜玉獅子', d: '白如玉雪：一成五的機會閃過攻擊，速度上升', dodge: 0.15, spd: 12 }, '#f4f4ee', '#d0d0d0', 'cha', 'west'],
  ['hanxue', '汗血寶馬', 'Blood-Sweating Steed', { lead: 2 }, { n: '汗血寶馬', d: '日行千里：速度大幅上升，騎兵威力上升', spd: 22, cav: 1.08 }, '#a84a2a', '#5a2010', 'int', 'west'],
  ['huangbiao', '黃驃馬', 'Yellow Charger', { lead: 1, war: 1 }, { n: '黃驃馬', d: '久經沙場：騎兵威力大幅上升', cav: 1.15 }, '#d8b050', '#f0e8d0', 'feed', 'north'],
  ['bailong', '白龍駒', 'White Dragon Colt', { lead: 2 }, { n: '白龍駒', d: '踏雪無痕：撤退必定成功，一成的機會閃過攻擊', flee: true, dodge: 0.1 }, '#e0e8f0', '#a8b8c8', 'cha', 'south'],
];
