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

function spriteFor(id, dir) {
  const idx = { down: 0, left: 1, up: 2, right: 3 }[dir];
  return images[`${id}_stand${idx}`];
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
    const img = spriteFor(m.id, p.dir);
    if (!img) continue;
    const scale = 0.5;
    const w = img.width * scale, h = img.height * scale;
    const cx = pp.x + TILE / 2 - camX, by = pp.y + TILE - 2 - camY;
    const moving = field.moving && (p.x !== p.fx || p.y !== p.fy);
    const bob = moving && walkFrame ? -1.5 : 0;
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(cx, by, 9, 3.5, 0, 0, 7); c.fill();
    c.save();
    if (!alive(m)) c.globalAlpha = 0.45;
    const flip = moving && walkFrame && (p.dir === 'up' || p.dir === 'down');
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
    fx: [], parts: [], nums: [], shake: 0, flash: 0, guard: 0,
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
    spawnFx('slash', t);
    await sleep(240);
    await hitEnemy(t, m.atk, 1.0, 'phys');
    await stepBack(m);
  } else if (a.type === 'skill') {
    const s = SKILLS[a.skill];
    if (m.mp < s.mp) { await say(`${m.name}は ${s.name}を となえようとした！\nしかし MPが たりない！`, 900); return; }
    m.mp -= s.mp; renderBattleStatus();
    await stepForward(m, s.type === 'magic' ? 1 : 2);
    await say(`${m.name}は ${s.name}を ${s.type === 'magic' ? 'となえた' : 'はなった'}！`, 300);
    if (s.type === 'magic') { Sfx.play('magic'); spawnCast(m); await sleep(350); }
    await applySkill(m, s, a.target);
    await stepBack(m);
  } else if (a.type === 'item') {
    const item = ITEMS[a.item];
    if (!G.items[a.item]) { await say(`しかし ${item.name}は もう なかった！`, 800); return; }
    let t = a.target;
    G.items[a.item]--;
    await stepForward(m, 1);
    await say(`${m.name}は ${item.name}を つかった！`, 350);
    spawnFx(item.kind === 'revive' ? 'holy' : 'heal', t);
    Sfx.play('heal');
    await sleep(400);
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
      spawnFx(s.fx, null);
      await sleep(420);
      for (const t of targets) await hitEnemy(t, s.kind === 'phys' ? m.atk : m.mag, s.power, s.kind, 260);
    } else {
      for (const t of targets) { spawnFx(s.fx, t); await sleep(420); await hitEnemy(t, s.kind === 'phys' ? m.atk : m.mag, s.power, s.kind); }
    }
  } else if (s.kind === 'heal') {
    const targets = target === 'allies' ? G.party.filter(alive) : [target];
    Sfx.play('heal');
    targets.forEach(t => spawnFx('heal', t));
    await sleep(500);
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
    await sleep(500);
    if (alive(target)) { await say('しかし なにも おこらなかった。', 700); return; }
    target.hp = Math.floor(target.mhp / 2);
    renderBattleStatus();
    await say(`${target.name}は いきかえった！`, 800);
  } else if (s.kind === 'guard') {
    spawnFx('guard', null);
    Sfx.play('magic');
    B.guard = 3;
    await sleep(500);
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
  t.blink = 400;
  B.shake = crit ? 6 : 2;
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
    spawnFx(sp.fx || 'claw', sp.all ? 'party' : hit[0]);
    await sleep(380);
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
    spawnFx('claw', t);
    await sleep(260);
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
  if (t.data) { const img = images['mon_' + t.id]; const h = img ? img.height * t.k : 60; return { x: t.x, y: t.y - h / 2 }; }
  const a = B.actors[t.id];
  return { x: a.x + a.ox, y: a.y - 24 };
}
function popNum(t, v, color) {
  const p = targetPoint(t);
  if (p) B.nums.push({ x: p.x, y: p.y - 6, text: String(v), color, t: 0 });
}
function particle(o) { B.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 600, t: 0, size: 2, color: '#fff' }, o)); }

