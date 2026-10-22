// 音楽：WebAudio のチップチューン・シーケンサーと曲データ
'use strict';

// 曲データ：bars=1小節ごとのコード、melody=小節を | で区切ったメロディ
// 音符は「音名+オクターブ+長さ」（w=全 h=2分 q=4分 e=8分 s=16分、末尾 . で付点）。r は休符
const SONGS = {
  opening: { bpm: 84, lead: 'square', harm: 'pad', bass: 'half', drum: 'soft',
    bars: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'C'],
    melody: 'g4q c5q e5q g5q | a5h. g5q | f5q e5q c5q a4q | b4h. d5q | e5q g5q c6q b5e a5e | g5h. e5q | f5q a5q g5q f5q | e5h d5h | c5q e5q a5q g5q | g5h. e5q | f5q e5q d5q c5q | c5h. e5q | d5q f5q a5q g5e f5e | e5h d5h | c5w | rw' },
  leon: { bpm: 128, lead: 'pulse', harm: 'arp8', bass: 'oct', drum: 'march',
    bars: ['D', 'G', 'A', 'D', 'Bm', 'G', 'Em', 'A', 'D', 'G', 'A', 'F#m', 'G', 'A', 'D', 'D'],
    melody: 'd5e e5e f#5q a5q d6q | b5q. a5e g5q b5q | a5q. g5e f#5q e5q | f#5h. a4q | b4e c#5e d5q f#5q b5q | g5q. f#5e e5q d5q | e5q f#5q g5q b5q | a5h. rq | d6q. c#6e b5q a5q | b5q. a5e g5q f#5q | e5q f#5e g5e a5q c#6q | f#5h. f#5q | g5q a5q b5q d6q | c#6q. b5e a5q e5q | d5h. a4e c#5e | d5h rh' },
  selena: { bpm: 96, lead: 'triangle', harm: 'arp', bass: 'half', drum: 'soft',
    bars: ['F', 'C', 'Dm', 'Bb', 'F', 'Bb', 'C', 'C7', 'Dm', 'Am', 'Bb', 'F', 'Gm', 'C', 'F', 'F'],
    melody: 'a5q. g5e f5q c5q | e5q. f5e g5h | f5q. e5e d5q a4q | bb4h. d5q | c5q f5q a5q c6q | bb5q. a5e g5q f5q | g5q a5e g5e e5q c5q | g5h. c5q | d5q f5q a5q d6q | c6q. bb5e a5h | bb5q a5q g5q f5q | a5h. f5q | g5q bb5q d6q c6e bb5e | a5q g5q e5q c5q | f5w | rh. c5q' },
  garo: { bpm: 138, lead: 'pulse', harm: 'block', bass: 'drive', drum: 'rock',
    bars: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B7', 'C', 'D', 'Em', 'Em', 'C', 'D', 'B7', 'B7'],
    melody: 'e5e e5e g5e e5e b5q a5q | g5e f#5e e5e d5e e5h | c5e c5e e5e c5e g5q f#5q | d5e e5e f#5e a5e d6h | b5e b5e d6e b5e e6q d6q | b5e a5e g5e f#5e e5h | a5q c6q b5q a5q | f#5h d#5h | e5q g5q c6q b5q | a5q f#5q d5q a5q | b5q. a5e g5q f#5q | e5h. b4q | c5q e5q g5q c6q | d6q c6q a5q f#5q | b5q a5q f#5q d#5q | b4h. rq' },
  noa: { bpm: 104, lead: 'pulse', harm: 'arp', bass: 'pedal', drum: 'soft',
    bars: ['Am', 'F', 'G', 'Em', 'Am', 'F', 'Dm', 'E', 'F', 'G', 'Em', 'Am', 'Dm', 'E', 'Am', 'Am'],
    melody: 'e5q. a5e c6q b5q | a5q. g5e f5h | g5q. f5e e5q d5q | e5h. b4q | c5q e5q a5q c6q | d6q. c6e a5h | f5q a5q d6q c6q | b5h. g#5q | a5q c6q f6q e6q | d6q. c6e b5h | g5q b5q e6q d6q | c6h. a5q | d6q c6q a5q f5q | e5q g#5q b5q d6q | c6h b5e a5e g#5e b5e | a5h rh' },
  final: { bpm: 120, lead: 'square', harm: 'block', bass: 'oct', drum: 'march',
    bars: ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb', 'F', 'Bb', 'Bb'],
    melody: 'bb4q d5q f5q bb5q | a5q. g5e f5h | g5q bb5q d6q c6q | bb5h. g5q | f5q. g5e f5q d5q | c5q f5q a5q c6q | bb5q g5q eb5q g5q | f5h. rq | g5q. a5e bb5q d6q | eb6q. d6e c6q bb5q | d6q. c6e bb5q f5q | a5h. f5q | g5q bb5q eb6q d6q | c6q a5q f5q a5q | bb5h. f5q | bb5h rh' },
  lumina: { bpm: 116, lead: 'square', harm: 'block', bass: 'walk', drum: 'town',
    bars: ['G', 'C', 'D', 'G', 'Em', 'C', 'A7', 'D', 'G', 'C', 'D', 'Bm', 'C', 'D', 'G', 'G'],
    melody: 'b4e d5e g5e d5e b5q a5q | g5e e5e c5e e5e g5h | f#5e a5e d6e a5e c6q b5q | a5e g5e f#5e a5e g5h | e5e g5e b5e g5e e6q d6q | c6e b5e a5e g5e e5h | c#5e e5e a5e c#6e e6q d6q | d6h. rq | b5q. a5e g5q b5q | c6q. b5e a5q g5q | f#5q a5q d6q c6q | b5h. b5q | c6q. b5e a5q g5q | a5q b5e a5e f#5q d5q | g5h. d5q | g5q rq rh' },
  belga: { bpm: 132, lead: 'pulse', harm: 'arp8', bass: 'oct', drum: 'rock',
    bars: ['Bb', 'Eb', 'F', 'Bb', 'Gm', 'Eb', 'C7', 'F', 'Bb', 'Eb', 'F', 'Gm', 'Eb', 'F', 'Bb', 'Bb'],
    melody: 'f5e f5e bb5e f5e d6e c6e bb5q | g5e g5e bb5e g5e eb6q d6q | c6e bb5e a5e g5e f5q a5q | bb5q f5q d5h | g5e a5e bb5e d6e g6q f6q | eb6e d6e c6e bb5e g5h | e5e g5e bb5e c6e e6q d6q | c6h. f5q | bb5q d6q f6q d6q | eb6q c6q g5q bb5q | a5q c6q f6q eb6q | d6h. bb5q | g5q bb5q eb6q d6q | c6q a5q f5q a5q | bb5h. f5q | bb5q rq rh' },
  sofia: { bpm: 92, lead: 'triangle', harm: 'arp', bass: 'pedal', drum: 'none',
    bars: ['F', 'Am', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C', 'Dm', 'Am', 'Bb', 'F', 'Bb', 'C', 'F', 'F'],
    melody: 'c5h a5q g5q | e5h. c5q | d5q f5q bb5q a5q | g5h. c5q | a5q. g5e f5q c6q | a5h. f5q | g5q bb5q d6q c6q | c6h. rq | d6q. c6e a5q f5q | e5q a5q c6q e6q | d6q. c6e bb5q g5q | a5h. a5q | bb5q d6q c6q bb5q | a5q g5q e5q c5q | f5w | rw' },
  dungeon: { bpm: 88, lead: 'pulse', harm: 'arp8', bass: 'pedal', drum: 'soft',
    bars: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'A'],
    melody: 'd5q. f5e a5h | g#5q a5q rh | f5q. d5e bb4h | a4h. c#5q | d5q f5q a5q d6q | c6q bb5q g5h | a5q c#6q e6q g6q | f6h e6h' },
  battle: { bpm: 168, lead: 'pulse', harm: 'arp', bass: 'drive', drum: 'battle',
    bars: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
    melody: 'a5e a5e c6e a5e e6e a5e d6e c6e | b5e a5e g#5e b5e a5q e5q | f5e a5e c6e f6e e6e c6e a5e f5e | g5e b5e d6e g6e f6e d6e b5e g5e | a5q. b5e c6q d6q | e6q. d6e c6q b5q | a5q c6q f6q e6q | e6h g#5h | f5q a5q c6q f6q | g6q f6q d6q b5q | c6q. b5e a5q c6q | e6h. a5q | f6q. e6e d6q c6q | b5q d6q g6q f6q | e6q d6q c6q b5q | g#5q b5q e6q e5q' },
  boss: { bpm: 160, lead: 'square', harm: 'arp', bass: 'drive', drum: 'boss',
    bars: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Bb', 'C', 'Dm', 'Bb', 'Gm', 'A', 'A', 'A'],
    melody: 'd5e d5e d6e d5e c6e d5e a5e d5e | f5e g5e a5e c6e d6q a5q | bb5q. a5e g5q f5q | e5q. f5e g5q c6q | d6q. c6e a5q f5q | d6q f6q e6q d6q | bb5q d6q g6q f6q | e6h c#6h | d6q bb5q f5q bb5q | c6q g5q e5q g5q | a5q. g5e f5q e5q | d5q f5q bb5q d6q | g6q. f6e e6q d6q | c#6q e6q a6q g6q | f6q e6q d6q c#6q | e6h a5h' },
  last: { bpm: 148, lead: 'square', harm: 'arp', bass: 'oct', drum: 'last',
    bars: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G', 'Ab', 'Bb', 'Eb', 'Cm', 'Fm', 'G', 'Cm', 'G'],
    melody: 'c5q. eb5e g5q c6q | c6q. bb5e ab5h | bb5q. ab5e g5q f5q | g5h. b4q | c6q eb6q g6q f6e eb6e | eb6q. d6e c6h | ab5q c6q f6q eb6q | d6h b5h | c6e c6e eb6e c6e ab6q g6q | f6e d6e bb5e d6e f6q eb6q | eb6q. f6e g6q bb6q | g6h. eb6q | f6q ab6q c7q bb6q | ab6q g6q f6q d6q | eb6h. d6e c6e | b5h g5h' },
  ending: { bpm: 84, lead: 'triangle', harm: 'pad', bass: 'half', drum: 'soft',
    bars: ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'G', 'Am', 'Em', 'F', 'G', 'C', 'C'],
    melody: 'e5h g5q c6q | b5h. g5q | a5q. g5e a5q c6q | b5h. e5q | f5q a5q c6q f6q | e6h. c6q | d6q. c6e a5q f5q | g5h. g5q | c6q. b5e c6q e6q | d6h. b5q | c6q. b5e a5q e5q | g5h. e5q | f5q a5q c6q f6q | e6q d6q b5q g5q | c6w | rw' },
  tower: { bpm: 96, lead: 'triangle', harm: 'arp', bass: 'pedal', drum: 'none',
    bars: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'B'],
    melody: 'b5q. e6e g6q f#6q | e6h. b5q | c6q. b5e a5q e5q | f#5h d#5h | g5q. a5e b5q e6q | g6q. f#6e e6q c6q | d6q f#6q a6q g6q | f#6h d#6h' },
  temple: { bpm: 112, lead: 'square', harm: 'arp8', bass: 'oct', drum: 'march',
    bars: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G', 'Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Fm', 'G', 'G'],
    melody: 'c5h eb5q g5q | ab5h. g5q | f5q. g5e ab5q c6q | b5h. g5q | c6q. bb5e ab5q g5q | eb6h. c6q | d6q. c6e bb5q d6q | b5h g5h | c6q eb6q ab6q g6q | f6q. eb6e d6q bb5q | g5q bb5q d6q g6q | eb6h. c6q | ab5q c6q eb6q ab6q | g6q f6q eb6q c6q | d6q. eb6e d6q c6q | b5h. g5q' },
  omen: { bpm: 70, lead: 'triangle', harm: 'pad', bass: 'pedal', drum: 'none',
    bars: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E'],
    melody: 'e5h a5h | c6h. b5q | a5h f5h | e5w | a5h c6h | f6h. e6q | d6h b5h | g#5w' },
};

