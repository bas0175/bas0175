# Pack a run cycle (sprites/run9/frame-N.png, all on the same canvas) into one sheet for v31's drawSheetPlayer.
# Every frame keeps the artist's placement: all are cropped to the union of their outlines, so she doesn't slide
# and her head stays level; in frames 6-8 her feet are off the ground (the stride's flight), as drawn. Scaled to the model sheet's size (drawn at .5).
# Frame 9 repeats frame 1 (the loop closing), so only frames 1-8 are packed.
# Run from game3d/: python3 tools/pack_run.py  -> sprites/run9/sheet.png, sprites/run9/meta.json
import json, numpy as np
from PIL import Image
frames = [Image.open(f'sprites/run9/frame-{i}.png').convert('RGBA') for i in range(1, 9)]
A = [np.asarray(f)[:, :, 3] > 24 for f in frames]
U = np.logical_or.reduce(A); ys, xs = np.where(U)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
TARGET_H = 172                       # the model sheet's figures are about this tall (drawn at .5)
k = TARGET_H / (y1 - y0)
# anchor: the middle of the torso, averaged over the frames (the band from 35% to 55% of the height)
band = U[y0 + int(.35 * (y1 - y0)):y0 + int(.55 * (y1 - y0)), x0:x1]
ax = np.mean([np.where(a[y0 + int(.35 * (y1 - y0)):y0 + int(.55 * (y1 - y0)), x0:x1])[1].mean() for a in A]) * k
fw, fh = round((x1 - x0) * k), round((y1 - y0) * k)
sheet = Image.new('RGBA', (fw * len(frames) + 2 * (len(frames) - 1), fh), (0, 0, 0, 0)); meta = []
for i, (f, a) in enumerate(zip(frames, A)):
    h = fh
    c = f.crop((x0, y0, x1, y1)).convert('RGBa').resize((fw, h), Image.LANCZOS).convert('RGBA')
    sheet.paste(c, (i * (fw + 2), 0)); meta.append([i * (fw + 2), 0, fw, h, round(float(ax), 1), h])
sheet.save('sprites/run9/sheet.png', optimize=True)
json.dump(meta, open('sprites/run9/meta.json', 'w'))
print(sheet.size, meta[0])
