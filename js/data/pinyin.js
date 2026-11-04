// Pinyin (without tones) for every character in a general's or city's name, for the English interface.
// 'lv' is written ü. Names that don't follow the usual reading are spelled out in SPECIAL.
const RAW = `董dong卓zhuo呂lv布bu李li傕jue郭guo汜si張zhang濟ji樊fan稠chou華hua雄xiong徐xu榮rong儒ru牛niu輔fu胡hu軫zhen旻min繡xiu賈jia詡xu
段duan煨wei高gao順shun遼liao魏wei續xu宋song憲xian侯hou成cheng廉lian曹cao性xing郝hao萌meng王wang允yun蔡cai邕yong皇huang甫fu嵩song朱zhu
儁jun楊yang彪biao肅su車che兒er晃huang奉feng韓han暹xian承cheng樂yue才cai蒙meng操cao夏xia惇dun淵yuan仁ren洪hong進jin典dian純chun韋wei
陽yang史shi渙huan任ren峻jun許xu褚chu荀xun彧yu攸you程cheng昱yu嘉jia滿man寵chong于yu禁jin毛mao玠jie虔qian劉liu曄ye休xiu真zhen丕pi植zhi
彰zhang昂ang叡rui爽shuang沖chong芳fang髦mao奐huan尚shang霸ba玄xuan楙mao威wei和he秦qin朗lang何he晏yan宇yu司si馬ma懿yi師shi昭zhao炎yan
孚fu望wang伷zhou鄧deng艾ai忠zhong鍾zhong繇yao毓yu會hui陳chen群qun泰tai歆xin逵kui杜du畿ji修xiu蔣jiang淮huai雙shuang孫sun禮li昶chang
基ji諸zhu葛ge誕dan毌guan丘qiu儉jian文wen欽qin鴦yang虎hu衛wei瓘guan羊yang祜hu預yu濬jun充chong奮fen遵zun烈lie渾hun石shi苞bao通tong
燕yan金jin既ji馥fu浩hao婁lou圭gui幹gan凌ling綝chen費fei曜yao戴dai陵ling桓huan範fan經jing緒xu纂zuan田tian唐tang咨zi州zhou勗xu彬bin
裴pei秀xiu傅fu嘏gu柔rou矯jiao襲xi趙zhao儼yan靈ling儀yi龐pang牽qian弘hong戎rong周zhou處chu袁yuan紹shao顏yan良liang醜chou豐feng沮ju
授shou審shen配pei逢feng紀ji圖tu覽lan淳chun瓊qiong譚tan熙xi辛xin評ping毗pi崔cui琰yan麴qu義yi猛meng諶chen琳lin招zhao臧zang渠qu眭sui
元yuan曠kuang翔xiang焦jiao觸chu南nan郃he耿geng武wu潘pan鳳feng術shu勳xun橋qiao蕤rui閻yan象xiang蘭lan雷lei薄bo胤yin耀yao就jiu遺yi
公gong瓚zan雲yun嚴yan綱gang楷kai越yue關guan靖jing豫yu虞yu鮮xian疇chou盧lu度du康kang恭gong備bei羽yu飛fei簡jian雍yong乾qian到dao亮liang
瞻zhan喬qiao統tong庶shu謖su延yan法fa正zheng封feng平ping興xing禪shan琬wan斌bin禕yi姜jiang維wei翼yi廖liao化hua芝zhi嶷yi霍huo弋yi僉qian
譙qiao巴ba向xiang宗zong羅luo黃huang皓hao崇chong廣guang宓mi震zhen裔yi式shi句gou扶fu沙sha摩mo柯ke堅jian策ce權quan翊yi賁ben吳wu景jing
瑜yu韶shao登deng普pu蓋gai當dang綜zong祖zu茂mao治zhi然ran績ji魯lu甘gan寧ning太tai慈ci盛sheng丁ding璋zhang異yi陸lu遜xun抗kang凱kai
紘hong顧gu瑾jin恪ke步bu騭zhi闞kan澤ze據ju賀he齊qi全quan琮cong岱dai留liu贊zan吾wu彥yan薛xue溫wen沈shen瑩ying悌ti離li牧mu魴fang
是shi謙qian謝xie旌jing表biao瑁mao蒯kuai聘pin琦qi磐pan伊yi籍ji蘇su粲can德de徽hui韜tao孟meng建jian焉yan班ban松song達da恢hui冷leng
懷huai沛pei韙wei累lei銅tong羲xi連lian觀guan圃pu騰teng遂sui超chao鐵tie行xing選xuan秋qiu堪kan梁liang阜fu敘xu尹yin賞shang陶tao糜mi
竺zhu豹bao敦dun珪gui笮ze融rong闓kai昌chang豨xi孔kong安an國guo管guan亥hai邴bing原yuan鮑bao信xin邈miao宮gong能neng英ying白bai輿yu
昕xin翻fan固gu旋xuan鞏gong志zhi賢xian邢xing道dao應ying隆long獲huo祝zhu優you節jie帶dai來lai洞dong主zhu兀wu突tu骨gu木mu鹿lu大da
朵duo思si環huan三san結jie荼tu那na阿a喃nan忙mang牙ya長chang定ding褒bao士shi燮xie壹yi辟pi龔gong都du倉cang佗tuo吉ji劭shao軻ke比bi
蹋ta頓dun徹che里li俄e燒shao戈ge襄xiang北bei薊ji皮pi海hai鄴ye晉jin濮pu小xiao下xia邳pi汝ru壽shou春chun廬lu江jiang業ye稽ji洛luo農nong
天tian水shui宛wan新xin野ye上shang庸yong漢han中zhong梓zi潼tong永yong柴chai桑sang零ling桂gui交jiao趾zhi`;
export const PY = {};
for (const [, ch, py] of RAW.matchAll(/([^\x00-\x7f])([a-z]+)/g)) PY[ch] = py.replace('lv', 'lü');
// two-character surnames
export const COMPOUND = ['夏侯', '司馬', '諸葛', '公孫', '皇甫', '淳于', '毌丘', '鮮于', '太史'];
// names spelled as a whole
export const SPECIAL = {
  '長安': "Chang'an", '長沙': 'Changsha', '帶來洞主': 'Dailai Dongzhu', '兀突骨': 'Wutugu', '木鹿大王': 'King Mulu', '朵思大王': 'King Duosi',
  '金環三結': 'Jinhuan Sanjie', '阿會喃': 'Ahuinan', '忙牙長': 'Mangyachang', '軻比能': 'Kebineng', '蹋頓': 'Tadun', '徹里吉': 'Chelji',
  '俄何燒戈': 'Ehe Shaoge', '越吉': 'Yueji', '祝融': 'Lady Zhurong', '沙摩柯': 'Shamoke', '胡車兒': "Hu Che'er", '劉豹': 'Liu Bao',
  '西安': "Xi'an",
};
