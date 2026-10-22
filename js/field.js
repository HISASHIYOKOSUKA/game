// フィールド：移動・エリア・人・魔物・描画・HUD
'use strict';

const field = { cv: null, ctx: null, W: 352, H: 352, moving: false, t: 0, speed: 0, anim: 0, input: null, dash: false, lastTs: 0 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIR_LIST = ['up', 'down', 'left', 'right'];
const cur = () => G.areas[G.area];

// いまいる場所の地域（出現する魔物の表を決める）
function regionAt(x, y) {
  const a = cur();
  if (a.isDungeon) return a.region;
  if (a.interior) return null;
  if (townAt(x, y)) return null;
  if (Math.hypot(x - 32, y - 22) < 25) return 'lumina';
  if (y >= 36 && x >= 50) return 'south';
  return 'east';
}
function encounterTable(region) {
  const ch = ENCOUNTERS[G.chapterId] || ENCOUNTERS.final;
  if (G.chapterId === 'final' && !G.flags.metSelena && (region === 'east' || region === 'south')) return ch.lumina; // ひとり旅のあいだは よわめ
  return ch[region] || ch.lumina || ENCOUNTERS.final[region] || [];
}
function placeName() {
  const a = cur(), lead = G.pos[0];
  if (a.interior) return a.name;
  const t = townAt(lead.x, lead.y);
  if (t) return t.name;
  return REGION_NAMES[regionAt(lead.x, lead.y)] || 'フィールド';
}
// 場所に合った曲
function areaMusic() {
  const a = cur(), lead = G.pos[0];
  if (G.musicOverride) return G.musicOverride;
  if (a.isDungeon) return a.music;
  if (a.interior) return (TOWNS.find(t => t.id === a.town) || TOWNS[0]).music;
  const t = townAt(lead.x, lead.y);
  if (t) return t.music;
  return CHAPTER_MUSIC[G.chapterId] || 'leon';
}
function refreshMusic() { if (G.mode !== 'battle' && G.mode !== 'title') Music.play(areaMusic()); }

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

// 向きごとの歩きコマ。設定画の4人は上下に正面・背面のみ、右向きは左向きの反転
const WALK_FRAMES = { down: ['stand0', 'stand0'], up: ['stand2', 'stand2'], left: ['walk2', 'walk3'], right: ['walk2', 'walk3'] };
const WALK_FRAMES_GEN = { down: ['stand0', 'down1'], up: ['stand2', 'up1'], left: ['walk2', 'walk3'], right: ['walk2', 'walk3'] };
function spriteFor(id, dir, step) {
  const F = isGen(id) ? WALK_FRAMES_GEN : WALK_FRAMES;
  return images[`${id}_${F[dir][step]}`];
}

// ============================================================
// エリアの準備
// ============================================================
function makeSolid(area) {
  area.solid = Array.from({ length: area.h }, () => new Array(area.w).fill(null));
  for (const o of area.objects) {
    if (o.walk) continue;
    for (let y = o.y + (o.solidFrom || 0); y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) area.solid[y][x] = o;
  }
}
function setupWorld() {
  const world = { id: 'world', name: 'フィールド', interior: false, map: G.map, w: MAP_W, h: MAP_H, objects: buildTownObjects(castleSprite), npcs: [] };
  makeSolid(world);
  G.areas = { world };
  for (const id in INTERIORS) { const a = buildInterior(id); makeSolid(a); G.areas[id] = a; }
  for (const did in DUNGEONS) DUNGEONS[did].floors.forEach((f, i) => { const a = buildDungeonFloor(did, i); makeSolid(a); G.areas[a.id] = a; });
  G.walkers = TOWN_NPCS.map(n => Object.assign({ dir: 'down', fx: n.x, fy: n.y, t: 1, moving: false, wait: rand(500, 2500), hx: n.x, hy: n.y, line: 0 }, n));
  G.mobsByArea = {};
  G.actors = [];
  G.cam = null;
  G.area = 'world';
}
const mobsHere = () => (G.mobsByArea[G.area] = G.mobsByArea[G.area] || []);

// ============================================================
// 人・魔物・当たり判定
// ============================================================
const activeWalkers = () => G.walkers.filter(w => condOk(w.when));
const indoorNpcs = () => (cur().npcs || []).filter(n => condOk(n.when) && !G.actorsHide?.[n.id]);
function entityAt(x, y, except) {
  for (const a of G.actors) if (a !== except && a.area === G.area && !a.hidden && !a.ghost && ((a.x === x && a.y === y) || (a.moving && a.fx === x && a.fy === y))) return { type: 'actor', e: a };
  if (G.area === 'world') {
    const n = npcAt(x, y);
    if (n && n !== except) return { type: 'story', e: n };
    const w = activeWalkers().find(w => w !== except && ((w.x === x && w.y === y) || (w.moving && w.fx === x && w.fy === y)));
    if (w) return { type: 'walker', e: w };
  } else {
    const n = indoorNpcs().find(n => n !== except && n.x === x && n.y === y);
    if (n) return { type: 'indoor', e: n };
  }
  const m = mobsHere().find(m => m !== except && m.x === x && m.y === y);
  if (m) return { type: 'mob', e: m };
  return null;
}
function partyAt(x, y) { return G.pos.some(p => p.x === x && p.y === y); }
function freeTile(x, y, except) {
  const a = cur();
  if (x < 0 || y < 0 || x >= a.w || y >= a.h) return false;
  if (!isWalkable(a.map[y][x]) || a.solid[y][x]) return false;
  return !entityAt(x, y, except) && !partyAt(x, y);
}

function stepParty(nx, ny) {
  const lead = G.pos[0];
  for (let i = G.pos.length - 1; i >= 1; i--) {
    const p = G.pos[i], q = G.pos[i - 1];
    p.fx = p.x; p.fy = p.y;
    if (p.x !== q.x || p.y !== q.y) p.dir = q.x > p.x ? 'right' : q.x < p.x ? 'left' : q.y > p.y ? 'down' : 'up';
    p.x = q.x; p.y = q.y;
  }
  lead.fx = lead.x; lead.fy = lead.y; lead.x = nx; lead.y = ny;
  field.moving = true; field.t = 0;
}

function tryMove(dir) {
  const a = cur();
  const lead = G.pos[0];
  lead.dir = dir;
  const [dx, dy] = DIRS[dir];
  const nx = lead.x + dx, ny = lead.y + dy;
  if (nx < 0 || ny < 0 || nx >= a.w || ny >= a.h) return false;
  const obj = a.solid[ny][nx];
  if (obj && !obj.hiddenNow && !(obj.kind === 'portal' && !G.flags.portalOpen)) { field.input = null; interact(obj, nx, ny); return false; }
  const ent = entityAt(nx, ny);
  if (ent) {
    if (ent.type === 'mob') { touchMob(ent.e); return false; }
    field.input = null;
    talkTo(ent);
    return false;
  }
  const t = a.map[ny][nx];
  if (t === T.ICOUNTER) { // カウンターごしに話す
    const behind = entityAt(nx + dx, ny + dy);
    if (behind) { field.input = null; talkTo(behind); }
    return false;
  }
  if (!isWalkable(t)) return false;
  stepParty(nx, ny);
  return true;
}

// ============================================================
// 調べる・入る・話す
// ============================================================
async function interact(o, x, y) {
  if (G.mode !== 'field') return;
  if ((o.kind === 'building' || o.kind === 'tower') && (x !== o.doorTile.x || y !== o.doorTile.y)) return; // 壁にぶつかっただけ
  if (o.counter) { // 水晶の台などは むこうの人と話す
    const lead = G.pos[0];
    const behind = entityAt(x + (x - lead.x), y + (y - lead.y));
    if (behind) talkTo(behind);
    return;
  }
  const ev = o.id && (DOOR_EVENTS[o.id] || []).find(d => condOk(d.when));
  if (ev) { Sfx.play('ok'); await runEvent(ev.event); return; }
  if (o.kind === 'chest') return openChest(o);
  if (o.kind === 'portal') return;
  const ent = ENTRANCES[o.id];
  if (ent && condOk(ent.when)) { await enterDungeon(ent.dungeon); return; }
  if (o.kind === 'building' && G.areas[o.id]) { await enterArea(o.id); return; }
  if (!o.text) return;
  G.mode = 'busy';
  Sfx.play('cursor');
  await dialog(o.text, ['とじる']);
  G.mode = 'field';
}

// ダンジョンの入口（オブジェクトの id → ダンジョン、入れる条件）
const ENTRANCES = {
  mine:   { dungeon: 'mine',   when: { flag: 'mineOpen' } },
  tower:  { dungeon: 'tower',  when: { flag: 'towerOpen' } },
  castle: { dungeon: 'castle', when: { flag: 'castleOpen' } },
};

async function openChest(o) {
  const key = 'chest_' + o.id;
  if (G.flags[key]) { G.mode = 'busy'; await dialog('からっぽだ。', ['とじる']); G.mode = 'field'; return; }
  G.mode = 'busy';
  G.flags[key] = true;
  Sfx.play('ok');
  const [id, n] = o.content;
  let text;
  if (id === 'gold') { G.gold += n; text = `${n} ゴールドを てにいれた！`; }
  else if (ITEMS[id]) { G.items[id] = (G.items[id] || 0) + n; text = `${ITEMS[id].name}を ${n > 1 ? n + 'こ ' : ''}てにいれた！`; }
  else if (EQUIPS[id]) { G.bag[id] = (G.bag[id] || 0) + 1; text = `${EQUIPS[id].name}を てにいれた！\n（メニューで そうびできます）`; }
  Sfx.play('lvup');
  updateHud();
  await dialog('たからばこを あけた！\n' + text, ['とじる']);
  G.mode = 'field';
}

async function warpTo(area, x, y, dir = 'down', ms = 220) {
  G.mode = 'busy'; field.input = null;
  await fade(true, ms);
  G.area = area;
  resetPositions(x, y);
  G.pos.forEach(p => p.dir = dir);
  G.safeSteps = 3;
  updateHud();
  refreshMusic();
  await fade(false, ms);
  G.mode = 'field';
}
async function enterArea(id) {
  Sfx.play('ok');
  const a = G.areas[id];
  await warpTo(id, a.exit.x, a.exit.y - 1, 'up');
}
async function enterDungeon(did) {
  Sfx.play('ok');
  const a = G.areas[DUNGEONS[did].floors[0].id];
  const e = a.spots.E;
  await warpTo(a.id, e.x, e.y - 1, 'up', 300);
  toast(a.name, 1800);
}
async function exitArea() {
  const from = cur();
  if (from.isDungeon) {
    const D = DUNGEONS[from.dungeon];
    const doorObj = G.areas.world.objects.find(o => o.id === from.dungeon || ENTRANCES[o.id]?.dungeon === from.dungeon);
    if (!D.exit) { await warpTo('castle2', 8, 4, 'down', 300); return; } // 神殿 → 城の玉座の間（ゆがみの前）
    await warpTo('world', D.exit.x, D.exit.y, 'down', 300);
    return;
  }
  const b = G.areas.world.objects.find(o => o.kind === 'building' && o.id === from.id);
  await warpTo('world', b.doorTile.x, b.doorTile.y + 1, 'down');
}
// 階段：> は次の階、< は前の階
const STAIR_LOCKS = { temple2: 'templeBoss1', temple4: 'templeBoss2', mine2: null, tower3: null };
async function useStairs(kind) {
  const a = cur(), D = DUNGEONS[a.dungeon];
  const next = kind === '>' ? a.floor + 1 : a.floor - 1;
  if (kind === '>' && STAIR_LOCKS[a.id] && !G.flags[STAIR_LOCKS[a.id]]) {
    G.mode = 'busy'; await dialog('ふしぎな ちからで 先へ すすめない……。', ['とじる']); G.mode = 'field';
    const lead = G.pos[0]; stepBackFrom(lead); return;
  }
  if (next < 0) return exitArea();
  const to = G.areas[D.floors[next].id];
  const spot = kind === '>' ? (to.spots['<'] || to.spots.E) : to.spots['>'];
  const free = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => [spot.x + dx, spot.y + dy]).find(([x, y]) => to.map[y] && isWalkable(to.map[y][x]) && to.map[y][x] !== T.DSTAIR && !to.solid[y][x]);
  await warpTo(to.id, free[0], free[1], kind === '>' ? 'up' : 'down', 260);
  toast(to.name, 1500);
}
function stepBackFrom(lead) {
  lead.x = lead.fx; lead.y = lead.fy;
  G.pos.forEach(p => { p.fx = p.x; p.fy = p.y; });
}

