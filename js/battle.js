// バトル
'use strict';

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
  leon:   [[0, false], [0, false], [1, false], [3, true]],
  selena: [[0, false], [2, false], [2, false], [3, true]],
  garo:   [[0, false], [0, false], [2, false], [1, false]],
  noa:    [[0, false], [2, false], [1, false], [3, false]],
};
// 元絵で左を向いているモンスター（右向きにするため反転する）
const MONSTER_FACES_LEFT = new Set(['ghost', 'harpy', 'lizardman', 'scorpion', 'skeleton']);

// バトルの背景。theme：field_lumina / field_east / field_south / mine / tower / castle / temple / last
function makeBattleBg(theme) {
  const cv = document.createElement('canvas');
  cv.width = battle.W * R; cv.height = battle.H * R;
  const c = cv.getContext('2d');
  c.scale(R, R);
  const W = battle.W, H = battle.H;
  const r = mulberry32(theme.length * 99);
  if (theme.startsWith('field')) {
    const sky = images.bg_sky;
    const skyH = sky ? W * sky.height / sky.width : 110;
    const tint = theme === 'field_south' ? ['#8ab84a', '#76a43e', '#628f33'] : theme === 'field_east' ? ['#9ab858', '#86a24a', '#728c3c'] : ['#7cb444', '#68a23a', '#57902f'];
    if (sky) { c.imageSmoothingEnabled = true; c.drawImage(sky, 0, 0, W, skyH); }
    if (theme === 'field_east') { c.fillStyle = 'rgba(255,180,90,0.18)'; c.fillRect(0, 0, W, skyH); }
    if (theme === 'field_south') { c.fillStyle = 'rgba(120,160,255,0.15)'; c.fillRect(0, 0, W, skyH); }
    const gy = Math.floor(skyH) - 6;
    const grad = c.createLinearGradient(0, gy, 0, H);
    grad.addColorStop(0, tint[0]); grad.addColorStop(0.5, tint[1]); grad.addColorStop(1, tint[2]);
    c.fillStyle = grad; c.fillRect(0, gy, W, H - gy);
    const g2 = c.createLinearGradient(0, gy - 10, 0, gy + 8);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, tint[0]);
    c.fillStyle = g2; c.fillRect(0, gy - 10, W, 18);
    c.fillStyle = 'rgba(160,120,70,0.55)'; c.beginPath(); c.ellipse(W / 2, H - 30, W * 0.62, 46, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(190,150,95,0.45)'; c.beginPath(); c.ellipse(W / 2, H - 28, W * 0.5, 34, 0, 0, 7); c.fill();
    for (let i = 0; i < 160; i++) {
      const x = r() * W, y = gy + 4 + r() * (H - gy);
      c.fillStyle = r() < 0.5 ? 'rgba(30,70,20,0.45)' : 'rgba(150,210,90,0.35)';
      c.fillRect(Math.floor(x), Math.floor(y), 1, 2 + Math.floor(r() * 2));
    }
    return cv;
  }
  if (theme === 'last') {
    const img = images.eclipse_omen;
    if (img) { c.imageSmoothingEnabled = true; c.drawImage(img, 0, 0, W, H * 0.75); }
    const g = c.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, 'rgba(20,6,40,0)'); g.addColorStop(0.35, '#1e0c34'); g.addColorStop(1, '#0a0418');
    c.fillStyle = g; c.fillRect(0, H * 0.5, W, H * 0.5);
    c.strokeStyle = 'rgba(200,120,255,0.35)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(W / 2, H - 40, 60 + i * 30, 12 + i * 6, 0, 0, 7); c.stroke(); }
    return cv;
  }
  const pal = {
    mine:   ['#3a2a1e', '#5a4430', '#7a5e40', '#2a1c12', '#ff9a5a'],
    tower:  ['#0e1838', '#1e3060', '#3a5a9a', '#081028', '#7fd8ff'],
    castle: ['#2a2a36', '#4a4a5a', '#7a7a8c', '#1a1a24', '#e8c048'],
    temple: ['#0c0418', '#2a1440', '#4a2a6a', '#050010', '#c060ff'],
  }[theme] || ['#222', '#333', '#555', '#111', '#fff'];
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[3]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 奥の壁
  for (let i = 0; i < 9; i++) {
    const x = i * 44 - 10;
    c.fillStyle = pal[3] + 'aa'; c.fillRect(x, 0, 10, H * 0.55);
    if (theme === 'castle') { c.fillStyle = '#a82838'; c.fillRect(x + 16, 20, 14, 46); c.fillStyle = pal[4]; c.fillRect(x + 16, 20, 14, 3); }
  }
  // 床
  c.fillStyle = pal[2]; c.beginPath(); c.moveTo(0, H * 0.55); c.lineTo(W, H * 0.55); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  c.strokeStyle = pal[3] + '88'; c.lineWidth = 1;
  for (let y = H * 0.58; y < H; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  for (let x = -W; x < W * 2; x += 30) { c.beginPath(); c.moveTo(W / 2 + (x - W / 2) * 0.3, H * 0.55); c.lineTo(x, H); c.stroke(); }
  // 光る結晶や たいまつ
  for (let i = 0; i < 7; i++) {
    const x = r() * W, y = 20 + r() * H * 0.4;
    const gg = c.createRadialGradient(x, y, 0, x, y, 18);
    gg.addColorStop(0, pal[4] + 'cc'); gg.addColorStop(1, pal[4] + '00');
    c.fillStyle = gg; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill();
  }
  if (theme === 'temple') for (let i = 0; i < 60; i++) { c.fillStyle = r() < 0.5 ? '#ffffff' : '#c060ff'; c.fillRect(r() * W, r() * H * 0.5, 1, 1); }
  return cv;
}
function battleTheme() {
  const a = cur();
  if (a.isDungeon) return a.tileset === 'mine' ? 'mine' : a.tileset;
  const reg = regionAt(G.pos[0].x, G.pos[0].y) || 'lumina';
  return 'field_' + (reg === 'south' ? 'south' : reg === 'east' ? 'east' : 'lumina');
}
// 戦闘ポーズの画像（設定画の4人は表を使い、描いたキャラは そのまま）
function partyPose(m, pose) {
  if (isGen(m.id)) return [images[`${m.id}_battle${pose}`], false];
  const [src, mirror] = BATTLE_POSES[poseKey(m.id)][pose];
  return [images[`${m.id}_battle${src}`], mirror];
}
function enemyImage(e) { return e.data.sprite ? images[`${e.data.sprite}_battle${e.pose || 0}`] : images['mon_' + e.id]; }

