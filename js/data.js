// ゲームデータ（キャラクター・わざ・アイテム・モンスター）
'use strict';

const IMG_DIR = 'assets/img/';

// レオンたち4人。初期値はバトルシーン画像のHP/MPに合わせている
const PARTY_BASE = [
  { id: 'leon', name: 'レオン', job: '風を追う剣士', role: '前衛・攻撃',
    hp: 320, mp: 60, atk: 38, def: 20, mag: 10, spd: 14,
    grow: { hp: 30, mp: 4, atk: 4, def: 2, mag: 1, spd: 1 },
    skills: ['shippu', 'senpu'], equip: { weapon: 'bronzesword', armor: 'travelclothes', acc: null } },
  { id: 'selena', name: 'セレナ', job: '光の癒やし手', role: '後衛・回復',
    hp: 280, mp: 85, atk: 20, def: 14, mag: 30, spd: 12,
    grow: { hp: 22, mp: 7, atk: 2, def: 2, mag: 3, spd: 1 },
    skills: ['heal', 'healall', 'raise', 'holy'], equip: { weapon: 'woodstaff', armor: 'travelclothes', acc: null } },
  { id: 'garo', name: 'ガロ', job: '大地の守り手', role: '前衛・防御',
    hp: 410, mp: 45, atk: 34, def: 30, mag: 5, spd: 8,
    grow: { hp: 38, mp: 3, atk: 3, def: 4, mag: 1, spd: 1 },
    skills: ['teppeki', 'daichi'], equip: { weapon: 'bronzeaxe', armor: 'travelclothes', acc: null } },
  { id: 'noa', name: 'ノア', job: '蒼晶の魔術師', role: '後衛・魔法',
    hp: 240, mp: 120, atk: 16, def: 12, mag: 40, spd: 13,
    grow: { hp: 18, mp: 9, atk: 1, def: 1, mag: 4, spd: 1 },
    skills: ['fire', 'blizzard', 'thunder'], equip: { weapon: 'apprentice', armor: 'travelclothes', acc: null } },
];

// target: enemy=敵1体 / enemies=敵全体 / ally=味方1人 / allies=味方全員 / deadally=戦闘不能の味方
const SKILLS = {
  shippu:   { name: '疾風斬',     type: 'skill', mp: 5,  target: 'enemy',    kind: 'phys',   power: 1.7, fx: 'slash2' },
  senpu:    { name: '旋風剣',     type: 'skill', mp: 12, target: 'enemies',  kind: 'phys',   power: 0.9, fx: 'wind' },
  teppeki:  { name: '鉄壁',       type: 'skill', mp: 6,  target: 'allies',   kind: 'guard',  fx: 'guard' },
  daichi:   { name: '大地割り',   type: 'skill', mp: 10, target: 'enemies',  kind: 'phys',   power: 1.0, fx: 'quake' },
  heal:     { name: 'ヒール',     type: 'magic', mp: 5,  target: 'ally',     kind: 'heal',   power: 2.6, base: 20, fx: 'heal' },
  healall:  { name: 'ヒールオール', type: 'magic', mp: 14, target: 'allies', kind: 'heal',   power: 1.6, base: 10, fx: 'heal' },
  raise:    { name: 'レイズ',     type: 'magic', mp: 18, target: 'deadally', kind: 'revive', fx: 'holy' },
  holy:     { name: 'ホーリー',   type: 'magic', mp: 8,  target: 'enemy',    kind: 'mag',    power: 1.8, fx: 'holy' },
  fire:     { name: 'ファイア',   type: 'magic', mp: 6,  target: 'enemy',    kind: 'mag',    power: 1.6, fx: 'fire' },
  blizzard: { name: 'ブリザド',   type: 'magic', mp: 14, target: 'enemies',  kind: 'mag',    power: 1.1, fx: 'ice' },
  thunder:  { name: 'サンダー',   type: 'magic', mp: 10, target: 'enemy',    kind: 'mag',    power: 2.2, fx: 'thunder' },
};

const ITEMS = {
  potion:   { name: 'ポーション',       desc: 'HPを120かいふく',     target: 'ally',     kind: 'heal',   amount: 120, price: 15 },
  hipotion: { name: 'ハイポーション',   desc: 'HPを300かいふく',     target: 'ally',     kind: 'heal',   amount: 300, price: 60 },
  ether:    { name: 'エーテル',         desc: 'MPを40かいふく',      target: 'ally',     kind: 'mp',     amount: 40,  price: 80 },
  phoenix:  { name: 'フェニックスの尾', desc: '戦闘不能から復活',     target: 'deadally', kind: 'revive',              price: 200 },
  smoke:    { name: 'けむりだま',       desc: 'バトルから かならず にげる', target: 'none', kind: 'escape', battleOnly: true, price: 30 },
};