// 人に話しかける
async function talkTo(ent) {
  if (G.mode !== 'field') return;
  const n = ent.e;
  const lead = G.pos[0];
  n.dir = lead.x < n.x ? 'left' : lead.x > n.x ? 'right' : lead.y < n.y ? 'up' : 'down';
  const ev = (TALK_EVENTS[n.id] || []).find(d => condOk(d.when));
  if (ev) { Sfx.play('ok'); await runEvent(ev.event); return; }
  G.mode = 'busy';
  Sfx.play('cursor');
  if (n.role === 'shop') { await openShop(n.shop); return; }
  if (n.role === 'inn') { await visitInn(n.inn || 'inn'); return; }
  const lines = (n.chLines && (n.chLines[G.chapterId] || (G.flags.cleared && n.chLines.clear))) || n.lines;
  if (lines) {
    const idx = n.line || 0;
    const text = lines[idx % lines.length];
    n.line = idx + 1;
    G.eventRunning = true;
    await talk(n.sprite || n.id, text, n.name || '町の人');
    G.eventRunning = false;
  }
  G.mode = 'field';
}

async function visitInn(innId = 'inn') {
  const inn = INNS[innId] || INN;
  G.eventRunning = true;
  await talk(inn.keeper, `${inn.name}へ ようこそ！\nひとばん ${inn.price}G です。`, '宿屋の主人');
  G.eventRunning = false;
  const r = await dialog(`とまっていきますか？（セーブもします）`, ['とまる', 'やめる']);
  if (r === 0) {
    if (G.gold < inn.price) {
      await dialog('…おや、おかねが たりないみたいですね。\nまた きてくださいな。', ['とじる']);
    } else {
      G.gold -= inn.price;
      Music.stop();
      await fade(true);
      G.party.forEach(m => { m.hp = m.mhp; m.mp = m.mmp; });
      const ok = saveGame();
      updateHud();
      Sfx.play('heal');
      await sleep(900);
      await fade(false);
      refreshMusic();
      await dialog('おはようございます！ よく ねむれましたか？\nHPとMPが ぜんかいふくした！' + (ok ? '\n（セーブしました）' : '\n（このブラウザでは セーブできません）'), ['とじる']);
    }
  }
  G.mode = 'field';
}

