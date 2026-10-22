// ストーリー：話し手、NPC、イベントの台本（序章）
'use strict';

const SPEAKERS = {
  leon:   { name: 'レオン', face: 'leon_face' },
  selena: { name: 'セレナ', face: 'selena_face' },
  garo:   { name: 'ガロ',   face: 'garo_face' },
  noa:    { name: 'ノア',   face: 'noa_face' },
  god:    { name: '？？？', face: 'lucifer_face' },
  ren:    { name: '蓮' },
  mom:    { name: '母さん' },
  baba:   { name: '占いばば' },
  guard:  { name: '門番' },
  info:   { name: '' },
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
  { id: 'selena', sprite: 'selena', x: 11, y: 24, dir: 'left', when: { flag: 'rumor', not: 'forestDone' } },
  { id: 'wolf',   monster: 'wolf',   x: 9, y: 24, when: { flag: 'rumor', not: 'forestDone' } },
  { id: 'gob1',   monster: 'goblin', x: 9, y: 25, when: { flag: 'rumor', not: 'forestDone' } },
  { id: 'gob2',   monster: 'goblin', x: 10, y: 25, when: { flag: 'rumor', not: 'forestDone' } },
];

// 足を踏み入れると始まるイベント
const TRIGGERS = [
  { x0: 12, y0: 23, x1: 15, y1: 26, when: { flag: 'rumor', not: 'forestDone' }, event: 'forest' },
];

