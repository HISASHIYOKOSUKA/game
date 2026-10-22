// ゲームデータ（キャラクター・わざ・アイテム・装備・お店・モンスター）
'use strict';

const IMG_DIR = 'assets/img/';

// レオンたち4人。skills は最初から使えるもの、learn はレベルで覚えるもの
const PARTY_BASE = [
  { id: 'leon', name: 'レオン', job: '風を追う剣士', role: '前衛・攻撃',
    hp: 320, mp: 40, atk: 38, def: 20, mag: 10, spd: 14,
    grow: { hp: 30, mp: 4, atk: 4, def: 2, mag: 1, spd: 1 },
    skills: [], learn: [[3, 'shippu'], [7, 'senpu'], [12, 'raikou'], [17, 'reppu'], [22, 'tenku']],
    equip: { weapon: 'bronzesword', armor: 'travelclothes', acc: null } },
  { id: 'selena', name: 'セレナ', job: '光の癒やし手', role: '後衛・回復',
    hp: 280, mp: 60, atk: 20, def: 14, mag: 30, spd: 12,
    grow: { hp: 22, mp: 7, atk: 2, def: 2, mag: 3, spd: 1 },
    skills: ['heal'], learn: [[4, 'holy'], [6, 'healall'], [9, 'raise'], [11, 'protect'], [13, 'hiheal'], [16, 'holynova'], [20, 'fullcare'], [23, 'arise']],
    equip: { weapon: 'woodstaff', armor: 'travelclothes', acc: null } },
  { id: 'garo', name: 'ガロ', job: '大地の守り手', role: '前衛・防御',
    hp: 410, mp: 30, atk: 34, def: 30, mag: 5, spd: 8,
    grow: { hp: 38, mp: 3, atk: 4, def: 4, mag: 1, spd: 1 },
    skills: [], learn: [[3, 'teppeki'], [6, 'daichi'], [9, 'kabuto'], [14, 'gaia'], [18, 'fudou'], [22, 'titan']],
    equip: { weapon: 'bronzeaxe', armor: 'travelclothes', acc: null } },
  { id: 'noa', name: 'ノア', job: '蒼晶の魔術師', role: '後衛・魔法',
    hp: 240, mp: 80, atk: 16, def: 12, mag: 40, spd: 13,
    grow: { hp: 18, mp: 9, atk: 1, def: 1, mag: 4, spd: 1 },
    skills: ['fire'], learn: [[4, 'thunder'], [6, 'blizzard'], [10, 'flare'], [13, 'iceage'], [16, 'judge'], [21, 'meteor']],
    equip: { weapon: 'apprentice', armor: 'travelclothes', acc: null } },
];

// その章だけの仲間（ゲスト）。見た目は sprites.js でオリジナルに描く
const GUESTS = [
  { id: 'harold', name: 'ハロルド', job: 'アルディス家の老騎士', role: '前衛・防御（ゲスト）', guest: true,
    hp: 300, mp: 24, atk: 34, def: 26, mag: 4, spd: 7,
    grow: { hp: 22, mp: 2, atk: 3, def: 3, mag: 0, spd: 1 },
    skills: ['teppeki', 'kabuto'], learn: [], equip: { weapon: null, armor: null, acc: null } },
  { id: 'mina', name: 'ミーナ', job: 'ゴラン村の薬師見習い', role: '後衛・回復（ゲスト）', guest: true,
    hp: 200, mp: 50, atk: 14, def: 12, mag: 24, spd: 15,
    grow: { hp: 16, mp: 5, atk: 1, def: 2, mag: 3, spd: 2 },
    skills: ['heal', 'herb'], learn: [], equip: { weapon: null, armor: null, acc: null } },
  { id: 'olga', name: 'オルガ先生', job: '学院の老教授', role: '後衛・魔法（ゲスト）', guest: true,
    hp: 260, mp: 120, atk: 14, def: 16, mag: 44, spd: 9,
    grow: { hp: 14, mp: 6, atk: 1, def: 1, mag: 3, spd: 1 },
    skills: ['fire', 'thunder', 'blizzard', 'heal'], learn: [], equip: { weapon: null, armor: null, acc: null } },
];
const findBase = id => PARTY_BASE.find(b => b.id === id) || GUESTS.find(b => b.id === id);

// 色替えは雑魚モンスターだけに使う（キャラクターは sprites.js で描く）
const VARIANTS = {};

