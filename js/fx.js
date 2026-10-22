// バトルのエフェクト
'use strict';

// ---------- エフェクト ----------
function targetPoint(t) {
  if (t === 'party' || t === null) return null;
  if (t.data) { const img = enemyImage(t); const h = img ? Math.min(img.height * t.k, 150) : 60; return { x: t.x, y: t.y - h / 2, fy: t.y, h }; }
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
FX.slash.single = FX.claw.single = FX.slash2.single = true;

// ===== 上位のわざ・ボスの技 =====
const ring = (c, x, y, r, col, lw, alpha, flat = 0.5) => { if (alpha <= 0 || r <= 0) return; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, alpha); c.strokeStyle = col; c.lineWidth = lw; c.shadowColor = col; c.shadowBlur = 12; c.beginPath(); c.ellipse(x, y, r, r * flat, 0, 0, 7); c.stroke(); c.restore(); };
const beam = (c, x, top, bottom, w, col, alpha) => { if (alpha <= 0 || w <= 0) return; c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, col + '00'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, col + '00'); c.globalAlpha = Math.min(1, alpha); c.fillStyle = g; c.fillRect(x - w, top, w * 2, bottom - top); const g2 = c.createLinearGradient(x - w * 2, 0, x + w * 2, 0); g2.addColorStop(0, col + '00'); g2.addColorStop(0.5, col + '88'); g2.addColorStop(1, col + '00'); c.fillStyle = g2; c.fillRect(x - w * 2, top, w * 4, bottom - top); c.restore(); };
const sparks = (pt, n, cols, max = 0.35) => burst(pt.x, pt.y, n, { color: cols, add: true, shape: 'spark', min: 0.1, max, life: 420 });

