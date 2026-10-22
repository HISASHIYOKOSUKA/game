// エクリプス・サーガ（暫定版）：フィールド探索とバトル
'use strict';
(() => {

// ============================================================
// ユーティリティ
// ============================================================
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = 2; // キャンバスの内部解像度倍率

const images = {};
function loadImages() {
  const names = ['bg_sky'];
  for (const p of PARTY_BASE) {
    names.push(p.id + '_face');
    for (let i = 0; i < 4; i++) names.push(`${p.id}_stand${i}`, `${p.id}_battle${i}`);
    for (let i = 0; i < 5; i++) names.push(`${p.id}_walk${i}`);
  }
  for (const id in MONSTERS) names.push('mon_' + id);
  return Promise.all(names.map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => { images[n] = im; res(); };
    im.onerror = () => res();
    im.src = IMG_DIR + n + '.png';
  })));
}

function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, v) { try { localStorage.setItem(key, v); return true; } catch (e) { return false; } }

// ============================================================
// 効果音（WebAudio の簡易シンセ）
// ============================================================
const Sfx = {
  ctx: null, on: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, { type = 'square', vol = 0.06, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || !this.on) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, { vol = 0.08, delay = 0, hp = 800 } = {}) {
    if (!this.ctx || !this.on) return;
    const t0 = this.ctx.currentTime + delay;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp;
    s.buffer = buf; g.gain.value = vol;
    s.connect(f).connect(g).connect(this.ctx.destination); s.start(t0);
  },
  play(name) {
    switch (name) {
      case 'cursor': this.tone(1200, 0.04, { vol: 0.03 }); break;
      case 'ok': this.tone(880, 0.05, { vol: 0.04 }); this.tone(1320, 0.07, { vol: 0.04, delay: 0.05 }); break;
      case 'cancel': this.tone(600, 0.06, { vol: 0.04, slide: -200 }); break;
      case 'hit': this.noise(0.12, { vol: 0.12 }); this.tone(180, 0.1, { slide: -100, vol: 0.06 }); break;
      case 'crit': this.noise(0.2, { vol: 0.16 }); this.tone(300, 0.2, { slide: -250, vol: 0.08 }); break;
      case 'hurt': this.noise(0.15, { vol: 0.12, hp: 300 }); this.tone(120, 0.15, { type: 'sawtooth', vol: 0.05 }); break;
      case 'magic': for (let i = 0; i < 5; i++) this.tone(600 + i * 180, 0.08, { type: 'triangle', vol: 0.05, delay: i * 0.04 }); break;
      case 'fire': this.noise(0.4, { vol: 0.1, hp: 200 }); this.tone(200, 0.4, { type: 'sawtooth', slide: 300, vol: 0.04 }); break;
      case 'ice': for (let i = 0; i < 6; i++) this.tone(1800 - i * 120, 0.06, { type: 'triangle', vol: 0.04, delay: i * 0.05 }); break;
      case 'thunder': this.noise(0.5, { vol: 0.2, hp: 100 }); break;
      case 'heal': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, { type: 'triangle', vol: 0.05, delay: i * 0.07 })); break;
      case 'encounter': [220, 330, 220, 440, 330, 660].forEach((f, i) => this.tone(f, 0.07, { vol: 0.05, delay: i * 0.06 })); break;
      case 'win': [523, 523, 523, 659, 587, 659, 784].forEach((f, i) => this.tone(f, i === 6 ? 0.5 : 0.12, { vol: 0.05, delay: [0, .13, .26, .45, .6, .75, .9][i] })); break;
      case 'lvup': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.06, delay: i * 0.1 })); break;
      case 'lose': [392, 370, 349, 330].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.06, delay: i * 0.3 })); break;
      case 'run': this.tone(400, 0.25, { slide: 800, vol: 0.04 }); break;
      case 'step': this.tone(90, 0.03, { type: 'triangle', vol: 0.03 }); break;
      case 'die': this.tone(500, 0.4, { type: 'sawtooth', slide: -420, vol: 0.05 }); break;
    }
  }
};

// ============================================================
// ゲーム状態
// ============================================================
const G = {
  mode: 'title', // title | field | battle | busy
  party: [], items: {}, gold: 0, map: null,
  pos: [], steps: 0, safeSteps: 6,
};

function makeMember(base, lv = 1) {
  const m = {
    id: base.id, name: base.name, base, lv: 1, exp: 0,
    mhp: base.hp, mmp: base.mp, atk: base.atk, def: base.def, mag: base.mag, spd: base.spd,
  };
  for (let i = 1; i < lv; i++) levelUp(m);
  m.hp = m.mhp; m.mp = m.mmp;
  return m;
}
function levelUp(m) {
  const g = m.base.grow;
  m.lv++;
  const gains = { hp: g.hp + ri(0, 4), mp: g.mp + ri(0, 1), atk: g.atk + ri(0, 1), def: g.def + ri(0, 1), mag: g.mag + ri(0, 1), spd: g.spd };
  m.mhp += gains.hp; m.mmp += gains.mp; m.atk += gains.atk; m.def += gains.def; m.mag += gains.mag; m.spd += gains.spd;
  return gains;
}
const alive = m => m.hp > 0;

function newGame() {
  G.party = PARTY_BASE.map(b => makeMember(b));
  G.items = { ...START_ITEMS };
  G.gold = 50;
  G.map = genMap();
  resetPositions(START_POS.x, START_POS.y);
  G.steps = 0;
}
function resetPositions(x, y) {
  G.pos = G.party.map(() => ({ x, y, fx: x, fy: y, dir: 'down' }));
}

const SAVE_KEY = 'eclipse-saga-save-v1';
function saveGame() {
  const data = {
    party: G.party.map(m => ({ id: m.id, lv: m.lv, exp: m.exp, hp: m.hp, mp: m.mp, mhp: m.mhp, mmp: m.mmp, atk: m.atk, def: m.def, mag: m.mag, spd: m.spd })),
    items: G.items, gold: G.gold, x: G.pos[0].x, y: G.pos[0].y,
  };
  return storageSet(SAVE_KEY, JSON.stringify(data));
}
function loadGame() {
  const raw = storageGet(SAVE_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    G.party = d.party.map(s => Object.assign(makeMember(PARTY_BASE.find(b => b.id === s.id)), s));
    G.items = d.items; G.gold = d.gold;
    G.map = genMap();
    resetPositions(d.x, d.y);
    return true;
  } catch (e) { return false; }
}

// ============================================================
// タイル描画（手続き生成のドット絵）
// ============================================================
const TILE = 32;
const tileCache = {};
function tileRng(seed) { return mulberry32(seed * 9973 + 17); }

function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

