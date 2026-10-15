// Torven's house: one stone room with a long table running away from the camera, two light orbs on it, and the
// family seated along it (after the concept painting). A fixed view, not a walkable world: v31 runs the scene as
// dialogue and a sung blessing; this draws it. The 2D characters are textured planes here so the table and benches
// can hide their lower halves, which reads as sitting.
import * as THREE from 'three';
import { makeWorld, addLight } from './core.js';
import { mulberry32 } from './util.js';
import { TEX, masonryMat, worldUVBox, glowTex, rockGeo, mergeSafe, rockMat, driftPoints } from './materials.js';
import { trackGlow } from './core.js';

const TABLE = { x0: -36, x1: 36, z0: -190, z1: 30, top: 40 };

export function buildHouse(name, opts) {
  const w = makeWorld(name, y => y), G = w.group, R = mulberry32(77);
  w.cam = { pos: new THREE.Vector3(4, 112, 205), look: new THREE.Vector3(0, 60, -80) }; w.ambient = .32; w.keyI = .12;
  // ---- the room: back wall and two side walls of cut stone, open to the dark above ----
  {
    const lists = [[], []];
    const wall = (len, ht, place) => {
      for (let u = 0; u < len;) {
        const bw = Math.min(len - u, 60 + R() * 110);
        for (let v = 0; v < ht;) { const bh = Math.min(ht - v, 40 + R() * 90); if (bh < 14) break; const g = worldUVBox(bw - 2.5, bh - 2.5, 26 + R() * 10); place(g, u + bw / 2, v + bh / 2); lists[R() < .82 ? 0 : 1].push(g); v += bh; }
        u += bw;
      }
    };
    const ragged = x => 205 + Math.sin(x * .021) * 30 + Math.sin(x * .057 + 1) * 18;   // the broken tops of the walls
    wall(420, 260, (g, u, v) => { if (v > ragged(u)) return g.scale(0, 0, 0); g.translate(-210 + u, v, -270); });
    wall(480, 300, (g, u, v) => { if (v > ragged(u + 300)) return g.scale(0, 0, 0); g.rotateY(Math.PI / 2 - .12); g.translate(-196 - u * .1, v, -270 + u); });
    wall(480, 300, (g, u, v) => { if (v > ragged(u + 900)) return g.scale(0, 0, 0); g.rotateY(-Math.PI / 2 + .12); g.translate(196 + u * .1, v, -270 + u); });
    lists.forEach((l, k) => G.add(new THREE.Mesh(mergeSafe(l), masonryMat(0, k ? 0x8d9aa6 : 0xa9b6c2))));
    // floor of worn slabs
    const fl = [];
    for (let z = -340; z < 420; z += 70) for (let x = -300; x < 300;) { const s = 60 + R() * 70; const g = worldUVBox(s - 3, 6, 67, 200); g.translate(x + s / 2, -3 + R() * 1.5, z + 35); fl.push(g); x += s; }
    G.add(new THREE.Mesh(mergeSafe(fl), new THREE.MeshStandardMaterial({ map: TEX.rock, bumpMap: TEX.rockBump, bumpScale: 2, color: 0x6f7c88, roughness: .92 })));
    // loose stones along the walls
    const st = []; for (let i = 0; i < 18; i++) { const s = 6 + R() * 14, side = R() < .5 ? -1 : 1, g = rockGeo(s * 1.6, s, s * 1.3, 40 + i); g.translate(side * (110 + R() * 70), 0, -250 + R() * 480); st.push(g); }
    G.add(new THREE.Mesh(mergeSafe(st), rockMat));
  }
  // ---- table and benches: monoliths of pale cut stone, the table top cracked ----
  const stone = new THREE.MeshStandardMaterial({ map: TEX.rock, bumpMap: TEX.rockBump, bumpScale: 2.4, color: 0xe6e2da, roughness: .85 });
  const T = TABLE;
  {
    const tb = worldUVBox(T.x1 - T.x0, T.top, T.z1 - T.z0, 260); tb.translate(0, T.top / 2, (T.z0 + T.z1) / 2);
    const benches = [];
    const bench = (x0, x1, z0, z1, h) => { const g = worldUVBox(x1 - x0, h, z1 - z0, 260); g.translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2); benches.push(g); };
    bench(-82, -48, -180, 60, 24); bench(48, 82, -180, 60, 24); bench(-26, 26, -236, -208, 24);
    G.add(new THREE.Mesh(tb, stone), new THREE.Mesh(mergeSafe(benches), stone));
  }
  // ---- the meal: plates and bowls, and in the middle a dish of the chamber's glowing growth ----
  const glowParts = [];
  {
    const ware = new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: .7 }), food = new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: .8 });
    const plate = (x, z, r) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .8, 2.4, 24), ware); p.position.set(x, T.top + 1.2, z); G.add(p);
      const f = new THREE.Mesh(new THREE.SphereGeometry(r * .5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), food); f.scale.y = .35; f.position.set(x, T.top + 2.4, z); G.add(f); };
    plate(-22, 2, 9); plate(-22, -118, 8); plate(22, -22, 9); plate(22, -138, 8); plate(0, -176, 8);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(15, 10, 7, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x6f6252, roughness: .7, side: THREE.DoubleSide }));
    bowl.position.set(0, T.top + 3.5, -70); G.add(bowl);
    const capM = new THREE.MeshStandardMaterial({ color: 0x5fe0c8, emissive: 0x3fd8bc, emissiveIntensity: 1.1, roughness: .5 });
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 3 + (i % 3) * 3.5, c = new THREE.Mesh(new THREE.SphereGeometry(2.2 + R() * 1.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM);
      c.position.set(Math.cos(a) * r, T.top + 5 + R() * 1.5, -70 + Math.sin(a) * r * .8); G.add(c); }
    glowParts.push(capM);
    addLight(w, { kind: 'point', x: 0, y: T.top + 14, z: -70, color: 0x58d8c4, dist: 120, decay: 1.4, weight: 1, I: (t, f) => 25 + 40 * (f.bless ?? 0) });
  }
  // ---- two light orbs on the table, the room's only light ----
  const orbs = [];
  {
    [[-15, -30, 7], [13, -108, 6.5]].forEach(([x, z, r]) => {
      const m = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xfff0d8, emissiveIntensity: 1.1, roughness: .3 });
      const o = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), m); o.position.set(x, T.top + r + 1.5, z); G.add(o);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r * .45, r * .55, 2.5, 16), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: .6 })); base.position.set(x, T.top + 1.2, z); G.add(base);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0d8, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })); halo.position.copy(o.position); halo.scale.set(r * 5, r * 5, 1); G.add(halo);
      orbs.push({ m, halo });
      addLight(w, { kind: 'point', x, y: T.top + r + 4, z, color: 0xffe2bc, dist: 420, decay: 1.6, weight: 3, I: (t, f) => 170 * (f.glow ?? 1) * (.97 + .03 * Math.sin(t * 2.3 + x)) });
    });
    // faint cold light from the opening above, so the walls read
    addLight(w, { kind: 'point', x: 0, y: 420, z: -120, color: 0x7f9fb8, dist: 900, decay: 1.1, weight: .5, I: () => 120 });
    const dust = driftPoints(Array.from({ length: 40 }, () => ({ x: (R() - .5) * 360, u: R(), z: -300 + R() * 360, ph: R() * 6, sp: .004 + R() * .006, s: 1 + R(), a: .5 })), { color: [.95, .9, .8], y0: 0, y1: 260, sway: 10, alpha: .3 });
    trackGlow(dust.material); G.add(dust);
  }
  // ---- the people: v31's sprites on planes, sunk so the benches hide their legs ----
  const figs = (opts.figs || []).map(f => {
    const tex = new THREE.Texture(f.img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, roughness: .95, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .06 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); G.add(mesh);
    const o = { ...f, tex, mesh, i: f.frames.length > 1 ? Math.floor(R() * f.frames.length) : 0, next: 0 };
    setFrame(o, o.i); return o;
  });
  function setFrame(o, i) {
    o.i = i; const [sx, sy, fw, fh, ax] = o.frames[i], iw = o.img.naturalWidth, ih = o.img.naturalHeight, k = o.h / 200;
    o.tex.repeat.set(fw / iw, fh / ih); o.tex.offset.set(sx / iw, 1 - (sy + fh) / ih);
    o.mesh.scale.set(fw * k * (o.flip ? -1 : 1), fh * k, 1);
    const cx = (fw / 2 - ax) * k * (o.flip ? -1 : 1);   // keep the figure's own anchor (its feet) on its spot
    o.mesh.position.set(o.x + cx, o.sink + fh * k / 2, o.z);
  }
  w.updates.push((t, f) => {
    for (const o of figs) if (o.frames.length > 1 && t > o.next) { const n = o.frames.length; if (o.next) setFrame(o, Math.max(0, Math.min(n - 1, o.i + (R() < .5 ? -1 : 1)))); o.next = t + 3.5 + R() * 2.5; }
    const g = f.glow ?? 1;
    orbs.forEach(o => { o.m.emissiveIntensity = .7 + .5 * g; o.halo.material.opacity = .3 + .3 * g; });
    glowParts.forEach(m => { m.emissiveIntensity = .8 + .6 * (f.bless ?? 0) + .15 * Math.sin(t * 1.3); });
  });
  return w;
}
