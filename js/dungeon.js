// ダンジョン（迷路の自動生成・ボス部屋・床と壁のタイル・宝箱）
'use strict';

// floors：maze=迷路（seed つき）、room=手書きの部屋
// 記号：# かべ . ゆか E 出口 > 次の階 < 前の階 T 宝箱 X ボスのいる場所 P 柱 c 結晶 ~ 穴 C じゅうたん O 魔法陣 a 祭壇 k 人の立ち位置
const DUNGEONS = {
  mine: { name: 'ゴルドー鉱山', tileset: 'mine', region: 'mine', music: 'dungeon', exit: { x: 84, y: 8 },
    floors: [
      { id: 'mine1', maze: { cw: 8, ch: 6, seed: 11 }, chests: [['hipotion', 2], ['greataxe', 1], ['gold', 300]] },
      { id: 'mine2', room: [
        '###############',
        '#x...........x#',
        '#....#####....#',
        '#....#.X.#....#',
        '#c...........c#',
        '#.............#',
        '#..P.......P..#',
        '#.............#',
        '#c....k.k....c#',
        '#.............#',
        '#######<#######',
      ] },
    ] },
  tower: { name: '蒼晶の塔', tileset: 'tower', region: 'tower', music: 'tower', exit: { x: 88, y: 52 },
    floors: [
      { id: 'tower1', maze: { cw: 7, ch: 6, seed: 21 }, chests: [['ether', 2], ['runewand', 1], ['gold', 400]] },
      { id: 'tower2', maze: { cw: 8, ch: 6, seed: 22 }, chests: [['hipotion', 3], ['magerobe', 1], ['mindring', 1]] },
      { id: 'tower3', room: [
        '###############',
        '#c...........c#',
        '#.....aaa.....#',
        '#......X......#',
        '#..c...k...c..#',
        '#.............#',
        '#.P....C....P.#',
        '#......C......#',
        '#.P....C....P.#',
        '#......C......#',
        '#######<#######',
      ] },
    ] },
  castle: { name: 'ルミナ城', tileset: 'castle', region: 'castle', music: 'dungeon', exit: { x: 32, y: 14 },
    floors: [
      { id: 'castle1', maze: { cw: 8, ch: 6, seed: 31 }, chests: [['xpotion', 2], ['guardring', 1], ['hiether', 1]] },
      { id: 'castle2', room: [
        '#################',
        '#P....aaaaa....P#',
        '#......kXk......#',
        '#P......O......P#',
        '#.......C.......#',
        '#P......C......P#',
        '#.......C.......#',
        '#P......C......P#',
        '#.......C.......#',
        '#.......C.......#',
        '########<########',
      ] },
    ] },
  temple: { name: '終焉の神殿', tileset: 'temple', region: 'temple', music: 'temple', exit: null,
    floors: [
      { id: 'temple1', maze: { cw: 9, ch: 6, seed: 41 }, chests: [['eclipseblade', 1], ['elixir', 1], ['xpotion', 3]] },
      { id: 'temple2', room: [
        '###############',
        '#~~~...>...~~~#',
        '#~~...c.c...~~#',
        '#~.....X.....~#',
        '#~.....k.....~#',
        '#.............#',
        '#~...........~#',
        '#~~.........~~#',
        '#~~~.......~~~#',
        '#######<#######',
      ] },
      { id: 'temple3', maze: { cw: 9, ch: 7, seed: 42 }, chests: [['lightstaff', 1], ['gaiaaxe', 1], ['starstaff', 1], ['dragonmail', 1], ['starrobe', 1], ['elixir', 1]] },
      { id: 'temple4', room: [
        '###############',
        '#c~~~~.>.~~~~c#',
        '#.~~~.....~~~.#',
        '#......X......#',
        '#......k......#',
        '#.~.........~.#',
        '#.~~.......~~.#',
        '#.............#',
        '#c......<....c#',
        '###############',
      ] },
      { id: 'temple5', room: [
        '#################',
        '#~~~~~~aaa~~~~~~#',
        '#~~~~~..X..~~~~~#',
        '#~~~~~..k..~~~~~#',
        '#~~~~.......~~~~#',
        '#~~~.........~~~#',
        '#~~...........~~#',
        '#~.............~#',
        '#c.............c#',
        '########<########',
      ] },
    ] },
};

