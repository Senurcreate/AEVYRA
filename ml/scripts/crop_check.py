"""Step 2: write the shared crop box (+ caption mask) and ml/diagnostics/crop_check.png.

Finding (frame 2012): 7680x4320 RGBA 16-bit, map fills the entire frame (no black bars; first/last rows are
ocean / Antarctica). The only overlay is a year caption in the South Atlantic, which a rectangular crop cannot
remove, so the same region is masked (filled with the surrounding ocean colour) in every year.
"""
import json
import numpy as np
from PIL import Image, ImageDraw
from common import load_rgb8, raw_path, CROP_FILE, DIAG

CROP = {"x0": 0, "y0": 0, "x1": 7680, "y1": 4320}
MASKS = [{"name": "year-caption", "x0": 3250, "y0": 2600, "x1": 3800, "y1": 2820}]

if __name__ == "__main__":
    CROP_FILE.write_text(json.dumps({"cropBox": CROP, "maskBoxes": MASKS}, indent=2) + "\n")
    rgb = load_rgb8(raw_path(2012))
    im = Image.fromarray(rgb).resize((1920, 1080), Image.LANCZOS)
    # brighten for visibility of the dark map
    im = Image.fromarray(np.clip(np.asarray(im, np.float32) * 2.5, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    s = 1920 / 7680
    d.rectangle([CROP["x0"] * s, CROP["y0"] * s, CROP["x1"] * s - 1, CROP["y1"] * s - 1], outline=(0, 255, 0), width=3)
    for m in MASKS:
        d.rectangle([m["x0"] * s, m["y0"] * s, m["x1"] * s, m["y1"] * s], outline=(255, 0, 0), width=2)
    d.text((10, 10), "green = crop box (full frame), red = caption mask; brightened x2.5 for display", fill=(255, 255, 255))
    im.save(DIAG / "crop_check.png")
    import tifffile
    a = tifffile.imread(str(raw_path(2012)))
    al = a[..., 3]
    print("alpha<max fraction:", float((al < 65535).mean()), "min", int(al.min()))
