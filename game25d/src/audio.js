// Sound engine. Every sound is a named event. Each event plays a synthesized placeholder until a recording is
// loaded for it; recordings are kept in the browser (IndexedDB) so they survive a reload.
// To swap: open the Sounds panel (B), load a file per event, or load a whole folder whose file names match the
// event names (grove.bell.wav, step.mp3 ...). Pitched events expect the recording to sound A3 (220 Hz).
import { mulberry32, clamp } from './util.js';

export const PENTA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

export const SOUND_EVENTS = [
  // name, description, pitched, looped
  ['ambience.drone', 'Cave drone (loop; replaces the low A drone)', false, true],
  ['ambience.chamber', 'Chamber bed (loop, fades in inside the chamber)', false, true],
  ['step', 'Footstep', false, false],
  ['jump', 'Jump', false, false],
  ['land', 'Land', false, false],
  ['fall', 'Fall into a chasm', false, false],
  ['checkpoint', 'Lives restored', false, false],
  ['grove.wonder', 'First sight of the chamber', false, false],
  ['grove.bell', 'The great bell', false, false],
  ['grove.chime', 'Mushroom chime (pitched)', true, false],
  ['drip', 'Water drip', false, false],
  ['ui.click', 'Dialogue advance', false, false],
];

const SPACES = { road: { rt: 4.2, send: .4 }, grove: { rt: 6.8, send: .62 } };

