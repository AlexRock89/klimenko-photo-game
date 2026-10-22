'use strict';
/* ===== Звук: эффекты, голоса, музыка, шум погоды ===== */
let AC = null, AMB = null;
function actx() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); setTimeout(loadSamples, 0); } catch (e) { AC = null; } }
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

/* ===== Записанные звуки: декодируются один раз, играются после вспышки ===== */
const SMP = {}; let SMP_LOADING = false;
function loadSamples() {
  if (SMP_LOADING || typeof SND_DATA === 'undefined') return; const a = actx(); if (!a) return; SMP_LOADING = true;
  for (const k in SND_DATA) {
    try {
      const bin = atob(SND_DATA[k]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      a.decodeAudioData(u.buffer, b => { SMP[k] = b; }, () => { });
    } catch (e) { }
  }
}
/* name — запись, v — громкость, rate — скорость (тон), delay — задержка в секундах */
function play(name, v, rate, delay) {
  if (S.mute) return; const a = actx(); if (!a) return; const b = SMP[name]; if (!b) return;
  try {
    const t0 = a.currentTime + (delay || 0), s = a.createBufferSource(), g = a.createGain();
    s.buffer = b; s.playbackRate.value = (rate || 1) * (0.97 + Math.random() * 0.06); g.gain.value = v;
    s.connect(g); g.connect(a.destination); s.start(t0);
  } catch (e) { }
}
/* Затвор: настоящий щелчок затвора с вспышкой; пока записи не загрузились — короткий щелчок */
function shutter() {
  if (SMP.shot) { play('shot', 0.34, 1, 0); return; }
  noise(0.07, 0.3, 260, 'lowpass'); beep(150, 0.07, 'sine', 0.12, 55); noise(0.02, 0.35, 3200, 'highpass', 0.012);
}
/* Реакции героев на съёмку: [запись, громкость, тон]. Играют после вспышки */
const REACT = {
  clown: [['laugh', 0.5, 1]], fashion: [['flash', 0.55, 1]], hipster: [['clink', 0.6, 1]], barista: [['cook', 0.5, 1]],
  grandpa: [['snore', 0.45, 1]], family: [['kids', 0.5, 1]], couple: [['kiss', 0.6, 1]], wedding: [['fanfare', 0.42, 1]],
  jogger: [['cheer', 0.45, 1]], busker: [['guitar', 0.5, 1]]
};
const SFXN = {
  bark: [['bark', 0.5, 1]], meow: [['meow', 0.5, 1]], monkey: [['monkey', 0.5, 1]], coo2: [['coo', 0.55, 1]],
  roar: [['roar', 0.75, 1]], quack: [['quack', 0.6, 1]], click: [['click', 0.5, 1]]
};
function reactClient(id, x, y, delay) {
  const r = REACT[id]; if (!r) return; for (const [n, v, rt] of r) play(n, v * sfxVol(x, y, 360), rt, delay);
}
/* громкость по расстоянию до Оксаны: рядом — полная, далеко — тише */
function sfxVol(x, y, R) { const d = dist(x, y, S.pl.x, S.pl.y); return 0.35 + 0.65 * clamp(1 - d / R, 0, 1); }
/* Совместимость со старыми вызовами sfx(): играет только те звуки, что связаны со вспышкой */
function sfx(name, x, y, rad) {
  if (S.mute || S.mode !== 'play' || S.help) return; const r = SFXN[name]; if (!r) return;
  if (name === 'click') { const dd = dist(x, y, S.pl.x, S.pl.y); if (dd > 340) return; }
  const gap = (name === 'coo2' || name === 'bark' || name === 'monkey' || name === 'meow') ? 350 : 120, now = performance.now();
  SFXT[name] = SFXT[name] || 0; if (now - SFXT[name] < gap) return; SFXT[name] = now;
  const dl = S.sfxDelay || 0; for (const [n, v, rt] of r) play(n, v * sfxVol(x, y, 9999 > (rad || 0) ? 420 : 9999), rt, dl);
}
const SFXT = {};

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
