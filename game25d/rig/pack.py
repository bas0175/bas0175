# Packs the rendered frames into two matching sheets (albedo, normals) and a JSON index.
# Each frame entry: [sx, sy, w, h, cx, footY], where cx and footY are the feet (root) position inside the crop.
# Usage: python3 pack.py <render_dir> <assets_dir>
import json, sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
F = json.load(open(os.path.join(src, 'frames.json')))
RES_W, RES_H, ORTHO, CAM_Z = 300, 360, 2.6, 1.0
PX_M = RES_H / ORTHO                        # pixels per metre (ortho scale spans the taller side)
ROOT_X, GROUND_Y = RES_W / 2, RES_H / 2 + CAM_Z * PX_M
ATLAS_W, PAD = 2048, 2
meta, crops = {}, []
for name, frames in F.items():
    meta[name] = []
    for i in range(len(frames)):
        a = Image.open(os.path.join(src, f'albedo_{name}_{i:02d}.png')).convert('RGBA'); n = Image.open(os.path.join(src, f'normal_{name}_{i:02d}.png')).convert('RGBA')
        bb = a.split()[3].getbbox(); a, n = a.crop(bb), n.crop(bb); n.putalpha(a.split()[3])
        crops.append((name, a, n, bb))
x = y = rowh = 0; place = []
for name, a, n, bb in crops:
    if x + a.width > ATLAS_W: x, y, rowh = 0, y + rowh + PAD, 0
    place.append((name, a, n, bb, x, y)); x += a.width + PAD; rowh = max(rowh, a.height)
H = y + rowh
A, N = Image.new('RGBA', (ATLAS_W, H)), Image.new('RGBA', (ATLAS_W, H))
for name, a, n, bb, px, py in place:
    A.paste(a, (px, py)); N.paste(n, (px, py))
    meta[name].append([px, py, a.width, a.height, round(ROOT_X - bb[0], 1), round(GROUND_Y - bb[1], 1)])
A.save(os.path.join(dst, 'veyra-rig-albedo.png'), optimize=True); N.save(os.path.join(dst, 'veyra-rig-normal.png'), optimize=True)
meta['_'] = {'W': ATLAS_W, 'H': H, 'pxPerMetre': PX_M}
json.dump(meta, open(os.path.join(dst, 'veyra-rig.json'), 'w'))
print('atlas', ATLAS_W, H, {k: len(v) for k, v in meta.items() if k != '_'})
