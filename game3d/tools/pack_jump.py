# Pack Veyra's jump (sprites/jump/pose-NN.png, cut out of white with tools/cutout.py) into one sheet at the idle's
# detail (drawn at .25). The frames were drawn with her moving through a fixed frame; the game moves her itself, so
# each frame is cropped to her own figure: the bottom edge is her lowest point (her feet) and the anchor is the middle
# of her body, so only the game's physics moves her. Stray specks from the cut-out are dropped.
# Run from game3d/: python3 tools/pack_jump.py -> sprites/jump/sheet.png, sprites/jump/meta.json
import json, numpy as np
from collections import deque
from PIL import Image
N = 15; K = .735                      # her standing height here is ~480 px; the idle sheet's is 352
def keep_main(a):
    m = a > 40; seen = np.zeros_like(m); comps = []
    H, W = m.shape
    for y0, x0 in zip(*np.where(m)):
        if seen[y0, x0]: continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; pix = []
        while q:
            y, x = q.popleft(); pix.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; q.append((yy, xx))
        comps.append(pix)
    big = max(len(c) for c in comps); keep = np.zeros_like(m)
    for c in comps:
        if len(c) >= big * .01:
            ys, xs = zip(*c); keep[list(ys), list(xs)] = True
    return keep
tiles, meta, x = [], [], 0
for i in range(1, N + 1):
    im = Image.open(f'sprites/jump/pose-{i:02d}.png').convert('RGBA'); a = np.asarray(im).copy()
    keep = keep_main(a[..., 3]); grow = keep.copy()
    for _ in range(2): g = grow.copy(); g[1:] |= grow[:-1]; g[:-1] |= grow[1:]; g[:, 1:] |= grow[:, :-1]; g[:, :-1] |= grow[:, 1:]; grow = g
    a[..., 3] = np.where(grow, a[..., 3], 0)                     # drop the specks, keep the soft edge around her
    ys, xs = np.where(a[..., 3] > 40); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    band = (a[..., 3] > 40)[y0 + int(.3 * (y1 - y0)):y0 + int(.65 * (y1 - y0)), x0:x1]
    ax = np.where(band)[1].mean() if band.any() else (x1 - x0) / 2   # the middle of her body
    c = Image.fromarray(a, 'RGBA').crop((x0, y0, x1, y1)).convert('RGBa')
    c = c.resize((round((x1 - x0) * K), round((y1 - y0) * K)), Image.LANCZOS).convert('RGBA')
    tiles.append(c); meta.append([x, 0, c.width, c.height, round(float(ax * K), 1), c.height]); x += c.width + 2
sheet = Image.new('RGBA', (x - 2, max(t.height for t in tiles)), (0, 0, 0, 0))
for t, m in zip(tiles, meta): sheet.paste(t, (m[0], 0))
sheet.save('sprites/jump/sheet.png', optimize=True); json.dump(meta, open('sprites/jump/meta.json', 'w'))
print(sheet.size, meta[0], meta[4])
