// window.World3D: the 3D view v31 calls into. v31 passes its own level data; this builds and draws the world behind its canvas.
import { C, init, resize, frame } from './core.js';
import { buildHorizontal } from './horizontal.js';
import { buildVertical } from './vertical.js';

window.World3D = {
  init(canvas, fgCanvas) { try { init(canvas, fgCanvas); return true; } catch (e) { console.error('3D unavailable', e); return false; } },
  ready: () => !!C.renderer,
  load(name, D, X) { if (C.renderer && !C.worlds[name]) buildHorizontal(name, D, X); },
  loadVertical(name, S) { if (C.renderer && !C.worlds[name]) buildVertical(name, S, name); },
  frame, resize,
  setEnabled(on) { C.enabled = on; },
};