// 迷路の自動生成（通路は 2 マス幅）。入口は下の中央、次の階への階段は入口からいちばん遠い場所
function genMaze(cw, ch, seed, chestCount) {
  const r = mulberry32(seed);
  const W = cw * 3 + 1, H = ch * 3 + 1;
  const g = Array.from({ length: H }, () => new Array(W).fill('#'));
  const seen = Array.from({ length: ch }, () => new Array(cw).fill(false));
  const open = (cx, cy) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) g[cy * 3 + 1 + y][cx * 3 + 1 + x] = '.'; };
  const link = (ax, ay, bx, by) => {
    if (ax === bx) { const y = Math.max(ay, by) * 3; for (let x = 0; x < 2; x++) g[y][ax * 3 + 1 + x] = '.'; }
    else { const x = Math.max(ax, bx) * 3; for (let y = 0; y < 2; y++) g[ay * 3 + 1 + y][x] = '.'; }
  };
  const startX = Math.floor(cw / 2), startY = ch - 1;
  const stack = [[startX, startY]]; seen[startY][startX] = true; open(startX, startY);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cw && y < ch && !seen[y][x]);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny] = nb[Math.floor(r() * nb.length)];
    seen[ny][nx] = true; open(nx, ny); link(cx, cy, nx, ny); stack.push([nx, ny]);
  }
  // ところどころ壁をこわして ループを作る
  for (let i = 0; i < cw * ch * 0.18; i++) {
    const cx = Math.floor(r() * cw), cy = Math.floor(r() * ch);
    if (r() < 0.5 && cx < cw - 1) link(cx, cy, cx + 1, cy); else if (cy < ch - 1) link(cx, cy, cx, cy + 1);
  }
  // 距離をはかって 階段と宝箱をおく
  const dist = Array.from({ length: ch }, () => new Array(cw).fill(-1));
  const q = [[startX, startY]]; dist[startY][startX] = 0;
  const conn = (ax, ay, bx, by) => ax === bx ? g[Math.max(ay, by) * 3][ax * 3 + 1] === '.' : g[ay * 3 + 1][Math.max(ax, bx) * 3] === '.';
  while (q.length) {
    const [cx, cy] = q.shift();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cw || ny >= ch || dist[ny][nx] >= 0 || !conn(cx, cy, nx, ny)) continue;
      dist[ny][nx] = dist[cy][cx] + 1; q.push([nx, ny]);
    }
  }
  let far = [startX, 0], best = -1;
  const cells = [];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    cells.push([x, y, dist[y][x]]);
    if (dist[y][x] > best && y < ch - 1) { best = dist[y][x]; far = [x, y]; }
  }
  g[H - 1][startX * 3 + 1] = 'E';
  g[far[1] * 3 + 1][far[0] * 3 + 1] = '>';
  // 宝箱：行き止まり（つながりが1つ）を遠い順に
  const dead = cells.filter(([x, y]) => {
    const n = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < cw && ny < ch && conn(x, y, nx, ny); }).length;
    return n === 1 && !(x === far[0] && y === far[1]) && !(x === startX && y === startY);
  }).sort((a, b) => b[2] - a[2]);
  const pool = dead.length >= chestCount ? dead : dead.concat(cells.filter(c => !dead.includes(c) && c[2] > 2).sort((a, b) => b[2] - a[2]));
  for (let i = 0; i < chestCount && i < pool.length; i++) { const [x, y] = pool[i]; g[y * 3 + 2][x * 3 + 2] = 'T'; }
  // 柱や結晶のかざり
  for (let i = 0; i < cw * ch * 0.25; i++) {
    const cx = Math.floor(r() * cw), cy = Math.floor(r() * ch);
    const x = cx * 3 + 1 + Math.floor(r() * 2), y = cy * 3 + 1 + Math.floor(r() * 2);
    if (g[y][x] === '.' && g[y - 1][x] === '#' && !(cy === startY && cx === startX)) g[y][x] = r() < 0.5 ? 'c' : 'P';
  }
  return g.map(row => row.join(''));
}

