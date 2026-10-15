// window.World3D: the 3D view v31 calls into. v31 passes its own level data; this builds and draws the world behind its canvas.
import * as THREE from 'three';
import { C, init, resize, frame } from './core.js';
import { buildHorizontal } from './horizontal.js';
import { buildVertical } from './vertical.js';

window.World3D = {
  init(canvas, fgCanvas) { try { init(canvas, fgCanvas); return true; } catch (e) { console.error('3D unavailable', e); return false; } },
  ready: () => !!C.renderer,
  load(name, D, X) { if (C.renderer && !C.worlds[name]) buildHorizontal(name, D, X); },
  loadVertical(name, S) { if (C.renderer && !C.worlds[name]) buildVertical(name, S, name); },
  frame, resize,
  // where a crystal appears on screen (v31 coordinates), so v31's cave darkness opens around it
  crystalScreen(world, i) { const w = C.worlds[world], v = w && w.crystals && w.crystals[i]; if (!v || !C.camera) return null; const p = v.clone().project(C.camera); return [(p.x + 1) * 480, (1 - p.y) * 270]; },
  setEnabled(on) { C.enabled = on; },
};
