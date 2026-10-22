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
  const names = ['bg_sky', 'lucifer_art', 'lucifer_face', 'eclipse_omen'];
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

// 色替えキャラの画像を作る（VARIANTS）
function recolor(img, tone) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], g = a[i + 1], b = a[i + 2], l = r * 0.3 + g * 0.59 + b * 0.11;
    if (tone === 'old') { a[i] = l * 0.65 + r * 0.35 + 12; a[i + 1] = l * 0.65 + g * 0.35 + 8; a[i + 2] = l * 0.65 + b * 0.35; }
    else if (tone === 'dark') { a[i] = r * 0.55 + 25; a[i + 1] = g * 0.4 + 10; a[i + 2] = b * 0.55 + 35; }
    else if (tone === 'crimson') { a[i] = Math.max(r, b) * 0.9 + 20; a[i + 1] = g * 0.45; a[i + 2] = r * 0.4 + 10; }
  }
  c.putImageData(d, 0, 0);
  return cv;
}
function makeVariants() {
  const keys = ['face', 'stand0', 'stand1', 'stand2', 'stand3', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'battle0', 'battle1', 'battle2', 'battle3'];
  for (const id in VARIANTS) {
    const v = VARIANTS[id];
    for (const k of keys) { const src = images[`${v.from}_${k}`]; if (src) images[`${id}_${k}`] = recolor(src, v.tone); }
  }
}
// <img> に使える URL（色替えキャンバスは data URL にする）
const urlCache = {};
function imgURL(name) {
  if (urlCache[name]) return urlCache[name];
  const im = images[name];
  if (!im) return IMG_DIR + name + '.png';
  return (urlCache[name] = im.src || im.toDataURL());
}
const poseKey = id => (VARIANTS[id] ? VARIANTS[id].from : id);

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
      case 'blip': this.tone(660, 0.025, { vol: 0.02 }); break;
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
  flags: {}, reso: [], objective: '', eventRunning: false,
};

// m.b が素のステータス。m.atk などは装備込みの値（recalc で更新）
function makeMember(base, lv = 1) {
  const m = {
    id: base.id, name: base.name, base, lv: 1, exp: 0,
    mhp: base.hp, mmp: base.mp,
    b: { atk: base.atk, def: base.def, mag: base.mag, spd: base.spd },
    equip: { ...base.equip },
  };
  for (let i = 1; i < lv; i++) levelUp(m);
  recalc(m);
  m.hp = m.mhp; m.mp = m.mmp;
  return m;
}
function levelUp(m) {
  const g = m.base.grow;
  m.lv++;
  const gains = { hp: g.hp + ri(0, 4), mp: g.mp + ri(0, 1), atk: g.atk + ri(0, 1), def: g.def + ri(0, 1), mag: g.mag + ri(0, 1), spd: g.spd };
  m.mhp += gains.hp; m.mmp += gains.mp; m.b.atk += gains.atk; m.b.def += gains.def; m.b.mag += gains.mag; m.b.spd += gains.spd;
  recalc(m);
  return gains;
}
function recalc(m) {
  for (const k of ['atk', 'def', 'mag', 'spd']) {
    let v = m.b[k];
    for (const slot in m.equip) { const e = EQUIPS[m.equip[slot]]; if (e && e[k]) v += e[k]; }
    m[k] = Math.max(1, v);
  }
}
const canEquip = (m, id) => { const w = EQUIPS[id].who; return w === 'all' || w.includes(m.id); };
const alive = m => m.hp > 0;

function newGame() {
  G.roster = { leon: makeMember(PARTY_BASE[0]) };
  G.party = [G.roster.leon]; // 最初はレオンひとり
  G.flags = {}; G.reso = []; G.objective = ''; G.stash = {}; G.chapterId = 'prologue';
  G.items = { ...START_ITEMS };
  G.bag = {};
  G.gold = START_GOLD;
  G.map = genMap();
  setupWorld();
  resetPositions(START_POS.x, START_POS.y);
  G.steps = 0;
}
function resetPositions(x, y) {
  G.pos = G.party.map(() => ({ x, y, fx: x, fy: y, dir: 'down' }));
}

