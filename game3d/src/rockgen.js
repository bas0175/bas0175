// Rock and cut stone with real form: an outline (the shape v31 uses for collision and drawing) lofted back in depth,
// rounded over at the front, and roughened in 3D. The walking surface stays where v31 has it; everything else
// gets lumps, chips and a worn edge. Vertex colours light the tops and darken the undersides, so platforms read in the dark.
import * as THREE from 'three';
import { ShapeUtils } from 'three';
import { makeNoise, smooth } from './util.js';

// outline: [{x, y, top}] in 3D coordinates (y up), counter-clockwise seen from the front (+z)
export function loftRock(outline, z0, z1, o = {}) {
  outline = outline.slice();
  const { amp = 8, freq = .03, bevel = 22, seed = 1, walk = true, step = 10, zStep = 26,
    colTop = 0xb2c4d2, colSide = 0x5a6e7c, colBottom = 0x222d36, uvScale = 140 } = o;
  const N = makeNoise(seed);
  let area = 0; for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; area += a.x * b.y - b.x * a.y; }
  if (area < 0) outline = outline.slice().reverse();   // make it counter-clockwise
  // round every corner of the outline (radius limited by the edges either side)
  const cr0 = o.corner ?? 16, src = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[(i - 1 + outline.length) % outline.length], v = outline[i], b = outline[(i + 1) % outline.length];
    const la = Math.hypot(v.x - a.x, v.y - a.y), lb = Math.hypot(b.x - v.x, b.y - v.y), r = Math.min(cr0, la * .45, lb * .45);
    if (r < 2) { src.push(v); continue; }
    const pa = { x: v.x + (a.x - v.x) / la * r, y: v.y + (a.y - v.y) / la * r }, pb = { x: v.x + (b.x - v.x) / lb * r, y: v.y + (b.y - v.y) / lb * r };
    for (let k = 0; k <= 4; k++) { const u = k / 4, x = (1 - u) * (1 - u) * pa.x + 2 * u * (1 - u) * v.x + u * u * pb.x, y = (1 - u) * (1 - u) * pa.y + 2 * u * (1 - u) * v.y + u * u * pb.y;
      src.push({ x, y, top: (u < .5 ? a.top : b.top) && v.top }); }
  }
  // resample so long straight edges get vertices to shape
  const P = [];
  for (let i = 0; i < src.length; i++) {
    const a = src[i], b = src[(i + 1) % src.length], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) { const u = k / n; P.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, top: a.top && (b.top || u === 0) }); }
  }
  const M = P.length;
  const nrm = P.map((p, i) => {
    const a = P[(i - 1 + M) % M], b = P[(i + 1) % M], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    return { x: ty / l, y: -tx / l };   // CCW outline: (ty, -tx) points outward
  });
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9; for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const bev = Math.min(bevel, (maxX - minX) * .22, (maxY - minY) * .32, (z1 - z0) * .4);   // small enough that opposite sides never cross
  // how far each point is (along the outline) from the walking surface: the top stays put, the rest rounds away from it
  const arc = [0]; for (let i = 1; i <= M; i++) arc.push(arc[i - 1] + Math.hypot(P[i % M].x - P[i - 1].x, P[i % M].y - P[i - 1].y));
  const total = arc[M], tops = P.map((p, i) => p.top ? i : -1).filter(i => i >= 0);
  const fromTop = P.map((p, i) => tops.length ? Math.min(...tops.map(j => { const d = Math.abs(arc[i] - arc[j]); return Math.min(d, total - d); })) : 1e9);
  const wRound = fromTop.map(d => smooth(0, bev * 1.4 + 1, d));
  // rings from the back wall to the front: narrow at the back, full and slightly swollen in the middle, rounded off at the front
  const NR = Math.max(9, Math.ceil((z1 - z0) / zStep)), rings = [];
  for (let k = 0; k <= NR; k++) { const t = k / NR, e = Math.sin(Math.PI * (.08 + .92 * t)); rings.push({ t, z: z0 + (z1 - z0) * (1 - Math.pow(1 - t, 1.0)), prof: bev * (1 - Math.pow(Math.max(0, e), .6)) - bev * .14 * Math.pow(e, 4) }); }
  const pos = [], col = [], idx = [];
  const cTop = new THREE.Color(colTop), cSide = new THREE.Color(colSide), cBot = new THREE.Color(colBottom), tmp = new THREE.Color();
  for (const r of rings) for (let i = 0; i < M; i++) {
    const p = P[i], n = nrm[i];
    const inset = p.top ? 3 * smooth(.85, 1, r.t) : r.prof * wRound[i];
    let x = p.x - n.x * inset, y = p.y - n.y * inset, z = r.z;
    const f = N.fbm(x * freq, y * freq, z * freq, 4), g = N(x * freq * 3.1, y * freq * 3.1, z * freq * 3.1);
    const d = (f * 1.6 + g * .4) * amp * (r.t < .02 ? .3 : 1);
    const flat = walk && p.top && r.t < .97;   // keep the walking surface level
    x += n.x * d; y += flat ? Math.max(-1.2, Math.min(1.2, n.y * d * .15)) : n.y * d; z += d * .5 * Math.abs(r.t - .5) * 2;
    pos.push(x, y, z);
    const up = p.top ? 1 : n.y * (1 - .5 * wRound[i] * Math.min(1, Math.abs(r.prof) / (bev || 1)));
    tmp.copy(cSide).lerp(up > 0 ? cTop : cBot, Math.min(1, Math.abs(up))).multiplyScalar(.82 + .3 * (f + .5));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  const R = rings.length;
  for (let k = 0; k < R - 1; k++) for (let i = 0; i < M; i++) { const a = k * M + i, b = k * M + (i + 1) % M, c = (k + 1) * M + (i + 1) % M, d = (k + 1) * M + i; idx.push(a, b, c, a, c, d); }
  // caps: back (hidden against the wall) and front (small, after the round-over)
  for (const [k, flip] of [[0, true], [R - 1, false]]) {
    const ring = []; for (let i = 0; i < M; i++) ring.push(new THREE.Vector2(pos[(k * M + i) * 3], pos[(k * M + i) * 3 + 1]));
    const tris = ShapeUtils.triangulateShape(ring, []);
    for (const t of tris) {
      const [A, B, Cc] = t.map(j => ring[j]), cz = (B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x);
      const front = (cz > 0) !== flip; idx.push(...(front ? [k * M + t[0], k * M + t[1], k * M + t[2]] : [k * M + t[0], k * M + t[2], k * M + t[1]]));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  geo.computeVertexNormals();
  boxUV(geo, uvScale);
  return geo;
}

// UVs projected along each vertex's dominant normal axis (a cheap stand-in for triplanar mapping)
export function boxUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax >= ay && ax >= az) { uv[i * 2] = z / scale; uv[i * 2 + 1] = y / scale; } else if (ay >= az) { uv[i * 2] = x / scale; uv[i * 2 + 1] = z / scale; } else { uv[i * 2] = x / scale; uv[i * 2 + 1] = y / scale; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// a rectangle as an outline (top edge marked as walkable)
export const rectOutline = (x, y, w, h) => [{ x, y: y + h, top: true }, { x, y, top: false }, { x: x + w, y, top: false }, { x: x + w, y: y + h, top: true }];