export const A = {
  ctx: null, master: null, dry: null, reverbIn: null, convGain: {}, bank: {}, files: {}, noiseBuf: null, vol: .8, muted: false,
  listenerX: 0, onBankChange: null, loops: {},
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(c.destination);
    this.dry = c.createGain(); this.dry.connect(this.master);
    this.reverbIn = c.createGain();
    for (const k in SPACES) { const cv = c.createConvolver(); cv.buffer = this.makeIR(SPACES[k].rt); const g = c.createGain(); g.gain.value = 0; this.reverbIn.connect(cv); cv.connect(g); g.connect(this.master); this.convGain[k] = g; }
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    this.startAmbience(); this.setSpace('road');
    restoreBank().then(() => this.onBankChange && this.onBankChange());
  },
  makeIR(rt) {
    const c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * rt), b = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let y = 0;
      for (let i = 0; i < len; i++) { const t = i / sr; const x = (Math.random() * 2 - 1) * Math.exp(-6.9 * t / rt); const a = 0.08 + 0.85 * Math.exp(-t / (rt * 0.35)); y += a * (x - y); d[i] = y; }
      for (let k = 0; k < 7; k++) { const i = Math.floor(sr * (0.008 + Math.random() * 0.07)); d[i] += (0.2 + Math.random() * 0.3) * (Math.random() < .5 ? -1 : 1); }
    }
    return b;
  },
  space: null,
  setSpace(k) { if (!this.ctx || this.space === k) return; this.space = k; const t = this.ctx.currentTime; for (const s in this.convGain) this.convGain[s].gain.setTargetAtTime(s === k ? SPACES[s].send : 0, t, 0.6); this.setLoopLevel('ambience.chamber', k === 'grove' ? .5 : 0, 1.2); },
  setLevel() { if (!this.master) return; this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.05); },
  pos(x) { const dx = x - this.listenerX; return { pan: clamp(dx / 520, -1, 1), gain: 1 / (1 + Math.abs(dx) / 420) }; },
  out(pan = 0, gain = 1, send = 1) {
    const c = this.ctx, g = c.createGain(); g.gain.value = gain;
    let node = g; if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(this.dry); const s = c.createGain(); s.gain.value = send; node.connect(s); s.connect(this.reverbIn);
    return g;
  },
  noise(dest, t, dur, freq, q = 1, attack = .002, freqEnd = null, type = 'bandpass') {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (freqEnd) f.frequency.linearRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + attack); g.gain.setTargetAtTime(0, t + attack, Math.max(.01, (dur - attack) / 3));
    src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random() * 1.5); src.stop(t + dur + .2);
  },
  tone(dest, t, f, dur, a = 1, attack = .004, fEnd = null) {
    const c = this.ctx, o = c.createOscillator(); o.frequency.setValueAtTime(f, t); if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + attack); g.gain.setTargetAtTime(0, t + attack, dur / 3);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .3);
  },
  // The cave drone: low A (55 Hz), two detuned saws under a slowly breathing lowpass, a sub and a fifth (as in v31).
  startAmbience() {
    const c = this.ctx, t = c.currentTime;
    if (this.drone) { const d = this.drone; d.g.gain.setTargetAtTime(0, t, .3); setTimeout(() => d.stop(), 1500); }
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 4);
    g.connect(this.dry); const s = c.createGain(); s.gain.value = .25; g.connect(s); s.connect(this.reverbIn);
    const nodes = [];
    if (this.bank['ambience.drone']) { const b = c.createBufferSource(); b.buffer = this.bank['ambience.drone']; b.loop = true; b.connect(g); b.start(); nodes.push(b); }
    else {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 230; lp.Q.value = .8; lp.connect(g);
      const lfo = c.createOscillator(); lfo.frequency.value = .045; const lg = c.createGain(); lg.gain.value = 80; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); nodes.push(lfo);
      [[55, 'sawtooth', .05], [55.17, 'sawtooth', .04], [27.5, 'sine', .09], [82.41, 'triangle', .022], [110.25, 'sine', .022], [164.9, 'sine', .014]].forEach(([f, type, a]) => {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(lp); o.start(); nodes.push(o);
      });
    }
    this.drone = { g, stop: () => nodes.forEach(n => { try { n.stop(); } catch (e) { } }) };
    this.startLoop('ambience.chamber', this.space === 'grove' ? .5 : 0);
  },
  // Looped recordings (only when loaded; the chamber has no synth bed, its chimes come from grove.chime).
  startLoop(name, level) {
    const c = this.ctx, old = this.loops[name];
    if (old) { try { old.src.stop(); } catch (e) { } delete this.loops[name]; }
    if (!this.bank[name]) return;
    const src = c.createBufferSource(); src.buffer = this.bank[name]; src.loop = true;
    const g = c.createGain(); g.gain.value = level; src.connect(g); g.connect(this.dry); const s = c.createGain(); s.gain.value = .3; g.connect(s); s.connect(this.reverbIn);
    src.start(); this.loops[name] = { src, g };
  },
  setLoopLevel(name, level, tau = .5) { const l = this.loops[name]; if (l) l.g.gain.setTargetAtTime(level, this.ctx.currentTime, tau); },
  playBank(name, p) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.bank[name];
    if (p.pitch) src.playbackRate.value = p.pitch / 220;
    const { pan, gain } = p.x != null ? this.pos(p.x) : { pan: 0, gain: 1 };
    src.connect(this.out(pan, gain * (p.level ?? 1), p.send ?? 1)); src.start();
  },
  fire(name, p = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.bank[name]) { this.playBank(name, p); return; }
    const fn = SYNTH[name]; if (fn) fn(p, this.ctx.currentTime);
  },
};