function makeEnemy(id, i, n, hpMul = 1) {
  const d = MONSTERS[id];
  let [x, y] = ENEMY_SPOTS[n][i];
  const hp = Math.round(d.hp * hpMul);
  const e = { id, data: d, name: d.name, hp, mhp: hp, atk: d.atk, def: d.def, spd: d.spd,
    x, y, k: 0.9 * d.scale * (n >= 3 ? 0.85 : 1), blink: 0, dying: 0, gone: false, fled: false, ox: 0, turn: 0 };
  const img = enemyImage(e);
  if (img && d.boss) {
    const maxH = d.last ? 185 : 150, maxW = d.last ? 200 : 170;
    e.k = Math.min(e.k, maxH / img.height, maxW / img.width);
    if (n === 1) { e.x = d.last ? 112 : 105; e.y = d.last ? 248 : 240; }
  }
  if (d.sprite) e.k = 0.8;
  const baseImg = d.img || id;
  e.flip = d.sprite ? true : MONSTER_FACES_LEFT.has(baseImg);
  return e;
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
  Music.stop();
  Sfx.play('encounter');
  // エンカウント演出
  const fl = $('#flash');
  for (let i = 0; i < 3; i++) { fl.classList.add('on'); await sleep(70); fl.classList.remove('on'); await sleep(70); }
  await fade(true, 300);
  if (!opts.last) G.musicOverride = null;
  B = {
    enemies: ids.map((id, i) => makeEnemy(id, i, ids.length, opts.hpMul || 1)),
    fx: [], parts: [], nums: [], shake: 0, flash: 0, flashColor: '#ffffff', dim: 0, dimColor: '#000000', guard: 0, guardMul: 0.5,
    active: null, targetSel: null, actors: {}, over: false, boss: !!opts.boss, last: !!opts.last, cutin: null, phase: opts.phase,
  };
  Music.play(opts.last ? 'last' : opts.boss ? 'boss' : 'battle');
  nameEnemies(B.enemies);
  const yShift = (4 - G.party.length) * 16; // 人数が少ないときは中央に寄せる
  G.party.forEach((m, i) => B.actors[m.id] = { x: PARTY_SPOTS[i][0], y: PARTY_SPOTS[i][1] + yShift, ox: 0, pose: 0, blink: 0, hurt: 0 });
  battle.bg = makeBattleBg(opts.bg || (opts.last ? 'last' : battleTheme()));
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
    if (cmds.some(c => c.type === 'reso' && (c.partner === m.id || c.partner === 'all'))) { cmds.push({ type: 'reserved', actor: m }); i++; continue; }
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
    if (m.id === 'leon' && G.flags.eclipse && ['selena', 'garo', 'noa'].every(id => G.party.some(p => p.id === id && alive(p)))) partners.push('all');
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
        const r = RESONANCE[id];
        if (id === 'all') return { label: r.name, sub: `全員MP ${r.mp[0]}`, value: id, disabled: G.party.filter(p => !findBase(p.id).guest).some(p => p.mp < r.mp[0]) };
        const p = G.party.find(x => x.id === id);
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
      const list = skillsOf(m).filter(s => SKILLS[s].type === v);
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
    const img = enemyImage(e);
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
    if (a.type === 'enemy') { for (let k = 0; k < (a.actor.data.actions || 1) && B && !B.over && !a.actor.gone; k++) { await enemyAct(a.actor); if (await checkEnd()) return; } }
    else await partyAct(a);
    if (!B) return;
    renderBattleStatus();
    if (await checkEnd()) return;
  }
  if (B && B.guard > 0) { B.guard--; if (B.guard === 0) await say('守りの こうかが きれた。', 600); }
  if (B) for (const e of livingEnemies()) if (e.data.regen && e.hp < e.mhp) { const h = Math.min(e.mhp - e.hp, e.data.regen); e.hp += h; popNum(e, h, '#7dff8a'); await say(`${e.name}の きずが ふさがっていく……（HP+${h}）`, 600); }
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
  if (a.partner === 'all') return eclipseAct(a);
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