// ---------- タイル ----------
const DUNGEON_STYLES = {
  mine:   { floor: '#8a6a48', floor2: '#7a5a3a', dot: '#a8865e', wall: '#6a5038', wallTop: '#2a1c14', trim: '#a87a48' },
  tower:  { floor: '#3a5a9a', floor2: '#2e4a84', dot: '#7fb8ff', wall: '#4a6ab0', wallTop: '#101a34', trim: '#9fe0ff' },
  castle: { floor: '#9a9aa8', floor2: '#8a8a98', dot: '#b8b8c4', wall: '#7a7a8c', wallTop: '#1e1e28', trim: '#c8a040' },
  temple: { floor: '#3a2a52', floor2: '#2e2044', dot: '#c060ff', wall: '#4a3460', wallTop: '#0c0814', trim: '#e8c048' },
};
function drawDungeonTile(c, type, variant, st, frame) {
  const box = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  if (type === T.DFLOOR || type === T.DSTAIR || type === T.DCARPET) {
    box(0, 0, 32, 32, st.floor);
    if (st === DUNGEON_STYLES.mine) { for (const [x, y] of [[4, 6], [20, 3], [12, 18], [26, 22], [6, 27]]) { box(x, y, 3, 2, st.dot); box(x, y + 2, 3, 1, st.floor2); } }
    else if (st === DUNGEON_STYLES.temple) { box(0, 0, 32, 1, st.floor2); box(0, 0, 1, 32, st.floor2); if (variant % 5 === 0) { c.strokeStyle = st.dot + '88'; c.lineWidth = 1; c.beginPath(); c.arc(16, 16, 7, 0, 7); c.stroke(); c.beginPath(); c.moveTo(16, 9); c.lineTo(16, 23); c.moveTo(9, 16); c.lineTo(23, 16); c.stroke(); } }
    else { for (let y = 0; y < 32; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < 32; x += 16) { box(x + 1, y + 1, 14, 14, st.floor2); box(x + 1, y + 1, 14, 1, st.dot + '66'); } }
  }
  if (type === T.DCARPET) { box(4, 0, 24, 32, '#a82838'); box(6, 0, 1, 32, '#e8c048'); box(25, 0, 1, 32, '#e8c048'); }
  if (type === T.DSTAIR) {
    for (let i = 0; i < 5; i++) { box(3 + i, 4 + i * 5, 26 - i * 2, 4, i % 2 ? '#d8d0c0' : '#b8b0a0'); box(3 + i, 8 + i * 5, 26 - i * 2, 1, '#00000055'); }
  }
  if (type === T.DPIT) {
    box(0, 0, 32, 32, '#050208');
    for (let i = 0; i < 4; i++) box((variant * 7 + i * 11 + frame * 3) % 30, (variant * 5 + i * 9) % 30, 1, 1, i % 2 ? '#c060ff' : '#ffffff');
  }
  if (type === T.DWALL) {
    if (variant === 'face') {
      box(0, 0, 32, 32, st.wall);
      for (let y = 4; y < 28; y += 8) { box(0, y, 32, 1, '#00000033'); box(((y / 8) % 2) * 12 + 4, y - 7, 1, 7, '#00000033'); }
      box(0, 0, 32, 2, st.trim); box(0, 28, 32, 4, '#00000044');
    } else {
      box(0, 0, 32, 32, st.wallTop);
      box(0, 0, 32, 1, '#ffffff10');
    }
  }
}

