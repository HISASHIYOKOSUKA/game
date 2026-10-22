// 町の建物・小物のドット絵（MOTHER 風：斜め見下ろし、太い輪郭、パステル調）
'use strict';

const OUT = '#2c2433';

function box(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function oRect(c, x, y, w, h, fill) { box(c, x, y, w, h, OUT); box(c, x + 1, y + 1, w - 2, h - 2, fill); }
function newCanvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }

// 建物ごとの見た目
const BUILDING_STYLES = {
  inn:    { wall: '#fbeccb', wallDark: '#e2c99a', wallStyle: 'siding', roof: '#d9584a', roofDark: '#a83a32', roofLight: '#f08a70', roofStyle: 'gable', sign: 'inn', awning: ['#ffffff', '#d9584a'], chimney: true, door2: true },
  item:   { wall: '#d4f0dc', wallDark: '#a4d4b4', wallStyle: 'siding', roof: '#f0b040', roofDark: '#c08020', roofLight: '#ffd878', roofStyle: 'flat', sign: 'item', awning: ['#ffffff', '#48a868'] },
  weapon: { wall: '#e4dccc', wallDark: '#b8ab92', wallStyle: 'stone', roof: '#5a6a8a', roofDark: '#3a4662', roofLight: '#8494b4', roofStyle: 'hip', sign: 'weapon', awning: ['#e8e0d0', '#8a4a3a'], chimney: true },
  armor:  { wall: '#d8e6fa', wallDark: '#a8bedc', wallStyle: 'brick', roof: '#4a78c8', roofDark: '#30549a', roofLight: '#78a4ec', roofStyle: 'flat', sign: 'armor', awning: ['#ffffff', '#4a78c8'] },
  house1: { wall: '#fce0e4', wallDark: '#e4b4bc', wallStyle: 'siding', roof: '#7a5ab8', roofDark: '#563c8c', roofLight: '#a688dc', roofStyle: 'gable', chimney: true },
  manor:  { wall: '#efe6d6', wallDark: '#c8b89c', wallStyle: 'stone', roof: '#8a3a4a', roofDark: '#5e2232', roofLight: '#b85a6a', roofStyle: 'hip', chimney: true, door2: true },
  house2: { wall: '#fff6d0', wallDark: '#e4d498', wallStyle: 'siding', roof: '#4a9a58', roofDark: '#2e7040', roofLight: '#78c486', roofStyle: 'gable' },
};

// 看板アイコン（12x12）
function drawIcon(c, kind, x, y) {
  const p = (dx, dy, w, h, col) => box(c, x + dx, y + dy, w, h, col);
  if (kind === 'weapon') { // 剣
    for (let i = 0; i < 8; i++) { p(2 + i, 9 - i, 2, 1, '#e8eef8'); p(2 + i, 10 - i, 2, 1, '#9aa4b8'); }
    p(1, 8, 4, 1, '#e8b840'); p(2, 7, 1, 3, '#e8b840'); p(0, 10, 2, 2, '#8a5a30');
  } else if (kind === 'armor') { // 盾
    p(2, 1, 8, 1, OUT); p(1, 2, 10, 5, OUT); p(2, 7, 8, 2, OUT); p(3, 9, 6, 1, OUT); p(4, 10, 4, 1, OUT); p(5, 11, 2, 1, OUT);
    p(2, 2, 8, 5, '#4a78c8'); p(3, 7, 6, 2, '#4a78c8'); p(4, 9, 4, 1, '#4a78c8'); p(5, 10, 2, 1, '#4a78c8');
    p(5, 2, 2, 8, '#f0d060'); p(2, 4, 8, 2, '#f0d060');
  } else if (kind === 'item') { // ポーション
    p(5, 0, 2, 2, '#a8703c'); p(4, 2, 4, 2, OUT); p(5, 2, 2, 2, '#d8f0ff');
    p(2, 4, 8, 7, OUT); p(3, 5, 6, 5, '#e84858'); p(3, 5, 6, 2, '#ff8a98'); p(4, 5, 1, 2, '#ffffff'); p(3, 11, 6, 1, OUT);
  } else if (kind === 'inn') { // ベッド
    p(0, 3, 2, 8, '#8a5a30'); p(10, 6, 2, 5, '#8a5a30'); p(2, 6, 3, 2, '#ffffff'); p(2, 8, 8, 2, '#e84858'); p(5, 6, 5, 2, '#e84858'); p(1, 10, 10, 1, '#5a3a20');
    p(7, 1, 2, 1, '#4a78c8'); p(8, 2, 1, 1, '#4a78c8'); p(7, 3, 2, 1, '#4a78c8');
  }
}