// Placeholders, carried over from v31.
export const SYNTH = {
  'ui.click'(p, t) { const o = A.out(0, .16, .25); A.noise(o, t, .018, 3200, 2.5, .001); A.tone(o, t, 1250, .03, .5, .001, 900); },
  'checkpoint'(p, t) { const o = A.out(0, .07, 1.3); A.tone(o, t, PENTA[4] * 2, 1.6, 1, .01); A.tone(o, t + .12, PENTA[0] * 4, 1.8, .7, .01); },
  'fall'(p, t) { const o = A.out(0, .25, 1.2); A.noise(o, t, .9, 900, .7, .02, 120, 'lowpass'); },
  'step'(p, t) { const o = A.out(0, .16, .5); A.noise(o, t, .06, 450 + Math.random() * 350, 1.2); A.tone(o, t, 95, .05, .4, .003, 70); },
  'jump'(p, t) { A.noise(A.out(0, .1, .4), t, .18, 2400, .6, .05); },
  'land'(p, t) { const o = A.out(0, .28, .6); A.tone(o, t, 80, .18, .9, .002, 42); A.noise(o, t, .09, 380, 1); },
  'grove.wonder'(p, t) { const o = A.out(0, .07, 1.6); [0, 2, 4, 6, 4].forEach((d, i) => A.tone(o, t + i * .32, PENTA[d % PENTA.length] * 2, 3.2, .9, .04)); A.tone(o, t, PENTA[0], 5, .6, .6); },
  'grove.bell'(p, t) {
    const { pan, gain } = A.pos(p.x); const o = A.out(pan, gain * .2, 2.2), f = 110;
    [[.5, .5, 10], [1, .8, 8], [1.017, .45, 7], [1.19, .3, 5], [1.5, .35, 6], [1.53, .2, 4], [2, .4, 5], [2.51, .22, 3.5], [2.99, .2, 3], [4.16, .12, 2], [5.43, .07, 1.5]].forEach(([r, a, d]) => A.tone(o, t, f * r, d, a, .006));
    A.noise(o, t, .07, 1800, 2, .001); A.noise(o, t + .01, .9, 420, 6, .004, 260);   // the crack: close partials beat against each other, and a short rattle
  },
  'grove.chime'(p, t) { const { pan, gain } = A.pos(p.x); const o = A.out(pan, gain * .05, 1.5); A.tone(o, t, (p.pitch || 440) * 2, 1.8, 1, .01); },
  'drip'(p, t) { const { pan, gain } = A.pos(p.x); const o = A.out(pan, gain * .1, 1); const f = 900 + Math.random() * 1500; A.tone(o, t, f, .08, 1, .002, f * .55); },
};

// ---------- persistence (IndexedDB) ----------
const DB = 'pilgrimage-sounds', STORE = 'bank';
function db() {
  return new Promise((res, rej) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
}
async function dbDo(mode, fn) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction(STORE, mode), st = tx.objectStore(STORE); const r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }); }
async function restoreBank() {
  try {
    const d = await db(); const all = await new Promise((res, rej) => { const out = {}; const tx = d.transaction(STORE, 'readonly'); const cur = tx.objectStore(STORE).openCursor(); cur.onsuccess = () => { const c = cur.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; cur.onerror = () => rej(cur.error); });
    for (const [name, v] of Object.entries(all)) { try { A.bank[name] = await A.ctx.decodeAudioData(v.bytes.slice(0)); A.files[name] = v.file; } catch (e) { } }
    if (A.bank['ambience.drone'] || A.bank['ambience.chamber']) A.startAmbience();
  } catch (e) { /* storage unavailable: sounds still load for this session */ }
}
export async function loadSound(name, file) {
  A.init(); const bytes = await file.arrayBuffer();
  A.bank[name] = await A.ctx.decodeAudioData(bytes.slice(0)); A.files[name] = file.name;
  try { await dbDo('readwrite', st => st.put({ file: file.name, bytes }, name)); } catch (e) { }
  if (name.startsWith('ambience.')) A.startAmbience();
}
export async function clearSound(name) {
  delete A.bank[name]; delete A.files[name];
  try { await dbDo('readwrite', st => st.delete(name)); } catch (e) { }
  if (name.startsWith('ambience.')) A.startAmbience();
}
export function testSound(name) {
  A.init(); const [, , pitched] = SOUND_EVENTS.find(e => e[0] === name) || [];
  if (name.startsWith('ambience.')) { if (!A.bank[name]) return; const c = A.ctx, s = c.createBufferSource(); s.buffer = A.bank[name]; const g = c.createGain(); g.gain.setValueAtTime(.6, c.currentTime); g.gain.setTargetAtTime(0, c.currentTime + 2.5, .3); s.connect(g); g.connect(A.dry); s.start(); s.stop(c.currentTime + 4); return; }
  A.fire(name, { x: A.listenerX, pitch: pitched ? 220 : undefined });
}
export const eventForFile = fname => { const base = fname.replace(/\.[^.]+$/, ''); return SOUND_EVENTS.find(e => e[0] === base)?.[0]; };
