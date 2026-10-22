// ストーリーのイベント進行
'use strict';

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
    }, 32 / SPEED());
    const h = ev => {
      ev.preventDefault();
      if (typing) { clearInterval(timer); el.textContent = text; typing = false; return; }
      overlay.removeEventListener('pointerdown', h);
      Sfx.play('cursor');
      res();
    };
    setTimeout(() => overlay.addEventListener('pointerdown', h), 150 / SPEED());
  });
}
async function talk(who, text, nameOverride) {
  const sp = SPEAKERS[who] || { name: nameOverride || who, face: images[who + '_face'] ? who + '_face' : null };
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
  if (!findBase(id).guest && m.lv < lead.lv - 1) setLevel(m, lead.lv - 1); // 旅のあいだに 腕を上げていた
  m.hp = m.mhp; m.mp = m.mmp;
  G.party.push(m);
  // その仲間の章で 持っていた お金と 持ち物を 合流させる
  const st = Object.entries(G.stash).find(([k, v]) => k !== G.chapterId && v.partyIds && v.partyIds[0] === id);
  if (st) {
    const v = st[1];
    G.gold += v.gold || 0;
    for (const k in v.items || {}) G.items[k] = (G.items[k] || 0) + v.items[k];
    for (const k in v.bag || {}) G.bag[k] = (G.bag[k] || 0) + v.bag[k];
    delete G.stash[st[0]];
  }
  const p = G.pos[G.pos.length - 1];
  G.pos.push({ x: p.x, y: p.y, fx: p.x, fy: p.y, dir: p.dir });
  updateHud();
  Sfx.play('lvup');
}

// 章の切りかえ：いまのパーティと持ち物を しまい、その章の主人公たちに かえる
function startChapter(id) {
  const ch = CHAPTERS[id];
  G.stash[G.chapterId] = { partyIds: G.party.filter(m => !findBase(m.id).guest).map(m => m.id), gold: G.gold, items: G.items, bag: G.bag };
  for (const m of G.party) if (findBase(m.id).guest) delete G.roster[m.id];
  G.chapterId = id;
  G.party = ch.party.map(([pid, lv]) => {
    if (!G.roster[pid]) { G.roster[pid] = makeMember(findBase(pid), lv); G.roster[pid].exp = expForLevel(lv); }
    const m = G.roster[pid];
    if (m.lv < lv) setLevel(m, lv);
    m.hp = m.mhp; m.mp = m.mmp;
    return m;
  });
  if (ch.useStash && G.stash[ch.useStash]) { // 最終章：レオンの章の お金と 持ち物を もどす
    const v = G.stash[ch.useStash];
    G.gold = v.gold + ch.gold; G.items = v.items; G.bag = v.bag;
    delete G.stash[ch.useStash];
  } else { G.gold = ch.gold; G.items = { ...ch.items }; G.bag = {}; }
  G.area = ch.start.area || 'world';
  G.mobsByArea = {};
  resetPositions(ch.start.x, ch.start.y);
  G.pos.forEach(p => p.dir = ch.start.dir);
  updateHud();
}