function makeBuildingSprite(o) {
  const st = BUILDING_STYLES[o.style];
  const TOP = 22; // 屋根が上にはみ出す分
  const W = o.w * 32, H = o.h * 32 + TOP;
  const cv = newCanvas(W, H), c = cv.getContext('2d');
  const roofB = Math.round(H * (o.h >= 4 ? 0.46 : 0.5));
  const wx0 = 4, wx1 = W - 4, wallTop = roofB - 2, wallB = H - 1;
  // ---- 壁
  oRect(c, wx0, wallTop, wx1 - wx0, wallB - wallTop + 1, st.wall);
  const wl = wx0 + 1, wr = wx1 - 1;
  if (st.wallStyle === 'siding') {
    for (let y = wallTop + 5; y < wallB - 5; y += 4) box(c, wl, y, wr - wl, 1, st.wallDark);
  } else if (st.wallStyle === 'brick') {
    for (let y = wallTop + 4, r = 0; y < wallB - 5; y += 5, r++) {
      box(c, wl, y, wr - wl, 1, st.wallDark);
      for (let x = wl + (r % 2 ? 4 : 0); x < wr; x += 9) box(c, x, y - 4, 1, 4, st.wallDark);
    }
  } else { // stone
    for (let y = wallTop + 6, r = 0; y < wallB - 5; y += 7, r++) {
      box(c, wl, y, wr - wl, 1, st.wallDark);
      for (let x = wl + (r % 2 ? 6 : 1); x < wr; x += 12) box(c, x, y - 6, 1, 6, st.wallDark);
    }
  }
  box(c, wl, wallTop + 1, 3, wallB - wallTop - 1, st.wallDark); // 柱
  box(c, wr - 3, wallTop + 1, 3, wallB - wallTop - 1, st.wallDark);
  box(c, wl, wallB - 5, wr - wl, 5, '#a8a0a8'); box(c, wl, wallB - 5, wr - wl, 1, OUT); // 土台
  for (let x = wl + 3; x < wr; x += 8) box(c, x, wallB - 4, 1, 4, '#8a8290');

  // ---- 窓（壁が高い建物は2階の窓も）
  const doorX = o.door * 32 + 16;
  const wallH = wallB - wallTop;
  const dH = Math.min(26, wallH - 6), doorTop = wallB - 4 - dH;
  const rows = wallH > 70
    ? [{ y: wallTop + 8, h: 12, upper: true }, { y: doorTop + 1, h: 14 }]
    : [{ y: wallTop + Math.max(6, Math.floor((wallH - 16) / 2) - 3), h: Math.min(16, wallH - 18) }];
  const winW = 16;
  for (const row of rows) {
    const winY = row.y, winH = row.h;
    for (let i = 0; i < o.w; i++) {
      const cx = i * 32 + 16;
      if (!row.upper && Math.abs(cx - doorX) < 24) continue;
      if (!row.upper && st.sign && i === o.door + 1) continue; // 看板の場所
      if (row.upper && st.roofStyle === 'gable' && i === o.door) continue;
      const x = cx - winW / 2;
      oRect(c, x - 1, winY - 1, winW + 2, winH + 2, '#f8f6ee');
      box(c, x + 1, winY + 1, winW - 2, winH - 2, '#9ed4f0');
      box(c, x + 1, winY + 1, winW - 2, 3, '#c8ecff');
      box(c, x + 3, winY + 4, 1, 4, '#ffffff'); box(c, x + 4, winY + 3, 1, 2, '#ffffff');
      box(c, x + winW / 2 - 1, winY, 2, winH, '#f8f6ee'); box(c, x, winY + winH / 2 - 1, winW, 2, '#f8f6ee');
      box(c, x + 1, winY + 1, 3, winH - 2, st.roofLight); box(c, x + winW - 4, winY + 1, 3, winH - 2, st.roofLight); // カーテン
      if (row.upper) { // よろい戸
        oRect(c, x - 5, winY - 1, 5, winH + 2, st.roofDark); oRect(c, x + winW, winY - 1, 5, winH + 2, st.roofDark);
        box(c, x - 4, winY + 3, 3, 1, st.roof); box(c, x + winW + 1, winY + 3, 3, 1, st.roof);
        box(c, x - 4, winY + 7, 3, 1, st.roof); box(c, x + winW + 1, winY + 7, 3, 1, st.roof);
      } else { // 花の窓台
        oRect(c, x - 2, winY + winH + 1, winW + 4, 5, '#a8703c');
        for (let k = 0; k < 4; k++) { box(c, x + 1 + k * 4, winY + winH - 1, 3, 3, k % 2 ? '#ff7088' : '#ffd84a'); box(c, x + 2 + k * 4, winY + winH, 1, 1, '#ffffff'); }
      }
    }
  }
  if (rows.length > 1) box(c, wl, rows[1].y - 8, wr - wl, 2, st.wallDark); // 階のさかい
  const winY = rows[rows.length - 1].y;

  // ---- 入口
  const dW = 18, dx = doorX - dW / 2, dy = doorTop;
  oRect(c, dx - 2, dy - 2, dW + 4, dH + 3, '#7a4a28');
  if (st.door2) { // 両開き
    box(c, dx, dy, dW, dH, '#b8784a'); box(c, dx + dW / 2 - 1, dy, 1, dH, OUT);
    box(c, dx + 2, dy + 3, dW / 2 - 4, dH / 2 - 4, '#ffe8a0'); box(c, dx + dW / 2 + 2, dy + 3, dW / 2 - 4, dH / 2 - 4, '#ffe8a0');
  } else {
    box(c, dx, dy, dW, dH, '#b8784a');
    box(c, dx + 3, dy + 3, dW - 6, 8, '#ffe8a0'); box(c, dx + dW / 2, dy + 3, 1, 8, '#7a4a28');
    box(c, dx + 3, dy + 14, dW - 6, 1, '#8a5432'); box(c, dx + 3, dy + 19, dW - 6, 1, '#8a5432');
  }
  box(c, dx + dW - 5, dy + dH / 2 + 2, 2, 2, '#f8d040');
  oRect(c, dx - 4, wallB - 3, dW + 8, 4, '#c8c0c8'); // 踏み石
  // ひさし
  if (st.awning) {
    const aw = dW + 14, ax = doorX - aw / 2, ay = dy - 10;
    box(c, ax - 1, ay - 1, aw + 2, 8, OUT);
    for (let k = 0; k < aw; k += 4) box(c, ax + k, ay, Math.min(4, aw - k), 6, (k / 4) % 2 ? st.awning[1] : st.awning[0]);
    for (let k = 0; k < aw; k += 4) { c.fillStyle = (k / 4) % 2 ? st.awning[1] : st.awning[0]; c.beginPath(); c.arc(ax + k + 2, ay + 6, 2, 0, Math.PI); c.fill(); }
    box(c, ax, ay + 6, aw, 1, 'rgba(0,0,0,0.15)');
  }
  // 吊り看板
  if (st.sign) {
    const sx = doorX + 22, sy = winY + 2;
    box(c, sx - 2, sy - 4, 12, 2, OUT); box(c, sx + 2, sy - 2, 1, 3, OUT); box(c, sx + 12, sy - 2, 1, 3, OUT);
    oRect(c, sx - 2, sy, 20, 18, '#f8e8c0'); box(c, sx - 1, sy + 1, 18, 1, '#ffffff');
    drawIcon(c, st.sign, sx + 2, sy + 3);
  }

  // ---- 屋根
  if (st.roofStyle === 'flat') {
    oRect(c, 0, 0 + 8, W, roofB - 6, st.roof);
    box(c, 1, 9, W - 2, 4, st.roofLight);
    box(c, 1, roofB - 3, W - 2, 2, st.roofDark);
    box(c, 6, 15, W - 12, roofB - 20, st.roofDark); box(c, 7, 16, W - 14, roofB - 22, st.roof);
    for (let y = 22; y < roofB - 6; y += 6) box(c, 7, y, W - 14, 1, st.roofDark + '88');
    for (let x = 14; x < W - 8; x += 12) box(c, x, 16, 1, roofB - 22, st.roofDark + '55');
    oRect(c, W - 30, 18, 16, 11, '#d8d8e0'); box(c, W - 28, 20, 12, 1, '#a0a0b0'); box(c, W - 28, 23, 12, 1, '#a0a0b0'); box(c, W - 28, 26, 12, 1, '#a0a0b0'); // 室外機
    oRect(c, 12, 18, 10, 8, '#bfe8ff'); box(c, 13, 19, 3, 2, '#ffffff'); // 天窓
    // 屋上の大きな看板
    if (st.sign) {
      const bw = Math.min(W - 24, 96), bx = (W - bw) / 2, by = 0;
      box(c, bx + 8, by + 14, 2, 8, OUT); box(c, bx + bw - 10, by + 14, 2, 8, OUT);
      oRect(c, bx, by, bw, 18, '#fff8e8');
      box(c, bx + 1, by + 15, bw - 2, 2, st.roofLight);
      drawIcon(c, st.sign, bx + 4, by + 3);
      for (let k = 0; k < Math.floor((bw - 26) / 7); k++) box(c, bx + 20 + k * 7, by + 6, 5, 6, st.roofDark);
    }
  } else if (st.roofStyle === 'hip') {
    c.fillStyle = OUT; c.beginPath(); c.moveTo(0, roofB); c.lineTo(18, 2); c.lineTo(W - 18, 2); c.lineTo(W, roofB); c.fill();
    c.fillStyle = st.roof; c.beginPath(); c.moveTo(2, roofB - 1); c.lineTo(19, 3); c.lineTo(W - 19, 3); c.lineTo(W - 2, roofB - 1); c.fill();
    c.fillStyle = st.roofLight; c.beginPath(); c.moveTo(2, roofB - 1); c.lineTo(19, 3); c.lineTo(26, roofB - 1); c.fill();
    c.fillStyle = st.roofDark; c.beginPath(); c.moveTo(W - 2, roofB - 1); c.lineTo(W - 19, 3); c.lineTo(W - 26, roofB - 1); c.fill();
    for (let y = 8, r = 0; y < roofB - 2; y += 5, r++) {
      const inset = 18 - (y / roofB) * 14;
      box(c, inset + 2, y, W - inset * 2 - 4, 1, st.roofDark);
      for (let x = inset + 4 + (r % 2) * 4; x < W - inset - 4; x += 8) box(c, x, y - 4, 1, 4, st.roofDark);
    }
    box(c, 19, 3, W - 38, 2, st.roofLight);
    box(c, 0, roofB - 2, W, 3, OUT);
  } else { // gable：横長の切妻を正面から
    oRect(c, 0, 2, W, roofB - 1, st.roof);
    box(c, 1, 3, W - 2, 3, st.roofLight);
    for (let y = 9, r = 0; y < roofB - 3; y += 5, r++) {
      box(c, 1, y, W - 2, 1, st.roofDark);
      for (let x = 1 + (r % 2 ? 4 : 0); x < W - 1; x += 8) box(c, x, y - 4, 1, 4, st.roofDark);
    }
    box(c, 1, roofB - 3, W - 2, 2, st.roofDark);
    // 正面の三角の破風
    const gx = o.door * 32 + 16, gw = 26;
    c.fillStyle = OUT; c.beginPath(); c.moveTo(gx - gw - 2, roofB + 1); c.lineTo(gx, roofB - 22); c.lineTo(gx + gw + 2, roofB + 1); c.fill();
    c.fillStyle = st.roof; c.beginPath(); c.moveTo(gx - gw + 1, roofB); c.lineTo(gx, roofB - 19); c.lineTo(gx + gw - 1, roofB); c.fill();
    c.fillStyle = st.wall; c.beginPath(); c.moveTo(gx - gw + 7, roofB); c.lineTo(gx, roofB - 13); c.lineTo(gx + gw - 7, roofB); c.fill();
    oRect(c, gx - 4, roofB - 9, 8, 7, '#9ed4f0'); box(c, gx - 1, roofB - 8, 1, 5, '#f8f6ee');
  }
  box(c, wx0, roofB, wx1 - wx0, 2, 'rgba(0,0,0,0.18)'); // 軒の影
  if (st.chimney) {
    const cx = Math.round(W * 0.78);
    oRect(c, cx, 0, 9, 13, '#c0584a'); box(c, cx + 1, 3, 7, 1, '#8a3a32'); box(c, cx + 1, 7, 7, 1, '#8a3a32');
    oRect(c, cx - 1, 0, 11, 3, '#8a8290');
  }
  return cv;
}