const SAVE_KEY = 'eclipse-saga-save-v1';
const packMember = m => ({ id: m.id, lv: m.lv, exp: m.exp, hp: m.hp, mp: m.mp, mhp: m.mhp, mmp: m.mmp, b: m.b, equip: m.equip });
function unpackMember(s) {
  const m = makeMember(findBase(s.id));
  if (!s.b) s.b = { atk: s.atk, def: s.def, mag: s.mag, spd: s.spd }; // 旧セーブ
  Object.assign(m, s);
  if (!s.equip) m.equip = { ...m.base.equip };
  recalc(m);
  return m;
}
function saveGame() {
  const roster = {};
  for (const id in G.roster) roster[id] = packMember(G.roster[id]);
  const data = {
    v: 2, roster, partyIds: G.party.map(m => m.id), stash: G.stash, chapterId: G.chapterId,
    items: G.items, bag: G.bag, gold: G.gold, flags: G.flags, reso: G.reso, objective: G.objective, x: G.pos[0].x, y: G.pos[0].y,
  };
  return storageSet(SAVE_KEY, JSON.stringify(data));
}
function loadGame() {
  const raw = storageGet(SAVE_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (d.v !== 2) return false; // ストーリー変更前のセーブは使わない（はじめからになる）
    G.roster = {};
    if (d.roster) for (const id in d.roster) G.roster[id] = unpackMember(d.roster[id]);
    else for (const s of d.party) G.roster[s.id] = unpackMember(s); // 旧セーブ
    G.party = (d.partyIds || d.party.map(s => s.id)).map(id => G.roster[id]);
    G.stash = d.stash || {}; G.chapterId = d.chapterId || 'prologue';
    G.items = d.items; G.bag = d.bag || {}; G.gold = d.gold;
    G.flags = d.flags || {};
    G.reso = d.reso || [];
    G.objective = d.objective || '';
    G.map = genMap();
    setupWorld();
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
function makeTile(type, variant, frame) {
  const key = type + ':' + variant + ':' + frame;
  if (tileCache[key]) return tileCache[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
  const c = cv.getContext('2d');
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

// ============================================================
// フィールド
// ============================================================
const field = { cv: null, ctx: null, W: 352, H: 352, moving: false, t: 0, speed: 0, anim: 0, input: null, dash: false, lastTs: 0 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ENCOUNTER_RATE = { [T.GRASS]: 20, [T.FLOWER]: 20, [T.FOREST]: 11, [T.SAND]: 24, [T.PATH]: 48, [T.BRIDGE]: 0 };

function zoneAt(x, y) {
  if (inTown(x, y)) return { name: TOWN.name, danger: 0, table: [], max: 0 };
  const d = Math.hypot(x - TOWN.cx, y - TOWN.cy);
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
// 上下は正面・背面の立ち絵のみ（歩行コマは横を向いているため使わない）
const WALK_FRAMES = { down: ['stand0', 'stand0'], up: ['stand2', 'stand2'], left: ['walk2', 'walk3'], right: ['walk2', 'walk3'] };
function spriteFor(id, dir, step) {
  return images[`${id}_${WALK_FRAMES[dir][step]}`];
}

// 町のオブジェクトと当たり判定を用意する
function setupWorld() {
  G.objects = buildTownObjects(castleSprite);
  G.solid = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(null));
  for (const o of G.objects) {
    for (let y = o.y + (o.solidFrom || 0); y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) G.solid[y][x] = o;
  }
}

function tryMove(dir) {
  const lead = G.pos[0];
  lead.dir = dir;
  const [dx, dy] = DIRS[dir];
  const nx = lead.x + dx, ny = lead.y + dy;
  if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return false;
  const obj = G.solid[ny][nx];
  if (obj) { field.input = null; interact(obj, nx, ny); return false; }
  if (npcAt(nx, ny)) { field.input = null; return false; }
  const t = G.map[ny][nx];
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

async function interact(o, x, y) {
  if (G.mode !== 'field') return;
  if (o.kind === 'building' && (x !== o.doorTile.x || y !== o.doorTile.y)) return; // 壁にぶつかっただけ
  const ev = o.id && (DOOR_EVENTS[o.id] || []).find(d => condOk(d.when));
  if (ev) { Sfx.play('ok'); await runEvent(ev.event); return; }
  if (o.kind === 'building') {
    G.mode = 'busy';
    Sfx.play('ok');
    if (SHOPS[o.id]) await openShop(o.id);
    else if (o.id === 'inn') await visitInn();
    else G.mode = 'field';
    return;
  }
  if (!o.text) return;
  G.mode = 'busy';
  Sfx.play('cursor');
  await dialog(o.text, ['とじる']);
  G.mode = 'field';
}

async function visitInn() {
  const r = await dialog(`${INN.name}へ ようこそ！\nひとばん ${INN.price}G です。 とまっていきますか？\n（セーブもします）`, ['とまる', 'やめる']);
  if (r === 0) {
    if (G.gold < INN.price) {
      await dialog('…おや、おかねが たりないみたいですね。\nまた きてくださいな。', ['とじる']);
    } else {
      G.gold -= INN.price;
      await fade(true);
      G.party.forEach(m => { m.hp = m.mhp; m.mp = m.mmp; });
      const ok = saveGame();
      updateHud();
      await sleep(400);
      await fade(false);
      Sfx.play('heal');
      await dialog('おはようございます！ よく ねむれましたか？\nHPとMPが ぜんかいふくした！' + (ok ? '\n（セーブしました）' : '\n（このブラウザでは セーブできません）'), ['とじる']);
    }
  }
  G.mode = 'field';
}

function onArrive() {
  G.steps++;
  const lead = G.pos[0];
  const t = G.map[lead.y][lead.x];
  updateHud();
  const trig = TRIGGERS.find(tr => lead.x >= tr.x0 && lead.x <= tr.x1 && lead.y >= tr.y0 && lead.y <= tr.y1 && condOk(tr.when));
  if (trig) { runEvent(trig.event); return; }
  if (inTown(lead.x, lead.y)) return;
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
    let v = tt === T.WATER || tt === T.BRIDGE ? variant % 3 : variant % 4;
    if (tt === T.FENCE) v = (x === TOWN.x0 || x === TOWN.x1) && y !== TOWN.y0 && y !== TOWN.y1 ? 1 : 0;
    const sx = x * TILE - camX, sy = y * TILE - camY;
    c.drawImage(makeTile(tt, v, tt === T.WATER || tt === T.BRIDGE ? frame : 0), sx, sy);
    if (tt === T.WATER) { // 岸の白波
      const land = (xx, yy) => xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H && G.map[yy][xx] !== T.WATER && G.map[yy][xx] !== T.BRIDGE;
      c.fillStyle = frame ? '#ffffff' : '#d8f0ff';
      if (land(x, y - 1)) c.fillRect(sx, sy, TILE, 2);
      if (land(x, y + 1)) c.fillRect(sx, sy + TILE - 2, TILE, 2);
      if (land(x - 1, y)) c.fillRect(sx, sy, 2, TILE);
      if (land(x + 1, y)) c.fillRect(sx + TILE - 2, sy, 2, TILE);
    }
  }
  // 画面内のオブジェクトとキャラクターを、足元の y 座標順に描く
  const list = [];
  for (const o of G.objects) {
    const ox = o.x * TILE - camX, base = (o.y + o.h) * TILE - camY;
    if (ox > W + 64 || ox + o.w * TILE < -64 || base < -16 || base - o.sprite.height > H + 16) continue;
    list.push({ base, draw: () => drawObject(c, o, ox, base) });
  }
  const walkFrame = Math.floor(field.anim / 160) % 2;
  for (const n of activeNpcs()) {
    const base = (n.y + 1) * TILE - camY;
    list.push({ base, draw: () => drawNpc(c, n, n.x * TILE - camX, base) });
  }
  G.pos.forEach((p, i) => {
    const pp = posPx(p);
    list.push({ base: pp.y + TILE - camY - 0.01 * i, draw: () => drawMember(c, p, i, pp, camX, camY, walkFrame) });
  });
  list.sort((a, b) => a.base - b.base);
  for (const it of list) it.draw();
}

function drawObject(c, o, ox, base) {
  let spr = o.sprite;
  if (o.frames) spr = o.frames[Math.floor(field.anim / 180) % o.frames.length];
  const W = o.w * TILE;
  if (o.kind === 'building') { // 地面の影
    c.fillStyle = 'rgba(30,40,20,0.22)';
    c.fillRect(ox + 8, base - 4, W - 4, 8);
    c.fillRect(ox + W - 4, base - spr.height + 30, 8, spr.height - 26);
  } else if (o.kind === 'tree' || o.kind === 'lamp' || o.kind === 'sign' || o.kind === 'mailbox') {
    c.fillStyle = 'rgba(30,40,20,0.25)';
    c.beginPath(); c.ellipse(ox + 16, base - 3, o.kind === 'tree' ? 11 : 6, 3.5, 0, 0, 7); c.fill();
  }
  c.drawImage(spr, ox + (W - spr.width) / 2, base - spr.height);
}

function drawNpc(c, n, sx, base) {
  const img = n.monster ? images['mon_' + n.monster] : spriteFor(n.sprite, n.dir, 0);
  if (!img) return;
  const h = n.monster ? 30 : 42, w = img.width * h / img.height;
  const bob = n.monster ? Math.sin(field.anim / 200 + n.x) * 1.5 : 0;
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath(); c.ellipse(sx + 16, base - 2, 9, 3.5, 0, 0, 7); c.fill();
  c.save();
  c.imageSmoothingEnabled = true;
  const flip = n.monster ? true : n.dir === 'right'; // 魔物は右（町の方）を向く
  if (flip) { c.translate(sx + 16, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, base - 2 - h + bob, w, h); }
  else c.drawImage(img, sx + 16 - w / 2, base - 2 - h + bob, w, h);
  c.restore();
}

function drawMember(c, p, i, pp, camX, camY, walkFrame) {
  const m = G.party[i];
  const moving = field.moving && (p.x !== p.fx || p.y !== p.fy);
  const img = spriteFor(m.id, p.dir, moving ? walkFrame : 0);
  if (!img) return;
  const h = 42, w = img.width * h / img.height;
  const cx = pp.x + TILE / 2 - camX, by = pp.y + TILE - 2 - camY;
  const bob = moving && walkFrame ? (p.dir === 'up' || p.dir === 'down' ? -2 : -1) : 0;
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath(); c.ellipse(cx, by, 9, 3.5, 0, 0, 7); c.fill();
  c.save();
  if (!alive(m)) c.globalAlpha = 0.45;
  c.imageSmoothingEnabled = true;
  if (p.dir === 'right') { c.translate(cx, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, by - h + bob, w, h); }
  else c.drawImage(img, cx - w / 2, by - h + bob, w, h);
  c.restore();
  // 森の中では足元を木で隠す
  const tx = Math.round(pp.x / TILE), ty = Math.round(pp.y / TILE);
  if (G.map[ty] && G.map[ty][tx] === T.FOREST && !moving) {
    const tile = makeTile(T.FOREST, (((tx * 73856093) ^ (ty * 19349663)) >>> 0) % 4, 0);
    c.drawImage(tile, 0, 20, TILE, 12, tx * TILE - camX, ty * TILE + 20 - camY, TILE, 12);
  }
}

function updateHud() {
  const lead = G.pos[0];
  const z = zoneAt(lead.x, lead.y);
  $('#zone-name').textContent = z.name;
  $('#zone-danger').textContent = z.danger ? '★'.repeat(z.danger) + '☆'.repeat(3 - z.danger) : 'まもののいない町';
  $('#gold').textContent = G.gold + ' G';
  $('#objective').textContent = G.objective ? '目的：' + G.objective : '';
  $('#objective').hidden = !G.objective;
  const box = $('#hud-party');
  const hudIds = G.party.map(m => m.id).join(',');
  if (box.dataset.ids !== hudIds) {
    box.dataset.ids = hudIds;
    box.innerHTML = G.party.map(m => `<div class="mini" data-id="${m.id}"><img src="${imgURL(m.id + '_face')}" alt=""><div class="mini-bars"><span class="mini-name"></span><i class="bar hp"><b></b></i><i class="bar mp"><b></b></i></div></div>`).join('');
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
    return `<div class="card ${alive(m) ? '' : 'dead'}" data-i="${G.party.indexOf(m)}" role="button" tabindex="0">
      <img class="face" src="${imgURL(m.id + '_face')}" alt="">
      <div class="card-body">
        <div class="card-head"><b>${m.name}</b><span>Lv ${m.lv}</span></div>
        <div class="card-job">${m.base.job}・${m.base.role}</div>
        <div class="stat-row"><span>HP</span><i class="bar hp"><b style="width:${100 * m.hp / m.mhp}%"></b></i><span class="num">${m.hp}/${m.mhp}</span></div>
        <div class="stat-row"><span>MP</span><i class="bar mp"><b style="width:${100 * m.mp / m.mmp}%"></b></i><span class="num">${m.mp}/${m.mmp}</span></div>
        <div class="stat-grid"><span>攻撃 ${m.atk}</span><span>守備 ${m.def}</span><span>魔力 ${m.mag}</span><span>素早さ ${m.spd}</span></div>
        <div class="card-equip">${['weapon', 'armor', 'acc'].map(sl => `<span>${SLOT_NAMES[sl]}：${m.equip[sl] ? EQUIPS[m.equip[sl]].name : 'なし'}</span>`).join('')}</div>
        <div class="card-next">つぎのレベルまで ${next} EXP</div>
      </div></div>`;
  }).join('');
  st.querySelectorAll('.card').forEach(el => el.onclick = () => { Sfx.play('cursor'); equipMenu(G.party[+el.dataset.i]); });
  const it = $('#menu-items');
  it.innerHTML = Object.entries(ITEMS).map(([id, item]) =>
    `<button class="item-btn" data-item="${id}" ${G.items[id] ? '' : 'disabled'}><b>${item.name}</b><span>×${G.items[id] || 0}</span><small>${item.desc}</small></button>`).join('');
  it.querySelectorAll('button').forEach(b => b.onclick = () => useItemInField(b.dataset.item));
  $('#menu-gold').textContent = G.gold + ' G';
  $('#menu-chapter').textContent = (CHAPTERS[G.chapterId] || { name: '序章 レオン' }).name;
  $('#menu-note').textContent = note;
  $('#btn-sound').textContent = '効果音：' + (Sfx.on ? 'ON' : 'OFF');
}
async function useItemInField(id) {
  const item = ITEMS[id];
  if (item.battleOnly) { renderMenu('それは バトルの ときに つかう ものだ。'); return; }
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
// ストーリー（会話・ナレーション・イベント）
// ============================================================
const condOk = w => !w || ((!w.flag || G.flags[w.flag]) && (!w.not || !G.flags[w.not]));
function activeNpcs() { return NPCS.filter(n => condOk(n.when)); }
function npcAt(x, y) { return activeNpcs().find(n => n.x === x && n.y === y); }

// 1文字ずつ表示して、タップで進める（表示中のタップは全文表示）
function typeText(el, text, overlay) {
  return new Promise(res => {
    let i = 0, typing = true;
    el.textContent = '';
    const timer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i % 3 === 0 && text[i - 1] !== ' ' && text[i - 1] !== '\n') Sfx.play('blip');
      if (i >= text.length) { clearInterval(timer); typing = false; }
    }, 32);
    const h = ev => {
      ev.preventDefault();
      if (typing) { clearInterval(timer); el.textContent = text; typing = false; return; }
      overlay.removeEventListener('pointerdown', h);
      Sfx.play('cursor');
      res();
    };
    setTimeout(() => overlay.addEventListener('pointerdown', h), 150);
  });
}
async function talk(who, text) {
  const sp = SPEAKERS[who] || { name: who };
  const ov = $('#talk');
  const face = $('#talk-face');
  face.hidden = !sp.face;
  if (sp.face) face.src = imgURL(sp.face);
  $('#talk-name').textContent = sp.name;
  $('#talk-name').hidden = !sp.name;
  ov.hidden = false;
  await typeText($('#talk-text'), text, ov);
  ov.hidden = true;
}
async function narrate(s) {
  const ov = $('#narr');
  const img = $('#narr-img');
  img.hidden = !s.img;
  if (s.img) img.src = IMG_DIR + s.img + '.png';
  const sp = s.speaker ? SPEAKERS[s.speaker] : null;
  $('#narr-name').textContent = sp ? sp.name : '';
  $('#narr-name').hidden = !sp;
  ov.hidden = false;
  await typeText($('#narr-text'), s.text, ov);
}
function hideStoryOverlays() { $('#narr').hidden = true; $('#chapter').hidden = true; $('#talk').hidden = true; }
async function chapterCard(s) {
  const ov = $('#chapter');
  $('#ch-no').textContent = s.no;
  $('#ch-title').textContent = s.title;
  $('#ch-sub').textContent = s.sub || '';
  $('#narr').hidden = true;
  ov.classList.remove('show');
  ov.hidden = false;
  void ov.offsetWidth;
  ov.classList.add('show');
  Sfx.play('lvup');
  await sleep(2600);
}
function setObjective(text) {
  G.objective = text;
  updateHud();
  if (text) toast('目的：' + text, 3200);
}
function joinParty(id) {
  if (G.party.some(m => m.id === id)) return;
  const lead = G.party[0];
  let m = G.roster[id];
  if (!m) { m = G.roster[id] = makeMember(findBase(id), lead.lv); m.exp = expForLevel(m.lv); }
  G.party.push(m);
  const p = G.pos[G.pos.length - 1];
  G.pos.push({ x: p.x, y: p.y, fx: p.x, fy: p.y, dir: p.dir });
  updateHud();
  Sfx.play('lvup');
}

// 章の切りかえ：いまのパーティと持ち物を しまい、その章の主人公たちに かえる
function startChapter(id) {
  const ch = CHAPTERS[id];
  G.stash[G.chapterId] = { partyIds: G.party.map(m => m.id), gold: G.gold, items: G.items, bag: G.bag };
  G.chapterId = id;
  G.party = ch.party.map(([pid, lv]) => {
    if (!G.roster[pid]) { G.roster[pid] = makeMember(findBase(pid), lv); G.roster[pid].exp = expForLevel(lv); }
    return G.roster[pid];
  });
  G.gold = ch.gold; G.items = { ...ch.items }; G.bag = {};
  resetPositions(ch.start.x, ch.start.y);
  G.pos.forEach(p => p.dir = ch.start.dir);
  updateHud();
}

async function runEvent(name) {
  const steps = EVENTS[name];
  if (!steps || G.eventRunning) return;
  G.eventRunning = true;
  G.mode = 'busy'; field.input = null;
  try {
    let list = steps;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.t === 'goto') { list = EVENTS[s.event]; i = -1; continue; }
      if (['say', 'battle', 'join'].includes(s.t)) $('#narr').hidden = true;
      if ((await doStep(s)) === 'abort') break;
      if (G.mode !== 'battle') G.mode = 'busy';
    }
  } finally {
    hideStoryOverlays();
    if ($('#fade').classList.contains('on')) await fade(false);
    G.eventRunning = false;
    G.mode = 'field';
    updateHud();
  }
}