// ---------- 宝箱・かざり ----------
function makeChestSprite(open) {
  const cv = newCanvas(32, 32), c = cv.getContext('2d');
  oRect(c, 5, 12, 22, 16, '#a8703c'); box(c, 6, 13, 20, 2, '#c89060');
  box(c, 5, 18, 22, 2, OUT); box(c, 15, 18, 2, 10, OUT);
  if (open) { oRect(c, 5, 6, 22, 8, '#8a5a30'); box(c, 7, 10, 18, 3, '#1a1010'); }
  else { oRect(c, 5, 8, 22, 9, '#b87a44'); box(c, 6, 9, 20, 2, '#d8a070'); oRect(c, 14, 15, 4, 5, '#f0c838'); }
  return cv;
}
function makePillarSprite(st) {
  const cv = newCanvas(32, 56), c = cv.getContext('2d');
  oRect(c, 6, 50, 20, 6, st.wall); oRect(c, 9, 6, 14, 46, shadeHex(st.floor, 0.25));
  box(c, 11, 8, 3, 42, '#ffffff33'); oRect(c, 6, 2, 20, 6, st.wall); box(c, 7, 3, 18, 1, st.trim);
  return cv;
}
function makeCrystalSprite(st) {
  const cv = newCanvas(32, 44), c = cv.getContext('2d');
  const col = st === DUNGEON_STYLES.temple ? '#c060ff' : st === DUNGEON_STYLES.mine ? '#ff9a5a' : '#7fd8ff';
  c.fillStyle = OUT; c.beginPath(); c.moveTo(16, 2); c.lineTo(25, 22); c.lineTo(16, 42); c.lineTo(7, 22); c.closePath(); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(16, 4); c.lineTo(23, 22); c.lineTo(16, 40); c.lineTo(9, 22); c.closePath(); c.fill();
  c.fillStyle = '#ffffffaa'; c.beginPath(); c.moveTo(16, 6); c.lineTo(19, 20); c.lineTo(14, 20); c.closePath(); c.fill();
  return cv;
}
function makeAltarSprite(st) {
  const cv = newCanvas(32, 36), c = cv.getContext('2d');
  oRect(c, 0, 14, 32, 20, st.wall); box(c, 1, 15, 30, 3, st.trim);
  for (let x = 4; x < 32; x += 8) box(c, x, 22, 3, 10, '#00000044');
  return cv;
}
function makePortalSprite(frame) {
  const cv = newCanvas(32, 32), c = cv.getContext('2d');
  const g = c.createRadialGradient(16, 16, 2, 16, 16, 15);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, frame ? '#c060ff' : '#9a40e0'); g.addColorStop(1, '#3a0a5a00');
  c.fillStyle = g; c.beginPath(); c.ellipse(16, 18, 15, 10, 0, 0, 7); c.fill();
  c.strokeStyle = '#e8c0ff'; c.lineWidth = 1; c.beginPath(); c.ellipse(16, 18, 11 + frame * 2, 7 + frame, 0, 0, 7); c.stroke();
  return cv;
}

function makeThroneSprite() {
  const cv = newCanvas(32, 48), c = cv.getContext('2d');
  oRect(c, 4, 4, 24, 34, '#a82838'); box(c, 7, 7, 18, 28, '#c83848');
  oRect(c, 2, 26, 28, 14, '#c8a040'); box(c, 3, 27, 26, 2, '#f0d070');
  oRect(c, 2, 38, 6, 10, '#a88030'); oRect(c, 24, 38, 6, 10, '#a88030');
  c.fillStyle = '#f0d070'; for (const x of [6, 16, 26]) { c.beginPath(); c.arc(x, 4, 3, 0, 7); c.fill(); }
  return cv;
}
function makeBrazierSprite(frame) {
  const cv = newCanvas(32, 44), c = cv.getContext('2d');
  oRect(c, 13, 18, 6, 24, '#5a5a6a'); oRect(c, 7, 14, 18, 6, '#7a7a8a');
  const f = frame ? 1 : 0;
  c.fillStyle = '#ff7a2a'; c.beginPath(); c.moveTo(9, 15); c.quadraticCurveTo(10 - f, 4, 16, 1 + f); c.quadraticCurveTo(22 + f, 6, 23, 15); c.fill();
  c.fillStyle = '#ffe070'; c.beginPath(); c.moveTo(12, 15); c.quadraticCurveTo(14, 8 + f, 16, 6); c.quadraticCurveTo(19, 9, 20, 15); c.fill();
  return cv;
}
function makeSigilSprite(st, frame) {
  const cv = newCanvas(32, 32), c = cv.getContext('2d');
  const col = st === DUNGEON_STYLES.temple ? '#c060ff' : st.trim;
  c.globalAlpha = frame ? 0.9 : 0.6;
  c.strokeStyle = col; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(16, 20, 14, 9, 0, 0, 7); c.stroke();
  c.beginPath(); c.ellipse(16, 20, 9, 6, 0, 0, 7); c.stroke();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.fillStyle = col; c.fillRect(16 + Math.cos(a) * 11.5 - 1, 20 + Math.sin(a) * 7.5 - 1, 2, 2); }
  return cv;
}