// 建物のとびらで始まるイベント（上から順に条件を見る）
const DOOR_EVENTS = {
  house1: [
    { when: { not: 'appraised' }, event: 'momBefore' },
    { when: { not: 'forestDone' }, event: 'momRumor' },
    { event: 'momAfter' },
  ],
  house2: [
    { when: { not: 'appraised' }, event: 'baba' },
    { event: 'babaAfter' },
  ],
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
    { t: 'chapter', no: '序章', title: 'ハズレスキルの剣士' },
    { t: 'warp', x: 24, y: 15, dir: 'down' },
    { t: 'fadeIn' },
    { t: 'say', who: 'leon', text: '（……ここは ルミナの町。\nおれは レオン、17さい。\nそして まえは 相馬 蓮だった）' },
    { t: 'say', who: 'leon', text: '（ほんとうに 生まれかわったんだ。\n三日も 熱を だして、いま ぜんぶ おもいだした）' },
    { t: 'say', who: 'mom', text: 'レオーン！ 熱が さがったなら、\n占いの館で スキルを 見てもらってきなさい！\n17さいの 成人の儀でしょ！' },
    { t: 'say', who: 'leon', text: '（スキルか……【共鳴】って、どんな ちからなんだろう）' },
    { t: 'objective', text: '町の東にある 占いの館で スキルを 見てもらう' },
    { t: 'save' },
  ],

  momBefore: [
    { t: 'say', who: 'mom', text: 'まだ いってないの？ 占いの館は 町の 東がわ、\nみどりの 屋根の いえよ。' },
  ],
  momRumor: [
    { t: 'say', who: 'mom', text: 'アルディス家の おじょうさんが 森へ？\nあそこは さいきん ウルフが でるのに……\nレオン、気をつけて いくのよ！' },
  ],
  momAfter: [
    { t: 'say', who: 'mom', text: 'あら、かわいい おともだちね。\nレオンを よろしくね、セレナちゃん。' },
    { t: 'say', who: 'selena', text: 'は、はい！ こちらこそ！' },
  ],

  baba: [
    { t: 'say', who: 'baba', text: 'ひぇっひぇっ。レオン坊や、17さいの 鑑定だね。\nどれどれ、水晶よ 水晶……' },
    { t: 'sfx', name: 'magic' },
    { t: 'flash' },
    { t: 'say', who: 'baba', text: 'でたよ。スキル【共鳴】……ランク F！\n「ふれた あいてと 気持ちが すこし かよう」\n……だってさ。' },
    { t: 'say', who: 'leon', text: 'ランク F……。' },
    { t: 'say', who: 'baba', text: 'まあ、げんきを おだし。\n八百屋の トムなんて【キャベツの気持ちがわかる】だよ。\nアンタは 人間の 気持ちだ。 だいぶ マシさね。' },
    { t: 'say', who: 'leon', text: '（なぐさめに なってない……）' },
    { t: 'flag', name: 'appraised' },
    { t: 'sfx', name: 'hurt' },
    { t: 'say', who: 'guard', text: 'たいへんだ！ たいへんだー！\nアルディス家の おじょうさんが、\nひとりで 西の 森へ 魔物たいじに いっちまった！' },
    { t: 'say', who: 'guard', text: '森には ウルフが 出るってのに……\nだれか 腕の たつ やつは いないのか！' },
    { t: 'say', who: 'leon', text: '……おれが いく！' },
    { t: 'say', who: 'baba', text: 'ひぇっ、ランク F が？\n……まあ、いっといで。\nアンタの 目は、いい 目だよ。' },
    { t: 'flag', name: 'rumor' },
    { t: 'objective', text: '町の西の 出口から ルミナの森へ いそぐ' },
  ],
  babaAfter: [
    { t: 'say', who: 'baba', text: 'ひぇっひぇっ。【共鳴】ねえ……\nふるい 本に 同じ名前の ちからが のっていた 気がするよ。\nさて、なんだったかねえ。' },
  ],

  forest: [
    { t: 'say', who: 'selena', text: 'こ、こないで！\nわたしだって、アルディス家の むすめです……！' },
    { t: 'say', who: 'leon', text: 'いた！ あの子か！' },
    { t: 'sfx', name: 'magic' },
    { t: 'flash' },
    { t: 'say', who: 'selena', text: 'だめ……ちからが あふれて とまらない……！\nいやしの 光が、暴れて……！' },
    { t: 'say', who: 'leon', text: 'あぶない！ ――その手、つかんで！' },
    { t: 'sfx', name: 'heal' },
    { t: 'flash' },
    { t: 'narr', text: 'レオンが セレナの 手を とった しゅんかん――\nふたりの こころが、しずかに かさなった。' },
    { t: 'say', who: 'selena', text: 'あれ……？ 光が、おちついていく……。\nあなたの こころ……あったかい。' },
    { t: 'say', who: 'leon', text: '（これが【共鳴】……？\nこの子の ちからが、手のひらから つたわってくる！）' },
    { t: 'join', id: 'selena' },
    { t: 'resonance', id: 'selena' },
    { t: 'say', who: 'info', text: 'セレナが なかまに くわわった！\nレオンは 共鳴技「ルミナスエッジ」を おもいついた！\n（バトルの「共鳴」コマンドで つかえます）' },
    { t: 'say', who: 'leon', text: 'いくぞ！ いっしょに！' },
    { t: 'say', who: 'selena', text: 'はい！' },
    { t: 'battle', enemies: ['wolf', 'goblin', 'goblin'], boss: true },
    { t: 'flag', name: 'forestDone' },
    { t: 'say', who: 'selena', text: 'たすけて いただいて、ありがとうございました。\nわたしは セレナ。セレナ・アルディスと もうします。' },
    { t: 'say', who: 'selena', text: 'アルディス家は……豪商ゴルドーに 財産を\nうばわれて しまいました。\nだから わたし、冒険者に なって 家を たてなおしたくて。' },
    { t: 'say', who: 'selena', text: 'でも、わたしの いやしの ちからは つよすぎて、\nいつも 暴れてしまうんです。\n……さっき、あなたに ふれるまでは。' },
    { t: 'say', who: 'leon', text: 'おれの スキル、ランク F なんだけどな。\n「気持ちが すこし かよう」だけの。' },
    { t: 'say', who: 'selena', text: 'すこし、なんかじゃ ありませんでした。\n……あの、レオンさん。\nよかったら、わたしと いっしょに 旅を してくれませんか？' },
    { t: 'say', who: 'leon', text: '（前の人生じゃ、こんなふうに だれかと\n組むことなんて なかったな）\n……ああ。よろしくな、セレナ。' },
    { t: 'fadeOut' },
    { t: 'narr', img: 'eclipse_omen', text: 'その夜――\nルミナの 空に、ほんの いっしゅん、\n黒い 太陽が うかんだ。' },
    { t: 'narr', img: 'eclipse_omen', speaker: 'god', text: '……はじまったね、観測者。\nさあ、見せておくれ。' },
    { t: 'chapter', no: '序章', title: '完', sub: '第一章「没落令嬢と金の亡者」へ つづく' },
    { t: 'warp', x: 25, y: 22, dir: 'down' },
    { t: 'healAll' },
    { t: 'fadeIn' },
    { t: 'flag', name: 'prologueDone' },
    { t: 'objective', text: '第一章は じゅんびちゅう。町の外で レベルを あげよう' },
    { t: 'save' },
    { t: 'say', who: 'info', text: '（序章クリア！ ここまでの きろくを セーブしました）' },
  ],
};