function drawGrassBase(c, r) {
  px(c, 0, 0, 32, 32, '#5aa83c');
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * 31), y = Math.floor(r() * 30);
    px(c, x, y, 1, 2, r() < 0.5 ? '#4a9232' : '#3f8a2c');
  }
  for (let i = 0; i < 6; i++) px(c, Math.floor(r() * 31), Math.floor(r() * 31), 1, 1, '#7cc650');
}
function drawTree(c, cx, by, s, r) {
  px(c, cx - 2, by - 7 * s, 4, 7 * s, '#5b3a1e');
  px(c, cx - 1, by - 7 * s, 1, 7 * s, '#7a5230');
  const rad = 8 * s;
  c.fillStyle = '#183f1c'; c.beginPath(); c.arc(cx, by - 9 * s, rad + 1, 0, 7); c.fill();
  c.fillStyle = '#2c7a31'; c.beginPath(); c.arc(cx, by - 9 * s, rad, 0, 7); c.fill();
  c.fillStyle = '#3d9a3c'; c.beginPath(); c.arc(cx - 2 * s, by - 11 * s, rad * 0.6, 0, 7); c.fill();
  c.fillStyle = '#5cbc4c';
  for (let i = 0; i < 4; i++) px(c, cx - 5 * s + Math.floor(r() * 6 * s), by - 15 * s + Math.floor(r() * 6 * s), 2, 1, '#5cbc4c');
}
function makeTile(type, variant, frame) {
  const key = type + ':' + variant + ':' + frame;
  if (tileCache[key]) return tileCache[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
  const c = cv.getContext('2d');
  const r = tileRng(type * 31 + variant * 7 + 1);
  switch (type) {
    case T.GRASS: case T.CASTLE: drawGrassBase(c, r); break;
    case T.FLOWER: {
      drawGrassBase(c, r);
      const cols = ['#ffffff', '#ffe066', '#ff8fb8', '#ffffff'];
      for (let i = 0; i < 5; i++) {
        const x = 3 + Math.floor(r() * 25), y = 3 + Math.floor(r() * 25), col = pick(cols);
        px(c, x, y - 1, 1, 1, col); px(c, x - 1, y, 3, 1, col); px(c, x, y + 1, 1, 1, col); px(c, x, y, 1, 1, '#d08a20');
      }
      break;
    }
    case T.SAND: {
      px(c, 0, 0, 32, 32, '#e6d39a');
      for (let i = 0; i < 18; i++) px(c, Math.floor(r() * 31), Math.floor(r() * 31), 1, 1, r() < 0.5 ? '#d2bb7c' : '#f4e6b8');
      break;
    }
    case T.PATH: {
      drawGrassBase(c, r);
      px(c, 0, 3, 32, 26, '#b98d55');
      px(c, 0, 4, 32, 24, '#cfa368');
      for (let i = 0; i < 12; i++) px(c, Math.floor(r() * 30), 5 + Math.floor(r() * 21), 2, 1, r() < 0.5 ? '#b48650' : '#dcb47c');
      break;
    }
    case T.WATER: case T.BRIDGE: {
      px(c, 0, 0, 32, 32, '#2f6fd0');
      const off = frame * 4;
      for (let i = 0; i < 6; i++) {
        const y = (i * 6 + 2) % 32, x = (Math.floor(r() * 24) + off) % 32;
        px(c, x, y, 6, 1, '#5d98ec'); px(c, (x + 14) % 32, (y + 3) % 32, 4, 1, '#4884e0');
      }
      if (type === T.BRIDGE) {
        px(c, 4, 0, 24, 32, '#7a4e28');
        for (let y = 0; y < 32; y += 4) { px(c, 4, y, 24, 3, '#a8703c'); px(c, 4, y + 3, 24, 1, '#5b3a1e'); }
        px(c, 3, 0, 2, 32, '#4a2e16'); px(c, 27, 0, 2, 32, '#4a2e16');
      }
      break;
    }
    case T.FOREST: {
      drawGrassBase(c, r);
      if (variant % 2) { drawTree(c, 9, 30, 0.9, r); drawTree(c, 23, 26, 0.95, r); }
      else { drawTree(c, 22, 30, 0.9, r); drawTree(c, 10, 25, 0.95, r); }
      break;
    }
    case T.MOUNT: {
      drawGrassBase(c, r);
      const peak = 8 + Math.floor(r() * 10);
      c.fillStyle = '#3b3229';
      c.beginPath(); c.moveTo(-1, 31); c.lineTo(peak, 1); c.lineTo(33, 31); c.fill();
      c.fillStyle = '#9a8670';
      c.beginPath(); c.moveTo(1, 30); c.lineTo(peak, 3); c.lineTo(31, 30); c.fill();
      c.fillStyle = '#76644f';
      c.beginPath(); c.moveTo(peak, 3); c.lineTo(31, 30); c.lineTo(peak + 4, 30); c.fill();
      c.fillStyle = '#f2f4f8';
      c.beginPath(); c.moveTo(peak, 3); c.lineTo(peak - 5, 11); c.lineTo(peak - 2, 10); c.lineTo(peak, 12); c.lineTo(peak + 3, 10); c.lineTo(peak + 5, 11); c.fill();
      for (let i = 0; i < 5; i++) px(c, peak - 6 + Math.floor(r() * 14), 16 + Math.floor(r() * 12), 2, 1, '#665544');
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

// ============================================================
// フィールド
// ============================================================
const field = { cv: null, ctx: null, W: 352, H: 352, moving: false, t: 0, speed: 0, anim: 0, input: null, dash: false, lastTs: 0 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ENCOUNTER_RATE = { [T.GRASS]: 20, [T.FLOWER]: 20, [T.FOREST]: 11, [T.SAND]: 24, [T.PATH]: 48, [T.BRIDGE]: 0 };

function zoneAt(x, y) {
  const d = Math.hypot(x - (CASTLE_POS.x + 1), y - (CASTLE_POS.y + 1));
  return ZONES.find(z => d <= z.maxDist);
}

function resizeField() {
  const wrap = $('#field-wrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  field.W = 352;
  field.H = clamp(Math.floor(field.W * h / w), 240, 720);
  field.cv.width = field.W * R; field.cv.height = field.H * R;
  const cssW = Math.min(w, h * field.W / field.H);
  field.cv.style.width = cssW + 'px';
  field.cv.style.height = (cssW * field.H / field.W) + 'px';
  field.ctx.imageSmoothingEnabled = false;
}

// 向きごとの2コマ歩行。右向きは左向きを左右反転して使う
const WALK_FRAMES = { down: ['stand0', 'walk1'], up: ['stand2', 'walk4'], left: ['walk2', 'walk3'], right: ['walk2', 'walk3'] };
function spriteFor(id, dir, step) {
  return images[`${id}_${WALK_FRAMES[dir][step]}`];
}

function tryMove(dir) {
  const lead = G.pos[0];
  lead.dir = dir;
  const [dx, dy] = DIRS[dir];
  const nx = lead.x + dx, ny = lead.y + dy;
  if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return false;
  const t = G.map[ny][nx];
  if (t === T.CASTLE) { enterCastle(); return false; }
  if (!isWalkable(t)) return false;
  // 隊列：後ろのメンバーは前のメンバーがいた位置へ
  for (let i = G.pos.length - 1; i >= 1; i--) {
    const p = G.pos[i], q = G.pos[i - 1];
    p.fx = p.x; p.fy = p.y;
    if (p.x !== q.x || p.y !== q.y) {
      p.dir = q.x > p.x ? 'right' : q.x < p.x ? 'left' : q.y > p.y ? 'down' : 'up';
    }
    p.x = q.x; p.y = q.y;
  }
  lead.fx = lead.x; lead.fy = lead.y; lead.x = nx; lead.y = ny;
  field.moving = true; field.t = 0;
  return true;
}

function onArrive() {
  G.steps++;
  const lead = G.pos[0];
  const t = G.map[lead.y][lead.x];
  updateHud();
  if (G.safeSteps > 0) { G.safeSteps--; return; }
  const rate = ENCOUNTER_RATE[t] || 0;
  if (rate && Math.random() < 1 / rate) {
    const zone = zoneAt(lead.x, lead.y);
    startBattle(rollEncounter(zone));
  }
}

function rollEncounter(zone) {
  const total = zone.table.reduce((s, e) => s + e[1], 0);
  const roll1 = () => { let r = Math.random() * total; for (const [id, w] of zone.table) { if ((r -= w) < 0) return id; } return zone.table[0][0]; };
  const first = roll1();
  if (first === 'darkdragon' || first === 'metalslime') return [first];
  const n = ri(1, zone.max);
  const list = [first];
  for (let i = 1; i < n; i++) { const id = roll1(); if (id !== 'darkdragon' && id !== 'metalslime') list.push(id); }
  return list;
}

function updateField(dt) {
  field.anim += dt;
  if (G.mode !== 'field') return;
  if (field.moving) {
    const dur = field.dash ? 110 : 190;
    field.t += dt / dur;
    if (field.t >= 1) {
      field.t = 1; field.moving = false;
      for (const p of G.pos) { p.fx = p.x; p.fy = p.y; }
      Sfx.play('step');
      onArrive();
    }
  }
  if (!field.moving && G.mode === 'field' && field.input) tryMove(field.input);
}

function drawField() {
  const c = field.ctx, W = field.W, H = field.H;
  c.setTransform(R, 0, 0, R, 0, 0);
  c.imageSmoothingEnabled = false;
  const t = field.moving ? field.t : 1;
  const posPx = p => ({ x: (p.fx + (p.x - p.fx) * t) * TILE, y: (p.fy + (p.y - p.fy) * t) * TILE });
  const lp = posPx(G.pos[0]);
  const camX = Math.round(clamp(lp.x + TILE / 2 - W / 2, 0, MAP_W * TILE - W));
  const camY = Math.round(clamp(lp.y + TILE / 2 - H / 2, 0, MAP_H * TILE - H));
  const frame = Math.floor(field.anim / 500) % 2;
  const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
  const x1 = Math.min(MAP_W - 1, Math.ceil((camX + W) / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((camY + H) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tt = G.map[y][x];
    const variant = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const v = tt === T.WATER || tt === T.BRIDGE ? variant % 3 : variant % 4;
    const sx = x * TILE - camX, sy = y * TILE - camY;
    c.drawImage(makeTile(tt, v, tt === T.WATER || tt === T.BRIDGE ? frame : 0), sx, sy);
    if (tt === T.WATER) { // 岸の白波
      const land = (xx, yy) => xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H && G.map[yy][xx] !== T.WATER && G.map[yy][xx] !== T.BRIDGE;
      c.fillStyle = frame ? '#cfe6ff' : '#a9d0ff';
      if (land(x, y - 1)) c.fillRect(sx, sy, TILE, 2);
      if (land(x, y + 1)) c.fillRect(sx, sy + TILE - 2, TILE, 2);
      if (land(x - 1, y)) c.fillRect(sx, sy, 2, TILE);
      if (land(x + 1, y)) c.fillRect(sx + TILE - 2, sy, 2, TILE);
    }
  }
  // 城
  c.drawImage(castleSprite, CASTLE_POS.x * TILE - camX, CASTLE_POS.y * TILE - camY + 64 - 76);
  // キャラクター（奥から順に）
  const order = G.pos.map((p, i) => ({ p, i, pp: posPx(p) })).sort((a, b) => a.pp.y - b.pp.y || b.i - a.i);
  const walkFrame = Math.floor(field.anim / 160) % 2;
  for (const { p, i, pp } of order) {
    const m = G.party[i];
    const moving = field.moving && (p.x !== p.fx || p.y !== p.fy);
    const img = spriteFor(m.id, p.dir, moving ? walkFrame : 0);
    if (!img) continue;
    const h = 42, w = img.width * h / img.height;
    const cx = pp.x + TILE / 2 - camX, by = pp.y + TILE - 2 - camY;
    const bob = moving && walkFrame ? -1 : 0;
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(cx, by, 9, 3.5, 0, 0, 7); c.fill();
    c.save();
    if (!alive(m)) c.globalAlpha = 0.45;
    const flip = p.dir === 'right';
    c.imageSmoothingEnabled = true;
    if (flip) { c.translate(cx, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, by - h + bob, w, h); }
    else c.drawImage(img, cx - w / 2, by - h + bob, w, h);
    c.restore();
    // 森の中では足元を木で隠す
    const tx = Math.round(pp.x / TILE), ty = Math.round(pp.y / TILE);
    if (G.map[ty] && G.map[ty][tx] === T.FOREST && !moving) {
      const tile = makeTile(T.FOREST, (((tx * 73856093) ^ (ty * 19349663)) >>> 0) % 4, 0);
      c.drawImage(tile, 0, 20, TILE, 12, tx * TILE - camX, ty * TILE + 20 - camY, TILE, 12);
    }
  }
}

function updateHud() {
  const lead = G.pos[0];
  const z = zoneAt(lead.x, lead.y);
  $('#zone-name').textContent = z.name;
  $('#zone-danger').textContent = '★'.repeat(z.danger) + '☆'.repeat(3 - z.danger);
  $('#gold').textContent = G.gold + ' G';
  const box = $('#hud-party');
  if (box.children.length !== G.party.length) {
    box.innerHTML = G.party.map(m => `<div class="mini" data-id="${m.id}"><img src="${IMG_DIR}${m.id}_face.png" alt=""><div class="mini-bars"><span class="mini-name"></span><i class="bar hp"><b></b></i><i class="bar mp"><b></b></i></div></div>`).join('');
  }
  G.party.forEach((m, i) => {
    const el = box.children[i];
    el.classList.toggle('dead', !alive(m));
    el.querySelector('.mini-name').textContent = m.name;
    el.querySelector('.hp b').style.width = (100 * m.hp / m.mhp) + '%';
    el.querySelector('.mp b').style.width = (100 * m.mp / m.mmp) + '%';
  });
}

function toast(text, ms = 1800) {
  const el = $('#toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => { el.hidden = true; }, ms);
}

// ============================================================
// ダイアログ・メニュー
// ============================================================
function dialog(text, buttons) {
  return new Promise(res => {
    const d = $('#dialog');
    $('#dialog-text').textContent = text;
    const bx = $('#dialog-btns');
    bx.innerHTML = '';
    buttons.forEach((b, i) => {
      const el = document.createElement('button');
      el.className = 'btn'; el.textContent = b;
      el.onclick = () => { Sfx.play(i === buttons.length - 1 && buttons.length > 1 ? 'cancel' : 'ok'); d.hidden = true; res(i); };
      bx.appendChild(el);
    });
    d.hidden = false;
  });
}

async function enterCastle() {
  if (G.mode !== 'field') return;
  G.mode = 'busy'; field.input = null;
  const r = await dialog('お城に もどってきた。\n宿屋で やすみますか？（無料・セーブもします）', ['やすむ', 'やめる']);
  if (r === 0) {
    await fade(true);
    G.party.forEach(m => { m.hp = m.mhp; m.mp = m.mmp; });
    const ok = saveGame();
    updateHud();
    await sleep(300);
    await fade(false);
    Sfx.play('heal');
    await dialog('ぐっすり やすんだ。\nHPとMPが ぜんかいふくした！' + (ok ? '\n（セーブしました）' : '\n（このブラウザではセーブできません）'), ['OK']);
  }
  G.mode = 'field';
}

function fade(on, ms = 350) {
  const f = $('#fade');
  f.style.transitionDuration = ms + 'ms';
  f.classList.toggle('on', on);
  return sleep(ms);
}

function openMenu() {
  if (G.mode !== 'field') return;
  G.mode = 'busy'; field.input = null;
  Sfx.play('ok');
  renderMenu();
  $('#menu').hidden = false;
}
function closeMenu() {
  $('#menu').hidden = true;
  G.mode = 'field';
  updateHud();
}
function renderMenu(note = '') {
  const st = $('#menu-status');
  st.innerHTML = G.party.map(m => {
    const next = expForLevel(m.lv + 1) - m.exp;
    return `<div class="card ${alive(m) ? '' : 'dead'}">
      <img class="face" src="${IMG_DIR}${m.id}_face.png" alt="">
      <div class="card-body">
        <div class="card-head"><b>${m.name}</b><span>Lv ${m.lv}</span></div>
        <div class="card-job">${m.base.job}・${m.base.role}</div>
        <div class="stat-row"><span>HP</span><i class="bar hp"><b style="width:${100 * m.hp / m.mhp}%"></b></i><span class="num">${m.hp}/${m.mhp}</span></div>
        <div class="stat-row"><span>MP</span><i class="bar mp"><b style="width:${100 * m.mp / m.mmp}%"></b></i><span class="num">${m.mp}/${m.mmp}</span></div>
        <div class="stat-grid"><span>攻撃 ${m.atk}</span><span>守備 ${m.def}</span><span>魔力 ${m.mag}</span><span>素早さ ${m.spd}</span></div>
        <div class="card-next">つぎのレベルまで ${next} EXP</div>
      </div></div>`;
  }).join('');
  const it = $('#menu-items');
  it.innerHTML = Object.entries(ITEMS).map(([id, item]) =>
    `<button class="item-btn" data-item="${id}" ${G.items[id] ? '' : 'disabled'}><b>${item.name}</b><span>×${G.items[id] || 0}</span><small>${item.desc}</small></button>`).join('');
  it.querySelectorAll('button').forEach(b => b.onclick = () => useItemInField(b.dataset.item));
  $('#menu-gold').textContent = G.gold + ' G';
  $('#menu-note').textContent = note;
  $('#btn-sound').textContent = '効果音：' + (Sfx.on ? 'ON' : 'OFF');
}
async function useItemInField(id) {
  const item = ITEMS[id];
  const cands = G.party.filter(m => item.kind === 'revive' ? !alive(m) : alive(m));
  if (!cands.length) { renderMenu('つかえる あいてが いません'); return; }
  const names = cands.map(m => `${m.name}（HP ${m.hp}/${m.mhp}）`);
  const i = await dialog(`${item.name}を だれに つかう？`, [...names, 'やめる']);
  if (i >= cands.length) { renderMenu(); return; }
  const m = cands[i];
  G.items[id]--;
  const msg = applyItem(item, m);
  Sfx.play('heal');
  renderMenu(msg);
}
function applyItem(item, m) {
  if (item.kind === 'heal') { const v = Math.min(item.amount, m.mhp - m.hp); m.hp += v; return `${m.name}の HPが ${v} かいふくした！`; }
  if (item.kind === 'mp') { const v = Math.min(item.amount, m.mmp - m.mp); m.mp += v; return `${m.name}の MPが ${v} かいふくした！`; }
  if (item.kind === 'revive') {
    if (alive(m)) return 'しかし なにも おこらなかった。';
    m.hp = Math.floor(m.mhp / 2); return `${m.name}は いきかえった！`;
  }
  return '';
}

// ============================================================
// バトル
// ============================================================
const battle = { cv: null, ctx: null, W: 352, H: 290, bg: null };
let B = null; // 現在のバトル

const PARTY_SPOTS = [[86, 166], [62, 198], [90, 232], [66, 266]];
const ENEMY_SPOTS = {
  1: [[262, 230]],
  2: [[228, 196], [304, 244]],
  3: [[222, 178], [306, 200], [252, 262]],
};

function makeBattleBg(zone) {
  const cv = document.createElement('canvas');
  cv.width = battle.W * R; cv.height = battle.H * R;
  const c = cv.getContext('2d');
  c.scale(R, R);
  const sky = images.bg_sky;
  const skyH = sky ? battle.W * sky.height / sky.width : 110;
  const tint = zone.danger === 3 ? ['#5d6f3c', '#4a5a2e', '#3c4a24'] : zone.danger === 2 ? ['#6f9a3c', '#5d8a32', '#4b7a2a'] : ['#7cb444', '#68a23a', '#57902f'];
  if (sky) { c.imageSmoothingEnabled = true; c.drawImage(sky, 0, 0, battle.W, skyH); }
  const gy = Math.floor(skyH) - 6;
  const grad = c.createLinearGradient(0, gy, 0, battle.H);
  grad.addColorStop(0, tint[0]); grad.addColorStop(0.5, tint[1]); grad.addColorStop(1, tint[2]);
  c.fillStyle = grad; c.fillRect(0, gy, battle.W, battle.H - gy);
  // 地平線をなじませる
  const g2 = c.createLinearGradient(0, gy - 10, 0, gy + 8);
  g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, tint[0]);
  c.fillStyle = g2; c.fillRect(0, gy - 10, battle.W, 18);
  // 土の道
  c.fillStyle = 'rgba(160,120,70,0.55)';
  c.beginPath(); c.ellipse(battle.W / 2, battle.H - 30, battle.W * 0.62, 46, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(190,150,95,0.45)';
  c.beginPath(); c.ellipse(battle.W / 2, battle.H - 28, battle.W * 0.5, 34, 0, 0, 7); c.fill();
  const r = mulberry32(zone.danger * 99);
  for (let i = 0; i < 160; i++) {
    const x = r() * battle.W, y = gy + 4 + r() * (battle.H - gy);
    c.fillStyle = r() < 0.5 ? 'rgba(30,70,20,0.45)' : 'rgba(150,210,90,0.35)';
    c.fillRect(Math.floor(x), Math.floor(y), 1, 2 + Math.floor(r() * 2));
  }
  if (zone.danger === 3) { c.fillStyle = 'rgba(60,20,80,0.22)'; c.fillRect(0, 0, battle.W, battle.H); }
  return cv;
}

function makeEnemy(id, i, n) {
  const d = MONSTERS[id];
  const [x, y] = ENEMY_SPOTS[n][i];
  return { id, data: d, name: d.name, hp: d.hp, mhp: d.hp, atk: d.atk, def: d.def, spd: d.spd,
    x, y, k: 0.9 * d.scale * (n >= 3 ? 0.85 : 1), blink: 0, dying: 0, gone: false, fled: false, ox: 0 };
}

function nameEnemies(enemies) {
  // 同名モンスターに A, B, C を付ける
  const count = {};
  enemies.forEach(e => count[e.data.name] = (count[e.data.name] || 0) + 1);
  const seen = {};
  enemies.forEach(e => {
    if (count[e.data.name] > 1) { seen[e.data.name] = (seen[e.data.name] || 0) + 1; e.name = e.data.name + 'ABC'[seen[e.data.name] - 1]; }
  });
}

async function startBattle(ids) {
  G.mode = 'battle'; field.input = null;
  Sfx.play('encounter');
  // エンカウント演出
  const fl = $('#flash');
  for (let i = 0; i < 3; i++) { fl.classList.add('on'); await sleep(70); fl.classList.remove('on'); await sleep(70); }
  await fade(true, 300);
  const zone = zoneAt(G.pos[0].x, G.pos[0].y);
  B = {
    enemies: ids.map((id, i) => makeEnemy(id, i, ids.length)),
    fx: [], parts: [], nums: [], shake: 0, flash: 0, flashColor: '#ffffff', dim: 0, dimColor: '#000000', guard: 0,
    active: null, targetSel: null, actors: {}, over: false, zone,
  };
  nameEnemies(B.enemies);
  G.party.forEach((m, i) => B.actors[m.id] = { x: PARTY_SPOTS[i][0], y: PARTY_SPOTS[i][1], ox: 0, pose: 0, blink: 0, hurt: 0 });
  battle.bg = makeBattleBg(zone);
  $('#field-view').hidden = true;
  $('#battle-view').hidden = false;
  resizeBattle();
  renderBattleStatus();
  setCmd([]);
  await fade(false, 300);
  const names = [...new Set(B.enemies.map(e => e.data.name))];
  await say(names.length === 1 && B.enemies.length > 1 ? `${names[0]}たちが あらわれた！` : `${names.join('と')}が あらわれた！`, 900);
  battleLoop();
}

async function battleLoop() {
  while (!B.over) {
    const input = await inputPhase();
    if (input.run) {
      setCmd([]);
      await say('レオンたちは にげだした！', 600);
      if (Math.random() < 0.65) { Sfx.play('run'); await say('うまく にげきれた！', 700); return endBattle('run'); }
      await say('しかし まわりこまれてしまった！', 800);
      await execTurn([]);
    } else {
      await execTurn(input.cmds);
    }
  }
}

// ---------- 入力フェーズ ----------
let uiResolve = null;
function setCmd(buttons, opts = {}) {
  const box = $('#cmd');
  box.innerHTML = '';
  box.className = 'win' + (opts.list ? ' list' : '');
  if (opts.title) {
    const h = document.createElement('div'); h.className = 'cmd-title'; h.textContent = opts.title; box.appendChild(h);
  }
  buttons.forEach(b => {
    const el = document.createElement('button');
    el.className = 'cmd-btn' + (b.back ? ' back' : '');
    el.innerHTML = b.label + (b.sub ? `<small>${b.sub}</small>` : '');
    el.disabled = !!b.disabled;
    el.onclick = () => { if (!uiResolve) return; Sfx.play(b.back ? 'cancel' : 'cursor'); const r = uiResolve; uiResolve = null; r(b.value); };
    box.appendChild(el);
  });
}
function waitChoice(buttons, opts) {
  return new Promise(res => { uiResolve = res; setCmd(buttons, opts); });
}

async function inputPhase() {
  const members = G.party.filter(alive);
  const cmds = [];
  let i = 0;
  while (i < members.length) {
    const m = members[i];
    B.active = m; renderBattleStatus();
    setMsg(`${m.name}は どうする？`);
    const c = await chooseCommand(m, i > 0);
    if (c === 'back') { i--; cmds.pop(); continue; }
    if (c.type === 'run') { B.active = null; renderBattleStatus(); return { run: true }; }
    cmds.push(c); i++;
  }
  B.active = null; renderBattleStatus(); setCmd([]);
  return { cmds };
}

async function chooseCommand(m, canBack) {
  for (;;) {
    const top = [
      { label: 'たたかう', value: 'attack' },
      { label: 'スキル', value: 'skill' },
      { label: 'まほう', value: 'magic' },
      { label: 'アイテム', value: 'item' },
      { label: 'にげる', value: 'run' },
    ];
    if (canBack) top.push({ label: 'もどる', value: 'back', back: true });
    const v = await waitChoice(top);
    if (v === 'back') return 'back';
    if (v === 'run') return { type: 'run' };
    if (v === 'attack') {
      const t = await pickTarget('enemy', m);
      if (t === null) continue;
      return { actor: m, type: 'attack', target: t };
    }
    if (v === 'skill' || v === 'magic') {
      const list = m.base.skills.filter(s => SKILLS[s].type === v);
      if (!list.length) { setMsg(`${m.name}は ${v === 'skill' ? 'スキル' : 'まほう'}を おぼえていない。`); continue; }
      const btns = list.map(s => ({ label: SKILLS[s].name, sub: `MP ${SKILLS[s].mp}`, value: s, disabled: m.mp < SKILLS[s].mp }));
      btns.push({ label: 'もどる', value: 'back', back: true });
      setMsg(`${m.name}　MP ${m.mp}/${m.mmp}`);
      const s = await waitChoice(btns, { list: true, title: v === 'skill' ? 'スキル' : 'まほう' });
      if (s === 'back') { setMsg(`${m.name}は どうする？`); continue; }
      const t = await pickTarget(SKILLS[s].target, m);
      if (t === null) { setMsg(`${m.name}は どうする？`); continue; }
      return { actor: m, type: 'skill', skill: s, target: t };
    }
    if (v === 'item') {
      const ids = Object.keys(ITEMS).filter(id => G.items[id] > 0);
      if (!ids.length) { setMsg('アイテムを もっていない。'); continue; }
      const btns = ids.map(id => ({ label: ITEMS[id].name, sub: `×${G.items[id]}`, value: id }));
      btns.push({ label: 'もどる', value: 'back', back: true });
      const id = await waitChoice(btns, { list: true, title: 'アイテム' });
      if (id === 'back') { setMsg(`${m.name}は どうする？`); continue; }
      const t = await pickTarget(ITEMS[id].target, m);
      if (t === null) { setMsg(`${m.name}は どうする？`); continue; }
      return { actor: m, type: 'item', item: id, target: t };
    }
  }
}

// 対象選択。全体対象はそのまま返す。キャンセルで null
async function pickTarget(kind, m) {
  if (kind === 'enemies' || kind === 'allies') return kind;
  let cands;
  if (kind === 'enemy') cands = B.enemies.filter(e => !e.gone);
  else if (kind === 'ally') cands = G.party.filter(alive);
  else if (kind === 'deadally') cands = G.party.filter(x => !alive(x));
  if (!cands.length) { setMsg('たいしょうが いない。'); return null; }
  setMsg(kind === 'enemy' ? 'だれを こうげきする？（敵をタップしてもOK）' : 'だれに つかう？');
  B.targetSel = { kind, cands, idx: 0 };
  const btns = cands.map((c, i) => ({ label: c.name, sub: c.mhp && kind !== 'enemy' ? `HP ${c.hp}/${c.mhp}` : '', value: i }));
  btns.push({ label: 'もどる', value: 'back', back: true });
  const v = await waitChoice(btns, { list: true, title: 'たいしょう' });
  B.targetSel = null;
  if (v === 'back') return null;
  return cands[v];
}

function onBattleTap(ev) {
  if (!B || !B.targetSel || B.targetSel.kind !== 'enemy' || !uiResolve) return;
  const rect = battle.cv.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * battle.W / rect.width, y = (ev.clientY - rect.top) * battle.H / rect.height;
  let best = -1, bd = 1e9;
  B.targetSel.cands.forEach((e, i) => {
    const img = images['mon_' + e.id];
    const h = img ? img.height * e.k : 60;
    const d = Math.hypot(x - e.x, y - (e.y - h / 2));
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0 && bd < 70) { Sfx.play('cursor'); const r = uiResolve; uiResolve = null; r(best); }
}

// ---------- 実行フェーズ ----------
async function execTurn(cmds) {
  const acts = [...cmds];
  for (const e of B.enemies) if (!e.gone) acts.push({ actor: e, type: 'enemy' });
  acts.forEach(a => a.order = a.actor.spd * rand(0.75, 1.25));
  acts.sort((a, b) => b.order - a.order);
  for (const a of acts) {
    if (B.over) break;
    if (a.type === 'enemy' ? a.actor.gone : !alive(a.actor)) continue;
    if (a.type === 'enemy') await enemyAct(a.actor);
    else await partyAct(a);
    renderBattleStatus();
    if (await checkEnd()) return;
  }
  if (B.guard > 0) { B.guard--; if (B.guard === 0) await say('鉄壁の こうかが きれた。', 600); }
}

function livingEnemies() { return B.enemies.filter(e => !e.gone); }
function retarget(t) {
  if (t && !t.gone) return t;
  const l = livingEnemies();
  return l.length ? pick(l) : null;
}

async function stepForward(m, pose) {
  const a = B.actors[m.id];
  a.pose = pose;
  for (let i = 0; i <= 6; i++) { a.ox = i * 3; await sleep(16); }
}
async function stepBack(m) {
  const a = B.actors[m.id];
  for (let i = 6; i >= 0; i--) { a.ox = i * 3; await sleep(16); }
  a.pose = 0;
}

function physDamage(atk, power, def, crit) {
  if (crit) return Math.max(1, Math.round(atk * power * 1.6 * rand(0.95, 1.05)));
  return Math.max(1, Math.round(atk * power * rand(0.9, 1.1) - def * 0.4));
}

async function partyAct(a) {
  const m = a.actor;
  if (a.type === 'attack') {
    const t = retarget(a.target);
    if (!t) return;
    await stepForward(m, 2);
    await say(`${m.name}の こうげき！`, 250);
    const fx = spawnFx('slash', t);
    await sleep(fx.dur * fx.hit);
    await hitEnemy(t, m.atk, 1.0, 'phys');
    await stepBack(m);
  } else if (a.type === 'skill') {
    const s = SKILLS[a.skill];
    if (m.mp < s.mp) { await say(`${m.name}は ${s.name}を となえようとした！\nしかし MPが たりない！`, 900); return; }
    m.mp -= s.mp; renderBattleStatus();
    await stepForward(m, s.type === 'magic' ? 1 : 2);
    await say(`${m.name}は ${s.name}を ${s.type === 'magic' ? 'となえた' : 'はなった'}！`, 300);
    if (s.type === 'magic') { Sfx.play('magic'); await sleep(spawnCast(m, s).dur * 0.85); }
    await applySkill(m, s, a.target);
    await stepBack(m);
  } else if (a.type === 'item') {
    const item = ITEMS[a.item];
    if (!G.items[a.item]) { await say(`しかし ${item.name}は もう なかった！`, 800); return; }
    let t = a.target;
    G.items[a.item]--;
    await stepForward(m, 1);
    await say(`${m.name}は ${item.name}を つかった！`, 350);
    const fx = spawnFx(item.kind === 'revive' ? 'holy' : 'heal', t);
    Sfx.play('heal');
    await sleep(fx.dur * fx.hit);
    const msg = applyItem(item, t);
    if (item.kind === 'heal' || item.kind === 'mp') popNum(t, msg.match(/\d+/) ? msg.match(/\d+/)[0] : '0', item.kind === 'mp' ? '#7fc8ff' : '#7dff8a');
    renderBattleStatus();
    await say(msg, 800);
    await stepBack(m);
  }
}

async function applySkill(m, s, target) {
  if (s.kind === 'phys' || s.kind === 'mag') {
    const targets = target === 'enemies' ? livingEnemies() : [retarget(target)].filter(Boolean);
    if (target === 'enemies') {
      const fx = spawnFx(s.fx, null);
      await sleep(fx.dur * fx.hit);
      for (const t of targets) await hitEnemy(t, s.kind === 'phys' ? m.atk : m.mag, s.power, s.kind, 260);
    } else {
      for (const t of targets) { const fx = spawnFx(s.fx, t); await sleep(fx.dur * fx.hit); await hitEnemy(t, s.kind === 'phys' ? m.atk : m.mag, s.power, s.kind); }
    }
  } else if (s.kind === 'heal') {
    const targets = target === 'allies' ? G.party.filter(alive) : [target];
    Sfx.play('heal');
    targets.forEach(t => spawnFx('heal', t));
    await sleep(FX.heal.dur * FX.heal.hit);
    const lines = [];
    for (const t of targets) {
      if (!alive(t)) { lines.push(`${t.name}には こうかが なかった。`); continue; }
      const v = Math.min(t.mhp - t.hp, Math.round((m.mag * s.power + s.base) * rand(0.95, 1.05)));
      t.hp += v; popNum(t, v, '#7dff8a');
      if (targets.length === 1) lines.push(`${t.name}の HPが ${v} かいふくした！`);
    }
    if (targets.length > 1) lines.push('みんなの HPが かいふくした！');
    renderBattleStatus();
    await say(lines.join('\n'), 800);
  } else if (s.kind === 'revive') {
    Sfx.play('heal');
    spawnFx('holy', target);
    await sleep(FX.holy.dur * FX.holy.hit);
    if (alive(target)) { await say('しかし なにも おこらなかった。', 700); return; }
    target.hp = Math.floor(target.mhp / 2);
    renderBattleStatus();
    await say(`${target.name}は いきかえった！`, 800);
  } else if (s.kind === 'guard') {
    spawnFx('guard', 'party');
    Sfx.play('magic');
    B.guard = 3;
    await sleep(FX.guard.dur * 0.7);
    await say('みんなの 守りが かたくなった！（3ターン）', 800);
  }
}

async function hitEnemy(t, stat, power, kind, wait = 500) {
  if (t.gone) return;
  let dmg, crit = false, msg;
  if (kind === 'phys' && Math.random() < 0.04) {
    t.ox = 10; setTimeout(() => t.ox = 0, 200);
    Sfx.play('cancel');
    await say(`ミス！ ${t.name}は ひらりと みをかわした！`, 600);
    return;
  }
  if (t.data.metal) {
    crit = kind === 'phys' && Math.random() < 0.12;
    dmg = crit ? t.hp : (kind === 'mag' ? 0 : ri(0, 2));
  } else if (kind === 'phys') {
    crit = Math.random() < 0.07;
    dmg = physDamage(stat, power, t.def, crit);
  } else {
    dmg = Math.max(1, Math.round(stat * power * rand(0.9, 1.1) - t.def * 0.15));
  }
  t.hp = Math.max(0, t.hp - dmg);
  t.blink = 400; t.hitFlash = 110;
  B.shake = Math.max(B.shake, crit ? 8 : 3);
  const tp = targetPoint(t);
  burst(tp.x, tp.y, crit ? 22 : 8, { color: crit ? ['#ffd23f', '#ffffff'] : ['#ffffff', '#ffe8b0'], add: true, shape: 'spark', min: 0.08, max: crit ? 0.35 : 0.2, life: 300 });
  if (crit) flash(0.5, '#fff6d0');
  Sfx.play(crit ? 'crit' : 'hit');
  popNum(t, dmg, crit ? '#ffd23f' : '#ffffff');
  msg = (crit ? 'かいしんの いちげき！\n' : '') + (dmg === 0 ? `${t.name}には きいていない！` : `${t.name}に ${dmg}の ダメージ！`);
  await say(msg, wait);
  if (t.hp <= 0) {
    t.gone = true; t.dying = 1;
    Sfx.play('die');
    await say(`${t.name}を たおした！`, 450);
  }
}

async function enemyAct(e) {
  const d = e.data;
  if (d.metal && Math.random() < 0.45) {
    e.gone = true; e.fled = true; e.dying = 1;
    Sfx.play('run');
    await say(`${e.name}は にげだした！`, 700);
    return;
  }
  const targets = G.party.filter(alive);
  if (!targets.length) return;
  const sp = d.special && Math.random() < 0.3 ? d.special : null;
  e.ox = -14;
  if (sp) {
    await say(`${e.name}の ${sp.name}！`, 350);
    const hit = sp.all ? targets : [pick(targets)];
    const fx = spawnFx(sp.fx || 'claw', sp.all ? 'party' : hit[0], { src: e });
    await sleep(fx.dur * fx.hit);
    let total = 0;
    const lines = [];
    for (const t of hit) {
      const v = hurtMember(t, e.atk * sp.power, sp.pierce);
      total += v;
      if (!sp.all) lines.push(`${t.name}は ${v}の ダメージを うけた！`);
    }
    if (sp.all) lines.push('みんなは ダメージを うけた！');
    if (sp.drain) { const h = Math.min(e.mhp - e.hp, Math.round(total / 2)); e.hp += h; lines.push(`${e.name}の HPが ${h} かいふくした。`); }
    renderBattleStatus();
    await say(lines.join('\n'), 750);
  } else {
    await say(`${e.name}の こうげき！`, 300);
    const t = pick(targets);
    const fx = spawnFx('claw', t);
    await sleep(fx.dur * fx.hit);
    if (Math.random() < 0.05) { Sfx.play('cancel'); await say(`${t.name}は ひらりと みをかわした！`, 600); e.ox = 0; return; }
    const v = hurtMember(t, e.atk, false);
    renderBattleStatus();
    await say(`${t.name}は ${v}の ダメージを うけた！`, 650);
  }
  e.ox = 0;
  for (const t of G.party) {
    if (t.hp <= 0 && !B.actors[t.id].downAnnounced) { B.actors[t.id].downAnnounced = true; await say(`${t.name}は たおれてしまった…`, 600); }
  }
}

function hurtMember(t, power, pierce) {
  let v = Math.round(power * 1.6 * rand(0.9, 1.1) - (pierce ? 0 : t.def * 0.4));
  if (B.guard > 0) v = Math.round(v * 0.5);
  v = Math.max(1, v);
  t.hp = Math.max(0, t.hp - v);
  const a = B.actors[t.id];
  a.hurt = 300; a.blink = 300;
  if (t.hp > 0) a.downAnnounced = false;
  B.shake = 3;
  Sfx.play('hurt');
  popNum(t, v, '#ff9c9c');
  return v;
}

async function checkEnd() {
  if (livingEnemies().length === 0) {
    B.over = true;
    await sleep(400);
    const beaten = B.enemies.filter(e => !e.fled);
    if (!beaten.length) { await say('まものたちは いなくなった。', 900); endBattle('run'); return true; }
    await victory(beaten);
    return true;
  }
  if (G.party.every(m => !alive(m))) {
    B.over = true;
    await defeat();
    return true;
  }
  return false;
}

async function victory(beaten) {
  setCmd([]);
  Sfx.play('win');
  G.party.forEach(m => { if (alive(m)) B.actors[m.id].pose = 3; });
  const exp = beaten.reduce((s, e) => s + e.data.exp, 0);
  const gold = beaten.reduce((s, e) => s + e.data.gold, 0);
  G.gold += gold;
  await say(`まものたちを やっつけた！\n${exp} の経験値と ${gold} ゴールドを てにいれた！`, 0);
  await waitTap();
  for (const m of G.party) {
    if (!alive(m)) continue;
    m.exp += exp;
    while (m.exp >= expForLevel(m.lv + 1)) {
      const g = levelUp(m);
      m.hp += g.hp; m.mp += g.mp;
      Sfx.play('lvup');
      renderBattleStatus();
      await say(`${m.name}は レベル ${m.lv}に あがった！\nHP+${g.hp}　MP+${g.mp}　攻撃+${g.atk}　守備+${g.def}　魔力+${g.mag}`, 0);
      await waitTap();
    }
  }
  if (Math.random() < 0.2) {
    const id = Math.random() < 0.75 ? 'potion' : 'ether';
    G.items[id] = (G.items[id] || 0) + 1;
    await say(`まものは ${ITEMS[id].name}を おとしていった！`, 0);
    await waitTap();
  }
  endBattle('win');
}

async function defeat() {
  setCmd([]);
  Sfx.play('lose');
  await say('レオンたちは ぜんめつしてしまった…', 0);
  await waitTap();
  G.gold = Math.floor(G.gold / 2);
  G.party.forEach(m => { m.hp = m.mhp; m.mp = m.mmp; });
  resetPositions(START_POS.x, START_POS.y);
  await endBattle('lose');
  await dialog('……気がつくと お城の まえにいた。\n（所持金が はんぶんに なった）', ['OK']);
  G.mode = 'field';
}

async function endBattle(result) {
  await fade(true, 350);
  $('#battle-view').hidden = true;
  $('#field-view').hidden = false;
  B = null;
  G.safeSteps = 5;
  for (const m of G.party) if (m.hp <= 0) m.hp = 0;
  resizeField();
  updateHud();
  await fade(false, 350);
  G.mode = result === 'lose' ? 'busy' : 'field';
}

// ---------- メッセージ ----------
function setMsg(text) { $('#msg').textContent = text; }
async function say(text, ms) { setMsg(text); if (ms) await sleep(ms); }
function waitTap() {
  return new Promise(res => {
    const m = $('#msg');
    m.classList.add('wait');
    const view = $('#battle-view');
    const h = () => { view.removeEventListener('pointerdown', h); m.classList.remove('wait'); Sfx.play('cursor'); res(); };
    setTimeout(() => view.addEventListener('pointerdown', h), 250);
  });
}

function renderBattleStatus() {
  if (!B) return;
  const box = $('#bstatus');
  if (box.children.length !== G.party.length) {
    box.innerHTML = G.party.map(m => `<div class="brow" data-id="${m.id}"><img src="${IMG_DIR}${m.id}_face.png" alt=""><div class="brow-body"><div class="brow-name"></div><div class="brow-line"><span>HP</span><i class="bar hp"><b></b></i><em class="hpn"></em></div><div class="brow-line"><span>MP</span><i class="bar mp"><b></b></i><em class="mpn"></em></div></div></div>`).join('');
  }
  G.party.forEach((m, i) => {
    const el = box.children[i];
    el.classList.toggle('active', B.active === m);
    el.classList.toggle('dead', !alive(m));
    el.classList.toggle('low', alive(m) && m.hp < m.mhp * 0.25);
    el.querySelector('.brow-name').textContent = `${m.name}  Lv${m.lv}`;
    el.querySelector('.hp b').style.width = (100 * m.hp / m.mhp) + '%';
    el.querySelector('.mp b').style.width = (100 * m.mp / m.mmp) + '%';
    el.querySelector('.hpn').textContent = m.hp;
    el.querySelector('.mpn').textContent = m.mp;
  });
}

// ---------- エフェクト ----------
function targetPoint(t) {
  if (t === 'party' || t === null) return null;
  if (t.data) { const img = images['mon_' + t.id]; const h = img ? img.height * t.k : 60; return { x: t.x, y: t.y - h / 2, fy: t.y, h }; }
  const a = B.actors[t.id];
  return { x: a.x + a.ox, y: a.y - 24, fy: a.y, h: 48 };
}
function popNum(t, v, color) {
  const p = targetPoint(t);
  if (p) B.nums.push({ x: p.x, y: p.y - 6, text: String(v), color, t: 0 });
}
function particle(o) {
  B.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 1, life: 600, t: 0, size: 2, color: '#ffffff', add: false, shape: 'dot', rot: 0, vr: 0, grow: 0 }, o));
}
function burst(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const ang = rand(0, Math.PI * 2), sp = rand(o.min || 0.05, o.max || 0.2);
    particle(Object.assign({}, o, { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: ang, color: Array.isArray(o.color) ? pick(o.color) : o.color, size: rand(o.size || 2, (o.size || 2) * 1.8), life: rand((o.life || 500) * 0.7, o.life || 500) }));
  }
}
function flash(a, color = '#ffffff') { B.flash = Math.max(B.flash, a); B.flashColor = color; }

// 色付きの光の玉（キャッシュして drawImage で描く）
const glowCache = {};
function glowSprite(col) {
  if (glowCache[col]) return glowCache[col];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col + '99'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (glowCache[col] = cv);
}
function glow(c, x, y, r, col, alpha) {
  if (alpha <= 0 || r <= 0) return;
  c.globalAlpha = Math.min(1, alpha);
  c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
}
function magicCircle(c, x, y, r, col, rot, alpha) {
  if (alpha <= 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = Math.min(1, alpha);
  c.translate(x, y); c.scale(1, 0.38);
  glow(c, 0, 0, r * 1.3, col, alpha * 0.5);
  c.globalAlpha = Math.min(1, alpha);
  c.rotate(rot);
  c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 8; c.lineWidth = 1.6;
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.8, 0, 7); c.stroke();
  for (let k = 0; k < 2; k++) {
    c.beginPath();
    for (let i = 0; i <= 3; i++) { const a = k * Math.PI / 3 + i * Math.PI * 2 / 3; c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); }
    c.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    c.beginPath(); c.moveTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84); c.lineTo(Math.cos(a) * r * (i % 2 ? 0.96 : 0.9), Math.sin(a) * r * (i % 2 ? 0.96 : 0.9)); c.stroke();
  }
  c.restore();
}
function bolt(c, x1, y1, x2, y2, seed, w, col, alpha) {
  const r = mulberry32(seed);
  const pts = [[x1, y1]];
  const n = 12;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push([x1 + (x2 - x1) * t + (r() - 0.5) * 26, y1 + (y2 - y1) * t + (r() - 0.5) * 8]);
  }
  pts.push([x2, y2]);
  const draw = (arr, lw) => {
    c.lineWidth = lw * 2.2; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 14;
    c.beginPath(); arr.forEach(p => c.lineTo(p[0], p[1])); c.stroke();
    c.lineWidth = lw * 0.7; c.strokeStyle = '#ffffff'; c.shadowBlur = 0;
    c.beginPath(); arr.forEach(p => c.lineTo(p[0], p[1])); c.stroke();
  };
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha; c.lineJoin = 'round';
  draw(pts, w);
  for (let b = 0; b < 3; b++) { // 枝分かれ
    const s = pts[2 + Math.floor(r() * (n - 4))];
    const br = [s]; let [bx, by] = s;
    for (let i = 0; i < 4; i++) { bx += (r() - 0.5) * 22 + (r() < 0.5 ? -6 : 6); by += 6 + r() * 8; br.push([bx, by]); }
    draw(br, w * 0.5);
  }
  c.restore();
}
// 三日月形の斬撃
function crescent(c, x, y, r, a0, a1, width, col, alpha) {
  if (alpha <= 0 || a1 <= a0) return;
  const mid = (a0 + a1) / 2;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, alpha);
  c.shadowColor = col; c.shadowBlur = 12;
  c.fillStyle = col;
  c.beginPath(); c.arc(x, y, r, a0, a1); c.arc(x - Math.cos(mid) * width, y - Math.sin(mid) * width, r, a1, a0, true); c.fill();
  c.fillStyle = '#ffffff'; c.shadowBlur = 0;
  c.beginPath(); c.arc(x, y, r, a0, a1); c.arc(x - Math.cos(mid) * width * 0.4, y - Math.sin(mid) * width * 0.4, r, a1, a0, true); c.fill();
  c.restore();
}
function shield(c, x, y, r, col, alpha, shine) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, alpha);
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.1); }
  c.closePath();
  c.fillStyle = col + '44'; c.fill();
  c.strokeStyle = col; c.lineWidth = 2; c.shadowColor = col; c.shadowBlur = 10; c.stroke();
  c.clip();
  c.fillStyle = '#ffffff88'; c.shadowBlur = 0;
  c.fillRect(x - r + shine * r * 2.6 - r * 0.3, y - r * 1.2, r * 0.25, r * 2.4);
  c.restore();
}

