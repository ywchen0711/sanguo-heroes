// Famous items (寶物), spells (法術) and the four hidden generals.
//
// ITEMS: [id, zh, en, slot, bonus, holders, hideIn, teaches]
//   slot: w weapon, h horse, b book, t treasure (a general carries at most one of each)
//   bonus: added to the holder's stats (lead war int pol cha); a horse also helps its rider escape capture
//   holders: who has it when the scenario starts: the first of these who is alive and active ([name, fromYear, toYear] limits it)
//   hideIn: otherwise it lies hidden in this city ('*' = a random city) until someone searching finds it
//   teaches: a book can teach its reader these spells
export const ITEMS = [
  ['qinglong', '青龍偃月刀', 'Green Dragon Crescent Blade', 'w', { war: 5, lead: 2 }, ['關羽'], '*'],
  ['shemao', '丈八蛇矛', 'Serpent Spear', 'w', { war: 5 }, ['張飛'], '*'],
  ['huaji', '方天畫戟', 'Sky Piercer', 'w', { war: 6 }, ['呂布'], '*'],
  ['shuanggu', '雌雄雙股劍', 'Twin Swords', 'w', { war: 3, cha: 3 }, ['劉備'], '*'],
  ['yitian', '倚天劍', 'Heaven-Leaning Sword', 'w', { lead: 3, war: 3 }, ['曹操', '曹丕'], '許昌'],
  ['qinggang', '青釭劍', 'Blue Blade', 'w', { war: 4 }, [['趙雲', 208]], '許昌'],
  ['guding', '古錠刀', 'Ancient Ingot Blade', 'w', { war: 3, lead: 2 }, ['孫堅', '孫策', '孫權'], '長沙'],
  ['qixing', '七星寶刀', 'Seven-Star Sword', 'w', { war: 2, int: 2 }, ['王允'], '洛陽'],
  ['shuangji', '雙鐵戟', 'Twin Iron Halberds', 'w', { war: 4 }, ['典韋'], '*'],
  ['tieji', '鐵脊蛇矛', 'Iron-Spine Spear', 'w', { war: 3 }, ['程普'], '*'],
  ['chitu', '赤兔馬', 'Red Hare', 'h', { lead: 2, war: 2 }, ['呂布', ['關羽', 200]], '*'],
  ['dilu', '的盧', 'Dilu', 'h', { lead: 2, cha: 1 }, [['劉備', 200]], '襄陽'],
  ['jueying', '絕影', 'Shadow Runner', 'h', { lead: 2 }, ['曹操'], '*'],
  ['zhuahuang', '爪黃飛電', 'Lightning Steed', 'h', { lead: 1, cha: 2 }, [['曹操', 200], '曹丕'], '許昌'],
  ['sunzi', '孫子兵法', 'The Art of War', 'b', { lead: 5, int: 3 }, [], '*'],
  ['mengde', '孟德新書', 'Mengde\'s New Book', 'b', { lead: 3, int: 3 }, ['曹操'], '*'],
  ['taiping', '太平要術', 'The Way of Great Peace', 'b', { int: 5, cha: 2 }, [], '鄴', ['yao', 'lei']],
  ['dunjia', '遁甲天書', 'The Book of Hidden Escape', 'b', { int: 4 }, ['于吉'], '會稽', ['dun']],
  ['qingnang', '青囊書', 'The Blue Bag Manual', 'b', { pol: 4 }, ['華佗'], '譙', ['zhi']],
  ['bingfa24', '兵法二十四篇', 'Twenty-Four Chapters on War', 'b', { lead: 3, int: 4 }, [['諸葛亮', 207]], '襄陽', ['zhen']],
  ['liutao', '六韜三略', 'The Six Secret Teachings', 'b', { lead: 4, int: 2 }, [], '*'],
  ['zuozhuan', '春秋左氏傳', 'The Zuo Commentary', 'b', { int: 3, pol: 2 }, ['關羽'], '*'],
  ['yuxi', '傳國玉璽', 'The Imperial Seal', 't', { cha: 8 }, [['孫堅', 190, 191], ['袁術', 192, 199], ['曹操', 200, 219], ['曹丕', 220]], '洛陽'],
  ['yeming', '夜明珠', 'The Luminous Pearl', 't', { pol: 3, cha: 3 }, [], '*'],
  ['jinnang', '錦囊妙計', 'The Silk Bags', 't', { int: 4 }, [['諸葛亮', 207]], '*'],
  // the swords the four hidden generals bring with them
  ['chixiao', '赤霄劍', 'Chixiao Sword', 'w', { war: 6, lead: 2 }, [], null],
  ['taia', '太阿劍', 'Tai\'e Sword', 'w', { war: 4, int: 4 }, [], null],
  ['ganjiang', '干將劍', 'Ganjiang Sword', 'w', { lead: 5, cha: 3 }, [], null],
  ['moye', '莫邪劍', 'Moye Sword', 'w', { int: 5, pol: 3 }, [], null],
];

// SPELLS: [id, zh, en, what it does in battle]
//   lei 落雷   a bolt from the sky: heavy losses, and it may strike down an enemy officer
//   yao 妖術   sorcery: the enemy panics, morale collapses
//   feng 呼風  summoned wind: a fire attack rages far beyond control
//   zhen 八陣圖 the stone maze (defence only): the attackers are lost in the formation
//   dun 奇門遁甲 the art of escape: our losses are halved
//   huan 幻術  illusion: the enemy's stratagem is undone and morale falls
//   zhi 治癒   healing: after the battle many of the wounded return to the ranks
export const SPELLS = {
  lei: ['落雷之術', 'a lightning spell'], yao: ['妖術', 'sorcery'], feng: ['呼風喚雨', 'a summoned wind'], zhen: ['八陣圖', 'the Eight-Gate Maze'],
  dun: ['奇門遁甲', 'the Art of Hidden Escape'], huan: ['幻術', 'an illusion'], zhi: ['治癒之術', 'healing arts'],
};
// who knows which spells when the game starts
export const SPELL_HOLDERS = { 諸葛亮: ['zhen', 'feng'], 于吉: ['yao', 'lei'], 華佗: ['zhi'], 黃承彥: ['zhen'], 司馬懿: ['dun'], 張魯: ['yao'], 孟節: ['zhi'], 龐統: ['huan'], 龐德公: ['huan'] };

// four hidden generals: they may appear at a random time and place in any game
//   name, lead, war, int, pol, cha, sword, spells
export const HIDDEN = [
  ['Jeff', 99, 88, 97, 95, 99, 'ganjiang', ['zhen', 'feng']],
  ['Josh', 96, 100, 86, 72, 92, 'chixiao', ['lei']],
  ['Jasper', 97, 95, 98, 88, 95, 'taia', ['dun', 'huan']],
  ['Erin', 92, 84, 99, 96, 98, 'moye', ['feng', 'zhi', 'yao']],
];