function makeTreeSprite(seed) {
  const cv = newCanvas(32, 48), c = cv.getContext('2d');
  const r = mulberry32(seed);
  oRect(c, 13, 32, 6, 14, '#8a5a30'); box(c, 14, 33, 2, 12, '#a8703c');
  const blobs = [[16, 18, 12], [9, 24, 8], [23, 24, 8], [16, 27, 9], [11, 14, 7], [21, 13, 7]];
  c.fillStyle = OUT; blobs.forEach(([x, y, rr]) => { c.beginPath(); c.arc(x, y, rr + 1, 0, 7); c.fill(); });
  c.fillStyle = '#3e9048'; blobs.forEach(([x, y, rr]) => { c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); });
  c.fillStyle = '#58b05a'; blobs.forEach(([x, y, rr]) => { c.beginPath(); c.arc(x - 1, y - 2, rr * 0.75, 0, 7); c.fill(); });
  c.fillStyle = '#80d070'; blobs.slice(0, 3).forEach(([x, y, rr]) => { c.beginPath(); c.arc(x - 3, y - 4, rr * 0.35, 0, 7); c.fill(); });
  for (let i = 0; i < 4; i++) { const x = 7 + Math.floor(r() * 18), y = 10 + Math.floor(r() * 18); box(c, x, y, 2, 2, r() < 0.5 ? '#ff7088' : '#ffffff'); }
  return cv;
}
function makeLampSprite() {
  const cv = newCanvas(32, 56), c = cv.getContext('2d');
  oRect(c, 11, 51, 10, 5, '#5a5a6a');
  oRect(c, 14, 16, 4, 37, '#4a4a5a'); box(c, 15, 17, 1, 34, '#7a7a8a');
  oRect(c, 9, 4, 14, 14, '#3a3a4a'); box(c, 11, 6, 10, 10, '#ffe890'); box(c, 12, 7, 3, 4, '#ffffff');
  box(c, 15, 6, 2, 10, '#3a3a4a');
  c.fillStyle = OUT; c.beginPath(); c.moveTo(7, 5); c.lineTo(16, -1); c.lineTo(25, 5); c.fill();
  c.fillStyle = '#4a4a5a'; c.beginPath(); c.moveTo(9, 4); c.lineTo(16, 0); c.lineTo(23, 4); c.fill();
  return cv;
}
function makeSignSprite() {
  const cv = newCanvas(32, 34), c = cv.getContext('2d');
  oRect(c, 14, 18, 4, 16, '#8a5a30');
  oRect(c, 3, 4, 26, 17, '#d8a868'); box(c, 4, 5, 24, 2, '#f0c888');
  for (let i = 0; i < 3; i++) box(c, 7, 9 + i * 4, 14 + (i % 2) * 4, 1, '#7a4a28');
  return cv;
}
function makeMailboxSprite() {
  const cv = newCanvas(32, 34), c = cv.getContext('2d');
  oRect(c, 14, 16, 4, 18, '#8a5a30');
  oRect(c, 7, 6, 18, 12, '#e04848'); box(c, 8, 7, 16, 3, '#ff7a7a');
  box(c, 9, 12, 10, 2, OUT); oRect(c, 23, 2, 3, 8, '#f8d040');
  return cv;
}
function makeBenchSprite() {
  const cv = newCanvas(32, 30), c = cv.getContext('2d');
  oRect(c, 3, 8, 26, 6, '#c08850'); box(c, 4, 9, 24, 1, '#e0a870');
  oRect(c, 2, 16, 28, 6, '#c08850'); box(c, 3, 17, 26, 1, '#e0a870');
  oRect(c, 5, 21, 3, 8, '#5a4a4a'); oRect(c, 24, 21, 3, 8, '#5a4a4a');
  return cv;
}
function makeFountainSprite(frame) {
  const cv = newCanvas(64, 72), c = cv.getContext('2d');
  const cy = 50;
  c.fillStyle = OUT; c.beginPath(); c.ellipse(32, cy, 31, 18, 0, 0, 7); c.fill();
  c.fillStyle = '#d8d0d8'; c.beginPath(); c.ellipse(32, cy, 30, 17, 0, 0, 7); c.fill();
  c.fillStyle = '#b8b0bc'; c.beginPath(); c.ellipse(32, cy + 3, 30, 14, 0, 0, Math.PI); c.fill();
  c.fillStyle = OUT; c.beginPath(); c.ellipse(32, cy - 2, 25, 12, 0, 0, 7); c.fill();
  c.fillStyle = '#58a8f0'; c.beginPath(); c.ellipse(32, cy - 2, 24, 11, 0, 0, 7); c.fill();
  c.strokeStyle = '#c8ecff'; c.lineWidth = 1;
  for (let i = 0; i < 3; i++) { const rr = ((frame * 4 + i * 7) % 20) + 4; c.globalAlpha = 1 - rr / 24; c.beginPath(); c.ellipse(32, cy - 2, rr, rr * 0.45, 0, 0, 7); c.stroke(); }
  c.globalAlpha = 1;
  oRect(c, 28, 22, 8, 26, '#d8d0d8'); box(c, 29, 23, 2, 24, '#ffffff');
  c.fillStyle = OUT; c.beginPath(); c.ellipse(32, 22, 11, 5, 0, 0, 7); c.fill();
  c.fillStyle = '#e8e0e8'; c.beginPath(); c.ellipse(32, 22, 10, 4, 0, 0, 7); c.fill();
  c.fillStyle = '#9ed8ff'; // 噴き上がる水
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + frame * 0.5;
    const tx = 32 + Math.cos(a) * 18, ty = cy - 2 + Math.sin(a) * 6;
    c.beginPath(); c.moveTo(32, 10);
    c.quadraticCurveTo(32 + Math.cos(a) * 10, 2, tx, ty); c.lineWidth = 2; c.strokeStyle = '#bfe8ff'; c.stroke();
  }
  box(c, 30, 4 + frame * 2, 4, 8, '#ffffff');
  for (let i = 0; i < 5; i++) box(c, 18 + ((i * 11 + frame * 5) % 28), cy - 6 + (i % 3) * 3, 2, 2, '#ffffff');
  return cv;
}

