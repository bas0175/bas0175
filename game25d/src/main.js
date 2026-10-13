import * as THREE from 'three';
import { GROUND, GROVE, HINT, LIVES, SECTIONS, START_X, BELL, FRONT, WAVE_SPEED } from './world.js';
import { player, keys, input, movePlayer, placeAt, sheetFrame } from './player.js';
import { A, PENTA, SOUND_EVENTS, loadSound, clearSound, testSound, eventForFile } from './audio.js';
import { buildScene } from './scene.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const view = buildScene(renderer, 960, 540);

const state = { mode: 'title', lives: LIVES, fade: 0, fadeTo: 0, flat: false, story: {}, caption: '', captionUntil: 0, dying: null, frame: null };
const LOG = [], T0 = performance.now();
const nowS = () => (performance.now() - T0) / 1000;
function log(event, params = {}) { LOG.push({ t: Math.round(performance.now() - T0), event, params }); }
function fire(name, p = {}) { log(name, p); A.fire(name, p); }

// ---------- layout: keep 16:9, fill the window ----------
function resize() {
  const w = stage.clientWidth, h = Math.round(w * 9 / 16);
  renderer.setSize(w, h, false); view.resize(w, h);
}
new ResizeObserver(resize).observe(stage); resize();

// ---------- dialogue and captions ----------
let dlg = null;
function openDialog(lines, done) { dlg = { lines, i: 0, done }; state.mode = 'dialog'; for (const k in keys) keys[k] = false; showLine(); $('dialog').hidden = false; }
function showLine() { const l = dlg.lines[dlg.i]; $('dlgWho').textContent = l.who || ''; $('dlgText').textContent = l.text; }
function advanceDialog() { if (!dlg) return; A.fire('ui.click'); dlg.i++; if (dlg.i < dlg.lines.length) { showLine(); return; } $('dialog').hidden = true; const d = dlg.done; dlg = null; state.mode = 'play'; d && d(); }
function caption(text, dur = 6) { state.caption = text; state.captionUntil = nowS() + dur; }

function renderLives() { $('hudLives').innerHTML = Array.from({ length: LIVES }, (_, i) => `<span class="pip${i < state.lives ? '' : ' off'}"></span>`).join(''); }

// ---------- the bell ----------
const nearBell = () => Math.abs(player.x + player.w / 2 - BELL.x) < 70 && player.onGround && player.y + player.h > GROUND - 12;
function ringBell(how) {
  const t = nowS(); if (t - BELL.last < 1.2) return; BELL.last = t; BELL.t0 = t;
  fire('grove.bell', { x: BELL.x, how });
  for (const c of FRONT) { const d = Math.abs(c.x - BELL.x) / WAVE_SPEED; setTimeout(() => A.fire('grove.chime', { x: c.x, pitch: PENTA[Math.floor(Math.random() * PENTA.length)] }), d * 1000 + 150); }
}

// ---------- setbacks ----------
function setback(why) {
  if (state.dying) return;
  fire('fall', { why });
  state.dying = { t0: nowS() }; state.fadeTo = 1;
  setTimeout(() => {
    state.lives--; const px = player.x + player.w / 2;
    let at = (SECTIONS.find(s => px >= s.x0 && px < s.x1) || SECTIONS[SECTIONS.length - 1]).at;
    if (state.lives <= 0) { state.lives = LIVES; at = START_X; caption('Back to the start of the road.', 4); }
    log('respawn', { why, to: at }); placeAt(at, -1); view.snap(); renderLives(); state.dying = null; state.fadeTo = 0;
  }, 1100);
}

// ---------- update ----------
let dripT = 2;
function update(dt) {
  const t = nowS(), p = player;
  if (state.mode === 'play' && !state.dying) movePlayer(dt, t, fire, false);
  else if (state.dying) { p.vy = Math.min(p.vy + 1800 * dt, 1400); p.y += p.vy * dt; p.x += p.vx * dt * .5; }
  if (p.y > GROUND + 380) setback('chasm');
  const px = p.x + p.w / 2, inGrove = px > GROVE.a && px < GROVE.b;
  A.listenerX = px; A.setSpace(inGrove ? 'grove' : 'road');
  if (inGrove) {
    if (Math.random() < .012) A.fire('grove.chime', { x: GROVE.a + Math.random() * (GROVE.b - GROVE.a), pitch: PENTA[Math.floor(Math.random() * PENTA.length)] });
    if (state.lives < LIVES) { const was = state.lives; state.lives = LIVES; renderLives(); fire('checkpoint'); log('lives.restore', { from: was, to: LIVES }); if (state.story.groveFound) caption('The living light restores you.', 5); }
    if (!state.story.groveFound && px < GROVE.b - 380) {
      state.story.groveFound = 1; fire('grove.wonder');
      openDialog([{ who: 'You', text: 'So much is growing here. Light, and food. More than all of us could ever eat.' }, { who: 'You', text: 'This might save the community.' }]);
    }
  } else if (px > HINT.a && state.mode === 'play') { dripT -= dt; if (dripT < 0) { dripT = 1.5 + Math.random() * 4; A.fire('drip', { x: px + (Math.random() - .5) * 900 }); } }
  state.nearBell = nearBell();
  state.fade += (state.fadeTo - state.fade) * Math.min(1, dt * 4);
  state.frame = sheetFrame(p, t, state.dying);
  view.update(t, dt, { player: p, frame: state.frame, alpha: state.dying ? Math.max(0, 1 - (t - state.dying.t0) / .6) : 1, inGrove, nearBell: state.nearBell && state.mode === 'play', flat: state.flat, fade: state.fade });
  const hint = state.mode !== 'play' ? '' : state.nearBell ? 'E  strike the bell' : px > START_X - 120 && !state.story.moved ? '←  walk west' : '';
  if (Math.abs(p.vx) > 30) state.story.moved = 1;
  $('hint').textContent = state.captionUntil > t ? state.caption : hint;
}

