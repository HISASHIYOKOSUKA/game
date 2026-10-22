// 建物の中（間取り・家具・床と壁のタイル）
'use strict';

// 間取りの記号
//  # かべ  . ゆか  , じゅうたん  D でぐち  C カウンター
//  b ベッド  s たな  w 武器かけ  a よろい台  p はちうえ  t テーブル  f だんろ
//  x たる  B 本だな  r 水晶の台（むこうの人と話せる）  k 店主などの立ち位置（ゆか）
const INTERIORS = {
  inn: {
    name: '宿屋 ひだまり亭', floor: 'wood', wall: '#f4e2b8', rug: '#c84a48',
    layout: [
      '#############',
      '#############',
      '#b.b.b..skp.#',
      '#.......CCC.#',
      '#...........#',
      '#b.b.b..,,,.#',
      '#p......,,,x#',
      '######D######',
    ],
    npcs: [
      { id: 'innkeeper', sprite: 'innkeeper', role: 'inn' },
      { id: 'innguest', sprite: 'traveler', x: 4, y: 4, dir: 'right', lines: ['ここの シチューは ルミナいちだ。\nまいばん ぜったい おかわりする。'] },
    ],
  },
  weapon: {
    name: '武器屋 アイアンハート', floor: 'stone', wall: '#d8cfc0', rug: '#7a4a3a',
    layout: [
      '###########',
      '###########',
      '#w.w.k.w.w#',
      '#..CCCCC..#',
      '#.........#',
      '#x.,,,,,.x#',
      '#..,,,,,..#',
      '#####D#####',
    ],
    npcs: [{ id: 'gantz', sprite: 'gantz', role: 'shop', shop: 'weapon' }],
  },
  armor: {
    name: '防具屋 まもりの盾', floor: 'wood', wall: '#d8e4f4', rug: '#4a6ab8',
    layout: [
      '###########',
      '###########',
      '#a.a.k.a.a#',
      '#..CCCCC..#',
      '#.........#',
      '#p.,,,,,.p#',
      '#..,,,,,..#',
      '#####D#####',
    ],
    npcs: [{ id: 'marie', sprite: 'marie', role: 'shop', shop: 'armor' }],
  },
  item: {
    name: 'なんでも屋 ポップ', floor: 'wood', wall: '#d8f0dc', rug: '#e0a030',
    layout: [
      '###########',
      '###########',
      '#s.s.k.s.s#',
      '#..CCCCC..#',
      '#.........#',
      '#x.,,,,,.x#',
      '#p.,,,,,.x#',
      '#####D#####',
    ],
    npcs: [{ id: 'pop', sprite: 'pop', role: 'shop', shop: 'item' }],
  },
  house1: {
    name: 'レオンの家', floor: 'wood', wall: '#fbe4e8', rug: '#8a6ad0',
    layout: [
      '#########',
      '#########',
      '#B.f..b.#',
      '#.......#',
      '#.tt....#',
      '#.tt..p.#',
      '####D####',
    ],
    npcs: [{ id: 'mom', sprite: 'mom', x: 5, y: 3, dir: 'down', role: 'talk' }],
  },
  house2: {
    name: '占いの館', floor: 'purple', wall: '#5a4878', rug: '#2a1a4a',
    layout: [
      '#########',
      '#########',
      '#B..k..B#',
      '#...r...#',
      '#.,,,,,.#',
      '#p,,,,,p#',
      '####D####',
    ],
    npcs: [{ id: 'baba', sprite: 'baba', role: 'talk' }],
  },
};

const FURNITURE_KEYS = { b: 'bed', s: 'shelf', w: 'weaponrack', a: 'armorstand', p: 'plant', t: 'table', f: 'fireplace', x: 'barrel', B: 'bookshelf', r: 'crystal' };

