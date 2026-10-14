// Shared textures and materials for the 3D view. All procedural, so the build stays one file.
import * as THREE from 'three';
import { makeNoise, mulberry32, clamp } from './util.js';

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export const glowTex = canvasTex(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

// A tileable bump map so rock reads as rock up close.
export function stoneBump(seed, size = 256) {
  const N = makeNoise(seed);
  const t = canvasTex(size, size, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w * Math.PI * 2, v = y / h * Math.PI * 2;
      const n = N.fbm(Math.cos(u) * 2 + 9, Math.sin(u) * 2 + Math.cos(v) * 2, Math.sin(v) * 2, 5);
      const cr = Math.abs(N(Math.cos(u) * 5, Math.sin(u) * 5 + Math.cos(v) * 5, Math.sin(v) * 5)) < .04 ? -.35 : 0;
      const val = clamp(128 + (n + cr) * 220, 0, 255), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = val; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// Inscriptions, after v31's inscribe(): rows of small cut glyphs.
export function inscribe(g, rnd, x, y, w, h, color) {
  g.strokeStyle = color; g.lineWidth = 1.6;
  for (let cx = x; cx < x + w - 12; cx += 18) for (let cy = y; cy < y + h - 16; cy += 22) {
    if (rnd() < .18) continue; const r = rnd(); g.beginPath();
    if (r < .25) { g.moveTo(cx + 6, cy); g.lineTo(cx + 6, cy + 16); }
    else if (r < .45) g.rect(cx + 2, cy + 2, 10, 12);
    else if (r < .6) { g.moveTo(cx, cy + 8); g.lineTo(cx + 12, cy + 8); g.moveTo(cx + 6, cy + 2); g.lineTo(cx + 6, cy + 14); }
    else if (r < .75) g.arc(cx + 6, cy + 8, 4.8, 0, Math.PI * 2);
    else { g.moveTo(cx, cy + 2); g.lineTo(cx + 12, cy + 14); g.moveTo(cx + 12, cy + 2); g.lineTo(cx, cy + 14); }
    g.stroke();
  }
}

// Cut stone: slate with chips, a few seams, and (on some blocks) faint inscriptions.
function masonryTex(seed, inscribed) {
  const R = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2d4659'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${R() < .5 ? '8,16,22' : '70,100,120'},${.05 + R() * .12})`; g.beginPath(); g.ellipse(R() * w, R() * h, 4 + R() * 30, 2 + R() * 14, R() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(3,7,10,.55)'; g.fillRect(R() * w, R() * h, 1 + R() * 4, 1 + R() * 3); }
    g.strokeStyle = 'rgba(3,7,10,.6)'; g.lineWidth = 1.2; for (let i = 0; i < 3; i++) { let x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - .5) * 26; y += 8 + R() * 16; g.lineTo(x, y); } g.stroke(); }
    if (inscribed) inscribe(g, R, 24, 24, w - 48, h - 48, 'rgba(150,190,212,.32)');
  });
}
export const MASONRY = [masonryTex(3, false), masonryTex(5, false), masonryTex(7, true)];
MASONRY.forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
export const BUMP = stoneBump(11);

export function masonryMat(i = 0, tint = 0xffffff) {
  return new THREE.MeshStandardMaterial({ map: MASONRY[i], color: tint, roughness: .9, bumpMap: BUMP, bumpScale: 1.5 });
}
export const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: .92, flatShading: true });
export const darkRockMat = new THREE.MeshStandardMaterial({ color: 0x18222a, roughness: .95, flatShading: true });

// Box UVs scaled to world size, so texture density is the same on every block.
export function worldUVBox(w, h, d, scale = 160) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / 60)), Math.max(1, Math.round(h / 60)), Math.max(1, Math.round(d / 60)));
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax > .5) uv.setXY(i, z / scale, y / scale); else if (ay > .5) uv.setXY(i, x / scale, z / scale); else uv.setXY(i, x / scale, y / scale);
  }
  return g;
}

