# Makes tileable textures from the reference paintings: crop a flat-on patch, remove the painted lighting
# (divide by a heavy blur), set the tone, and blend with a half-shifted copy so the edges wrap without a seam.
# Run from game3d/: python3 tools/make_textures.py
import numpy as np
from PIL import Image, ImageFilter

def flatten(img, radius, mean, contrast):
    a = np.asarray(img).astype(np.float32) / 255
    blur = np.asarray(img.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255
    lum = lambda x: (x[..., 0] * .3 + x[..., 1] * .59 + x[..., 2] * .11)[..., None]
    detail = lum(a) / np.maximum(lum(blur), .02)          # 1 = average, <1 cracks and seams
    hue = blur / np.maximum(lum(blur), .02)               # keep the painting's colour cast
    hue = hue.mean(axis=(0, 1), keepdims=True) * .7 + hue * .3
    hue = hue * .35 + np.array([.93, 1.0, 1.08], np.float32) * .65   # mostly cool grey, a little of the painting's blue
    out = hue * mean * (1 + (detail - 1) * contrast)
    return np.clip(out, 0, 1)

def tileable(a, frac=.22):
    h, w, _ = a.shape
    s = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.minimum(np.minimum(xx, w - 1 - xx) / (w * frac), np.minimum(yy, h - 1 - yy) / (h * frac))
    m = np.clip(d, 0, 1)[..., None]; m = m * m * (3 - 2 * m)
    return a * m + s * (1 - m)

def make(src, box, out, size, radius, mean, contrast):
    img = Image.open(src).convert('RGB').crop(box)
    a = tileable(flatten(img, radius, mean, contrast))
    Image.fromarray((a * 255).astype(np.uint8)).resize(size, Image.LANCZOS).save(out, optimize=True)
    print(out, size)

R = 'reference/'
make(R + 'dwellings-by-water.jpg', (480, 755, 1180, 935), 'assets/tex-masonry.png', (1024, 256), 40, .62, 1.0)
make(R + 'inscribed-gate-hall.jpg', (1250, 0, 1672, 250), 'assets/tex-rock.png', (512, 304), 30, .5, 1.1)
make(R + 'inscribed-wall-light.jpg', (900, 1100, 1300, 1560), 'assets/tex-inscription.png', (512, 576), 45, .62, 1.25)