// target: enemy=敵1体 / enemies=敵全体 / ally=味方1人 / allies=味方全員 / deadally=戦闘不能の味方
const SKILLS = {
  // レオン
  shippu:   { name: '疾風斬',       type: 'skill', mp: 5,  target: 'enemy',    kind: 'phys', power: 1.7, fx: 'slash2' },
  senpu:    { name: '旋風剣',       type: 'skill', mp: 10, target: 'enemies',  kind: 'phys', power: 1.0, fx: 'wind' },
  raikou:   { name: '雷光斬',       type: 'skill', mp: 14, target: 'enemy',    kind: 'phys', power: 2.6, fx: 'slash3' },
  reppu:    { name: '烈風乱舞',     type: 'skill', mp: 22, target: 'enemies',  kind: 'phys', power: 1.5, fx: 'wind2' },
  tenku:    { name: '天空覇王斬',   type: 'skill', mp: 32, target: 'enemy',    kind: 'phys', power: 4.0, fx: 'slash4' },
  // セレナ
  heal:     { name: 'ヒール',       type: 'magic', mp: 4,  target: 'ally',     kind: 'heal', power: 2.4, base: 20, fx: 'heal' },
  holy:     { name: 'ホーリー',     type: 'magic', mp: 7,  target: 'enemy',    kind: 'mag',  power: 1.8, fx: 'holy' },
  healall:  { name: 'ヒールオール', type: 'magic', mp: 12, target: 'allies',   kind: 'heal', power: 1.5, base: 10, fx: 'heal' },
  raise:    { name: 'レイズ',       type: 'magic', mp: 16, target: 'deadally', kind: 'revive', ratio: 0.5, fx: 'holy' },
  protect:  { name: 'プロテクト',   type: 'magic', mp: 10, target: 'allies',   kind: 'guard', turns: 3, mul: 0.5, fx: 'guard' },
  hiheal:   { name: 'ハイヒール',   type: 'magic', mp: 12, target: 'ally',     kind: 'heal', power: 5, base: 60, fx: 'heal2' },
  holynova: { name: 'ホーリーノヴァ', type: 'magic', mp: 24, target: 'enemies', kind: 'mag',  power: 1.7, fx: 'holy2' },
  fullcare: { name: 'フルケア',     type: 'magic', mp: 30, target: 'allies',   kind: 'heal', power: 4, base: 50, fx: 'heal2' },
  arise:    { name: 'アレイズ',     type: 'magic', mp: 30, target: 'deadally', kind: 'revive', ratio: 1, fx: 'holy2' },
  // ガロ
  teppeki:  { name: '鉄壁',         type: 'skill', mp: 6,  target: 'allies',   kind: 'guard', turns: 3, mul: 0.5, fx: 'guard' },
  daichi:   { name: '大地割り',     type: 'skill', mp: 10, target: 'enemies',  kind: 'phys', power: 1.0, fx: 'quake' },
  kabuto:   { name: '兜割り',       type: 'skill', mp: 8,  target: 'enemy',    kind: 'phys', power: 2.2, fx: 'smash' },
  gaia:     { name: 'ガイアクラッシュ', type: 'skill', mp: 20, target: 'enemies', kind: 'phys', power: 1.7, fx: 'quake2' },
  fudou:    { name: '不動明王',     type: 'skill', mp: 16, target: 'allies',   kind: 'guard', turns: 4, mul: 0.35, fx: 'guard2' },
  titan:    { name: 'タイタンブレイク', type: 'skill', mp: 28, target: 'enemy', kind: 'phys', power: 4.2, fx: 'smash2' },
  // ノア
  fire:     { name: 'ファイア',     type: 'magic', mp: 5,  target: 'enemy',    kind: 'mag', power: 1.6, fx: 'fire' },
  thunder:  { name: 'サンダー',     type: 'magic', mp: 8,  target: 'enemy',    kind: 'mag', power: 2.0, fx: 'thunder' },
  blizzard: { name: 'ブリザド',     type: 'magic', mp: 12, target: 'enemies',  kind: 'mag', power: 1.1, fx: 'ice' },
  flare:    { name: 'フレイムバースト', type: 'magic', mp: 18, target: 'enemies', kind: 'mag', power: 1.6, fx: 'fire2' },
  iceage:   { name: 'アイスエイジ', type: 'magic', mp: 22, target: 'enemies',  kind: 'mag', power: 1.9, fx: 'ice2' },
  judge:    { name: 'ジャッジボルト', type: 'magic', mp: 26, target: 'enemies', kind: 'mag', power: 2.2, fx: 'thunder2' },
  meteor:   { name: 'メテオ',       type: 'magic', mp: 40, target: 'enemies',  kind: 'mag', power: 3.0, fx: 'meteor' },
  // ゲスト
  herb:     { name: 'ハーブの香り', type: 'magic', mp: 6,  target: 'allies',   kind: 'heal', power: 1.0, base: 30, fx: 'heal' },
};

