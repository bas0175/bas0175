// The 3D view. It reads the 2D game state and draws it; nothing here changes gameplay.
// Gameplay (x, y-down) maps to 3D as X = x, Y = GROUND - y, with the play plane at Z = 0 and the camera at +Z.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GROUND, WALL, GROVE, HINT, CHASM, END, FRONT, BACK, BELL, WAVE_SPEED, SOLIDS, PLATS } from './world.js';
import { mulberry32, makeNoise, smooth, lerp, clamp } from './util.js';
import SHEET_URL from '../assets/veyra-sheet.png';

const GROVE_COL = [new THREE.Color(120 / 255, 240 / 255, 214 / 255), new THREE.Color(190 / 255, 150 / 255, 255 / 255)];
const AMBER = new THREE.Color(0xffb45a);
const X0 = WALL.x - 260, X1 = END + 900;

// How "chamber" a given x is (0 on the road, 1 inside), used to open the cave up around the grove.
const chamberK = x => smooth(GROVE.a - 120, GROVE.a + 260, x) * (1 - smooth(GROVE.b - 220, GROVE.b + 260, x));
// The cave's cross-section at x: depth of the back wall and height of the roof.
const caveD = x => lerp(420, 1050, chamberK(x));
const caveH = x => lerp(430, 960, chamberK(x));
export const roofY = x => caveH(x);

// Light wave from the bell, as in v31: each thing brightens as the wave reaches it, then fades over a few seconds.
export function boost(x, t) { const tt = t - BELL.t0 - Math.abs(x - BELL.x) / WAVE_SPEED; return tt < 0 ? 0 : (1 - Math.exp(-tt * 10)) * Math.exp(-tt / 3.2); }

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const glowTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });

// Stone detail: a tileable bump map so the rock reads as rock up close.
function stoneBump(seed) {
  const N = makeNoise(seed);
  return canvasTex(256, 256, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w * Math.PI * 2, v = y / h * Math.PI * 2;   // wrap on a torus so it tiles
      const n = N.fbm(Math.cos(u) * 2 + 9, Math.sin(u) * 2 + Math.cos(v) * 2, Math.sin(v) * 2, 5);
      const cr = Math.abs(N(Math.cos(u) * 5, Math.sin(u) * 5 + Math.cos(v) * 5, Math.sin(v) * 5)) < .04 ? -.35 : 0;   // hairline fissures
      const val = clamp(128 + (n + cr) * 220, 0, 255), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = val; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, false);
}

const fogUniforms = THREE.UniformsLib.fog;
function glowShader(vertexBody, fragmentBody, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([fogUniforms, { uTime: { value: 0 }, uWaveX: { value: BELL.x }, uWaveT0: { value: -99 }, uVH: { value: 540 } }, extra.uniforms || {}]),
    vertexShader: `#include <common>\n#include <fog_pars_vertex>\nuniform float uTime,uWaveX,uWaveT0,uVH;\nfloat boost(float x){float tt=uTime-uWaveT0-abs(x-uWaveX)/${WAVE_SPEED.toFixed(1)};return tt<0.0?0.0:(1.0-exp(-tt*10.0))*exp(-tt/3.2);}\n${vertexBody}`,
    fragmentShader: `#include <common>\n#include <fog_pars_fragment>\n${fragmentBody}`,
    fog: true, transparent: !!extra.transparent, depthWrite: extra.depthWrite ?? true, blending: extra.blending ?? THREE.NormalBlending,
  });
}

