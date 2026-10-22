// フィールドマップ生成（シード固定のノイズ地形に、町や道を書きこむ）
'use strict';

const T = { WATER: 0, SAND: 1, GRASS: 2, FLOWER: 3, FOREST: 4, MOUNT: 5, PATH: 6, CASTLE: 7, BRIDGE: 8,
  ROAD: 9, PAVE: 10, FENCE: 11, BED: 12, TGRASS: 13, WALK: 14, CWALL: 15, HEDGE: 16, ASH: 17,
  IFLOOR: 20, IWALL: 21, IMAT: 22, IRUG: 23, ICOUNTER: 24, // 20〜は建物の中
  DFLOOR: 30, DWALL: 31, DPIT: 32, DSTAIR: 33, DCARPET: 34 }; // 30〜はダンジョン
const MAP_W = 96, MAP_H = 64;

// 町（柵で囲まれた範囲）。music は町の曲。open は柵のない集落（魔物は入らないが町あつかいしない）
const TOWNS = [
  { id: 'lumina', name: 'ルミナの町',     x0: 20, y0: 11, x1: 44, y1: 33, cx: 32, cy: 22, music: 'lumina' },
  { id: 'belga',  name: '商業都市ベルガ', x0: 66, y0: 12, x1: 88, y1: 30, cx: 77, cy: 21, music: 'belga' },
  { id: 'sofia',  name: '学院都市ソフィア', x0: 60, y0: 44, x1: 84, y1: 60, cx: 72, cy: 52, music: 'sofia' },
  { id: 'golan',  name: 'ゴラン村（廃墟）', x0: 68, y0: 33, x1: 82, y1: 41, cx: 75, cy: 37, music: 'omen', open: true },
];
const TOWN = TOWNS[0];
const CASTLE_POS = { x: 32, y: 12 }; // ルミナの町の奥のお城（2x2）
const START_POS = { x: 32, y: 24 };
const INN_FRONT = { x: 25, y: 22 };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeNoise(rng, cells) {
  const g = [];
  for (let i = 0; i < (cells + 2) * (cells + 2); i++) g.push(rng());
  const at = (x, y) => g[y * (cells + 2) + x];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => { // x,y in [0,1)
    const fx = x * cells, fy = y * cells;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

// かならず陸にしたい場所（中心と半径）
const LAND = [
  [32, 22, 19], [56, 16, 8], [28, 37, 7], [11, 24, 9], [50, 24, 8],
  [77, 21, 16], [84, 8, 7], [75, 37, 9], [72, 52, 15], [89, 51, 7], [62, 32, 6],
];

function genMap(seed = 20261022) {
  const rng = mulberry32(seed);
  const n1 = makeNoise(rng, 7), n2 = makeNoise(rng, 15), n3 = makeNoise(rng, 31);
  const veg = makeNoise(rng, 12);
  const map = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) {
      const u = x / MAP_W, v = y / MAP_H;
      let h = n1(u, v) * 0.55 + n2(u, v) * 0.3 + n3(u, v) * 0.15;
      const dx = (x - MAP_W / 2) / (MAP_W / 2), dy = (y - MAP_H / 2) / (MAP_H / 2);
      h = h + 0.16 - Math.pow(Math.max(Math.abs(dx), Math.abs(dy)), 4) * 0.6;
      let flat = 0;
      for (const [cx, cy, r] of LAND) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < r) { h = Math.max(h, 0.46 + 0.08 * (1 - d / r)); flat = Math.max(flat, 1 - d / r); }
      }
      let t;
      if (h < 0.36) t = T.WATER;
      else if (h < 0.4) t = T.SAND;
      else if (h > 0.72 && flat < 0.5) t = T.MOUNT;
      else {
        const vv = veg(u, v);
        if ((h > 0.64 || vv > 0.62) && flat < 0.6) t = T.FOREST;
        else t = rng() < 0.06 ? T.FLOWER : T.GRASS;
      }
      row.push(t);
    }
    map.push(row);
  }
  const setPath = (x, y) => {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return;
    map[y][x] = map[y][x] === T.WATER ? T.BRIDGE : T.PATH;
  };
  const road = (pts) => { // 2タイル幅の道を折れ線でひく
    for (let i = 0; i < pts.length - 1; i++) {
      let [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
      while (x0 !== x1 || y0 !== y1) {
        setPath(x0, y0); setPath(x0 + (y0 !== y1 ? 1 : 0), y0 + (x0 !== x1 ? 1 : 0));
        if (x0 !== x1) x0 += Math.sign(x1 - x0); else y0 += Math.sign(y1 - y0);
      }
      setPath(x0, y0); setPath(x0 + 1, y0 + 1);
    }
  };
  road([[8, 24], [19, 24]]);                       // ルミナ西
  road([[45, 24], [60, 24], [60, 21], [65, 21]]);  // ルミナ東 → ベルガ西門
  road([[32, 34], [32, 42]]);                      // ルミナ南
  road([[77, 31], [77, 38], [72, 38], [72, 43]]);  // ベルガ南 → ゴラン村 → ソフィア北
  road([[77, 4], [77, 11]]);                       // ベルガ北
  road([[77, 8], [84, 8]]);                        // → 鉱山
  road([[85, 52], [89, 52]]);                      // ソフィア東 → 塔
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) map[y][x] = T.WATER;
  }
  buildTownGround(map);
  buildWorldExtras(map);
  return map;
}

