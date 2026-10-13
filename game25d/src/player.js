// Veyra's movement and animation frame choice, ported from v31 (movePlayer, sheetFrame) without changes to the feel.
import { RUN, JUMP, GRAV, TERM, SOLIDS, PLATS, GROUND } from './world.js';
import SHEET from '../assets/veyra-sheet.json';
import RIG from '../assets/veyra-rig.json';

export const keys = { left: false, right: false, jump: false };
export const input = { jumpQueued: false };
export const player = { x: 0, y: 0, w: 26, h: 84, vx: 0, vy: 0, onGround: true, face: -1, stepT: 0, walkT: 0, buf: 0, coyote: 0, cut: false, takeoffAt: -9, landAt: -9, idleI: null, idleNext: 0, descAt: null, lastStep: null };

const STEP_T = .18, RUN_PER_STEP = 2;   // the 4-frame run: two frames per footstep, footfalls on frames 1 and 3
const overlap = (p, s) => p.x < s.x + s.w && p.x + p.w > s.x && p.y < s.y + s.h && p.y + p.h > s.y;
const runFrame = p => Math.floor(p.walkT * RUN_PER_STEP / STEP_T);

export function placeAt(x, face = -1) {
  Object.assign(player, { x, y: GROUND - player.h, vx: 0, vy: 0, onGround: true, face, buf: 0, coyote: 0, idleI: null });
}

export function movePlayer(dt, t, fire, frozen) {
  const p = player, ax = frozen ? 0 : (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (ax) p.face = ax;
  p.vx += (ax * RUN - p.vx) * Math.min(1, dt * (p.onGround ? 16 : 7));
  if (input.jumpQueued) { p.buf = .13; input.jumpQueued = false; }
  p.buf -= dt; p.coyote -= dt;
  if (!frozen && p.buf > 0 && (p.onGround || p.coyote > 0)) { p.vy = -JUMP; p.onGround = false; p.coyote = 0; p.buf = 0; p.cut = false; p.takeoffAt = t; fire('jump', {}); }
  if (!p.onGround && !keys.jump && p.vy < -250 && !p.cut) { p.vy *= .55; p.cut = true; }   // let go early for a short hop
  p.vy = Math.min(p.vy + GRAV * dt, TERM);
  const was = p.onGround, prevFeet = p.y + p.h;
  p.x += p.vx * dt;
  for (const s of SOLIDS) if (overlap(p, s)) {
    const rise = p.y + p.h - s.y;
    if (was && rise > 0 && rise <= 40) { p.y = s.y - p.h; continue; }
    if (p.vx > 0) p.x = s.x - p.w; else if (p.vx < 0) p.x = s.x + s.w; p.vx = 0;
  }
  p.onGround = false; const vy = p.vy;
  p.y += p.vy * dt;
  for (const s of SOLIDS) if (overlap(p, s)) { if (p.vy >= 0) { p.y = s.y - p.h; p.vy = 0; p.onGround = true; } else { p.y = s.y + s.h; p.vy = 0; } }
  if (p.vy >= 0) for (const q of PLATS) { const feet = p.y + p.h; if (prevFeet <= q.y + .5 && feet >= q.y && p.x + p.w > q.x + 2 && p.x < q.x + q.w - 2) { p.y = q.y - p.h; p.vy = 0; p.onGround = true; } }
  if (was && !p.onGround && p.vy >= 0) p.coyote = .1;   // a moment of grace after walking off an edge
  if (!was && p.onGround) { p.landAt = t; if (vy > 280) fire('land', { v: Math.round(vy) }); }
  if (p.onGround && Math.abs(p.vx) > 30) {
    p.walkT += dt * Math.abs(p.vx) / RUN;
    if (Math.abs(p.vx) >= 175) { const st = Math.floor(runFrame(p) / RUN_PER_STEP); if (p.lastStep == null && p.stepT < .25) p.lastStep = st; if (st !== p.lastStep) { p.lastStep = st; fire('step', {}); } p.stepT = 0; }
    else { p.lastStep = null; p.stepT += dt; if (p.stepT > .36) { p.stepT = 0; fire('step', {}); } }
  } else { p.stepT = .3; p.lastStep = null; }
}

function groundBelow(p, d) {
  const x = p.x + p.w / 2, f = p.y + p.h;
  return SOLIDS.some(s => x >= s.x && x <= s.x + s.w && s.y >= f - 2 && s.y <= f + d) || PLATS.some(q => x >= q.x && x <= q.x + q.w && q.y >= f - 2 && q.y <= f + d);
}

// Returns [sx, sy, w, h, cx, footY] from the sheet (frames are drawn at half size, as in v31).
export function sheetFrame(p, t, dying) {
  const M = SHEET, since = v => t - v;
  if (!p.onGround || Math.abs(p.vx) > 30) p.idleI = null;
  if (dying) { const H = M.hit, k = (t - dying.t0) / .12; return H[Math.min(H.length - 1, Math.floor(k))]; }
  if (!p.onGround) {
    const J = M.jump; let i;
    if (p.descAt != null && p.descAt < p.takeoffAt) p.descAt = null;
    if (p.descAt == null && ((!keys.jump && p.vy > -200) || (p.vy > 150 && groundBelow(p, 70)))) p.descAt = t;
    const tk = since(p.takeoffAt);
    if (p.descAt == null) { if (tk < .05) i = 0; else if (tk < .11) i = 1; else if (p.vy < -450) i = 2; else if (p.vy < -250) i = 3; else if (p.vy < -100) i = 4; else if (p.vy < 0) i = 5; else i = 6; }
    else i = Math.min(9, 7 + Math.floor((t - p.descAt) / .1));
    return J[i];
  }
  p.descAt = null;
  if (since(p.landAt) < .08) return M.jump[10];
  if (since(p.landAt) < .2) return M.jump[11];
  const sp = Math.abs(p.vx);
  if (sp > 30) { if (sp < 175) return M.walk[Math.floor(p.walkT * 20) % M.walk.length]; return M.run4[runFrame(p) % M.run4.length]; }
  const n = M.idle.length;
  if (p.idleI == null) { p.idleI = Math.floor(Math.random() * n); p.idleNext = t + 4.5 + Math.random(); }
  else if (t > p.idleNext) { p.idleI = Math.max(0, Math.min(n - 1, p.idleI + (Math.random() < .5 ? -1 : 1))); p.idleNext = t + 4.5 + Math.random(); }
  return M.idle[p.idleI];
}

// Frames for the rigged 3D Veyra (rendered side-on): idle 12, run 12 (one cycle = two footsteps), jump 7, land 3.
export function rigFrame(p, t, dying) {
  const M = RIG;
  if (dying) return M.land[0];
  if (!p.onGround) {
    const tk = t - p.takeoffAt, v = p.vy;
    const i = tk < .06 ? 0 : v < -500 ? 1 : v < -250 ? 2 : v < -40 ? 3 : v < 200 ? 4 : v < 520 ? 5 : 6;
    return M.jump[i];
  }
  if (t - p.landAt < .07) return M.land[0];
  if (t - p.landAt < .16) return M.land[1];
  const sp = Math.abs(p.vx);
  if (sp > 30) return M.run[Math.floor(p.walkT / (2 * STEP_T / 12)) % 12];
  const n = M.idle.length, k = Math.floor(t * 8) % (2 * n - 2);   // breathe back and forth
  return M.idle[k < n ? k : 2 * n - 2 - k];
}
