// Scenarios: the year the game starts, the warlords and their cities, who is at war or allied, and where generals serve.
//   factions: [id, name, lord, colour, cities]  (the first city is the capital; ids are shared across scenarios so a
//             general's historical faction (data/allegiance.js) still finds "cao", "liubei", "sun" …)
//   carry:    a general whose 190 faction no longer exists serves this faction instead ('-' = unaffiliated)
//   who:      named exceptions: where this general serves when the scenario starts ('-' = unaffiliated)
//   rel / ally / truce: starting relations, alliances and truces
import { FACTIONS_190 } from './world.js';

const C = { cao: '#2a5ad8', sun: '#d84a3a', liubei: '#3aa85a', yuanshao: '#d8b02a', yuanshu: '#c88ad8', liubiao: '#2aa8a8', liuyan: '#c8784a', zhanglu: '#a8c84a',
  mateng: '#7a5ad8', gongsun: '#e8e8e8', gongsundu: '#6a8aa8', menghuo: '#c8a85a', shixie: '#5aa87a', jinxuan: '#7a7a8a', liudu: '#6a8a6a', zhaofan: '#8a7a6a' };

export const SCENARIOS = [
  { id: '190', year: 190, name: ['群雄討董', 'Rise Against Dong Zhuo'],
    desc: ['公元一九〇年，董卓挾天子以令諸侯，關東群雄並起，二十七路諸侯割據天下。', 'AD 190. Dong Zhuo holds the emperor hostage, and twenty-seven warlords rise across the land.'],
    factions: FACTIONS_190, dong: true,
    rel: [['liubei', 'gongsun', 60], ['sun', 'yuanshu', 60], ['cao', 'yuanshao', 40], ['cao', 'liudai', 20], ['liuyu', 'gongsun', -30], ['yuanshao', 'gongsun', -30]] },

  { id: '195', year: 195, name: ['群雄割據', 'Warlords Divide the Land'],
    desc: ['董卓已死，李傕、郭汜亂長安；曹操據兗州，呂布投奔徐州，孫策準備渡江——群雄割據，逐鹿中原。', 'Dong Zhuo is dead and Li Jue and Guo Si ravage Chang\'an. Cao Cao holds Yan, Lü Bu flees to Xu, and Sun Ce prepares to cross the river.'],
    factions: [
      ['cao', '曹操', '曹操', C.cao, ['陳留', '許昌', '譙', '濮陽']], ['lubu', '呂布', '呂布', '#b04848', ['小沛']], ['liubei', '劉備', '劉備', C.liubei, ['下邳']],
      ['yuanshao', '袁紹', '袁紹', C.yuanshao, ['南皮', '鄴', '平原']], ['gongsun', '公孫瓚', '公孫瓚', C.gongsun, ['北平', '薊']], ['gongsundu', '公孫度', '公孫度', C.gongsundu, ['襄平']],
      ['kongrong', '孔融', '孔融', '#d89ab8', ['北海']], ['yuanshu', '袁術', '袁術', C.yuanshu, ['壽春', '汝南', '廬江']], ['sun', '孫策', '孫策', C.sun, ['建業']],
      ['liuyao', '劉繇', '劉繇', '#4a7a5a', ['柴桑']], ['yan', '嚴白虎', '嚴白虎', '#6a4a6a', ['吳']], ['wanglang', '王朗', '王朗', '#a86a8a', ['會稽']],
      ['lijue', '李傕', '李傕', '#8a2a2a', ['長安', '安定', '弘農', '洛陽']], ['zhangji', '張濟', '張濟', '#909060', ['宛']], ['zhangyang', '張楊', '張楊', '#8a8a5a', ['晉陽']],
      ['mateng', '馬騰', '馬騰', C.mateng, ['武威', '天水']], ['liubiao', '劉表', '劉表', C.liubiao, ['襄陽', '江陵', '江夏', '新野', '長沙']],
      ['liuyan', '劉璋', '劉璋', C.liuyan, ['成都', '梓潼', '江州', '永安']], ['zhanglu', '張魯', '張魯', C.zhanglu, ['漢中']],
      ['jinxuan', '金旋', '金旋', C.jinxuan, ['武陵']], ['liudu', '劉度', '劉度', C.liudu, ['零陵']], ['zhaofan', '趙範', '趙範', C.zhaofan, ['桂陽']],
      ['menghuo', '孟獲', '孟獲', C.menghuo, ['雲南']], ['shixie', '士燮', '士燮', C.shixie, ['交趾']]],
    carry: { dong: 'lijue', hanfu: 'yuanshao', liuyu: 'yuanshao', taoqian: 'liubei', liudai: 'cao', lukang: 'sun' },
    who: { 陳宮: 'lubu', 張遼: 'lubu', 高順: 'lubu', 臧霸: 'lubu', 賈詡: 'zhangji', 許褚: 'cao', 太史慈: 'liuyao', 甘寧: 'liubiao', 周瑜: 'sun' },
    rel: [['cao', 'lubu', -60], ['yuanshao', 'gongsun', -60], ['cao', 'yuanshao', 30], ['sun', 'yuanshu', 40], ['sun', 'liuyao', -50], ['liubei', 'yuanshu', -40]] },

  { id: '200', year: 200, name: ['官渡之戰', 'The Battle of Guandu'],
    desc: ['曹操挾天子以令諸侯，與坐擁河北四州的袁紹決戰官渡；孫策據江東，劉備寄身汝南。', 'Cao Cao, holding the emperor, faces Yuan Shao and his four northern provinces at Guandu. Sun Ce rules the lands east of the river; Liu Bei clings to Runan.'],
    factions: [
      ['cao', '曹操', '曹操', C.cao, ['許昌', '陳留', '譙', '濮陽', '小沛', '下邳', '洛陽', '弘農', '長安', '宛', '壽春']],
      ['yuanshao', '袁紹', '袁紹', C.yuanshao, ['南皮', '鄴', '平原', '北海', '晉陽', '薊', '北平']], ['gongsundu', '公孫度', '公孫度', C.gongsundu, ['襄平']],
      ['liubei', '劉備', '劉備', C.liubei, ['汝南']], ['sun', '孫策', '孫策', C.sun, ['建業', '吳', '會稽', '廬江', '柴桑']],
      ['liubiao', '劉表', '劉表', C.liubiao, ['襄陽', '江陵', '江夏', '新野', '長沙', '武陵', '零陵', '桂陽']],
      ['liuyan', '劉璋', '劉璋', C.liuyan, ['成都', '梓潼', '江州', '永安', '建寧']], ['zhanglu', '張魯', '張魯', C.zhanglu, ['漢中', '上庸']],
      ['mateng', '馬騰', '馬騰', C.mateng, ['武威', '天水', '安定']], ['menghuo', '孟獲', '孟獲', C.menghuo, ['雲南']], ['shixie', '士燮', '士燮', C.shixie, ['交趾']]],
    carry: { dong: 'cao', hanfu: 'yuanshao', liuyu: 'yuanshao', gongsun: 'yuanshao', taoqian: 'cao', kongrong: 'cao', liudai: 'cao', yuanshu: 'cao', zhangyang: 'cao',
      lukang: 'sun', liuyao: 'sun', yan: 'sun', wanglang: 'cao', jinxuan: 'liubiao', liudu: 'liubiao', zhaofan: 'liubiao' },
    who: { 關羽: 'liubei', 張飛: 'liubei', 趙雲: 'liubei', 簡雍: 'liubei', 孫乾: 'liubei', 糜竺: 'liubei', 糜芳: 'liubei', 陳到: 'liubei', 張遼: 'cao', 徐晃: 'cao', 臧霸: 'cao',
      賈詡: 'cao', 張繡: 'cao', 太史慈: 'sun', 甘寧: 'liubiao', 魏延: 'liubiao', 諸葛亮: '-', 龐統: '-', 徐庶: '-', 法正: 'liuyan', 孟達: 'liuyan' },
    rel: [['cao', 'yuanshao', -80], ['liubei', 'cao', -80], ['liubei', 'yuanshao', 50], ['sun', 'cao', 20], ['liubiao', 'yuanshao', 20], ['sun', 'liubiao', -40]],
    ally: [['liubei', 'yuanshao']] },

  { id: '208', year: 208, name: ['赤壁之戰', 'Red Cliffs'],
    desc: ['曹操統一北方，揮軍南下奪取荊州；孫權與劉備結盟，共抗曹軍於赤壁。', 'Cao Cao has united the north and marches south to take Jing. Sun Quan and Liu Bei ally to stand against him at the Red Cliffs.'],
    factions: [
      ['cao', '曹操', '曹操', C.cao, ['許昌', '北平', '薊', '南皮', '平原', '北海', '鄴', '晉陽', '濮陽', '陳留', '小沛', '下邳', '譙', '汝南', '壽春', '洛陽', '弘農', '長安', '宛', '新野', '襄陽', '江陵']],
      ['gongsundu', '公孫康', '公孫康', C.gongsundu, ['襄平']], ['sun', '孫權', '孫權', C.sun, ['建業', '吳', '會稽', '廬江', '柴桑']], ['liubei', '劉備', '劉備', C.liubei, ['江夏']],
      ['liuyan', '劉璋', '劉璋', C.liuyan, ['成都', '梓潼', '江州', '永安', '建寧']], ['zhanglu', '張魯', '張魯', C.zhanglu, ['漢中', '上庸']],
      ['mateng', '馬騰', '馬騰', C.mateng, ['武威', '天水', '安定']], ['hanxuan', '韓玄', '韓玄', '#9a6a5a', ['長沙']], ['jinxuan', '金旋', '金旋', C.jinxuan, ['武陵']],
      ['liudu', '劉度', '劉度', C.liudu, ['零陵']], ['zhaofan', '趙範', '趙範', C.zhaofan, ['桂陽']], ['menghuo', '孟獲', '孟獲', C.menghuo, ['雲南']], ['shixie', '士燮', '士燮', C.shixie, ['交趾']]],
    carry: { dong: 'cao', hanfu: 'cao', liuyu: 'cao', gongsun: 'cao', taoqian: 'cao', kongrong: 'cao', liudai: 'cao', yuanshu: 'cao', zhangyang: 'cao', yuanshao: 'cao',
      liubiao: 'cao', lukang: 'sun', liuyao: 'sun', yan: 'sun', wanglang: 'cao' },
    who: { 劉琦: 'liubei', 諸葛亮: 'liubei', 關羽: 'liubei', 張飛: 'liubei', 趙雲: 'liubei', 簡雍: 'liubei', 孫乾: 'liubei', 糜竺: 'liubei', 糜芳: 'liubei', 陳到: 'liubei', 劉封: 'liubei', 伊籍: 'liubei',
      黃忠: 'hanxuan', 魏延: 'hanxuan', 甘寧: 'sun', 太史慈: 'sun', 徐庶: 'cao', 司馬懿: 'cao', 龐統: '-', 馬良: '-', 法正: 'liuyan', 孟達: 'liuyan', 張遼: 'cao', 徐晃: 'cao', 張郃: 'cao', 賈詡: 'cao' },
    rel: [['cao', 'sun', -60], ['cao', 'liubei', -90], ['sun', 'liubei', 60], ['mateng', 'cao', -20]], ally: [['sun', 'liubei']] },

  { id: '221', year: 221, name: ['三國鼎立', 'The Three Kingdoms'],
    desc: ['曹丕篡漢稱帝，劉備即位於成都，孫權雄踞江東——天下三分。', 'Cao Pi has ended the Han and made himself emperor; Liu Bei takes the throne in Chengdu; Sun Quan holds the south-east. The realm is split in three.'],
    factions: [
      ['cao', '曹丕', '曹丕', C.cao, ['洛陽', '北平', '薊', '南皮', '平原', '北海', '鄴', '晉陽', '濮陽', '陳留', '小沛', '下邳', '許昌', '譙', '汝南', '壽春', '弘農', '長安', '安定', '天水', '武威', '宛', '新野', '襄陽', '上庸']],
      ['gongsundu', '公孫康', '公孫康', C.gongsundu, ['襄平']], ['liubei', '劉備', '劉備', C.liubei, ['成都', '梓潼', '江州', '永安', '漢中', '建寧']],
      ['sun', '孫權', '孫權', C.sun, ['建業', '吳', '會稽', '廬江', '柴桑', '江夏', '江陵', '長沙', '武陵', '零陵', '桂陽', '交趾']], ['menghuo', '孟獲', '孟獲', C.menghuo, ['雲南']]],
    carry: { dong: 'cao', hanfu: 'cao', liuyu: 'cao', gongsun: 'cao', taoqian: 'cao', kongrong: 'cao', liudai: 'cao', yuanshu: 'cao', zhangyang: 'cao', yuanshao: 'cao', liubiao: 'cao',
      mateng: 'cao', zhanglu: 'cao', liuyan: 'liubei', lukang: 'sun', liuyao: 'sun', yan: 'sun', wanglang: 'cao', shixie: 'sun', jinxuan: 'sun', liudu: 'sun', zhaofan: 'sun' },
    who: { 馬超: 'liubei', 馬岱: 'liubei', 黃權: 'liubei', 魏延: 'liubei', 劉巴: 'liubei', 吳懿: 'liubei', 李嚴: 'liubei', 嚴顏: 'liubei', 孟達: 'cao', 糜芳: 'sun', 于禁: 'cao', 趙雲: 'liubei', 張飛: 'liubei' },
    rel: [['liubei', 'sun', -80], ['sun', 'cao', 30], ['liubei', 'cao', -80]], truce: [['sun', 'cao']] },

  { id: 'heroes', year: 190, name: ['英雄集結（假想）', 'Gathering of Heroes (what-if)'],
    desc: ['假想劇本：五百名武將不分時代同時登場——曹操、諸葛亮、司馬懿、陸遜、姜維、鄧艾同台爭霸，各自的壽命重新計算。', 'What if: all five hundred generals are alive at once. Cao Cao, Zhuge Liang, Sima Yi, Lu Xun, Jiang Wei and Deng Ai all compete in the same age, with new lifespans.'],
    factions: FACTIONS_190, dong: true, allStars: true,
    rel: [['liubei', 'gongsun', 60], ['sun', 'yuanshu', 60], ['cao', 'yuanshao', 40]] },
];
export const SCEN = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