// ---------- 床・壁のタイル ----------
function drawInteriorTile(c, type, variant, st) {
  if (type === T.IFLOOR || type === T.IMAT || type === T.IRUG || type === T.ICOUNTER) {
    if (st.floor === 'wood') {
      box(c, 0, 0, 32, 32, '#c89a64');
      for (let y = 0; y < 32; y += 8) { box(c, 0, y, 32, 1, '#a87a48'); box(c, ((y / 8) % 2) * 16 + 4, y + 1, 1, 7, '#a87a48'); box(c, 0, y + 1, 32, 1, '#dcb07c'); }
    } else if (st.floor === 'stone') {
      box(c, 0, 0, 32, 32, '#b8b0a4');
      for (let y = 0; y < 32; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < 32; x += 16) { box(c, x + 1, y + 1, 14, 14, '#ccc4b8'); box(c, x + 1, y + 1, 14, 1, '#ddd6cc'); }
    } else { // purple
      box(c, 0, 0, 32, 32, '#3a2a58');
      for (let y = 0; y < 32; y += 8) for (let x = ((y / 8) % 2) * 8; x < 32; x += 16) box(c, x + 3, y + 3, 2, 2, '#5a4a80');
    }
  }
  if (type === T.IRUG) {
    box(c, 0, 0, 32, 32, st.rug);
    box(c, 0, 0, 32, 2, '#00000033'); box(c, 3, 3, 26, 26, '#ffffff22');
    for (let y = 6; y < 28; y += 8) for (let x = 6 + ((y / 8) % 2) * 4; x < 28; x += 8) box(c, x, y, 2, 2, '#ffe8a0aa');
  }
  if (type === T.IMAT) { // 出口のマット
    box(c, 4, 6, 24, 20, OUT); box(c, 5, 7, 22, 18, '#7a9a4a');
    for (let x = 7; x < 26; x += 3) box(c, x, 8, 1, 16, '#5a7a34');
    box(c, 13, 26, 6, 4, '#ffd75e'); box(c, 14, 30, 4, 2, '#ffd75e'); // ↓
  }
  if (type === T.ICOUNTER) {
    box(c, 0, 4, 32, 28, OUT);
    box(c, 0, 5, 32, 10, '#e0b070'); box(c, 0, 5, 32, 2, '#f4d098');
    box(c, 0, 15, 32, 16, '#9a6034'); box(c, 0, 15, 32, 1, OUT);
    for (let x = 4; x < 32; x += 10) box(c, x, 18, 6, 10, '#b07040');
  }
  if (type === T.IWALL) {
    if (variant === 'face') {
      box(c, 0, 0, 32, 32, st.wall);
      for (let x = 2; x < 32; x += 8) box(c, x, 0, 1, 26, '#00000014'); // 壁紙のすじ
      box(c, 0, 0, 32, 3, '#00000030');
      box(c, 0, 24, 32, 8, '#8a5a34'); box(c, 0, 24, 32, 1, OUT); box(c, 0, 25, 32, 1, '#b07a4a');
    } else {
      box(c, 0, 0, 32, 32, '#1a1420');
      box(c, 0, 0, 32, 1, '#2a2230');
    }
  }
}

