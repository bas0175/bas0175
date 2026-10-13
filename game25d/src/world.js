// Gameplay geometry for the chamber test, in v31 coordinates: x to the right, y down, the floor at GROUND.
// Everything here is flat 2D. The 3D scene only draws it; depth is scenery, never gameplay.
import { mulberry32 } from './util.js';

export const GROUND = 440, CEIL = 70;
export const RUN = 237, JUMP = 760, GRAV = 1800, TERM = 1420;   // movement feel matched to Rootless, as in v31
export const LIVES = 3;

// Layout, west to east. She arrives from the east (walking west), as in cycle 3.
export const WALL = { x: -60, w: 180 };                 // the wall that closes the deep ways (the shaft is cut into its east face)
export const GROVE = { a: 190, b: 1590 };               // the chamber of living light, 1,400 px as in v31
export const HINT = { a: 1590, b: 3490 };               // life spilling from the chamber along the road (1,900 px)
export const CHASM = { a: 2440, b: 2570 };              // one crevasse on the road, so a fall can happen
export const END = 3700;                                // east end of the test (the road continues out of view)
export const START_X = 3420;

export const FLOORS = [[WALL.x, CHASM.a], [CHASM.b, END + 400]];
export const SECTIONS = [                               // respawn points after a fall, as in v31's sections
  { x0: -1e9, x1: CHASM.a, at: CHASM.a - 260 },
  { x0: CHASM.a, x1: 1e9, at: START_X },
];
export const ROCKS = [{ x: 2900, y: GROUND - 74, w: 54, h: 74 }, { x: 2050, y: GROUND - 60, w: 46, h: 60 }];

// The mushrooms, from v31's placeGrove (seed 9091): seven front caps she can stand on, eight behind as scenery.
const R = mulberry32(9091);
const FH = [100, 150, 200, 145, 180, 120, 95];          // front caps, east to west
const z = GROVE.b, a = GROVE.a;
export const FRONT = FH.map((h, i) => ({ x: z - 170 - i * 176 + (R() - .5) * 16, h, r: 50 + h * .16 + R() * 8, lean: (R() - .5) * .12, hue: R() < .65 ? 0 : 1, ph: R() * 6, back: false }));
export const BACK = Array.from({ length: 8 }, () => { const h = 90 + R() * 190; return { x: a + 60 + R() * (z - a - 120), h, r: 22 + h * .22 + R() * 20, lean: (R() - .5) * .25, hue: R() < .65 ? 0 : 1, ph: R() * 6, back: true }; });
export const PLATS = FRONT.map(c => { const tx = c.x + c.lean * c.h, top = GROUND - c.h; return (c.plat = { x: tx - c.r * .82, y: top - c.r * .34, w: c.r * 1.64, mush: true }); });
export const BELL = { x: (FRONT[3].x + FRONT[4].x) / 2, last: -9, t0: -99 };

export const SOLIDS = [
  { x: WALL.x, y: CEIL - 400, w: WALL.w, h: 900 },
  ...FLOORS.map(([x0, x1]) => ({ x: x0, y: GROUND, w: x1 - x0, h: 300 })),
  ...ROCKS,
  { x: END + 260, y: CEIL - 400, w: 60, h: 900 },        // the test ends here (an unseen stop)
];

export const WAVE_SPEED = 520;                          // the bell's light spreads at about 520 px/s