function onArrive() {
  G.steps++;
  const lead = G.pos[0];
  const a = cur();
  updateHud();
  const trig = TRIGGERS.find(tr => (tr.area || 'world') === G.area && lead.x >= tr.x0 && lead.x <= tr.x1 && lead.y >= tr.y0 && lead.y <= tr.y1 && condOk(tr.when));
  if (trig) { runEvent(trig.event); return; }
  if (a.interior && !a.isDungeon) {
    if (a.map[lead.y][lead.x] === T.IMAT) exitArea();
    return;
  }
  if (a.isDungeon) {
    const s = a.spots;
    if (s.E && lead.x === s.E.x && lead.y === s.E.y) { if (a.floor > 0) useStairs('<'); else exitArea(); return; }
    if (s['>'] && lead.x === s['>'].x && lead.y === s['>'].y) { useStairs('>'); return; }
    if (s['<'] && lead.x === s['<'].x && lead.y === s['<'].y) { useStairs('<'); return; }
    return;
  }
  if (G.safeSteps > 0) G.safeSteps--;
  const m = areaMusic();
  if (Music.cur !== m) refreshMusic();
}

// ============================================================
// 町の人・シンボルの魔物・イベントの登場人物の動き
// ============================================================
function stepEntity(e, dt, dur) {
  if (!e.moving) return false;
  e.t += dt / dur;
  if (e.t >= 1) { e.t = 1; e.moving = false; e.fx = e.x; e.fy = e.y; return true; }
  return false;
}
function startStep(e, dir) {
  const [dx, dy] = DIRS[dir];
  e.dir = dir;
  e.fx = e.x; e.fy = e.y; e.x += dx; e.y += dy; e.t = 0; e.moving = true;
}

