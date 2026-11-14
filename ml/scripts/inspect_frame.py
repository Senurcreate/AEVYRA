"""Step 2: inspect one frame, report dtype/shape, and profile rows/cols to find the map area."""
import sys
import numpy as np
import tifffile
from common import raw_path, load_rgb8, luminance, DIAG

year = int(sys.argv[1]) if len(sys.argv) > 1 else 2012
p = raw_path(year)
with tifffile.TiffFile(str(p)) as t:
    pg = t.pages[0]
    print("file", p.name, "shape", pg.shape, "dtype", pg.dtype, "photometric", pg.photometric, "extrasamples", pg.extrasamples)
rgb = load_rgb8(p)
L = luminance(rgb)
print("rgb8", rgb.shape, "lum min/max/mean", L.min(), L.max(), L.mean())
rows = (L > 8).mean(axis=1)
cols = (L > 8).mean(axis=0)
H, W = L.shape
def runs(v, name, step):
    print(name, "fraction of non-black pixels, sampled every", step)
    print(" ".join(f"{i}:{v[i]:.2f}" for i in range(0, len(v), step)))
runs(rows, "rows", 120)
runs(cols, "cols", 240)
from PIL import Image
Image.fromarray(rgb).resize((1920, 1080), Image.LANCZOS).save(DIAG / "full_2012_preview.png")
