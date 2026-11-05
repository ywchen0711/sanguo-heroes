// 特性 (traits): every general has two. A trait belongs to one or two of fifteen schools (系); two traits of the same
// school resonate (共鳴), two of schools that help each other are 相生, and certain pairs are a named combination (名組合)
// — in one general (個人絕技) or across two members of the party (合擊) — that is much stronger than the parts.
// A line: name|schools|rarity (1 common, 2 rare, 3 legendary)|effects|flavour.
// The effects use the treasure powers (data/relics.js POWERS) and a few more (EXTRA below).
export const SCHOOLS = {
  勇: ['武勇', '#e06a4a'], 騎: ['騎兵', '#d8a040'], 弓: ['弓術', '#a0c050'], 水: ['水軍', '#4aa0e0'], 守: ['防守', '#8a9ab0'],
  謀: ['計略', '#7a8aff'], 火: ['火攻', '#ff7a3a'], 仁: ['仁德', '#6ad08a'], 速: ['迅捷', '#5ad0d0'], 統: ['統率', '#e0c060'],
  奇: ['奇門', '#c07aff'], 政: ['內政', '#b0a070'], 魅: ['魅力', '#ff8ac0'], 遊: ['遊俠', '#a08060'], 運: ['氣運', '#ffd84a'],
};
const pc = (v) => `${Math.round(v * 100)}%`;
// effects that are not treasure powers
export const EXTRA = {
  war: (v) => `武力 +${v}`, int: (v) => `智力 +${v}`, lead: (v) => `統率 +${v}`, pol: (v) => `政治 +${v}`, cha: (v) => `魅力 +${v}`,
  fire: (v) => `火計威力 +${pc(v)}`, siege: (v) => `攻城時攻擊 +${pc(v)}`, wall: (v) => `守城時受到的傷害 -${pc(v)}`,
  lowAtk: (v) => `兵力不到三成時攻擊 +${pc(v)}`, firstAtk: (v) => `第一回合傷害 +${pc(v)}`, bossDmg: (v) => `對武將與頭目傷害 +${pc(v)}`,
  beastDmg: (v) => `對猛獸傷害 +${pc(v)}`, infPow: (v) => `率領步兵時攻擊 +${pc(v)}`, horse: (v) => `坐騎的效果 +${pc(v)}`,
  farm: (v) => `開墾成效 +${pc(v)}`, comm: (v) => `經商成效 +${pc(v)}`, morale: (v) => `安民成效 +${pc(v)}`, train: (v) => `練兵成效 +${pc(v)}`,
  build: (v) => `築城成效 +${pc(v)}`, loyal: (v) => `部下忠誠 +${Math.round(v * 100)}`, merit: (v) => `得到的功績 +${pc(v)}`,
  price: (v) => `買東西便宜 ${pc(v)}`, diplo: (v) => `外交成功率 +${pc(v)}`, bond: (v) => `好感上升 +${pc(v)}`, event: (v) => `奇遇機率 +${pc(v)}`,
};
export const TRAITS_RAW = `
猛將|勇|1|crit:.06 war:2|一鼓作氣，衝鋒在前
豪勇|勇|1|duelDmg:.12|陣前單挑，威風凜凜
剛力|勇|1|pierce:.12|力能扛鼎
鐵骨|勇守|1|physRes:.06|刀砍不入的硬漢
狂戰|勇|2|combo:.14 physRes:-.05|殺紅了眼，不顧防守
背水|勇|2|lowAtk:.3|置之死地而後生
萬夫莫敵|勇|3|crit:.12 duelDmg:.2 war:4|一人當關，萬夫莫開
斬將|勇|2|bossDmg:.2|專挑敵將下手
陷陣|勇統|2|breakdef:.2|破陣先登，所攻無不破
虎癡|勇守|2|counter:.25 duelHp:.15|護主如山
先登|勇速|1|firstAtk:.2|攻城第一個爬上城頭
橫掃千軍|勇|3|sweep:.35|一戟掃過，人仰馬翻
怒吼|勇|1|startRouse:1|開戰一聲大喝
百戰|勇|1|exp:.12 war:1|身經百戰
血戰|勇|2|steal:.1|越戰越勇
勇冠三軍|勇魅|3|auraAtk:.06 war:3|全軍為之振奮
騎術|騎|1|cavPow:.1|自幼在馬背上長大
鐵騎|騎勇|2|cavPow:.18 pierce:.1|重甲鐵騎，衝陣無前
白馬義從|騎弓|2|cavPow:.12 bowPow:.1|騎射如飛
奔襲|騎速|1|spd:6|千里奔襲
突騎|騎|1|firstAtk:.15 cavPow:.06|突騎衝陣
西涼鐵騎|騎勇|3|cavPow:.25 crit:.08|西涼的悍勇騎兵
相馬|騎運|1|horse:.2|識得好馬
衝陣|騎統|2|breakdef:.15 cavPow:.08|一馬當先撕開敵陣
游騎|騎遊|1|flee:1 encounter:.1|來去無蹤的斥候
飛將|騎速|3|first:1 cavPow:.15|來去如風
胡騎|騎|1|cavPow:.08 spd:3|塞外的騎手
虎豹騎|騎統|3|cavPow:.2 auraAtk:.05|天下最精銳的親兵
馳援|騎仁|1|mend:.05 spd:4|哪裡危急就往哪裡去
踏陣|騎勇|2|sweep:.2 cavPow:.06|鐵蹄踏過敵陣
弓術|弓|1|bowPow:.1|拉得一手好弓
百步穿楊|弓|2|bowPow:.15 crit:.06|百步之外射中柳葉
連弩|弓謀|2|bowPow:.1 combo:.1|一發十矢
神射|弓|3|bowPow:.22 pierce:.15|箭無虛發
暗箭|弓奇|1|crit:.08 dodge:.03|躲在暗處放冷箭
火箭|弓火|2|fire:.15 bowPow:.08|箭頭綁上火油
強弓|弓勇|1|pierce:.1 bowPow:.05|三石強弓
箭雨|弓統|2|sweep:.2 bowPow:.06|萬箭齊發
冷箭|弓|1|bossDmg:.12|一箭射向敵將
鷹眼|弓遊|1|crit:.05 encounter:.1|遠遠就看見敵人
射鵰|弓騎|2|bowPow:.12 cavPow:.08|在奔馬上射下大鵰
定軍|弓勇|3|bowPow:.18 bossDmg:.2|老當益壯，陣斬大將
穿雲|弓速|1|bowPow:.06 spd:4|箭快如流星
水性|水|1|navyPow:.1|生在江邊，水性極好
水軍都督|水統|3|navyPow:.25 auraAtk:.05|統領江上千帆
錦帆|水勇|2|navyPow:.15 combo:.08|錦帆賊出身
樓船|水守|2|navyPow:.1 physRes:.06|高大的樓船如城
弄潮|水速|1|navyPow:.08 spd:3|在風浪裡如履平地
水戰|水|1|navyPow:.12|熟悉水上作戰
江東子弟|水魅|1|navyPow:.06 recruit:.05|江東的子弟兵
鐵索連環|水謀|2|navyPow:.1 sweep:.15|船船相連，穩如平地
漁家|水遊|1|navyPow:.05 gold:.1|打魚人家出身
海賊|水遊|1|navyPow:.08 steal:.06|在海上討生活
水淹|水謀|2|tacDmg:.12 navyPow:.05|掘開堤防，水淹敵軍
艨艟|水勇|2|navyPow:.12 pierce:.1|衝撞敵船的快艦
堅守|守|1|wall:.15|城在人在
鐵壁|守|2|physRes:.1 block:.1|銅牆鐵壁
不動如山|守統|3|physRes:.14 auraDef:.06 noConfuse:1|其徐如林，不動如山
盾手|守|1|block:.12|一面大盾擋在身前
固城|守政|1|wall:.12|修好城牆再說
金湯|守|2|wall:.25|固若金湯
反擊|守勇|1|counter:.2|打我？先吃我一刀
忍耐|守|1|lowHeal:.3|撐住，再撐一下
沉著|守謀|1|tacRes:.12 noConfuse:1|泰山崩於前而色不變
護主|守仁|2|auraDef:.05 counter:.12|誓死保護主公
不屈|守勇|2|revive:.3|倒下了還能站起來
陣地|守統|1|physRes:.05 block:.06|紮營布陣，步步為營
城防|守政|1|wall:.1 build:.1|最懂城防的人
長城|守|3|wall:.35 physRes:.08|國家的長城
苦守|守|1|wall:.08 lowHeal:.2|孤城苦守，等待援軍
謀士|謀|1|tacDmg:.1|運籌帷幄
神算|謀|2|tacHit:.12 tacDmg:.08|料事如神
奇謀|謀奇|2|tacDmg:.15 stun:.06|出奇制勝
省力|謀|1|tacCost:.15|用最少的力氣辦事
養氣|謀|1|spRegen:3|靜心養氣
識破|謀守|1|tacRes:.15|一眼看穿敵人的計謀
離間|謀魅|2|stun:.1|挑撥離間，讓敵人自亂陣腳
伏兵|謀遊|2|firstAtk:.15 tacDmg:.06|四面埋伏
臥龍|謀奇|3|tacDmg:.2 tacCost:.2 spRegen:4 int:4|臥龍出山，天下三分
鳳雛|謀火|3|fire:.2 tacHit:.1 tacDmg:.1|鳳雛之才，不在臥龍之下
鬼才|謀奇|3|again:.12 tacDmg:.12|奇策迭出，鬼神莫測
算無遺策|謀|3|tacHit:.2 tacRes:.15|算無遺策，畫無失理
博學|謀政|1|exp:.1 int:2|讀遍經史子集
兵法|謀統|1|tacDmg:.06 auraAtk:.03|熟讀孫子兵法
偽報|謀|1|stun:.06|散佈假消息
空城|謀守|2|tacRes:.2 wall:.1|大開城門，彈琴退敵
十面埋伏|謀統|3|tacDmg:.15 sweep:.25|四面八方都是伏兵
遠謀|謀政|1|merit:.15 int:1|看得比別人遠
火計|火謀|1|fire:.15|放一把火
火攻|火|2|fire:.25|火攻乃兵家利器
烈焰|火勇|2|fire:.15 crit:.06|火勢沖天
東風|火奇|2|fire:.2 spd:3|萬事俱備，只欠東風
焚營|火遊|1|fire:.1 firstAtk:.1|夜裡潛入敵營放火
火牛陣|火騎|2|fire:.12 cavPow:.1|牛尾綁上火把衝向敵陣
赤壁|火水|3|fire:.3 navyPow:.15|檣櫓灰飛煙滅
火燒連營|火謀|3|fire:.3 tacHit:.1|火燒七百里連營
炎龍|火奇|2|fire:.18 tacCost:.1|火焰化成巨龍
硫磺|火運|1|fire:.08 drop:.03|隨身帶著引火之物
仁德|仁魅|1|recruit:.06 fame:.1|以德服人
醫術|仁|1|healPow:.2|懂得醫治傷兵
神醫|仁奇|3|healPow:.4 mend:.12 lowHeal:.3|妙手回春
救護|仁|1|mend:.08|戰後救治傷兵
愛民|仁政|1|morale:.1|愛民如子
寬厚|仁魅|1|loyal:.1|待人寬厚
仁者無敵|仁統|3|auraDef:.08 auraAtk:.05 fame:.2|仁者無敵於天下
慈悲|仁|1|healPow:.12 tacRes:.05|心存慈悲
懸壺|仁遊|1|mend:.05 healPow:.1|懸壺濟世，遊走四方
德望|仁魅|2|recruit:.1 loyal:.1|德高望重
攜民渡江|仁統|2|fame:.2 auraDef:.05|寧可慢，也不拋下百姓
施粥|仁政|1|fame:.12 morale:.05|荒年在城門口施粥
養生|仁|1|regen:.03|懂得養生之道
捨身|仁守|2|auraDef:.06 revive:.2|為同伴擋下致命一擊
迅捷|速|1|spd:5|動作比別人快
疾風|速騎|2|spd:10|疾如風
神行|速遊|1|encounter:.15 spd:3|日行八百里
閃身|速|1|dodge:.06|一閃身就躲開了
輕功|速奇|2|dodge:.1 spd:5|飛簷走壁
先發制人|速勇|2|first:1 firstAtk:.1|先下手為強
連擊|速勇|2|combo:.15|一刀接一刀
再動|速|3|again:.14 spd:5|別人動一次，他動兩次
疾走|速|1|flee:1|打不過就跑
游擊|速遊|1|dodge:.05 steal:.05|打了就跑，跑了再打
影步|速奇|2|dodge:.12|像影子一樣難以捉摸
雷厲|速|1|spd:4 crit:.04|雷厲風行
統率|統|1|solMax:.06|帶得動更多兵
名將|統勇|2|solMax:.08 auraAtk:.04|一代名將
大將之才|統|3|solMax:.15 auraAtk:.06 auraDef:.04 lead:4|天生的統帥
練兵|統|1|train:.15|練出精兵
鼓舞|統魅|1|startRouse:1 auraAtk:.03|戰前鼓舞士氣
軍紀|統守|1|auraDef:.04 noConfuse:1|軍令如山
步戰|統勇|1|infPow:.1|擅長率領步兵
陣法|統謀|2|auraDef:.06 tacRes:.08|精通各種陣法
八陣|統奇|3|auraDef:.1 tacRes:.15|八陣圖，變化無窮
大軍|統|2|solMax:.12|指揮千軍萬馬
運籌|統謀|2|auraAtk:.05 tacDmg:.06|運籌帷幄之中
號令|統|1|auraAtk:.04|一聲令下，三軍用命
壓陣|統守|1|block:.06 auraDef:.03|坐鎮中軍
督軍|統|1|merit:.1 auraAtk:.03|督戰有方
攻城|統勇|1|siege:.15|擅長攻城
破城|統勇|2|siege:.25 breakdef:.1|沒有攻不破的城
道術|奇|1|tacDmg:.08 spRegen:2|學過一點道術
妖術|奇|2|stun:.12 tacDmg:.06|使人神智不清
仙緣|奇運|2|spRegen:4 exp:.1|曾遇仙人指點
呼風|奇|1|spd:3 tacHit:.06|呼風喚雨
遁甲|奇速|2|dodge:.1 flee:1|奇門遁甲
符水|奇仁|1|healPow:.15 spRegen:2|一碗符水治百病
天命|奇運|3|revive:.4 again:.08|天命在我
五雷|奇火|2|fire:.12 tacDmg:.1|五雷轟頂
觀星|奇謀|1|tacHit:.1|夜觀天象
幻術|奇謀|2|stun:.1 dodge:.05|眼前所見都是假的
太平要術|奇統|3|tacDmg:.2 spRegen:5 stun:.08|蒼天已死，黃天當立
不老|奇|1|regen:.03|看不出年紀
屯田|政|1|farm:.15|且耕且戰
商才|政運|1|comm:.15 gold:.12|天生的生意人
築城|政守|1|build:.15 wall:.05|會蓋城牆
治世|政|2|farm:.1 comm:.1 morale:.08|治世之能臣
清廉|政仁|1|loyal:.08 fame:.06|兩袖清風
法度|政統|1|morale:.06 train:.08|賞罰分明
理財|政|1|price:.1|精打細算
能吏|政|1|merit:.12 farm:.06|辦事俐落
王佐|政謀|3|farm:.15 comm:.15 merit:.2 pol:4|王佐之才
外交|政魅|2|diplo:.2|三寸不爛之舌
屯糧|政守|1|farm:.1 wall:.04|廣積糧
經略|政統|2|comm:.1 solMax:.05|經略一方
治水|政|1|farm:.12 morale:.04|治好了河，百姓就有飯吃
魅力|魅|1|recruit:.06 cha:2|人見人愛
名門|魅政|1|fame:.12 recruit:.04|四世三公之家
傾國|魅奇|3|stun:.12 recruit:.12 cha:4|一笑傾城，再笑傾國
義氣|魅勇|1|loyal:.1 bond:.2|為朋友兩肋插刀
人望|魅|2|recruit:.12 loyal:.08|人心所向
遊說|魅謀|1|recruit:.08 diplo:.1|能說會道
威名|魅勇|2|stun:.06 fame:.15|聽到名字敵人就害怕
招賢|魅統|2|recruit:.15|求賢若渴
桃園|魅仁|3|bond:.4 auraAtk:.06 loyal:.15|不求同年同月同日生
美髯|魅勇|1|fame:.1 duelHp:.08|一把漂亮的長鬚
結交|魅遊|1|bond:.25|到哪裡都交得到朋友
雄辯|魅謀|1|tacHit:.06 recruit:.05|舌戰群儒
霸氣|魅統|2|stun:.08 auraAtk:.04|天下英雄，唯使君與操耳
俠客|遊勇|1|fame:.1 crit:.04|路見不平，拔刀相助
探險|遊運|1|drop:.03 event:.1|最愛鑽洞穴
潛行|遊|1|encounter:.2|走路不出聲
獵戶|遊弓|1|beastDmg:.25 bowPow:.05|山裡打獵長大
山賊出身|遊勇|1|steal:.08 gold:.1|以前在山上落草
行商|遊政|1|price:.08 gold:.1|走南闖北做買賣
識途|遊|1|encounter:.1 exp:.05|老馬識途
野營|遊仁|1|mend:.06|在野外也睡得好
夜行|遊速|1|encounter:.15 dodge:.04|夜行千里
武俠|遊勇|2|duelDmg:.15 combo:.08|江湖上有名的劍客
浪人|遊|1|exp:.12|四海為家
綠林|遊統|2|steal:.1 recruit:.05|綠林好漢一呼百應
福星|運|1|drop:.03 gold:.1|有他在就有好事
天運|運|2|dodge:.06 revive:.2|老天爺都幫他
招財|運政|1|gold:.2|錢自己找上門
尋寶|運遊|2|drop:.05|寶物好像會自己出現
吉人天相|運|3|revive:.5 lowHeal:.3|大難不死，必有後福
好運|運|1|crit:.04 drop:.02|常常走運
鑑寶|運政|1|drop:.02 price:.05|一眼看出寶物真假
貴人|運魅|1|recruit:.05 bond:.1|命中有貴人相助
奇遇|運遊|2|event:.25|走到哪裡都有奇遇
否極泰來|運守|2|lowHeal:.4|最壞的時候就要轉運了
`.trim().split('\n').map((l, i) => { const [n, s, r, fx, d] = l.split('|'); return { id: i, n, s: [...s], r: +r, fx: Object.fromEntries(fx.split(' ').map((x) => { const [k, v] = x.split(':'); return [k, +v]; })), d }; });
export const TRAITS = TRAITS_RAW;
export const TRAIT = Object.fromEntries(TRAITS.map((t) => [t.n, t]));