const easeOut = t => 1 - Math.pow(1 - t, 3);
const win = (p, a, b) => clamp((p - a) / (b - a), 0, 1); // p が a→b の間で 0→1

// fx 定義：dur=全体の長さ, hit=ダメージを出すタイミング（割合）, dim=画面を暗くする量
const FX = {
  slash: { dur: 340, hit: 0.45,
    draw(c, f, p, pt) {
      const k = easeOut(win(p, 0, 0.45));
      crescent(c, pt.x, pt.y, 24, -2.5, -2.5 + k * 2.6, 9, '#bfe8ff', 1 - win(p, 0.5, 1));
    },
    at: { 0.35(f, pt) { burst(pt.x, pt.y, 12, { color: ['#ffffff', '#fff1a0'], add: true, shape: 'spark', min: 0.08, max: 0.22, life: 300, size: 1.5 }); B.shake = 3; } } },
  claw: { dur: 320, hit: 0.5,
    draw(c, f, p, pt) {
      const k = easeOut(win(p, 0, 0.5));
      for (let i = -1; i <= 1; i++) crescent(c, pt.x + i * 8 - 30, pt.y - 10, 30, -0.6, -0.6 + k * 1.2, 5, '#ff5a5a', 1 - win(p, 0.55, 1));
    },
    at: { 0.4(f, pt) { burst(pt.x, pt.y, 10, { color: ['#ff8080', '#ffffff'], add: true, shape: 'spark', min: 0.06, max: 0.18, life: 300 }); } } },
  slash2: { dur: 700, hit: 0.5, dim: 0.45, dimColor: '#06142e',
    draw(c, f, p, pt) {
      const k1 = easeOut(win(p, 0.05, 0.35)), k2 = easeOut(win(p, 0.3, 0.6));
      crescent(c, pt.x, pt.y, 34, -2.6, -2.6 + k1 * 2.8, 12, '#5ff0ff', 1 - win(p, 0.45, 0.9));
      crescent(c, pt.x, pt.y, 34, -0.6, -0.6 + k2 * 2.8, 12, '#5ff0ff', 1 - win(p, 0.65, 1));
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { // 疾風の筋
        const yy = pt.y - 26 + i * 9, len = 120, xx = pt.x + 90 - win(p, 0, 0.7) * 240 - i * 9;
        c.globalAlpha = 0.7 * (1 - win(p, 0.5, 1)); c.fillStyle = i % 2 ? '#9ff8ff' : '#ffffff';
        c.fillRect(xx, yy, len * (0.4 + (i % 3) * 0.2), 1.5);
      }
      c.restore();
    },
    at: {
      0.25(f, pt) { burst(pt.x, pt.y, 14, { color: ['#9ff8ff', '#ffffff'], add: true, shape: 'spark', min: 0.1, max: 0.3, life: 350 }); B.shake = 4; Sfx.play('hit'); },
      0.5(f, pt) { burst(pt.x, pt.y, 26, { color: ['#5ff0ff', '#ffffff', '#c8fff8'], add: true, shape: 'spark', min: 0.12, max: 0.35, life: 450, size: 2 }); flash(0.5, '#cffcff'); B.shake = 7; },
    } },
  wind: { dur: 1000, hit: 0.55, dim: 0.45, dimColor: '#06220f',
    emit(f, dt, p, pts) {
      if (p > 0.85) return;
      for (const pt of pts) for (let i = 0; i < 2; i++) {
        const a = rand(0, Math.PI * 2);
        particle({ x: pt.x + Math.cos(a) * 16, y: pt.fy - rand(0, pt.h + 10), vx: -Math.sin(a) * 0.15, vy: rand(-0.12, -0.05), life: 500, color: pick(['#8cff9a', '#d8ffd0', '#4fd860']), add: true, shape: pick(['leaf', 'spark']), size: rand(1.5, 3), vr: rand(-0.02, 0.02), rot: a });
      }
    },
    draw(c, f, p, pts) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const grow = easeOut(win(p, 0, 0.3)), fade = 1 - win(p, 0.75, 1);
      for (const pt of pts) {
        for (let i = 0; i < 9; i++) { // 竜巻
          const yy = pt.fy - i * (pt.h + 16) / 9, rx = (8 + i * 3.2) * grow;
          const rot = f.t / 70 + i * 0.7;
          c.globalAlpha = 0.75 * fade; c.strokeStyle = i % 2 ? '#c8ffd0' : '#6cf080'; c.lineWidth = 2; c.shadowColor = '#6cf080'; c.shadowBlur = 8;
          c.beginPath(); c.ellipse(pt.x, yy, rx, rx * 0.3, 0, rot, rot + 3.6); c.stroke();
        }
        glow(c, pt.x, pt.y, 40 * grow, '#5cff7a', 0.35 * fade);
      }
      for (let i = 0; i < 6; i++) { // 画面を横切る突風
        c.globalAlpha = 0.5 * (1 - win(p, 0, 0.5)); c.fillStyle = '#e0ffe0'; c.shadowBlur = 0;
        c.fillRect(-60 + win(p, 0, 0.5) * 480 - i * 30, 90 + i * 28, 90, 1.5);
      }
      c.restore();
    },
    at: { 0.2() { Sfx.play('magic'); }, 0.55(f, pts) { pts.forEach(pt => burst(pt.x, pt.y, 16, { color: ['#c8ffd0', '#ffffff'], add: true, shape: 'spark', min: 0.1, max: 0.3, life: 400 })); B.shake = 5; } } },
  quake: { dur: 1000, hit: 0.5, dim: 0.35, dimColor: '#1a0c02',
    draw(c, f, p, pts) {
      const k = easeOut(win(p, 0.05, 0.45)), fade = 1 - win(p, 0.75, 1);
      c.save();
      for (const [j, pt] of pts.entries()) { // 地割れ
        const r = mulberry32(j * 13 + 5);
        const sx = 120, sy = pt.fy + 4;
        const path = [[sx, sy]];
        for (let i = 1; i <= 10; i++) path.push([sx + (pt.x - sx) * i / 10 + (r() - 0.5) * 6, sy + (pt.fy - sy) * i / 10 + (r() - 0.5) * 8]);
        const n = Math.max(1, Math.floor(path.length * k));
        c.globalAlpha = fade; c.lineJoin = 'round';
        c.strokeStyle = '#1a0d04'; c.lineWidth = 5; c.beginPath(); path.slice(0, n + 1).forEach(q => c.lineTo(q[0], q[1])); c.stroke();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = '#ff9a2a'; c.shadowColor = '#ff6a00'; c.shadowBlur = 10; c.lineWidth = 2;
        c.beginPath(); path.slice(0, n + 1).forEach(q => c.lineTo(q[0], q[1])); c.stroke();
        c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
        if (p > 0.45) { // 噴き上がる岩の柱
          const h = 46 * easeOut(win(p, 0.45, 0.6)) * fade;
          c.globalCompositeOperation = 'lighter'; glow(c, pt.x, pt.fy - h / 2, 30, '#ff8a2a', 0.6 * fade); c.globalCompositeOperation = 'source-over';
          c.globalAlpha = fade; c.fillStyle = '#6e5232';
          c.beginPath(); c.moveTo(pt.x - 14, pt.fy); c.lineTo(pt.x - 4, pt.fy - h); c.lineTo(pt.x + 2, pt.fy - h * 0.7); c.lineTo(pt.x + 8, pt.fy - h * 0.9); c.lineTo(pt.x + 15, pt.fy); c.fill();
          c.fillStyle = '#9a7a4e'; c.beginPath(); c.moveTo(pt.x - 14, pt.fy); c.lineTo(pt.x - 4, pt.fy - h); c.lineTo(pt.x - 2, pt.fy); c.fill();
        }
      }
      c.restore();
    },
    at: {
      0.1() { B.shake = 4; },
      0.45(f, pts) {
        B.shake = 12; flash(0.35, '#ffb060'); Sfx.play('thunder');
        pts.forEach(pt => {
          for (let i = 0; i < 14; i++) particle({ x: pt.x + rand(-14, 14), y: pt.fy, vx: rand(-0.08, 0.08), vy: rand(-0.4, -0.18), g: 0.0011, life: 800, color: pick(['#8a6a44', '#5e462a', '#b08a5a']), shape: 'rock', size: rand(2, 5), vr: rand(-0.02, 0.02) });
          for (let i = 0; i < 6; i++) particle({ x: pt.x + rand(-20, 20), y: pt.fy - rand(0, 10), vx: rand(-0.03, 0.03), vy: rand(-0.03, -0.01), life: 900, color: '#a08060', shape: 'smoke', size: rand(6, 10) });
        });
      },
    } },
  fire: { dur: 950, hit: 0.45, dim: 0.5, dimColor: '#1e0402',
    emit(f, dt, p, pts) {
      if (p < 0.25 || p > 0.8) return;
      for (const pt of pts) for (let i = 0; i < 4; i++) {
        particle({ x: pt.x + rand(-12, 12), y: pt.fy - rand(0, 6), vx: rand(-0.02, 0.02), vy: rand(-0.28, -0.14), life: rand(300, 550), color: pick(['#ffe066', '#ff9a2a', '#ff4a1a', '#ffd0a0']), add: true, size: rand(3, 6), grow: -0.6 });
      }
    },
    draw(c, f, p, pts) {
      c.save();
      for (const pt of pts) {
        magicCircle(c, pt.x, pt.fy, 30 * easeOut(win(p, 0, 0.25)), '#ff6a2a', f.t / 300, 1 - win(p, 0.6, 0.9));
        c.globalCompositeOperation = 'lighter';
        const pulse = 1 + Math.sin(f.t / 40) * 0.08;
        glow(c, pt.x, pt.y, 50 * win(p, 0.25, 0.45) * pulse, '#ff7a2a', 0.9 * (1 - win(p, 0.6, 1)));
        glow(c, pt.x, pt.y, 26 * win(p, 0.3, 0.45) * pulse, '#fff0a0', 0.9 * (1 - win(p, 0.55, 0.9)));
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    },
    at: { 0.0() { Sfx.play('fire'); }, 0.42(f, pts) {
      pts.forEach(pt => {
        burst(pt.x, pt.y, 30, { color: ['#ffe066', '#ff9a2a', '#ff4a1a'], add: true, min: 0.08, max: 0.3, life: 550, size: 3, grow: -0.5 });
        burst(pt.x, pt.y, 12, { color: ['#ffffff', '#fff0a0'], add: true, shape: 'spark', min: 0.15, max: 0.35, life: 350 });
      });
      flash(0.6, '#ffb060'); B.shake = 7;
    } } },
  ice: { dur: 1100, hit: 0.62, dim: 0.55, dimColor: '#020c26',
    emit(f, dt, p) {
      if (p > 0.8) return;
      for (let i = 0; i < 3; i++) particle({ x: rand(60, 380), y: rand(-10, 120), vx: -0.12, vy: 0.14, life: 1000, color: pick(['#ffffff', '#cfefff']), add: true, size: rand(1, 2) });
    },
    draw(c, f, p, pts) {
      const k = easeOut(win(p, 0.12, 0.55)), fade = 1 - win(p, 0.6, 0.66);
      for (const pt of pts) {
        magicCircle(c, pt.x, pt.fy, 28, '#7fd8ff', -f.t / 400, 0.8 * (1 - win(p, 0.6, 0.8)));
        c.save(); c.globalCompositeOperation = 'lighter';
        glow(c, pt.x, pt.y, 44 * k, '#7fd8ff', 0.6 * fade);
        c.translate(pt.x, pt.y); c.globalAlpha = fade;
        for (let i = 0; i < 7; i++) { // 氷の結晶
          const a = i / 7 * Math.PI * 2 - Math.PI / 2 + 0.2, len = (16 + (i % 3) * 7) * k;
          c.save(); c.rotate(a);
          c.fillStyle = '#bfefff99'; c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.shadowColor = '#9fe4ff'; c.shadowBlur = 8;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.5, -len * 0.18); c.lineTo(len, 0); c.lineTo(len * 0.5, len * 0.18); c.closePath(); c.fill(); c.stroke();
          c.restore();
        }
        c.restore();
      }
    },
    at: { 0.0() { Sfx.play('ice'); }, 0.62(f, pts) {
      pts.forEach(pt => burst(pt.x, pt.y, 24, { color: ['#ffffff', '#bfefff', '#7fd8ff'], add: true, shape: 'shard', min: 0.08, max: 0.28, life: 600, size: 2.5, vr: 0.02, g: 0.0004 }));
      flash(0.5, '#cfefff'); B.shake = 5; Sfx.play('crit');
    } } },
  thunder: { dur: 800, hit: 0.3, dim: 0.65, dimColor: '#02030e',
    draw(c, f, p, pts) {
      const strikes = [[0.1, 0.24], [0.3, 0.44], [0.52, 0.66]];
      for (const pt of pts) {
        strikes.forEach(([a, b], i) => {
          if (p < a || p > b) return;
          const al = 1 - win(p, a, b) * 0.6;
          bolt(c, pt.x + (i - 1) * 18, -10, pt.x, pt.y + 8, Math.floor(f.t / 45) + i * 7, 2.2, '#fff27a', al);
          c.save(); c.globalCompositeOperation = 'lighter'; glow(c, pt.x, pt.y + 8, 40, '#fff6b0', al); c.restore();
        });
      }
    },
    at: {
      0.1(f, pts) { flash(0.9); Sfx.play('thunder'); B.shake = 6; pts.forEach(pt => burst(pt.x, pt.y, 14, { color: ['#fff27a', '#ffffff'], add: true, shape: 'spark', min: 0.12, max: 0.35, life: 350 })); },
      0.3(f, pts) { flash(0.8); B.shake = 7; pts.forEach(pt => burst(pt.x, pt.y, 14, { color: ['#fff27a', '#ffffff'], add: true, shape: 'spark', min: 0.12, max: 0.35, life: 350 })); },
      0.52(f, pts) { flash(0.9); Sfx.play('thunder'); B.shake = 8; pts.forEach(pt => burst(pt.x, pt.y, 20, { color: ['#fff27a', '#ffffff', '#a0d8ff'], add: true, shape: 'spark', min: 0.12, max: 0.4, life: 420 })); },
    } },
  holy: { dur: 1100, hit: 0.5, dim: 0.5, dimColor: '#0a0818',
    emit(f, dt, p, pts) {
      if (p > 0.8) return;
      for (const pt of pts) particle({ x: pt.x + rand(-14, 14), y: pt.fy - rand(0, pt.h), vy: rand(-0.12, -0.05), life: 600, color: pick(['#fff6c0', '#ffffff', '#ffe27a']), add: true, shape: 'cross', size: rand(1.5, 3) });
    },
    draw(c, f, p, pts) {
      for (const pt of pts) {
        magicCircle(c, pt.x, pt.fy, 30, '#ffe27a', f.t / 350, 1 - win(p, 0.7, 1));
        const w = 30 * Math.sin(Math.PI * win(p, 0.15, 0.85));
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createLinearGradient(pt.x - w, 0, pt.x + w, 0);
        g.addColorStop(0, '#ffe27a00'); g.addColorStop(0.5, '#fffbe8'); g.addColorStop(1, '#ffe27a00');
        c.globalAlpha = 0.9; c.fillStyle = g; c.fillRect(pt.x - w, -10, w * 2, pt.fy + 10);
        glow(c, pt.x, pt.y, 46 * win(p, 0.2, 0.5), '#fff2b0', 0.8 * (1 - win(p, 0.6, 1)));
        for (let i = 0; i < 3; i++) {
          const q = win(p, 0.3 + i * 0.12, 0.8 + i * 0.07);
          if (q <= 0 || q >= 1) continue;
          c.globalAlpha = 1 - q; c.strokeStyle = '#fff1a8'; c.lineWidth = 2; c.shadowColor = '#ffe27a'; c.shadowBlur = 10;
          c.beginPath(); c.ellipse(pt.x, pt.y, 8 + q * 40, (8 + q * 40) * 0.6, 0, 0, 7); c.stroke();
        }
        c.restore();
      }
    },
    at: { 0.15() { Sfx.play('heal'); }, 0.5(f, pts) { flash(0.55, '#fffbe0'); B.shake = 3; pts.forEach(pt => burst(pt.x, pt.y, 18, { color: ['#ffffff', '#fff1a8'], add: true, shape: 'spark', min: 0.1, max: 0.3, life: 450 })); } } },
  heal: { dur: 950, hit: 0.55, dim: 0.2, dimColor: '#021a0a',
    emit(f, dt, p, pts) {
      if (p > 0.75) return;
      for (const pt of pts) for (let i = 0; i < 2; i++) {
        const a = f.t / 80 + i * Math.PI;
        particle({ x: pt.x + Math.cos(a) * 16, y: pt.fy - (f.t / 950) * pt.h * 1.2, vy: -0.05, life: 500, color: pick(['#a8ffb8', '#ffffff', '#6effa0']), add: true, size: rand(2, 3) });
        if (Math.random() < 0.4) particle({ x: pt.x + rand(-14, 14), y: pt.fy - rand(0, pt.h), vy: -0.06, life: 600, color: '#d8ffe0', add: true, shape: 'cross', size: rand(1.5, 3) });
      }
    },
    draw(c, f, p, pts) {
      for (const pt of pts) {
        magicCircle(c, pt.x, pt.fy, 24, '#6effa0', f.t / 300, 1 - win(p, 0.7, 1));
        c.save(); c.globalCompositeOperation = 'lighter';
        glow(c, pt.x, pt.y, 38 * (1 + Math.sin(f.t / 90) * 0.1), '#6effa0', 0.55 * Math.sin(Math.PI * p));
        c.restore();
      }
    } },
  guard: { dur: 900, hit: 0.5, dim: 0.25, dimColor: '#020a1e',
    draw(c, f, p, pts) {
      const s = p < 0.3 ? easeOut(p / 0.3) * 1.15 : 1.15 - Math.min(0.15, (p - 0.3)); // 飛び出してから落ち着く
      for (const pt of pts) shield(c, pt.x, pt.y, 24 * s, '#7fc8ff', 1 - win(p, 0.75, 1), win(p, 0.3, 0.8));
    },
    at: { 0.3(f, pts) { flash(0.3, '#bfe0ff'); pts.forEach(pt => burst(pt.x, pt.y, 10, { color: ['#bfe0ff', '#ffffff'], add: true, shape: 'spark', min: 0.08, max: 0.2, life: 400 })); } } },
  cast: { dur: 650, hit: 1,
    emit(f, dt, p, pts) {
      for (const pt of pts) particle({ x: pt.x + rand(-14, 14), y: pt.fy, vy: rand(-0.15, -0.06), life: 450, color: f.color, add: true, size: rand(1.5, 2.5) });
    },
    draw(c, f, p, pts) {
      for (const pt of pts) {
        magicCircle(c, pt.x, pt.fy, 26 * easeOut(win(p, 0, 0.4)), f.color, f.t / 200, 1 - win(p, 0.75, 1));
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, pt.x, pt.y - 6, 30, f.color, 0.5 * Math.sin(Math.PI * p)); c.restore();
      }
    } },
  breath: { dur: 1000, hit: 0.6, dim: 0.35, dimColor: '#1e0402', color: ['#ffe066', '#ff9a2a', '#ff4a1a'],
    emit(f, dt, p) {
      if (p > 0.7 || !f.src) return;
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + rand(-0.35, 0.35), sp = rand(0.22, 0.32);
        particle({ x: f.src.x, y: f.src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.03, life: rand(650, 850), color: pick(f.def.color), add: true, size: rand(3, 6), grow: 0.8 });
      }
    },
    draw(c, f, p, pts) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const pt of pts) glow(c, pt.x, pt.y, 30, f.def.color[1], 0.6 * win(p, 0.4, 0.6) * (1 - win(p, 0.7, 1)));
      if (f.src) glow(c, f.src.x, f.src.y, 24, f.def.color[0], 0.8 * (1 - win(p, 0.6, 0.8)));
      c.restore();
    },
    at: { 0.0() { Sfx.play('fire'); }, 0.55() { flash(0.4, '#ffb060'); B.shake = 6; } } },
  scream: { dur: 750, hit: 0.5,
    draw(c, f, p) {
      if (!f.src) return;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const q = (p * 1.6 + i * 0.2) % 1;
        c.globalAlpha = (1 - q) * (1 - win(p, 0.8, 1)); c.strokeStyle = '#ffb0e8'; c.lineWidth = 2.5; c.shadowColor = '#ff70d0'; c.shadowBlur = 8;
        c.beginPath(); c.arc(f.src.x, f.src.y, 10 + q * 200, Math.PI * 0.7, Math.PI * 1.3); c.stroke();
      }
      c.restore();
    },
    at: { 0.2() { B.shake = 5; Sfx.play('hurt'); } } },
  curse: { dur: 850, hit: 0.6, dim: 0.4, dimColor: '#12021e',
    emit(f, dt, p, pts) {
      if (p > 0.6) return;
      for (const pt of pts) { const a = rand(0, Math.PI * 2); particle({ x: pt.x + Math.cos(a) * 34, y: pt.y + Math.sin(a) * 34, vx: -Math.cos(a) * 0.08, vy: -Math.sin(a) * 0.08, life: 420, color: pick(['#c070ff', '#7a20d0', '#ff60c0']), add: true, size: rand(2, 3) }); }
    },
    draw(c, f, p, pts) {
      c.save();
      for (const pt of pts) {
        c.globalAlpha = 0.6 * Math.sin(Math.PI * p); c.fillStyle = '#1a0026';
        c.beginPath(); c.arc(pt.x, pt.y, 26 * easeOut(win(p, 0, 0.5)), 0, 7); c.fill();
        c.globalCompositeOperation = 'lighter';
        glow(c, pt.x, pt.y, 34, '#a040ff', 0.7 * Math.sin(Math.PI * p));
        c.strokeStyle = '#e0a0ff'; c.lineWidth = 1.5; c.globalAlpha = 1 - win(p, 0.6, 1);
        c.beginPath(); for (let a = 0; a < 14; a += 0.25) c.lineTo(pt.x + Math.cos(a + f.t / 90) * (30 - a * 2), pt.y + Math.sin(a + f.t / 90) * (30 - a * 2)); c.stroke();
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    },
    at: { 0.6(f, pts) { flash(0.3, '#c080ff'); B.shake = 5; pts.forEach(pt => burst(pt.x, pt.y, 14, { color: ['#c070ff', '#ff60c0'], add: true, shape: 'spark', min: 0.08, max: 0.25, life: 400 })); } } },
};
FX.darkbreath = Object.assign({}, FX.breath, { dimColor: '#100018', color: ['#e0a0ff', '#a040ff', '#5a10a0'] });
const CAST_COLOR = { fire: '#ff7a3a', ice: '#7fd8ff', thunder: '#fff27a', holy: '#ffe27a', heal: '#6effa0' };

