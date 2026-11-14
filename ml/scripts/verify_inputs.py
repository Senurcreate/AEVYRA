"""Step 1 check: confirm all 12 TIFFs exist and open; confirm caption mask region is clean ocean-only in each year."""
import numpy as np, tifffile
from common import YEARS, raw_path, load_crop

cfg = load_crop()
m = cfg["maskBoxes"][0]
for y in YEARS:
    p = raw_path(y)
    with tifffile.TiffFile(str(p)) as t:
        pg = t.pages[0]
        a = pg.asarray()
    rgb = a[..., :3].astype(np.float32) / 257
    L = rgb.mean(-1)
    # outside a slightly larger window, the same area must be ocean-dark (caption fully inside mask)
    pad = 30
    win = L[m["y0"] - pad:m["y1"] + pad, m["x0"] - pad:m["x1"] + pad].copy()
    win[pad:-pad, pad:-pad] = 0
    ys, xs = np.where(L[m["y0"]:m["y1"], m["x0"]:m["x1"]] > 60)
    print(y, f"{p.stat().st_size/1e6:.1f}MB", pg.shape, pg.dtype, "ring max", round(float(win.max()), 1),
          "caption bbox x", xs.min() + m["x0"], xs.max() + m["x0"], "y", ys.min() + m["y0"], ys.max() + m["y0"])