Object.assign(FX, {
  slash3: { dur: 900, hit: 0.55, dim: 0.55, dimColor: '#04061a', single: true,
    draw(c, f, p, pt) {
      crescent(c, pt.x, pt.y, 36, -2.7, -2.7 + easeOut(win(p, 0.05, 0.4)) * 3, 13, '#fff27a', 1 - win(p, 0.5, 0.9));
      if (p > 0.4 && p < 0.75) bolt(c, pt.x + 10, -10, pt.x, pt.y + 10, Math.floor(f.t / 40), 2.6, '#fff27a', 1 - win(p, 0.4, 0.75));
      c.save(); c.globalCompositeOperation = 'lighter'; glow(c, pt.x, pt.y, 60 * win(p, 0.45, 0.6), '#fff6b0', 0.8 * (1 - win(p, 0.6, 1))); c.restore();
    },
    at: { 0.3(f, pt) { Sfx.play('hit'); sparks(pt, 14, ['#fff27a', '#ffffff']); }, 0.5(f, pt) { Sfx.play('thunder'); flash(0.85); B.shake = 9; sparks(pt, 30, ['#fff27a', '#ffffff', '#a0d8ff'], 0.45); } } },
  slash4: { dur: 1500, hit: 0.62, dim: 0.75, dimColor: '#000008', single: true,
    emit(f, dt, p, pt) { if (p < 0.35) particle({ x: pt.x + rand(-60, 60), y: rand(0, 40), vx: 0, vy: 0.25, life: 400, color: pick(['#9ff8ff', '#ffffff']), add: true, shape: 'spark', size: 1.5 }); },
    draw(c, f, p, pt) {
      beam(c, pt.x, -20, pt.fy + 10, 26 * Math.sin(Math.PI * win(p, 0.3, 0.85)), '#7fd8ff', 1);
      for (let i = 0; i < 4; i++) { const a = win(p, 0.4 + i * 0.05, 0.6 + i * 0.05); crescent(c, pt.x, pt.y, 42 + i * 4, -2.9 + i * 0.8, -2.9 + i * 0.8 + easeOut(a) * 2.6, 12, i % 2 ? '#ffffff' : '#7fd8ff', a > 0 ? 1 - win(p, 0.75, 1) : 0); }
      c.save(); c.globalCompositeOperation = 'lighter'; glow(c, pt.x, pt.y, 110 * win(p, 0.55, 0.7), '#e8fcff', 0.9 * (1 - win(p, 0.7, 1))); c.restore();
      ring(c, pt.x, pt.fy, 140 * easeOut(win(p, 0.6, 1)), '#9ff8ff', 3, 1 - win(p, 0.6, 1));
    },
    at: { 0.3() { Sfx.play('magic'); }, 0.45(f, pt) { Sfx.play('crit'); B.shake = 8; }, 0.62(f, pt) { Sfx.play('thunder'); flash(1); B.shake = 14; sparks(pt, 50, ['#9ff8ff', '#ffffff', '#fff27a'], 0.6); } } },
  wind2: { dur: 1300, hit: 0.55, dim: 0.55, dimColor: '#021a0a',
    emit(f, dt, p, pts) { if (p > 0.85) return; for (const pt of pts) for (let i = 0; i < 4; i++) { const a = rand(0, 7); particle({ x: pt.x + Math.cos(a) * 22, y: pt.fy - rand(0, pt.h + 30), vx: -Math.sin(a) * 0.25, vy: rand(-0.2, -0.06), life: 550, color: pick(['#8cff9a', '#ffffff', '#4fd860']), add: true, shape: pick(['leaf', 'spark']), size: rand(2, 3.5), vr: rand(-0.03, 0.03), rot: a }); } },
    draw(c, f, p, pts) { FX.wind.draw(c, f, p, pts); FX.wind.draw(c, Object.assign({}, f, { t: f.t * 1.4 }), p, pts.map(pt => ({ ...pt, h: pt.h * 1.3 }))); c.save(); c.globalCompositeOperation = 'lighter'; for (const pt of pts) glow(c, pt.x, pt.y, 70 * win(p, 0.2, 0.5), '#9fffb0', 0.5 * (1 - win(p, 0.7, 1))); c.restore(); },
    at: { 0.1() { Sfx.play('magic'); }, 0.55(f, pts) { pts.forEach(pt => sparks(pt, 22, ['#c8ffd0', '#ffffff'])); flash(0.4, '#d8ffe0'); B.shake = 7; Sfx.play('crit'); } } },
  smash: { dur: 800, hit: 0.5, dim: 0.35, dimColor: '#140800', single: true,
    draw(c, f, p, pt) {
      const k = easeOut(win(p, 0.05, 0.45));
      crescent(c, pt.x + 30, pt.y - 10, 44, Math.PI * 0.95, Math.PI * 0.95 + k * 1.8, 14, '#ffcf7a', 1 - win(p, 0.5, 0.9));
      ring(c, pt.x, pt.fy, 60 * easeOut(win(p, 0.45, 0.9)), '#ffb060', 3, 1 - win(p, 0.45, 0.95), 0.3);
    },
    at: { 0.48(f, pt) { Sfx.play('crit'); B.shake = 10; flash(0.4, '#ffd8a0'); sparks(pt, 24, ['#ffcf7a', '#ffffff']); for (let i = 0; i < 8; i++) particle({ x: pt.x + rand(-14, 14), y: pt.fy, vx: rand(-0.08, 0.08), vy: rand(-0.35, -0.15), g: 0.0011, life: 700, color: pick(['#8a6a44', '#b08a5a']), shape: 'rock', size: rand(2, 4), vr: 0.02 }); } } },
  smash2: { dur: 1400, hit: 0.55, dim: 0.6, dimColor: '#100400', single: true,
    draw(c, f, p, pt) {
      const fall = easeOut(win(p, 0.15, 0.5));
      c.save(); c.globalCompositeOperation = 'lighter'; glow(c, pt.x, pt.y - 120 + fall * 120, 50, '#ffb060', 0.9 * (1 - win(p, 0.55, 0.7))); c.restore();
      for (let i = 0; i < 3; i++) ring(c, pt.x, pt.fy, (50 + i * 40) * easeOut(win(p, 0.5 + i * 0.06, 1)), i % 2 ? '#ffffff' : '#ffb060', 4 - i, 1 - win(p, 0.5, 1), 0.3);
      beam(c, pt.x, pt.fy - 200, pt.fy, 30 * Math.sin(Math.PI * win(p, 0.5, 0.9)), '#ffb060', 0.9);
    },
    at: { 0.2() { Sfx.play('magic'); }, 0.52(f, pt) { Sfx.play('thunder'); Sfx.play('crit'); flash(0.9, '#ffe0b0'); B.shake = 16; sparks(pt, 40, ['#ffcf7a', '#ffffff', '#ff8a3a'], 0.55); for (let i = 0; i < 18; i++) particle({ x: pt.x + rand(-30, 30), y: pt.fy, vx: rand(-0.15, 0.15), vy: rand(-0.45, -0.2), g: 0.0011, life: 900, color: pick(['#8a6a44', '#5e462a', '#b08a5a']), shape: 'rock', size: rand(3, 6), vr: 0.03 }); } } },
  quake2: { dur: 1300, hit: 0.5, dim: 0.5, dimColor: '#1a0800',
    draw(c, f, p, pts) {
      FX.quake.draw(c, f, p, pts);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const pt of pts) { beam(c, pt.x, pt.fy - 120 * easeOut(win(p, 0.45, 0.6)), pt.fy, 14 * (1 - win(p, 0.7, 1)), '#ff7a1a', 1); glow(c, pt.x, pt.fy, 60, '#ff6a00', 0.6 * win(p, 0.45, 0.55) * (1 - win(p, 0.7, 1))); }
      c.restore();
    },
    at: { 0.1() { B.shake = 6; }, 0.45(f, pts) { FX.quake.at[0.45](f, pts); B.shake = 16; flash(0.6, '#ffa040'); } } },
  guard2: { dur: 1100, hit: 0.5, dim: 0.3, dimColor: '#1a1200',
    draw(c, f, p, pts) {
      const sc = p < 0.3 ? easeOut(p / 0.3) * 1.2 : 1.2 - Math.min(0.2, p - 0.3);
      for (const pt of pts) { shield(c, pt.x, pt.y, 28 * sc, '#ffd75e', 1 - win(p, 0.75, 1), win(p, 0.3, 0.8)); ring(c, pt.x, pt.fy, 30 + p * 20, '#ffd75e', 2, 1 - p, 0.35); }
    },
    at: { 0.3(f, pts) { flash(0.4, '#fff0b0'); pts.forEach(pt => sparks(pt, 14, ['#ffe080', '#ffffff'])); } } },
  heal2: { dur: 1200, hit: 0.55, dim: 0.3, dimColor: '#021a0a',
    emit(f, dt, p, pts) { FX.heal.emit(f, dt, p, pts); FX.heal.emit(f, dt, p, pts); },
    draw(c, f, p, pts) {
      FX.heal.draw(c, f, p, pts);
      for (const pt of pts) { beam(c, pt.x, pt.fy - 140, pt.fy, 18 * Math.sin(Math.PI * p), '#6effa0', 0.8); ring(c, pt.x, pt.fy, 40 * easeOut(win(p, 0.3, 1)), '#a8ffb8', 2, 1 - win(p, 0.3, 1), 0.35); }
    } },
  holy2: { dur: 1500, hit: 0.55, dim: 0.65, dimColor: '#0a0818',
    emit(f, dt, p, pts) { FX.holy.emit(f, dt, p, pts); },
    draw(c, f, p, pts) {
      for (const pt of pts) { magicCircle(c, pt.x, pt.fy, 36, '#ffe27a', f.t / 250, 1 - win(p, 0.75, 1)); beam(c, pt.x, -20, pt.fy, 32 * Math.sin(Math.PI * win(p, 0.2, 0.9)), '#ffe27a', 1); }
      const cx = battle.W * 0.3, cy = battle.H * 0.55;
      ring(c, cx, cy, 260 * easeOut(win(p, 0.5, 1)), '#fff1a8', 4, 1 - win(p, 0.5, 1), 0.6);
      c.save(); c.globalCompositeOperation = 'lighter'; glow(c, cx, cy, 200 * win(p, 0.5, 0.65), '#fffbe0', 0.7 * (1 - win(p, 0.65, 1))); c.restore();
    },
    at: { 0.15() { Sfx.play('heal'); }, 0.55(f, pts) { Sfx.play('crit'); flash(0.9, '#fffbe0'); B.shake = 8; pts.forEach(pt => sparks(pt, 24, ['#ffffff', '#fff1a8'])); } } },
  fire2: { dur: 1400, hit: 0.5, dim: 0.6, dimColor: '#1e0402',
    emit(f, dt, p, pts) { FX.fire.emit(f, dt, p, pts); if (p < 0.7) particle({ x: rand(0, battle.W), y: battle.H + 4, vy: rand(-0.25, -0.12), vx: rand(-0.03, 0.03), life: 900, color: pick(['#ffe066', '#ff6a1a']), add: true, size: rand(2, 4), grow: -0.5 }); },
    draw(c, f, p, pts) {
      FX.fire.draw(c, f, p, pts);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const [i, pt] of pts.entries()) { const q = win(p, 0.35 + i * 0.08, 0.6 + i * 0.08); glow(c, pt.x, pt.y, 90 * easeOut(q), '#ff8a2a', (1 - q) * 1.2); glow(c, pt.x, pt.y, 45 * easeOut(q), '#fff0a0', (1 - q) * 1.2); }
      c.restore();
    },
    at: { 0.0() { Sfx.play('fire'); }, 0.4(f, pts) { FX.fire.at[0.42](f, pts); }, 0.55(f, pts) { Sfx.play('thunder'); flash(0.8, '#ffb060'); B.shake = 12; pts.forEach(pt => sparks(pt, 20, ['#ffe066', '#ff6a1a', '#ffffff'], 0.45)); } } },
  ice2: { dur: 1500, hit: 0.65, dim: 0.65, dimColor: '#020c26',
    emit(f, dt, p) { for (let i = 0; i < 2; i++) FX.ice.emit(f, dt, p); },
    draw(c, f, p, pts) {
      FX.ice.draw(c, f, Math.min(p * 1.1, 1) * 0.9, pts);
      c.save();
      for (const pt of pts) { // 地面から せり上がる 氷の柱
        const k = easeOut(win(p, 0.3, 0.6)), fade = 1 - win(p, 0.64, 0.7);
        c.globalAlpha = fade; c.globalCompositeOperation = 'lighter';
        for (let i = -2; i <= 2; i++) { const hgt = (50 - Math.abs(i) * 12) * k; c.fillStyle = '#bfefffcc'; c.beginPath(); c.moveTo(pt.x + i * 10 - 6, pt.fy); c.lineTo(pt.x + i * 10, pt.fy - hgt); c.lineTo(pt.x + i * 10 + 6, pt.fy); c.fill(); }
      }
      c.restore();
    },
    at: { 0.0() { Sfx.play('ice'); }, 0.65(f, pts) { FX.ice.at[0.62](f, pts); flash(0.8, '#e0f6ff'); B.shake = 10; } } },
  thunder2: { dur: 1300, hit: 0.35, dim: 0.75, dimColor: '#02030e',
    draw(c, f, p, pts) {
      const strikes = [[0.08, 0.2], [0.22, 0.34], [0.36, 0.5], [0.52, 0.66], [0.68, 0.8]];
      strikes.forEach(([a, b], i) => {
        if (p < a || p > b) return;
        const al = 1 - win(p, a, b) * 0.5;
        for (const pt of pts) bolt(c, pt.x + rand(-30, 30), -10, pt.x, pt.y + 8, Math.floor(f.t / 40) + i * 13 + pt.x, 2.8, '#fff27a', al);
        for (let k = 0; k < 2; k++) bolt(c, rand(0, battle.W), -10, rand(0, battle.W), battle.H * 0.8, Math.floor(f.t / 50) + k * 31, 1.8, '#a0d8ff', al * 0.8);
      });
    },
    at: { 0.08() { flash(0.9); Sfx.play('thunder'); B.shake = 8; }, 0.36(f, pts) { flash(0.9); Sfx.play('thunder'); B.shake = 10; pts.forEach(pt => sparks(pt, 16, ['#fff27a', '#ffffff'])); }, 0.68(f, pts) { flash(1); Sfx.play('thunder'); B.shake = 12; pts.forEach(pt => sparks(pt, 22, ['#fff27a', '#ffffff', '#a0d8ff'], 0.45)); } } },
  meteor: { dur: 1900, hit: 0.62, dim: 0.75, dimColor: '#100204',
    draw(c, f, p, pts) {
      c.save(); c.globalCompositeOperation = 'lighter';
      pts.forEach((pt, i) => {
        for (let k = 0; k < 2; k++) {
          const q = win(p, 0.15 + i * 0.07 + k * 0.1, 0.45 + i * 0.07 + k * 0.1);
          if (q <= 0 || q >= 1) continue;
          const sx = pt.x + 160 - k * 30, sy = -40, x = sx + (pt.x - sx) * q, y = sy + (pt.y - sy) * q;
          c.strokeStyle = '#ff8a3a'; c.lineWidth = 8; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(x + 40, y - 50); c.lineTo(x, y); c.stroke();
          glow(c, x, y, 26, '#ffb060', 1); glow(c, x, y, 12, '#ffffff', 1);
        }
        const ex = win(p, 0.45 + i * 0.07, 0.8 + i * 0.07);
        glow(c, pt.x, pt.y, 110 * easeOut(ex), '#ff6a1a', (1 - ex) * 1.3); glow(c, pt.x, pt.y, 55 * easeOut(ex), '#fff0a0', (1 - ex) * 1.3);
      });
      c.restore();
      if (p > 0.5) ring(c, battle.W * 0.3, battle.H * 0.75, 300 * easeOut(win(p, 0.5, 1)), '#ffb060', 4, 1 - win(p, 0.5, 1), 0.35);
    },
    at: { 0.1() { Sfx.play('fire'); }, 0.45(f, pts) { Sfx.play('thunder'); flash(0.7, '#ffb060'); B.shake = 12; }, 0.62(f, pts) { Sfx.play('crit'); flash(1, '#fff0d0'); B.shake = 18; pts.forEach(pt => { sparks(pt, 30, ['#ffe066', '#ff6a1a', '#ffffff'], 0.55); for (let i = 0; i < 8; i++) particle({ x: pt.x, y: pt.fy, vx: rand(-0.15, 0.15), vy: rand(-0.4, -0.15), g: 0.001, life: 900, color: pick(['#5e462a', '#ff6a1a']), shape: 'rock', size: rand(2, 5), vr: 0.03 }); }); } } },
  darkflare: { dur: 1200, hit: 0.6, dim: 0.65, dimColor: '#0a0014',
    emit(f, dt, p, pts) { if (p > 0.55) return; for (const pt of pts) { const a = rand(0, 7); particle({ x: pt.x + Math.cos(a) * 50, y: pt.y + Math.sin(a) * 50, vx: -Math.cos(a) * 0.12, vy: -Math.sin(a) * 0.12, life: 420, color: pick(['#c060ff', '#5a10a0', '#ff40a0']), add: true, size: rand(2, 4) }); } },
    draw(c, f, p, pts) {
      for (const pt of pts) {
        c.save(); c.fillStyle = '#000000'; c.globalAlpha = 0.85 * win(p, 0.1, 0.4) * (1 - win(p, 0.6, 0.65)); c.beginPath(); c.arc(pt.x, pt.y, 20 * (1 - win(p, 0.4, 0.6)) + 4, 0, 7); c.fill(); c.restore();
        c.save(); c.globalCompositeOperation = 'lighter'; const q = win(p, 0.6, 0.95); glow(c, pt.x, pt.y, 80 * easeOut(q), '#c060ff', (1 - q) * 1.4); glow(c, pt.x, pt.y, 40 * easeOut(q), '#ffb0ff', (1 - q)); c.restore();
        ring(c, pt.x, pt.y, 25 * (1 - win(p, 0, 0.55)) + 4, '#e0a0ff', 2, win(p, 0, 0.3) * (1 - win(p, 0.5, 0.6)), 1);
      }
    },
    at: { 0.0() { Sfx.play('magic'); }, 0.6(f, pts) { Sfx.play('thunder'); flash(0.6, '#d080ff'); B.shake = 10; pts.forEach(pt => sparks(pt, 20, ['#c060ff', '#ff40a0', '#ffffff'])); } } },
  nova: { dur: 2000, hit: 0.65, dim: 0.85, dimColor: '#000000',
    draw(c, f, p, pts) {
      const cx = battle.W * 0.62, cy = battle.H * 0.4;
      const grow = easeOut(win(p, 0.05, 0.5));
      c.save(); c.globalCompositeOperation = 'lighter'; glow(c, cx, cy, 70 * grow + 10, '#c060ff', 0.9 * (1 - win(p, 0.65, 0.75))); c.restore();
      c.save(); c.fillStyle = '#000000'; c.globalAlpha = 1 - win(p, 0.6, 0.66); c.beginPath(); c.arc(cx, cy, 34 * grow, 0, 7); c.fill(); c.restore();
      ring(c, cx, cy, 36 * grow + 2, '#ffd0ff', 2, 1 - win(p, 0.6, 0.66), 1);
      const ex = win(p, 0.62, 1);
      c.save(); c.globalCompositeOperation = 'lighter'; glow(c, cx, cy, 400 * easeOut(ex), '#e8b0ff', (1 - ex) * 1.5); c.restore();
      ring(c, cx, cy, 380 * easeOut(ex), '#ffffff', 5, 1 - ex, 0.7);
    },
    emit(f, dt, p) { if (p < 0.6) { const a = rand(0, 7); particle({ x: battle.W * 0.62 + Math.cos(a) * 120, y: battle.H * 0.4 + Math.sin(a) * 120, vx: -Math.cos(a) * 0.2, vy: -Math.sin(a) * 0.2, life: 550, color: pick(['#c060ff', '#ffffff', '#ff40a0']), add: true, shape: 'spark', size: 1.5 }); } },
    at: { 0.05() { Sfx.play('magic'); B.shake = 3; }, 0.4() { B.shake = 6; }, 0.62() { Sfx.play('thunder'); Sfx.play('crit'); flash(1, '#ffffff'); B.shake = 20; } } },
  eclipse: { dur: 2600, hit: 0.7, dim: 0.85, dimColor: '#000006',
    draw(c, f, p, pts) {
      const cx = battle.W * 0.32, cy = battle.H * 0.55;
      const cols = ['#9ff8ff', '#fff1a8', '#ffb060', '#c8a0ff'];
      const starts = [[300, 150], [320, 200], [290, 240], [310, 270]];
      c.save(); c.globalCompositeOperation = 'lighter';
      starts.forEach(([sx, sy], i) => {
        const q = easeOut(win(p, 0.05 + i * 0.05, 0.45));
        c.strokeStyle = cols[i]; c.lineWidth = 6; c.shadowColor = cols[i]; c.shadowBlur = 16; c.globalAlpha = (1 - win(p, 0.55, 0.65));
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (cx - sx) * q, sy + (cy - sy) * q); c.stroke();
        glow(c, sx + (cx - sx) * q, sy + (cy - sy) * q, 20, cols[i], 1 - win(p, 0.55, 0.65));
      });
      c.restore();
      const g = win(p, 0.45, 0.68);
      c.save(); c.globalCompositeOperation = 'lighter';
      glow(c, cx, cy, 40 + 50 * g, '#ffffff', g * (1 - win(p, 0.7, 0.75)));
      const ex = win(p, 0.68, 1);
      glow(c, cx, cy, 420 * easeOut(ex), '#fff8e0', (1 - ex) * 1.6);
      c.restore();
      for (let i = 0; i < 3; i++) ring(c, cx, cy, (120 + i * 90) * easeOut(win(p, 0.68 + i * 0.05, 1)), cols[i], 4, 1 - win(p, 0.68, 1), 0.6);
      for (const pt of pts) beam(c, pt.x, -20, pt.fy, 30 * Math.sin(Math.PI * win(p, 0.68, 1)), '#ffffff', 1);
    },
    at: { 0.05() { Sfx.play('magic'); }, 0.45() { Sfx.play('heal'); B.shake = 4; }, 0.7(f, pts) { Sfx.play('thunder'); Sfx.play('crit'); flash(1); B.shake = 22; pts.forEach(pt => sparks(pt, 40, ['#ffffff', '#fff1a8', '#9ff8ff', '#c8a0ff'], 0.6)); } } },
});
const CAST_COLOR = { fire: '#ff7a3a', fire2: '#ff7a3a', meteor: '#ff7a3a', ice: '#7fd8ff', ice2: '#7fd8ff', thunder: '#fff27a', thunder2: '#fff27a', holy: '#ffe27a', holy2: '#ffe27a', heal: '#6effa0', heal2: '#6effa0', guard: '#7fc8ff' };

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
      const single = fx.def.single;
      if (single) fx.pts.forEach(pt => fx.def.at[k](fx, pt)); else fx.def.at[k](fx, fx.pts);
    }
  }
}
function drawFx(c, fx) {
  const p = Math.min(1, fx.t / fx.dur);
  c.save();
  if (fx.def.single) fx.pts.forEach(pt => fx.def.draw(c, fx, p, pt));
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