const rect = (map, x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) map[y][x] = t; };
function border(map, tw, t, gates) {
  for (let x = tw.x0; x <= tw.x1; x++) { map[tw.y0][x] = t; map[tw.y1][x] = t; }
  for (let y = tw.y0; y <= tw.y1; y++) { map[y][tw.x0] = t; map[y][tw.x1] = t; }
  for (const [x, y] of gates) map[y][x] = T.ROAD;
}

// 町の地面（道・広場・柵・花壇）
function buildTownGround(map) {
  // ルミナ
  const L = TOWNS[0];
  rect(map, L.x0, L.y0, L.x1, L.y1, T.TGRASS);
  border(map, L, T.FENCE, [[L.x0, 24], [L.x0, 25], [L.x1, 24], [L.x1, 25], [32, L.y1], [33, L.y1]]);
  rect(map, L.x0, 24, L.x1, 25, T.ROAD);
  rect(map, 32, 14, 33, L.y1, T.ROAD);
  rect(map, 29, 17, 36, 22, T.PAVE);
  rect(map, 23, 15, 42, 15, T.WALK);
  rect(map, 24, 30, 41, 30, T.WALK);
  rect(map, 25, 21, 25, 23, T.WALK);
  rect(map, 40, 21, 40, 23, T.WALK);
  rect(map, 24, 16, 24, 16, T.WALK); rect(map, 41, 16, 41, 16, T.WALK);
  for (const x of [22, 23, 26, 27]) map[21][x] = T.BED;
  for (const x of [38, 39, 41, 42]) map[21][x] = T.BED;
  for (const [x, y] of [[29, 17], [36, 17], [29, 22], [36, 22]]) map[y][x] = T.BED;
  // ベルガ（石の城壁と石だたみ）
  const B = TOWNS[1];
  rect(map, B.x0, B.y0, B.x1, B.y1, T.ROAD);
  border(map, B, T.CWALL, [[B.x0, 21], [B.x0, 22], [77, B.y0], [78, B.y0], [77, B.y1], [78, B.y1]]);
  rect(map, 73, 17, 81, 19, T.PAVE);
  for (const [x, y] of [[73, 17], [81, 17], [73, 19], [81, 19], [67, 18], [67, 19], [87, 18], [87, 19]]) map[y][x] = T.BED;
  // ソフィア（生け垣と芝生）
  const S = TOWNS[2];
  rect(map, S.x0, S.y0, S.x1, S.y1, T.TGRASS);
  border(map, S, T.HEDGE, [[72, S.y0], [73, S.y0], [S.x1, 52], [S.x1, 53]]);
  rect(map, 72, S.y0, 73, S.y1 - 1, T.ROAD);
  rect(map, S.x0 + 1, 52, S.x1, 53, T.ROAD);
  rect(map, 66, 51, 66, 51, T.WALK); rect(map, 78, 50, 78, 51, T.WALK);
  rect(map, 78, 54, 78, 54, T.WALK); rect(map, 64, 54, 64, 54, T.WALK);
  rect(map, 74, 47, 75, 50, T.PAVE);
  for (const [x, y] of [[61, 51], [61, 54], [83, 51], [83, 54], [70, 49], [70, 56]]) map[y][x] = T.BED;
  // ゴラン村（焼けあと）
  for (let y = 33; y <= 41; y++) for (let x = 68; x <= 82; x++) if (map[y][x] !== T.PATH) map[y][x] = T.GRASS;
  for (const [x, y] of [[70, 36], [71, 36], [72, 36], [80, 36], [81, 36], [69, 40], [70, 40], [81, 40], [80, 41]]) map[y][x] = T.ASH;
}