async function doStep(s) {
  switch (s.t) {
    case 'say': return talk(s.who, s.text);
    case 'narr': return narrate(s);
    case 'chapter': return chapterCard(s);
    case 'fadeOut': return fade(true, 500);
    case 'fadeIn':
      if (!$('#fade').classList.contains('on')) await fade(true, 1);
      $('#title').hidden = true;
      hideStoryOverlays();
      $('#field-view').hidden = false;
      resizeField();
      updateHud();
      return fade(false, 600);
    case 'flash': { const fl = $('#flash'); fl.classList.add('on'); await sleep(90); fl.classList.remove('on'); return sleep(150); }
    case 'sfx': Sfx.play(s.name); return;
    case 'wait': return sleep(s.ms);
    case 'flag': G.flags[s.name] = true; return;
    case 'objective': return setObjective(s.text);
    case 'warp': resetPositions(s.x, s.y); G.pos.forEach(p => p.dir = s.dir || 'down'); return;
    case 'join': return joinParty(s.id);
    case 'resonance': if (!G.reso.includes(s.id)) G.reso.push(s.id); return;
    case 'healAll': G.party.forEach(m => { m.hp = m.mhp; m.mp = m.mmp; }); return;
    case 'save': saveGame(); return;
    case 'leave': {
      const i = G.party.findIndex(m => m.id === s.id);
      if (i > 0) { G.party.splice(i, 1); G.pos.splice(i, 1); }
      if (findBase(s.id).guest) delete G.roster[s.id];
      updateHud();
      return;
    }
    case 'chapterStart': return startChapter(s.id);
    case 'battle': {
      const r = await startBattle(s.enemies, { boss: s.boss, hpMul: s.hpMul });
      return r === 'win' ? undefined : 'abort';
    }
  }
}