// ---------- 登場人物（イベント中だけ出てくるキャラ） ----------
function findActor(id) {
  if (id === 'party' || id === 'leader') return { party: true, p: G.pos[0] };
  const pi = G.party.findIndex(m => m.id === id);
  if (pi >= 0 && !G.actors.some(a => a.id === id && a.area === G.area)) return { party: true, p: G.pos[pi] };
  const a = G.actors.find(a => a.id === id && a.area === G.area);
  if (a) return { e: a };
  const n = (cur().npcs || []).find(n => n.id === id) || G.walkers.find(w => w.id === id);
  if (n) return { e: n };
  return null;
}
function spawnActor(s) {
  G.actors = G.actors.filter(a => !(a.id === s.id && a.area === (s.area || G.area)));
  G.actors.push({ id: s.id, sprite: s.sprite || s.id, monster: s.monster, big: s.big, x: s.x, y: s.y, fx: s.x, fy: s.y, t: 1, moving: false,
    dir: s.dir || 'down', area: s.area || G.area, path: [], speed: s.speed, scale: s.scale, alpha: s.alpha, ghost: s.ghost });
}
// 'LLUU' や 'L3U2' のような書き方を 方向の列にする
function parsePath(str) {
  const map = { U: 'up', D: 'down', L: 'left', R: 'right' };
  const out = [];
  const re = /([UDLR])(\d*)/g; let m;
  while ((m = re.exec(str))) for (let i = 0; i < (m[2] ? parseInt(m[2], 10) : 1); i++) out.push(map[m[1]]);
  return out;
}
function moveActor(id, path, speed) {
  const f = findActor(id);
  if (!f) return Promise.resolve();
  const dirs = parsePath(path);
  if (f.party) {
    return new Promise(res => { G.ppath = dirs; G.ppathDone = res; });
  }
  const e = f.e;
  if (e.fx === undefined) { e.fx = e.x; e.fy = e.y; e.t = 1; }
  if (speed) e.speed = speed;
  return new Promise(res => { e.path = dirs; e.onDone = res; if (!e.moving && e.path.length) startStep(e, e.path.shift()); else if (!dirs.length) res(); });
}

// ---------- エンドロール ----------
function startCredits(lines, ms) {
  const box = $('#credits');
  box.innerHTML = '<div class="credits-inner">' + lines.map(l => l.startsWith('#') ? `<h3>${l.slice(1)}</h3>` : l ? `<p>${l}</p>` : '<p>&nbsp;</p>').join('') + '</div>';
  box.hidden = false;
  const inner = box.firstChild;
  inner.style.transition = 'none';
  inner.style.transform = 'translateY(100%)';
  void inner.offsetWidth;
  inner.style.transition = `transform ${ms}ms linear`;
  inner.style.transform = `translateY(-${inner.scrollHeight + 40}px)`;
  G.creditsEnd = performance.now() + ms;
}

// クリア後：おわり → タイトルへ
function theEnd() {
  G.flags.cleared = true;
  G.confetti = false;
  saveGame();
  $('#credits').hidden = true;
  const box = $('#theend');
  box.hidden = false;
  Music.play('ending');
  return new Promise(res => {
    $('#btn-end').onclick = () => {
      Sfx.play('ok');
      box.hidden = true;
      $('#field-view').hidden = true;
      G.mode = 'title';
      G.keepFade = false;
      $('#btn-continue').hidden = !storageGet(SAVE_KEY);
      $('#title').hidden = false;
      Music.play('opening');
      res('abort');
    };
  });
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
    if ($('#fade').classList.contains('on') && !G.keepFade) await fade(false);
    G.eventRunning = false;
    G.cam = null; G.hideParty = false; G.hideFollowers = false; G.ppath = null;
    G.actors = G.actors.filter(a => a.persist);
    if (G.mode !== 'title') { G.mode = 'field'; updateHud(); refreshMusic(); }
  }
}

