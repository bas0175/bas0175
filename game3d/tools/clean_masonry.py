# Thin out the heavy vertical joints in assets/tex-masonry.png (they read as dark bands on every wall and ledge).
# Each band is replaced by clean stone copied from beside it, feathered in; one joint is kept, faded, so the
# blocks still read as cut stone. Run from game3d/: python3 tools/clean_masonry.py
from PIL import Image
import numpy as np
src = 'assets/tex-masonry.png'
im = np.asarray(Image.open(src).convert('RGB')).astype(float)
H, W, _ = im.shape
BANDS = [(82, 94), (221, 234), (259, 268), (486, 524), (591, 605), (735, 744), (770, 781), (998, 1018)]
KEEP = {(221, 234): .45}          # the one joint that stays, at this strength
out = im.copy()
for a, b in BANDS:
    w = b - a, 
    w = b - a
    for dx in (w + 14, -(w + 14), 2 * w + 30, -(2 * w + 30)):   # a clean strip of the same width nearby
        s0 = (a + dx) % W
        cols = [(s0 + i) % W for i in range(w)]
        if not any(c0 <= c <= c1 for c in cols for c0, c1 in BANDS): break
    patch = im[:, cols, :]
    # match the patch's brightness to the stone either side of the band, row by row
    left, right = im[:, (a - 4) % W, :], im[:, (b + 4) % W, :]
    t = np.linspace(0, 1, w)[None, :, None]
    target = left[:, None, :] * (1 - t) + right[:, None, :] * t
    patch = patch - patch.mean(1, keepdims=True) + target
    feather = np.minimum(1, np.minimum(np.arange(w) + 1, w - np.arange(w)) / 4.0)[None, :, None]
    keep = KEEP.get((a, b), 0)
    mix = feather * (1 - keep)
    out[:, [c % W for c in range(a, b)], :] = im[:, [c % W for c in range(a, b)], :] * (1 - mix) + patch * mix
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(src)
print('cleaned', len(BANDS), 'bands')