// ============================================================
// お店・装備
// ============================================================
const shop = { id: null, tab: 'buy', sel: null, resolve: null };
const goodsInfo = id => EQUIPS[id] || ITEMS[id];
function statText(e) {
  return Object.keys(STAT_NAMES).filter(k => e[k]).map(k => `${STAT_NAMES[k]}${e[k] > 0 ? '+' : ''}${e[k]}`).join(' ') || 'のうりょく変化なし';
}
function whoText(e) {
  return e.who === 'all' ? 'みんな' : e.who.map(id => PARTY_BASE.find(b => b.id === id).name).join('・');
}
function ownedCount(id) {
  if (ITEMS[id]) return G.items[id] || 0;
  let n = G.bag[id] || 0;
  G.party.forEach(m => { for (const s in m.equip) if (m.equip[s] === id) n++; });
  return n;
}
function equipItem(m, id) {
  const slot = EQUIPS[id].slot, old = m.equip[slot];
  if (old) G.bag[old] = (G.bag[old] || 0) + 1;
  m.equip[slot] = id;
  recalc(m);
}
function unequip(m, slot) {
  const old = m.equip[slot];
  if (!old) return;
  G.bag[old] = (G.bag[old] || 0) + 1;
  m.equip[slot] = null;
  recalc(m);
}