function updateWalkers(dt) {
  for (const w of activeWalkers()) {
    stepEntity(w, dt, 420);
    if (w.moving) continue;
    w.wait -= dt;
    if (w.wait > 0) continue;
    w.wait = rand(900, 2800);
    if (!w.roam) continue;
    const dir = pick(DIR_LIST);
    const [dx, dy] = DIRS[dir];
    const nx = w.x + dx, ny = w.y + dy;
    if (Math.abs(nx - w.hx) > w.roam || Math.abs(ny - w.hy) > w.roam) { w.dir = dir; continue; }
    if (freeTile(nx, ny, w) && townAt(nx, ny)) startStep(w, dir); else w.dir = dir;
  }
}

function updateActors(dt) {
  for (const a of G.actors) {
    if (a.area !== G.area) continue;
    if (a.jumpT > 0) a.jumpT -= dt;
    if (a.emoteT > 0) a.emoteT -= dt;
    if (stepEntity(a, dt, a.speed || 260) || !a.moving) {
      if (a.path && a.path.length) startStep(a, a.path.shift());
      else if (a.onDone) { const f = a.onDone; a.onDone = null; f(); }
    }
  }
  // パーティの台本移動
  if (G.ppath && !field.moving) {
    if (G.ppath.length) {
      const dir = G.ppath.shift();
      const lead = G.pos[0];
      lead.dir = dir;
      const [dx, dy] = DIRS[dir];
      stepParty(lead.x + dx, lead.y + dy);
    } else { const f = G.ppathDone; G.ppath = null; G.ppathDone = null; if (f) f(); }
  }
  if (field.moving && (G.mode === 'busy' || G.mode === 'event')) {
    field.t += dt / 200;
    if (field.t >= 1) { field.t = 1; field.moving = false; for (const p of G.pos) { p.fx = p.x; p.fy = p.y; } }
  }
}

