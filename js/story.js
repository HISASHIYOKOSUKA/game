// ストーリー：話し手、NPC、イベントの台本（序章）
'use strict';

const SPEAKERS = {
  leon:    { name: 'レオン', face: 'leon_face' },
  selena:  { name: 'セレナ', face: 'selena_face' },
  garo:    { name: 'ガロ',   face: 'garo_face' },
  noa:     { name: 'ノア',   face: 'noa_face' },
  harold:  { name: 'ハロルド', face: 'harold_face' },
  thug:    { name: 'ゴルドー商会の男', face: 'thug_face' },
  cultist: { name: '黒いフードの男', face: 'cultist_face' },
  god:     { name: '？？？', face: 'lucifer_face' },
  ren:     { name: '蓮' },
  mom:     { name: 'レオンの母さん', face: 'mom_face' },
  baba:    { name: '占いばば', face: 'baba_face' },
  innkeeper: { name: '宿屋の主人', face: 'innkeeper_face' },
  info:    { name: '' },
};

// 共鳴技（レオン＋仲間）。mp は [レオン, 仲間]
const RESONANCE = {
  selena: { name: 'ルミナスエッジ', mp: [6, 8], target: 'enemy', stat: 'mag', power: 1.6, kind: 'phys', heal: true,
            desc: '光の刃で敵1体に大ダメージ＋味方全員をかいふく' },
  garo:   { name: 'アースブレイカー', mp: [8, 10], target: 'enemies', stat: 'atk', power: 1.0, kind: 'phys',
            desc: '大地を割って敵全体に大ダメージ' },
  noa:    { name: '蒼嵐テンペスト', mp: [8, 16], target: 'enemies', stat: 'mag', power: 1.2, kind: 'mag',
            desc: '風と雷の嵐で敵全体に魔法の大ダメージ' },
};

// フィールドに立つ人物・魔物。when の条件を満たす間だけ表示される
const NPCS = [
  // 序章：西の森のウルフ
  { id: 'wolf1', monster: 'wolf', x: 10, y: 24, when: { flag: 'appraised', not: 'forestDone' } },
  { id: 'wolf2', monster: 'wolf', x: 9, y: 25, when: { flag: 'appraised', not: 'forestDone' } },
  // 第一章：屋敷に来たゴルドー商会の男たち
  { id: 'thug1', sprite: 'thug', x: 54, y: 20, dir: 'up', when: { flag: 'ch1', not: 'thugsLeft' } },
  { id: 'thug2', sprite: 'thug', x: 56, y: 20, dir: 'up', when: { flag: 'ch1', not: 'thugsLeft' } },
  // 第一章：洞くつの前の取引
  { id: 'thug3', sprite: 'thug', x: 29, y: 38, dir: 'left', when: { flag: 'heardCave', not: 'ch1Boss' } },
  { id: 'cult1', sprite: 'cultist', x: 28, y: 38, dir: 'right', when: { flag: 'heardCave', not: 'ch1Boss' } },
];

// 足を踏み入れると始まるイベント
const TRIGGERS = [
  { x0: 12, y0: 23, x1: 14, y1: 26, when: { flag: 'appraised', not: 'forestDone' }, event: 'forest' },
  { x0: 30, y0: 37, x1: 33, y1: 39, when: { flag: 'heardCave', not: 'ch1Boss' }, event: 'cave' },
];

// 建物などにぶつかると始まるイベント（上から順に条件を見る。合うものがなければ通常の動作）
const DOOR_EVENTS = {
  manor: [
    { when: { flag: 'ch1Boss', not: 'ch1Done' }, event: 'manorEnd' },
    { when: { flag: 'ch1' }, event: 'manorTalk' },
    { event: 'manorLocked' },
  ],
};

// 人に話しかけると始まるイベント（合うものがなければ、店や宿屋の通常の動作／ふつうの会話）
const TALK_EVENTS = {
  mom: [
    { when: { flag: 'ch1' }, event: 'momCh1' },
    { when: { not: 'appraised' }, event: 'momBefore' },
    { event: 'momAfter' },
  ],
  baba: [
    { when: { flag: 'ch1' }, event: 'babaCh1' },
    { when: { not: 'appraised' }, event: 'baba' },
    { event: 'babaAfter' },
  ],
  innkeeper: [
    { when: { flag: 'ch1', not: 'heardCave' }, event: 'innRumor' },
  ],
};

