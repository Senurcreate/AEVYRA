"""Crop, K-means tiers and per-year features, computed at FULL resolution (7680x4320).

Run:  python build_features.py   (from ml/scripts, after download.py and crop_check.py)
Output: ml/output/frames/nl-YEAR.webp (1600 px, display only), ml/output/features.json,
        ml/diagnostics/tiers_2012.png / tiers_2023.png

Memory: only one full-size frame (uint8, ~100 MB) plus the previous year's tier map (~33 MB) is held at a time.
Pass 1 samples pixels from every frame to fit ONE K-means; pass 2 classifies each frame in row blocks.

Everything here describes rendered image brightness tiers of the NASA SVS visualization,
NOT measured radiance, temperature or emissions.
"""
import json
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from common import (YEARS, raw_path, load_rgb8, load_crop, FRAMES, OUT, DIAG)

DISPLAY_W = 1600               # WebP display images only
K = 4
SEED = 42
STRIPS = 48
TOTAL_SAMPLE = 200_000         # pixels pooled from all years to fit the model
BLOCK_PIXELS = 2_000_000       # classify in blocks of about this many pixels
BASELINE_THRESHOLD = 25.0      # luma (0-255) above which a pixel counts as "lit" in the baseline
WEBP_QUALITY = 90
TIER_COLORS = np.array([[10, 10, 20], [90, 60, 20], [230, 150, 30], [255, 245, 200]], np.uint8)
SOURCE_URL = "https://svs.gsfc.nasa.gov/5276/"
LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)


def r6(x):
    return None if x is None else round(float(x), 6)


