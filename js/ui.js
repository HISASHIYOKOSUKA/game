// ダイアログ・メニュー
'use strict';

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
  $('#btn-music').textContent = '音楽：' + (Music.on ? 'ON' : 'OFF');
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