function openShop(id) {
  return new Promise(res => {
    Object.assign(shop, { id, tab: 'buy', sel: null, resolve: res });
    const s = SHOPS[id];
    $('#shop-name').textContent = s.name;
    shopTalk(`${s.keeper}「${s.greet}」`);
    renderShop();
    $('#shop').hidden = false;
  });
}
function closeShop() {
  Sfx.play('cancel');
  $('#shop').hidden = true;
  G.mode = 'field';
  updateHud();
  const r = shop.resolve; shop.resolve = null;
  if (r) r();
}
function shopTalk(t) { $('#shop-talk').textContent = t; }

function shopEntries() {
  if (shop.tab === 'buy') return SHOPS[shop.id].goods.map(id => ({ id, price: goodsInfo(id).price }));
  const list = [];
  for (const id in ITEMS) if (G.items[id] > 0) list.push({ id, price: Math.floor(ITEMS[id].price / 2), count: G.items[id] });
  for (const id in G.bag) if (G.bag[id] > 0) list.push({ id, price: Math.floor(EQUIPS[id].price / 2), count: G.bag[id] });
  return list;
}

function renderShop() {
  $('#shop-gold').textContent = G.gold + ' G';
  $('#tab-buy').classList.toggle('on', shop.tab === 'buy');
  $('#tab-sell').classList.toggle('on', shop.tab === 'sell');
  const entries = shopEntries();
  if (shop.sel && !entries.some(e => e.id === shop.sel)) shop.sel = null;
  const list = $('#shop-list');
  if (!entries.length) list.innerHTML = '<p class="empty">うれる ものを もっていない。<br>（そうびちゅうの ものは うれません）</p>';
  else list.innerHTML = entries.map(e => {
    const g = goodsInfo(e.id);
    const sub = EQUIPS[e.id] ? `${SLOT_NAMES[g.slot]}・${whoText(g)}・${statText(g)}` : g.desc;
    const tooPoor = shop.tab === 'buy' && G.gold < e.price;
    return `<button class="goods ${shop.sel === e.id ? 'on' : ''} ${tooPoor ? 'poor' : ''}" data-id="${e.id}">
      <span class="goods-name">${g.name}</span><span class="goods-price">${e.price} G</span>
      <small>${sub}　${shop.tab === 'buy' ? 'もっている数 ' + ownedCount(e.id) : '×' + e.count}</small></button>`;
  }).join('');
  list.querySelectorAll('.goods').forEach(b => b.onclick = () => { Sfx.play('cursor'); shop.sel = b.dataset.id; renderShop(); });
  // 選んだ品の くわしい情報
  const det = $('#shop-detail');
  const act = $('#btn-shop-act');
  act.textContent = shop.tab === 'buy' ? 'かう' : 'うる';
  if (!shop.sel) {
    det.innerHTML = '<span class="hint">しなものを タップしてください</span>';
    act.disabled = true;
    return;
  }
  const g = goodsInfo(shop.sel);
  const e = entries.find(x => x.id === shop.sel);
  act.disabled = shop.tab === 'buy' && G.gold < e.price;
  if (EQUIPS[shop.sel]) {
    det.innerHTML = `<ul class="compare">${G.party.map(m => compareLine(m, shop.sel)).join('')}</ul>`;
  } else {
    det.innerHTML = `<span>${g.name}：${g.desc}</span>`;
  }
}

function compareLine(m, id) {
  const e = EQUIPS[id];
  if (!canEquip(m, id)) return `<li class="ng"><b>${m.name}</b>そうびできない</li>`;
  const cur = EQUIPS[m.equip[e.slot]];
  if (m.equip[e.slot] === id) return `<li><b>${m.name}</b>そうびしている</li>`;
  const parts = Object.keys(STAT_NAMES).filter(k => e[k] || (cur && cur[k])).map(k => {
    const nv = m[k] - ((cur && cur[k]) || 0) + (e[k] || 0);
    const cls = nv > m[k] ? 'up' : nv < m[k] ? 'down' : '';
    return `<span class="${cls}">${STAT_NAMES[k]} ${m[k]}→${nv}</span>`;
  });
  return `<li><b>${m.name}</b>${parts.join(' ') || '変化なし'}</li>`;
}

async function shopAction() {
  const id = shop.sel;
  if (!id) return;
  const g = goodsInfo(id), s = SHOPS[shop.id];
  if (shop.tab === 'buy') {
    if (G.gold < g.price) { shopTalk(`${s.keeper}「おかねが たりないようだね。」`); Sfx.play('cancel'); return; }
    G.gold -= g.price;
    Sfx.play('ok');
    if (EQUIPS[id]) {
      const cands = G.party.filter(m => canEquip(m, id));
      const i = await dialog(`${g.name}を かった！\nすぐに そうびしますか？`, [...cands.map(m => `${m.name}が そうびする`), 'もちものに しまう']);
      if (i < cands.length) { equipItem(cands[i], id); shopTalk(`${s.keeper}「${s.thanks}」\n（${cands[i].name}は ${g.name}を そうびした）`); }
      else { G.bag[id] = (G.bag[id] || 0) + 1; shopTalk(`${s.keeper}「${s.thanks}」`); }
    } else {
      G.items[id] = (G.items[id] || 0) + 1;
      shopTalk(`${s.keeper}「${s.thanks}」（${g.name}×${G.items[id]}）`);
    }
  } else {
    const price = Math.floor(g.price / 2);
    const r = await dialog(`${g.name}を ${price}Gで うりますか？`, ['うる', 'やめる']);
    if (r !== 0) return;
    if (EQUIPS[id]) G.bag[id]--; else G.items[id]--;
    G.gold += price;
    Sfx.play('ok');
    shopTalk(`${s.keeper}「たしかに。 ${price}G だよ。」`);
  }
  renderShop();
}