// 町を歩く人たち。lines は話しかけるたびに順番に返す。chLines は章ごとのセリフ
const TOWN_NPCS = [
  { id: 'v1', sprite: 'villager', x: 30, y: 19, roam: 3, lines: ['ルミナの 噴水の 水は、のむと\n3びょう だけ かしこく なるらしい。', '……2びょうだったかな。'] },
  { id: 'v2', sprite: 'girl', x: 35, y: 23, roam: 3, lines: ['西の森には ウルフ、南の岩山には ゴーレム……\n冒険者って たいへんね。'],
    chLines: { ch1: ['セレナさま！ お屋敷、だいじょうぶ？\nゴルドー商会の 人たち、こわい顔してたわ。'] } },
  { id: 'v3', sprite: 'oldman', x: 27, y: 25, roam: 2, lines: ['わしが わかいころは、黒い 太陽なんて\n迷信じゃと 思っとった。', 'ふぉっふぉっ。 いまは どうかのう。'] },
  { id: 'v4', sprite: 'kid', x: 33, y: 28, roam: 4, scale: 0.8, lines: ['ねえねえ、ダッシュボタンって しってる？\nおすと はやく はしれるんだよ！'] },
  { id: 'v5', sprite: 'merchant', x: 38, y: 24, roam: 3, lines: ['町の外の 魔物は 目に 見えるんだ。\nぶつかると バトルに なるぞ。', 'にげても すこしの あいだは\nおってこない。 そのすきに はなれな。'] },
  { id: 'v6', sprite: 'guard', x: 34, y: 15, roam: 1, lines: ['ルミナ城の 門は いま とじている。\n王さまの ごめいれいでね。', '……おれも 理由は しらないんだ。'] },
  { id: 'v7', sprite: 'lady', x: 26, y: 22, roam: 2, lines: ['宿屋の シチューは ルミナいち。\nとまったら ぜひ たべてね。'] },
  { id: 'v8', sprite: 'traveler', x: 42, y: 25, roam: 2, lines: ['東の 商業都市ベルガ？\nゴルドーって 金持ちが 牛耳ってるって うわさだ。'],
    chLines: { ch1: ['ゴルドーの やつ、こんどは 貴族の 屋敷まで\nねらってるらしい。 ひどい 話さ。'] } },
];

// 章ごとの出だし（パーティ・お金・持ち物・開始位置）
const CHAPTERS = {
  ch1: { name: '第一章 セレナ', party: [['selena', 3], ['harold', 5]], gold: 150,
         items: { potion: 4, ether: 1, phoenix: 1 }, start: { x: 55, y: 18, dir: 'down' } },
};