async function doStep(s) {
  switch (s.t) {
    case 'say': return talk(s.who, s.text);
    case 'narr': return narrate(s);
    case 'chapter': return chapterCard(s);
    case 'fadeOut': return fade(true, s.ms || 500);
    case 'fadeIn':
      if (!$('#fade').classList.contains('on')) await fade(true, 1);
      $('#title').hidden = true;
      hideStoryOverlays();
      $('#field-view').hidden = false;
      resizeField();
      updateHud();
      if (!s.keepMusic) refreshMusic();
      return fade(false, s.ms || 600);
    case 'flash': { const fl = $('#flash'); fl.classList.add('on'); await sleep(90); fl.classList.remove('on'); return sleep(150); }
    case 'sfx': Sfx.play(s.name); return;
    case 'music': G.musicOverride = s.name || null; if (s.name) Music.play(s.name); else refreshMusic(); return;
    case 'stopMusic': Music.stop(); return;
    case 'wait': return sleep(s.ms);
    case 'flag': G.flags[s.name] = true; return;
    case 'unflag': delete G.flags[s.name]; return;
    case 'objective': return setObjective(s.text);
    case 'warp': G.area = s.area || 'world'; resetPositions(s.x, s.y); G.pos.forEach(p => p.dir = s.dir || 'down'); G.cam = null; updateHud(); return;
    case 'join': return joinParty(s.id);
    case 'resonance': if (!G.reso.includes(s.id)) G.reso.push(s.id); return;
    case 'heal': G.party.forEach(m => { if (alive(m) || s.revive) { m.hp = Math.max(m.hp, Math.ceil(m.mhp * (s.ratio || 1))); m.mp = Math.max(m.mp, Math.ceil(m.mmp * (s.ratio || 1))); } }); updateHud(); return;
    case 'healAll': G.party.forEach(m => { m.hp = m.mhp; m.mp = m.mmp; }); updateHud(); return;
    case 'save': saveGame(); return;
    case 'give': {
      if (s.gold) G.gold += s.gold;
      if (s.item) { if (ITEMS[s.item]) G.items[s.item] = (G.items[s.item] || 0) + (s.n || 1); else G.bag[s.item] = (G.bag[s.item] || 0) + 1; }
      updateHud(); return;
    }
    case 'leave': {
      const i = G.party.findIndex(m => m.id === s.id);
      if (i > 0) { G.party.splice(i, 1); G.pos.splice(i, 1); }
      if (findBase(s.id).guest) delete G.roster[s.id];
      updateHud();
      return;
    }
    case 'chapterStart': return startChapter(s.id);
    case 'battle': {
      const r = await startBattle(s.enemies, { boss: s.boss, hpMul: s.hpMul, last: s.last, bg: s.bg, noHeal: s.noHeal, phase: s.phase });
      return r === 'win' ? undefined : 'abort';
    }
    // 登場人物
    case 'actor': spawnActor(s); return;
    case 'remove': G.actors = G.actors.filter(a => !(a.id === s.id && a.area === G.area)); return;
    case 'hide': { const f = findActor(s.id); if (f && f.e) f.e.hidden = true; G.actorsHide = G.actorsHide || {}; G.actorsHide[s.id] = true; return; }
    case 'show': { const f = findActor(s.id); if (f && f.e) f.e.hidden = false; if (G.actorsHide) delete G.actorsHide[s.id]; return; }
    case 'move': { const p = moveActor(s.id, s.path, s.speed); if (s.nowait) return; return p; }
    case 'face': { const f = findActor(s.id); if (f) (f.p || f.e).dir = s.dir; return; }
    case 'emote': { const f = findActor(s.id); if (f) { const e = f.p || f.e; e.emote = s.e; e.emoteT = s.ms || 900; } if (s.e === '!') Sfx.play('cursor'); return sleep(s.wait === undefined ? 500 : s.wait); }
    case 'jump': { const f = findActor(s.id); if (f) (f.p || f.e).jumpT = 300; Sfx.play('step'); return sleep(320); }
    case 'camera': if (s.follow) G.cam = null; else G.cam = Object.assign(G.cam || {}, { x: s.x, y: s.y }); return s.wait ? sleep(s.wait) : undefined;
    case 'hideParty': G.hideParty = s.on !== false; return;
    case 'followers': G.hideFollowers = s.on === false; return;
    case 'shake': G.fieldShake = s.power || 6; Sfx.play('thunder'); return;
    case 'confetti': G.confetti = s.on !== false; G.fparts = G.fparts || []; return;
    case 'tint': G.screenTint = s.color || null; return;
    case 'credits': startCredits(s.lines, s.ms); return;
    case 'waitCredits': return sleep(Math.max(0, G.creditsEnd - performance.now()));
    case 'setLevel': { const m = G.roster[s.id]; if (m && m.lv < s.lv) setLevel(m, s.lv); return; }
    case 'clearMobs': G.mobsByArea[s.area || G.area] = []; return;
    case 'theEnd': return theEnd();
  }
}