// ---------- 家具 ----------
function makeFurnitureSprite(kind, seed) {
  const r = mulberry32(seed);
  let cv, c;
  const mk = (w, h) => { cv = newCanvas(w, h); c = cv.getContext('2d'); };
  switch (kind) {
    case 'bed':
      mk(32, 44);
      oRect(c, 3, 2, 26, 40, '#8a5a30'); oRect(c, 5, 4, 22, 10, '#ffffff'); box(c, 6, 5, 20, 3, '#f0f0f8');
      oRect(c, 5, 14, 22, 26, '#d8584a'); box(c, 6, 15, 20, 3, '#f08070');
      for (let y = 20; y < 38; y += 6) box(c, 6, y, 20, 1, '#b04038');
      break;
    case 'shelf': case 'bookshelf':
      mk(32, 52);
      oRect(c, 2, 2, 28, 48, '#8a5a30'); box(c, 3, 3, 26, 2, '#b07a4a');
      for (let y = 14; y < 50; y += 12) box(c, 3, y, 26, 2, '#5a3a20');
      for (let row = 0; row < 3; row++) for (let x = 5; x < 27; x += kind === 'bookshelf' ? 3 : 6) {
        const y = 6 + row * 12;
        if (kind === 'bookshelf') box(c, x, y + 1, 2, 7, ['#c84848', '#4868c8', '#48a868', '#e0b040'][Math.floor(r() * 4)]);
        else { const col = ['#e84858', '#48a8e8', '#58c868', '#f0c040'][Math.floor(r() * 4)]; box(c, x + 1, y + 2, 4, 6, OUT); box(c, x + 2, y + 3, 2, 4, col); box(c, x + 2, y + 1, 2, 1, '#a8703c'); }
      }
      break;
    case 'weaponrack':
      mk(32, 52);
      oRect(c, 2, 14, 28, 6, '#8a5a30'); oRect(c, 2, 40, 28, 6, '#8a5a30');
      oRect(c, 4, 10, 3, 40, '#6a4020'); oRect(c, 25, 10, 3, 40, '#6a4020');
      for (const [x, col] of [[10, '#e8eef8'], [16, '#d8c070'], [22, '#e8eef8']]) { box(c, x, 4, 3, 36, OUT); box(c, x + 1, 5, 1, 34, col); box(c, x - 2, 30, 7, 2, '#a8703c'); }
      break;
    case 'armorstand':
      mk(32, 52);
      oRect(c, 14, 38, 4, 12, '#6a4020'); oRect(c, 8, 47, 16, 4, '#6a4020');
      oRect(c, 8, 14, 16, 22, '#a8b0c8'); box(c, 9, 15, 14, 4, '#d8e0f0'); box(c, 15, 15, 2, 20, '#8890a8');
      oRect(c, 10, 2, 12, 12, '#a8b0c8'); box(c, 12, 7, 8, 2, OUT);
      oRect(c, 2, 16, 6, 10, '#a8b0c8'); oRect(c, 24, 16, 6, 10, '#a8b0c8');
      break;
    case 'plant':
      mk(32, 40);
      oRect(c, 9, 28, 14, 11, '#c0584a'); box(c, 10, 29, 12, 2, '#e07a6a');
      c.fillStyle = OUT; for (const [x, y, rr] of [[16, 16, 9], [10, 20, 6], [22, 20, 6]]) { c.beginPath(); c.arc(x, y, rr + 1, 0, 7); c.fill(); }
      c.fillStyle = '#4ca048'; for (const [x, y, rr] of [[16, 16, 9], [10, 20, 6], [22, 20, 6]]) { c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); }
      c.fillStyle = '#78c858'; c.beginPath(); c.arc(14, 13, 4, 0, 7); c.fill();
      break;
    case 'table':
      mk(32, 30);
      oRect(c, 0, 4, 32, 16, '#b07a4a'); box(c, 1, 5, 30, 3, '#d09a64');
      oRect(c, 3, 19, 4, 10, '#6a4020'); oRect(c, 25, 19, 4, 10, '#6a4020');
      if (seed % 2) { oRect(c, 10, 0, 8, 7, '#ffffff'); box(c, 12, 2, 4, 3, '#e8b040'); }
      break;
    case 'fireplace':
      mk(32, 52);
      oRect(c, 0, 8, 32, 44, '#a8a0a8'); for (let y = 12; y < 50; y += 6) box(c, 1, y, 30, 1, '#8a8290');
      box(c, 6, 26, 20, 22, OUT); box(c, 7, 27, 18, 21, '#2a1a10');
      box(c, 10, 38, 12, 8, '#ff8a2a'); box(c, 12, 34, 8, 8, '#ffd040'); box(c, 14, 31, 4, 6, '#fff0a0');
      oRect(c, -1, 4, 34, 6, '#8a5a30');
      break;
    case 'barrel':
      mk(32, 34);
      oRect(c, 6, 4, 20, 28, '#a8703c'); box(c, 7, 5, 18, 3, '#c89060');
      box(c, 6, 10, 20, 2, OUT); box(c, 6, 24, 20, 2, OUT);
      for (let x = 10; x < 26; x += 5) box(c, x, 12, 1, 12, '#8a5a30');
      break;
    case 'crystal':
      mk(32, 40);
      oRect(c, 2, 20, 28, 14, '#5a2a6a'); box(c, 3, 21, 26, 3, '#8a4a9a');
      oRect(c, 6, 33, 4, 6, '#3a1a4a'); oRect(c, 22, 33, 4, 6, '#3a1a4a');
      c.fillStyle = OUT; c.beginPath(); c.arc(16, 13, 9, 0, 7); c.fill();
      const g = c.createRadialGradient(13, 10, 1, 16, 13, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#c8a0ff'); g.addColorStop(1, '#6a3ab8');
      c.fillStyle = g; c.beginPath(); c.arc(16, 13, 8, 0, 7); c.fill();
      oRect(c, 10, 19, 12, 4, '#d8b040');
      break;
  }
  return cv;
}

// 間取りから建物の中のエリアを作る
function buildInterior(id) {
  const d = INTERIORS[id];
  const h = d.layout.length, w = d.layout[0].length;
  const map = [], objects = [], npcs = [];
  let exit = null, keeper = null;
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = d.layout[y][x];
      let t = T.IFLOOR;
      if (ch === '#') t = T.IWALL;
      else if (ch === ',') t = T.IRUG;
      else if (ch === 'D') { t = T.IMAT; exit = { x, y }; }
      else if (ch === 'C') t = T.ICOUNTER;
      else if (ch === 'k') keeper = { x, y };
      if (FURNITURE_KEYS[ch]) {
        const kind = FURNITURE_KEYS[ch];
        objects.push({ kind: 'furniture', furn: kind, x, y, w: 1, h: 1, counter: kind === 'crystal', sprite: makeFurnitureSprite(kind, x * 7 + y * 13) });
      }
      row.push(t);
    }
    map.push(row);
  }
  for (const n of d.npcs) {
    const pos = n.x !== undefined ? { x: n.x, y: n.y } : keeper;
    npcs.push(Object.assign({ dir: 'down' }, n, pos));
  }
  return { id, name: d.name, interior: true, style: d, map, w, h, objects, npcs, exit };
}
