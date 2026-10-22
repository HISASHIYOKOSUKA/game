// フィールドマップ生成（暫定：シード固定のノイズ地形）
'use strict';

const T = { WATER: 0, SAND: 1, GRASS: 2, FLOWER: 3, FOREST: 4, MOUNT: 5, PATH: 6, CASTLE: 7, BRIDGE: 8,
  ROAD: 9, PAVE: 10, FENCE: 11, BED: 12, TGRASS: 13, WALK: 14 };
const MAP_W = 64, MAP_H = 48;
// ルミナの町（柵で囲まれた範囲）
const TOWN = { name: 'ルミナの町', x0: 20, y0: 11, x1: 44, y1: 33, cx: 32, cy: 22 };
const CASTLE_POS = { x: 32, y: 12 }; // 町の奥のお城（2x2）
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

function genMap(seed = 20261022) {
  const rng = mulberry32(seed);
  const n1 = makeNoise(rng, 5), n2 = makeNoise(rng, 11), n3 = makeNoise(rng, 23);
  const veg = makeNoise(rng, 9);
  const map = [];
  const cx = TOWN.cx, cy = TOWN.cy;
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) {
      const u = x / MAP_W, v = y / MAP_H;
      let h = n1(u, v) * 0.55 + n2(u, v) * 0.3 + n3(u, v) * 0.15;
      const dx = (x - MAP_W / 2) / (MAP_W / 2), dy = (y - MAP_H / 2) / (MAP_H / 2);
      const edge = Math.max(Math.abs(dx), Math.abs(dy));
      h = h + 0.18 - Math.pow(edge, 3) * 0.55;
      const dc = Math.hypot(x - cx, y - cy);
      if (dc < 7) h = Math.max(h, 0.5 - dc * 0.005); // 城のまわりは平地に
      let t;
      if (h < 0.36) t = T.WATER;
      else if (h < 0.4) t = T.SAND;
      else if (h > 0.72) t = T.MOUNT;
      else {
        const vv = veg(u, v);
        if (h > 0.64 || vv > 0.62) t = T.FOREST;
        else t = rng() < 0.06 ? T.FLOWER : T.GRASS;
      }
      if (dc < 4.5 && (t === T.FOREST || t === T.MOUNT || t === T.WATER || t === T.SAND)) t = T.GRASS;
      row.push(t);
    }
    map.push(row);
  }
  // 町の外へのびる道
  const setPath = (x, y) => {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return;
    map[y][x] = map[y][x] === T.WATER ? T.BRIDGE : T.PATH;
  };
  for (let x = 8; x < TOWN.x0; x++) { setPath(x, 24); setPath(x, 25); }
  for (let x = TOWN.x1 + 1; x <= 57; x++) { setPath(x, 24); setPath(x, 25); }
  for (let y = TOWN.y1 + 1; y <= 42; y++) { setPath(32, y); setPath(33, y); }
  // 外周は海
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) map[y][x] = T.WATER;
  }
  buildTownGround(map);
  buildWorldExtras(map);
  return map;
}

// 町の地面（道・広場・柵・花壇）
function buildTownGround(map) {
  const set = (x, y, t) => { map[y][x] = t; };
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  rect(TOWN.x0, TOWN.y0, TOWN.x1, TOWN.y1, T.TGRASS);
  for (let x = TOWN.x0; x <= TOWN.x1; x++) { set(x, TOWN.y0, T.FENCE); set(x, TOWN.y1, T.FENCE); }
  for (let y = TOWN.y0; y <= TOWN.y1; y++) { set(TOWN.x0, y, T.FENCE); set(TOWN.x1, y, T.FENCE); }
  rect(TOWN.x0, 24, TOWN.x1, 25, T.ROAD);           // 東西の大通り
  rect(32, 14, 33, TOWN.y1, T.ROAD);                 // 南北の通り
  rect(29, 17, 36, 22, T.PAVE);                      // 噴水広場
  rect(23, 15, 42, 15, T.WALK);                      // 北の小道
  rect(24, 30, 41, 30, T.WALK);                      // 南の小道
  rect(25, 21, 25, 23, T.WALK);                      // 宿屋の前
  rect(40, 21, 40, 23, T.WALK);                      // 道具屋の前
  rect(24, 16, 24, 16, T.WALK); rect(41, 16, 41, 16, T.WALK);
  for (const x of [22, 23, 26, 27]) set(x, 21, T.BED);
  for (const x of [38, 39, 41, 42]) set(x, 21, T.BED);
  for (const [x, y] of [[29, 17], [36, 17], [29, 22], [36, 22]]) set(x, y, T.BED);
}

