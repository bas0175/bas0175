# Pack Kreven's poses (sprites/kreven/<pose>.png, transparent, as drawn) into one high-resolution sheet: twice the
# detail of the other characters' sheets (drawn at k = h/430 instead of h/200). Each pose is scaled so the poses
# match (the drawings differ in scale), cropped with its bottom edge on the ground under his boots, and the light
# ground smudges under the boots are removed (the rock chips in the strike stay).
# Run from game3d/: python3 tools/pack_kreven.py -> sprites/kreven/sheet.png, sprites/kreven/meta.json
import json, numpy as np
from PIL import Image
K = .30
#        scale  ground-y  anchor-x (between the boots, in the drawing's pixels)
POSES = {'rest': (1.06, 1402, 575), 'open': (1.45, 958, 740), 'strike': (1.10, 1360, 530),
         'raise': (1.15, 1470, 545), 'point': (1.45, 952, 515)}
tiles, meta, x = [], {}, 0
for name, (s, gy, ax) in POSES.items():
    a = np.asarray(Image.open(f'sprites/kreven/{name}.png').convert('RGBA')).astype(np.float32)
    lum = a[..., :3].mean(2); sat = a[..., :3].max(2) - a[..., :3].min(2)
    band = np.zeros(lum.shape, bool); band[gy - 40:, :] = True
    smudge = band & (lum > 150) & (sat < 40)
    if name == 'strike': smudge[:, 560:830] = False      # the chips thrown up by the staff
    a[smudge, 3] = 0
    im = Image.fromarray(a.astype(np.uint8), 'RGBA').crop((0, 0, a.shape[1], gy))
    al = np.asarray(im)[..., 3] > 16; ys, xs = np.where(al)
    x0, y0, x1 = xs.min(), ys.min(), xs.max() + 1
    c = im.crop((x0, y0, x1, gy)).convert('RGBa'); k = s * K
    c = c.resize((round((x1 - x0) * k), round((gy - y0) * k)), Image.LANCZOS).convert('RGBA')
    tiles.append(c); meta[name] = [x, 0, c.width, c.height, round((ax - x0) * k, 1), c.height]; x += c.width + 2
sheet = Image.new('RGBA', (x - 2, max(t.height for t in tiles)), (0, 0, 0, 0))
for t, m in zip(tiles, meta.values()): sheet.paste(t, (m[0], 0))
sheet.save('sprites/kreven/sheet.png', optimize=True); json.dump(meta, open('sprites/kreven/meta.json', 'w'))
print(sheet.size, meta)
