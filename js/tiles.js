// フィールドのタイル描画
'use strict';

// ============================================================
// タイル描画（手続き生成のドット絵）
// ============================================================
const TILE = 32;
const tileCache = {};
function tileRng(seed) { return mulberry32(seed * 9973 + 17); }

function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

// MOTHER 風：規則的な草の模様、太い輪郭、明るい色
function drawGrassBase(c, r, town) {
  px(c, 0, 0, 32, 32, town ? '#9cd874' : '#86c862');
  const d = town ? '#7cc05a' : '#68ae4a', l = town ? '#bcec94' : '#a8e080';
  for (let y = 3, row = 0; y < 32; y += 8, row++) {
    for (let x = (row % 2) * 8 + 2; x < 32; x += 16) {
      px(c, x, y, 1, 2, d); px(c, x + 2, y - 1, 1, 3, d); px(c, x + 4, y, 1, 2, d); px(c, x + 2, y - 2, 1, 1, l);
    }
  }
}
function drawTree(c, cx, by, s) {
  px(c, cx - 2, by - 7 * s, 4, 7 * s, OUT); px(c, cx - 1, by - 7 * s, 2, 6 * s, '#8a5a30');
  const blobs = [[0, -11, 8], [-5, -8, 5.5], [5, -8, 5.5], [0, -15, 5.5]];
  c.fillStyle = OUT; blobs.forEach(([x, y, rr]) => { c.beginPath(); c.arc(cx + x * s, by + y * s, rr * s + 1, 0, 7); c.fill(); });
  c.fillStyle = '#3e9048'; blobs.forEach(([x, y, rr]) => { c.beginPath(); c.arc(cx + x * s, by + y * s, rr * s, 0, 7); c.fill(); });
  c.fillStyle = '#5cb45c'; blobs.forEach(([x, y, rr]) => { c.beginPath(); c.arc(cx + x * s - 1, by + y * s - 1.5, rr * s * 0.65, 0, 7); c.fill(); });
  c.fillStyle = '#88d478'; c.beginPath(); c.arc(cx - 2 * s, by - 14 * s, 2 * s, 0, 7); c.fill();
}
function makeTile(type, variant, frame, style) {
  const key = type + ':' + variant + ':' + frame + ':' + (style || '');
  if (tileCache[key]) return tileCache[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
  const c = cv.getContext('2d');
  if (style && style.startsWith('d:')) { drawDungeonTile(c, type, variant, DUNGEON_STYLES[style.slice(2)], frame); tileCache[key] = cv; return cv; }
  if (type >= T.IFLOOR) { drawInteriorTile(c, type, variant, INTERIORS[style]); tileCache[key] = cv; return cv; }
  const r = tileRng(type * 31 + variant * 7 + 1);
  switch (type) {
    case T.GRASS: case T.CASTLE: drawGrassBase(c, r, false); break;
    case T.TGRASS: drawGrassBase(c, r, true); break;
    case T.FLOWER: {
      drawGrassBase(c, r, false);
      const cols = ['#ffffff', '#ffe066', '#ff8fb8'];
      for (const [x, y] of [[6, 8], [20, 6], [12, 20], [26, 22]]) {
        const col = cols[(x + y + variant) % 3];
        px(c, x, y - 1, 1, 1, col); px(c, x - 1, y, 3, 1, col); px(c, x, y + 1, 1, 1, col); px(c, x, y, 1, 1, '#e09a20');
      }
      break;
    }
    case T.SAND: {
      px(c, 0, 0, 32, 32, '#f0dca0');
      for (let y = 4, row = 0; y < 32; y += 8, row++) for (let x = (row % 2) * 8 + 3; x < 32; x += 16) { px(c, x, y, 2, 1, '#dcc484'); px(c, x + 4, y + 2, 1, 1, '#fff0c8'); }
      break;
    }
    case T.PATH: {
      px(c, 0, 0, 32, 32, '#e6cc90');
      for (let y = 4, row = 0; y < 32; y += 7, row++) for (let x = (row % 2) * 6 + 2; x < 32; x += 12) { px(c, x, y, 2, 1, '#cbae70'); px(c, x + 5, y + 3, 1, 1, '#f6e2b0'); }
      break;
    }
    case T.ROAD: { // 石だたみの通り
      px(c, 0, 0, 32, 32, '#b8b0a8');
      for (let y = 0, row = 0; y < 32; y += 8, row++) {
        for (let x = (row % 2) ? -6 : 0; x < 32; x += 12) {
          px(c, x + 1, y + 1, 10, 6, '#dcd6cc'); px(c, x + 1, y + 1, 10, 1, '#ece8e0'); px(c, x + 1, y + 6, 10, 1, '#c8c0b4');
        }
      }
      break;
    }
    case T.PAVE: { // 広場のレンガ
      px(c, 0, 0, 32, 32, '#c88e6a');
      for (let y = 0, row = 0; y < 32; y += 6, row++) for (let x = (row % 2) ? -5 : 0; x < 32; x += 10) {
        px(c, x + 1, y + 1, 8, 4, (row + x) % 3 ? '#f0c098' : '#e8b088'); px(c, x + 1, y + 1, 8, 1, '#ffd8b4');
      }
      break;
    }
    case T.WALK: { // 草の中の飛び石
      drawGrassBase(c, r, true);
      for (const [x, y] of [[4, 4], [17, 12], [5, 20]]) {
        c.fillStyle = OUT; c.beginPath(); c.ellipse(x + 6, y + 4, 7, 4.5, 0, 0, 7); c.fill();
        c.fillStyle = '#d8d2c8'; c.beginPath(); c.ellipse(x + 6, y + 4, 6, 3.5, 0, 0, 7); c.fill();
        px(c, x + 3, y + 2, 4, 1, '#f4f0e8');
      }
      break;
    }
    case T.FENCE: { // 白い柵。variant 0=横, 1=縦
      drawGrassBase(c, r, true);
      if (variant === 0) {
        px(c, 0, 13, 32, 4, OUT); px(c, 0, 14, 32, 2, '#f8f8f0');
        px(c, 0, 21, 32, 4, OUT); px(c, 0, 22, 32, 2, '#f8f8f0');
        for (let x = 1; x < 32; x += 8) {
          px(c, x, 7, 5, 21, OUT); px(c, x + 1, 8, 3, 19, '#ffffff'); px(c, x + 3, 9, 1, 17, '#d8d8e0');
          px(c, x + 2, 6, 1, 1, OUT);
        }
        px(c, 0, 28, 32, 2, 'rgba(0,0,0,0.15)');
      } else {
        px(c, 13, 0, 6, 32, OUT); px(c, 14, 0, 4, 32, '#f8f8f0'); px(c, 17, 0, 1, 32, '#d8d8e0');
        for (let y = 2; y < 32; y += 10) { px(c, 11, y, 10, 6, OUT); px(c, 12, y + 1, 8, 4, '#ffffff'); }
      }
      break;
    }
    case T.BED: { // 花壇
      drawGrassBase(c, r, true);
      px(c, 1, 8, 30, 22, OUT); px(c, 2, 9, 28, 20, '#c08850'); px(c, 4, 11, 24, 16, '#7a5232');
      const cols = [['#ff6080', '#ffffff'], ['#ffd84a', '#ff9a30'], ['#a080ff', '#ffffff']][variant % 3];
      for (let y = 13; y < 26; y += 6) for (let x = 6 + ((y / 6) % 2) * 3; x < 26; x += 6) {
        px(c, x, y + 2, 1, 3, '#3e9048'); px(c, x - 1, y, 3, 3, cols[0]); px(c, x, y + 1, 1, 1, cols[1]);
      }
      break;
    }
    case T.WATER: case T.BRIDGE: {
      px(c, 0, 0, 32, 32, '#5aa8f0');
      const off = frame * 3;
      for (let y = 4, row = 0; y < 32; y += 8, row++) for (let x = (row % 2) * 8 + off; x < 40; x += 16) {
        px(c, (x % 32), y, 5, 1, '#a8d8ff'); px(c, ((x + 5) % 32), y - 1, 2, 1, '#e0f4ff');
      }
      if (type === T.BRIDGE) {
        px(c, 3, 0, 26, 32, OUT); px(c, 4, 0, 24, 32, '#c08850');
        for (let y = 0; y < 32; y += 6) { px(c, 4, y, 24, 5, '#d8a068'); px(c, 4, y + 5, 24, 1, '#8a5a30'); }
      }
      break;
    }
    case T.FOREST: {
      drawGrassBase(c, r, false);
      if (variant % 2) { drawTree(c, 9, 31, 0.85); drawTree(c, 23, 27, 0.9); }
      else { drawTree(c, 22, 31, 0.85); drawTree(c, 10, 26, 0.9); }
      break;
    }
    case T.CWALL: { // ベルガの石の町壁。variant 0=横, 1=縦
      px(c, 0, 0, 32, 32, '#b8b0a8');
      px(c, 0, 4, 32, 26, OUT); px(c, 1, 5, 30, 24, '#d0c8bc');
      for (let y = 6, row = 0; y < 28; y += 6, row++) for (let x = (row % 2) ? -4 : 1; x < 31; x += 9) { px(c, x + 1, y, 7, 4, '#e4ded2'); px(c, x + 1, y + 4, 7, 1, '#a49c90'); }
      px(c, 0, 2, 32, 4, OUT); px(c, 1, 3, 30, 2, '#ece6da');
      if (variant === 0) for (let x = 2; x < 32; x += 10) { px(c, x, 0, 6, 4, OUT); px(c, x + 1, 1, 4, 3, '#ece6da'); }
      px(c, 0, 29, 32, 3, 'rgba(0,0,0,0.25)');
      break;
    }
    case T.HEDGE: { // ソフィアの生け垣
      drawGrassBase(c, r, true);
      c.fillStyle = OUT; c.beginPath(); c.roundRect(1, 6, 30, 24, 8); c.fill();
      c.fillStyle = '#3e9048'; c.beginPath(); c.roundRect(2, 7, 28, 22, 7); c.fill();
      c.fillStyle = '#5cb45c';
      for (const [x, y] of [[8, 12], [18, 11], [26, 14], [12, 20], [23, 22]]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
      c.fillStyle = '#88d478'; for (const [x, y] of [[7, 10], [17, 9], [11, 18]]) px(c, x, y, 2, 2, '#88d478');
      if (variant % 2) { px(c, 6, 15, 2, 2, '#ff8fb8'); px(c, 22, 19, 2, 2, '#ffffff'); }
      break;
    }
    case T.ASH: { // 焼けあと
      px(c, 0, 0, 32, 32, '#6a625c');
      for (const [x, y] of [[5, 6], [18, 4], [11, 17], [24, 20], [6, 26]]) { px(c, x, y, 4, 2, '#4a4440'); px(c, x + 1, y - 1, 2, 1, '#8a827a'); }
      px(c, 14, 10, 8, 2, '#2a2420'); px(c, 15, 9, 2, 1, '#2a2420');
      if (variant % 2) { px(c, 20, 26, 2, 1, '#ff8040'); }
      break;
    }
    case T.MOUNT: { // 岩山
      drawGrassBase(c, r, false);
      const peak = 10 + (variant % 3) * 5;
      c.fillStyle = OUT; c.beginPath(); c.moveTo(0, 31); c.lineTo(3, 18); c.lineTo(peak, 2); c.lineTo(28, 14); c.lineTo(32, 31); c.fill();
      c.fillStyle = '#c4a47c'; c.beginPath(); c.moveTo(2, 30); c.lineTo(5, 18); c.lineTo(peak, 4); c.lineTo(26, 15); c.lineTo(30, 30); c.fill();
      c.fillStyle = '#9a7c58'; c.beginPath(); c.moveTo(peak, 4); c.lineTo(26, 15); c.lineTo(30, 30); c.lineTo(peak + 3, 30); c.fill();
      c.fillStyle = '#e4cca4'; c.beginPath(); c.moveTo(peak, 4); c.lineTo(5, 18); c.lineTo(peak - 2, 14); c.fill();
      px(c, peak - 4, 20, 5, 1, '#8a6a48'); px(c, peak + 4, 23, 4, 1, '#7a5a3a');
      break;
    }
  }
  tileCache[key] = cv;
  return cv;
}

let castleSprite = null;
function makeCastle() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 76;
  const c = cv.getContext('2d');
  const stone = '#b9bccb', dark = '#7c8096', line = '#3a3c4c', roof = '#3556b8', roofD = '#24408c';
  // 城壁
  px(c, 4, 40, 56, 34, line); px(c, 5, 41, 54, 32, stone);
  for (let y = 44; y < 72; y += 5) for (let x = 6 + ((y / 5) % 2) * 3; x < 58; x += 7) px(c, x, y, 5, 1, dark);
  for (let x = 5; x < 59; x += 6) px(c, x, 37, 4, 4, stone), px(c, x, 36, 4, 1, line);
  // 塔
  const tower = (x, w, top) => {
    px(c, x - 1, top, w + 2, 74 - top, line); px(c, x, top + 1, w, 72 - top, stone);
    px(c, x + w - 3, top + 1, 3, 72 - top, dark);
    px(c, x + Math.floor(w / 2) - 1, top + 8, 2, 4, line);
    c.fillStyle = line; c.beginPath(); c.moveTo(x - 3, top + 1); c.lineTo(x + w / 2, top - 16); c.lineTo(x + w + 3, top + 1); c.fill();
    c.fillStyle = roof; c.beginPath(); c.moveTo(x - 1, top); c.lineTo(x + w / 2, top - 14); c.lineTo(x + w + 1, top); c.fill();
    c.fillStyle = roofD; c.beginPath(); c.moveTo(x + w / 2, top - 14); c.lineTo(x + w + 1, top); c.lineTo(x + w / 2, top); c.fill();
  };
  tower(2, 10, 30); tower(52, 10, 30);
  tower(24, 16, 20);
  // 旗
  px(c, 31, 0, 1, 8, line); px(c, 32, 1, 6, 3, '#d8343c');
  // 門
  px(c, 26, 56, 12, 18, line); px(c, 27, 57, 10, 17, '#2a1a10');
  c.fillStyle = line; c.beginPath(); c.arc(32, 57, 6, Math.PI, 0); c.fill();
  c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(32, 57, 5, Math.PI, 0); c.fill();
  px(c, 18, 50, 3, 5, line); px(c, 43, 50, 3, 5, line);
  castleSprite = cv;
}