function makeCaveSprite() {
  const cv = newCanvas(64, 72), c = cv.getContext('2d');
  c.fillStyle = OUT; c.beginPath(); c.moveTo(0, 72); c.lineTo(4, 30); c.lineTo(18, 8); c.lineTo(40, 2); c.lineTo(58, 18); c.lineTo(64, 40); c.lineTo(64, 72); c.fill();
  c.fillStyle = '#9a8268'; c.beginPath(); c.moveTo(2, 71); c.lineTo(6, 31); c.lineTo(19, 10); c.lineTo(40, 4); c.lineTo(57, 19); c.lineTo(62, 41); c.lineTo(62, 71); c.fill();
  c.fillStyle = '#c4a884'; c.beginPath(); c.moveTo(6, 31); c.lineTo(19, 10); c.lineTo(40, 4); c.lineTo(30, 20); c.lineTo(14, 34); c.fill();
  c.fillStyle = '#76604a'; c.beginPath(); c.moveTo(57, 19); c.lineTo(62, 41); c.lineTo(62, 71); c.lineTo(50, 71); c.lineTo(52, 30); c.fill();
  // 入口
  c.fillStyle = OUT; c.beginPath(); c.moveTo(16, 72); c.lineTo(16, 48); c.quadraticCurveTo(32, 26, 48, 48); c.lineTo(48, 72); c.fill();
  const g = c.createLinearGradient(0, 36, 0, 72); g.addColorStop(0, '#000000'); g.addColorStop(1, '#2a2030');
  c.fillStyle = g; c.beginPath(); c.moveTo(18, 72); c.lineTo(18, 49); c.quadraticCurveTo(32, 29, 46, 49); c.lineTo(46, 72); c.fill();
  // 坑木
  box(c, 13, 44, 5, 28, OUT); box(c, 14, 45, 3, 27, '#a8703c');
  box(c, 46, 44, 5, 28, OUT); box(c, 47, 45, 3, 27, '#a8703c');
  box(c, 11, 40, 42, 6, OUT); box(c, 12, 41, 40, 4, '#c08850');
  for (const [x, y] of [[10, 52], [52, 58], [24, 16], [44, 12]]) { box(c, x, y, 4, 3, '#665040'); box(c, x, y, 4, 1, '#d8c0a0'); }
  return cv;
}

// TOWN_OBJECTS からスプライト付きのオブジェクトを作る
function buildTownObjects(castleSprite) {
  const sprites = { lamp: makeLampSprite(), sign: makeSignSprite(), mailbox: makeMailboxSprite(), bench: makeBenchSprite() };
  const fountainFrames = [0, 1, 2, 3].map(makeFountainSprite);
  return TOWN_OBJECTS.map((d, i) => {
    const o = Object.assign({ w: 1, h: 1 }, d);
    if (o.kind === 'building') { o.sprite = makeBuildingSprite(o); o.solidFrom = 1; o.doorTile = { x: o.x + o.door, y: o.y + o.h - 1 }; }
    else if (o.kind === 'tree') o.sprite = makeTreeSprite(i * 7 + 3);
    else if (o.kind === 'cave') o.sprite = makeCaveSprite();
    else if (o.kind === 'castle') { o.sprite = castleSprite; o.text = 'ルミナ城。\nいまは 門が かたく とじられている。'; }
    else if (o.kind === 'fountain') { o.frames = fountainFrames; o.sprite = fountainFrames[0]; o.text = 'きれいな 水が わきでている。\nコインが たくさん しずんでいる…。'; }
    else o.sprite = sprites[o.kind];
    return o;
  });
}
