// 官階: the ranks of the Han army, from a clerk to the Grand Marshal. [name, merit needed, monthly pay, score at the end]
// The perks (hero.js PERKS) follow the same order. Kept in one place for the player and the computer rivals alike.
export const RANKS = [
  ['從事', 0, 20, 0], ['軍司馬', 20, 35, 30], ['校尉', 40, 50, 60], ['都尉', 100, 80, 120], ['偏將軍', 130, 110, 180], ['裨將軍', 165, 140, 250],
  ['中郎將', 200, 170, 330], ['雜號將軍', 350, 210, 420], ['征虜將軍', 460, 250, 520], ['四征將軍', 580, 300, 650], ['四鎮將軍', 720, 350, 780],
  ['前將軍', 880, 400, 920], ['衛將軍', 1060, 460, 1060], ['車騎將軍', 1260, 520, 1200], ['驃騎將軍', 1500, 600, 1350], ['大將軍', 1800, 700, 1500], ['大司馬', 2200, 800, 1700],
];
export const LORD_SCORE = 1800;
// the rank from which a general may lead an army against a city (校尉)
export const SIEGE_RANK = 2;
export const rankOf = (merit) => { let k = 0; RANKS.forEach((r, i) => { if (merit >= r[1]) k = i; }); return k; };
// an old save kept the index of the old six ranks
export const OLD_RANKS = ['從事', '校尉', '都尉', '中郎將', '將軍', '大將軍'];
export const fromOld = (i) => Math.max(0, RANKS.findIndex((r) => r[0] === (OLD_RANKS[i] === '將軍' ? '雜號將軍' : OLD_RANKS[i])));