let last = performance.now();
function frame(ts) {
  const dt = Math.min(.033, (ts - last) / 1000); last = ts;
  if (state.mode !== 'paused' && state.mode !== 'title') update(dt);
  else if (state.mode === 'title') { state.frame = sheetFrame(player, nowS(), null); view.update(nowS(), dt, { player, frame: state.frame, alpha: 1, inGrove: false, nearBell: false, flat: state.flat, fade: 0 }); }
  view.render();
  requestAnimationFrame(frame);
}

// ---------- input ----------
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', KeyW: 'jump', ArrowUp: 'jump' };
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,select,textarea')) return;
  if (state.mode === 'title') { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); start(); } return; }
  if (e.code === 'KeyB') { toggleSounds(); return; }
  if (e.code === 'KeyC') { state.flat = !state.flat; log('camera', { flat: state.flat }); caption(state.flat ? 'Flat view (as in 2D)' : 'Depth view', 2); return; }
  if (e.code === 'KeyN') { A.muted = !A.muted; A.setLevel(); return; }
  if (e.code === 'Escape') { if (!$('sounds').hidden) { toggleSounds(); return; } if (state.mode === 'play') { state.mode = 'paused'; $('pause').hidden = false; } else if (state.mode === 'paused') resume(); return; }
  if (state.mode === 'dialog') { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); if (!e.repeat) advanceDialog(); } return; }
  if (state.mode !== 'play') return;
  if (e.code === 'KeyE' && !e.repeat && state.nearBell) { ringBell('key'); return; }
  const k = KEYMAP[e.code]; if (!k) return; e.preventDefault();
  if (k === 'jump' && !keys.jump) input.jumpQueued = true;
  keys[k] = true;
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function start() { A.init(); $('title').hidden = true; state.mode = 'play'; log('start'); }
function resume() { $('pause').hidden = true; state.mode = 'play'; }
$('go').addEventListener('click', start);
$('resume').addEventListener('click', resume);

// ---------- sounds panel ----------
function toggleSounds() {
  const el = $('sounds'); el.hidden = !el.hidden;
  if (!el.hidden) { A.init(); renderBank(); if (state.mode === 'play') { state.mode = 'paused'; state.soundPause = true; } }
  else if (state.soundPause) { state.soundPause = false; state.mode = 'play'; }
}
function renderBank() {
  $('bankBody').innerHTML = SOUND_EVENTS.map(([n, d, pitched, looped]) => `<tr data-n="${n}"><td><code>${n}</code><div class="d">${d}${pitched ? ' · record on A3 (220 Hz)' : ''}</div></td><td class="st${A.files[n] ? ' on' : ''}">${A.files[n] || (looped && n !== 'ambience.drone' ? 'none' : 'synth')}</td><td class="acts"><label class="btn sm">Load<input type="file" accept="audio/*" hidden></label><button class="btn sm" data-a="test" type="button" aria-label="Play">▶</button><button class="btn sm" data-a="clear" type="button" aria-label="Clear">×</button></td></tr>`).join('');
}
A.onBankChange = () => { if (!$('sounds').hidden) renderBank(); };
$('bankBody').addEventListener('change', async ev => {
  const tr = ev.target.closest('tr'), f = ev.target.files && ev.target.files[0]; if (!tr || !f) return; ev.target.value = '';
  try { await loadSound(tr.dataset.n, f); log('bank.load', { event: tr.dataset.n, file: f.name }); } catch (e) { tr.querySelector('.st').textContent = 'could not decode'; return; }
  renderBank();
});
$('bankBody').addEventListener('click', async ev => {
  const b = ev.target.closest('button'); if (!b) return; const n = b.closest('tr').dataset.n;
  if (b.dataset.a === 'clear') { await clearSound(n); renderBank(); } else testSound(n);
});
$('bankFolder').addEventListener('change', async ev => {
  const files = [...ev.target.files]; ev.target.value = ''; let n = 0;
  for (const f of files) { const name = eventForFile(f.name); if (!name) continue; try { await loadSound(name, f); n++; } catch (e) { } }
  $('bankNote').textContent = `${n} of ${files.length} files matched an event.`; renderBank();
});
$('closeSounds').addEventListener('click', toggleSounds);
$('logBtn').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(LOG, null, 1)], { type: 'application/json' })); a.download = 'pilgrimage-chamber-log.json'; a.click(); });

placeAt(START_X, -1); renderLives();
requestAnimationFrame(frame);
window.__game = { state, player, BELL, ringBell, placeAt: (x, f) => { placeAt(x, f); view.snap(); }, log: LOG, view };   // for testing