// 装備品。who=装備できるキャラ（all=全員）
const EQUIPS = {
  // ぶき
  bronzesword:  { name: 'ブロンズソード',       slot: 'weapon', who: ['leon'],   price: 40,   atk: 0 },
  ironsword:    { name: 'アイアンソード',       slot: 'weapon', who: ['leon'],   price: 120,  atk: 8 },
  mithrilsword: { name: 'ミスリルソード',       slot: 'weapon', who: ['leon'],   price: 480,  atk: 18 },
  windsword:    { name: '風切りの剣',           slot: 'weapon', who: ['leon'],   price: 1200, atk: 28, spd: 4 },
  bronzeaxe:    { name: 'ブロンズアクス',       slot: 'weapon', who: ['garo'],   price: 40,   atk: 0 },
  battleaxe:    { name: 'バトルアクス',         slot: 'weapon', who: ['garo'],   price: 150,  atk: 10 },
  gianthammer:  { name: 'ジャイアントハンマー', slot: 'weapon', who: ['garo'],   price: 640,  atk: 24, spd: -2 },
  woodstaff:    { name: '木の杖',               slot: 'weapon', who: ['selena'], price: 30,   atk: 0 },
  healrod:      { name: '癒しのロッド',         slot: 'weapon', who: ['selena'], price: 110,  atk: 3, mag: 7 },
  saintstaff:   { name: '聖女の杖',             slot: 'weapon', who: ['selena'], price: 520,  atk: 5, mag: 16 },
  apprentice:   { name: '見習いの杖',           slot: 'weapon', who: ['noa'],    price: 30,   atk: 0 },
  bluewand:     { name: '蒼晶のワンド',         slot: 'weapon', who: ['noa'],    price: 140,  mag: 9 },
  sagestaff:    { name: '賢者の杖',             slot: 'weapon', who: ['noa'],    price: 680,  mag: 20 },
  // ぼうぐ
  travelclothes: { name: '旅人の服',     slot: 'armor', who: 'all',              price: 20,  def: 0 },
  leather:       { name: 'レザーアーマー', slot: 'armor', who: ['leon', 'garo'],  price: 90,  def: 6 },
  chain:         { name: 'チェインメイル', slot: 'armor', who: ['leon', 'garo'],  price: 280, def: 12 },
  steel:         { name: '鋼の鎧',       slot: 'armor', who: ['garo'],           price: 620, def: 20, spd: -2 },
  silkrobe:      { name: 'シルクのローブ', slot: 'armor', who: ['selena', 'noa'], price: 90,  def: 4, mag: 2 },
  magerobe:      { name: '魔法のローブ', slot: 'armor', who: ['selena', 'noa'],  price: 340, def: 9, mag: 6 },
  // アクセサリー
  charm:     { name: 'まもりのお守り', slot: 'acc', who: 'all', price: 60,  def: 3 },
  powerband: { name: 'ちからのうでわ', slot: 'acc', who: 'all', price: 240, atk: 5 },
  windring:  { name: '疾風の指輪',     slot: 'acc', who: 'all', price: 220, spd: 6 },
};
const SLOT_NAMES = { weapon: 'ぶき', armor: 'ぼうぐ', acc: 'アクセ' };
const STAT_NAMES = { atk: '攻撃', def: '守備', mag: '魔力', spd: '素早さ' };

// 町のお店
const SHOPS = {
  weapon: { name: '武器屋 アイアンハート', keeper: 'ガンツ',
    greet: 'へいらっしゃい！ うちの鉄は ルミナいちだ。',
    thanks: 'まいどあり！ 大事に つかってくれよ。',
    goods: ['ironsword', 'mithrilsword', 'windsword', 'battleaxe', 'gianthammer', 'healrod', 'saintstaff', 'bluewand', 'sagestaff'] },
  armor: { name: '防具屋 まもりの盾', keeper: 'マリエ',
    greet: 'いらっしゃいませ。 いのちを まもる品、そろってますよ。',
    thanks: 'ありがとうございます。 お気をつけて！',
    goods: ['leather', 'chain', 'steel', 'silkrobe', 'magerobe', 'charm', 'powerband', 'windring'] },
  item: { name: 'なんでも屋 ポップ', keeper: 'ポップ',
    greet: 'まいど！ 冒険のおともに ひとつ どう？',
    thanks: 'まいどー！ またきてね！',
    goods: ['potion', 'hipotion', 'ether', 'phoenix', 'smoke'] },
};
const INN = { name: '宿屋 ひだまり亭', price: 20 };

