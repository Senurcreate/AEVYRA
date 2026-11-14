"""Confirm all 12 extracted frames exist and open (size, mode) and that the date-stamp area sits outside the globe disc."""
import numpy as np
from PIL import Image
from download import picked_indices, raw_path
from build_features import CX, CY, R

Image.MAX_IMAGE_PIXELS = None
for i in picked_indices():
    p = raw_path(i)
    im = Image.open(p); a = np.asarray(im)
    H, W = a.shape[:2]
    yy, xx = np.ogrid[:H, :W]
    disc = (xx - CX) ** 2 + (yy - CY) ** 2 <= R ** 2
    stamp = a[2036:2080, 3091:3764, :3].max(axis=2) > 100          # date text area
    print(i, f"{p.stat().st_size/1e6:.1f}MB", im.size, im.mode,
          "| disc %.1f%% of frame" % (100 * disc.mean()), "| stamp pixels inside disc:", int((stamp & disc[2036:2080, 3091:3764]).sum()))
