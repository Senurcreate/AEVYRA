"""Confirm all 12 picked frames exist and open correctly (size, mode, fully opaque)."""
import numpy as np
from PIL import Image
from common import RAW
from download import picked_indices, raw_path

for i in picked_indices():
    p = raw_path(i)
    im = Image.open(p); a = np.asarray(im)
    print(i, f"{p.stat().st_size/1e6:.1f}MB", im.size, im.mode, "alpha min", int(a[..., 3].min()) if a.shape[-1] == 4 else "-")