// 4人の共鳴技「エクリプス・ブレイク」
async function eclipseAct(a) {
  const r = RESONANCE.all;
  const four = ['leon', 'selena', 'garo', 'noa'].map(id => G.party.find(p => p.id === id));
  if (four.some(p => !p || !alive(p))) { await say('みんなの ちからが そろわない……！', 800); return; }
  if (four.some(p => p.mp < r.mp[0])) { await say('MPが たりなくて 共鳴できない！', 800); return; }
  four.forEach(p => p.mp -= r.mp[0]);
  renderBattleStatus();
  await Promise.all(four.map(p => stepForward(p, 1)));
  B.cutin = { text: r.name, t: 0, faces: ['leon', 'selena', 'garo', 'noa'], big: true };
  Sfx.play('lvup');
  flash(0.8);
  await say(`みんなの こころが ひとつに なる……！\n共鳴技「${r.name}」！`, 1500);
  const fx = spawnFx('eclipse', null);
  await sleep(fx.dur * fx.hit);
  const stat = Math.round(four[0].atk + four[1].mag + four[2].atk + four[3].mag);
  for (const t of livingEnemies()) await hitEnemy(t, stat, r.power, 'mag', 300);
  if (!B) return;
  await Promise.all(four.map(p => stepBack(p)));
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
    targets.forEach(t => spawnFx(s.fx || 'heal', t));
    await sleep(FX[s.fx || 'heal'].dur * FX[s.fx || 'heal'].hit);
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
    spawnFx(s.fx || 'holy', target);
    await sleep(FX.holy.dur * FX.holy.hit);
    if (alive(target)) { await say('しかし なにも おこらなかった。', 700); return; }
    target.hp = Math.floor(target.mhp * (s.ratio || 0.5));
    renderBattleStatus();
    await say(`${target.name}は いきかえった！`, 800);
  } else if (s.kind === 'guard') {
    spawnFx(s.fx || 'guard', 'party');
    Sfx.play('magic');
    B.guard = s.turns || 3; B.guardMul = s.mul || 0.5;
    await sleep(FX.guard.dur * 0.7);
    await say(`みんなの 守りが かたくなった！（${B.guard}ターン）`, 800);
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
  let sp = null;
  if (Array.isArray(d.special)) { e.turn++; if (Math.random() < (d.boss ? 0.55 : 0.35)) sp = d.special[(e.turn + ri(0, 1)) % d.special.length]; }
  else if (d.special && Math.random() < 0.3) sp = d.special;
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
    if (sp.healSelf) { const h = Math.min(e.mhp - e.hp, Math.round(e.mhp * sp.healSelf)); e.hp += h; if (h) lines.push(`${e.name}の HPが ${h} かいふくした。`); }
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
  if (B.guard > 0) v = Math.round(v * (B.guardMul || 0.5));
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
  Music.stop();
  Sfx.play('win');
  G.party.forEach(m => { if (alive(m)) B.actors[m.id].pose = 3; });
  if (B.last) { await sleep(1200); endBattle('win', true); return; } // ラスボスの形態変化は イベント側で続ける
  const exp = beaten.reduce((s, e) => s + e.data.exp, 0);
  const gold = beaten.reduce((s, e) => s + e.data.gold, 0);
  G.gold += gold;
  await say(`まものたちを やっつけた！\n${exp} の経験値と ${gold} ゴールドを てにいれた！`, 0);
  await waitTap();
  for (const m of G.party) {
    if (!alive(m)) continue;
    m.exp += exp;
    while (m.exp >= expForLevel(m.lv + 1)) {
      const before = skillsOf(m);
      const g = levelUp(m);
      m.hp += g.hp; m.mp += g.mp;
      Sfx.play('lvup');
      renderBattleStatus();
      await say(`${m.name}は レベル ${m.lv}に あがった！\nHP+${g.hp}　MP+${g.mp}　攻撃+${g.atk}　守備+${g.def}　魔力+${g.mag}`, 0);
      await waitTap();
      for (const sk of skillsOf(m).filter(x => !before.includes(x))) {
        Sfx.play('magic');
        await say(`${m.name}は 「${SKILLS[sk].name}」を おぼえた！`, 0);
        await waitTap();
      }
    }
  }
  if (!B.boss && Math.random() < 0.2) {
    const id = G.chapterId === 'final' ? (Math.random() < 0.7 ? 'hipotion' : 'ether') : Math.random() < 0.75 ? 'potion' : 'ether';
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
  const t5 = G.areas.temple5 && G.areas.temple5.spots['<'];
  const rv = (G.flags.inTemple && t5 && { area: 'temple5', x: t5.x, y: t5.y - 1, name: '神殿の 最上階の 入り口' }) || (CHAPTERS[G.chapterId] || {}).revive || { area: 'world', x: INN_FRONT.x, y: INN_FRONT.y, name: 'ルミナの町の 宿屋' };
  G.area = rv.area || 'world';
  resetPositions(rv.x, rv.y);
  await endBattle('lose');
  await dialog(`……気がつくと ${rv.name || '宿屋'}の まえにいた。\n（所持金が はんぶんに なった）`, ['OK']);
  G.mode = 'field';
  finishBattle('lose');
}

async function endBattle(result, keepDark) {
  await fade(true, 350);
  $('#battle-view').hidden = true;
  $('#field-view').hidden = false;
  B = null;
  G.safeSteps = 5;
  for (const m of G.party) if (m.hp <= 0) m.hp = 0;
  resizeField();
  updateHud();
  if (!G.eventRunning) refreshMusic();
  if (!keepDark) await fade(false, 350);
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
    setTimeout(() => view.addEventListener('pointerdown', h), 250 / SPEED());
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
    const img = enemyImage(e);
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
    if (e.flip) c.scale(-1, 1); // 右（パーティ側）を向かせる
    if (e.data.last) { // ラスボスのオーラ
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + Math.sin(time / 300) * 0.1;
      const ag = c.createRadialGradient(0, -h / 2, 10, 0, -h / 2, h * 0.7); ag.addColorStop(0, '#c060ff'); ag.addColorStop(1, '#c060ff00');
      c.fillStyle = ag; c.beginPath(); c.arc(0, -h / 2, h * 0.7, 0, 7); c.fill(); c.restore();
    }
    if (e.gone && !e.fled) c.scale(1 + (1 - e.dying) * 0.3, Math.max(0.05, e.dying));
    c.imageSmoothingEnabled = false;
    c.drawImage(img, -w / 2, -h, w, h);
    c.restore();
  }
  if (sel) { // 対象カーソル
    for (const e of sel.cands) {
      const img = enemyImage(e); const h = img ? Math.min(img.height * e.k, 120) : 60;
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
    const [img, mirror] = partyPose(m, alive(m) ? a.pose : 0);
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
      const n = ci.faces.length;
      const x = n > 2 ? 8 + i * ((W - 56) / (n - 1)) : (i ? W - 58 - (1 - k) * 80 : 10 + (1 - k) * -80);
      const y = n > 2 ? cy - 24 + (i % 2 ? 6 : -6) : cy - 24;
      c.drawImage(img, x, y, 48, 48);
      c.strokeStyle = '#ffd75e'; c.lineWidth = 1.5; c.strokeRect(x, y, 48, 48);
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
    c.fillText('守り 残り' + B.guard, 6, 14);
  }
}

