// オリジナルキャラクターのドット絵を描くジェネレーター
// 1 キャラにつき：正面・背面・横（左向き）の立ち絵と歩きコマ、戦闘ポーズ 4 枚、顔グラ
'use strict';

const SOUT = '#2c2433';
function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

// 体格ごとの寸法
function bodyDims(P) {
  const b = P.build || 'normal';
  const d = { hy: 24, hr: 14, hry: 13, tw: 18, ty0: 38, ty1: 60, lw: 7, ly1: 80, aw: 6 };
  if (b === 'fat') Object.assign(d, { tw: 28, aw: 7, lw: 8 });
  if (b === 'big') Object.assign(d, { tw: 24, aw: 8, lw: 9, hy: 22, hr: 13, ty0: 36 });
  if (b === 'slim') Object.assign(d, { tw: 15, aw: 5, lw: 6 });
  if (b === 'small') Object.assign(d, { hy: 36, hr: 13, hry: 12, tw: 15, ty0: 49, ty1: 66, lw: 6, aw: 5 });
  if (P.old) d.hy += 1;
  return d;
}

function pathFill(c, fill, fn, stroke = true) {
  c.beginPath(); fn(); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = 1.3; c.strokeStyle = SOUT; c.stroke(); }
}
function rr(c, x, y, w, h, r) {
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// ---------- 部品 ----------
function drawCape(c, P, d, view) {
  if (!P.cape) return;
  const cx = 24, y0 = d.ty0 + 1, y1 = Math.min(82, d.ly1 - 4);
  const w0 = d.tw + 4, w1 = d.tw + 14;
  if (view === 'side') {
    pathFill(c, shadeHex(P.cape, -0.15), () => { c.moveTo(cx - 2, y0); c.lineTo(cx + w0 / 2 + 2, y0 + 2); c.lineTo(cx + w1 / 2 + 4, y1); c.lineTo(cx + 2, y1 - 2); c.closePath(); });
  } else {
    pathFill(c, view === 'back' ? P.cape : shadeHex(P.cape, -0.25), () => { c.moveTo(cx - w0 / 2, y0); c.lineTo(cx + w0 / 2, y0); c.lineTo(cx + w1 / 2, y1); c.quadraticCurveTo(cx, y1 + 3, cx - w1 / 2, y1); c.closePath(); });
  }
}

function drawLegs(c, P, d, view, step) {
  const long = P.outfit === 'robe' || P.outfit === 'dress';
  const boot = P.boots || shadeHex(P.bottom || '#5a4a3a', -0.35);
  const pant = P.bottom || '#5a4a3a';
  if (view === 'side') {
    const sw = step ? 5 : 1;
    for (const [i, off] of [[0, -sw], [1, sw]]) {
      const x = 24 - d.lw / 2 + off;
      const col = i ? pant : shadeHex(pant, -0.15);
      if (!long) pathFill(c, col, () => rr(c, x, d.ty1 - 2, d.lw, d.ly1 - d.ty1 - 2, 2));
      pathFill(c, i ? boot : shadeHex(boot, -0.15), () => rr(c, x - 2, d.ly1 - 6, d.lw + 3, 6, 2));
    }
  } else {
    const lift = step ? 2 : 0;
    for (const s of [-1, 1]) {
      const x = 24 + s * (d.tw / 4 + 0.5) - d.lw / 2;
      const up = s === -1 ? lift : 0;
      if (!long) pathFill(c, s > 0 ? shadeHex(pant, -0.12) : pant, () => rr(c, x, d.ty1 - 2, d.lw, d.ly1 - d.ty1 - 2 - up, 2));
      pathFill(c, boot, () => rr(c, x - 1, d.ly1 - 6 - up, d.lw + 2, 6, 2));
    }
  }
}

function drawTorso(c, P, d, view) {
  const top = P.top || '#4a78c8';
  const o = P.outfit || 'tunic';
  const cx = 24;
  const tw = view === 'side' ? Math.round(d.tw * 0.72) : d.tw;
  const x0 = cx - tw / 2;
  if (o === 'robe' || o === 'dress') {
    const hem = d.ly1 - (o === 'dress' ? 6 : 4);
    const flare = o === 'dress' ? 10 : 6;
    pathFill(c, top, () => { c.moveTo(x0 + 1, d.ty0); c.lineTo(x0 + tw - 1, d.ty0); c.lineTo(x0 + tw + flare / 2, hem); c.quadraticCurveTo(cx, hem + 3, x0 - flare / 2, hem); c.closePath(); });
    c.fillStyle = shadeHex(top, -0.18); c.fillRect(cx + (view === 'side' ? -1 : tw / 4), d.ty0 + 4, 3, hem - d.ty0 - 6);
    if (P.accent) { c.fillStyle = P.accent; c.fillRect(x0 - flare / 2 + 2, hem - 4, tw + flare - 4, 2); if (view !== 'back') c.fillRect(cx - 1, d.ty0 + 2, 2, hem - d.ty0 - 6); }
  } else {
    pathFill(c, top, () => rr(c, x0, d.ty0, tw, d.ty1 - d.ty0 + 1, P.build === 'fat' ? 9 : 4));
    c.fillStyle = shadeHex(top, -0.2); c.fillRect(x0 + tw - 4, d.ty0 + 2, 3, d.ty1 - d.ty0 - 3);
    if (o === 'armor') {
      c.fillStyle = shadeHex(top, 0.35); c.fillRect(x0 + 2, d.ty0 + 3, tw - 4, 2);
      c.fillStyle = shadeHex(top, -0.3); c.fillRect(cx - 0.5, d.ty0 + 3, 1, d.ty1 - d.ty0 - 6);
      if (view !== 'side') { pathFill(c, shadeHex(top, 0.15), () => { c.arc(x0 + 1, d.ty0 + 3, 4.5, 0, 7); }); pathFill(c, shadeHex(top, 0.15), () => { c.arc(x0 + tw - 1, d.ty0 + 3, 4.5, 0, 7); }); }
    }
    if (o === 'apron' && view !== 'back') { pathFill(c, P.accent || '#f8f4ec', () => rr(c, cx - tw / 2 + 3, d.ty0 + 6, tw - 6, d.ty1 - d.ty0 + 4, 2)); }
    if (o === 'suit' && view !== 'back') { c.fillStyle = '#f8f4ec'; c.beginPath(); c.moveTo(cx - 3, d.ty0); c.lineTo(cx + 3, d.ty0); c.lineTo(cx, d.ty0 + 8); c.fill(); c.fillStyle = P.accent || '#c83838'; c.fillRect(cx - 1, d.ty0 + 2, 2, 6); }
    if (o === 'rags') { c.fillStyle = shadeHex(top, -0.3); for (let i = 0; i < 4; i++) c.fillRect(x0 + 2 + i * (tw / 4), d.ty1 - 3, 3, 4); }
    if (o === 'coat') { c.fillStyle = shadeHex(top, -0.3); c.fillRect(cx - 0.5, d.ty0, 1, d.ty1 - d.ty0); pathFill(c, top, () => rr(c, x0 - 1, d.ty1 - 4, tw + 2, 10, 2)); }
    if (P.belt !== false && o !== 'apron') { c.fillStyle = P.belt || '#5a3a20'; c.fillRect(x0 + 1, d.ty1 - 8, tw - 2, 3); if (view !== 'back') { c.fillStyle = '#e8c048'; c.fillRect(cx - 2, d.ty1 - 8, 4, 3); } }
  }
  // えり
  if (view !== 'back' && P.collar) { c.fillStyle = P.collar; c.fillRect(cx - 5, d.ty0, 10, 3); }
}

function drawArm(c, P, d, x, y, len, angle, front) {
  const col = front ? (P.sleeve || P.top || '#4a78c8') : shadeHex(P.sleeve || P.top || '#4a78c8', -0.18);
  c.save(); c.translate(x, y); c.rotate(angle);
  pathFill(c, col, () => rr(c, -d.aw / 2, 0, d.aw, len, 3));
  pathFill(c, P.skin, () => c.arc(0, len + 1, d.aw / 2 + 0.5, 0, 7));
  c.restore();
}

function drawWeapon(c, P, x, y, angle, scale = 1) {
  if (!P.weapon) return;
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  const w = P.weapon;
  const line = (x0, y0, x1, y1, wdt, col) => { c.lineCap = 'round'; c.strokeStyle = SOUT; c.lineWidth = wdt + 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = col; c.lineWidth = wdt; c.stroke(); };
  if (w === 'sword') { line(0, 4, 0, -22, 3, '#e8eef8'); line(-5, 2, 5, 2, 2.5, '#e8c048'); line(0, 3, 0, 9, 2.5, '#7a4a28'); }
  else if (w === 'dagger') { line(0, 2, 0, -10, 2.5, '#d8dee8'); line(-3, 2, 3, 2, 2, '#c8a040'); line(0, 3, 0, 7, 2, '#5a3a20'); }
  else if (w === 'axe') { line(0, 10, 0, -20, 3, '#8a5a30'); pathFill(c, '#c8ccd8', () => { c.moveTo(1, -20); c.quadraticCurveTo(14, -16, 12, -6); c.lineTo(1, -10); c.closePath(); }); }
  else if (w === 'hammer') { line(0, 10, 0, -18, 3, '#8a5a30'); pathFill(c, '#9aa0b0', () => rr(c, -8, -26, 16, 9, 2)); }
  else if (w === 'spear') { line(0, 14, 0, -28, 2.5, '#8a5a30'); pathFill(c, '#e8eef8', () => { c.moveTo(0, -36); c.lineTo(3, -28); c.lineTo(-3, -28); c.closePath(); }); }
  else if (w === 'staff') { line(0, 14, 0, -26, 2.5, '#9a6a3a'); pathFill(c, P.gem || '#7fd8ff', () => c.arc(0, -28, 3.5, 0, 7)); }
  else if (w === 'book') { pathFill(c, P.accent || '#8a3a3a', () => rr(c, -6, -5, 12, 10, 1)); c.fillStyle = '#f4ecd8'; c.fillRect(-5, -4, 1, 8); }
  else if (w === 'bag') { pathFill(c, '#e8c048', () => { c.ellipse(0, 2, 6, 7, 0, 0, 7); }); c.fillStyle = '#8a6a20'; c.font = 'bold 7px sans-serif'; c.fillText('G', -2.5, 5); }
  else if (w === 'pan') { line(0, 8, 0, -4, 2.5, '#5a4a4a'); pathFill(c, '#7a7a8a', () => c.ellipse(0, -9, 7, 5, 0, 0, 7)); }
  c.restore();
}

function drawHairBack(c, P, d, view) {
  const s = P.hairStyle || 'short';
  if (P.hat === 'hood' || P.hat === 'helmet' || s === 'bald') return;
  const hx = view === 'side' ? 25 : 24, hy = d.hy;
  const col = shadeHex(P.hair, -0.12);
  if (s === 'long' || s === 'wild') {
    pathFill(c, col, () => { c.moveTo(hx - d.hr - 1, hy); c.quadraticCurveTo(hx - d.hr - 3, hy + 22, hx - d.hr + 3, hy + 26); c.lineTo(hx + d.hr - 3, hy + 26); c.quadraticCurveTo(hx + d.hr + 3, hy + 22, hx + d.hr + 1, hy); c.closePath(); });
  } else if (s === 'ponytail' && view !== 'front') {
    pathFill(c, col, () => { c.moveTo(hx + (view === 'side' ? 8 : -3), hy - 4); c.quadraticCurveTo(hx + (view === 'side' ? 22 : 6), hy + 4, hx + (view === 'side' ? 14 : 2), hy + 22); c.lineTo(hx + (view === 'side' ? 9 : -2), hy + 6); c.closePath(); });
  } else if (s === 'twin' && view !== 'side') {
    for (const sx of [-1, 1]) pathFill(c, col, () => { c.ellipse(hx + sx * (d.hr + 2), hy + 8, 4.5, 10, sx * 0.25, 0, 7); });
  } else if (s === 'twin') {
    pathFill(c, col, () => { c.ellipse(hx + d.hr - 2, hy + 8, 4.5, 10, 0.3, 0, 7); });
  } else if (s === 'bob') {
    pathFill(c, col, () => rr(c, hx - d.hr - 1, hy - 4, d.hr * 2 + 2, d.hry + 10, 6));
  }
}

function drawHead(c, P, d, view) {
  const hx = view === 'side' ? 23 : 24, hy = d.hy;
  // 首
  c.fillStyle = shadeHex(P.skin, -0.15); c.fillRect(hx - 3, hy + d.hry - 3, 6, 6);
  // 顔
  pathFill(c, P.skin, () => c.ellipse(hx, hy, d.hr, d.hry, 0, 0, 7));
  if (view === 'side') pathFill(c, P.skin, () => c.arc(hx - d.hr + 1, hy + 4, 2, 0, 7)); // 鼻
  if (view !== 'back') { // 耳
    if (view === 'side') pathFill(c, P.skin, () => c.ellipse(hx + 4, hy + 1, 2.5, 3.5, 0, 0, 7));
  }
  // 顔のパーツ
  if (view !== 'back' && P.hat !== 'mask') {
    const eyeY = hy + 3;
    const eyes = view === 'side' ? [hx - 7] : [hx - 6, hx + 6];
    for (const ex of eyes) {
      if (P.old && !P.openEyes) { c.strokeStyle = SOUT; c.lineWidth = 1.3; c.beginPath(); c.arc(ex, eyeY + 1, 2.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); continue; }
      c.fillStyle = SOUT; c.beginPath(); c.ellipse(ex, eyeY, 2.4, 3.4, 0, 0, 7); c.fill();
      c.fillStyle = P.eyes || '#3a5ab0'; c.beginPath(); c.ellipse(ex, eyeY + 0.8, 1.6, 2.2, 0, 0, 7); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(ex - 1.5, eyeY - 2, 1.5, 1.5);
      if (P.female) { c.strokeStyle = SOUT; c.lineWidth = 1; c.beginPath(); c.moveTo(ex - 3, eyeY - 3); c.lineTo(ex + 2.5, eyeY - 3.8); c.stroke(); }
    }
    if (P.angry) { c.strokeStyle = SOUT; c.lineWidth = 1.4; for (const ex of eyes) { c.beginPath(); c.moveTo(ex - 3, eyeY - 6 + (ex < hx ? 0 : 2)); c.lineTo(ex + 3, eyeY - 6 + (ex < hx ? 2 : 0)); c.stroke(); } }
    // 口
    c.strokeStyle = shadeHex(P.skin, -0.5); c.lineWidth = 1.2; c.beginPath();
    const mx = view === 'side' ? hx - 8 : hx;
    if (P.smile) c.arc(mx, hy + 8, 2.2, 0.2, Math.PI - 0.2); else { c.moveTo(mx - 1.5, hy + 9); c.lineTo(mx + 1.5, hy + 9); }
    c.stroke();
    // ほお
    if (P.female || P.build === 'small') { c.fillStyle = '#ff8a8a55'; for (const ex of eyes) c.fillRect(ex - 2, hy + 6, 4, 2); }
    if (P.glasses) { c.strokeStyle = '#3a3a4a'; c.lineWidth = 1; for (const ex of eyes) { c.beginPath(); c.arc(ex, eyeY + 0.5, 3.6, 0, 7); c.stroke(); } if (eyes.length > 1) { c.beginPath(); c.moveTo(hx - 2.4, eyeY); c.lineTo(hx + 2.4, eyeY); c.stroke(); } }
    if (P.old) { c.strokeStyle = shadeHex(P.skin, -0.3); c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx - 9, hy + 6); c.lineTo(hx - 7, hy + 7); c.moveTo(hx + 7, hy + 7); c.lineTo(hx + 9, hy + 6); c.stroke(); }
    // ひげ
    if (P.beard) {
      const bc = P.beardColor || P.hair;
      if (P.beard === 'full') pathFill(c, bc, () => { c.moveTo(hx - d.hr + 2, hy + 3); c.quadraticCurveTo(hx - d.hr + 2, hy + d.hry + 8, hx + (view === 'side' ? -4 : 0), hy + d.hry + 9); c.quadraticCurveTo(hx + d.hr - 2, hy + d.hry + 8, hx + d.hr - 2, hy + 3); c.quadraticCurveTo(hx, hy + 12, hx - d.hr + 2, hy + 3); });
      if (P.beard === 'mustache' || P.beard === 'full') pathFill(c, bc, () => { c.ellipse(mx - 3, hy + 7.5, 3.5, 1.6, 0.2, 0, 7); c.ellipse(mx + 3, hy + 7.5, 3.5, 1.6, -0.2, 0, 7); });
      if (P.beard === 'goatee') pathFill(c, bc, () => c.ellipse(mx, hy + 12, 2.5, 3, 0, 0, 7));
    }
  }
}