const ITEMS = {
  potion:   { name: 'ポーション',       desc: 'HPを120かいふく',     target: 'ally',     kind: 'heal',   amount: 120,  price: 15 },
  hipotion: { name: 'ハイポーション',   desc: 'HPを350かいふく',     target: 'ally',     kind: 'heal',   amount: 350,  price: 70 },
  xpotion:  { name: 'エクスポーション', desc: 'HPを900かいふく',     target: 'ally',     kind: 'heal',   amount: 900,  price: 300 },
  ether:    { name: 'エーテル',         desc: 'MPを40かいふく',      target: 'ally',     kind: 'mp',     amount: 40,   price: 80 },
  hiether:  { name: 'ハイエーテル',     desc: 'MPを120かいふく',     target: 'ally',     kind: 'mp',     amount: 120,  price: 400 },
  phoenix:  { name: 'フェニックスの尾', desc: '戦闘不能から復活',     target: 'deadally', kind: 'revive',               price: 200 },
  elixir:   { name: 'エリクサー',       desc: 'HPとMPを ぜんかいふく', target: 'ally',    kind: 'full',                 price: 2000 },
  smoke:    { name: 'けむりだま',       desc: 'バトルから かならず にげる', target: 'none', kind: 'escape', battleOnly: true, price: 30 },
};

// 装備品。who=装備できるキャラ（all=全員）。price 0 は店で売っていない（宝箱など）
const EQUIPS = {
  // ぶき：レオン
  bronzesword:  { name: 'ブロンズソード',   slot: 'weapon', who: ['leon'],   price: 40,   atk: 0 },
  ironsword:    { name: 'アイアンソード',   slot: 'weapon', who: ['leon'],   price: 120,  atk: 8 },
  steelsword:   { name: 'スチールソード',   slot: 'weapon', who: ['leon'],   price: 420,  atk: 16 },
  mithrilsword: { name: 'ミスリルソード',   slot: 'weapon', who: ['leon'],   price: 1100, atk: 26 },
  windsword:    { name: '風切りの剣',       slot: 'weapon', who: ['leon'],   price: 2600, atk: 38, spd: 4 },
  eclipseblade: { name: '天輪の剣',         slot: 'weapon', who: ['leon'],   price: 0,    atk: 52, spd: 6 },
  // ガロ
  bronzeaxe:    { name: 'ブロンズアクス',   slot: 'weapon', who: ['garo'],   price: 40,   atk: 0 },
  battleaxe:    { name: 'バトルアクス',     slot: 'weapon', who: ['garo'],   price: 150,  atk: 10 },
  greataxe:     { name: 'グレートアクス',   slot: 'weapon', who: ['garo'],   price: 520,  atk: 20 },
  gianthammer:  { name: 'ジャイアントハンマー', slot: 'weapon', who: ['garo'], price: 1300, atk: 32, spd: -2 },
  gaiaaxe:      { name: '大地の斧',         slot: 'weapon', who: ['garo'],   price: 0,    atk: 46, def: 6 },
  // セレナ
  woodstaff:    { name: '木の杖',           slot: 'weapon', who: ['selena'], price: 30,   atk: 0 },
  healrod:      { name: '癒しのロッド',     slot: 'weapon', who: ['selena'], price: 110,  atk: 3, mag: 7 },
  silverrod:    { name: 'シルバーロッド',   slot: 'weapon', who: ['selena'], price: 450,  atk: 5, mag: 12 },
  saintstaff:   { name: '聖女の杖',         slot: 'weapon', who: ['selena'], price: 1200, atk: 6, mag: 20 },
  lightstaff:   { name: '光輪の杖',         slot: 'weapon', who: ['selena'], price: 0,    atk: 8, mag: 30 },
  // ノア
  apprentice:   { name: '見習いの杖',       slot: 'weapon', who: ['noa'],    price: 30,   atk: 0 },
  bluewand:     { name: '蒼晶のワンド',     slot: 'weapon', who: ['noa'],    price: 140,  mag: 9 },
  runewand:     { name: 'ルーンワンド',     slot: 'weapon', who: ['noa'],    price: 480,  mag: 15 },
  sagestaff:    { name: '賢者の杖',         slot: 'weapon', who: ['noa'],    price: 1400, mag: 24 },
  starstaff:    { name: '星詠みの杖',       slot: 'weapon', who: ['noa'],    price: 0,    mag: 34, spd: 3 },
  // ぼうぐ
  travelclothes: { name: '旅人の服',       slot: 'armor', who: 'all',              price: 20,   def: 0 },
  leather:       { name: 'レザーアーマー', slot: 'armor', who: ['leon', 'garo'],   price: 90,   def: 6 },
  chain:         { name: 'チェインメイル', slot: 'armor', who: ['leon', 'garo'],   price: 320,  def: 12 },
  steel:         { name: '鋼の鎧',         slot: 'armor', who: ['leon', 'garo'],   price: 900,  def: 20, spd: -1 },
  mithrilmail:   { name: 'ミスリルメイル', slot: 'armor', who: ['leon', 'garo'],   price: 2200, def: 30 },
  dragonmail:    { name: '竜鱗の鎧',       slot: 'armor', who: ['leon', 'garo'],   price: 0,    def: 42 },
  silkrobe:      { name: 'シルクのローブ', slot: 'armor', who: ['selena', 'noa'],  price: 90,   def: 4, mag: 2 },
  magerobe:      { name: '魔法のローブ',   slot: 'armor', who: ['selena', 'noa'],  price: 360,  def: 9, mag: 6 },
  sagerobe:      { name: '賢者のローブ',   slot: 'armor', who: ['selena', 'noa'],  price: 1000, def: 16, mag: 10 },
  holyrobe:      { name: '聖なるローブ',   slot: 'armor', who: ['selena', 'noa'],  price: 2400, def: 24, mag: 14 },
  starrobe:      { name: '星のローブ',     slot: 'armor', who: ['selena', 'noa'],  price: 0,    def: 32, mag: 20 },
  // アクセサリー
  charm:     { name: 'まもりのお守り', slot: 'acc', who: 'all', price: 60,   def: 3 },
  powerband: { name: 'ちからのうでわ', slot: 'acc', who: 'all', price: 240,  atk: 5 },
  windring:  { name: '疾風の指輪',     slot: 'acc', who: 'all', price: 220,  spd: 6 },
  mindring:  { name: '知恵の指輪',     slot: 'acc', who: 'all', price: 300,  mag: 6 },
  guardring: { name: '守護の指輪',     slot: 'acc', who: 'all', price: 900,  def: 10 },
  heroring:  { name: '勇者のあかし',   slot: 'acc', who: 'all', price: 2500, atk: 10, def: 5, mag: 5 },
};
const SLOT_NAMES = { weapon: 'ぶき', armor: 'ぼうぐ', acc: 'アクセ' };
const STAT_NAMES = { atk: '攻撃', def: '守備', mag: '魔力', spd: '素早さ' };

