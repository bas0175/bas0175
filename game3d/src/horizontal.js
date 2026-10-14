// Builds a horizontal world (the east road or the deep ways) in 3D from v31's own level data.
// Gameplay pieces (floors, ledges, pillars, shelves, rocks) sit on the play plane z = 0 exactly where v31 has them;
// everything else (back walls, roof, depth, light) is scenery.
import * as THREE from 'three';
import { C, GROUND, makeWorld, addLight, trackGlow } from './core.js';
import { makeNoise, mulberry32, smooth, lerp, clamp } from './util.js';
import { mergeSafe, glowTex, BUMP, MASONRY, masonryMat, rockMat, darkRockMat, worldUVBox, rockGeo, driftPoints, glowShader, canvasTex, inscribe } from './materials.js';
import { buildGrove } from './grove.js';

const Y = y => GROUND - y;

export function buildHorizontal(name, D, X) {
  const w = makeWorld(name, y => GROUND - y), G = w.group, N = makeNoise(name === 'east' ? 4242 : 2424), R = mulberry32(name === 'east' ? 77 : 88);
  const W = D.W, X0 = -500, X1 = W + 500;
  const caves = D.caves || [], grove = D.grove;
  const caveK = x => { let k = 0; for (const [a, b] of caves) k = Math.max(k, smooth(a - 160, a + 120, x) * (1 - smooth(b - 120, b + 160, x))); return k; };
  const groveK = x => grove ? smooth(grove.a - 120, grove.a + 260, x) * (1 - smooth(grove.b - 220, grove.b + 260, x)) : 0;
  const depth = x => lerp(lerp(560, 330, caveK(x)), 1050, groveK(x));
  const roof = x => lerp(lerp(400, 355, caveK(x)), 900, groveK(x)) + N(x * .004, 3, 1) * 30;
  w.roof = roof; w.depth = depth;

  // ---------- floors and the gaps between them ----------
  const floors = D.floors.slice().sort((a, b) => a[0] - b[0]);
  const gaps = []; for (let i = 0; i < floors.length - 1; i++) if (floors[i + 1][0] > floors[i][1] + 2) gaps.push([floors[i][1], floors[i + 1][0], i]);
  const lipW = z => .1 + .9 * smooth(30, 170, Math.abs(z - 10));
  const lip = (g, z, side) => (side ? g[1] : g[0]) + (N(z * .011, g[2] * 3.1 + side * 7, 7.7) * 60 + N(z * .05, g[2] * 1.3 + side, 2.2) * 12) * lipW(z);
  const gapsNear = x => gaps.filter(g => x > g[0] - 120 && x < g[1] + 120);
  const isFloorX = x => floors.some(([a, b]) => x >= a && x <= b);

  // ---------- the cave shell: floor toward the camera, back wall, roof ----------
  {
    const xs = []; for (let x = X0; x <= X1; x += 18) xs.push(x);
    for (const g of gaps) for (let x = g[0] - 90; x <= g[1] + 90; x += 6) xs.push(x);
    xs.sort((a, b) => a - b);
    const ROWS = 84, pos = [], col = [], uv = [], idx = [];
    const tmpN = new THREE.Vector2();
    for (const x of xs) {
      const Dd = depth(x), Hh = roof(x), F = 520, ck = caveK(x);
      const pts = [[F, 0], [140, 0], [0, 0], [-.35 * Dd, 0], [-.62 * Dd, .015 * Hh], [-.86 * Dd, .1 * Hh], [-1 * Dd, .38 * Hh], [-.97 * Dd, .68 * Hh], [-.78 * Dd, .92 * Hh], [-.4 * Dd, 1.0 * Hh], [.1 * Dd, .99 * Hh], [F + 200, .93 * Hh]];
      const P = new THREE.CatmullRomCurve3(pts.map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'centripetal').getSpacedPoints(ROWS - 1);
      const near = gapsNear(x); let acc = 0;
      for (let j = 0; j < ROWS; j++) {
        const p = P[j], q = P[Math.min(ROWS - 1, j + 1)], o = P[Math.max(0, j - 1)];
        tmpN.set(-(q.z - o.z), q.y - o.y).normalize();
        const isFloor = p.y < 2;
        const strip = isFloor ? smooth(70, 260, Math.abs(p.z - 10)) : 1;
        const amp = isFloor ? 24 * strip : lerp(90, 60, p.y / Hh) * (1 + ck * .4);
        const d = N.fbm(x * .0035, p.y * .004, p.z * .004, 5) * amp * 2 + (isFloor ? 0 : Math.abs(N(x * .011, p.y * .011, p.z * .011)) * -40);
        let y = p.y + tmpN.y * d, z = p.z + tmpN.x * d, dep = 0;
        if (isFloor) {
          let dIn = -1e9; for (const g of near) dIn = Math.max(dIn, Math.min(x - lip(g, z, 0), lip(g, z, 1) - x));
          if (dIn > 0) { dep = Math.min(1400, dIn * 7 + dIn * dIn * .09); y = -dep + N(x * .03, z * .03, dep * .01) * 40 * smooth(0, 25, dIn); z += N(x * .02, dep * .01, 5) * 30 * smooth(0, 40, dIn); }
          else if (dIn > -28) y -= (1 + dIn / 28) * 14 * Math.abs(N(x * .08, z * .08, 1));
          else y = Math.max(y, -40);
        }
        if (j > 0) acc += Math.hypot(P[j].y - P[j - 1].y, P[j].z - P[j - 1].z);
        pos.push(x, y, z); uv.push(x / 240, acc / 240);
        const shade = .55 + .45 * clamp(.5 + N.fbm(x * .002 + 50, p.y * .002, p.z * .002, 3), 0, 1);
        const c = new THREE.Color().setRGB(.16 * shade, .205 * shade, .25 * shade).multiplyScalar(1 - ck * .3);
        if (isFloor) c.multiplyScalar(.82 * Math.exp(-dep / 380));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ROWS - 1; j++) { const a = i * ROWS + j, b = a + ROWS; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    G.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, bumpMap: BUMP, bumpScale: 2.2, side: THREE.DoubleSide })));
  }

  // ---------- masonry back walls where people have built (outside the caves and the chamber) ----------
  {
    const geos = [[], [], []];
    for (let x = X0; x < X1;) {
      const cw = 80 + R() * 200, cx = x + cw / 2; x += cw;
      if (caveK(cx) > .4 || groveK(cx) > .05) continue;
      const zb = -.58 * depth(cx) - R() * 20, top = roof(cx) * .97;
      for (let y = 0; y < top;) {
        const bh = Math.min(top - y, 50 + R() * 170); if (bh < 20) break;
        const g = worldUVBox(cw - 3, bh - 3, 40 + R() * 30); g.translate(cx, y + bh / 2, zb + (R() - .5) * 14);
        const k = R() < .22 && bh > 60 && cw > 90 ? 2 : R() < .5 ? 0 : 1; geos[k].push(g); y += bh;
      }
    }
    geos.forEach((list, k) => { if (list.length) G.add(new THREE.Mesh(mergeSafe(list), masonryMat(k, 0xc3d2dc))); });
  }

  // ---------- gameplay pieces on the play plane ----------
  const mergeAdd = (list, mat) => { if (list.length) { const m = new THREE.Mesh(mergeSafe(list), mat); G.add(m); return m; } };
  // ledges: cut stone blocks
  {
    const list = D.ledges.map(l => { const g = worldUVBox(l.w, l.h, 200); g.translate(l.x + l.w / 2, Y(l.y + l.h / 2), -70); return g; });
    mergeAdd(list, masonryMat(1, 0xb8c6d0));
  }
  // pillars: old columns of stacked drums on the road, raw rock in the caves
  {
    const cols = [], rocks = [];
    D.pillars.forEach((k, i) => {
      const r = mulberry32(4000 + i), top = Y(k.y), bot = -760, cx = k.x + k.w / 2;
      if (caveK(cx) > .5) { const g = new THREE.BoxGeometry(k.w, top - bot, k.w * 1.5, 4, 20, 4), p = g.attributes.position, nn = makeNoise(500 + i);
        for (let v = 0; v < p.count; v++) { const yy = p.getY(v); if (yy > (top - bot) / 2 - 1) continue; p.setX(v, p.getX(v) * (1 + nn(p.getX(v) * .03, yy * .02, 1) * .25)); p.setZ(v, p.getZ(v) * (1 + nn(2, yy * .02, p.getZ(v) * .03) * .3)); }
        g.computeVertexNormals(); g.translate(cx, (top + bot) / 2, -20); rocks.push(g); return; }
      for (let y = top; y > bot;) {
        const dh = 40 + r() * 34, first = y === top;
        const g = new THREE.CylinderGeometry(k.w / 2 - (first ? 1 : r() * 2), k.w / 2 - r() * 2, first ? dh : dh - 1.5, 14, 1); g.rotateY(r() * 6);
        if (first) { const p = g.attributes.position; for (let v = 0; v < p.count; v++) if (p.getY(v) > 0 && r() < .45) p.setY(v, p.getY(v) - 3 - r() * 8); g.computeVertexNormals(); }   // a broken top
        g.translate(cx + (r() - .5) * 3, y - dh / 2, -10 + (r() - .5) * 4); cols.push(g); y -= dh;
      }
    });
    mergeAdd(cols, masonryMat(1, 0xd4e0e8)); mergeAdd(rocks, rockMat);
  }
  // shelves jutting from the chasm walls
  {
    const list = D.plats.filter(q => !q.mush).map(q => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(q.w, 0); s.lineTo(q.w - 8, -14); s.lineTo(q.w * .55, -24); s.lineTo(10, -15); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 150, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 1 }); g.translate(q.x, Y(q.y), -110); return g;
    });
    mergeAdd(list, masonryMat(0, 0xb5c4ce));
  }
  // boulders, rock slabs, stalagmites, low roofs, waystones
  {
    const rocks = [], dark = [];
    D.rocks.forEach((k, i) => { const g = rockGeo(k.w * .55, k.h, 46, 30 + i); g.translate(k.x + k.w / 2, Y(k.y + k.h), 0); rocks.push(g); });
    D.caverocks.forEach((k, i) => { const g = new THREE.BoxGeometry(k.w, k.h, 240, Math.ceil(k.w / 30), Math.ceil(k.h / 30), 6), p = g.attributes.position, nn = makeNoise(600 + i);
      for (let v = 0; v < p.count; v++) { const x = p.getX(v), yy = p.getY(v), z = p.getZ(v); if (yy > k.h / 2 - 1 && Math.abs(z) < 120) continue; p.setZ(v, z + nn(x * .02, yy * .02, 3) * 30); p.setY(v, yy + (yy < 0 ? nn(x * .03, 5, z * .03) * 10 : 0)); }
      g.computeVertexNormals(); g.translate(k.x + k.w / 2, Y(k.y + k.h / 2), -80); rocks.push(g); });
    D.stalag.forEach((k, i) => { const pts = []; for (let j = 0; j <= 10; j++) { const u = j / 10; pts.push(new THREE.Vector2((k.w / 2 + 5) * Math.pow(1 - u, .8) * (1 + .1 * Math.sin(u * 9 + i)), u * k.h)); }
      const g = new THREE.LatheGeometry(pts, 10); g.translate(k.x + k.w / 2, Y(k.y + k.h), -4); rocks.push(g); });
    D.lowceil.forEach((k, i) => { const top = roof(k.x + k.w / 2) + 30, bot = Y(k.y + k.h), g = new THREE.BoxGeometry(k.w + 40, top - bot, 380, Math.ceil(k.w / 16), 4, 8), p = g.attributes.position, nn = makeNoise(700 + i);
      for (let v = 0; v < p.count; v++) { const yy = p.getY(v); if (yy < 0) p.setY(v, yy - Math.abs(nn(p.getX(v) * .05, 1, p.getZ(v) * .05)) * 16); }
      g.computeVertexNormals(); g.translate(k.x + k.w / 2, (top + bot) / 2, -40); dark.push(g); });
    (D.waystones || []).forEach((ws, i) => [[0, 0, 22, 14], [3, -12, 16, 12], [6, -22, 10, 10]].forEach(([dx, dy, ww, hh], j) => { const g = rockGeo(ww / 2, hh, ww / 2, 800 + i * 3 + j, false); g.scale(1, .5, 1); g.translate(ws.x + dx, Y(GROUND + dy - hh / 2), -30); rocks.push(g); }));
    mergeAdd(rocks, rockMat); mergeAdd(dark, darkRockMat);
  }
  // end walls (the world stops in rock)
  { const a = rockGeo(300, 900, 900, 91, false); a.translate(-320, 200, -200); const b = rockGeo(300, 900, 900, 92, false); b.translate(W + 300, 200, -200); mergeAdd([a, b], darkRockMat); }

  // ---------- scenery: stalactites, boulders and stalagmites further back ----------
  {
    const cone = new THREE.ConeGeometry(1, 1, 7, 3); cone.translate(0, .5, 0);
    const n = Math.round((X1 - X0) / 18), im = new THREE.InstancedMesh(cone, rockMat, n), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(); let k = 0;
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    for (let i = 0; i < n; i++) {
      const x = X0 + R() * (X1 - X0), up = R() < .4, Dd = depth(x), ck = caveK(x);
      if (groveK(x) > .3 || (!up && R() > .45 + ck * .5)) continue;
      const z = up ? -200 - R() * Dd * .6 : 60 - R() * Dd * .8;
      if (up && !isFloorX(x)) continue;
      const h = up ? 30 + R() * 130 : (40 + R() * 150) * (1 + ck * .6), r = h * (.12 + R() * .1);
      if (up) { p.set(x, -4, z); q.identity(); } else { p.set(x, roof(x) * (z < -.6 * Dd ? .93 : 1) + 12, z); q.copy(flip); }
      s.set(r, h, r); M.compose(p, q, s); im.setMatrixAt(k++, M);
    }
    im.count = k; G.add(im);
    const boul = [];
    for (let i = 0; i < (X1 - X0) / 90; i++) { const x = X0 + R() * (X1 - X0); if (!isFloorX(x) || groveK(x) > .3) continue; const sz = 18 + R() * 60, g = rockGeo(sz * (1 + R()), sz * (.6 + R()), sz, 900 + i); g.translate(x, -5, -150 - R() * depth(x) * .6); boul.push(g); }
    mergeAdd(boul, rockMat);
  }

  // ---------- east: the outpost, the gates and the Assembly ----------
  if (X.east) {
    const E = X.east, list = [], ins = [];
    // the outpost's dwelling wall, with arched doorways
    { const g = worldUVBox(1400, 400, 60); g.translate(500, 200, -200); list.push(g);
      const arch = new THREE.MeshBasicMaterial({ color: 0x020507 }), frameMat = masonryMat(1, 0xc8d4dc);
      E.arches.forEach(([x, aw]) => { const s = new THREE.Shape(), hh = 110, top = hh + aw * .45; s.moveTo(0, 0); s.lineTo(0, hh); s.quadraticCurveTo(0, top, aw / 2, top); s.quadraticCurveTo(aw, top, aw, hh); s.lineTo(aw, 0); s.closePath();
        const m = new THREE.Mesh(new THREE.ShapeGeometry(s), arch); m.position.set(x, 0, -168); G.add(m);
        const path = new THREE.CurvePath(); path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, hh, 0))); path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, hh, 0), new THREE.Vector3(0, top, 0), new THREE.Vector3(aw / 2, top, 0))); path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(aw / 2, top, 0), new THREE.Vector3(aw, top, 0), new THREE.Vector3(aw, hh, 0))); path.add(new THREE.LineCurve3(new THREE.Vector3(aw, hh, 0), new THREE.Vector3(aw, 0, 0)));
        const f = new THREE.Mesh(new THREE.TubeGeometry(path, 40, 7, 6), frameMat); f.position.set(x, 0, -166); G.add(f); });
      const sh = worldUVBox(80, 10, 50); sh.translate(E.shelfX, Y(334), -40); list.push(sh); }
    // inscription walls behind the bell gate and the Assembly gate
    const panelTex = (wpx) => canvasTex(1024, 192, (g, cw, ch) => { g.fillStyle = '#18303f'; g.fillRect(0, 0, cw, ch); g.strokeStyle = '#4a6c84'; g.lineWidth = 4; g.strokeRect(4, 4, cw - 8, ch - 8); g.strokeRect(18, 18, cw - 36, ch - 36); inscribe(g, mulberry32(wpx | 0), 36, 36, cw - 72, ch - 72, 'rgba(170,208,228,.4)'); });
    E.walls.forEach(([x, ww]) => { const g = worldUVBox(ww, 420, 50); g.translate(x + ww / 2, 210, -175); list.push(g);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ww - 20, 140), new THREE.MeshStandardMaterial({ map: panelTex(x), roughness: .85, emissive: 0x6fa0bc, emissiveMap: panelTex(x + 1), emissiveIntensity: .08 })); m.position.set(x + ww / 2, Y(171), -148); G.add(m); });
    if (E.gateInscr) { const [x, ww] = E.gateInscr; const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, 150), new THREE.MeshStandardMaterial({ map: panelTex(x + 7), roughness: .85 })); m.position.set(x + ww / 2, Y(345), -148); G.add(m); }
    // lintels over the doors, the altar
    E.lintels.forEach(([cx, y], i) => { const top = roof(cx) + 40, g = worldUVBox(90, top - Y(y), 150); g.translate(cx, (top + Y(y)) / 2, -40); ins.push(g); });
    { const a = E.altar, g = worldUVBox(a.w, a.h, 70); g.translate(a.x + a.w / 2 - a.w / 2, Y(a.y + a.h / 2), -10); ins.push(g); }
    mergeAdd(list, masonryMat(0, 0xaebdc8)); mergeAdd(ins, masonryMat(2, 0xc0ccd5));
  }

  // ---------- lamps: stone posts with a lamp in a niche ----------
  {
    const posts = [], flames = [];
    D.lamps.forEach((lx, i) => {
      const g = worldUVBox(26, 112, 26); g.translate(lx, 56, -70); posts.push(g);
      const h = worldUVBox(30, 34, 30); h.translate(lx, 128, -70); posts.push(h);
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.position.set(lx, Y(318), -50); f.scale.set(46, 46, 1); G.add(f); flames.push({ f, i });
      const fl = (t) => .85 + .15 * Math.sin(t * 3.1 + i * 1.7) * Math.sin(t * 1.3 + i);
      addLight(w, { kind: 'point', x: lx, y: Y(318), z: -10, color: 0xffa860, dist: 380, decay: 1.35, weight: 1.4, I: t => 420 * fl(t) });
    });
    if (posts.length) mergeAdd(posts, masonryMat(1, 0x8fa0ac));
    w.updates.push(t => flames.forEach(({ f, i }) => { const k = .85 + .15 * Math.sin(t * 3.1 + i * 1.7) * Math.sin(t * 1.3 + i); f.material.opacity = k; f.scale.setScalar(40 + 8 * k); }));
  }

  // ---------- light wells: openings in the roof, cold light to the floor ----------
  {
    const beamMat = () => new THREE.ShaderMaterial({ uniforms: { uI: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv;uniform float uI,uTime;void main(){float e=smoothstep(0.0,0.5,vUv.x)*smoothstep(1.0,0.5,vUv.x);float v=mix(0.3,1.0,pow(vUv.y,0.8));float f=0.85+0.15*sin(uTime*0.7+vUv.x*9.0);gl_FragColor=vec4(vec3(0.66,0.82,0.9)*e*e*v*f*0.11*uI,1.0);}' });
    (D.shafts || []).forEach((s, i) => {
      const top = roof(s.x) + 10, z = -60, m = beamMat(), cyl = new THREE.CylinderGeometry(s.top / 2, s.bot / 2 * 1.2, top, 24, 1, true); cyl.translate(0, top / 2, 0);
      const beam = new THREE.Mesh(cyl, m); beam.position.set(s.x, 0, z); G.add(beam);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xe4f6fc, transparent: true })); hole.rotation.x = Math.PI / 2; hole.scale.set(s.top / 2, s.top / 2 * (s.id === 'oculus' ? 1 : .7), 1); hole.position.set(s.x, top - 2, z); G.add(hole);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xd8f0fa, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const pr = s.id === 'oculus' ? (X.east ? X.east.circle.r * 2.2 : s.bot * 1.5) : s.bot * 1.4; pool.rotation.x = -Math.PI / 2; pool.scale.set(pr, pr * .8, 1); pool.position.set(s.x, 1.5, z + 30); G.add(pool);
      const motes = driftPoints(Array.from({ length: 22 }, () => ({ x: s.x + (R() - .5) * s.bot * .6, u: R(), z: z + (R() - .5) * s.bot * .4, ph: R() * 6, sp: .015 + R() * .02, s: 1.4 + R() * 1.4, a: .7 })), { color: [.85, .94, .98], y0: 0, y1: top, sway: 6, rise: false, alpha: .55 });
      trackGlow(motes.material); G.add(motes);
      w.updates.push((t, o) => { const I = o.shaftI ? o.shaftI[i] ?? s.base : s.base; m.uniforms.uI.value = I; m.uniforms.uTime.value = t; hole.material.opacity = .45 + .55 * I; pool.material.opacity = .55 * I; motes.material.uniforms.uAlpha.value = .55 * I; });
      addLight(w, { kind: 'spot', x: s.x, y: top, z, ty: 0, color: 0xcfe3ee, dist: top * 2.2, decay: 1.5, angle: Math.atan2(s.bot * .9, top), weight: 1, I: (t, o) => 3.2e4 * (o.shaftI ? o.shaftI[i] ?? s.base : s.base) });
    });
  }

  // ---------- waterfalls, from the roof to the floor or down into a chasm ----------
  {
    const fallMat = () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;varying vec3 vP;void main(){vUv=uv;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec2 vUv;varying vec3 vP;uniform float uTime;float h(float x){return fract(sin(x*91.3)*47453.1);}
        void main(){float e=smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x);float col=floor(vUv.x*14.0);float sp=1.4+h(col)*0.8;
        float s=fract(vP.y*0.006+uTime*sp+h(col+3.0));float streak=smoothstep(0.0,0.08,s)*smoothstep(0.35,0.1,s);
        float a=e*(0.10+0.55*streak*(0.5+0.5*h(col+7.0)));gl_FragColor=vec4(vec3(0.72,0.88,0.95)*a,1.0);}` });
    (D.waterfalls || []).forEach(wf => {
      const cx = wf.x + wf.w / 2, onFloor = isFloorX(cx), top = roof(cx) + 10, bot = onFloor ? 0 : -900, m = fallMat();
      const g = new THREE.PlaneGeometry(wf.w * 1.15, top - bot, 1, 20); g.translate(cx, (top + bot) / 2, -24);
      const curtain = new THREE.Mesh(g, m); G.add(curtain);
      const back = curtain.clone(); back.material = m; back.position.z = -10; back.scale.x = .8; G.add(back);
      const mist = driftPoints(Array.from({ length: 28 }, () => ({ x: cx + (R() - .5) * wf.w * 2.2, u: R(), z: -24 + (R() - .5) * 70, ph: R() * 6, sp: .05 + R() * .05, s: 12 + R() * 16, a: .5 })), { color: [.7, .85, .92], y0: onFloor ? -6 : -500, y1: onFloor ? 60 : 40, sway: 20, alpha: .13 });
      trackGlow(mist.material); G.add(mist);
      w.updates.push(t => { m.uniforms.uTime.value = t; });
      addLight(w, { kind: 'point', x: cx, y: onFloor ? 40 : 120, z: 40, color: 0x9cc8dc, dist: 380, decay: 1.4, weight: .4, I: () => 260 });
    });
  }

  // ---------- crystals in the caves ----------
  {
    const cg = []; const glow = [];
    (D.crystals || []).forEach((c, i) => {
      const r = mulberry32(1200 + i), z = -40 - r() * 60;
      [[-4, 0, 6], [0, -3, 9], [4, 1, 5]].forEach(([dx, dy, hh]) => { const g = new THREE.ConeGeometry(2.6, hh * 2.2, 5); g.rotateZ((r() - .5) * .6); g.translate(c.x + dx * 1.3, Y(c.y + dy) + hh * .6, z); cg.push(g); });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x96e1f0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set(c.x, Y(c.y), z + 4); s.scale.set(60, 60, 1); G.add(s); glow.push({ s, i });
      addLight(w, { kind: 'point', x: c.x, y: Y(c.y), z: z + 30, color: 0x8fdcef, dist: 260, decay: 1.5, weight: .5, I: t => 160 * (.6 + .3 * Math.sin(t * 1.6 + i)) });
    });
    if (cg.length) G.add(new THREE.Mesh(mergeSafe(cg), new THREE.MeshStandardMaterial({ color: 0xbff0fa, emissive: 0x7fd8ee, emissiveIntensity: 1.2, roughness: .3 })));
    w.updates.push(t => glow.forEach(({ s, i }) => { s.material.opacity = .45 + .3 * Math.sin(t * 1.6 + i); }));
  }

  // ---------- mist low in the chasms, dust in the air ----------
  {
    const items = [];
    for (const g of gaps) for (let k = 0; k < Math.max(4, (g[1] - g[0]) / 12); k++) items.push({ x: g[0] + 10 + R() * (g[1] - g[0] - 20), u: R(), z: 300 - R() * 600, ph: R() * 6, sp: .02 + R() * .03, s: 10 + R() * 18, a: .6 });
    if (items.length) { const m = driftPoints(items, { color: [.45, .6, .72], y0: -620, y1: 10, sway: 16, alpha: .12 }); trackGlow(m.material); G.add(m); }
    const dust = []; for (let k = 0; k < (X1 - X0) / 14; k++) { const x = X0 + R() * (X1 - X0); if (groveK(x) > .3) continue; dust.push({ x, u: R(), z: 200 - R() * depth(x) * .8, ph: R() * 6, sp: .004 + R() * .006, s: 1 + R() * 1.2, a: .35 }); }
    const dm = driftPoints(dust, { color: [.7, .8, .88], y0: 0, y1: 380, sway: 18, alpha: .3 }); trackGlow(dm.material); G.add(dm);
  }

  if (grove) buildGrove(w, D, X, { roof, depth, R });
  return w;
}