// 町のオブジェクト（建物・木・街灯・看板など）。door は入口タイル
const TOWN_OBJECTS = [
  { kind: 'building', id: 'inn',    x: 22, y: 17, w: 6, h: 4, door: 3, style: 'inn' },
  { kind: 'building', id: 'item',   x: 38, y: 17, w: 5, h: 4, door: 2, style: 'item' },
  { kind: 'building', id: 'weapon', x: 22, y: 26, w: 5, h: 4, door: 2, style: 'weapon' },
  { kind: 'building', id: 'armor',  x: 38, y: 26, w: 5, h: 4, door: 2, style: 'armor' },
  { kind: 'building', id: 'house1', x: 22, y: 12, w: 4, h: 3, door: 2, style: 'house1' },
  { kind: 'building', id: 'house2', x: 39, y: 12, w: 4, h: 3, door: 2, style: 'house2' },
  { kind: 'castle', x: CASTLE_POS.x, y: CASTLE_POS.y, w: 2, h: 2 },
  { kind: 'fountain', x: 32, y: 19, w: 2, h: 2 },
  { kind: 'sign', x: 21, y: 23, text: '「ルミナの町」\nようこそ！ ゆっくりして いってね。' },
  { kind: 'sign', x: 43, y: 23, text: 'ひがし：はてしない 草原\nにし：ルミナの森' },
  { kind: 'sign', x: 31, y: 32, text: 'みなみ：辺境の地\n（つよい まものに ちゅうい）' },
  { kind: 'sign', x: 28, y: 20, text: '噴水広場\n「まちの ひとの いこいの場」' },
  { kind: 'mailbox', x: 26, y: 14, text: 'レオンの いえの ポスト。\n…からっぽだ。' },
  { kind: 'mailbox', x: 38, y: 14, text: '占いの館の ポスト。\n「本日も 営業中。 鑑定 いっかい 無料」と はり紙が ある。' },
  { kind: 'bench', x: 30, y: 21, text: 'ベンチで ひとやすみ した。\n…HPは かいふくしなかった。' },
  { kind: 'bench', x: 35, y: 21, text: 'ベンチに だれかの わすれものの ぼうしが ある。' },
  ...[[21, 12], [28, 12], [29, 13], [36, 12], [37, 13], [43, 12], [21, 16], [43, 16], [21, 20], [43, 20],
      [28, 27], [29, 28], [36, 27], [35, 28], [21, 32], [43, 32], [27, 32], [38, 32], [21, 27], [43, 27]].map(([x, y]) => ({ kind: 'tree', x, y })),
  ...[[23, 23], [28, 23], [37, 23], [42, 23], [23, 26], [42, 26], [31, 26], [34, 26], [31, 16], [34, 16]].map(([x, y]) => ({ kind: 'lamp', x, y })),
];

// 町の外の舞台（アルディス家の屋敷、南の洞くつ）
function buildWorldExtras(map) {
  for (let x = 50; x <= 60; x++) for (let y = 12; y <= 20; y++) map[y][x] = T.GRASS; // 屋敷の敷地
  for (let y = 18; y <= 23; y++) map[y][55] = T.PATH;
  for (let x = 27; x <= 31; x++) map[38][x] = T.PATH;                               // 洞くつへの道
}
TOWN_OBJECTS.push(
  { kind: 'building', id: 'manor', x: 53, y: 14, w: 6, h: 4, door: 2, style: 'manor' },
  { kind: 'cave', id: 'cave', x: 27, y: 36, w: 2, h: 2, text: 'くらい 洞くつだ。\nおくから つめたい 風が ふいてくる…。' },
  { kind: 'sign', x: 56, y: 19, text: 'アルディス家' },
  ...[[51, 13], [52, 16], [59, 13], [60, 16], [51, 19], [60, 19]].map(([x, y]) => ({ kind: 'tree', x, y })),
);

function inTown(x, y) { return x >= TOWN.x0 && x <= TOWN.x1 && y >= TOWN.y0 && y <= TOWN.y1; }

function isWalkable(t) { return t !== T.WATER && t !== T.MOUNT && t !== T.CASTLE && t !== T.FENCE && t !== T.BED; }

if (typeof module !== 'undefined') module.exports = { genMap, T, MAP_W, MAP_H, CASTLE_POS, START_POS, isWalkable, TOWN_OBJECTS, TOWN };