const EVENTS = {
  opening: [
    { t: 'narr', text: '相馬 蓮、32さい。\nしごとは システムかいはつ。' },
    { t: 'narr', text: '終電で かえり、始発で でかける。\nじぶんの てがらは 上司のもの。\nミスは いつも じぶんのもの。' },
    { t: 'narr', text: 'その冬の夜――\n駅のホームで、蓮の せかいは しずかに とぎれた。' },
    { t: 'narr', speaker: 'ren', text: '（……いちどくらい、\nだれかと 本気で ちからを あわせて みたかったな）' },
    { t: 'sfx', name: 'magic' },
    { t: 'narr', img: 'lucifer_art', speaker: 'god', text: '……めざめなさい、くたびれた たましいよ。' },
    { t: 'narr', img: 'lucifer_art', speaker: 'ren', text: 'ここは……？ あなたは……かみさま？' },
    { t: 'narr', img: 'lucifer_art', speaker: 'god', text: 'わたしは この世界の 均衡を みまもる者。\nきみに あたらしい 生を あげよう。' },
    { t: 'narr', img: 'lucifer_art', speaker: 'god', text: 'さずける ちからは【共鳴】。\nふれた あいてと、こころが すこし かよう ちからだ。' },
    { t: 'narr', img: 'lucifer_art', speaker: 'ren', text: 'こころが かよう……それだけ？\nもっとこう、チートとか……' },
    { t: 'narr', img: 'lucifer_art', speaker: 'god', text: 'ふふ。それで じゅうぶんさ。\n――見せておくれ。\n人が、守るに 値するかどうかを。' },
    { t: 'flash' },
    { t: 'chapter', no: '序章', title: 'ハズレスキルの剣士', sub: 'レオンの章' },
    { t: 'warp', area: 'house1', x: 6, y: 3, dir: 'down' },
    { t: 'fadeIn' },
    { t: 'say', who: 'leon', text: '（……ここは ルミナの町。\nおれは レオン、17さい。\nそして まえは 相馬 蓮だった）' },
    { t: 'say', who: 'leon', text: '（ほんとうに 生まれかわったんだ。\n三日も 熱を だして、いま ぜんぶ おもいだした）' },
    { t: 'say', who: 'mom', text: 'レオーン！ 熱が さがったなら、\n占いの館で スキルを 見てもらってきなさい！\n17さいの 成人の儀でしょ！' },
    { t: 'say', who: 'leon', text: '（スキルか……【共鳴】って、どんな ちからなんだろう）' },
    { t: 'objective', text: '町の東にある 占いの館で スキルを 見てもらう' },
    { t: 'save' },
  ],

  momBefore: [
    { t: 'say', who: 'mom', text: 'まだ いってないの？ 占いの館は 町の 東がわ、\nみどりの 屋根の いえよ。\n（家を でたら 右へ すすんでね）' },
  ],
  momAfter: [
    { t: 'say', who: 'mom', text: 'ランク F？ いいじゃないの。\n母さんなんて【にんじんを きれいに むける】よ。\nさ、むりは しないでね。' },
  ],
  momCh1: [
    { t: 'say', who: 'mom', text: 'あら、アルディス家の おじょうさま！\nうちの レオン？ 「つよく なるんだ」って\n森へ いったきり、もどらないのよ。' },
    { t: 'say', who: 'selena', text: '（レオン……どんな かたなのかしら）' },
  ],

  baba: [
    { t: 'say', who: 'baba', text: 'ひぇっひぇっ。レオン坊や、17さいの 鑑定だね。\nどれどれ、水晶よ 水晶……' },
    { t: 'sfx', name: 'magic' },
    { t: 'flash' },
    { t: 'say', who: 'baba', text: 'でたよ。スキル【共鳴】……ランク F！\n「ふれた あいてと 気持ちが すこし かよう」\n……だってさ。' },
    { t: 'say', who: 'leon', text: 'ランク F……。' },
    { t: 'say', who: 'baba', text: 'まあ、げんきを おだし。\n八百屋の トムなんて【キャベツの気持ちがわかる】だよ。\nアンタは 人間の 気持ちだ。 だいぶ マシさね。' },
    { t: 'say', who: 'leon', text: '（なぐさめに なってない……）' },
    { t: 'say', who: 'baba', text: 'そうそう、さいきん 西の 森で\nウルフの むれが あばれてるそうだ。\n腕だめしに どうだい？ むちゃは するんじゃないよ。' },
    { t: 'flag', name: 'appraised' },
    { t: 'objective', text: '町の西の ルミナの森で ウルフの むれを たいじする' },
  ],
  babaAfter: [
    { t: 'say', who: 'baba', text: 'ひぇっひぇっ。【共鳴】ねえ……\nふるい 本に 同じ名前の ちからが のっていた 気がするよ。\nさて、なんだったかねえ。' },
  ],
  babaCh1: [
    { t: 'say', who: 'baba', text: 'おや、アルディス家の おじょうちゃん。\n水晶に でてるよ。「あなたは いずれ\nハズレくじを ひいた 男と 出会う」……ひぇっひぇっ。' },
  ],

  forest: [
    { t: 'say', who: 'leon', text: 'いた……ウルフの むれだ！' },
    { t: 'say', who: 'leon', text: '（【共鳴】……ためしに つかってみるか？）' },
    { t: 'sfx', name: 'magic' },
    { t: 'flash' },
    { t: 'say', who: 'info', text: '……しかし なにも おこらなかった。' },
    { t: 'say', who: 'leon', text: '（だれかと つながる ちから……\nひとりじゃ 意味が ない、ってことか）\n……なら、剣で やるしかない！' },
    { t: 'battle', enemies: ['wolf', 'wolf'], boss: true },
    { t: 'flag', name: 'forestDone' },
    { t: 'say', who: 'leon', text: 'はぁ、はぁ……。\n強く ならなきゃ。\nいつか だれかと、この ちからを つかえる 日まで。' },
    { t: 'fadeOut' },
    { t: 'narr', img: 'eclipse_omen', text: 'その夜――\nルミナの 空に、ほんの いっしゅん、\n黒い 太陽が うかんだ。' },
    { t: 'narr', img: 'eclipse_omen', speaker: 'god', text: '……はじまったね、観測者。\nさあ、見せておくれ。' },
    { t: 'narr', text: '同じ夜。\n世界の あちこちで、\n黒い 太陽を 見上げる 者たちが いた。' },
    { t: 'narr', text: 'これは、レオンが まだ 知らない\n仲間たちの 物語――' },
    { t: 'flag', name: 'prologueDone' },
    { t: 'chapter', no: '序章', title: '完' },
    { t: 'goto', event: 'ch1Start' },
  ],

  // ===== 第一章 セレナの章 =====
  ch1Start: [
    { t: 'chapter', no: '第一章', title: '没落令嬢の誓い', sub: 'セレナの章' },
    { t: 'chapterStart', id: 'ch1' },
    { t: 'flag', name: 'ch1' },
    { t: 'fadeIn' },
    { t: 'say', who: 'selena', text: 'この屋敷は わたしません！\n父が のこした たいせつな 家です！' },
    { t: 'say', who: 'thug', text: '借金の かたに、この屋敷は\nゴルドーさまの ものに なったんだ。\nほら、証文だって ある。' },
    { t: 'say', who: 'selena', text: 'お父さまが そんな 借金を するはず ありません！\nそれに その署名……お父さまの 字じゃないわ。' },
    { t: 'say', who: 'thug', text: '文句が あるなら 証拠を もってきな。\n三日後に 屋敷を あけわたして もらうぜ。\nへっへっへ。' },
    { t: 'flag', name: 'thugsLeft' },
    { t: 'say', who: 'harold', text: 'お嬢さま……。' },
    { t: 'say', who: 'selena', text: 'ハロルド。わたし、決めました。\n証文が にせものだという 証拠を さがします。' },
    { t: 'say', who: 'harold', text: 'では、この老骨も お供いたしましょう。\nアルディス家に 仕えて 四十年。\n剣の腕は まだ さびておりませぬぞ。' },
    { t: 'say', who: 'info', text: 'ハロルドが いっしょに 戦ってくれる！\n（この章だけの なかまです）' },
    { t: 'say', who: 'harold', text: 'まずは ルミナの町で うわさを あつめましょう。\n宿屋の 主人は 町いちばんの 情報通ですぞ。' },
    { t: 'objective', text: 'ルミナの町の 宿屋で うわさを きく' },
    { t: 'save' },
  ],
  innRumor: [
    { t: 'say', who: 'innkeeper', text: 'おや、アルディス家の おじょうさま。\nゴルドー商会の 連中かい？\nあいつら、夜な夜な 南の 岩山の 洞くつへ\n荷車を はこんでるよ。' },
    { t: 'say', who: 'innkeeper', text: 'なかで なにを してるのやら。\n…気をつけなよ。 あのへんは さいきん\n魔物も ふえてる。' },
    { t: 'say', who: 'selena', text: '南の 洞くつ……。 ありがとうございます！' },
    { t: 'say', who: 'harold', text: '町の 南の 出口を ぬけ、岩山の あいだの 道を\nすすんだ さきですな。 道具屋で ポーションを\nかっておくと よいでしょう。' },
    { t: 'flag', name: 'heardCave' },
    { t: 'objective', text: '町の南の 岩山にある 洞くつを しらべる' },
  ],
  cave: [
    { t: 'say', who: 'thug', text: 'ほらよ、ゴルドーさまからの 品だ。\nにせの 証文の 帳簿も いっしょに あずかってくれ。' },
    { t: 'say', who: 'cultist', text: 'くっくっ……人の 欲が つまった 黒い 結晶。\nわが主も およろこびに なろう。' },
    { t: 'say', who: 'selena', text: 'そこまでです！\nその帳簿、わたしたちが いただきます！' },
    { t: 'say', who: 'thug', text: 'げえっ、アルディスの 小娘！' },
    { t: 'say', who: 'cultist', text: '見られたか。……ちょうど いい。\nこの 結晶の ちから、ためさせて もらおう。\nめざめよ、岩の 巨人！' },
    { t: 'sfx', name: 'thunder' },
    { t: 'flash' },
    { t: 'say', who: 'harold', text: 'お嬢さま、おさがりください！\nこやつは 手ごわい！' },
    { t: 'battle', enemies: ['golem'], boss: true, hpMul: 2.4 },
    { t: 'flag', name: 'ch1Boss' },
    { t: 'say', who: 'info', text: '黒いフードの男は いつのまにか すがたを けし、\nゴルドー商会の 男は にげさった。\nあとには 帳簿と 黒い 石が のこされていた。' },
    { t: 'say', who: 'selena', text: 'この 帳簿……お父さまの 署名を\nなんども まねた あとが ある！\n証文は やっぱり にせものだったのね！' },
    { t: 'say', who: 'harold', text: 'お嬢さま、この 黒い石……\nいやな 気配が いたします。\nまるで 人の 欲を かためたような……。' },
    { t: 'objective', text: '帳簿を もって 東の アルディス家の 屋敷へ もどる' },
    { t: 'save' },
  ],
  manorTalk: [
    { t: 'say', who: 'harold', text: '屋敷の なかは 差し押さえで からっぽですな。\nいまは 証拠を さがすのが さきですぞ。' },
  ],
  manorLocked: [
    { t: 'say', who: 'info', text: 'りっぱな 屋敷だ。\nとびらには カギが かかっている。' },
  ],
  manorEnd: [
    { t: 'fadeOut' },
    { t: 'narr', text: 'セレナは 帳簿を ルミナの 役場に とどけた。\nにせの 証文は とりけされ、\n屋敷は アルディス家に もどった――' },
    { t: 'fadeIn' },
    { t: 'say', who: 'harold', text: 'ですが お嬢さま、ゴルドーは すでに 町を にげだし、\n東の 商業都市ベルガへ むかったとか。\n大斧を かついだ 大男の 用心棒を つれて……。' },
    { t: 'say', who: 'selena', text: '……追いかけます。\nあの 黒い石の ことも、きっと ゴルドーが 知っている。' },
    { t: 'say', who: 'harold', text: '……お嬢さま。この老骨、さきほどの 戦いで\n腰を いためまして。\n……ここで 屋敷を お守りいたします。' },
    { t: 'say', who: 'selena', text: 'ハロルド……。 いままで ありがとう。\nかならず、もどってきます。' },
    { t: 'leave', id: 'harold' },
    { t: 'say', who: 'info', text: 'ハロルドが パーティから はなれた。' },
    { t: 'fadeOut' },
    { t: 'narr', img: 'eclipse_omen', text: 'その夜。\n東へ むかう 道の とちゅうで、\nセレナは 空に うかぶ 黒い 太陽を 見た。' },
    { t: 'narr', img: 'eclipse_omen', speaker: 'god', text: '……ひとりめ。' },
    { t: 'flag', name: 'ch1Done' },
    { t: 'chapter', no: '第一章', title: '完', sub: '第二章「ガロの章」へ つづく（じゅんびちゅう）' },
    { t: 'warp', x: 55, y: 18, dir: 'down' },
    { t: 'healAll' },
    { t: 'fadeIn' },
    { t: 'objective', text: '第二章は じゅんびちゅう。セレナで 自由に 冒険できます' },
    { t: 'save' },
    { t: 'say', who: 'info', text: '（第一章クリア！ ここまでの きろくを セーブしました）' },
  ],
};