function drawHairFront(c, P, d, view) {
  const s = P.hairStyle || 'short';
  const hx = view === 'side' ? 23 : 24, hy = d.hy;
  const col = P.hair, hi = shadeHex(P.hair, 0.25);
  if (P.hat === 'hood' || P.hat === 'mask') {
    const hc = P.hatColor || '#5a2a6a';
    pathFill(c, hc, () => { c.ellipse(hx + (view === 'side' ? 2 : 0), hy - 1, d.hr + 3, d.hry + 3, 0, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(hx + d.hr + 4, hy + d.hry); c.lineTo(hx - d.hr - 3 + (view === 'side' ? 8 : 0), hy + d.hry); c.closePath(); });
    if (view === 'back') pathFill(c, hc, () => c.ellipse(hx, hy, d.hr + 3, d.hry + 3, 0, 0, 7));
    else { c.fillStyle = shadeHex(hc, -0.4); c.beginPath(); c.ellipse(hx - (view === 'side' ? 3 : 0), hy + 1, d.hr - 1, d.hry - 2, 0, Math.PI, Math.PI * 2); c.fill(); }
    if (P.hat === 'mask' && view !== 'back') { pathFill(c, P.maskColor || '#e8e0d0', () => rr(c, hx - 9 - (view === 'side' ? 3 : 0), hy - 2, view === 'side' ? 10 : 18, 12, 3)); c.fillStyle = SOUT; const ex = view === 'side' ? [hx - 7] : [hx - 5, hx + 5]; for (const e of ex) c.fillRect(e - 2, hy + 2, 4, 2); }
    return;
  }
  if (view === 'back') {
    if (s !== 'bald') {
      pathFill(c, col, () => { c.ellipse(hx, hy - 1, d.hr + 1, d.hry + 1, 0, 0, 7); });
      c.strokeStyle = shadeHex(col, -0.25); c.lineWidth = 1;
      for (const dx of [-7, -2, 3, 8]) { c.beginPath(); c.moveTo(hx + dx * 0.6, hy - d.hry + 4); c.quadraticCurveTo(hx + dx, hy, hx + dx * 0.9, hy + d.hry - 1); c.stroke(); }
      c.strokeStyle = hi; c.lineWidth = 1.5; c.beginPath(); c.arc(hx - 2, hy - 4, d.hr - 5, Math.PI * 1.15, Math.PI * 1.55); c.stroke();
    } else {
      c.fillStyle = shadeHex(P.skin, 0.2); c.fillRect(hx - 4, hy - d.hry + 3, 6, 2);
    }
    if (s === 'bun') pathFill(c, col, () => c.arc(hx, hy - d.hry - 1, 5, 0, 7));
  } else if (s === 'bald') {
    c.fillStyle = shadeHex(P.skin, 0.25); c.fillRect(hx - 5, hy - d.hry + 3, 6, 2);
    if (P.old) { pathFill(c, col, () => { c.ellipse(hx - d.hr + 1, hy, 3, 5, 0, 0, 7); }); if (view !== 'side') pathFill(c, col, () => c.ellipse(hx + d.hr - 1, hy, 3, 5, 0, 0, 7)); }
  } else {
    // 頭頂部
    pathFill(c, col, () => { c.ellipse(hx + (view === 'side' ? 2 : 0), hy - 2, d.hr + 1, d.hry, 0, Math.PI * 0.98, Math.PI * 2.02); c.closePath(); });
    // 前髪
    c.beginPath();
    const fy = hy - 3;
    if (view === 'side') {
      c.moveTo(hx + d.hr + 1, hy - 2); c.lineTo(hx + d.hr - 1, hy + 6); c.lineTo(hx + 4, fy); c.lineTo(hx - 2, fy + 3); c.lineTo(hx - 6, fy - 1); c.lineTo(hx - d.hr - 1, fy + 1); c.lineTo(hx - d.hr + 1, hy - 8);
    } else if (s === 'spiky' || s === 'wild') {
      c.moveTo(hx - d.hr - 1, hy + 2);
      for (let i = 0; i <= 6; i++) { const x = hx - d.hr + i * (d.hr * 2 / 6); c.lineTo(x, i % 2 ? fy + 4 : fy - 2); }
      c.lineTo(hx + d.hr + 1, hy + 2); c.lineTo(hx + d.hr, hy - 8); c.lineTo(hx - d.hr, hy - 8);
    } else if (s === 'slick') {
      c.moveTo(hx - d.hr - 1, hy); c.quadraticCurveTo(hx - 4, fy - 6, hx + d.hr + 1, hy - 2); c.lineTo(hx + d.hr, hy - 8); c.lineTo(hx - d.hr, hy - 8);
    } else {
      c.moveTo(hx - d.hr - 1, hy + (s === 'long' || s === 'bob' || s === 'twin' ? 8 : 2));
      c.lineTo(hx - d.hr + 3, fy); c.lineTo(hx - 4, fy + 3); c.lineTo(hx, fy - 1); c.lineTo(hx + 4, fy + 3); c.lineTo(hx + d.hr - 3, fy);
      c.lineTo(hx + d.hr + 1, hy + (s === 'long' || s === 'bob' || s === 'twin' ? 8 : 2)); c.lineTo(hx + d.hr, hy - 8); c.lineTo(hx - d.hr, hy - 8);
    }
    c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 1.3; c.strokeStyle = SOUT; c.stroke();
    c.fillStyle = hi; c.fillRect(hx - 6, hy - d.hry + 3, 7, 2);
    if (s === 'bun') pathFill(c, col, () => c.arc(hx + (view === 'side' ? 6 : 0), hy - d.hry - 1, 5, 0, 7));
    if (s === 'ponytail' && view === 'front') pathFill(c, P.ribbon || '#e84858', () => c.arc(hx + d.hr - 2, hy - 8, 2.5, 0, 7));
    if (s === 'twin' && view === 'front') for (const sx of [-1, 1]) pathFill(c, P.ribbon || '#e84858', () => c.arc(hx + sx * (d.hr - 1), hy - 4, 2.5, 0, 7));
  }
  // 帽子など
  const hc = P.hatColor || '#c83838';
  if (P.hat === 'crown') {
    pathFill(c, '#f0c838', () => { c.moveTo(hx - 9, hy - d.hry + 2); c.lineTo(hx - 9, hy - d.hry - 6); c.lineTo(hx - 5, hy - d.hry - 2); c.lineTo(hx, hy - d.hry - 8); c.lineTo(hx + 5, hy - d.hry - 2); c.lineTo(hx + 9, hy - d.hry - 6); c.lineTo(hx + 9, hy - d.hry + 2); c.closePath(); });
    c.fillStyle = '#e84858'; c.fillRect(hx - 1.5, hy - d.hry - 3, 3, 3);
  } else if (P.hat === 'helmet') {
    pathFill(c, hc, () => { c.ellipse(hx, hy - 2, d.hr + 2, d.hry + 1, 0, Math.PI, Math.PI * 2); c.lineTo(hx + d.hr + 2, hy + 2); c.lineTo(hx - d.hr - 2, hy + 2); c.closePath(); });
    c.fillStyle = shadeHex(hc, 0.35); c.fillRect(hx - 6, hy - d.hry + 1, 6, 2);
    if (view !== 'back') { c.fillStyle = shadeHex(hc, -0.35); c.fillRect(hx - d.hr - 1, hy, d.hr * 2 + 2, 2); }
  } else if (P.hat === 'witch') {
    pathFill(c, hc, () => { c.ellipse(hx, hy - d.hry + 3, d.hr + 7, 4, 0, 0, 7); });
    pathFill(c, hc, () => { c.moveTo(hx - 9, hy - d.hry + 2); c.lineTo(hx + 4, hy - d.hry - 18); c.lineTo(hx + 9, hy - d.hry + 2); c.closePath(); });
    c.fillStyle = P.accent || '#e8c048'; c.fillRect(hx - 8, hy - d.hry - 1, 16, 2);
  } else if (P.hat === 'cap') {
    pathFill(c, hc, () => { c.ellipse(hx, hy - 4, d.hr + 1, d.hry - 3, 0, Math.PI, Math.PI * 2); c.closePath(); });
    if (view !== 'back') pathFill(c, shadeHex(hc, -0.2), () => c.ellipse(hx - (view === 'side' ? 8 : 0), hy - 4, view === 'side' ? 8 : 12, 2.5, 0, 0, 7));
  } else if (P.hat === 'bandana') {
    pathFill(c, hc, () => { c.ellipse(hx, hy - 3, d.hr + 1, d.hry - 2, 0, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(hx + d.hr + 1, hy - 1); c.lineTo(hx - d.hr - 1, hy - 1); c.closePath(); });
    c.fillStyle = '#ffffff99'; for (let i = -8; i <= 8; i += 6) c.fillRect(hx + i, hy - 7, 2, 2);
  } else if (P.hat === 'chef') {
    pathFill(c, '#ffffff', () => { c.ellipse(hx, hy - d.hry - 4, 10, 7, 0, 0, 7); });
    pathFill(c, '#ffffff', () => rr(c, hx - 9, hy - d.hry - 2, 18, 6, 1));
  }
}

// ---------- 全身 ----------
function drawBody(c, P, view, frame) {
  const d = bodyDims(P);
  const step = frame === 1;
  const bob = step ? -1 : 0;
  c.save(); c.translate(0, bob);
  if (view === 'front') {
    drawCape(c, P, d, 'front');
    drawHairBack(c, P, d, 'front');
    drawLegs(c, P, d, 'front', step);
    const sw = step ? 0.15 : 0;
    drawArm(c, P, d, 24 - d.tw / 2 - d.aw / 2 + 2, d.ty0 + 2, d.ty1 - d.ty0 - 4, 0.12 + sw, false);
    drawArm(c, P, d, 24 + d.tw / 2 + d.aw / 2 - 2, d.ty0 + 2, d.ty1 - d.ty0 - 4, -0.12 - sw, false);
    drawTorso(c, P, d, 'front');
    if (P.weapon && P.weapon !== 'bag' && P.weapon !== 'book') drawWeapon(c, P, 24 + d.tw / 2 + 4, d.ty1 - 2, 0, 0.9);
    else if (P.weapon) drawWeapon(c, P, 24 - d.tw / 2 - 4, d.ty1 - 2, 0, 0.9);
    drawHead(c, P, d, 'front');
    drawHairFront(c, P, d, 'front');
  } else if (view === 'back') {
    drawHairBack(c, P, d, 'back');
    drawLegs(c, P, d, 'back', step);
    drawArm(c, P, d, 24 - d.tw / 2 - d.aw / 2 + 2, d.ty0 + 2, d.ty1 - d.ty0 - 4, 0.12, true);
    drawArm(c, P, d, 24 + d.tw / 2 + d.aw / 2 - 2, d.ty0 + 2, d.ty1 - d.ty0 - 4, -0.12, true);
    drawTorso(c, P, d, 'back');
    if (P.weapon && P.weapon !== 'bag' && P.weapon !== 'book') drawWeapon(c, P, 24 - d.tw / 2 - 4, d.ty1 - 2, 0, 0.9);
    drawHead(c, P, d, 'back');
    drawHairFront(c, P, d, 'back');
    drawCape(c, P, d, 'back');
  } else { // side（左向き）
    drawCape(c, P, d, 'side');
    drawHairBack(c, P, d, 'side');
    const swing = step ? 0.5 : 0.1;
    drawArm(c, P, d, 26, d.ty0 + 2, d.ty1 - d.ty0 - 4, -swing, false);
    drawLegs(c, P, d, 'side', step);
    drawTorso(c, P, d, 'side');
    drawArm(c, P, d, 23, d.ty0 + 2, d.ty1 - d.ty0 - 4, swing, true);
    if (P.weapon) drawWeapon(c, P, 23 - Math.sin(swing) * 14, d.ty1 - 2, 0, 0.9);
    drawHead(c, P, d, 'side');
    drawHairFront(c, P, d, 'side');
  }
  c.restore();
}

// 戦闘ポーズ（左向き）。pose 0=待機 1=詠唱 2=攻撃 3=勝利
function drawBattle(c, P, pose) {
  const d = bodyDims(P);
  drawCape(c, P, d, 'side');
  drawHairBack(c, P, d, 'side');
  const lunge = pose === 2;
  if (lunge) c.translate(-3, 2);
  drawArm(c, P, d, 26, d.ty0 + 2, d.ty1 - d.ty0 - 4, -0.4, false);
  drawLegs(c, P, d, 'side', lunge || pose === 0);
  drawTorso(c, P, d, 'side');
  const ay = d.ty0 + 2, alen = d.ty1 - d.ty0 - 4;
  if (pose === 0) { drawArm(c, P, d, 22, ay, alen, 0.9, true); drawWeapon(c, P, 22 - Math.sin(0.9) * alen, ay + Math.cos(0.9) * alen, -0.5, 0.95); }
  if (pose === 1) {
    drawArm(c, P, d, 22, ay, alen, 2.3, true);
    const hx = 22 - Math.sin(2.3) * alen, hy = ay + Math.cos(2.3) * alen;
    drawWeapon(c, P, hx, hy, -0.2, 0.95);
    c.fillStyle = (P.gem || '#9fe0ff') + '88'; c.beginPath(); c.arc(hx - 2, hy - 8, 6, 0, 7); c.fill();
  }
  if (pose === 2) { drawArm(c, P, d, 22, ay, alen, 1.6, true); drawWeapon(c, P, 22 - alen, ay + 2, -1.45, 1); }
  if (pose === 3) { drawArm(c, P, d, 22, ay, alen, 2.9, true); drawWeapon(c, P, 22 - Math.sin(2.9) * alen, ay + Math.cos(2.9) * alen, 0, 0.95); }
  drawHead(c, P, d, 'side');
  drawHairFront(c, P, d, 'side');
}

function newCv(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
// 輪郭をくっきりさせて、ドット絵らしくする（半透明のふちを切る）
function crispen(cv) {
  const c = cv.getContext('2d');
  const d = c.getImageData(0, 0, cv.width, cv.height), a = d.data;
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0;
  c.putImageData(d, 0, 0);
  return cv;
}
function renderFrame(fn) { const cv = newCv(48, 84); const c = cv.getContext('2d'); fn(c); return crispen(cv); }

// キャラクターの画像一式を作り images に登録する
function buildCharacter(id, P, images) {
  const sP = Object.assign({ skin: '#f6d2b0', hair: '#6a4020', top: '#4a78c8', bottom: '#5a4a3a' }, P);
  images[id + '_stand0'] = renderFrame(c => drawBody(c, sP, 'front', 0));
  images[id + '_down1'] = renderFrame(c => drawBody(c, sP, 'front', 1));
  images[id + '_stand2'] = renderFrame(c => drawBody(c, sP, 'back', 0));
  images[id + '_up1'] = renderFrame(c => drawBody(c, sP, 'back', 1));
  images[id + '_walk2'] = renderFrame(c => drawBody(c, sP, 'side', 0));
  images[id + '_walk3'] = renderFrame(c => drawBody(c, sP, 'side', 1));
  for (let i = 0; i < 4; i++) images[`${id}_battle${i}`] = renderFrame(c => drawBattle(c, sP, i));
  // 顔グラ
  const face = newCv(64, 64), fc = face.getContext('2d');
  const g = fc.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, sP.faceBg || '#8ab4e8'); g.addColorStop(1, shadeHex(sP.faceBg || '#8ab4e8', -0.35));
  fc.fillStyle = g; fc.fillRect(0, 0, 64, 64);
  const d = bodyDims(sP);
  fc.save(); fc.translate(32 - 24 * 1.75, 35 - d.hy * 1.75); fc.scale(1.75, 1.75);
  drawBody(fc, Object.assign({}, sP, { weapon: null }), 'front', 0);
  fc.restore();
  images[id + '_face'] = face;
  images[id + '__gen'] = true;
}

// ---------- 登場人物のデザイン ----------
const CHARACTERS = {
  // ゲスト
  harold:  { skin: '#f0c8a8', hair: '#e8e8ec', hairStyle: 'slick', beard: 'mustache', old: true, openEyes: true, outfit: 'armor', top: '#b8c0d0', bottom: '#5a5a6a', cape: '#8a2a3a', weapon: 'sword', build: 'big', faceBg: '#c8a878' },
  mina:    { hair: '#a8603a', hairStyle: 'twin', ribbon: '#58b858', female: true, smile: true, outfit: 'dress', top: '#f0d070', accent: '#58b858', build: 'small', weapon: 'staff', gem: '#9fffb0', faceBg: '#a8e0a0' },
  olga:    { skin: '#f2cfb4', hair: '#c8c8d0', hairStyle: 'bun', old: true, glasses: true, female: true, outfit: 'robe', top: '#5a4a9a', accent: '#e8c048', hat: 'witch', hatColor: '#3a2a6a', weapon: 'staff', gem: '#ff9a5a', faceBg: '#b8a0e0' },
  // 敵役・物語の人物
  gordo:   { skin: '#f0c098', hair: '#2a2028', hairStyle: 'slick', beard: 'mustache', outfit: 'suit', top: '#c89a30', bottom: '#5a2a6a', accent: '#8a2a8a', build: 'fat', weapon: 'bag', smile: true, faceBg: '#e8c870' },
  thug:    { skin: '#d8a078', hair: '#3a2a20', hairStyle: 'short', hat: 'bandana', hatColor: '#8a3a3a', outfit: 'rags', top: '#6a5a48', bottom: '#3a3a48', weapon: 'dagger', build: 'big', angry: true, faceBg: '#a88870' },
  cultist: { hat: 'mask', hatColor: '#6a1a2a', maskColor: '#e8e0d0', outfit: 'robe', top: '#5a1a2a', accent: '#c8a040', weapon: 'staff', gem: '#c060ff', faceBg: '#6a3a5a' },
  garza:   { hat: 'mask', hatColor: '#1a3a7a', maskColor: '#d8e0f0', outfit: 'robe', top: '#1a2a5a', accent: '#7fc8ff', weapon: 'spear', build: 'big', faceBg: '#4a6aa0' },
  ifra:    { hat: 'mask', hatColor: '#8a2a10', maskColor: '#f0d8a0', outfit: 'robe', top: '#6a1a0a', accent: '#ff8a2a', weapon: 'staff', gem: '#ff6a2a', faceBg: '#a85a3a' },
  nemesis: { skin: '#c8b0d8', hair: '#5a2a8a', hairStyle: 'long', female: true, outfit: 'robe', top: '#2a1a3a', accent: '#c060ff', cape: '#3a0a4a', weapon: 'staff', gem: '#ff40a0', faceBg: '#4a2a5a', eyes: '#ff4080' },
  king:    { skin: '#f0c8a8', hair: '#f0f0f0', hairStyle: 'short', beard: 'full', old: true, outfit: 'robe', top: '#a83040', accent: '#f0c838', cape: '#c83838', hat: 'crown', faceBg: '#d8b060' },
  soldier: { hair: '#5a3a20', outfit: 'armor', top: '#9aa4b8', bottom: '#4a4a5a', hat: 'helmet', hatColor: '#9aa4b8', weapon: 'spear', faceBg: '#8a9ab8' },
  // ルミナの町
  mom:       { hair: '#8a5a30', hairStyle: 'bun', female: true, smile: true, outfit: 'apron', top: '#c86a5a', accent: '#fff8ec', weapon: 'pan', faceBg: '#f0b8a0' },
  baba:      { skin: '#ecc8ac', hair: '#d8d8e0', hairStyle: 'bun', old: true, female: true, outfit: 'robe', top: '#5a3a7a', accent: '#e8c048', hat: 'hood', hatColor: '#4a2a6a', smile: true, faceBg: '#8a6ab0' },
  innkeeper: { hair: '#5a3a20', hairStyle: 'short', beard: 'goatee', outfit: 'apron', top: '#5a8a4a', accent: '#f8f4ec', build: 'fat', smile: true, faceBg: '#c8e0a0' },
  gantz:     { hair: '#3a2a20', hairStyle: 'bald', beard: 'full', beardColor: '#6a3a20', outfit: 'apron', top: '#7a5a48', accent: '#4a3a30', build: 'big', weapon: 'hammer', faceBg: '#d8a070' },
  marie:     { hair: '#e8c060', hairStyle: 'ponytail', ribbon: '#4a78c8', female: true, smile: true, outfit: 'dress', top: '#5a8ad8', accent: '#f8f4ec', faceBg: '#a8c8f0' },
  pop:       { hair: '#e86a2a', hairStyle: 'spiky', smile: true, outfit: 'apron', top: '#4aa868', accent: '#f8e070', build: 'slim', hat: 'cap', hatColor: '#f0a030', faceBg: '#f8d880' },
  villager:  { hair: '#4a3a2a', hairStyle: 'short', outfit: 'tunic', top: '#c84a4a', bottom: '#4a5a7a', faceBg: '#e8a0a0' },
  girl:      { hair: '#3a2a4a', hairStyle: 'bob', female: true, smile: true, outfit: 'dress', top: '#9a6ad8', accent: '#ffffff', faceBg: '#d0b8f0' },
  oldman:    { hair: '#d8d8d8', hairStyle: 'bald', old: true, beard: 'full', beardColor: '#e8e8e8', outfit: 'robe', top: '#7a6a4a', accent: '#c8a868', weapon: 'staff', gem: '#c8a868', faceBg: '#c8b890' },
  kid:       { hair: '#e8a040', hairStyle: 'spiky', smile: true, outfit: 'tunic', top: '#f0d040', bottom: '#4a6ab8', build: 'small', faceBg: '#f8e080' },
  merchant:  { hair: '#6a4a2a', hairStyle: 'short', outfit: 'coat', top: '#3a6aa8', bottom: '#5a4a3a', hat: 'cap', hatColor: '#2a4a7a', weapon: 'bag', build: 'fat', faceBg: '#a8c0e0' },
  guard:     { hair: '#3a2a20', outfit: 'armor', top: '#a8b0c0', bottom: '#4a4a5a', hat: 'helmet', hatColor: '#c8a040', weapon: 'spear', build: 'big', faceBg: '#c8c8d8' },
  lady:      { hair: '#c8603a', hairStyle: 'long', female: true, outfit: 'dress', top: '#3aa8a0', accent: '#f8f4ec', faceBg: '#a0e0d8' },
  traveler:  { hair: '#2a3a2a', hairStyle: 'short', outfit: 'coat', top: '#5a7a4a', bottom: '#4a3a2a', cape: '#7a5a3a', weapon: 'staff', gem: '#a8a080', faceBg: '#b0c8a0' },
  // ベルガ
  belgaInn:  { hair: '#2a2a2a', hairStyle: 'bun', female: true, smile: true, outfit: 'apron', top: '#a84a6a', accent: '#fff8ec', faceBg: '#f0a8c0' },
  belgaShop: { hair: '#8a6a4a', hairStyle: 'slick', glasses: true, outfit: 'suit', top: '#4a4a5a', bottom: '#2a2a3a', accent: '#e8c048', faceBg: '#c0c0d0' },
  sailor:    { hair: '#1a1a2a', hairStyle: 'short', outfit: 'tunic', top: '#f0f0f8', bottom: '#2a4a8a', hat: 'cap', hatColor: '#2a4a8a', faceBg: '#a8c8f0' },
  dancer:    { hair: '#d83a5a', hairStyle: 'ponytail', ribbon: '#f0c838', female: true, smile: true, outfit: 'dress', top: '#f0a030', accent: '#d83a5a', faceBg: '#f8c890' },
  // ゴラン村（ガロの故郷）
  villageChief: { hair: '#c8c0b8', hairStyle: 'short', old: true, beard: 'full', beardColor: '#d8d0c8', outfit: 'tunic', top: '#8a7a5a', bottom: '#5a4a3a', weapon: 'staff', gem: '#8a7a5a', faceBg: '#c8b898' },
  farmer:    { hair: '#6a4a2a', hairStyle: 'short', outfit: 'apron', top: '#7a9a4a', accent: '#d8c8a0', hat: 'cap', hatColor: '#c8a858', faceBg: '#c8d8a0' },
  // 学院都市ソフィア
  student:   { hair: '#3a3a6a', hairStyle: 'short', glasses: true, outfit: 'robe', top: '#2a4a8a', accent: '#e8c048', weapon: 'book', faceBg: '#a0b8e8' },
  studentF:  { hair: '#e8d0a0', hairStyle: 'long', female: true, outfit: 'robe', top: '#2a4a8a', accent: '#e8c048', weapon: 'book', faceBg: '#c0d0f8' },
  librarian: { hair: '#6a3a5a', hairStyle: 'bun', female: true, glasses: true, outfit: 'robe', top: '#5a3a3a', accent: '#c8a868', weapon: 'book', faceBg: '#d0b0a0' },
  dean:      { hair: '#a8a8b0', hairStyle: 'bald', old: true, beard: 'full', beardColor: '#c8c8d0', outfit: 'robe', top: '#3a2a5a', accent: '#c8a040', hat: 'witch', hatColor: '#2a1a4a', faceBg: '#9080b8' },
};

function buildAllCharacters(images) {
  for (const id in CHARACTERS) buildCharacter(id, CHARACTERS[id], images);
}