const MOB_TILES = new Set([T.GRASS, T.FLOWER, T.FOREST, T.SAND, T.PATH, T.DFLOOR, T.DCARPET]);
function mobTileOk(x, y) {
  const a = cur();
  if (x < 1 || y < 1 || x >= a.w - 1 || y >= a.h - 1) return false;
  if (!a.isDungeon && TOWNS.some(t => x >= t.x0 - 1 && x <= t.x1 + 1 && y >= t.y0 - 1 && y <= t.y1 + 1)) return false;
  if (a.isDungeon) {
    for (const k of ['E', '<', '>']) { const s = a.spots[k]; if (s && Math.abs(s.x - x) + Math.abs(s.y - y) < 4) return false; }
    if (a.spots.X) return false; // ボス部屋には出ない
  }
  return MOB_TILES.has(a.map[y][x]) && !a.solid[y][x];
}
function mobCap() {
  const a = cur();
  if (a.interior && !a.isDungeon) return 0;
  if (a.isDungeon) return a.spots.X ? 0 : 7;
  return G.chapterId === 'prologue' ? 12 : 18;
}
function spawnMob(farFromPlayer = true) {
  const a = cur(), lead = G.pos[0];
  for (let tries = 0; tries < 60; tries++) {
    const x = ri(1, a.w - 2), y = ri(1, a.h - 2);
    if (!mobTileOk(x, y) || entityAt(x, y) || partyAt(x, y)) continue;
    if (farFromPlayer && Math.hypot(x - lead.x, y - lead.y) < (a.isDungeon ? 6 : 9)) continue;
    const table = encounterTable(regionAt(x, y));
    if (!table.length) return;
    const group = rollEncounter(table);
    mobsHere().push({ group, x, y, fx: x, fy: y, t: 1, moving: false, dir: 'left', wait: rand(300, 1500), stun: 0 });
    return;
  }
}
function updateMobs(dt) {
  const cap = mobCap();
  if (!cap) return;
  const list = mobsHere();
  G.mobTimer = (G.mobTimer || 0) - dt;
  if (list.length < cap && G.mobTimer <= 0) { spawnMob(); G.mobTimer = list.length < cap / 2 ? 200 : 4000; }
  if (G.invuln > 0) G.invuln -= dt;
  const lead = G.pos[0];
  const a = cur();
  for (const m of list) {
    if (m.stun > 0) m.stun -= dt;
    const chasing = m.stun <= 0 && Math.abs(m.x - lead.x) + Math.abs(m.y - lead.y) <= (a.isDungeon ? 4 : 5);
    stepEntity(m, dt, chasing ? 330 : 520);
    if (m.moving) continue;
    m.wait -= dt;
    if (m.wait > 0) continue;
    const metal = m.group[0] === 'metalslime';
    let dirs;
    if (chasing) {
      const dx = Math.sign(lead.x - m.x) * (metal ? -1 : 1), dy = Math.sign(lead.y - m.y) * (metal ? -1 : 1);
      const hx = dx > 0 ? 'right' : 'left', vy = dy > 0 ? 'down' : 'up';
      const prefH = Math.abs(lead.x - m.x) >= Math.abs(lead.y - m.y);
      dirs = [];
      if (dx && prefH) dirs.push(hx);
      if (dy) dirs.push(vy);
      if (dx && !prefH) dirs.push(hx);
      m.wait = metal ? 120 : 160;
    } else {
      dirs = Math.random() < 0.55 ? [pick(DIR_LIST)] : [];
      m.wait = rand(700, 1600);
    }
    for (const dir of dirs) {
      const [dx, dy] = DIRS[dir];
      const nx = m.x + dx, ny = m.y + dy;
      if (nx === lead.x && ny === lead.y && !field.moving) { m.dir = dir; touchMob(m); break; }
      if (mobTileOk(nx, ny) && !entityAt(nx, ny, m) && !partyAt(nx, ny)) { startStep(m, dir); break; }
    }
  }
}

async function touchMob(m) {
  if (G.mode !== 'field' || m.stun > 0 || G.invuln > 0) return;
  field.input = null;
  const r = await startBattle(m.group);
  const list = mobsHere();
  if (r === 'run') { m.stun = 3000; G.invuln = 1500; }
  else G.mobsByArea[G.area] = list.filter(x => x !== m);
}

function rollEncounter(table) {
  const total = table.reduce((s, e) => s + e[1], 0);
  const roll1 = () => { let r = Math.random() * total; for (const [id, w] of table) { if ((r -= w) < 0) return id; } return table[0][0]; };
  const first = roll1();
  if (first === 'darkdragon' || first === 'metalslime') return [first];
  const n = ri(1, Math.min(3, G.party.length + 1)); // ひとりのときは 2体まで
  const list = [first];
  for (let i = 1; i < n; i++) { const id = roll1(); if (id !== 'darkdragon' && id !== 'metalslime') list.push(id); }
  return list;
}