const DRUMS = {
  rock:   'k.h.s.h.k.hks.h.',
  march:  'k.h.s.h.k.h.s.ss',
  battle: 'k.hhs.hhk.kks.hs',
  boss:   'kkh.s.hkk.h.s.hs',
  last:   'k.hks.hkk.hks.ks',
  town:   'k.h.s.h.k.h.s.hh',
  soft:   'k.......h.......',
  none:   '................',
};

const NOTE_IDX = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const DUR = { w: 16, h: 8, q: 4, e: 2, s: 1 };
function noteFreq(name) { // 'c#5'
  const m = /^([a-g])(#|b)?(\d)$/.exec(name);
  if (!m) return null;
  let n = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}
function midiFreq(n) { return 440 * Math.pow(2, (n - 69) / 12); }
function chordNotes(sym) { // MIDI ノート（ルートは 3 オクターブ目）
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym);
  let root = NOTE_IDX[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 48;
  const q = m[3];
  let iv = [0, 4, 7];
  if (q === 'm') iv = [0, 3, 7];
  else if (q === '7') iv = [0, 4, 7, 10];
  else if (q === 'm7') iv = [0, 3, 7, 10];
  else if (q === 'maj7') iv = [0, 4, 7, 11];
  else if (q === 'dim') iv = [0, 3, 6];
  else if (q === 'sus4') iv = [0, 5, 7];
  return iv.map(i => root + i);
}

// 曲データを、チャンネルごとの音のリスト（step, len, freq）にする
function compileSong(song) {
  const steps = song.bars.length * 16;
  const lead = [], harm = [], bass = [], drum = [];
  const bars = song.melody.split('|');
  bars.forEach((bar, bi) => {
    let t = bi * 16;
    const end = t + 16;
    for (const tok of bar.trim().split(/\s+/)) {
      if (!tok) continue;
      const m = /^([a-g](?:#|b)?\d|r)([whqes])(\.)?$/.exec(tok);
      if (!m) continue;
      let len = DUR[m[2]]; if (m[3]) len *= 1.5;
      if (t >= end) break;
      len = Math.min(len, end - t);
      if (m[1] !== 'r') lead.push({ step: t, len, freq: noteFreq(m[1]) });
      t += len;
    }
  });
  song.bars.forEach((sym, bi) => {
    const t0 = bi * 16;
    const ch = chordNotes(sym);
    const root = ch[0] - 12; // ベースは 2 オクターブ目
    const fifth = root + 7;
    const b = song.bass;
    if (b === 'root') for (let i = 0; i < 4; i++) bass.push({ step: t0 + i * 4, len: 3, freq: midiFreq(root) });
    else if (b === 'oct') for (let i = 0; i < 8; i++) bass.push({ step: t0 + i * 2, len: 2, freq: midiFreq(root + (i % 2 ? 12 : 0)) });
    else if (b === 'drive') for (let i = 0; i < 8; i++) bass.push({ step: t0 + i * 2, len: 2, freq: midiFreq(i === 6 ? fifth : root) });
    else if (b === 'walk') [root, ch[1] - 12, fifth, root + 12].forEach((n, i) => bass.push({ step: t0 + i * 4, len: 3, freq: midiFreq(n) }));
    else if (b === 'half') { bass.push({ step: t0, len: 8, freq: midiFreq(root) }); bass.push({ step: t0 + 8, len: 8, freq: midiFreq(fifth) }); }
    else if (b === 'pedal') bass.push({ step: t0, len: 16, freq: midiFreq(root) });
    const h = song.harm;
    const tones = ch.map(n => n + 12);
    if (h === 'arp') for (let i = 0; i < 16; i++) harm.push({ step: t0 + i, len: 1, freq: midiFreq(tones[i % tones.length] + (Math.floor(i / tones.length) % 2) * 12) });
    else if (h === 'arp8') for (let i = 0; i < 8; i++) harm.push({ step: t0 + i * 2, len: 2, freq: midiFreq(tones[i % tones.length]) });
    else if (h === 'block') for (const s of [4, 12, 14]) tones.slice(0, 3).forEach(n => harm.push({ step: t0 + s, len: 1.5, freq: midiFreq(n), chord: true }));
    else if (h === 'pad') tones.slice(0, 3).forEach(n => harm.push({ step: t0, len: 16, freq: midiFreq(n), chord: true, pad: true }));
    const pat = DRUMS[song.drum] || DRUMS.none;
    for (let i = 0; i < 16; i++) if (pat[i] !== '.') drum.push({ step: t0 + i, kind: pat[i] });
  });
  return { steps, lead, harm, bass, drum };
}

const Music = {
  ctx: null, out: null, on: true, cur: null, data: null, timer: null, startTime: 0, scheduledUntil: 0, loopIndex: 0, pulseWave: null, noiseBuf: null,
  init(ctx) {
    if (!ctx || this.ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.55; this.out.connect(ctx.destination);
    // 25% パルス波
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * 0.25);
    this.pulseWave = ctx.createPeriodicWave(re, im);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  },
  play(name) {
    if (this.cur === name) return;
    this.stop();
    this.cur = name;
    if (!this.ctx || !SONGS[name]) return;
    const song = SONGS[name];
    this.data = song._compiled || (song._compiled = compileSong(song));
    this.stepDur = 60 / song.bpm / 4;
    this.song = song;
    this.bus = this.ctx.createGain(); this.bus.gain.value = this.on ? 1 : 0; this.bus.connect(this.out);
    this.startTime = this.ctx.currentTime + 0.08;
    this.scheduledUntil = 0; // step 単位（通算）
    this.timer = setInterval(() => this.tick(), 40);
    this.tick();
  },
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.bus && this.ctx) {
      const b = this.bus, t = this.ctx.currentTime;
      b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + 0.25);
      setTimeout(() => { try { b.disconnect(); } catch (e) {} }, 400);
    }
    this.bus = null; this.cur = null;
  },
  setOn(on) {
    this.on = on;
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  },
  tick() {
    if (!this.ctx || !this.bus) return;
    const now = this.ctx.currentTime;
    const horizon = Math.floor((now + 0.25 - this.startTime) / this.stepDur);
    const D = this.data;
    while (this.scheduledUntil <= horizon) {
      const abs = this.scheduledUntil;
      const loop = Math.floor(abs / D.steps), s = abs % D.steps;
      const t = this.startTime + abs * this.stepDur;
      for (const ch of ['lead', 'harm', 'bass']) for (const n of D[ch]) if (n.step === s) this.note(ch, n, t);
      for (const n of D.drum) if (n.step === s) this.drum(n.kind, t);
      this.scheduledUntil++;
    }
  },
  note(ch, n, t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const dur = n.len * this.stepDur;
    const song = this.song;
    let vol = 0.08, type = 'square';
    if (ch === 'lead') { vol = song.lead === 'triangle' ? 0.16 : 0.07; type = song.lead === 'pulse' ? 'pulse' : song.lead; }
    if (ch === 'harm') { vol = n.pad ? 0.035 : n.chord ? 0.03 : 0.028; type = n.pad ? 'triangle' : 'square'; }
    if (ch === 'bass') { vol = 0.14; type = 'triangle'; }
    if (type === 'pulse') o.setPeriodicWave(this.pulseWave); else o.type = type;
    o.frequency.setValueAtTime(n.freq, t);
    if (ch === 'lead' && dur > 0.35) { // ビブラート
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = n.freq * 0.006;
      lfo.connect(lg).connect(o.frequency); lfo.start(t + 0.18); lfo.stop(t + dur + 0.05);
    }
    const rel = Math.min(0.06, dur * 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (n.pad ? 0.25 : 0.008));
    g.gain.setValueAtTime(vol * (n.pad ? 1 : 0.75), t + Math.max(0.01, dur - rel));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  drum(kind, t) {
    const c = this.ctx;
    if (kind === 'k') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.16);
    } else {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf;
      f.type = 'highpass'; f.frequency.value = kind === 's' ? 1200 : 7000;
      const len = kind === 's' ? 0.13 : 0.035;
      g.gain.setValueAtTime(kind === 's' ? 0.16 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      src.connect(f).connect(g).connect(this.bus); src.start(t); src.stop(t + len + 0.01);
    }
  },
};