// 町・名所のオブジェクト（建物・木・街灯・看板など）。door は入口のタイル列（建物の左から何列目か）
const TOWN_OBJECTS = [
  // ルミナ
  { kind: 'building', id: 'inn',    x: 22, y: 17, w: 6, h: 4, door: 3, style: 'inn' },
  { kind: 'building', id: 'item',   x: 38, y: 17, w: 5, h: 4, door: 2, style: 'item' },
  { kind: 'building', id: 'weapon', x: 22, y: 26, w: 5, h: 4, door: 2, style: 'weapon' },
  { kind: 'building', id: 'armor',  x: 38, y: 26, w: 5, h: 4, door: 2, style: 'armor' },
  { kind: 'building', id: 'house1', x: 22, y: 12, w: 4, h: 3, door: 2, style: 'house1' },
  { kind: 'building', id: 'house2', x: 39, y: 12, w: 4, h: 3, door: 2, style: 'house2' },
  { kind: 'castle', id: 'castle', x: CASTLE_POS.x, y: CASTLE_POS.y, w: 2, h: 2, text: 'ルミナ城。\nいまは 門が かたく とじられている。' },
  { kind: 'fountain', x: 32, y: 19, w: 2, h: 2 },
  { kind: 'sign', x: 21, y: 23, text: '「ルミナの町」\nようこそ！ ゆっくりして いってね。' },
  { kind: 'sign', x: 43, y: 23, text: 'ひがし：商業都市ベルガ\nにし：ルミナの森' },
  { kind: 'sign', x: 31, y: 32, text: 'みなみ：岩山の洞くつ\n（つよい まものに ちゅうい）' },
  { kind: 'sign', x: 28, y: 20, text: '噴水広場\n「まちの ひとの いこいの場」' },
  { kind: 'mailbox', x: 26, y: 14, id: 'leonMailbox', text: 'レオンの いえの ポスト。\n…からっぽだ。' },
  { kind: 'mailbox', x: 38, y: 14, text: '占いの館の ポスト。\n「本日も 営業中。 鑑定 いっかい 無料」と はり紙が ある。' },
  { kind: 'bench', x: 30, y: 21, text: 'ベンチで ひとやすみ した。\n…HPは かいふくしなかった。' },
  { kind: 'bench', x: 35, y: 21, text: 'ベンチに だれかの わすれものの ぼうしが ある。' },
  ...[[21, 12], [28, 12], [29, 13], [36, 12], [37, 13], [43, 12], [21, 16], [43, 16], [21, 20], [43, 20],
      [28, 27], [29, 28], [36, 27], [35, 28], [21, 32], [43, 32], [27, 32], [38, 32], [21, 27], [43, 27]].map(([x, y]) => ({ kind: 'tree', x, y })),
  ...[[23, 23], [28, 23], [37, 23], [42, 23], [23, 26], [42, 26], [31, 26], [34, 26], [31, 16], [34, 16]].map(([x, y]) => ({ kind: 'lamp', x, y })),
  // ベルガ
  { kind: 'building', id: 'belgaInn',  x: 68, y: 13, w: 5, h: 4, door: 2, style: 'belgaInn' },
  { kind: 'building', id: 'belgaShop', x: 82, y: 13, w: 5, h: 4, door: 2, style: 'belgaShop' },
  { kind: 'building', id: 'belgaItem', x: 68, y: 24, w: 5, h: 4, door: 2, style: 'belgaItem' },
  { kind: 'building', id: 'mansion',   x: 80, y: 23, w: 7, h: 5, door: 3, style: 'mansion' },
  { kind: 'statue', x: 77, y: 17, w: 2, h: 2, text: '金ピカの ゴルドー像。\n「ベルガの 父 ゴルドー」と きざまれている。\n…だれかが はなに らくがきを している。' },
  { kind: 'stall', x: 74, y: 24, text: '果物の 屋台。\n「きょうの おすすめは 南国の マンゴー！」' },
  { kind: 'stall', x: 76, y: 26, text: '魚の 屋台。\n「港で とれた ばかりだよ！」' },
  { kind: 'sign', x: 67, y: 20, text: '「商業都市ベルガ」\n大陸いちの 市場へ ようこそ！' },
  { kind: 'sign', x: 79, y: 29, text: 'みなみ：ゴラン村、学院都市ソフィア\nきた：ゴルドー鉱山' },
  ...[[69, 19], [86, 22], [72, 29], [84, 29], [69, 29]].map(([x, y]) => ({ kind: 'tree', x, y })),
  ...[[71, 20], [75, 20], [80, 20], [84, 20], [75, 23], [80, 22]].map(([x, y]) => ({ kind: 'lamp', x, y })),
  // ソフィア
  { kind: 'building', id: 'academy',  x: 62, y: 46, w: 8, h: 5, door: 4, style: 'academy' },
  { kind: 'building', id: 'sofiaInn', x: 76, y: 46, w: 5, h: 4, door: 2, style: 'sofiaInn' },
  { kind: 'building', id: 'sofiaShop', x: 76, y: 55, w: 5, h: 4, door: 2, style: 'sofiaShop' },
  { kind: 'building', id: 'noaHouse', x: 63, y: 55, w: 4, h: 3, door: 1, style: 'noaHouse' },
  { kind: 'sign', x: 71, y: 45, text: '「学院都市ソフィア」\n知を もとめる 者に ひらかれた 町。' },
  { kind: 'sign', x: 83, y: 50, text: 'ひがし：蒼晶の塔\n（関係者以外 立ち入り禁止）' },
  { kind: 'bench', x: 74, y: 51, text: '学生が 読みかけの 本を わすれていった。\n『魔法理論 第7版』……むずかしそうだ。' },
  ...[[61, 45], [83, 45], [61, 59], [83, 59], [70, 45], [68, 58], [75, 59], [82, 57]].map(([x, y]) => ({ kind: 'tree', x, y })),
  ...[[71, 47], [74, 46], [71, 57], [74, 57], [69, 54], [76, 51]].map(([x, y]) => ({ kind: 'lamp', x, y })),
  // ゴラン村
  { kind: 'building', id: 'ruin1', x: 69, y: 34, w: 4, h: 2, door: 1, style: 'ruin' },
  { kind: 'building', id: 'ruin2', x: 79, y: 34, w: 4, h: 2, door: 1, style: 'ruin' },
  { kind: 'tent', x: 74, y: 40, text: '村の 生き残りが くらす テント。' },
  { kind: 'campfire', x: 75, y: 35, text: 'たき火が ぱちぱちと 燃えている。' },
  { kind: 'sign', x: 79, y: 39, id: 'golanSign', text: '「ゴラン村」\n……看板は 半分 焼けこげている。' },
  // 名所
  { kind: 'building', id: 'manor', x: 53, y: 14, w: 6, h: 4, door: 2, style: 'manor' },
  { kind: 'cave', id: 'cave', x: 27, y: 36, w: 2, h: 2, text: 'くらい 洞くつだ。\nおくから つめたい 風が ふいてくる…。' },
  { kind: 'cave', id: 'mine', x: 84, y: 6, w: 2, h: 2, text: 'ゴルドー鉱山の 入口。\n「関係者以外 立入禁止」の 札が かかっている。' },
  { kind: 'tower', id: 'tower', x: 88, y: 49, w: 2, h: 3, text: '蒼晶の塔。\nかたく 封印されていて 入れない。' },
  { kind: 'sign', x: 56, y: 19, text: 'アルディス家' },
  ...[[51, 13], [52, 16], [59, 13], [60, 16], [51, 19], [60, 19]].map(([x, y]) => ({ kind: 'tree', x, y })),
];