function spawnCast(m) {
  const a = B.actors[m.id];
  for (let i = 0; i < 18; i++) {
    const ang = Math.random() * Math.PI * 2;
    particle({ x: a.x + a.ox + Math.cos(ang) * 22, y: a.y - 20 + Math.sin(ang) * 22, vx: -Math.cos(ang) * 0.05, vy: -Math.sin(ang) * 0.05, life: 400, color: pick(['#bfe3ff', '#ffffff', '#d7b8ff']), size: 2 });
  }
}

function spawnFx(kind, t) {
  const pts = t === null ? livingEnemies().map(targetPoint) : t === 'party' ? G.party.filter(alive).map(targetPoint) : [targetPoint(t)];
  const fx = { kind, t: 0, dur: 450, pts };
  switch (kind) {
    case 'slash': case 'claw': fx.dur = 260; break;
    case 'slash2': fx.dur = 380; break;
    case 'fire': case 'breath': case 'darkbreath': Sfx.play('fire'); fx.dur = 500;
      for (const p of pts) for (let i = 0; i < 26; i++) particle({ x: p.x + rand(-14, 14), y: p.y + rand(-4, 16), vx: rand(-0.03, 0.03), vy: rand(-0.12, -0.04), life: rand(350, 650), color: kind === 'darkbreath' ? pick(['#8a3cff', '#c060ff', '#3a0a60']) : pick(['#ffdd55', '#ff8a2a', '#ff4a1a']), size: rand(2, 4) });
      break;
    case 'ice': Sfx.play('ice'); fx.dur = 550;
      for (const p of pts) for (let i = 0; i < 14; i++) particle({ x: p.x + rand(-18, 18), y: p.y - 40 - rand(0, 20), vy: rand(0.1, 0.18), life: 450, color: pick(['#dff6ff', '#9fdcff', '#ffffff']), size: rand(2, 3), shard: true });
      break;
    case 'thunder': Sfx.play('thunder'); fx.dur = 420; B.flash = 1; break;
    case 'holy': fx.dur = 600;
      for (const p of pts) for (let i = 0; i < 16; i++) particle({ x: p.x + rand(-12, 12), y: p.y + rand(-10, 20), vy: rand(-0.1, -0.04), life: 600, color: pick(['#fff6c0', '#ffffff', '#ffe27a']), size: 2 });
      break;
    case 'heal': fx.dur = 600;
      for (const p of pts) for (let i = 0; i < 14; i++) particle({ x: p.x + rand(-12, 12), y: p.y + rand(-4, 20), vy: rand(-0.09, -0.04), life: 650, color: pick(['#a8ffb8', '#ffffff', '#6effa0']), size: 2, sparkle: true });
      break;
    case 'wind': fx.dur = 600; Sfx.play('magic'); break;
    case 'quake': fx.dur = 600; B.shake = 8; Sfx.play('thunder');
      for (const p of pts) for (let i = 0; i < 10; i++) particle({ x: p.x + rand(-16, 16), y: p.y + 24, vx: rand(-0.05, 0.05), vy: rand(-0.25, -0.12), g: 0.0008, life: 600, color: pick(['#8a6a44', '#5e462a', '#b08a5a']), size: rand(2, 4) });
      break;
    case 'guard': fx.dur = 600; fx.pts = G.party.filter(alive).map(targetPoint); break;
    case 'scream': case 'curse': fx.dur = 520; break;
  }
  B.fx.push(fx);
}