export function buildScene(renderer, W, H) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080c);
  scene.fog = new THREE.Fog(0x05080c, 900, 3200);
  const camera = new THREE.PerspectiveCamera(38, W / H, 10, 40000);
  const N = makeNoise(4242), R = mulberry32(777);
  const animated = [];   // {update(t)}
  const glowMats = [];   // ShaderMaterials that need time and wave uniforms

  // ---------- the cave shell ----------
  // One sheet swept along x: floor from the camera side to the back, up the back wall, over the roof.
  {
    const xs = []; for (let x = X0; x <= X1; x += 14) xs.push(x);
    [CHASM.a - 2, CHASM.a + 2, CHASM.b - 2, CHASM.b + 2].forEach(x => xs.push(x)); xs.sort((a, b) => a - b);
    const ROWS = 90, pos = [], col = [], uv = [], idx = [];
    const prof = x => {
      const D = caveD(x), Hh = caveH(x), F = 520;
      const pts = [[F, 0], [140, 0], [0, 0], [-.35 * D, 0], [-.62 * D, .015 * Hh], [-.86 * D, .1 * Hh], [-1 * D, .38 * Hh], [-.97 * D, .68 * Hh], [-.78 * D, .92 * Hh], [-.4 * D, 1.0 * Hh], [.1 * D, .99 * Hh], [F + 200, .9 * Hh]];
      const curve = new THREE.CatmullRomCurve3(pts.map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'centripetal');
      return curve.getSpacedPoints(ROWS - 1);
    };
    const tmpN = new THREE.Vector2();
    xs.forEach((x, i) => {
      const P = prof(x), inChasm = x > CHASM.a && x < CHASM.b;
      let acc = 0;
      for (let j = 0; j < ROWS; j++) {
        const p = P[j], q = P[Math.min(ROWS - 1, j + 1)], o = P[Math.max(0, j - 1)];
        tmpN.set(-(q.z - o.z), q.y - o.y).normalize();   // inward normal in (y, z)
        const isFloor = p.y < 2;
        // keep the strip she walks on flat; roughen everything else, walls most
        const strip = isFloor ? smooth(70, 260, Math.abs(p.z - 10)) : 1;
        const amp = isFloor ? 26 * strip : lerp(90, 60, p.y / caveH(x));
        let d = N.fbm(x * .0035, p.y * .004, p.z * .004, 5) * amp * 2 + (isFloor ? 0 : Math.abs(N(x * .011, p.y * .011, p.z * .011)) * -40);
        let y = p.y + tmpN.y * d, z = p.z + tmpN.x * d;
        if (isFloor && inChasm) y = -1100;
        if (isFloor && !inChasm) y = Math.max(isFloor ? y : y, -40);
        if (j > 0) acc += Math.hypot(P[j].y - P[j - 1].y, P[j].z - P[j - 1].z);
        pos.push(x, y, z); uv.push(x / 240, acc / 240);
        const shade = .55 + .45 * clamp(.5 + N.fbm(x * .002 + 50, p.y * .002, p.z * .002, 3), 0, 1);
        const c = new THREE.Color().setRGB(.16 * shade, .205 * shade, .25 * shade);
        if (isFloor) c.multiplyScalar(.82);
        col.push(c.r, c.g, c.b);
      }
    });
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ROWS - 1; j++) { const a = i * ROWS + j, b = a + ROWS; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const bump = stoneBump(11); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, metalness: 0, bumpMap: bump, bumpScale: 2.2, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(g, m));
  }

  // ---------- the wall at the west end (the shaft is cut into its east face) ----------
  {
    const g = new THREE.BoxGeometry(WALL.w + 300, 1400, 2000, 24, 40, 40); g.translate(WALL.x + WALL.w - (WALL.w + 300) / 2, 600, -300);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (x > WALL.x + WALL.w - 2) { const k = smooth(-120, 60, z) < 1 ? 1 : 1; p.setX(i, x + N.fbm(y * .006, z * .006, 3, 4) * 70 * k * (z > 60 ? .3 : 1) - (Math.abs(z - 10) < 60 && y < 600 ? 0 : 0)); } }
    g.computeVertexNormals();
    const bump = stoneBump(12); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(4, 4);
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1f2a33, roughness: .95, bumpMap: bump, bumpScale: 5 })));
    // the shaft mouth: a dark cleft with a lamp far above
    const cleft = new THREE.Mesh(new THREE.PlaneGeometry(70, 520), new THREE.MeshBasicMaterial({ color: 0x010203 }));
    cleft.position.set(WALL.x + WALL.w + 6, 260, -80); cleft.rotation.y = Math.PI / 2; scene.add(cleft);
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    lamp.position.set(WALL.x + WALL.w + 10, 560, -60); lamp.scale.set(70, 70, 1); scene.add(lamp);
    const ll = new THREE.PointLight(0xffb070, 3000, 420, 1.4); ll.position.set(WALL.x + WALL.w + 40, 540, -40); scene.add(ll);
  }

  // ---------- rocks: road obstacles, scattered boulders, stalagmites and stalactites ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: .92, flatShading: true });
  function rock(w, h, d, seed) {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, n = makeNoise(seed);
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 1 + n(v.x * 1.7, v.y * 1.7, v.z * 1.7) * .35; p.setXYZ(i, v.x * w * k, Math.max(v.y, -.2) * h * k, v.z * d * k); }
    g.computeVertexNormals(); return new THREE.Mesh(g, rockMat);
  }
  SOLIDS.filter(s => s.h < 120).forEach((s, i) => { const m = rock(s.w * .6, s.h, 40, 30 + i); m.position.set(s.x + s.w / 2, 0, 0); scene.add(m); });
  for (let i = 0; i < 60; i++) {
    const x = X0 + 300 + R() * (X1 - X0 - 400); if (x > CHASM.a - 60 && x < CHASM.b + 60) continue;
    const z = -150 - R() * (caveD(x) * .7), s = 20 + R() * 70, m = rock(s * (1 + R()), s * (.6 + R()), s, 100 + i); m.position.set(x, -5, z); scene.add(m);
  }
  {
    const cone = new THREE.ConeGeometry(1, 1, 7, 4, false); cone.translate(0, .5, 0);
    const stal = new THREE.InstancedMesh(cone, rockMat, 220), M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < 220; i++) {
      const x = X0 + 200 + R() * (X1 - X0 - 300), up = R() < .45, D = caveD(x), Hh = caveH(x);
      if (x > CHASM.a - 40 && x < CHASM.b + 40) continue;
      const z = up ? -260 - R() * D * .65 : -40 - R() * (D * .8);
      if (up && Math.abs(z) < 200) continue;
      const h = up ? 30 + R() * 140 : 40 + R() * 160, r = h * (.12 + R() * .1);
      if (up) { ps.set(x, -4, z); q.identity(); } else { ps.set(x, Hh * (z < -.6 * D ? .95 : 1.0) + 10, z); q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); }
      sc.set(r, h, r); M.compose(ps, q, sc); stal.setMatrixAt(k++, M);
    }
    stal.count = k; scene.add(stal);
  }

  // ---------- light wells on the road: cold light through cracks in the roof ----------
  const wellMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;uniform float uTime;void main(){float e=smoothstep(0.0,0.5,vUv.x)*smoothstep(1.0,0.5,vUv.x);float v=pow(vUv.y,0.7);float f=0.85+0.15*sin(uTime*0.7+vUv.x*9.0);gl_FragColor=vec4(vec3(0.62,0.78,0.86)*e*e*v*f*0.07,1.0);}',
  });
  [[2180, -220], [3080, -300], [1010, -420]].forEach(([x, z]) => {
    const top = caveH(x) + 20, cyl = new THREE.CylinderGeometry(30, 95, top, 24, 1, true); cyl.translate(0, top / 2, 0);
    const m = new THREE.Mesh(cyl, wellMat); m.position.set(x, 0, z); scene.add(m);
    const sl = new THREE.SpotLight(0xcfe3ee, 2.6e4, top * 2.2, .42, .7, 1.6); sl.position.set(x, top, z); sl.target.position.set(x, 0, z); scene.add(sl, sl.target);
  });
  animated.push({ update: t => { wellMat.uniforms.uTime.value = t; } });

  // ---------- the chamber's mushrooms ----------
  const gillTex = canvasTex(256, 64, (g, w, h) => {
    // lathe UVs: x runs around the cap, y runs from the crown (top) to the centre underneath
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1a1c'); gr.addColorStop(.32, '#1d3b3c'); gr.addColorStop(.52, '#fff'); gr.addColorStop(.6, '#9aa'); gr.addColorStop(1, '#556'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.55)'; for (let x = 0; x < w; x += 4) g.fillRect(x, h * .58, 2, h * .42);       // gills underneath
    g.fillStyle = '#fff'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc((i + .5) * w / 18, h * (.2 + (i % 3) * .06), 2.2, 0, Math.PI * 2); g.fill(); }   // the bright spots on the crown
  }, false);
  const caps = [];
  function mushroom(c, z) {
    const grp = new THREE.Group(), hue = GROVE_COL[c.hue], r = c.r, tx = c.x + c.lean * c.h;
    const prof = [[0, r * .42], [r * .45, r * .39], [r * .78, r * .27], [r * .97, r * .07], [r, 0], [r * .9, -r * .07], [r * .55, -r * .1], [r * .12, -r * .05]].map(([a, b]) => new THREE.Vector2(a, b));
    const capMat = new THREE.MeshStandardMaterial({ color: 0x24454c, roughness: .55, emissive: hue.clone(), emissiveMap: gillTex, emissiveIntensity: 1 });
    const cap = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), capMat); cap.position.set(tx, c.h, z); cap.rotation.z = -c.lean * .6; grp.add(cap);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(c.x, -6, z), new THREE.Vector3(c.x + c.lean * c.h * .3, c.h * .5, z), new THREE.Vector3(tx, c.h + 2, z));
    const sr = Math.max(3, r * .09), stemMat = new THREE.MeshStandardMaterial({ color: 0x6f8487, roughness: .7, emissive: hue.clone(), emissiveIntensity: .05 });
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, sr, 10, false), stemMat));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(sr * 1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stemMat); foot.scale.y = .6; foot.position.set(c.x, -4, z); grp.add(foot);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hue, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .4 }));
    halo.position.set(tx, c.h - r * .05, z); halo.scale.set(r * 4.5, r * 3, 1); grp.add(halo);
    scene.add(grp);
    const o = { c, x: tx, capMat, stemMat, halo, base: c.back ? .55 : 1 };
    caps.push(o); return o;
  }
  FRONT.forEach(c => { const o = mushroom(c, -4); const L = new THREE.PointLight(GROVE_COL[c.hue], 0, 620, 1.25); L.position.set(o.x, c.h - 30, 110); scene.add(L); o.light = L; });
  BACK.forEach((c, i) => mushroom({ ...c, h: c.h * 1.5, r: c.r * 1.5 }, -260 - (i % 4) * 150 - R() * 80));
  // giant ones far back, and dark out-of-focus caps in the foreground
  [[GROVE.a + 240, 400, 170, 0, -820], [GROVE.a + 900, 470, 210, 0, -900], [GROVE.b - 200, 360, 150, 1, -760]].forEach(([x, h, r, hue, z]) => mushroom({ x, h, r, lean: (R() - .5) * .15, hue, ph: R() * 6, back: true }, z));
  const fill = new THREE.PointLight(0x58d8c4, 0, 1800, 1.0); fill.position.set((GROVE.a + GROVE.b) / 2, 520, -300); scene.add(fill);

  // small mushrooms (the floor carpet in the chamber and the tufts spilling out along the road), one instanced draw
  {
    const items = [];
    for (let i = 0; i < 260; i++) { const x = GROVE.a + R() * (GROVE.b - GROVE.a), z = 120 - R() * (caveD(x) * .9); items.push({ x, z, h: 5 + R() * 22, r: 3 + R() * 9, hue: R() < .7 ? 0 : 1, ph: R() * 6, dim: 1 }); }
    for (let x = HINT.a + 30; x < HINT.b; x += 20 + R() * 46) {
      const d = (x - HINT.a) / (HINT.b - HINT.a); if (R() > .95 * Math.pow(1 - d, 1.8) + .06) continue; if (x > CHASM.a - 20 && x < CHASM.b + 20) continue;
      const n = 1 + Math.floor(R() * (d < .35 ? 4 : 2)); for (let i = 0; i < n; i++) items.push({ x: x + (R() - .5) * 20, z: 60 - R() * 360, h: 3 + R() * (10 - 5 * d), r: 2.2 + R() * (4.6 - 2 * d), hue: R() < .8 ? 0 : 1, ph: R() * 6, dim: .5 + .5 * (1 - d) });
    }
    const stem = new THREE.CylinderGeometry(.09, .12, 1, 5); stem.translate(0, .5, 0);
    const capG = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); capG.scale(1, .5, 1);
    const part = (g, v) => g.setAttribute('part', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(v), 1));
    part(stem, 0); part(capG, 1);
    // merge by hand (cap sits on top of a unit-height stem; scaled per instance)
    const merged = new THREE.BufferGeometry(), ga = stem.toNonIndexed(), gb = capG.toNonIndexed(); gb.translate(0, 1, 0);
    ['position', 'part'].forEach(k => { const a = ga.attributes[k].array, b = gb.attributes[k].array, c = new Float32Array(a.length + b.length); c.set(a); c.set(b, a.length); merged.setAttribute(k, new THREE.BufferAttribute(c, ga.attributes[k].itemSize)); });
    const mat = glowShader(
      `attribute float part;attribute vec3 iCol;attribute vec2 iPh;varying vec3 vCol;varying float vPart;
       void main(){vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0);float b=boost(wp.x);
       float pul=(0.5+0.45*sin(uTime*1.4+iPh.x)+b*0.7)*iPh.y;vCol=iCol*pul*1.6;vPart=part;
       vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}`,
      `varying vec3 vCol;varying float vPart;void main(){vec3 c=mix(vec3(0.16,0.2,0.2)+vCol*0.08,vCol,vPart);gl_FragColor=vec4(c,1.0);\n#include <fog_fragment>\n}`);
    glowMats.push(mat);
    const im = new THREE.InstancedMesh(merged, mat, items.length), M = new THREE.Matrix4(), cols = new Float32Array(items.length * 3), phs = new Float32Array(items.length * 2);
    items.forEach((m, i) => { M.makeScale(m.r, m.h, m.r).setPosition(m.x, -3, m.z); const hs = M.elements; hs[5] = m.h; im.setMatrixAt(i, M); const c = GROVE_COL[m.hue]; cols.set([c.r, c.g, c.b], i * 3); phs.set([m.ph, m.dim], i * 2); });
    // the cap must not stretch with stem height: rebuild matrices as stem(h) + cap(r)
    items.forEach((m, i) => { M.set(m.r, 0, 0, m.x, 0, m.h, 0, -3, 0, 0, m.r, m.z, 0, 0, 0, 1); im.setMatrixAt(i, M); });
    merged.setAttribute('iCol', new THREE.InstancedBufferAttribute(cols, 3)); merged.setAttribute('iPh', new THREE.InstancedBufferAttribute(phs, 2));
    im.frustumCulled = false; scene.add(im);
  }

  // ---------- fronds hanging from the roof ----------
  const fronds = [];
  {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x1f5a58, roughness: .8, emissive: GROVE_COL[0], emissiveIntensity: .25 });
    const make = (x, z, len, curl, dim) => {
      const top = roofY(x) * (z < -.6 * caveD(x) ? .95 : 1) + 6;
      const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new THREE.Vector3(curl * 38 * u * u, -len * u, 0)); }
      const curve = new THREE.CatmullRomCurve3(pts), grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 1.6, 5, false), stemMat));
      const lp = []; for (let j = 1; j <= 9; j++) { const u = j / 10, p = curve.getPoint(u), ll = (1 - u) * 16 + 4; lp.push(p.x, p.y, p.z, p.x - ll, p.y - ll * .5, p.z + ll * .3, p.x, p.y, p.z, p.x + ll, p.y - ll * .5, p.z - ll * .3); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      const lm = new THREE.LineBasicMaterial({ color: GROVE_COL[0], transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false });
      grp.add(new THREE.LineSegments(lg, lm));
      const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: GROVE_COL[0], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      const tp = curve.getPoint(1); tip.position.copy(tp); tip.scale.set(18, 18, 1); grp.add(tip);
      grp.position.set(x, top, z); scene.add(grp);
      fronds.push({ grp, x, ph: R() * 6, lm, tip, dim });
    };
    for (let i = 0; i < 28; i++) { const x = GROVE.a + R() * (GROVE.b - GROVE.a), z = 100 - R() * caveD(x) * .9; make(x, z, 80 + Math.pow(R(), 1.6) * 420, R() - .5, 1); }
    for (let i = 0; i < 16; i++) { const d = Math.pow(R(), 1.9), x = HINT.a + 20 + (HINT.b - HINT.a) * d; if (x > CHASM.a - 30 && x < CHASM.b + 30) continue; make(x, 120 - R() * 300, (14 + R() * 60) * (1 - d) + 10, R() - .5, .3 + .7 * (1 - d)); }
  }

  // ---------- spores ----------
  {
    const n = 900, pos = new Float32Array(n * 3), ph = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const road = i > 700, d = road ? Math.pow(R(), 1.7) : 0, x = road ? HINT.a + (HINT.b - HINT.a) * d : GROVE.a + R() * (GROVE.b - GROVE.a);
      pos.set([x, R(), 200 - R() * caveD(x) * .95], i * 3);
      ph.set([R() * 6, .015 + R() * .045, 1 + R() * 2.2, road ? .25 + .75 * (1 - d) : 1], i * 4);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 4));
    const mat = glowShader(
      `attribute vec4 aPh;varying float vA;varying float vHue;
       void main(){float x=position.x+sin(uTime*0.5+aPh.x)*14.0;float u=fract(position.y+uTime*aPh.y);float top=mix(380.0,820.0,step(${GROVE.a.toFixed(1)},position.x)*step(position.x,${GROVE.b.toFixed(1)}));
       vec4 wp=modelMatrix*vec4(x,u*top,position.z,1.0);float b=boost(wp.x);
       vA=(0.5+0.35*sin(uTime*3.0+aPh.x)+b*0.5)*aPh.w*(1.0-u*0.6);vHue=step(2.6,aPh.z);
       vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;gl_PointSize=aPh.z*(1.0+b*0.8)*2.2*projectionMatrix[1][1]*uVH*0.5/(-mvPosition.z);\n#include <fog_vertex>\n}`,
      `varying float vA;varying float vHue;void main(){vec2 d=gl_PointCoord-0.5;float a=smoothstep(0.5,0.0,length(d));vec3 c=mix(vec3(0.47,0.94,0.84),vec3(0.75,0.6,1.0),vHue);gl_FragColor=vec4(c*a*vA,1.0);\n#include <fog_fragment>\n}`,
      { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    glowMats.push(mat);
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  }

  // ---------- the great bell ----------
  const bell = {};
  {
    const S = 2.6, shape = new THREE.Shape(); [[-15, 0], [-11, 50], [-2, 56], [10, 52], [14, 0]].forEach(([x, y], i) => i ? shape.lineTo(x * S, y * S) : shape.moveTo(x * S, y * S)); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 34, bevelEnabled: true, bevelThickness: 5, bevelSize: 4, bevelSegments: 3, curveSegments: 1 }); g.translate(0, 0, -17);
    const bw = 30 * S, bh = 56 * S, ox = 15 * S;
    const face = (g2, w, h, emissive) => {
      const P = (dx, dy) => [(dx * S + ox) / bw * w, h - dy * S / bh * h];
      if (!emissive) {
        g2.fillStyle = '#1e2f3b'; g2.fillRect(0, 0, w, h);
        for (const [dx, dy, rx, ry, al] of [[-8, 8, 9, 6, .32], [6, 14, 7, 9, .26], [-4, 38, 8, 5, .22], [9, 44, 5, 4, .28], [-10, 26, 4, 7, .2], [2, 2, 14, 3, .4]]) { g2.fillStyle = `rgba(8,16,22,${al})`; g2.beginPath(); g2.ellipse(...P(dx, dy), rx * S / bw * w, ry * S / bh * h, 0, 0, Math.PI * 2); g2.fill(); }
        for (const [dx, dy, r] of [[-12, 4, 2.2], [-10, 7, 1.4], [-7, 3, 1.8], [11, 5, 1.6], [12, 9, 2], [-9, 47, 1.4], [-6, 49, 1.1], [4, 53, 1.2]]) { g2.fillStyle = 'rgba(118,146,104,.6)'; g2.beginPath(); g2.arc(...P(dx, dy), r * S / bw * w, 0, Math.PI * 2); g2.fill(); }
      } else { g2.fillStyle = '#000'; g2.fillRect(0, 0, w, h); }
      // pitch marks, worn, the middle one broken
      const mark = (dx, dy, ww, al) => { g2.fillStyle = emissive ? `rgba(255,220,170,${al})` : `rgba(230,238,242,${al})`; const [x0, y0] = P(dx, dy + 2); g2.fillRect(x0, y0, ww * S / bw * w, 2 * S / bh * h); };
      mark(-5, 14, 10, .85); mark(-5, 22, 4, .85); mark(1.5, 22, 3.5, .85); mark(-5, 30, 10, .35);
      const CR = [[[-2, 56], [1, 49], [-2, 43], [2, 35], [-1, 27], [3, 18], [0, 9], [2, 0]], [[2, 35], [7, 31], [9, 25], [13, 22]], [[-1, 27], [-6, 23], [-8, 17], [-12, 14]], [[-11, 50], [-7, 45], [-8, 40]], [[3, 18], [8, 13], [7, 6]]];
      g2.strokeStyle = emissive ? '#ffc46e' : 'rgba(2,4,6,.95)'; g2.lineWidth = emissive ? 5 : 7; g2.lineJoin = 'round';
      g2.beginPath(); for (const c of CR) c.forEach(([dx, dy], i) => i ? g2.lineTo(...P(dx, dy)) : g2.moveTo(...P(dx, dy))); g2.stroke();
    };
    const map = canvasTex(256, 480, (g2, w, h) => face(g2, w, h, false)), em = canvasTex(256, 480, (g2, w, h) => face(g2, w, h, true));
    [map, em].forEach(t => { t.repeat.set(1 / bw, 1 / bh); t.offset.set(ox / bw, 0); });
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: AMBER.clone(), emissiveIntensity: 0, roughness: .85 });
    const mesh = new THREE.Mesh(g, mat); mesh.position.set(BELL.x, -4, -46); scene.add(mesh);
    const light = new THREE.PointLight(0xffb060, 0, 900, 1.2); light.position.set(BELL.x, bh * .6, 30); scene.add(light);
    const rings = []; for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0xf2b25a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); r.position.set(BELL.x, bh * .55, -40); scene.add(r); rings.push(r); }
    const cue = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(32, 32, (g2) => { g2.fillStyle = '#e6f0f5'; g2.beginPath(); g2.moveTo(16, 2); g2.lineTo(28, 16); g2.lineTo(16, 30); g2.lineTo(4, 16); g2.closePath(); g2.fill(); }), transparent: true, depthWrite: false }));
    cue.scale.set(12, 12, 1); cue.position.set(BELL.x, bh + 30, -40); scene.add(cue);
    var bellKey = new THREE.SpotLight(0xbfd6e2, 260, 700, .5, .8, 1.0); bellKey.position.set(BELL.x + 120, bh * 2.2, 380); bellKey.target = mesh; scene.add(bellKey);
    Object.assign(bell, { mat, light, rings, cue, bh, key: bellKey });
  }

  // ---------- Veyra ----------
  const veyra = {};
  {
    const tex = new THREE.TextureLoader().load(SHEET_URL); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4;
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0, .5, 0);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: .9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .42 });
    const mesh = new THREE.Mesh(g, mat); scene.add(mesh);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g2, w) => { const r = g2.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,.75)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = r; g2.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
    Object.assign(veyra, { tex, mat, mesh, shadow });
  }

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight(0x7f9fb3, 0x10161b, .9));
  const key = new THREE.DirectionalLight(0x9fc0d4, .55); key.position.set(-400, 900, 1200); scene.add(key);

  // ---------- post: bloom, then grade (vignette, grain) ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .55, .35, .5); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uFade;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.0)*43758.5453);}
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 d=vUv-0.5;float v=smoothstep(0.85,0.25,length(d*vec2(1.25,1.0)));
      c*=mix(0.45,1.0,v);c+=(h(vUv*800.0)-0.5)*0.035;c=mix(c,vec3(0.0),uFade);gl_FragColor=vec4(c,1.0);}`,
  });
  composer.addPass(grade);

  // ---------- per-frame ----------
  const cam = { x: 0, y: 200, k: 0, flat: 0, look: 0 };
  function update(t, dt, s) {
    const p = s.player, px = p.x + p.w / 2, feetY = GROUND - (p.y + p.h);
    // camera: follows her with a little look-ahead; pulls back and rises in the chamber; F2 eases to a flat, near-orthographic view
    const k = chamberK(px); cam.k += (k - cam.k) * Math.min(1, dt * 1.2);
    cam.look += (p.face * 110 - cam.look) * Math.min(1, dt * 1.5);
    cam.x += (px + cam.look - cam.x) * Math.min(1, dt * 3.2);
    if (cam.snap || Math.abs(px + cam.look - cam.x) > 600) { cam.snap = false; cam.look = p.face * 110; cam.x = px + cam.look; cam.y = Math.max(0, feetY) * .55 + lerp(170, 270, k); cam.k = k; }   // snap after a respawn
    const ty = Math.max(0, feetY) * .55 + lerp(170, 270, cam.k); cam.y += (ty - cam.y) * Math.min(1, dt * 2.4);
    cam.flat += ((s.flat ? 1 : 0) - cam.flat) * Math.min(1, dt * 2.5);
    const d = lerp(720, 1120, cam.k), fov = lerp(38, 3, cam.flat), dd = d * Math.tan(THREE.MathUtils.degToRad(19)) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    camera.fov = fov; camera.position.set(cam.x, cam.y + lerp(d * .1, 0, cam.flat), dd); camera.lookAt(cam.x, cam.y, 0); camera.updateProjectionMatrix();
    scene.fog.near = dd + lerp(80, 200, cam.k); scene.fog.far = dd + lerp(1900, 2600, cam.k);

    // the sprite
    const fr = s.frame; if (fr) {
      const [sx, sy, w, h, cx] = fr, TW = 2000, TH = 689, sc = .5;
      veyra.tex.repeat.set(w / TW, h / TH); veyra.tex.offset.set(sx / TW, 1 - (sy + h) / TH);
      veyra.mesh.scale.set(w * sc * p.face, h * sc, 1);
      veyra.mesh.position.set(px + (w / 2 - cx) * sc * p.face, GROUND - (p.y + p.h) - 1, 14);
      veyra.mat.opacity = 1; veyra.mesh.visible = s.alpha > .02; veyra.mat.alphaTest = .45 + (1 - s.alpha) * .5;
    }
    // her shadow on whatever is below
    let below = -1e9; for (const q of SOLIDS) if (px >= q.x && px <= q.x + q.w && q.y >= p.y + p.h - 4) below = Math.max(below, GROUND - q.y); for (const q of PLATS) if (px >= q.x && px <= q.x + q.w && q.y >= p.y + p.h - 4) below = Math.max(below, GROUND - q.y);
    const gap = feetY - below; veyra.shadow.visible = below > -1e8 && gap < 260; veyra.shadow.position.set(px, below + 1.5, 14); const ss = 46 * (1 - clamp(gap / 300, 0, .7)); veyra.shadow.scale.set(ss, ss * .45, 1);

    // the chamber: pulse, the bell's wave, lights
    for (const o of caps) {
      const b = boost(o.x, t), pul = .55 + .45 * Math.sin(t * .9 + o.c.ph);
      o.capMat.emissiveIntensity = (.28 + pul * .32 + b * 1.1) * o.base;
      o.stemMat.emissiveIntensity = (.05 + b * .2) * o.base;
      o.halo.material.opacity = (.08 + .08 * pul + b * .22) * o.base;
      if (o.light) o.light.intensity = (900 * (.6 + .4 * pul) + 1400 * b) * (s.inGrove ? 1 : .6);
    }
    fill.intensity = 150 * (.7 + boost(BELL.x, t) * .4);
    for (const f of fronds) { const b = boost(f.x, t), pul = .5 + .5 * Math.sin(t * 1.1 + f.ph); f.grp.rotation.z = Math.sin(t * .6 + f.ph) * .03 + Math.sin(t * 7 + f.ph) * b * .05; f.lm.opacity = (.22 + pul * .3 + b * .5) * f.dim; f.tip.material.opacity = (.35 + pul * .35 + b * .5) * f.dim; }
    const el = t - BELL.t0, a = el >= 0 && el < 9 ? Math.exp(-el / 2.4) : 0;
    bell.mat.emissiveIntensity = a * 4.5; bell.mat.color.setRGB(1, 1, 1).lerp(AMBER, Math.min(1, a * .7)); bell.light.intensity = a * 9000; bell.key.intensity = 2600 * (1 - a * .5);
    bell.rings.forEach((r, k2) => { const rr = 40 + ((el * 70 + k2 * 45) % 180); r.scale.set(rr, rr * .8, 1); r.material.opacity = a * (1 - (rr - 40) / 180) * .7; });
    bell.cue.visible = s.nearBell; bell.cue.position.y = bell.bh + 30 + Math.sin(t * 3) * 3;
    for (const m of glowMats) { m.uniforms.uTime.value = t; m.uniforms.uWaveT0.value = BELL.t0; m.uniforms.uVH.value = renderer.domElement.height; }
    animated.forEach(o => o.update(t));
    grade.uniforms.uTime.value = t; grade.uniforms.uFade.value = s.fade;
  }
  function resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); composer.setSize(w, h); }
  return { scene, camera, composer, update, resize, veyra, snap: () => { cam.snap = true; }, render: () => composer.render() };
}
