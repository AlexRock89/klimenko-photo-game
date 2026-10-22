'use strict';
/* ===== Звук: эффекты, голоса, музыка, шум погоды ===== */
let AC = null, AMB = null;
function actx() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) { } }
  return AC;
}
function beep(f, d, type, vol, slide, delay) {
  if (S.mute) return; const a = actx(); if (!a) return;
  try {
    const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + d);
    g.gain.setValueAtTime(vol || 0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.02);
  } catch (e) { }
}
function noise(d, vol, freq, kind, delay) {
  if (S.mute) return; const a = actx(); if (!a) return;
  try {
    const n = Math.max(1, Math.floor(a.sampleRate * d)), b = a.createBuffer(1, n, a.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; f.type = kind || 'highpass'; f.frequency.value = freq || 1000; g.gain.value = vol || 0.1;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + (delay || 0));
  } catch (e) { }
}

/* Голос: пила через два формантных фильтра — получается «а», «о», «э», «и» */
function vox(f0, f1, d, vol, F, delay, vib) {
  if (S.mute) return; const a = actx(); if (!a) return;
  try {
    const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t0); o.frequency.linearRampToValueAtTime(f1, t0 + d);
    if (vib !== 0) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 6; lg.gain.value = f0 * (vib || 0.02); l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + d + 0.05); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.03, d * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    for (const [fr, q, gn] of F) { const bp = a.createBiquadFilter(), gg = a.createGain(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q || 5; gg.gain.value = gn || 4; o.connect(bp); bp.connect(gg); gg.connect(g); }
    g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.05);
  } catch (e) { }
}
const VA = [[800, 6], [1250, 7]], VO = [[450, 6], [850, 7]], VE = [[550, 6], [1900, 8]], VI = [[300, 6], [2300, 8]], VU = [[330, 6], [700, 7]];
/* Шум с полосой и огибающей (шипение, толпа, рык) */
function band(d, vol, freq, q, delay, attack) {
  if (S.mute) return; const a = actx(); if (!a) return;
  try {
    const n = Math.max(1, Math.floor(a.sampleRate * d)), b = a.createBuffer(1, n, a.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const t0 = a.currentTime + (delay || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (attack || d * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t0);
  } catch (e) { }
}
/* Струна (алгоритм Карплюса-Стронга) */
const PLK = {};
function pluck(f, vol, delay) {
  if (S.mute) return; const a = actx(); if (!a) return;
  try {
    const key = Math.round(f); let b = PLK[key];
    if (!b) {
      const sr = a.sampleRate, n = Math.floor(sr * 0.8), p = Math.max(2, Math.round(sr / f)); b = a.createBuffer(1, n, sr); const d = b.getChannelData(0);
      for (let i = 0; i < p + 1; i++) d[i] = Math.random() * 2 - 1;
      for (let i = p + 1; i < n; i++) d[i] = (d[i - p] + d[i - p - 1]) * 0.4985; PLK[key] = b;
    }
    const s = a.createBufferSource(), g = a.createGain(), t0 = a.currentTime + (delay || 0);
    s.buffer = b; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75); s.connect(g); g.connect(a.destination); s.start(t0);
  } catch (e) { }
}

/* Затвор зеркалки: удар зеркала, первая и вторая шторки, потом тихий свист зарядки вспышки */
function shutter() {
  noise(0.07, 0.34, 260, 'lowpass'); beep(150, 0.07, 'sine', 0.14, 55);
  noise(0.02, 0.4, 3200, 'highpass', 0.012); beep(2600, 0.012, 'square', 0.03, 1200, 0.012);
  noise(0.03, 0.3, 2400, 'highpass', 0.075); beep(1900, 0.018, 'square', 0.03, 900, 0.075);
  noise(0.012, 0.18, 4500, 'highpass', 0.1);
  beep(2200, 0.5, 'sine', 0.012, 6800, 0.25);
}

/* Все звуки героев. v — громкость с учётом расстояния до Оксаны */
function playSfx(name, v) {
  switch (name) {
    case 'honk': beep(260, 0.12, 'sawtooth', v, 330); beep(260, 0.14, 'sawtooth', v, 320, 0.15); break;
    case 'laugh': for (let i = 0; i < 5; i++) { vox(380 - i * 14, 300 - i * 14, 0.11, v * 1.3, VA, i * 0.15, 0.05); noise(0.03, v * 0.5, 4000, 'highpass', i * 0.15); } vox(520, 760, 0.28, v * 1.3, VI, 0.8); break;
    case 'camflash': noise(0.05, v * 2.4, 4000, 'highpass'); beep(900, 0.22, 'sine', v * 0.7, 6200); beep(7000, 0.04, 'sine', v * 0.4, 3000, 0.2); noise(0.14, v * 2, 1500, 'highpass', 0.21); beep(1760, 0.2, 'sine', v * 0.6, 0, 0.22); break;
    case 'hello': noise(0.05, v * 0.4, 3000, 'highpass'); vox(210, 270, 0.16, v * 1.4, VE, 0.04); vox(250, 190, 0.28, v * 1.4, VO, 0.22); vox(230, 330, 0.2, v * 1.3, VA, 0.6); break;
    case 'cook': for (let i = 0; i < 16; i++) noise(0.03 + Math.random() * 0.04, v * (0.5 + Math.random() * 0.9), 2500 + Math.random() * 4000, 'highpass', i * 0.07 + Math.random() * 0.03); band(1.2, v * 0.45, 5500, 0.8, 0, 0.1); beep(1250, 0.35, 'sine', v * 0.7, 0, 0.9); beep(1870, 0.3, 'sine', v * 0.4, 0, 0.9); break;
    case 'bell': beep(1568, 0.3, 'sine', v); beep(2093, 0.35, 'sine', v * 0.8, 0, 0.08); break;
    case 'snore': band(0.6, v * 1.0, 420, 0.7, 0, 0.55); [0.65, 0.75, 0.85].forEach((t, i) => vox(60 - i * 3, 46, 0.14, v * 3.2, [[160, 4, 5], [320, 5, 3]], t, 0.04)); band(0.5, v * 0.5, 300, 0.6, 0.65, 0.1); break;
    case 'grumble': vox(120, 80, 0.45, v * 2, VO, 0, 0.03); vox(95, 70, 0.4, v * 2, VU, 0.5, 0.03); break;
    case 'kids': [[1000, 1300], [1250, 1050], [900, 1400], [1150, 950], [1400, 1100]].forEach((p, i) => { vox(p[0], p[1], 0.09, v * 0.9, [[1200, 6, 3], [2700, 8, 2]], i * 0.11, 0.04); }); vox(780, 1500, 0.3, v * 0.9, [[1300, 6, 3], [2800, 8, 2]], 0.65, 0.03); vox(620, 900, 0.12, v * 0.8, VA, 0.35); break;
    case 'kiss': beep(500, 0.06, 'sine', v * 1.2, 1700); noise(0.05, v * 1.2, 1800, 'bandpass'); beep(560, 0.07, 'sine', v * 1.1, 1900, 0.28); noise(0.05, v * 1.0, 2000, 'bandpass', 0.28); vox(420, 620, 0.2, v * 1.2, VU, 0.55); break;
    case 'fanfare': { const n = [[523, 0.13], [523, 0.13], [523, 0.13], [784, 0.45], [659, 0.15], [784, 0.7]]; let t = 0; n.forEach(([f, d]) => { beep(f, d + 0.05, 'sawtooth', v * 0.55, 0, t); beep(f * 1.5, d + 0.05, 'square', v * 0.2, 0, t); beep(f * 0.5, d + 0.05, 'triangle', v * 0.6, 0, t); t += d + 0.04; }); noise(0.5, v * 0.5, 6000, 'highpass', t - 0.8); break; }
    case 'guitar': [[110, 0], [165, 0.03], [220, 0.06], [277, 0.09], [330, 0.12]].forEach(([f, t]) => pluck(f, v * 2.2, t)); [[440, 0.45], [523, 0.65], [659, 0.85], [523, 1.05], [880, 1.25]].forEach(([f, t]) => pluck(f, v * 1.9, t)); break;
    case 'riff': [[330, 0], [392, 0.12], [440, 0.24], [523, 0.36], [440, 0.5], [659, 0.62]].forEach(([f, t]) => pluck(f, v * 2.2, t)); break;
    case 'cheer': band(1.6, v * 1.6, 1400, 0.6, 0, 0.5); band(1.4, v * 1.1, 3000, 0.7, 0.1, 0.5); for (let i = 0; i < 4; i++) vox(380 + Math.random() * 200, 520 + Math.random() * 300, 0.5 + Math.random() * 0.5, v * 1.1, VA, 0.1 + i * 0.12); for (let i = 0; i < 10; i++) noise(0.025, v * 1.4, 1800, 'bandpass', 0.2 + i * 0.12 + Math.random() * 0.06); break;
    case 'roar': vox(220, 120, 0.25, v * 2.2, VA, 0, 0.1); vox(110, 55, 1.1, v * 3, [[260, 3, 6], [520, 3, 4], [900, 4, 2]], 0.1, 0.12); band(1.2, v * 1.4, 350, 0.6, 0.05, 0.1); band(0.9, v * 0.8, 1500, 0.8, 0.1, 0.2); break;
    case 'quack': for (let i = 0; i < 2; i++) { vox(520, 330, 0.13, v * 1.8, [[1100, 3, 4], [2100, 4, 2]], i * 0.2, 0.01); noise(0.05, v * 0.4, 1400, 'bandpass', i * 0.2); } break;
    case 'coo': beep(320, 0.22, 'sine', v * 1.3, 220); break;
    case 'coo2': [0, 0.18, 0.36].forEach((t, i) => vox(340 - i * 20, 290 - i * 20, 0.15, v * 1.5, [[600, 5, 3], [1100, 6, 2]], t, 0.06)); noise(0.3, v * 1.5, 1800, 'highpass'); break;
    case 'flutter': noise(0.25, v * 1.5, 1800); break;
    case 'meow': vox(520, 880, 0.18, v * 1.5, [[900, 5, 3], [2500, 7, 2]], 0); vox(880, 560, 0.34, v * 1.5, [[800, 5, 3], [2300, 7, 2]], 0.17); break;
    case 'bark': for (let i = 0; i < 2; i++) { vox(430, 230, 0.11, v * 2.2, [[700, 4, 4], [1300, 5, 3]], i * 0.18, 0.01); noise(0.06, v * 0.9, 1000, 'bandpass', i * 0.18); } break;
    case 'monkey': for (let i = 0; i < 4; i++) vox(520 + i * 40, 640 + i * 40, 0.13, v * 1.6, VU, i * 0.17, 0.03); vox(900, 1700, 0.45, v * 1.6, VI, 0.75, 0.05); vox(1500, 800, 0.2, v * 1.4, VA, 1.2); break;
    case 'smack': beep(900, 0.05, 'square', v, 1800); break;
    case 'click': noise(0.03, v * 2, 3000); beep(2200, 0.03, 'square', v * 0.6); break;
    case 'chime': beep(1320, 0.18, 'sine', v); beep(1760, 0.22, 'sine', v, 0, 0.1); break;
    case 'whistle': beep(1800, 0.2, 'sine', v, 2400); break;
    case 'oops': beep(600, 0.15, 'triangle', v, 300); break;
  }
}
/* Звуки персонажей: громкость зависит от расстояния до Оксаны (слышно на расстоянии примерно полэкрана) */
const SFXT = {}, SFX_RAD = { fanfare: 330, cheer: 320, roar: 9999, quack: 9999 };
function sfx(name, x, y, rad) {
  if (S.mute || S.mode !== 'play' || S.help) return;
  const now = performance.now(), gap = (name === 'coo2' || name === 'flutter' || name === 'bark' || name === 'monkey' || name === 'meow') ? 350 : 120;
  if (SFXT[name] && now - SFXT[name] < gap) return;
  const R = rad || SFX_RAD[name] || 260, d = dist(x, y, S.pl.x, S.pl.y), k = R > 5000 ? 1 : clamp(1 - d / R, 0, 1);
  if (k < 0.06) return; SFXT[name] = now; playSfx(name, 0.1 * (0.25 + 0.75 * k));
}

/* Шум дождя и ветра */
function setAmbient(type) {
  if (AMB) { try { AMB.s.stop(); } catch (e) { } AMB = null; }
  if (type !== 'rain' && type !== 'wind') return; const a = actx(); if (!a) return;
  try {
    const n = a.sampleRate * 2, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; s.loop = true; f.type = type === 'rain' ? 'highpass' : 'lowpass'; f.frequency.value = type === 'rain' ? 3000 : 600; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(); AMB = { s, g, type, base: type === 'rain' ? 0.05 : 0.08 };
  } catch (e) { AMB = null; }
}
function ambientTick() {
  if (!AMB) return;
  try { AMB.g.gain.value = (S.mute || S.help || S.portrait || S.mode !== 'play') ? 0 : AMB.base * (AMB.type === 'wind' ? 0.7 + 0.3 * Math.sin(S.tt * 0.8) : 1); } catch (e) { }
}

/* Музыка: простой цикл из басса, арпеджио и ритма. Темп растёт вместе со сложностью */
const MUS = { step: 0, next: 0 };
const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
const mhz = n => 440 * Math.pow(2, (n - 69) / 12);
function musicStep(a, t, step, sd) {
  const bar = (step >> 4) % 8, ch = CHORDS[(bar >> 1) % 4], s = step & 15, dl = Math.max(0, t - a.currentTime);
  if (s === 0 || s === 6 || s === 14) beep(mhz(ch[0] - 12), sd * 3, 'triangle', 0.05, 0, dl);
  if (s === 8) beep(mhz(ch[2] - 12), sd * 3, 'triangle', 0.05, 0, dl);
  if (s % 2 === 0) beep(mhz(ch[(s / 2) % 3] + 12 + (bar >= 4 && s % 4 === 2 ? 12 : 0)), sd * 1.6, 'square', 0.016, 0, dl);
  if (s === 0 || s === 8) beep(130, 0.1, 'sine', 0.07, 45, dl);
  if (s % 4 === 2) noise(0.04, 0.015, 7000, 'highpass', dl);
}
function musicLoop() {
  const a = AC; if (!a) return;
  const want = !S.mute && !S.noMusic && !S.help && !S.portrait && (S.mode === 'title' || S.mode === 'play');
  if (!want) { MUS.next = 0; return; }
  const sd = 60 / (120 + (S.stage || 0) * 8) / 4;
  if (!MUS.next || MUS.next < a.currentTime - 0.2) MUS.next = a.currentTime + 0.05;
  while (MUS.next < a.currentTime + 0.3) { musicStep(a, MUS.next, MUS.step++, sd); MUS.next += sd; }
}
setInterval(() => { musicLoop(); ambientTick(); }, 100);