// お店。finalGoods は最終章で品ぞろえに加わる
const SHOPS = {
  weapon: { name: '武器屋 アイアンハート', keeper: 'ガンツ',
    greet: 'へいらっしゃい！ うちの鉄は ルミナいちだ。', thanks: 'まいどあり！ 大事に つかってくれよ。',
    goods: ['ironsword', 'battleaxe', 'healrod', 'bluewand'], finalGoods: ['mithrilsword', 'gianthammer', 'saintstaff', 'sagestaff'] },
  armor: { name: '防具屋 まもりの盾', keeper: 'マリエ',
    greet: 'いらっしゃいませ。 いのちを まもる品、そろってますよ。', thanks: 'ありがとうございます。 お気をつけて！',
    goods: ['leather', 'silkrobe', 'charm', 'powerband'], finalGoods: ['steel', 'sagerobe', 'guardring', 'windring'] },
  item: { name: 'なんでも屋 ポップ', keeper: 'ポップ',
    greet: 'まいど！ 冒険のおともに ひとつ どう？', thanks: 'まいどー！ またきてね！',
    goods: ['potion', 'hipotion', 'ether', 'phoenix', 'smoke'], finalGoods: ['xpotion', 'hiether'] },
  belgaShop: { name: 'ベルガ武具商会', keeper: 'ロッソ',
    greet: 'いらっしゃいませ。 ベルガの品は 大陸いちの 品質ですよ。', thanks: 'お買い上げ ありがとうございます。',
    goods: ['steelsword', 'greataxe', 'silverrod', 'runewand', 'chain', 'magerobe', 'windring', 'mindring'], finalGoods: ['windsword', 'mithrilmail', 'holyrobe', 'heroring'] },
  belgaItem: { name: 'ベルガ道具店', keeper: 'カーラ',
    greet: 'いらっしゃい！ 港から とどいた ばかりの 品だよ。', thanks: 'まいどあり！',
    goods: ['potion', 'hipotion', 'ether', 'phoenix', 'smoke'], finalGoods: ['xpotion', 'hiether'] },
  sofiaShop: { name: '魔法具店 ルーン', keeper: 'エルマ',
    greet: 'ようこそ。 魔力の やどる 品を そろえております。', thanks: 'あなたに 星の 導きを。',
    goods: ['silverrod', 'runewand', 'magerobe', 'sagerobe', 'mindring', 'hipotion', 'ether', 'phoenix'], finalGoods: ['saintstaff', 'sagestaff', 'holyrobe', 'hiether', 'xpotion'] },
};
const INNS = {
  inn:      { name: '宿屋 ひだまり亭', price: 20, keeper: 'innkeeper' },
  belgaInn: { name: '宿屋 港のしずく亭', price: 40, keeper: 'belgaInn' },
  sofiaInn: { name: '宿屋 ふくろう亭', price: 60, keeper: 'innkeeper' },
};
const INN = INNS.inn;