def load_masked_crop(year, cfg):
    """Full-size frame, caption painted over with ocean colour, same crop box for every year."""
    rgb = load_rgb8(raw_path(year))
    for m in cfg["maskBoxes"]:
        ring = np.concatenate([rgb[m["y0"] - 20:m["y0"], m["x0"]:m["x1"]].reshape(-1, 3),
                               rgb[m["y1"]:m["y1"] + 20, m["x0"]:m["x1"]].reshape(-1, 3)])
        rgb[m["y0"]:m["y1"], m["x0"]:m["x1"]] = np.median(ring, axis=0).astype(np.uint8)
    b = cfg["cropBox"]
    return rgb[b["y0"]:b["y1"], b["x0"]:b["x1"]]


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    cfg = load_crop()

    # ---- pass 1: sample pixels from every full-size frame (one frame in memory at a time)
    rng = np.random.default_rng(SEED)
    per_year = TOTAL_SAMPLE // len(YEARS)
    samples = []
    for y in YEARS:
        img = load_masked_crop(y, cfg)
        H, W = img.shape[:2]
        idx = np.sort(rng.choice(H * W, per_year, replace=False))
        samples.append(img.reshape(-1, 3)[idx].copy())
        print("sampled", y, (W, H), flush=True)
        del img
    pool = np.concatenate(samples).astype(np.float32)
    km = KMeans(n_clusters=K, n_init=10, random_state=SEED).fit(pool)
    order = np.argsort(km.cluster_centers_.astype(np.float32) @ LUMA)   # tier 0 = darkest ... 3 = brightest
    remap = np.empty(K, np.uint8)
    remap[order] = np.arange(K, dtype=np.uint8)
    centers_sorted = km.cluster_centers_[order]
    print("pooled sample:", pool.shape[0], "pixels; tier centroids (RGB):", np.rint(centers_sorted).astype(int).tolist())

    # ---- pass 2: classify each frame in row blocks and compute features
    edges = np.linspace(0, W, STRIPS + 1).round().astype(int)
    xs = (np.arange(W, dtype=np.float64) + 0.5) / W
    rows_per_block = max(1, BLOCK_PIXELS // W)
    frames, prev, tier_preview = [], None, {}
    for y in YEARS:
        img = load_masked_crop(y, cfg)
        # display image only (not used for any number below)
        Image.fromarray(img).resize((DISPLAY_W, round(H * DISPLAY_W / W)), Image.LANCZOS).save(
            FRAMES / f"nl-{y}.webp", "WEBP", quality=WEBP_QUALITY, method=6)

        tiers = np.empty((H, W), np.uint8)
        tier_count = np.zeros(K, np.int64)
        col_tier = np.zeros((W, K), np.int64)
        col_lum = np.zeros(W, np.float64)
        lit_lum_sum, base_count = 0.0, 0
        change = grew = faded = 0
        for r in range(0, H, rows_per_block):
            blk = img[r:r + rows_per_block]
            bh = blk.shape[0]
            flat = blk.reshape(-1, 3).astype(np.float32)
            t = remap[km.predict(flat)].reshape(bh, W)
            lum = (flat @ LUMA).reshape(bh, W)
            tiers[r:r + bh] = t
            tier_count += np.bincount(t.ravel(), minlength=K)
            col_tier += np.bincount((t + K * np.arange(W, dtype=np.int64)).ravel(), minlength=W * K).reshape(W, K)
            col_lum += lum.sum(axis=0, dtype=np.float64)
            lit_lum_sum += float(lum[t >= 1].sum(dtype=np.float64))
            base_count += int((lum > BASELINE_THRESHOLD).sum())
            if prev is not None:
                p = prev[r:r + bh]
                change += int((p != t).sum())
                grew += int((t > p).sum())
                faded += int((t < p).sum())
        n = H * W
        lit_n = int(tier_count[1:].sum())
        strips = []
        for s in range(STRIPS):
            c = col_tier[edges[s]:edges[s + 1]].sum(axis=0)
            strips.append([r6(v) for v in c / c.sum()])
        frames.append({
            "frameId": f"nl-{y}",
            "year": y,
            "image": f"nl-{y}.webp",
            "alt": "TODO",
            "tierShares": [r6(v) for v in tier_count / n],
            "litShare": r6(lit_n / n),
            "meanBrightness": r6(lit_lum_sum / lit_n / 255.0) if lit_n else 0.0,
            "centroidX": r6((col_lum * xs).sum() / col_lum.sum()),
            "changeVsPrev": None if prev is None else r6(change / n),
            "grewShare": None if prev is None else r6(grew / n),
            "fadedShare": None if prev is None else r6(faded / n),
            "strips": strips,
            "baselineLitShare": r6(base_count / n),
            "verified": False,
        })
        if y in (YEARS[0], YEARS[-1]):
            small = Image.fromarray(tiers).resize((1920, round(H * 1920 / W)), Image.NEAREST)
            tier_preview[y] = TIER_COLORS[np.asarray(small)]
        prev = tiers
        print("features", y, flush=True)
        del img

    doc = {
        "storyId": "night-lights",
        "sourceUrl": SOURCE_URL,
        "method": "kmeans-pooled",
        "k": K,
        "seed": SEED,
        "stripCount": STRIPS,
        "cropBox": cfg["cropBox"],
        "analysisResolution": f"{W}x{H}",
        "frames": frames,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "features.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    for y, arr in tier_preview.items():
        Image.fromarray(arr).save(DIAG / f"tiers_{y}.png")

    # ---- comparison with the earlier 1600 px version
    old = {f["year"]: f for f in json.loads((DIAG / "features_resized_1600.json").read_text())["frames"]}
    print("\nyear  litShare(full)  litShare(1600)  diff      baseline(full)  baseline(1600)")
    for f in frames:
        o = old[f["year"]]
        print(f"{f['year']}  {f['litShare']:.6f}      {o['litShare']:.6f}      {f['litShare'] - o['litShare']:+.6f}  "
              f"{f['baselineLitShare']:.6f}        {o['baselineLitShare']:.6f}")
    print("\nTier sizes (share of pixels), tiers 0-3, full size vs 1600 px:")
    for f in frames:
        print(f["year"], [round(v, 4) for v in f["tierShares"]], "|", [round(v, 4) for v in old[f["year"]]["tierShares"]])
    print("\nanalysis resolution:", W, "x", H)


if __name__ == "__main__":
    main()