// 町の外の舞台の地面
function buildWorldExtras(map) {
  for (let x = 50; x <= 60; x++) for (let y = 12; y <= 20; y++) map[y][x] = T.GRASS; // 屋敷の敷地
  for (let y = 18; y <= 23; y++) map[y][55] = T.PATH;
  rect(map, 26, 35, 29, 35, T.MOUNT); rect(map, 25, 36, 26, 38, T.MOUNT); rect(map, 29, 36, 30, 37, T.MOUNT);
  for (let x = 27; x <= 31; x++) map[38][x] = T.PATH;                               // 洞くつへの道
  rect(map, 82, 4, 88, 5, T.MOUNT); rect(map, 82, 6, 83, 7, T.MOUNT); rect(map, 86, 6, 88, 7, T.MOUNT); // 鉱山の岩山
  rect(map, 84, 8, 85, 8, T.PATH);
  rect(map, 87, 48, 91, 48, T.GRASS); rect(map, 87, 49, 87, 51, T.GRASS); rect(map, 90, 49, 91, 51, T.GRASS);
  rect(map, 88, 52, 89, 53, T.PATH);
}

function townAt(x, y) { return TOWNS.find(t => x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1); }
function inTown(x, y) { const t = townAt(x, y); return !!t && !t.open; }

function isWalkable(t) {
  return t !== T.WATER && t !== T.MOUNT && t !== T.CASTLE && t !== T.FENCE && t !== T.BED && t !== T.IWALL && t !== T.ICOUNTER
    && t !== T.CWALL && t !== T.HEDGE && t !== T.DWALL && t !== T.DPIT;
}

if (typeof module !== 'undefined') module.exports = { genMap, T, MAP_W, MAP_H, CASTLE_POS, START_POS, isWalkable, TOWN_OBJECTS, TOWNS, TOWN, townAt };