function drawFx(c, fx) {
  const p = fx.t / fx.dur;
  c.save();
  for (const pt of fx.pts) {
    if (!pt) continue;
    switch (fx.kind) {
      case 'slash': case 'slash2': {
        const lines = fx.kind === 'slash2' ? [[-1, -1, 1, 1], [1, -1, -1, 1]] : [[-1, -1, 1, 1]];
        c.strokeStyle = fx.kind === 'slash2' ? '#aef3ff' : '#ffffff'; c.lineWidth = 3; c.lineCap = 'round';
        c.globalAlpha = 1 - p;
        for (const [a, b, d, e] of lines) {
          const k = Math.min(1, p * 2.2);
          c.beginPath(); c.moveTo(pt.x + a * 20, pt.y + b * 20); c.lineTo(pt.x + a * 20 + (d - a) * 20 * k, pt.y + b * 20 + (e - b) * 20 * k); c.stroke();
        }
        break;
      }
      case 'claw': {
        c.strokeStyle = '#ff6b6b'; c.lineWidth = 2; c.globalAlpha = 1 - p;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(pt.x - 10 + i * 6, pt.y - 14); c.lineTo(pt.x + 6 + i * 6, pt.y + 12 * Math.min(1, p * 2.5)); c.stroke(); }
        break;
      }
      case 'thunder': {
        c.strokeStyle = '#fff59a'; c.lineWidth = 3; c.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
        c.beginPath(); let x = pt.x, y = 0; c.moveTo(x, y);
        const r = mulberry32(Math.floor(fx.t / 60) + 3);
        while (y < pt.y + 10) { x = pt.x + (r() - 0.5) * 22; y += 14; c.lineTo(x, y); }
        c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.stroke();
        break;
      }
      case 'holy': case 'guard': {
        c.globalAlpha = 1 - p; c.strokeStyle = fx.kind === 'guard' ? '#7fc8ff' : '#fff1a8'; c.lineWidth = 2;
        c.beginPath(); c.arc(pt.x, pt.y, 6 + p * 26, 0, 7); c.stroke();
        if (fx.kind === 'guard') { c.fillStyle = 'rgba(120,190,255,0.25)'; c.beginPath(); c.arc(pt.x, pt.y, 18, 0, 7); c.fill(); }
        break;
      }
      case 'fire': case 'breath': case 'darkbreath': {
        c.globalAlpha = (1 - p) * 0.6;
        const g = c.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 30);
        g.addColorStop(0, fx.kind === 'darkbreath' ? '#e0a0ff' : '#fff2a0'); g.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = g; c.beginPath(); c.arc(pt.x, pt.y, 30, 0, 7); c.fill();
        break;
      }
      case 'wind': {
        c.globalAlpha = 1 - p; c.strokeStyle = '#c8ffd8'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(pt.x, pt.y, 10 + i * 7, p * 12 + i, p * 12 + i + 2.2); c.stroke(); }
        break;
      }
      case 'scream': {
        c.globalAlpha = 1 - p; c.strokeStyle = '#ffd0f0'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(pt.x, pt.y, 6 + ((p * 30 + i * 10) % 30), 0, 7); c.stroke(); }
        break;
      }
      case 'curse': {
        c.globalAlpha = 1 - p; c.fillStyle = 'rgba(120,40,180,0.45)';
        c.beginPath(); c.arc(pt.x, pt.y, 22 * (1 - p * 0.5), 0, 7); c.fill();
        c.strokeStyle = '#d8a0ff'; c.lineWidth = 1.5;
        c.beginPath(); for (let a = 0; a < 12; a += 0.3) c.lineTo(pt.x + Math.cos(a + p * 8) * a * 2, pt.y + Math.sin(a + p * 8) * a * 2); c.stroke();
        break;
      }
    }
  }
  c.restore();
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
    if (e.blink > 0 && Math.floor(e.blink / 60) % 2) c.globalAlpha = 0.25;
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
  // エフェクト
  for (const fx of B.fx) { fx.t += dt; drawFx(c, fx); }
  B.fx = B.fx.filter(f => f.t < f.dur);
  for (const p of B.parts) {
    p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    c.globalAlpha = Math.max(0, 1 - p.t / p.life);
    c.fillStyle = p.color;
    if (p.shard) { c.fillRect(p.x, p.y, 1.5, p.size * 2.5); }
    else if (p.sparkle) { c.fillRect(p.x - p.size, p.y, p.size * 2 + 1, 1); c.fillRect(p.x, p.y - p.size, 1, p.size * 2 + 1); }
    else c.fillRect(p.x, p.y, p.size, p.size);
  }
  c.globalAlpha = 1;
  B.parts = B.parts.filter(p => p.t < p.life);
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
  if (B.flash > 0) { c.fillStyle = `rgba(255,255,230,${B.flash * 0.7})`; c.fillRect(-10, -10, W + 20, H + 20); B.flash -= dt / 250; }
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