// 共鳴: both traits of one general in the same school — both are half again as strong, and the school adds this
export const RESONANCE = {
  勇: ['武魂', { crit: 0.05 }], 騎: ['人馬一體', { cavPow: 0.1 }], 弓: ['神臂', { bowPow: 0.1 }], 水: ['蛟龍', { navyPow: 0.12 }], 守: ['金城', { physRes: 0.06 }],
  謀: ['智囊', { tacDmg: 0.1 }], 火: ['祝融', { fire: 0.15 }], 仁: ['仁心', { healPow: 0.2 }], 速: ['風馳', { spd: 6 }], 統: ['帥才', { solMax: 0.08 }],
  奇: ['通玄', { spRegen: 3 }], 政: ['良相', { farm: 0.12, comm: 0.12 }], 魅: ['眾望', { recruit: 0.08 }], 遊: ['江湖', { encounter: 0.15 }], 運: ['鴻運', { drop: 0.03 }],
};
// 相生: two schools that help each other (in one general, or the first two traits of two party members side by side)
export const SYNERGY = [
  ['勇', '速', '疾風斬', { combo: 0.08 }, '又快又狠：連擊 +8%'],
  ['勇', '守', '攻守兼備', { counter: 0.12 }, '能攻能守：反擊 +12%'],
  ['勇', '統', '萬人敵', { auraAtk: 0.04 }, '將勇兵強：全隊攻擊 +4%'],
  ['騎', '速', '奔雷', { first: 1 }, '騎兵加上速度：每回合先動'],
  ['騎', '弓', '騎射', { bowPow: 0.08, cavPow: 0.08 }, '馬上開弓：騎兵、弓兵攻擊 +8%'],
  ['弓', '謀', '伏弩', { firstAtk: 0.15 }, '埋伏好的弓弩：第一回合傷害 +15%'],
  ['水', '火', '火船', { fire: 0.15, navyPow: 0.08 }, '火船順風：火計 +15%、水軍 +8%'],
  ['謀', '火', '火神', { fire: 0.12, tacHit: 0.06 }, '算準風向再放火：火計 +12%、命中 +6%'],
  ['謀', '統', '儒將', { tacDmg: 0.06, auraDef: 0.04 }, '能謀能帥：策略 +6%、全隊受傷 -4%'],
  ['謀', '奇', '神機', { tacCost: 0.12, again: 0.04 }, '策略省力，偶爾再動'],
  ['守', '仁', '鐵衛', { auraDef: 0.05 }, '為同伴擋刀：全隊受傷 -5%'],
  ['仁', '魅', '民心所歸', { recruit: 0.08, fame: 0.1 }, '招募 +8%、名聲 +10%'],
  ['仁', '政', '循吏', { morale: 0.15, loyal: 0.08 }, '安民 +15%、部下忠誠 +8'],
  ['政', '運', '財神', { gold: 0.2, price: 0.06 }, '金錢 +20%、買東西便宜 6%'],
  ['遊', '運', '奇俠', { drop: 0.03, event: 0.15 }, '尋寶 +3%、奇遇 +15%'],
  ['奇', '仁', '仙醫', { healPow: 0.2, regen: 0.02 }, '回復 +20%、每回合再生 2%'],
  ['統', '魅', '霸主', { auraAtk: 0.04, stun: 0.04 }, '威加四海：全隊攻擊 +4%、震懾 +4%'],
  ['速', '奇', '神出鬼沒', { dodge: 0.06 }, '閃避 +6%'],
];
// 名組合: two particular traits — in one general (個人絕技) or in two members of the party (合擊). Much stronger.
export const COMBOS = [
  ['萬夫莫敵', '飛將', '人中呂布', { crit: 0.1, duelDmg: 0.2, again: 0.06 }, '天下無雙的猛將'],
  ['臥龍', '八陣', '八陣圖', { auraDef: 0.12, tacRes: 0.2 }, '石陣困住十萬大軍'],
  ['臥龍', '鳳雛', '臥龍鳳雛', { tacDmg: 0.15, again: 0.06 }, '兩人得一，可安天下（合擊）'],
  ['火計', '東風', '借東風', { fire: 0.3, first: 1 }, '風一起，火就燒過去'],
  ['火攻', '東風', '借東風', { fire: 0.3, first: 1 }, '風一起，火就燒過去'],
  ['赤壁', '水軍都督', '赤壁鏖兵', { fire: 0.2, navyPow: 0.2 }, '檣櫓灰飛煙滅'],
  ['赤壁', '鐵索連環', '連環計', { fire: 0.35, sweep: 0.2 }, '敵船連在一起，一燒全燒'],
  ['火燒連營', '伏兵', '火燒七百里', { fire: 0.25, sweep: 0.25 }, '夷陵之戰'],
  ['虎癡', '護主', '虎衛', { auraDef: 0.08, counter: 0.15 }, '有他在，主公就沒事'],
  ['定軍', '百步穿楊', '老當益壯', { bowPow: 0.2, crit: 0.08 }, '黃忠斬夏侯淵'],
  ['錦帆', '艨艟', '百騎劫營', { navyPow: 0.15, firstAtk: 0.2 }, '甘寧百騎劫魏營'],
  ['鐵騎', '衝陣', '鐵騎突陣', { cavPow: 0.15, breakdef: 0.15 }, '鐵蹄撕開敵陣'],
  ['白馬義從', '射鵰', '白馬將軍', { cavPow: 0.12, bowPow: 0.15 }, '公孫瓚的白馬騎射'],
  ['神醫', '養生', '起死回生', { revive: 0.3, regen: 0.03 }, '華佗再世'],
  ['鬼才', '奇謀', '奇策十出', { tacDmg: 0.15, stun: 0.08 }, '郭嘉的十勝十敗'],
  ['算無遺策', '識破', '洞若觀火', { tacRes: 0.25, tacHit: 0.1 }, '計謀對他沒用'],
  ['空城', '沉著', '空城計', { tacRes: 0.15, dodge: 0.08, wall: 0.2 }, '大開城門，從容撫琴'],
  ['背水', '不屈', '背水一戰', { lowAtk: 0.4, revive: 0.15 }, '韓信的背水陣'],
  ['狂戰', '血戰', '修羅', { steal: 0.12, combo: 0.1 }, '殺得越多越強'],
  ['先發制人', '先登', '疾雷', { firstAtk: 0.3 }, '開戰第一擊就分勝負'],
  ['再動', '連擊', '疾風怒濤', { combo: 0.1, again: 0.06 }, '攻勢如潮水'],
  ['不動如山', '鐵壁', '金城湯池', { physRes: 0.12, block: 0.1 }, '打不動的人'],
  ['長城', '金湯', '固若金湯', { wall: 0.4 }, '這座城誰也攻不下'],
  ['大將之才', '名將', '帥星', { auraAtk: 0.08, auraDef: 0.06 }, '將星閃耀'],
  ['八陣', '陣法', '奇門陣', { auraDef: 0.08, stun: 0.06 }, '陣中變化莫測'],
  ['太平要術', '妖術', '黃天當立', { stun: 0.12, tacDmg: 0.15 }, '張角的大賢良師之術'],
  ['五雷', '呼風', '呼風喚雷', { tacDmg: 0.15, tacHit: 0.1 }, '風雨雷電隨手而來'],
  ['遁甲', '輕功', '縮地成寸', { dodge: 0.12, again: 0.05 }, '一步就到眼前'],
  ['傾國', '離間', '美人計', { stun: 0.18 }, '王允的連環計（合擊更好）'],
  ['王佐', '治世', '王佐之才', { farm: 0.2, comm: 0.2, merit: 0.2 }, '荀彧之能'],
  ['屯田', '治水', '天府之國', { farm: 0.3 }, '沃野千里'],
  ['商才', '行商', '富甲一方', { gold: 0.4, price: 0.1 }, '錢多到花不完'],
  ['招賢', '人望', '天下歸心', { recruit: 0.25 }, '周公吐哺，天下歸心'],
  ['義氣', '結交', '四海之內皆兄弟', { bond: 0.5, loyal: 0.1 }, '朋友遍天下'],
  ['俠客', '武俠', '一代大俠', { duelDmg: 0.25, fame: 0.15 }, '江湖上人人敬仰'],
  ['獵戶', '冷箭', '百發百中', { beastDmg: 0.3, crit: 0.08 }, '野獸見了都怕'],
  ['福星', '吉人天相', '天命所歸', { revive: 0.2, drop: 0.04 }, '老天爺站在他這邊'],
  ['尋寶', '探險', '摸金', { drop: 0.06, event: 0.15 }, '哪裡有寶藏他都知道'],
  ['攻城', '破城', '攻無不克', { siege: 0.4 }, '天下沒有攻不下的城'],
  ['火牛陣', '突騎', '火牛衝陣', { fire: 0.15, firstAtk: 0.2 }, '田單的火牛陣'],
  ['美髯', '威名', '威震華夏', { stun: 0.1, fame: 0.2 }, '關羽水淹七軍'],
  ['西涼鐵騎', '狂戰', '錦馬超', { cavPow: 0.15, combo: 0.1 }, '殺得曹操割鬚棄袍'],
  ['攜民渡江', '仁德', '仁君', { recruit: 0.15, auraDef: 0.06, fame: 0.2 }, '劉備的仁義'],
  ['霸氣', '大軍', '霸王', { auraAtk: 0.1, solMax: 0.08 }, '挾天子以令諸侯'],
  ['桃園', '義氣', '桃園結義', { auraAtk: 0.08, bond: 0.3 }, '三人都有「桃園」更強（合擊）'],
];
// the famous: their own two traits (everyone else is given two by their abilities and a roll)
export const FAMOUS = {
  呂布: ['萬夫莫敵', '飛將'], 關羽: ['美髯', '威名'], 張飛: ['怒吼', '豪勇'], 趙雲: ['先發制人', '不屈'], 馬超: ['西涼鐵騎', '狂戰'], 黃忠: ['定軍', '百步穿楊'],
  許褚: ['虎癡', '護主'], 典韋: ['虎癡', '捨身'], 張遼: ['先登', '先發制人'], 甘寧: ['錦帆', '艨艟'], 太史慈: ['神射', '豪勇'], 魏延: ['陷陣', '狂戰'],
  諸葛亮: ['臥龍', '八陣'], 龐統: ['鳳雛', '鐵索連環'], 郭嘉: ['鬼才', '奇謀'], 賈詡: ['算無遺策', '識破'], 司馬懿: ['沉著', '算無遺策'], 周瑜: ['赤壁', '水軍都督'],
  陸遜: ['火燒連營', '伏兵'], 荀彧: ['王佐', '治世'], 荀攸: ['奇謀', '神算'], 魯肅: ['外交', '德望'], 呂蒙: ['博學', '奇謀'], 徐庶: ['神算', '俠客'],
  曹操: ['霸氣', '大軍'], 劉備: ['攜民渡江', '仁德'], 孫權: ['招賢', '人望'], 孫策: ['勇冠三軍', '江東子弟'], 孫堅: ['猛將', '江東子弟'], 袁紹: ['名門', '大軍'],
  董卓: ['西涼鐵騎', '霸氣'], 公孫瓚: ['白馬義從', '射鵰'], 張角: ['太平要術', '妖術'], 華佗: ['神醫', '養生'], 左慈: ['遁甲', '幻術'], 于吉: ['符水', '仙緣'],
  貂蟬: ['傾國', '離間'], 姜維: ['兵法', '不屈'], 鄧艾: ['屯田', '奇謀'], 鍾會: ['神算', '遠謀'], 曹仁: ['堅守', '鐵壁'], 夏侯惇: ['鐵骨', '不屈'],
  夏侯淵: ['奔襲', '疾風'], 徐晃: ['軍紀', '破城'], 張郃: ['陣法', '先發制人'], 高順: ['陷陣', '軍紀'], 龐德: ['不屈', '豪勇'], 黃蓋: ['火計', '捨身'],
  程普: ['樓船', '水戰'], 周泰: ['捨身', '不屈'], 陸抗: ['長城', '金湯'], 郝昭: ['長城', '苦守'], 滿寵: ['堅守', '金湯'], 文聘: ['堅守', '水戰'],
  孟獲: ['不屈', '綠林'], 祝融: ['火攻', '飛將'], 孫尚香: ['弓術', '武俠'], 曹丕: ['名門', '雄辯'], 曹植: ['博學', '名門'], 法正: ['奇謀', '伏兵'],
  馬良: ['外交', '博學'], 王平: ['陣地', '軍紀'], 嚴顏: ['不屈', '強弓'], 田豐: ['算無遺策', '清廉'], 沮授: ['遠謀', '清廉'], 陳宮: ['奇謀', '不屈'],
  諸葛瑾: ['外交', '寬厚'], 管輅: ['觀星', '天命'], 劉表: ['名門', '治世'], 張魯: ['道術', '仁德'], 王允: ['離間', '名門'], 張任: ['伏兵', '冷箭'],
  Jeff: ['大將之才', '臥龍'], Erin: ['傾國', '神醫'], Josh: ['萬夫莫敵', '飛將'], Jasper: ['再動', '遁甲'],
};
// what an effect says
export function fxText(POWERS, k, v) { if (EXTRA[k]) return EXTRA[k](v); const P = POWERS[k]; if (!P) return `${k} ${v}`; return v < 0 ? `${P[0]} ${Math.round(v * 100)}%` : P[2](v); }
