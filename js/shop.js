// お店と装備
'use strict';

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
  if (shop.tab === 'buy') return [...SHOPS[shop.id].goods, ...((G.flags.final && SHOPS[shop.id].finalGoods) || [])].map(id => ({ id, price: goodsInfo(id).price }));
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

