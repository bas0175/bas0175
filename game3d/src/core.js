// The 3D view under v31's 2D canvas. v31 keeps all the game; this only draws the world behind it.
// The camera is placed so the plane z = 0 lines up exactly with v31's screen: a point (x, y) in v31 lands at
// the same pixel here, so 2D characters stand on 3D ground. Horizontal worlds map y to Y = GROUND - y;
// the vertical scenes (descent, shaft) map y to Y = -y.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const VW = 960, VH = 540, GROUND = 440, CEIL = 70;
const FOV = 40, DIST = (VH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

export const C = { renderer: null, scene: null, camera: null, composer: null, grade: null, worlds: {}, active: null, glowMats: new Set(), enabled: true };

const POINTS = 10, SPOTS = 5;
const pool = { points: [], spots: [] };

export function init(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04070a); scene.fog = new THREE.Fog(0x04070a, DIST + 200, DIST + 2600);
  const camera = new THREE.PerspectiveCamera(FOV, VW / VH, 10, 20000);
  scene.add(new THREE.HemisphereLight(0x8fb4cc, 0x121a20, 1.25));
  const key = new THREE.DirectionalLight(0xa9c8dc, .7); key.position.set(-.3, .9, 1.1); scene.add(key); scene.add(key.target);
  for (let i = 0; i < POINTS; i++) { const l = new THREE.PointLight(0xffffff, 0, 600, 1.3); scene.add(l); pool.points.push(l); }
  for (let i = 0; i < SPOTS; i++) { const l = new THREE.SpotLight(0xcfe3ee, 0, 900, .42, .7, 1.5); scene.add(l, l.target); pool.spots.push(l); }
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(VW, VH), .55, .4, .5));
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.0)*43758.5453);}
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;c+=(h(vUv*800.0)-0.5)*0.03;gl_FragColor=vec4(c,1.0);}`,
  });
  composer.addPass(grade);
  Object.assign(C, { renderer, scene, camera, composer, grade, key });
}

export function resize(w, h) {
  if (!C.renderer) return;
  C.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  C.renderer.setSize(w, h, false); C.composer.setSize(w, h);
}

// A world: a group plus its light sources and per-frame updates. Only one is visible at a time.
export function makeWorld(name, mapY) {
  const w = { name, group: new THREE.Group(), lights: [], updates: [], mapY };
  w.group.visible = false; C.scene.add(w.group); C.worlds[name] = w; return w;
}

export function frame(o) {
  if (!C.renderer || !C.enabled) return;
  const w = C.worlds[o.world]; if (!w) return;
  for (const k in C.worlds) C.worlds[k].group.visible = C.worlds[k] === w;
  C.active = w;
  // camera: v31's view of 960 x 540, centred, looking straight at z = 0
  const cx = o.camX + VW / 2 + (o.shake ? o.shake[0] : 0), cy = w.mapY(o.camY + VH / 2) - (o.shake ? o.shake[1] : 0);
  C.camera.position.set(cx, cy, DIST); C.camera.lookAt(cx, cy, 0); C.camera.updateProjectionMatrix();
  C.key.position.set(cx - 300, cy + 900, 1100); C.key.target.position.set(cx, cy, 0);
  // lights: give the pool to the strongest sources near the view
  const lo = o.camX - 500, hi = o.camX + VW + 500;
  const cand = { point: [], spot: [] };
  for (const L of w.lights) { if (L.x < lo || L.x > hi) continue; const I = L.I(o.t, o); if (I <= 0) continue; cand[L.kind].push({ L, I }); }
  for (const kind of ['point', 'spot']) {
    const list = cand[kind].sort((a, b) => b.I * b.L.weight - a.I * a.L.weight), arr = kind === 'point' ? pool.points : pool.spots;
    arr.forEach((l, i) => {
      const c = list[i]; if (!c) { l.intensity = 0; return; }
      l.color.set(c.L.color); l.intensity = c.I; l.distance = c.L.dist; l.decay = c.L.decay ?? 1.3; l.position.set(c.L.x, c.L.y, c.L.z);
      if (kind === 'spot') { l.target.position.set(c.L.x, c.L.ty, c.L.z); l.angle = c.L.angle ?? .42; }
    });
  }
  for (const u of w.updates) u(o.t, o);
  for (const m of C.glowMats) { m.uniforms.uTime.value = o.t; m.uniforms.uVH.value = C.renderer.domElement.height; }
  C.grade.uniforms.uTime.value = o.t;
  C.composer.render();
}

export function addLight(w, L) { w.lights.push(Object.assign({ weight: 1, dist: 600 }, L)); }
export function trackGlow(mat) { C.glowMats.add(mat); return mat; }
