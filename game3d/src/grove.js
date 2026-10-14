// The chamber of living light (v31 placeGrove data): mushrooms (the front seven are v31's platforms), the great bell,
// fronds, spores, and the life spilling out along the road. The bell's wave of light reads v31's bell.t0.
import * as THREE from 'three';
import { GROUND, addLight, trackGlow } from './core.js';
import { mulberry32 } from './util.js';
import { glowTex, canvasTex, glowShader } from './materials.js';

const COL = [new THREE.Color(120 / 255, 240 / 255, 214 / 255), new THREE.Color(190 / 255, 150 / 255, 255 / 255)];
const AMBER = new THREE.Color(0xffb45a);
const boostAt = (x, t, B) => { const tt = t - B.t0 - Math.abs(x - B.x) / 520; return tt < 0 ? 0 : (1 - Math.exp(-tt * 10)) * Math.exp(-tt / 3.2); };

export function buildGrove(w, D, X, { roof, depth }) {
  const G = w.group, Gd = D.grove, B = Gd.bell, R = mulberry32(9191);
  const capsList = [];
  const gillTex = canvasTex(256, 64, (g, cw, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1a1c'); gr.addColorStop(.32, '#1d3b3c'); gr.addColorStop(.52, '#fff'); gr.addColorStop(.6, '#9aa'); gr.addColorStop(1, '#556'); g.fillStyle = gr; g.fillRect(0, 0, cw, h);
    g.fillStyle = 'rgba(0,0,0,.55)'; for (let x = 0; x < cw; x += 4) g.fillRect(x, h * .58, 2, h * .42);
    const SR = mulberry32(31); for (let i = 0; i < 11; i++) { const sx = SR() * cw, sy = h * (.06 + SR() * .34), sr = 1 + SR() * 2.6; g.fillStyle = `rgba(255,255,255,${.35 + SR() * .4})`; g.beginPath(); g.ellipse(sx, sy, sr * (1.4 - sy / h), sr * .8, 0, 0, Math.PI * 2); g.fill(); }
  }, false);
  gillTex.flipY = false;
  function mushroom(c, z, base = 1) {
    const grp = new THREE.Group(), hue = COL[c.hue], r = c.r, tx = c.x + c.lean * c.h;
    const prof = [[0, r * .42], [r * .45, r * .39], [r * .78, r * .27], [r * .97, r * .07], [r, 0], [r * .9, -r * .07], [r * .55, -r * .1], [r * .12, -r * .05]].map(([a, b]) => new THREE.Vector2(a, b));
    const capMat = new THREE.MeshStandardMaterial({ color: 0x24454c, roughness: .55, emissive: hue.clone(), emissiveMap: gillTex, emissiveIntensity: 1 });
    const cap = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), capMat); cap.position.set(tx, c.h, z); cap.rotation.y = c.ph; grp.add(cap);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(c.x, -6, z), new THREE.Vector3(c.x + c.lean * c.h * .3, c.h * .5, z), new THREE.Vector3(tx, c.h + 2, z));
    const sr = Math.max(3, r * .09), stemMat = new THREE.MeshStandardMaterial({ color: 0x6f8487, roughness: .7, emissive: hue.clone(), emissiveIntensity: .05 });
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, sr, 10, false), stemMat));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(sr * 1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stemMat); foot.scale.y = .6; foot.position.set(c.x, -4, z); grp.add(foot);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hue, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .2 }));
    halo.position.set(tx, c.h - r * .05, z); halo.scale.set(r * 4.5, r * 3, 1); grp.add(halo);
    G.add(grp); const o = { c, x: tx, capMat, stemMat, halo, base }; capsList.push(o); return o;
  }
  Gd.caps.filter(c => !c.back).forEach(c => { const o = mushroom(c, -4); addLight(w, { kind: 'point', x: o.x, y: c.h - 30, z: 110, color: COL[c.hue].getHex(), dist: 620, decay: 1.25, weight: 1.6, I: t => 900 * (.6 + .4 * Math.sin(t * .9 + c.ph)) + 1400 * boostAt(o.x, t, B) }); });
  Gd.caps.filter(c => c.back).forEach((c, i) => mushroom({ ...c, h: c.h * 1.5, r: c.r * 1.5 }, -260 - (i % 4) * 150 - R() * 80, .6));
  [[Gd.a + 240, 400, 170, 0, -820], [Gd.a + 900, 470, 210, 0, -900], [Gd.b - 200, 360, 150, 1, -760]].forEach(([x, h, r, hue, z]) => mushroom({ x, h, r, lean: (R() - .5) * .15, hue, ph: R() * 6 }, z, .6));
  addLight(w, { kind: 'point', x: (Gd.a + Gd.b) / 2, y: 520, z: -300, color: 0x58d8c4, dist: 1800, decay: 1, weight: 3, I: t => 150 * (.7 + boostAt(B.x, t, B) * .4) });

  // small mushrooms (the chamber carpet and the tufts spilling along the road), one instanced draw
  {
    const items = [];
    Gd.small.forEach(m => items.push({ x: m.x, z: 120 - R() * depth(m.x) * .9, h: m.h * 1.3, r: m.r, hue: m.hue, ph: m.ph, dim: 1 }));
    for (let i = 0; i < 190; i++) { const x = Gd.a + R() * (Gd.b - Gd.a); items.push({ x, z: 120 - R() * depth(x) * .9, h: 5 + R() * 22, r: 3 + R() * 9, hue: R() < .7 ? 0 : 1, ph: R() * 6, dim: 1 }); }
    if (Gd.hint) Gd.hint.tufts.forEach(m => items.push({ x: m.x, z: 40 - R() * 320, h: m.h, r: m.r, hue: m.hue, ph: m.ph, dim: m.dim }));
    const stem = new THREE.CylinderGeometry(.09, .12, 1, 5); stem.translate(0, .5, 0);
    const capG = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); capG.scale(1, .5, 1);
    const ga = stem.toNonIndexed(), gb = capG.toNonIndexed(); gb.translate(0, 1, 0);
    const merged = new THREE.BufferGeometry();
    const posA = ga.attributes.position.array, posB = gb.attributes.position.array, pos = new Float32Array(posA.length + posB.length); pos.set(posA); pos.set(posB, posA.length);
    const part = new Float32Array(pos.length / 3); part.fill(1, posA.length / 3);
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('part', new THREE.BufferAttribute(part, 1));
    const mat = trackGlow(glowShader(
      `attribute float part;attribute vec3 iCol;attribute vec2 iPh;varying vec3 vCol;varying float vPart;
       void main(){vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0);float b=boost(wp.x);
       float pul=(0.5+0.45*sin(uTime*1.4+iPh.x)+b*0.7)*iPh.y;vCol=iCol*pul*1.6;vPart=part;
       vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}`,
      `varying vec3 vCol;varying float vPart;void main(){vec3 c=mix(vec3(0.16,0.2,0.2)+vCol*0.08,vCol,vPart);gl_FragColor=vec4(c,1.0);\n#include <fog_fragment>\n}`));
    const im = new THREE.InstancedMesh(merged, mat, items.length), M = new THREE.Matrix4(), cols = new Float32Array(items.length * 3), phs = new Float32Array(items.length * 2);
    items.forEach((m, i) => { M.set(m.r, 0, 0, m.x, 0, m.h, 0, -3, 0, 0, m.r, m.z, 0, 0, 0, 1); im.setMatrixAt(i, M); const c = COL[m.hue]; cols.set([c.r, c.g, c.b], i * 3); phs.set([m.ph, m.dim], i * 2); });
    merged.setAttribute('iCol', new THREE.InstancedBufferAttribute(cols, 3)); merged.setAttribute('iPh', new THREE.InstancedBufferAttribute(phs, 2));
    im.frustumCulled = false; G.add(im); w.waveMats = [mat];
  }

  // fronds hanging from the roof
  const fronds = [];
  {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x1f5a58, roughness: .8, emissive: COL[0], emissiveIntensity: .25 });
    const make = (x, z, len, curl, dim) => {
      const top = roof(x) + 6, pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new THREE.Vector3(curl * 38 * u * u, -len * u, 0)); }
      const curve = new THREE.CatmullRomCurve3(pts), grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 1.6, 5, false), stemMat));
      const lp = []; for (let j = 1; j <= 9; j++) { const u = j / 10, p = curve.getPoint(u), ll = (1 - u) * 16 + 4; lp.push(p.x, p.y, p.z, p.x - ll, p.y - ll * .5, p.z + ll * .3, p.x, p.y, p.z, p.x + ll, p.y - ll * .5, p.z - ll * .3); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      const lm = new THREE.LineBasicMaterial({ color: COL[0], transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false });
      grp.add(new THREE.LineSegments(lg, lm));
      const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: COL[0], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); tip.position.copy(curve.getPoint(1)); tip.scale.set(18, 18, 1); grp.add(tip);
      grp.position.set(x, top, z); G.add(grp); fronds.push({ grp, x, ph: R() * 6, lm, tip, dim });
    };
    Gd.fronds.forEach(f => make(f.x, 100 - R() * depth(f.x) * .9, 80 + f.len * 2.4, f.curl, 1));
    if (Gd.hint) Gd.hint.fronds.forEach(f => make(f.x, 120 - R() * 300, f.len * 1.6 + 10, f.curl, f.dim));
  }

  // spores
  {
    const items = [];
    for (let i = 0; i < 560; i++) { const x = Gd.a + R() * (Gd.b - Gd.a); items.push({ x, u: R(), z: 200 - R() * depth(x) * .95, ph: R() * 6, sp: .015 + R() * .045, s: 1 + R() * 2.2, a: 1 }); }
    if (Gd.hint) Gd.hint.spores.forEach(p => items.push({ x: p.x, u: p.y, z: 150 - R() * 400, ph: p.ph, sp: p.sp, s: 1 + p.s, a: p.dim }));
    const m = trackGlow(glowShader(
      `attribute vec4 aPh;varying float vA;varying float vHue;
       void main(){float x=position.x+sin(uTime*0.5+aPh.x)*14.0;float u=fract(position.y+uTime*aPh.y);float top=mix(380.0,820.0,step(${Gd.a.toFixed(1)},position.x)*step(position.x,${Gd.b.toFixed(1)}));
       vec4 wp=modelMatrix*vec4(x,u*top,position.z,1.0);float b=boost(wp.x);
       vA=(0.5+0.35*sin(uTime*3.0+aPh.x)+b*0.5)*aPh.w*(1.0-u*0.6);vHue=step(2.6,aPh.z);
       vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;gl_PointSize=aPh.z*(1.0+b*0.8)*2.2*projectionMatrix[1][1]*uVH*0.5/(-mvPosition.z);\n#include <fog_vertex>\n}`,
      `varying float vA;varying float vHue;void main(){vec2 d=gl_PointCoord-0.5;float a=smoothstep(0.5,0.0,length(d));vec3 c=mix(vec3(0.47,0.94,0.84),vec3(0.75,0.6,1.0),vHue);gl_FragColor=vec4(c*a*vA,1.0);\n#include <fog_fragment>\n}`,
      { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const n = items.length, pos = new Float32Array(n * 3), ph = new Float32Array(n * 4);
    items.forEach((it, i) => { pos.set([it.x, it.u, it.z], i * 3); ph.set([it.ph, it.sp, it.s, it.a], i * 4); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 4));
    const P = new THREE.Points(g, m); P.frustumCulled = false; G.add(P); w.waveMats.push(m);
  }

  // the great bell: the standing bell-stone, larger and aged
  const bell = {};
  {
    const S = 2.6, shape = new THREE.Shape(); [[-15, 0], [-11, 50], [-2, 56], [10, 52], [14, 0]].forEach(([x, y], i) => i ? shape.lineTo(x * S, y * S) : shape.moveTo(x * S, y * S)); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 34, bevelEnabled: true, bevelThickness: 5, bevelSize: 4, bevelSegments: 3, curveSegments: 1 }); g.translate(0, 0, -17);
    const bw = 30 * S, bh = 56 * S, ox = 15 * S;
    const face = (g2, cw, h, em) => {
      const P = (dx, dy) => [(dx * S + ox) / bw * cw, h - dy * S / bh * h];
      if (!em) {
        g2.fillStyle = '#1e2f3b'; g2.fillRect(0, 0, cw, h);
        for (const [dx, dy, rx, ry, al] of [[-8, 8, 9, 6, .32], [6, 14, 7, 9, .26], [-4, 38, 8, 5, .22], [9, 44, 5, 4, .28], [-10, 26, 4, 7, .2], [2, 2, 14, 3, .4]]) { g2.fillStyle = `rgba(8,16,22,${al})`; g2.beginPath(); g2.ellipse(...P(dx, dy), rx * S / bw * cw, ry * S / bh * h, 0, 0, Math.PI * 2); g2.fill(); }
        for (const [dx, dy, r] of [[-12, 4, 2.2], [-10, 7, 1.4], [-7, 3, 1.8], [11, 5, 1.6], [12, 9, 2], [-9, 47, 1.4], [-6, 49, 1.1], [4, 53, 1.2]]) { g2.fillStyle = 'rgba(118,146,104,.6)'; g2.beginPath(); g2.arc(...P(dx, dy), r * S / bw * cw, 0, Math.PI * 2); g2.fill(); }
      } else { g2.fillStyle = '#000'; g2.fillRect(0, 0, cw, h); }
      const mark = (dx, dy, ww, al) => { g2.fillStyle = em ? `rgba(255,220,170,${al})` : `rgba(230,238,242,${al})`; const [x0, y0] = P(dx, dy + 2); g2.fillRect(x0, y0, ww * S / bw * cw, 2 * S / bh * h); };
      mark(-5, 14, 10, .85); mark(-5, 22, 4, .85); mark(1.5, 22, 3.5, .85); mark(-5, 30, 10, .35);
      const CR = [[[-2, 56], [1, 49], [-2, 43], [2, 35], [-1, 27], [3, 18], [0, 9], [2, 0]], [[2, 35], [7, 31], [9, 25], [13, 22]], [[-1, 27], [-6, 23], [-8, 17], [-12, 14]], [[-11, 50], [-7, 45], [-8, 40]], [[3, 18], [8, 13], [7, 6]]];
      g2.strokeStyle = em ? '#ffc46e' : 'rgba(2,4,6,.95)'; g2.lineWidth = em ? 5 : 7; g2.lineJoin = 'round';
      g2.beginPath(); for (const c of CR) c.forEach(([dx, dy], i) => i ? g2.lineTo(...P(dx, dy)) : g2.moveTo(...P(dx, dy))); g2.stroke();
    };
    const map = canvasTex(256, 480, (g2, cw, h) => face(g2, cw, h, false)), em = canvasTex(256, 480, (g2, cw, h) => face(g2, cw, h, true));
    [map, em].forEach(t => { t.repeat.set(1 / bw, 1 / bh); t.offset.set(ox / bw, 0); });
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: AMBER.clone(), emissiveIntensity: 0, roughness: .85 });
    const mesh = new THREE.Mesh(g, mat); mesh.position.set(B.x, -4, -46); G.add(mesh);
    const rings = []; for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0xf2b25a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); r.position.set(B.x, bh * .55, -40); G.add(r); rings.push(r); }
    const cue = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(32, 32, g2 => { g2.fillStyle = '#e6f0f5'; g2.beginPath(); g2.moveTo(16, 2); g2.lineTo(28, 16); g2.lineTo(16, 30); g2.lineTo(4, 16); g2.closePath(); g2.fill(); }), transparent: true, depthWrite: false }));
    cue.scale.set(12, 12, 1); cue.position.set(B.x, bh + 30, -40); G.add(cue);
    Object.assign(bell, { mat, rings, bh, cue });
    addLight(w, { kind: 'point', x: B.x, y: bh * .6, z: 30, color: 0xffb060, dist: 900, decay: 1.2, weight: 5, I: t => { const el = t - B.t0; return el >= 0 && el < 9 ? Math.exp(-el / 2.4) * 9000 : 0; } });
    addLight(w, { kind: 'point', x: B.x + 120, y: bh * 2, z: 380, color: 0xbfd6e2, dist: 700, decay: 1, weight: 1.2, I: () => 160 });
  }

  w.updates.push((t, o) => {
    for (const c of capsList) {
      const b = boostAt(c.x, t, B), pul = .55 + .45 * Math.sin(t * .9 + c.c.ph);
      c.capMat.emissiveIntensity = (.28 + pul * .32 + b * 1.1) * c.base; c.stemMat.emissiveIntensity = (.05 + b * .2) * c.base; c.halo.material.opacity = (.08 + .08 * pul + b * .22) * c.base;
    }
    for (const f of fronds) { const b = boostAt(f.x, t, B), pul = .5 + .5 * Math.sin(t * 1.1 + f.ph); f.grp.rotation.z = Math.sin(t * .6 + f.ph) * .03 + Math.sin(t * 7 + f.ph) * b * .05; f.lm.opacity = (.22 + pul * .3 + b * .5) * f.dim; f.tip.material.opacity = (.35 + pul * .35 + b * .5) * f.dim; }
    const el = t - B.t0, a = el >= 0 && el < 9 ? Math.exp(-el / 2.4) : 0;
    bell.mat.emissiveIntensity = a * 4.5; bell.mat.color.setRGB(1, 1, 1).lerp(AMBER, Math.min(1, a * .7));
    bell.rings.forEach((r, k) => { const rr = 40 + ((el * 70 + k * 45) % 180); r.scale.set(rr, rr * .8, 1); r.material.opacity = a * (1 - (rr - 40) / 180) * .7; });
    bell.cue.visible = !!o.nearBell; bell.cue.position.y = bell.bh + 30 + Math.sin(t * 3) * 3;
    for (const m of w.waveMats) { m.uniforms.uWaveX.value = B.x; m.uniforms.uWaveT0.value = B.t0; }
  });
}
