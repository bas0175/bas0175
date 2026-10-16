# Pack Veyra's idle poses (sprites/idle/pose-N.png, transparent, all on one canvas at one scale) into one sheet at
# twice the model sheet's detail (drawn at .25 instead of .5). Each pose stands on its own boots: the bottom edge is
# the soles, the anchor is midway between the boots. Run from game3d/: python3 tools/pack_idle.py
import json, numpy as np
from PIL import Image
N = 6; FIG_H = 352
FLIP = set()                                # poses mirrored in the sheet (none: she uses all six facing her last direction)
frames = [Image.open(f'sprites/idle/pose-{i}.png').convert('RGBA') for i in range(1, N + 1)]
A = [np.asarray(f)[:, :, 3] > 128 for f in frames]
k = FIG_H / np.mean([np.where(a)[0].max() - np.where(a)[0].min() for a in A])
tiles, meta, x = [], [], 0
for f, a in zip(frames, A):
    ys, xs = np.where(a); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    feet = a[y1 - int(.03 * (y1 - y0)):y1]; fx = np.where(feet.any(0))[0]; ax = (fx.min() + fx.max()) / 2
    c = f.crop((x0, y0, x1, y1)).convert('RGBa').resize((round((x1 - x0) * k), round((y1 - y0) * k)), Image.LANCZOS).convert('RGBA')
    axk = (ax - x0) * k
    if len(tiles) + 1 in FLIP: c = c.transpose(Image.FLIP_LEFT_RIGHT); axk = c.width - axk
    tiles.append(c); meta.append([x, 0, c.width, c.height, round(float(axk), 1), c.height]); x += c.width + 2
sheet = Image.new('RGBA', (x - 2, max(t.height for t in tiles)), (0, 0, 0, 0))
for t, m in zip(tiles, meta): sheet.paste(t, (m[0], 0))
sheet.save('sprites/idle/sheet.png', optimize=True); json.dump(meta, open('sprites/idle/meta.json', 'w'))
print(sheet.size, meta)