// モンスター。special は確率で使う特技（配列なら順番に選ぶ）
// boss は ボス戦用。actions は 1ターンの行動回数。img/tone で画像の流用と色替え
const MONSTERS = {
  slime:      { name: 'スライム',       hp: 30,  atk: 10, def: 5,  spd: 6,  scale: 0.75 },
  goblin:     { name: 'ゴブリン',       hp: 45,  atk: 15, def: 8,  spd: 9,  scale: 0.85, special: { name: 'かみつき', power: 1.3 } },
  wolf:       { name: 'ウルフ',         hp: 60,  atk: 20, def: 12, spd: 15, scale: 1.0, special: { name: 'かみつき', power: 1.3 } },
  mandragora: { name: 'マンドラゴラ',   hp: 65,  atk: 18, def: 12, spd: 7,  scale: 0.9, special: { name: '悲鳴', power: 0.55, all: true, fx: 'scream' } },
  pixie:      { name: 'ピクシー',       hp: 55,  atk: 19, def: 10, spd: 18, scale: 0.85, special: { name: 'いたずら魔法', power: 1.3, fx: 'curse' } },
  harpy:      { name: 'ハーピー',       hp: 70,  atk: 22, def: 14, spd: 16, scale: 0.95, special: { name: '急降下', power: 1.4 } },
  skeleton:   { name: 'スケルトン',     hp: 80,  atk: 23, def: 16, spd: 10, scale: 0.95, special: { name: '斬撃', power: 1.4 } },
  ghost:      { name: 'ゴースト',       hp: 70,  atk: 20, def: 10, spd: 12, scale: 0.95, special: { name: '呪い', power: 1.2, pierce: true, fx: 'curse' } },
  scorpion:   { name: 'スコーピオン',   hp: 75,  atk: 24, def: 18, spd: 11, scale: 0.95, special: { name: '毒針', power: 1.5 } },
  lizardman:  { name: 'リザードマン',   hp: 85,  atk: 26, def: 16, spd: 12, scale: 1.0, special: { name: '突進', power: 1.45 } },
  cactus:     { name: 'カクタス',       hp: 90,  atk: 28, def: 20, spd: 8,  scale: 0.9, special: { name: '針の嵐', power: 0.7, all: true, fx: 'scream' } },
  venombat:   { name: 'ヴェノムバット', hp: 70,  atk: 30, def: 12, spd: 20, scale: 0.9, special: { name: '吸血', power: 1.1, drain: true, fx: 'curse' } },
  frogknight: { name: 'フロッグナイト', hp: 95,  atk: 30, def: 20, spd: 13, scale: 1.0, special: { name: '槍突き', power: 1.5 } },
  ecto:       { name: 'エクトプラズム', hp: 60,  atk: 22, def: 14, spd: 14, scale: 0.9, special: { name: '吸収', power: 1.0, drain: true, fx: 'curse' } },
  fairy:      { name: 'フェアリー',     hp: 110, atk: 26, def: 12, spd: 19, scale: 0.9, special: { name: '妖精の風', power: 0.7, all: true, fx: 'wind' } },
  undine:     { name: 'ウンディーネ',   hp: 100, atk: 28, def: 20, spd: 13, scale: 0.95, special: { name: '水の刃', power: 0.75, all: true, fx: 'ice' } },
  centaur:    { name: 'ケンタウロス',   hp: 110, atk: 32, def: 22, spd: 16, scale: 1.05, special: { name: '矢の雨', power: 0.75, all: true, fx: 'scream' } },
  widow:      { name: 'ブラックウィドウ', hp: 120, atk: 34, def: 24, spd: 14, scale: 1.2, special: { name: '毒の糸', power: 1.5, fx: 'curse' } },
  dullahan:   { name: 'デュラハン',     hp: 130, atk: 40, def: 28, spd: 12, scale: 1.4, special: { name: '首狩り', power: 1.7 } },
  golem:      { name: 'ゴーレム',       hp: 120, atk: 35, def: 30, spd: 5,  scale: 1.15, special: { name: 'たたきつけ', power: 1.6 } },
  mimic:      { name: 'ミミック',       hp: 80,  atk: 26, def: 10, spd: 16, scale: 0.9, special: { name: 'かみくだく', power: 2.0 } },
  wyvern:     { name: 'ワイバーン',     hp: 90,  atk: 28, def: 18, spd: 17, scale: 1.1, special: { name: '炎のブレス', power: 0.7, all: true, fx: 'breath' } },
  vampire:    { name: 'ヴァンパイア',   hp: 110, atk: 32, def: 22, spd: 14, scale: 1.0, special: { name: '吸血', power: 1.2, drain: true, fx: 'curse' } },
  basilisk:   { name: 'バジリスク',     hp: 100, atk: 32, def: 20, spd: 9,  scale: 1.1, special: { name: '石化の目', power: 1.6, fx: 'curse' } },
  metalslime: { name: 'メタルスライム', hp: 50,  atk: 15, def: 50, spd: 30, scale: 0.75, metal: true, exp: 600, gold: 40 },
  // 最終章の魔物
  manticore:  { name: 'マンティコア',   hp: 210, atk: 52, def: 30, spd: 16, scale: 1.05, special: { name: '毒の尾', power: 1.5 } },
  chimera:    { name: 'キマイラ',       hp: 230, atk: 50, def: 32, spd: 18, scale: 1.1, special: { name: '三頭のブレス', power: 0.75, all: true, fx: 'breath' } },
  cyclops:    { name: 'サイクロプス',   hp: 300, atk: 60, def: 38, spd: 8,  scale: 1.25, special: { name: '一つ目の光', power: 0.8, all: true, fx: 'holy' } },
  hellhound:  { name: 'ヘルハウンド',   hp: 260, atk: 58, def: 34, spd: 20, scale: 1.1, special: { name: '地獄の炎', power: 0.8, all: true, fx: 'breath' } },
  stonebeast: { name: 'ストーンビースト', hp: 320, atk: 56, def: 44, spd: 7, scale: 1.2, special: { name: '岩なだれ', power: 0.75, all: true, fx: 'quake' } },
  troll:      { name: 'ジャイアントトロール', hp: 340, atk: 58, def: 40, spd: 6, scale: 1.25, special: { name: '大振り', power: 1.7 } },
  frogking:   { name: 'フロッグキング', hp: 260, atk: 54, def: 34, spd: 12, scale: 1.2, special: { name: '王の号令', power: 0.8, all: true, fx: 'scream' } },
  lamia:      { name: 'ラミア',         hp: 280, atk: 58, def: 32, spd: 17, scale: 1.3, special: { name: '魅惑の歌', power: 0.8, all: true, fx: 'scream' } },
  behemoth:   { name: 'ベヒーモス',     hp: 420, atk: 66, def: 42, spd: 11, scale: 1.3, special: { name: '地響き', power: 0.85, all: true, fx: 'quake' } },
  leviathan:  { name: 'リヴァイアサン', hp: 380, atk: 64, def: 40, spd: 14, scale: 1.25, special: { name: '大津波', power: 0.85, all: true, fx: 'ice' } },
  darkdragon: { name: 'ダークドラゴン', hp: 600, atk: 74, def: 46, spd: 16, scale: 1.3, special: { name: 'ダークブレス', power: 0.9, all: true, fx: 'darkbreath' } },
  ifritling:  { name: 'フレイムスピリット', img: 'ifrit', hp: 300, atk: 62, def: 36, spd: 18, scale: 1.0, special: { name: '火の粉', power: 0.8, all: true, fx: 'fire' } },
  darkknight: { name: 'ダークナイト',   img: 'dullahan', tone: 'dark', hp: 380, atk: 70, def: 48, spd: 13, scale: 1.4, special: { name: '暗黒剣', power: 1.7, fx: 'curse' } },
  shadowwolf: { name: 'シャドウウルフ', img: 'wolf', tone: 'dark', hp: 220, atk: 54, def: 30, spd: 22, scale: 1.0, special: { name: '影牙', power: 1.5 } },
  redslime:   { name: 'スライムベス',   img: 'slime', tone: 'crimson', hp: 140, atk: 44, def: 26, spd: 12, scale: 0.8, special: { name: 'ひのたま', power: 1.3, fx: 'fire' } },
  icewyvern:  { name: 'アイスワイバーン', img: 'wyvern', tone: { hue: 180 }, hp: 300, atk: 60, def: 36, spd: 19, scale: 1.1, special: { name: '吹雪', power: 0.8, all: true, fx: 'ice' } },
  shadowelf:  { name: 'シャドウエルフ', img: 'darkelf', tone: 'dark', hp: 340, atk: 68, def: 40, spd: 20, scale: 1.1, special: { name: '闇の矢', power: 0.85, all: true, fx: 'darkflare' } },
  // ===== ボス =====
  b_wolfking:  { name: 'ウルフリーダー', img: 'wolf', tone: 'dark', boss: true, hp: 260, atk: 25, def: 12, spd: 14, scale: 1.35, exp: 120, gold: 60,
                 special: [{ name: 'とおぼえ', power: 0.6, all: true, fx: 'scream' }, { name: 'かみくだく', power: 1.6 }] },
  b_stone:     { name: '岩の巨人', img: 'stonebeast', boss: true, hp: 800, atk: 35, def: 20, spd: 6, scale: 1.6, exp: 380, gold: 250,
                 special: [{ name: '岩なだれ', power: 0.7, all: true, fx: 'quake' }, { name: '剛腕', power: 1.6 }] },
  b_troll:     { name: '鉱山の主トロール', img: 'troll', boss: true, hp: 1300, atk: 48, def: 28, spd: 7, scale: 1.7, exp: 900, gold: 500,
                 special: [{ name: '地ならし', power: 0.8, all: true, fx: 'quake' }, { name: '大振り', power: 1.8 }] },
  b_vampire:   { name: '教団幹部ヴラド', img: 'vampirelord', boss: true, hp: 1600, atk: 48, def: 26, spd: 15, scale: 1.6, exp: 1300, gold: 700,
                 special: [{ name: 'ブラッドミスト', power: 0.85, all: true, fx: 'darkbreath' }, { name: '吸血', power: 1.4, drain: true, fx: 'curse' }] },
  b_cerberus:  { name: 'ケルベロス', img: 'cerberus', boss: true, hp: 1400, atk: 62, def: 30, spd: 16, scale: 1.6, exp: 1200, gold: 600,
                 special: [{ name: '三つ首の炎', power: 0.8, all: true, fx: 'breath' }, { name: 'かみくだく', power: 1.6 }] },
  b_garo:      { name: 'ガロ', sprite: 'garo', boss: true, hp: 2200, atk: 70, def: 40, spd: 10, scale: 1.0, exp: 1500, gold: 0,
                 special: [{ name: '大地割り', power: 0.85, all: true, fx: 'quake' }, { name: '兜割り', power: 1.9, fx: 'smash' }] },
  b_hydra:     { name: 'ヒドラ', img: 'hydra', boss: true, hp: 3400, atk: 64, def: 36, spd: 12, scale: 1.8, exp: 2600, gold: 900, regen: 120,
                 special: [{ name: '毒のブレス', power: 0.85, all: true, fx: 'darkbreath' }, { name: 'かみつき', power: 1.6 }] },
  b_garza:     { name: '雷の使徒ガルザ', img: 'stormgeneral', boss: true, hp: 5000, atk: 72, def: 42, spd: 18, scale: 1.8, exp: 4000, gold: 1500, actions: 2,
                 special: [{ name: 'ジャッジメント', power: 0.9, all: true, fx: 'thunder2' }, { name: '雷槍', power: 1.8, fx: 'thunder' }] },
  b_ifra:      { name: '炎の使徒イフラ', img: 'ifrit', boss: true, hp: 5800, atk: 78, def: 42, spd: 17, scale: 2.0, exp: 5000, gold: 1800, actions: 2,
                 special: [{ name: 'インフェルノ', power: 0.95, all: true, fx: 'fire2' }, { name: '灼熱の拳', power: 1.8, fx: 'fire' }] },
  b_nemesis:   { name: '教団長ネメシス', img: 'darkelf', boss: true, hp: 6800, atk: 82, def: 46, spd: 22, scale: 1.8, exp: 6000, gold: 2500, actions: 2,
                 special: [{ name: 'ダークフレア', power: 1.0, all: true, fx: 'darkflare' }, { name: '魂の鎌', power: 1.9, drain: true, fx: 'curse' }] },
  b_lucifer1:  { name: 'ルシファー・エクリプス', img: 'boss_lucifer1', boss: true, last: true, hp: 7000, atk: 86, def: 48, spd: 20, scale: 0.62, exp: 0, gold: 0, actions: 2,
                 special: [{ name: 'ダークフレア', power: 0.95, all: true, fx: 'darkflare' }, { name: 'ホーリーライト', power: 2.0, fx: 'holy2' }, { name: 'ソウルドレイン', power: 1.4, drain: true, fx: 'curse' }] },
  b_lucifer2:  { name: 'ルシファー・エクリプス', img: 'boss_lucifer2', boss: true, last: true, hp: 7600, atk: 94, def: 52, spd: 22, scale: 0.6, exp: 0, gold: 0, actions: 2,
                 special: [{ name: 'カオスブレイザー', power: 1.0, all: true, fx: 'fire2' }, { name: 'ダークネビュラ', power: 1.05, all: true, fx: 'darkflare' }, { name: 'テリブルウェーブ', power: 0.9, all: true, fx: 'quake2' }] },
  b_lucifer3:  { name: 'ルシファー・エクリプス', img: 'boss_lucifer3', boss: true, last: true, hp: 10500, atk: 102, def: 56, spd: 24, scale: 0.6, exp: 0, gold: 0, actions: 2,
                 special: [{ name: 'エクリプス・ノヴァ', power: 1.15, all: true, fx: 'nova' }, { name: 'デス・インフィニティ', power: 2.4, fx: 'darkflare' }, { name: 'リバースワールド', power: 0.8, all: true, fx: 'thunder2', healSelf: 0.06 }] },
};
// 経験値とお金は 体力と攻撃力から決める（決めてあるものは そのまま）
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  if (m.exp === undefined) m.exp = Math.round(m.hp * 0.45 + m.atk * 1.4);
  if (m.gold === undefined) m.gold = Math.round(m.hp * 0.25 + m.atk * 0.4);
}

