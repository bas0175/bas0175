# Cut a character out of a white background (the JPEGs as drawn): the white connected to the border is background,
# with soft edges and the white unmixed from the edge colours. Usage: python3 tools/cutout.py in.jpg out.png
import sys, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
mn = im.min(2)
cand = mn > 232                                         # near white
seed = np.zeros_like(cand); seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True; seed &= cand
bg = seed
while True:                                             # grow the border white through connected near-white
    g = bg.copy(); g[1:] |= bg[:-1]; g[:-1] |= bg[1:]; g[:, 1:] |= bg[:, :-1]; g[:, :-1] |= bg[:, 1:]; g &= cand
    if (g == bg).all(): break
    bg = g
# enclosed pockets of pure white (between an arm and the staff) are background too
def near(m, r):
    o = m.copy()
    for _ in range(r): o[1:] |= o[:-1].copy(); o[:-1] |= o[1:].copy(); o[:, 1:] |= o[:, :-1].copy(); o[:, :-1] |= o[:, 1:].copy()
    return o
alpha = np.ones(mn.shape, np.float32); alpha[bg] = 0
edge = near(bg, 3) & ~bg                                # a thin band at the outline: alpha from how white it is
a = np.clip((250 - mn) / 70, 0, 1); alpha[edge] = np.minimum(alpha[edge], a[edge])
A = alpha[..., None]; rgb = np.where(A > .02, (im - 255 * (1 - A)) / np.maximum(A, .02), 0)
out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(dst)
ys, xs = np.where(alpha > .5); print(dst, 'bbox', xs.min(), ys.min(), xs.max(), ys.max())