// A lumpy rock: an icosphere pushed about by noise.
export function rockGeo(w, h, d, seed, flatBottom = true) {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, n = makeNoise(seed);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i), k = 1 + n(v.x * 1.7, v.y * 1.7, v.z * 1.7) * .35;
    p.setXYZ(i, v.x * w * k, (flatBottom ? Math.max(v.y, -.2) : v.y) * h * k, v.z * d * k);
  }
  g.computeVertexNormals(); return g;
}

// Unlit glowing things (spores, small mushrooms, motes) share a fogged shader with a light-wave uniform.
export function glowShader(vertexBody, fragmentBody, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uWaveX: { value: 0 }, uWaveT0: { value: -99 }, uVH: { value: 540 } }, extra.uniforms || {}]),
    vertexShader: `#include <common>\n#include <fog_pars_vertex>\nuniform float uTime,uWaveX,uWaveT0,uVH;\nfloat boost(float x){float tt=uTime-uWaveT0-abs(x-uWaveX)/520.0;return tt<0.0?0.0:(1.0-exp(-tt*10.0))*exp(-tt/3.2);}\n${vertexBody}`,
    fragmentShader: `#include <common>\n#include <fog_pars_fragment>\n${fragmentBody}`,
    fog: true, transparent: !!extra.transparent, depthWrite: extra.depthWrite ?? true, blending: extra.blending ?? THREE.NormalBlending,
  });
}

// Soft points that drift (dust in light wells, mist, spores). Positions: x, phase(0-1), z. Per point: [phase, speed, size, alpha].
export function driftPoints(items, { color = [.8, .9, .95], y0 = 0, y1 = 300, sway = 10, rise = true, alpha = .5, additive = true } = {}) {
  const n = items.length, pos = new Float32Array(n * 3), ph = new Float32Array(n * 4);
  items.forEach((it, i) => { pos.set([it.x, it.u, it.z], i * 3); ph.set([it.ph, it.sp, it.s, it.a ?? 1], i * 4); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 4));
  const mat = glowShader(
    `attribute vec4 aPh;varying float vA;uniform float uY0,uY1,uSway,uDir;
     void main(){float u=fract(position.y+uTime*aPh.y*uDir);float y=mix(uY0,uY1,uDir>0.0?u:1.0-u);
     vec4 wp=modelMatrix*vec4(position.x+sin(uTime*0.5+aPh.x)*uSway,y,position.z,1.0);float b=boost(wp.x);
     vA=(0.55+0.35*sin(uTime*2.0+aPh.x*6.0)+b*0.5)*aPh.w*smoothstep(0.0,0.15,u)*smoothstep(1.0,0.75,u);
     vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;gl_PointSize=aPh.z*(1.0+b*0.8)*2.0*projectionMatrix[1][1]*uVH*0.5/(-mvPosition.z);\n#include <fog_vertex>\n}`,
    `uniform vec3 uCol;uniform float uAlpha;varying float vA;void main(){float a=smoothstep(0.5,0.0,length(gl_PointCoord-0.5));gl_FragColor=vec4(uCol*a*vA*uAlpha,${additive ? '1.0' : 'a*vA*uAlpha'});\n#include <fog_fragment>\n}`,
    { transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uY0: { value: y0 }, uY1: { value: y1 }, uSway: { value: sway }, uDir: { value: rise ? 1 : -1 }, uCol: { value: new THREE.Color(...color) }, uAlpha: { value: alpha } } });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; return pts;
}

// Merge geometries of mixed kinds (indexed or not, with or without uvs) into one.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function mergeSafe(list) {
  const norm = list.map(g => {
    let h = g.index ? g.toNonIndexed() : g;
    if (!h.attributes.normal) h.computeVertexNormals();
    if (!h.attributes.uv) h.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) h.deleteAttribute(k);
    return h;
  });
  const hasColor = norm.some(g => g.attributes.color);
  if (hasColor) norm.forEach(g => { if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); });
  return mergeGeometries(norm);
}