// 出現する魔物（章 → 地域 → [魔物, 重み]）。地域は game.js の regionAt で決まる
const ENCOUNTERS = {
  prologue: {
    lumina: [['slime', 5], ['goblin', 3], ['wolf', 1]],
  },
  ch1: {
    lumina: [['slime', 4], ['goblin', 4], ['wolf', 3], ['mandragora', 2], ['metalslime', 0.3]],
    east:   [['goblin', 3], ['wolf', 3], ['mandragora', 3], ['pixie', 2]],
    south:  [['wolf', 3], ['mandragora', 3], ['pixie', 3]],
  },
  ch2: {
    lumina: [['wolf', 3], ['mandragora', 3], ['pixie', 3]],
    east:   [['harpy', 3], ['skeleton', 3], ['scorpion', 3], ['lizardman', 2], ['venombat', 2], ['metalslime', 0.3]],
    south:  [['lizardman', 3], ['cactus', 3], ['frogknight', 2]],
    mine:   [['skeleton', 3], ['venombat', 3], ['golem', 2], ['mimic', 1], ['cactus', 2]],
  },
  ch3: {
    lumina: [['wolf', 3], ['pixie', 3], ['harpy', 2]],
    east:   [['harpy', 3], ['scorpion', 3], ['lizardman', 2]],
    south:  [['ghost', 3], ['ecto', 3], ['fairy', 2], ['undine', 2], ['centaur', 1], ['metalslime', 0.3]],
    tower:  [['ghost', 3], ['ecto', 3], ['widow', 2], ['dullahan', 1], ['undine', 2]],
  },
  final: {
    lumina: [['manticore', 3], ['chimera', 3], ['shadowwolf', 3], ['redslime', 3], ['metalslime', 0.5]],
    east:   [['cyclops', 3], ['hellhound', 3], ['stonebeast', 2], ['troll', 2], ['frogking', 2], ['metalslime', 0.4]],
    south:  [['lamia', 3], ['behemoth', 2], ['leviathan', 2], ['icewyvern', 2], ['widow', 2]],
    mine:   [['troll', 3], ['stonebeast', 3], ['golem', 2]],
    tower:  [['dullahan', 3], ['lamia', 2], ['darkknight', 2], ['shadowelf', 1]],
    castle: [['darkknight', 3], ['vampire', 2], ['frogking', 2], ['shadowwolf', 3]],
    temple: [['behemoth', 2], ['ifritling', 3], ['shadowelf', 3], ['darkknight', 2], ['darkdragon', 1]],
  },
};
const REGION_NAMES = { lumina: 'ルミナ地方', east: 'ベルガ街道', south: 'ソフィア平原', mine: 'ゴルドー鉱山', tower: '蒼晶の塔', castle: 'ルミナ城', temple: '終焉の神殿' };

const START_ITEMS = { potion: 5, ether: 2, phoenix: 2 };
const START_GOLD = 200;

function expForLevel(lv) { const n = lv - 1; return Math.floor(0.9 * n * n * n + 18 * n * n + 22 * n); }