// kind のエフェクトを出す。t: 対象（null=敵全体, 'party'=味方全体）、src: 攻撃元
function spawnFx(kind, t, opts = {}) {
  const def = FX[kind] || FX.slash;
  let pts;
  if (opts.self) pts = [targetPoint(opts.self)];
  else pts = t === null ? livingEnemies().map(targetPoint) : t === 'party' ? G.party.filter(alive).map(targetPoint) : [targetPoint(t)];
  let src = null;
  if (opts.src) { const sp = targetPoint(opts.src); src = { x: sp.x - sp.h * 0.25, y: sp.fy - sp.h * 0.6 }; }
  const fx = { kind, def, t: 0, dur: def.dur, hit: def.hit, pts: pts.filter(Boolean), src, color: opts.color || '#bfe3ff', fired: {} };
  B.fx.push(fx);
  return fx;
}
function spawnCast(m, skill) {
  return spawnFx('cast', null, { self: m, color: CAST_COLOR[skill.fx] || '#bfe3ff' });
}
function updateFx(fx, dt) {
  fx.t += dt;
  const p = Math.min(1, fx.t / fx.dur);
  if (fx.def.emit) fx.def.emit(fx, dt, p, fx.pts);
  if (fx.def.at) for (const k in fx.def.at) {
    if (!fx.fired[k] && p >= parseFloat(k)) {
      fx.fired[k] = true;
      const single = ['slash', 'claw', 'slash2'].includes(fx.kind);
      if (single) fx.pts.forEach(pt => fx.def.at[k](fx, pt)); else fx.def.at[k](fx, fx.pts);
    }
  }
}
function drawFx(c, fx) {
  const p = Math.min(1, fx.t / fx.dur);
  c.save();
  if (['slash', 'claw', 'slash2'].includes(fx.kind)) fx.pts.forEach(pt => fx.def.draw(c, fx, p, pt));
  else fx.def.draw(c, fx, p, fx.pts);
  c.restore();
}
function drawParticles(c, dt) {
  for (const pass of [false, true]) {
    c.save();
    if (pass) c.globalCompositeOperation = 'lighter';
    for (const p of B.parts) {
      if (p.add !== pass) continue;
      const q = p.t / p.life, a = Math.max(0, 1 - q);
      const s = Math.max(0.3, p.size * (1 + p.grow * q));
      c.globalAlpha = a;
      c.fillStyle = p.color; c.strokeStyle = p.color;
      switch (p.shape) {
        case 'dot':
          if (pass) { glow(c, p.x, p.y, s * 2.6, p.color, a * 0.6); c.globalAlpha = a; }
          c.fillRect(p.x - s / 2, p.y - s / 2, s, s); break;
        case 'spark': {
          const len = Math.hypot(p.vx, p.vy) * 40 + 2;
          const ang = Math.atan2(p.vy, p.vx);
          c.lineWidth = s * 0.7; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len); c.stroke(); break;
        }
        case 'shard': case 'leaf': case 'rock':
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          if (p.shape === 'shard') { c.beginPath(); c.moveTo(-s * 1.6, 0); c.lineTo(0, -s * 0.5); c.lineTo(s * 1.6, 0); c.lineTo(0, s * 0.5); c.fill(); }
          else if (p.shape === 'leaf') c.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
          else { c.fillRect(-s / 2, -s / 2, s, s); c.fillStyle = '#2a1a0a'; c.fillRect(-s / 2, s / 2 - 1, s, 1); }
          c.restore(); break;
        case 'cross':
          c.fillRect(p.x - s, p.y - 0.5, s * 2, 1); c.fillRect(p.x - 0.5, p.y - s, 1, s * 2);
          if (pass) glow(c, p.x, p.y, s * 2, p.color, a * 0.5);
          break;
        case 'smoke':
          glow(c, p.x, p.y, s * (1 + q * 1.5), '#8a7050', a * 0.5); break;
      }
    }
    c.restore();
  }
  for (const p of B.parts) {
    p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.drag !== 1) { p.vx *= p.drag; p.vy *= p.drag; }
  }
  B.parts = B.parts.filter(p => p.t < p.life);
}

