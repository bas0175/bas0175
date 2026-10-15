// The two vertical scenes (v31 DESCENT and SHAFT): a chasm with rough side walls, ledges of cut rock hanging from
// alternate walls, an arch at the top with a lamp, and the way on. Mapped with Y = -y so v31's camera (camX, shaftCamY) lines up.
import * as THREE from 'three';
import { makeWorld, addLight, trackGlow } from './core.js';
import { makeNoise, mulberry32, smooth, clamp, lerp } from './util.js';
import { mergeSafe, caveRockMat, BUMP, rockMat, glowTex, driftPoints } from './materials.js';
import { loftRock } from './rockgen.js';

export function buildVertical(name, S, kind) {
  const w = makeWorld(name, y => -y), G = w.group, N = makeNoise(kind === 'descent' ? 7373 : 5150), R = mulberry32(kind === 'descent' ? 1 : 2);
  const T = S.top, y0 = S.ceil - 400, y1 = S.H + 300, ZB = -320, ZF = 420;
  // where the walls open: the descent's door to the outpost (top right) and its way on (bottom left); the shaft's way out (top left)
  const openL = y => kind === 'descent' ? (y > S.H - 130 && y < S.H + 10) : (y > T.y - 130 && y < T.y);
  const openR = y => kind === 'descent' && y > T.y - 130 && y < T.y;
  const dAt = (arr, y) => { const i = clamp(Math.floor((y - arr[0].y) / 40), 0, arr.length - 2), a = arr[i], b = arr[i + 1], u = clamp((y - a.y) / 40, 0, 1); return lerp(a.d, b.d, u); };
  const rockCol = (y, k = 1) => { const f = clamp((y - S.ceil) / (S.H - S.ceil), 0, 1); return new THREE.Color().setRGB(.2, .26, .31).lerp(new THREE.Color(.08, .11, .14), f).multiplyScalar(k); };

  // a sheet in (y, z) for a side wall; x is the wall's face
  function sideWall(left) {
    const pos = [], col = [], idx = [], ys = [], zs = [];
    for (let y = y0; y <= y1; y += 14) ys.push(y);
    for (let z = ZB; z <= ZF; z += 24) zs.push(z);
    for (const y of ys) for (const z of zs) {
      const open = left ? openL(y) : openR(y);
      const edge = open ? 1 : 0;
      const d = dAt(left ? S.lw : S.rw, y) * .6, n = N.fbm(y * .006, z * .006, left ? 1 : 5, 4) * 40 + Math.abs(N(y * .02, z * .02, 3)) * -14;
      const face = left ? 0 + d + n * (1 - edge) - edge * 220 : S.W - d - n * (1 - edge) + edge * 220;
      pos.push(face, -y, z); const c = rockCol(y, .9 + .2 * N(y * .01, z * .01, 9)); col.push(c.r, c.g, c.b);
    }
    const nz = zs.length;
    for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < nz - 1; j++) { const a = i * nz + j, b = a + nz; if (left) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // the far wall, and the roof and floor
  function sheetXY(z, k) {
    const pos = [], col = [], idx = [], xs = [], ys = [];
    for (let x = -360; x <= S.W + 360; x += 20) xs.push(x);
    for (let y = y0; y <= y1; y += 20) ys.push(y);
    for (const y of ys) for (const x of xs) { pos.push(x, -y, z + N.fbm(x * .006, y * .006, 2, 4) * 60); const c = rockCol(y, k * (.85 + .3 * N(x * .008, y * .008, 4))); col.push(c.r, c.g, c.b); }
    const nx = xs.length; for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < nx - 1; j++) { const a = i * nx + j, b = a + nx; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function slab(yTop, thick) { const g = new THREE.BoxGeometry(S.W + 800, thick, ZF - ZB + 200, 30, 2, 10), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + N(p.getX(i) * .01, p.getZ(i) * .01, 8) * 30); g.computeVertexNormals(); g.translate(S.W / 2, -yTop - thick / 2, (ZB + ZF) / 2); return g; }
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, bumpMap: BUMP, bumpScale: 2, side: THREE.DoubleSide });
  G.add(new THREE.Mesh(mergeSafe([sideWall(true), sideWall(false), sheetXY(ZB, 1)]), wallMat));
  G.add(new THREE.Mesh(mergeSafe([slab(S.ceil - 300, 300), slab(S.H, 400)]), new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: .95 })));

  // ledges: the outline v31 draws (rough top, ragged underside), extruded back to the far wall
  {
    const list = [];
    S.ledges.forEach((L, i) => {
      const out = [...L.top.map(([dx, dy]) => ({ x: L.x + dx, y: -(L.y + dy), top: true })), ...L.bot.map(([dx, dy]) => ({ x: L.x + dx, y: -(L.y + dy + 12 + 34 * Math.pow(Math.sin(Math.PI * clamp(dx / L.w, 0, 1)), .7)) }))];   // a rounded belly of rock under the ledge (scenery only)
      list.push(loftRock(out, ZB, 6, { amp: 8, bevel: 40, corner: 14, step: 9, seed: 300 + i, colTop: 0xb6c6d0, colSide: 0x5c707e, colBottom: 0x222c34 }));
    });
    G.add(new THREE.Mesh(mergeSafe(list), caveRockMat));
  }
  // loose rock on the floor
  { const list = []; for (let i = 0; i < 26; i++) { const sz = 10 + R() * 40; const g = new THREE.IcosahedronGeometry(sz, 1); g.scale(1 + R(), .5 + R() * .4, 1); g.translate(R() * S.W, -S.H + sz * .3, ZB + R() * (ZF - ZB) * .8); list.push(g); } G.add(new THREE.Mesh(mergeSafe(list), rockMat)); }

  // the arch at the top, its lamp, and light coming through the doorway
  {
    const ax = kind === 'descent' ? S.W : 0, ay = T.y, dir = kind === 'descent' ? -1 : 1;
    const path = new THREE.CurvePath(); const a = new THREE.Vector3(ax + dir * 4, -ay, 0), b = new THREE.Vector3(ax + dir * 4, -(ay - 96), 0), c = new THREE.Vector3(ax + dir * 4, -(ay - 134), 0), d = new THREE.Vector3(ax - dir * 30, -(ay - 136), 0);
    path.add(new THREE.LineCurve3(a, b)); path.add(new THREE.QuadraticBezierCurve3(b, c, d));
    G.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, 6, 6), new THREE.MeshStandardMaterial({ color: 0x7d929c, roughness: .8 })));
    const lx = ax + dir * 30, ly = ay - 92;
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.position.set(lx, -ly, 10); f.scale.set(50, 50, 1); G.add(f);
    w.updates.push(t => { const fl = .85 + .15 * Math.sin(t * 7) * Math.sin(t * 3.1); f.material.opacity = fl; });
    addLight(w, { kind: 'point', x: lx, y: -ly, z: 40, color: 0xffa860, dist: 520, decay: 1.25, weight: 2, I: t => 1100 * (.85 + .15 * Math.sin(t * 7) * Math.sin(t * 3.1)) });
    // the doorway's light: a cold spot reaching down into the chasm
    addLight(w, { kind: 'spot', x: ax - dir * 120, y: -(ay - 110), z: 120, ty: -(ay + 900), color: 0xd4e8f2, dist: 1800, decay: 1.1, angle: .55, weight: 3, I: () => 1500 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xd7ecf6, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(ax - dir * 40, -(ay - 65), -120); G.add(glow);
  }
  if (kind === 'descent') {
    // a cold breath from the way on, low on the left
    addLight(w, { kind: 'point', x: 20, y: -(S.H - 60), z: 60, color: 0x6ec8dc, dist: 600, decay: 1.2, weight: 1.5, I: () => 600 });
  } else {
    // the chamber's growth has spilled into the bottom of the shaft: teal light from the floor
    addLight(w, { kind: 'point', x: S.W / 2, y: -(S.H - 30), z: 80, color: 0x58d8c4, dist: 900, decay: 1.1, weight: 2, I: t => 1400 * (.85 + .15 * Math.sin(t * .9)) });
    const sp = driftPoints(Array.from({ length: 70 }, () => ({ x: R() * S.W, u: R(), z: ZB * .8 + R() * 300, ph: R() * 6, sp: .01 + R() * .02, s: 1.2 + R() * 1.6, a: 1 })), { color: [.47, .94, .84], y0: -S.H, y1: -S.H + 1900, sway: 14, alpha: .55 });
    trackGlow(sp.material); G.add(sp);
  }
  // fill light that follows the camera a little, so the rock never goes fully black near her
  addLight(w, { kind: 'point', x: S.W / 2, y: 0, z: 500, color: 0x8fb0c4, dist: 1400, decay: 1, weight: .2, I: () => 90, follow: true });
  w.updates.push((t, o) => { const L = w.lights.find(l => l.follow); L.y = -(o.camY + 270); });
  return w;
}
