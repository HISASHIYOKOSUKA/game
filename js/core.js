// 基本：ユーティリティ・画像・効果音・ゲーム状態・セーブ
'use strict';

// ============================================================
// ユーティリティ
// ============================================================
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SPEED = () => window.__speed || 1; // テスト用の早送り
const sleep = ms => new Promise(r => setTimeout(r, ms / SPEED()));
const R = 2; // キャンバスの内部解像度倍率

const images = {};
function loadImages() {
  const names = ['bg_sky', 'lucifer_art', 'lucifer_face', 'eclipse_omen'];
  for (const p of PARTY_BASE) {
    names.push(p.id + '_face');
    for (let i = 0; i < 4; i++) names.push(`${p.id}_stand${i}`, `${p.id}_battle${i}`);
    for (let i = 0; i < 5; i++) names.push(`${p.id}_walk${i}`);
  }
  for (const id in MONSTERS) {
    const m = MONSTERS[id];
    if (m.sprite) continue;
    const src = m.img || id;
    names.push(src.startsWith('boss_') ? src : 'mon_' + src);
  }
  return Promise.all([...new Set(names)].map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => { images[n] = im; res(); };
    im.onerror = () => res();
    im.src = IMG_DIR + n + '.png';
  })));
}
// 流用・色替えのモンスター画像を mon_<id> として用意する
function prepareMonsterImages() {
  for (const id in MONSTERS) {
    const m = MONSTERS[id];
    if (m.sprite || images['mon_' + id]) continue;
    const src = m.img ? (m.img.startsWith('boss_') ? images[m.img] : images['mon_' + m.img]) : null;
    if (!src) continue;
    images['mon_' + id] = m.tone ? recolor(src, m.tone) : src;
  }
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
    if (typeof tone === 'object') {
      let [h, sa, li] = rgb2hsl(r, g, b);
      const cool = sa > 0.12 && (h > 70 && h < 330); // 服など。肌や茶髪（暖色）は変えない
      if (cool) h = (h + (tone.hue || 0) + 360) % 360;
      if (tone.sat !== undefined && cool) sa *= tone.sat;
      li = Math.min(1, li + (tone.light || 0) / 255);
      [a[i], a[i + 1], a[i + 2]] = hsl2rgb(h, sa, li);
    } else if (tone === 'old') { a[i] = l * 0.65 + r * 0.35 + 12; a[i + 1] = l * 0.65 + g * 0.35 + 8; a[i + 2] = l * 0.65 + b * 0.35; }
    else if (tone === 'dark') { a[i] = r * 0.55 + 25; a[i + 1] = g * 0.4 + 10; a[i + 2] = b * 0.55 + 35; }
    else if (tone === 'crimson') { a[i] = Math.max(r, b) * 0.9 + 20; a[i + 1] = g * 0.45; a[i + 2] = r * 0.4 + 10; }
  }
  c.putImageData(d, 0, 0);
  return cv;
}
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
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
const isGen = id => !!images[id + '__gen'];

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
    Music.init(this.ctx);
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
  flags: {}, reso: [], objective: '', eventRunning: false, stash: {}, chapterId: 'prologue', area: 'world', cleared: false,
};
const CHAPTER_MUSIC = { prologue: 'leon', ch1: 'selena', ch2: 'garo', ch3: 'noa', final: 'final' };

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
// 覚えている わざ（最初から ＋ レベルで覚えたもの）
function skillsOf(m) {
  const list = [...(m.base.skills || [])];
  for (const [lv, id] of m.base.learn || []) if (m.lv >= lv && !list.includes(id)) list.push(id);
  return list;
}
function setLevel(m, lv) {
  while (m.lv < lv) levelUp(m);
  m.exp = Math.max(m.exp, expForLevel(m.lv));
  m.hp = m.mhp; m.mp = m.mmp;
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
  G.flags = {}; G.reso = []; G.objective = ''; G.stash = {}; G.chapterId = 'prologue'; G.cleared = false;
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
    v: 3, roster, partyIds: G.party.map(m => m.id), stash: G.stash, chapterId: G.chapterId,
    items: G.items, bag: G.bag, gold: G.gold, flags: G.flags, reso: G.reso, objective: G.objective, area: G.area, x: G.pos[0].x, y: G.pos[0].y,
  };
  return storageSet(SAVE_KEY, JSON.stringify(data));
}
function loadGame() {
  const raw = storageGet(SAVE_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (d.v !== 3) return false; // 古いバージョンのセーブは使わない（はじめからになる）
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
    G.area = d.area && G.areas[d.area] ? d.area : 'world';
    resetPositions(d.x, d.y);
    return true;
  } catch (e) { return false; }
}

