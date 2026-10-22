// 入力・メインループ・起動
'use strict';

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
  $('#btn-sound').addEventListener('click', () => { Sfx.on = !Sfx.on; storageSet('es-sfx', Sfx.on ? '1' : '0'); renderMenu(); });
  $('#btn-music').addEventListener('click', () => { Music.setOn(!Music.on); storageSet('es-music', Music.on ? '1' : '0'); renderMenu(); });
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
  const dt = Math.min(50, ts - (field.lastTs || ts)) * SPEED();
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
  prepareMonsterImages();
  makeVariants();
  buildAllCharacters(images);
  if (storageGet('es-sfx') === '0') Sfx.on = false;
  if (storageGet('es-music') === '0') Music.on = false;
  setupInput();
  const hasSave = !!storageGet(SAVE_KEY);
  $('#btn-continue').hidden = !hasSave;
  $('#title-loading').hidden = true;
  $('#title-btns').hidden = false;
  // タイトル曲は最初のタップで流す（ブラウザの自動再生制限のため）
  const titleTap = () => { Sfx.init(); if (G.mode === 'title' && !$('#title').hidden) Music.play('opening'); };
  $('#title').addEventListener('pointerdown', titleTap);
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
  if (location.hash === '#debug') window.__debug = { G, startBattle, field, openShop, runEvent, joinParty, enterArea, spawnMob };
}

boot();
