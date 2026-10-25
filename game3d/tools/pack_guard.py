# Pack the gatekeeper's poses (sprites/guard/pose-N.png, cut out of white with tools/cutout.py) into one sheet at
# Veyra's idle detail (drawn at .25). All face right as drawn; the game mirrors him to face her. Each pose stands on
# its boots: the bottom edge is the soles, the anchor is midway between the boots (the spear's foot is left out).
# Run from game3d/: python3 tools/pack_guard.py -> sprites/guard/sheet.png, sprites/guard/meta.json
import json, numpy as np
from PIL import Image
N = 4; BODY = 416                     # his height head to sole in sheet pixels (about 104 on screen at .25)
frames = [Image.open(f'sprites/guard/pose-{i}.png').convert('RGBA') for i in range(1, N + 1)]
tiles, meta, x = [], [], 0
for f in frames:
    a = np.asarray(f)[..., 3] > 128; ys, xs = np.where(a); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    band = a[y1 - int(.035 * (y1 - y0)):y1].any(0); cols = np.where(band)[0]
    runs, s = [], cols[0]
    for c0, c1 in zip(cols, cols[1:]):
        if c1 - c0 > 3: runs.append((s, c0)); s = c1
    runs.append((s, cols[-1]))
    if len(runs) >= 3: runs = runs[1:]                     # the spear's foot, on the left
    ax = (runs[0][0] + runs[-1][1]) / 2
    rows = np.where(a.any(1))[0]; head = np.where(a[:, int(ax) - 60:int(ax) + 60].any(1))[0].min()   # the top of his head, not the spear
    k = BODY / (y1 - head)
    c = f.crop((x0, y0, x1, y1)).convert('RGBa').resize((round((x1 - x0) * k), round((y1 - y0) * k)), Image.LANCZOS).convert('RGBA')
    tiles.append(c); meta.append([x, 0, c.width, c.height, round(float((ax - x0) * k), 1), c.height]); x += c.width + 2
sheet = Image.new('RGBA', (x - 2, max(t.height for t in tiles)), (0, 0, 0, 0))
for t, m in zip(tiles, meta): sheet.paste(t, (m[0], 0))
sheet.save('sprites/guard/sheet.png', optimize=True); json.dump(meta, open('sprites/guard/meta.json', 'w'))
print(sheet.size, meta)