async function equipMenu(m) {
  const slots = ['weapon', 'armor', 'acc'];
  for (;;) {
    const i = await dialog(`${m.name}の そうび\n攻撃 ${m.atk}　守備 ${m.def}　魔力 ${m.mag}　素早さ ${m.spd}`,
      [...slots.map(s => `${SLOT_NAMES[s]}：${m.equip[s] ? EQUIPS[m.equip[s]].name : 'なし'}`), 'もどる']);
    if (i >= slots.length) break;
    const slot = slots[i];
    const opts = Object.keys(G.bag).filter(id => G.bag[id] > 0 && EQUIPS[id].slot === slot && canEquip(m, id));
    const labels = opts.map(id => `${EQUIPS[id].name}（${statText(EQUIPS[id])}）`);
    const hasCur = !!m.equip[slot];
    if (hasCur) labels.push('はずす');
    labels.push('もどる');
    const j = await dialog(opts.length || hasCur ? `${SLOT_NAMES[slot]}を えらんでください。` : `そうびできる ${SLOT_NAMES[slot]}を もっていない。`, labels);
    if (j < opts.length) { G.bag[opts[j]]--; equipItem(m, opts[j]); }
    else if (hasCur && j === opts.length) unequip(m, slot);
    renderMenu();
  }
  renderMenu();
}

// ============================================================
// バトル
// ============================================================
const battle = { cv: null, ctx: null, W: 352, H: 290, bg: null };
let B = null; // 現在のバトル

// パーティは右側で左を向き、敵は左側で右を向く
const PARTY_SPOTS = [[266, 166], [290, 198], [262, 232], [286, 266]];
const ENEMY_SPOTS = {
  1: [[100, 230]],
  2: [[124, 196], [64, 244]],
  3: [[130, 178], [54, 200], [104, 262]],
};
// 戦闘ポーズ（0=待機 1=詠唱 2=攻撃 3=勝利）ごとの [元画像の番号, 左右反転するか]。すべて左向きにそろえる
const BATTLE_POSES = {
  leon:   [[0, true], [0, true], [1, true], [3, false]],
  selena: [[0, false], [2, false], [2, false], [3, true]],
  garo:   [[0, false], [0, false], [2, false], [1, false]],
  noa:    [[0, false], [2, false], [1, false], [3, false]],
};
// 元絵で左を向いているモンスター（右向きにするため反転する）
const MONSTER_FACES_LEFT = new Set(['ghost', 'harpy', 'lizardman', 'scorpion', 'skeleton']);

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