// ステータスはモンスター図鑑の値。special は確率で使う特技
const MONSTERS = {
  slime:      { name: 'スライム',       hp: 30,  atk: 10, def: 5,  spd: 6,  exp: 6,   gold: 5,   scale: 0.75 },
  goblin:     { name: 'ゴブリン',       hp: 45,  atk: 15, def: 8,  spd: 9,  exp: 9,   gold: 9,   scale: 0.85,
                special: { name: 'かみつき', power: 1.3 } },
  wolf:       { name: 'ウルフ',         hp: 60,  atk: 20, def: 12, spd: 15, exp: 13,  gold: 10,  scale: 1.0,
                special: { name: 'かみつき', power: 1.3 } },
  mandragora: { name: 'マンドラゴラ',   hp: 65,  atk: 18, def: 12, spd: 7,  exp: 14,  gold: 12,  scale: 0.9,
                special: { name: '悲鳴', power: 0.55, all: true, fx: 'scream' } },
  harpy:      { name: 'ハーピー',       hp: 70,  atk: 22, def: 14, spd: 16, exp: 18,  gold: 16,  scale: 0.95,
                special: { name: '急降下', power: 1.4 } },
  skeleton:   { name: 'スケルトン',     hp: 80,  atk: 23, def: 16, spd: 10, exp: 20,  gold: 18,  scale: 0.95,
                special: { name: '斬撃', power: 1.4 } },
  ghost:      { name: 'ゴースト',       hp: 70,  atk: 20, def: 10, spd: 12, exp: 19,  gold: 14,  scale: 0.95,
                special: { name: '呪い', power: 1.2, pierce: true, fx: 'curse' } },
  scorpion:   { name: 'スコーピオン',   hp: 75,  atk: 24, def: 18, spd: 11, exp: 21,  gold: 17,  scale: 0.95,
                special: { name: '毒針', power: 1.5 } },
  lizardman:  { name: 'リザードマン',   hp: 85,  atk: 26, def: 16, spd: 12, exp: 24,  gold: 20,  scale: 1.0,
                special: { name: '突進', power: 1.45 } },
  wyvern:     { name: 'ワイバーン',     hp: 90,  atk: 28, def: 18, spd: 17, exp: 32,  gold: 26,  scale: 1.1,
                special: { name: '炎のブレス', power: 0.7, all: true, fx: 'breath' } },
  vampire:    { name: 'ヴァンパイア',   hp: 110, atk: 32, def: 22, spd: 14, exp: 40,  gold: 34,  scale: 1.0,
                special: { name: '吸血', power: 1.2, drain: true, fx: 'curse' } },
  basilisk:   { name: 'バジリスク',     hp: 100, atk: 32, def: 20, spd: 9,  exp: 38,  gold: 30,  scale: 1.1,
                special: { name: '石化の目', power: 1.6, fx: 'curse' } },
  golem:      { name: 'ゴーレム',       hp: 120, atk: 35, def: 30, spd: 5,  exp: 45,  gold: 36,  scale: 1.15,
                special: { name: 'たたきつけ', power: 1.6 } },
  metalslime: { name: 'メタルスライム', hp: 50,  atk: 15, def: 50, spd: 30, exp: 400, gold: 40,  scale: 0.75,
                metal: true },
  darkdragon: { name: 'ダークドラゴン', hp: 200, atk: 50, def: 35, spd: 16, exp: 120, gold: 100, scale: 1.25,
                special: { name: 'ダークブレス', power: 0.8, all: true, fx: 'darkbreath' } },
};

// 城からの距離で出現テーブルが変わる（暫定）
const ZONES = [
  { name: '町の周辺', danger: 1, maxDist: 18, max: 3,
    table: [['slime', 5], ['goblin', 4], ['wolf', 2], ['mandragora', 2], ['metalslime', 0.3]] },
  { name: '辺境の地', danger: 2, maxDist: 27, max: 3,
    table: [['wolf', 3], ['harpy', 3], ['skeleton', 3], ['ghost', 2], ['scorpion', 2], ['lizardman', 2], ['metalslime', 0.4]] },
  { name: '魔境', danger: 3, maxDist: 999, max: 3,
    table: [['lizardman', 2], ['wyvern', 3], ['vampire', 2], ['basilisk', 2], ['golem', 2], ['metalslime', 0.4], ['darkdragon', 0.6]] },
];

const START_ITEMS = { potion: 5, ether: 2, phoenix: 2 };
const START_GOLD = 200;

function expForLevel(lv) { return Math.floor(18 * (lv - 1) * (lv - 1) + 22 * (lv - 1)); }