function resizeBattle() {
  const wrap = $('#battle-wrap');
  const w = wrap.clientWidth;
  battle.cv.width = battle.W * R; battle.cv.height = battle.H * R;
  battle.cv.style.width = w + 'px';
  battle.cv.style.height = (w * battle.H / battle.W) + 'px';
}

function drawBattle(dt) {
  if (!B) return;
  const c = battle.ctx, W = battle.W, H = battle.H;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W * R, H * R);
  const sh = B.shake > 0.2 ? B.shake : 0;
  B.shake *= 0.86;
  c.setTransform(R, 0, 0, R, rand(-sh, sh) * R, rand(-sh, sh) * R);
  if (battle.bg) c.drawImage(battle.bg, 0, 0, W, H);
  const time = performance.now();
  // 敵
  const sel = B.targetSel && B.targetSel.kind === 'enemy' ? B.targetSel : null;
  for (const e of [...B.enemies].sort((a, b) => a.y - b.y)) {
    if (e.gone && e.dying <= 0) continue;
    const img = images['mon_' + e.id];
    if (!img) continue;
    const w = img.width * e.k, h = img.height * e.k;
    if (e.blink > 0) e.blink -= dt;
    if (e.gone) e.dying -= dt / 600;
    const bob = Math.sin(time / 400 + e.x) * 1.2;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(e.x, e.y, w * 0.38, 5, 0, 0, 7); c.fill();
    if (e.hitFlash > 0) { e.hitFlash -= dt; c.filter = 'brightness(3) saturate(0)'; }
    else if (e.blink > 0 && Math.floor(e.blink / 60) % 2) c.globalAlpha = 0.25;
    if (e.gone) { c.globalAlpha = Math.max(0, e.dying); c.filter = e.fled ? 'none' : 'brightness(1.8) sepia(1) hue-rotate(220deg)'; }
    c.translate(e.x + e.ox, e.y + bob);
    c.scale(-1, 1); // 左（パーティ側）を向かせる
    if (e.gone && !e.fled) c.scale(1 + (1 - e.dying) * 0.3, Math.max(0.05, e.dying));
    c.imageSmoothingEnabled = false;
    c.drawImage(img, -w / 2, -h, w, h);
    c.restore();
  }
  if (sel) { // 対象カーソル
    for (const e of sel.cands) {
      const img = images['mon_' + e.id]; const h = img ? img.height * e.k : 60;
      const yy = e.y - h - 8 + Math.sin(time / 150) * 3;
      c.fillStyle = '#ffe14a'; c.strokeStyle = '#3a2a00'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(e.x - 6, yy - 6); c.lineTo(e.x + 6, yy - 6); c.lineTo(e.x, yy + 2); c.closePath(); c.fill(); c.stroke();
    }
  }
  // パーティ
  G.party.forEach((m, i) => {
    const a = B.actors[m.id];
    const isActive = B.active === m;
    const tgt = B.targetSel && B.targetSel.kind !== 'enemy' && B.targetSel.cands.includes(m);
    const img = images[`${m.id}_battle${alive(m) ? a.pose : 0}`];
    if (!img) return;
    const k = 0.66;
    const w = img.width * k, h = img.height * k;
    const x = a.x + a.ox + (isActive ? 10 : 0), y = a.y;
    if (a.blink > 0) a.blink -= dt;
    if (a.hurt > 0) a.hurt -= dt;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(x, y, 14, 4, 0, 0, 7); c.fill();
    c.imageSmoothingEnabled = false;
    if (!alive(m)) {
      c.globalAlpha = 0.75; c.filter = 'grayscale(1) brightness(0.8)';
      c.translate(x, y - 8); c.rotate(-Math.PI / 2);
      c.drawImage(img, -h / 2, -w / 2, w * 0.9, h * 0.9);
    } else {
      if (a.blink > 0 && Math.floor(a.blink / 60) % 2) c.globalAlpha = 0.3;
      const hx = a.hurt > 0 ? rand(-2, 2) : 0;
      if (m.hp < m.mhp * 0.25) c.filter = 'saturate(0.7)';
      c.drawImage(img, x - w / 2 + hx, y - h, w, h);
    }
    c.restore();
    if (tgt) {
      const yy = y - h - 6 + Math.sin(time / 150) * 3;
      c.fillStyle = '#7dff8a';
      c.beginPath(); c.moveTo(x - 6, yy - 6); c.lineTo(x + 6, yy - 6); c.lineTo(x, yy + 2); c.closePath(); c.fill();
    }
  });
  // 魔法中は画面を暗くする
  const dimFx = B.fx.find(f => f.def.dim);
  const dimTarget = dimFx ? dimFx.def.dim : 0;
  B.dim += (dimTarget - B.dim) * Math.min(1, dt / 120);
  if (dimFx) B.dimColor = dimFx.def.dimColor;
  if (B.dim > 0.01) { c.globalAlpha = B.dim; c.fillStyle = B.dimColor || '#000000'; c.fillRect(-20, -20, W + 40, H + 40); c.globalAlpha = 1; }
  // エフェクト
  for (const fx of B.fx) updateFx(fx, dt);
  B.fx = B.fx.filter(f => f.t < f.dur);
  drawParticles(c, dt);
  for (const fx of B.fx) drawFx(c, fx);
  c.globalAlpha = 1;
  // ダメージ数字
  c.font = 'bold 14px "DotGothic16", monospace';
  c.textAlign = 'center';
  for (const n of B.nums) {
    n.t += dt;
    const bounce = n.t < 300 ? -Math.sin(n.t / 300 * Math.PI) * 12 : 0;
    c.globalAlpha = n.t > 800 ? Math.max(0, 1 - (n.t - 800) / 300) : 1;
    c.lineWidth = 3; c.strokeStyle = '#101020';
    c.strokeText(n.text, n.x, n.y + bounce); c.fillStyle = n.color; c.fillText(n.text, n.x, n.y + bounce);
  }
  c.globalAlpha = 1;
  B.nums = B.nums.filter(n => n.t < 1100);
  if (B.flash > 0) { c.globalAlpha = Math.min(1, B.flash * 0.75); c.fillStyle = B.flashColor || '#ffffff'; c.fillRect(-20, -20, W + 40, H + 40); c.globalAlpha = 1; B.flash -= dt / 220; }
  if (B.guard > 0) {
    c.fillStyle = 'rgba(120,190,255,0.85)'; c.font = '10px "DotGothic16", monospace'; c.textAlign = 'left';
    c.fillText('鉄壁 残り' + B.guard, 6, 14);
  }
}