function makeEnemy(id, i, n, hpMul = 1) {
  const d = MONSTERS[id];
  const [x, y] = ENEMY_SPOTS[n][i];
  const hp = Math.round(d.hp * hpMul);
  return { id, data: d, name: d.name, hp, mhp: hp, atk: d.atk, def: d.def, spd: d.spd,
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

let battleResolve = null;
function startBattle(ids, opts = {}) {
  return new Promise(res => { battleResolve = res; beginBattle(ids, opts); });
}
function finishBattle(result) { const r = battleResolve; battleResolve = null; if (r) r(result); }
async function beginBattle(ids, opts) {
  G.mode = 'battle'; field.input = null;
  Sfx.play('encounter');
  // エンカウント演出
  const fl = $('#flash');
  for (let i = 0; i < 3; i++) { fl.classList.add('on'); await sleep(70); fl.classList.remove('on'); await sleep(70); }
  await fade(true, 300);
  const zone = zoneAt(G.pos[0].x, G.pos[0].y);
  B = {
    enemies: ids.map((id, i) => makeEnemy(id, i, ids.length, opts.hpMul || 1)),
    fx: [], parts: [], nums: [], shake: 0, flash: 0, flashColor: '#ffffff', dim: 0, dimColor: '#000000', guard: 0,
    active: null, targetSel: null, actors: {}, over: false, zone, boss: !!opts.boss, cutin: null,
  };
  nameEnemies(B.enemies);
  const yShift = (4 - G.party.length) * 16; // 人数が少ないときは中央に寄せる
  G.party.forEach((m, i) => B.actors[m.id] = { x: PARTY_SPOTS[i][0], y: PARTY_SPOTS[i][1] + yShift, ox: 0, pose: 0, blink: 0, hurt: 0 });
  battle.bg = makeBattleBg(zone);
  $('#field-view').hidden = true;
  $('#battle-view').hidden = false;
  resizeBattle();
  renderBattleStatus();
  setCmd([]);
  await fade(false, 300);
  const names = [...new Set(B.enemies.map(e => e.data.name))];
  await say((opts.boss ? '【ボス】' : '') + (names.length === 1 && B.enemies.length > 1 ? `${names[0]}たちが あらわれた！` : `${names.join('と')}が あらわれた！`), 900);
  battleLoop();
}

async function battleLoop() {
  while (B && !B.over) {
    const input = await inputPhase();
    if (input.run) {
      setCmd([]);
      await say(`${G.party[0].name}たちは にげだした！`, 600);
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
  const cmds = []; // members と同じ並び。共鳴の相手は reserved になる
  let i = 0;
  while (i < members.length) {
    const m = members[i];
    if (cmds.some(c => c.type === 'reso' && c.partner === m.id)) { cmds.push({ type: 'reserved', actor: m }); i++; continue; }
    B.active = m; renderBattleStatus();
    setMsg(`${m.name}は どうする？`);
    const c = await chooseCommand(m, i > 0);
    if (c === 'back') {
      i--;
      while (i > 0 && cmds[i] && cmds[i].type === 'reserved') { cmds.pop(); i--; }
      cmds.pop();
      continue;
    }
    if (c.type === 'run') { B.active = null; renderBattleStatus(); return { run: true }; }
    cmds.push(c); i++;
  }
  B.active = null; renderBattleStatus(); setCmd([]);
  return { cmds: cmds.filter(c => c.type !== 'reserved') };
}

async function chooseCommand(m, canBack) {
  for (;;) {
    const partners = m.id === 'leon' ? G.reso.filter(id => G.party.some(p => p.id === id && alive(p))) : [];
    const top = [
      { label: 'たたかう', value: 'attack' },
      ...(partners.length ? [{ label: '共鳴', value: 'reso' }] : []),
      { label: 'スキル', value: 'skill' },
      { label: 'まほう', value: 'magic' },
      { label: 'アイテム', value: 'item' },
      { label: 'にげる', value: 'run' },
    ];
    if (canBack) top.push({ label: 'もどる', value: 'back', back: true });
    const v = await waitChoice(top);
    if (v === 'back') return 'back';
    if (v === 'run') {
      if (B.boss) { setMsg('この たたかいからは にげられない！'); continue; }
      return { type: 'run' };
    }
    if (v === 'reso') {
      const btns = partners.map(id => {
        const r = RESONANCE[id], p = G.party.find(x => x.id === id);
        return { label: r.name, sub: `MP ${r.mp[0]}+${r.mp[1]}`, value: id, disabled: m.mp < r.mp[0] || p.mp < r.mp[1] };
      });
      btns.push({ label: 'もどる', value: 'back', back: true });
      setMsg('共鳴技：レオンと なかまの MPを つかい、なかまの こうどうも つかう');
      const id = await waitChoice(btns, { list: true, title: '共鳴' });
      if (id === 'back') { setMsg(`${m.name}は どうする？`); continue; }
      const t = await pickTarget(RESONANCE[id].target, m);
      if (t === null) { setMsg(`${m.name}は どうする？`); continue; }
      return { actor: m, type: 'reso', partner: id, target: t };
    }
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
      const btns = ids.map(id => ({ label: ITEMS[id].name, sub: `×${G.items[id]}`, value: id, disabled: B.boss && ITEMS[id].kind === 'escape' }));
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
  if (kind === 'enemies' || kind === 'allies' || kind === 'none') return kind;
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
    if (!B || B.over) break;
    if (a.type === 'enemy' ? a.actor.gone : !alive(a.actor)) continue;
    if (a.type === 'enemy') await enemyAct(a.actor);
    else await partyAct(a);
    if (!B) return;
    renderBattleStatus();
    if (await checkEnd()) return;
  }
  if (B && B.guard > 0) { B.guard--; if (B.guard === 0) await say('鉄壁の こうかが きれた。', 600); }
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
  for (let i = 0; i <= 6; i++) { a.ox = -i * 3; await sleep(16); }
}
async function stepBack(m) {
  const a = B.actors[m.id];
  for (let i = 6; i >= 0; i--) { a.ox = -i * 3; await sleep(16); }
  a.pose = 0;
}

function physDamage(atk, power, def, crit) {
  if (crit) return Math.max(1, Math.round(atk * power * 1.6 * rand(0.95, 1.05)));
  return Math.max(1, Math.round(atk * power * rand(0.9, 1.1) - def * 0.4));
}

async function partyAct(a) {
  const m = a.actor;
  if (a.type === 'reso') return resonanceAct(a);
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
    if (item.kind === 'escape') {
      await say(`${m.name}は けむりだまを なげた！`, 500);
      Sfx.play('run');
      B.over = true;
      await say('もくもくと けむりが たちこめる…\nうまく にげきれた！', 900);
      await endBattle('run');
      return;
    }
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

async function resonanceAct(a) {
  const m = a.actor, r = RESONANCE[a.partner], p = G.party.find(x => x.id === a.partner);
  if (!p || !alive(p)) { await say(`${p ? p.name : 'なかま'}が たおれていて 共鳴できない！`, 800); return; }
  if (m.mp < r.mp[0] || p.mp < r.mp[1]) { await say('MPが たりなくて 共鳴できない！', 800); return; }
  m.mp -= r.mp[0]; p.mp -= r.mp[1];
  renderBattleStatus();
  await Promise.all([stepForward(m, 2), stepForward(p, 1)]);
  B.cutin = { text: r.name, t: 0, faces: [m.id, p.id] };
  Sfx.play('lvup');
  flash(0.6);
  await say(`共鳴技！\n${m.name}と ${p.name}の「${r.name}」！`, 1300);
  const stat = Math.round(m.atk * (r.kind === 'mag' ? 0.5 : 1) + p[r.stat]);
  if (a.partner === 'selena') {
    const t = retarget(a.target);
    if (t) {
      spawnFx('holy', t); await sleep(520);
      const fx = spawnFx('slash2', t); await sleep(fx.dur * fx.hit);
      await hitEnemy(t, stat, r.power, 'phys');
    }
    if (!B) return;
    Sfx.play('heal');
    for (const x of G.party.filter(alive)) {
      const v = Math.min(x.mhp - x.hp, Math.round(p.mag * 2 + 30));
      x.hp += v; popNum(x, v, '#7dff8a'); spawnFx('heal', x);
    }
    renderBattleStatus();
    await say('やさしい 光が みんなを つつんだ！', 700);
  } else {
    if (a.partner === 'noa') { spawnFx('wind', null); await sleep(500); }
    const fx = spawnFx(a.partner === 'garo' ? 'quake' : 'thunder', null);
    await sleep(fx.dur * fx.hit);
    for (const t of livingEnemies()) await hitEnemy(t, stat, r.power, r.kind, 240);
  }
  if (!B) return;
  await Promise.all([stepBack(m), stepBack(p)]);
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
    t.ox = -10; setTimeout(() => t.ox = 0, 200);
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
  e.ox = 14;
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
  await say(`${G.party[0].name}たちは ぜんめつしてしまった…`, 0);
  await waitTap();
  G.gold = Math.floor(G.gold / 2);
  G.party.forEach(m => { m.hp = m.mhp; m.mp = m.mmp; });
  resetPositions(INN_FRONT.x, INN_FRONT.y);
  await endBattle('lose');
  await dialog('……気がつくと ルミナの町の 宿屋の まえにいた。\n（所持金が はんぶんに なった）', ['OK']);
  G.mode = 'field';
  finishBattle('lose');
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
  if (result !== 'lose') finishBattle(result);
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
  const ids = G.party.map(m => m.id).join(',');
  if (box.dataset.ids !== ids) {
    box.dataset.ids = ids;
    box.innerHTML = G.party.map(m => `<div class="brow" data-id="${m.id}"><img src="${imgURL(m.id + '_face')}" alt=""><div class="brow-body"><div class="brow-name"></div><div class="brow-line"><span>HP</span><i class="bar hp"><b></b></i><em class="hpn"></em></div><div class="brow-line"><span>MP</span><i class="bar mp"><b></b></i><em class="mpn"></em></div></div></div>`).join('');
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
      for (let i = -1; i <= 1; i++) crescent(c, pt.x + i * 8 + 30, pt.y - 10, 30, Math.PI - 0.6, Math.PI - 0.6 + k * 1.2, 5, '#ff5a5a', 1 - win(p, 0.55, 1));
    },
    at: { 0.4(f, pt) { burst(pt.x, pt.y, 10, { color: ['#ff8080', '#ffffff'], add: true, shape: 'spark', min: 0.06, max: 0.18, life: 300 }); } } },
  slash2: { dur: 700, hit: 0.5, dim: 0.45, dimColor: '#06142e',
    draw(c, f, p, pt) {
      const k1 = easeOut(win(p, 0.05, 0.35)), k2 = easeOut(win(p, 0.3, 0.6));
      crescent(c, pt.x, pt.y, 34, -2.6, -2.6 + k1 * 2.8, 12, '#5ff0ff', 1 - win(p, 0.45, 0.9));
      crescent(c, pt.x, pt.y, 34, -0.6, -0.6 + k2 * 2.8, 12, '#5ff0ff', 1 - win(p, 0.65, 1));
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { // 疾風の筋
        const yy = pt.y - 26 + i * 9, len = 120, xx = pt.x - 150 + win(p, 0, 0.7) * 240 + i * 9;
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
        c.fillRect(380 - win(p, 0, 0.5) * 480 + i * 30, 90 + i * 28, 90, 1.5);
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
        const sx = 232, sy = pt.fy + 4;
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
        const a = rand(-0.35, 0.35), sp = rand(0.22, 0.32);
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
        c.beginPath(); c.arc(f.src.x, f.src.y, 10 + q * 200, -Math.PI * 0.3, Math.PI * 0.3); c.stroke();
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
  if (opts.src) { const sp = targetPoint(opts.src); src = { x: sp.x + sp.h * 0.25, y: sp.fy - sp.h * 0.6 }; }
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
    if (MONSTER_FACES_LEFT.has(e.id)) c.scale(-1, 1); // 右（パーティ側）を向かせる
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
    const [src, mirror] = BATTLE_POSES[poseKey(m.id)][alive(m) ? a.pose : 0];
    const img = images[`${m.id}_battle${src}`];
    if (!img) return;
    const k = 0.66;
    const w = img.width * k, h = img.height * k;
    const x = a.x + a.ox + (isActive ? -10 : 0), y = a.y;
    if (a.blink > 0) a.blink -= dt;
    if (a.hurt > 0) a.hurt -= dt;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(x, y, 14, 4, 0, 0, 7); c.fill();
    c.imageSmoothingEnabled = false;
    if (!alive(m)) {
      c.globalAlpha = 0.75; c.filter = 'grayscale(1) brightness(0.8)';
      c.translate(x, y - 8); c.rotate(Math.PI / 2);
      c.drawImage(img, -h / 2, -w / 2, w * 0.9, h * 0.9);
    } else {
      if (a.blink > 0 && Math.floor(a.blink / 60) % 2) c.globalAlpha = 0.3;
      const hx = a.hurt > 0 ? rand(-2, 2) : 0;
      if (m.hp < m.mhp * 0.25) c.filter = 'saturate(0.7)';
      if (mirror) { c.translate(x + hx, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, y - h, w, h); }
      else c.drawImage(img, x - w / 2 + hx, y - h, w, h);
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
  if (B.cutin) { // 共鳴技のカットイン
    const ci = B.cutin;
    ci.t += dt;
    const k = Math.min(1, ci.t / 220), out = ci.t > 1000 ? Math.max(0, 1 - (ci.t - 1000) / 300) : 1;
    const cy = H * 0.42;
    c.save();
    c.globalAlpha = out;
    const g = c.createLinearGradient(0, cy - 30, 0, cy + 30);
    g.addColorStop(0, 'rgba(10,20,60,0)'); g.addColorStop(0.2, 'rgba(10,20,60,0.88)'); g.addColorStop(0.8, 'rgba(10,20,60,0.88)'); g.addColorStop(1, 'rgba(10,20,60,0)');
    c.fillStyle = g;
    c.fillRect(W * (1 - k), cy - 30, W, 60);
    ci.faces.forEach((id, i) => {
      const img = images[id + '_face'];
      if (!img) return;
      const x = i ? W - 58 - (1 - k) * 80 : 10 + (1 - k) * -80;
      c.drawImage(img, x, cy - 24, 48, 48);
      c.strokeStyle = '#ffd75e'; c.lineWidth = 1.5; c.strokeRect(x, cy - 24, 48, 48);
    });
    c.font = 'bold 20px "DotGothic16", monospace'; c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = '#1a0a30'; c.strokeText(ci.text, W / 2, cy + 7);
    c.fillStyle = '#ffe680'; c.fillText(ci.text, W / 2, cy + 7);
    c.font = '9px "DotGothic16", monospace'; c.fillStyle = '#bfe3ff'; c.fillText('― 共鳴技 ―', W / 2, cy - 16);
    c.restore();
    if (ci.t > 1300) B.cutin = null;
  }
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
  $('#tab-buy').addEventListener('click', () => { Sfx.play('cursor'); shop.tab = 'buy'; shop.sel = null; renderShop(); });
  $('#tab-sell').addEventListener('click', () => { Sfx.play('cursor'); shop.tab = 'sell'; shop.sel = null; renderShop(); });
  $('#btn-shop-act').addEventListener('click', shopAction);
  $('#btn-shop-exit').addEventListener('click', closeShop);

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
  makeVariants();
  setupInput();
  const hasSave = !!storageGet(SAVE_KEY);
  $('#btn-continue').hidden = !hasSave;
  $('#title-loading').hidden = true;
  $('#title-btns').hidden = false;
  const start = async cont => {
    Sfx.init(); Sfx.play('ok');
    const loaded = cont && loadGame();
    if (!loaded) newGame();
    await fade(true, 300);
    if (!loaded) { // オープニング
      $('#title').hidden = true;
      await runEvent('opening');
      return;
    }
    $('#title').hidden = true;
    $('#field-view').hidden = false;
    resizeField();
    updateHud();
    G.mode = 'field';
    await fade(false, 300);
    toast('つづきから はじめます', 2400);
  };
  $('#btn-new').onclick = () => start(false);
  $('#btn-continue').onclick = () => start(true);
  requestAnimationFrame(loop);
  if (location.hash === '#debug') window.__debug = { G, startBattle, field, openShop, runEvent, joinParty };
}

boot();
})();