// フロアをエリアにする
function buildDungeonFloor(dungeonId, index) {
  const D = DUNGEONS[dungeonId], F = D.floors[index];
  const layout = F.room || genMaze(F.maze.cw, F.maze.ch, F.maze.seed, (F.chests || []).length);
  const st = DUNGEON_STYLES[D.tileset];
  const h = layout.length, w = Math.max(...layout.map(r => r.length));
  const map = [], objects = [], spots = {};
  let chestIndex = 0;
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = layout[y][x] || '#';
      let t = T.DFLOOR;
      if (ch === '#') t = T.DWALL;
      else if (ch === '~') t = T.DPIT;
      else if (ch === 'C') t = T.DCARPET;
      else if (ch === '>' || ch === '<') { t = T.DSTAIR; spots[ch] = { x, y }; }
      else if (ch === 'E') { t = T.DSTAIR; spots.E = { x, y }; }
      else if (ch === 'X' || ch === 'k') { (spots[ch] = spots[ch] || []).push({ x, y }); }
      if (ch === 'T') {
        const content = (F.chests || [])[chestIndex++] || ['potion', 1];
        objects.push({ kind: 'chest', id: `${F.id}_${x}_${y}`, x, y, w: 1, h: 1, content, sprite: makeChestSprite(false), openSprite: makeChestSprite(true) });
      }
      if (ch === 'P' || ch === 'x') objects.push({ kind: 'deco', x, y, w: 1, h: 1, sprite: makePillarSprite(st) });
      if (ch === 'X') objects.push(D.tileset === 'castle' ? { kind: 'deco', x, y, w: 1, h: 1, sprite: makeThroneSprite(), under: true }
        : { kind: 'deco', x, y, w: 1, h: 1, frames: [makeSigilSprite(st, 0), makeSigilSprite(st, 1)], sprite: makeSigilSprite(st, 0), under: true, walk: true });
      if (ch === 'k') objects.push({ kind: 'deco', x, y, w: 1, h: 1, frames: [makeBrazierSprite(0), makeBrazierSprite(1)], sprite: makeBrazierSprite(0), glowCol: '#ffb060' });
      if (ch === 'c') objects.push({ kind: 'deco', x, y, w: 1, h: 1, sprite: makeCrystalSprite(st), glow: true });
      if (ch === 'a') objects.push({ kind: 'deco', x, y, w: 1, h: 1, sprite: makeAltarSprite(st) });
      if (ch === 'O') objects.push({ kind: 'portal', id: 'portal', x, y, w: 1, h: 1, frames: [makePortalSprite(0), makePortalSprite(1)], sprite: makePortalSprite(0), hidden: true });
      row.push(t);
    }
    map.push(row);
  }
  return { id: F.id, name: D.name + (D.floors.length > 1 ? ` ${index + 1}F` : ''), dungeon: dungeonId, floor: index, interior: true, isDungeon: true,
    style: st, tileset: D.tileset, region: D.region, music: D.music, map, w, h, objects, npcs: [], spots };
}
