// フィールドマップ生成（暫定：シード固定のノイズ地形）
'use strict';

const T = { WATER: 0, SAND: 1, GRASS: 2, FLOWER: 3, FOREST: 4, MOUNT: 5, PATH: 6, CASTLE: 7, BRIDGE: 8 };
const MAP_W = 64, MAP_H = 48;
const CASTLE_POS = { x: 31, y: 21 }; // 城は 2x2 タイル（左上）
const START_POS = { x: 32, y: 24 };

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
  const cx = CASTLE_POS.x + 1, cy = CASTLE_POS.y + 1;
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
  // 城
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) map[CASTLE_POS.y + y][CASTLE_POS.x + x] = T.CASTLE;
  // 城門から南へのびる道と東西の道
  const setPath = (x, y) => {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return;
    const t = map[y][x];
    if (t === T.CASTLE) return;
    map[y][x] = t === T.WATER ? T.BRIDGE : T.PATH;
  };
  setPath(32, CASTLE_POS.y + 2);
  for (let x = 32 - 14; x <= 32 + 15; x++) setPath(x, CASTLE_POS.y + 3);
  // 外周は海
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) map[y][x] = T.WATER;
  }
  return map;
}

function isWalkable(t) { return t !== T.WATER && t !== T.MOUNT && t !== T.CASTLE; }

if (typeof module !== 'undefined') module.exports = { genMap, T, MAP_W, MAP_H, CASTLE_POS, START_POS, isWalkable };