function updateField(dt) {
  field.anim += dt;
  updateActors(dt);
  if (G.area === 'world') updateWalkers(dt);
  if (G.mode !== 'field') return;
  updateMobs(dt);
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

// ============================================================
// 描画
// ============================================================
function drawField() {
  const c = field.ctx, W = field.W, H = field.H;
  const a = cur();
  c.setTransform(R, 0, 0, R, 0, 0);
  c.imageSmoothingEnabled = false;
  const t = field.moving ? field.t : 1;
  const posPx = p => ({ x: (p.fx + (p.x - p.fx) * t) * TILE, y: (p.fy + (p.y - p.fy) * t) * TILE });
  const lp = posPx(G.pos[0]);
  const aw = a.w * TILE, ah = a.h * TILE;
  let fx = lp.x, fy = lp.y;
  if (G.cam) { // カメラの演出
    G.cam.cx = G.cam.cx === undefined ? fx : G.cam.cx + (G.cam.x * TILE - G.cam.cx) * 0.08;
    G.cam.cy = G.cam.cy === undefined ? fy : G.cam.cy + (G.cam.y * TILE - G.cam.cy) * 0.08;
    fx = G.cam.cx; fy = G.cam.cy;
  }
  let camX = aw <= W ? -Math.round((W - aw) / 2) : Math.round(clamp(fx + TILE / 2 - W / 2, 0, aw - W));
  let camY = ah <= H ? -Math.round((H - ah) / 2) : Math.round(clamp(fy + TILE / 2 - H / 2, 0, ah - H));
  if (G.fieldShake > 0) { camX += Math.round(rand(-G.fieldShake, G.fieldShake)); camY += Math.round(rand(-G.fieldShake, G.fieldShake)); G.fieldShake *= 0.9; if (G.fieldShake < 0.3) G.fieldShake = 0; }
  if (a.interior) { c.fillStyle = '#0c0a12'; c.fillRect(0, 0, W, H); }
  const frame = Math.floor(field.anim / 500) % 2;
  const x0 = Math.max(0, Math.floor(camX / TILE)), y0 = Math.max(0, Math.floor(camY / TILE));
  const x1 = Math.min(a.w - 1, Math.ceil((camX + W) / TILE)), y1 = Math.min(a.h - 1, Math.ceil((camY + H) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tt = a.map[y][x];
    const sx = x * TILE - camX, sy = y * TILE - camY;
    if (a.isDungeon) {
      let v = ((x * 7 + y * 13) % 10);
      if (tt === T.DWALL) v = y < a.h - 1 && a.map[y + 1][x] !== T.DWALL ? 'face' : 'top';
      c.drawImage(makeTile(tt, v, tt === T.DPIT ? frame : 0, 'd:' + a.tileset), sx, sy);
      continue;
    }
    if (a.interior) {
      let v = 0;
      if (tt === T.IWALL) v = y < a.h - 1 && a.map[y + 1][x] !== T.IWALL ? 'face' : 'top';
      c.drawImage(makeTile(tt, v, 0, a.id), sx, sy);
      continue;
    }
    const variant = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    let v = tt === T.WATER || tt === T.BRIDGE ? variant % 3 : variant % 4;
    if (tt === T.FENCE || tt === T.CWALL || tt === T.HEDGE) {
      const tw = TOWNS.find(tw => x >= tw.x0 && x <= tw.x1 && y >= tw.y0 && y <= tw.y1);
      v = tw && (x === tw.x0 || x === tw.x1) && y !== tw.y0 && y !== tw.y1 ? 1 : 0;
    }
    c.drawImage(makeTile(tt, v, tt === T.WATER || tt === T.BRIDGE ? frame : 0), sx, sy);
    if (tt === T.WATER) { // 岸の白波
      const land = (xx, yy) => xx >= 0 && yy >= 0 && xx < a.w && yy < a.h && a.map[yy][xx] !== T.WATER && a.map[yy][xx] !== T.BRIDGE;
      c.fillStyle = frame ? '#ffffff' : '#d8f0ff';
      if (land(x, y - 1)) c.fillRect(sx, sy, TILE, 2);
      if (land(x, y + 1)) c.fillRect(sx, sy + TILE - 2, TILE, 2);
      if (land(x - 1, y)) c.fillRect(sx, sy, 2, TILE);
      if (land(x + 1, y)) c.fillRect(sx + TILE - 2, sy, 2, TILE);
    }
  }
  // オブジェクト・人・魔物・パーティを、足元の y 座標順に描く
  const list = [];
  for (const o of a.objects) if (o.under) drawObject(c, o, o.x * TILE - camX, (o.y + o.h) * TILE - camY);
  for (const o of a.objects) {
    if (o.under) continue;
    if (o.kind === 'portal' && !G.flags.portalOpen) continue;
    const ox = o.x * TILE - camX, base = (o.y + o.h) * TILE - camY;
    if (ox > W + 64 || ox + o.w * TILE < -64 || base < -16 || base - o.sprite.height > H + 16) continue;
    list.push({ base, draw: () => drawObject(c, o, ox, base) });
  }
  const walkFrame = Math.floor(field.anim / 160) % 2;
  const ePx = e => ({ x: (e.fx + (e.x - e.fx) * e.t) * TILE - camX, y: (e.fy + (e.y - e.fy) * e.t) * TILE - camY });
  const people = G.area === 'world'
    ? [...activeNpcs().map(n => ({ n, x: n.x * TILE - camX, y: n.y * TILE - camY })), ...activeWalkers().map(n => ({ n, ...ePx(n) }))]
    : indoorNpcs().map(n => ({ n, x: n.x * TILE - camX, y: n.y * TILE - camY }));
  for (const ac of G.actors) if (ac.area === G.area && !ac.hidden) people.push({ n: ac, ...ePx(ac) });
  for (const p of people) {
    if (p.x < -40 || p.x > W + 40 || p.y < -80 || p.y > H + 40) continue;
    list.push({ base: p.y + TILE, draw: () => drawNpc(c, p.n, p.x, p.y + TILE, walkFrame) });
  }
  for (const m of mobsHere()) {
    const p = ePx(m);
    if (p.x < -40 || p.x > W + 40 || p.y < -60 || p.y > H + 40) continue;
    list.push({ base: p.y + TILE, draw: () => drawMob(c, m, p.x, p.y + TILE) });
  }
  if (!G.hideParty) G.pos.forEach((p, i) => {
    if (G.hideFollowers && i > 0) return;
    const pp = posPx(p);
    list.push({ base: pp.y + TILE - camY - 0.01 * i, draw: () => drawMember(c, p, i, pp, camX, camY, walkFrame) });
  });
  list.sort((p, q) => p.base - q.base);
  for (const it of list) it.draw();
  // ダンジョンの暗さ
  if (a.isDungeon && a.tileset !== 'castle') {
    const g = c.createRadialGradient(lp.x + 16 - camX, lp.y + 8 - camY, 60, lp.x + 16 - camX, lp.y + 8 - camY, 260);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, a.tileset === 'temple' ? 'rgba(10,0,20,0.6)' : 'rgba(0,0,0,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  drawFieldParticles(c, camX, camY);
  if (G.screenTint) { c.fillStyle = G.screenTint; c.fillRect(0, 0, W, H); }
}

// エンディングなどで使う 画面の粒（紙ふぶき・光）
function drawFieldParticles(c, camX, camY) {
  if (!G.fparts) return;
  if (G.confetti && Math.random() < 0.6) {
    G.fparts.push({ x: rand(0, field.W), y: -6, vx: rand(-0.02, 0.02), vy: rand(0.04, 0.09), life: 6000, t: 0, col: pick(['#ff6080', '#ffd040', '#60c0ff', '#80e080', '#ffffff', '#c080ff']), rot: rand(0, 6), screen: true });
  }
  for (const p of G.fparts) {
    p.t += 16; p.x += p.vx * 16; p.y += p.vy * 16; p.rot += 0.1;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.globalAlpha = Math.min(1, (p.life - p.t) / 800); c.fillRect(-2, -1, 4, 2); c.restore();
  }
  G.fparts = G.fparts.filter(p => p.t < p.life && p.y < field.H + 10);
}

function drawObject(c, o, ox, base) {
  let spr = o.sprite;
  if (o.frames) spr = o.frames[Math.floor(field.anim / 180) % o.frames.length];
  if (o.kind === 'chest' && G.flags['chest_' + o.id]) spr = o.openSprite;
  const W = o.w * TILE;
  if (o.kind === 'building') { // 地面の影
    c.fillStyle = 'rgba(30,40,20,0.22)';
    c.fillRect(ox + 8, base - 4, W - 4, 8);
    c.fillRect(ox + W - 4, base - spr.height + 30, 8, spr.height - 26);
  } else if (['tree', 'lamp', 'sign', 'mailbox', 'stall', 'deco'].includes(o.kind)) {
    c.fillStyle = 'rgba(20,20,20,0.25)';
    c.beginPath(); c.ellipse(ox + 16, base - 3, o.kind === 'tree' ? 11 : 7, 3.5, 0, 0, 7); c.fill();
  }
  if (o.glowCol) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + Math.sin(field.anim / 150 + o.x) * 0.08; c.fillStyle = o.glowCol; c.beginPath(); c.arc(ox + 16, base - 36, 18, 0, 7); c.fill(); c.restore(); }
  if (o.glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + Math.sin(field.anim / 300 + o.x) * 0.15; c.fillStyle = '#9fe0ff'; c.beginPath(); c.arc(ox + 16, base - 20, 22, 0, 7); c.fill(); c.restore(); }
  c.drawImage(spr, ox + (W - spr.width) / 2, base - spr.height);
}

const EMOTES = { '!': '#ff4040', '?': '#4080ff', '♪': '#ff60c0', '…': '#606070', '💢': '#ff4040', '♥': '#ff6080' };
function drawNpc(c, n, sx, base, walkFrame = 0) {
  const img = n.monster ? images['mon_' + n.monster] : spriteFor(n.sprite, n.dir, n.moving ? walkFrame : 0);
  if (!img) return;
  const h = (n.monster ? (n.big ? 46 : 30) : 42) * (n.scale || 1), w = img.width * h / img.height;
  let bob = n.monster ? Math.sin(field.anim / 200 + n.x) * 1.5 : (n.moving && walkFrame ? -1 : 0);
  if (n.jumpT > 0) bob -= Math.sin((1 - n.jumpT / 300) * Math.PI) * 10;
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath(); c.ellipse(sx + 16, base - 2, 9 * (n.scale || 1), 3.5, 0, 0, 7); c.fill();
  c.save();
  if (n.alpha !== undefined) c.globalAlpha = n.alpha;
  c.imageSmoothingEnabled = !isGen(n.sprite);
  const flip = n.monster ? n.dir !== 'left' : n.dir === 'right';
  if (flip) { c.translate(sx + 16, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, base - 2 - h + bob, w, h); }
  else c.drawImage(img, sx + 16 - w / 2, base - 2 - h + bob, w, h);
  c.restore();
  if (n.emoteT > 0) drawEmote(c, n.emote, sx + 16, base - h - 8 + bob);
}
function drawEmote(c, e, x, y) {
  c.save();
  c.fillStyle = '#ffffff'; c.strokeStyle = OUT; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(x, y - 6, 9, 8, 0, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x - 3, y + 1); c.lineTo(x, y + 6); c.lineTo(x + 3, y + 1); c.fill();
  c.fillStyle = EMOTES[e] || '#303040'; c.font = 'bold 12px "DotGothic16", sans-serif'; c.textAlign = 'center';
  c.fillText(e === '💢' ? '#' : e, x, y - 1);
  c.restore();
}

function drawMob(c, m, sx, base) {
  const id = m.group[0];
  const img = images['mon_' + id];
  if (!img) return;
  const big = MONSTERS[id].scale >= 1.1;
  const h = big ? 40 : 30, w = img.width * h / img.height;
  const bob = Math.sin(field.anim / 180 + m.x * 3) * 1.5;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(sx + 16, base - 2, w * 0.4, 4, 0, 0, 7); c.fill();
  c.save();
  if (m.stun > 0 && Math.floor(m.stun / 100) % 2) c.globalAlpha = 0.35;
  c.imageSmoothingEnabled = true;
  const flip = m.dir === 'right' ? !MONSTER_FACES_LEFT.has(id) : MONSTER_FACES_LEFT.has(id);
  if (flip) { c.translate(sx + 16, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, base - 2 - h + bob, w, h); }
  else c.drawImage(img, sx + 16 - w / 2, base - 2 - h + bob, w, h);
  c.restore();
  if (m.group.length > 1) { // 数のバッジ
    c.fillStyle = OUT; c.fillRect(sx + 22, base - h - 4, 13, 10);
    c.fillStyle = '#ffd75e'; c.font = '9px "DotGothic16", monospace'; c.textAlign = 'center';
    c.fillText('×' + m.group.length, sx + 28.5, base - h + 4);
  }
}

function drawMember(c, p, i, pp, camX, camY, walkFrame) {
  const m = G.party[i];
  const moving = field.moving && (p.x !== p.fx || p.y !== p.fy);
  const img = spriteFor(m.id, p.dir, moving ? walkFrame : 0);
  if (!img) return;
  const h = 42, w = img.width * h / img.height;
  const cx = pp.x + TILE / 2 - camX, by = pp.y + TILE - 2 - camY;
  let bob = moving && walkFrame ? (p.dir === 'up' || p.dir === 'down' ? -2 : -1) : 0;
  if (p.jumpT > 0) { bob -= Math.sin((1 - p.jumpT / 300) * Math.PI) * 10; p.jumpT -= 16; }
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath(); c.ellipse(cx, by, 9, 3.5, 0, 0, 7); c.fill();
  c.save();
  if (!alive(m)) c.globalAlpha = 0.45;
  if (G.invuln > 0 && Math.floor(G.invuln / 100) % 2) c.globalAlpha = 0.4;
  c.imageSmoothingEnabled = !isGen(m.id);
  if (p.dir === 'right') { c.translate(cx, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, by - h + bob, w, h); }
  else c.drawImage(img, cx - w / 2, by - h + bob, w, h);
  c.restore();
  if (p.emoteT > 0) { drawEmote(c, p.emote, cx, by - h - 8 + bob); p.emoteT -= 16; }
  // 森の中では足元を木で隠す
  const a = cur();
  const tx = Math.round(pp.x / TILE), ty = Math.round(pp.y / TILE);
  if (!a.interior && a.map[ty] && a.map[ty][tx] === T.FOREST && !moving) {
    const tile = makeTile(T.FOREST, (((tx * 73856093) ^ (ty * 19349663)) >>> 0) % 4, 0);
    c.drawImage(tile, 0, 20, TILE, 12, tx * TILE - camX, ty * TILE + 20 - camY, TILE, 12);
  }
}

function updateHud() {
  const lead = G.pos[0];
  if (!lead) return;
  const reg = regionAt(lead.x, lead.y);
  $('#zone-name').textContent = placeName();
  const safe = !reg;
  $('#zone-danger').textContent = safe ? (cur().isDungeon ? '' : 'まもののいない場所') : '';
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
    el.querySelector('.mini-name').textContent = `${m.name} ${m.lv}`;
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