// ============================================================
// 入力（Dパッド・キーボード）
// ============================================================
function setupInput() {
  const pad = $('#dpad');
  let pid = null;
  const dirFrom = ev => {
    const r = pad.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  };
  const setDir = d => {
    field.input = d;
    pad.dataset.dir = d || '';
  };
  pad.addEventListener('pointerdown', ev => { Sfx.init(); pid = ev.pointerId; pad.setPointerCapture(pid); setDir(dirFrom(ev)); ev.preventDefault(); });
  pad.addEventListener('pointermove', ev => { if (ev.pointerId === pid) setDir(dirFrom(ev)); });
  const end = ev => { if (ev.pointerId === pid) { pid = null; setDir(null); } };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);

  const dash = $('#btn-dash');
  dash.addEventListener('pointerdown', ev => { field.dash = !field.dash; dash.classList.toggle('on', field.dash); ev.preventDefault(); });
  $('#btn-menu').addEventListener('click', openMenu);
  $('#btn-close').addEventListener('click', () => { Sfx.play('cancel'); closeMenu(); });
  $('#btn-save').addEventListener('click', () => { renderMenu(saveGame() ? 'セーブしました。' : 'このブラウザでは セーブできません。'); Sfx.play('ok'); });
  $('#btn-sound').addEventListener('click', () => { Sfx.on = !Sfx.on; renderMenu(); });

  const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const held = [];
  window.addEventListener('keydown', ev => {
    const d = keys[ev.key];
    if (d) { if (!held.includes(d)) held.push(d); field.input = held[held.length - 1]; ev.preventDefault(); }
    if (ev.key === 'Shift') field.dash = true;
  });
  window.addEventListener('keyup', ev => {
    const d = keys[ev.key];
    if (d) { held.splice(held.indexOf(d), 1); field.input = held[held.length - 1] || null; }
    if (ev.key === 'Shift') field.dash = $('#btn-dash').classList.contains('on');
  });
  battle.cv.addEventListener('pointerdown', onBattleTap);
  window.addEventListener('resize', () => { resizeField(); if (B) resizeBattle(); });
  // iOS のダブルタップ拡大を防ぐ
  document.addEventListener('dblclick', ev => ev.preventDefault(), { passive: false });
}

// ============================================================
// メインループ・起動
// ============================================================
function loop(ts) {
  const dt = Math.min(50, ts - (field.lastTs || ts));
  field.lastTs = ts;
  if (!$('#field-view').hidden) { updateField(dt); drawField(); }
  if (B) drawBattle(dt);
  requestAnimationFrame(loop);
}

async function boot() {
  field.cv = $('#field'); field.ctx = field.cv.getContext('2d');
  battle.cv = $('#battle'); battle.ctx = battle.cv.getContext('2d');
  makeCastle();
  await loadImages();
  setupInput();
  const hasSave = !!storageGet(SAVE_KEY);
  $('#btn-continue').hidden = !hasSave;
  $('#title-loading').hidden = true;
  $('#title-btns').hidden = false;
  const start = async cont => {
    Sfx.init(); Sfx.play('ok');
    if (!(cont && loadGame())) newGame();
    await fade(true, 300);
    $('#title').hidden = true;
    $('#field-view').hidden = false;
    resizeField();
    updateHud();
    G.mode = 'field';
    await fade(false, 300);
    toast(cont ? 'つづきから はじめます' : 'Dパッドで移動。お城で休めます', 2600);
  };
  $('#btn-new').onclick = () => start(false);
  $('#btn-continue').onclick = () => start(true);
  requestAnimationFrame(loop);
  if (location.hash === '#debug') window.__debug = { G, startBattle, field };
}

boot();
})();
