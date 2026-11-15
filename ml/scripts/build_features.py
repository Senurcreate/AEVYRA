"""Crop, lights-only K-means tiers and per-year features, computed at FULL resolution (7680x4320).

Run:  python build_features.py   (from ml/scripts, after download.py and crop_check.py)
Output: ml/output/frames/nl-YEAR.webp (1600 px, display only), ml/output/features.json,
        ml/diagnostics/tiers_2012.png / tiers_2023.png

Tier definition (fixes the land/ice problem of the earlier all-pixel K-means):
  tier 0 = "no light": brightness <= LIGHT_THRESHOLD. Ocean, land, desert, snow and ice all sit here.
  tiers 1-3 = dim / medium / bright lights: ONE K-means (K=3, n_init=10, random_state=42) fitted on
              log(1 + brightness) of the light pixels (brightness > LIGHT_THRESHOLD) pooled from all 12 years,
              clusters sorted by brightness.

Memory: only one full-size frame (uint8, ~100 MB) plus the previous year's tier map (~33 MB) is held at a time.
Pass 1 samples light pixels from every frame to fit ONE K-means; pass 2 classifies each frame in row blocks.

Everything here describes rendered image brightness tiers of the NASA SVS visualization,
NOT measured radiance, temperature or emissions.
"""
import json
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from common import (YEARS, raw_path, load_rgb8, load_crop, FRAMES, OUT, DIAG)
import regions as RG

DISPLAY_W = 1600               # WebP display images only
K = 4                          # tier 0 (no light) + 3 light tiers
LIGHT_K = K - 1
SEED = 42
STRIPS = 48
TOTAL_SAMPLE = 240_000         # light pixels pooled from all years to fit the model
LIGHT_THRESHOLD = 55.0         # luma (0-255); measured: ice/snow <= ~50, desert <= ~43, lit areas far above
BLOCK_PIXELS = 2_000_000       # classify in blocks of about this many pixels
BASELINE_THRESHOLD = 25.0      # luma (0-255) above which a pixel counts as "lit" in the baseline (includes land/ice)
WEBP_QUALITY = 90
TIER_COLORS = np.array([[10, 10, 20], [90, 60, 20], [230, 150, 30], [255, 245, 200]], np.uint8)
SOURCE_URL = "https://svs.gsfc.nasa.gov/5276/"
METHOD = "kmeans-lights-log"
LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)


def r6(x):
    return None if x is None else round(float(x), 6)


def luma_of(rgb_flat):
    return rgb_flat.astype(np.float32) @ LUMA


def load_masked_crop(year, cfg):
    """Full-size frame, caption painted over with ocean colour, same crop box for every year."""
    rgb = load_rgb8(raw_path(year))
    for m in cfg["maskBoxes"]:
        ring = np.concatenate([rgb[m["y0"] - 20:m["y0"], m["x0"]:m["x1"]].reshape(-1, 3),
                               rgb[m["y1"]:m["y1"] + 20, m["x0"]:m["x1"]].reshape(-1, 3)])
        rgb[m["y0"]:m["y1"], m["x0"]:m["x1"]] = np.median(ring, axis=0).astype(np.uint8)
    b = cfg["cropBox"]
    return rgb[b["y0"]:b["y1"], b["x0"]:b["x1"]]


def log_feature(lum):
    return np.log1p(lum.astype(np.float64))[:, None]


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    cfg = load_crop()

    # ---- pass 1: sample LIGHT pixels from every full-size frame (one frame in memory at a time)
    rng = np.random.default_rng(SEED)
    per_year = TOTAL_SAMPLE // len(YEARS)
    samples = []
    for y in YEARS:
        img = load_masked_crop(y, cfg)
        H, W = img.shape[:2]
        lum = luma_of(img.reshape(-1, 3))
        idx = np.flatnonzero(lum > LIGHT_THRESHOLD)
        assert idx.size >= per_year, f"{y}: only {idx.size} light pixels"
        pick = np.sort(rng.choice(idx, per_year, replace=False))
        samples.append(lum[pick].copy())
        print("sampled", y, (W, H), "light pixels:", idx.size, flush=True)
        del img, lum
    pool = log_feature(np.concatenate(samples))
    km = KMeans(n_clusters=LIGHT_K, n_init=10, random_state=SEED).fit(pool)
    order = np.argsort(km.cluster_centers_[:, 0])          # tier 1 = dimmest light ... tier 3 = brightest
    remap = np.empty(LIGHT_K, np.uint8)
    remap[order] = np.arange(1, LIGHT_K + 1, dtype=np.uint8)
    centroid_luma = np.expm1(km.cluster_centers_[order, 0])
    print("pooled sample:", pool.shape[0], "light pixels; tier 1-3 centroid brightness:", np.round(centroid_luma, 1).tolist())

    # ---- pass 2: classify each frame in row blocks and compute features
    edges = np.linspace(0, W, STRIPS + 1).round().astype(int)
    xs = (np.arange(W, dtype=np.float64) + 0.5) / W
    rows_per_block = max(1, BLOCK_PIXELS // W)
    rmap = RG.region_map(H, W)
    rinfo = RG.region_info(rmap)
    R = len(RG.NAMES)
    col_idx = np.arange(W, dtype=np.int64)
    frames, prev, tier_preview = [], None, {}
    for y in YEARS:
        img = load_masked_crop(y, cfg)
        # display image only (not used for any number below)
        Image.fromarray(img).resize((DISPLAY_W, round(H * DISPLAY_W / W)), Image.LANCZOS).save(
            FRAMES / f"nl-{y}.webp", "WEBP", quality=WEBP_QUALITY, method=6)

        tiers = np.zeros((H, W), np.uint8)
        tier_count = np.zeros(K, np.int64)
        col_tier = np.zeros((W, K), np.int64)
        col_lum = np.zeros(W, np.float64)                  # brightness of LIGHT pixels only, per column
        lit_lum_sum, base_count = 0.0, 0
        change = grew = faded = 0
        reg_t = np.zeros((R + 1, K), np.int64)
        reg_col = np.zeros((R + 1, W, K), np.int64)
        reg_collum = np.zeros((R + 1, W), np.float64)
        reg_litlum = np.zeros(R + 1, np.float64)
        reg_base = np.zeros(R + 1, np.int64)
        reg_chg = np.zeros(R + 1, np.int64)
        reg_grew = np.zeros(R + 1, np.int64)
        reg_fad = np.zeros(R + 1, np.int64)
        for r in range(0, H, rows_per_block):
            blk = img[r:r + rows_per_block]
            bh = blk.shape[0]
            lum = luma_of(blk.reshape(-1, 3))
            lit = lum > LIGHT_THRESHOLD
            t = np.zeros(lum.shape[0], np.uint8)
            if lit.any():
                t[lit] = remap[km.predict(log_feature(lum[lit]))]
            t = t.reshape(bh, W)
            lum = lum.reshape(bh, W)
            lit = lit.reshape(bh, W)
            tiers[r:r + bh] = t
            tier_count += np.bincount(t.ravel(), minlength=K)
            col_tier += np.bincount((t + K * np.arange(W, dtype=np.int64)).ravel(), minlength=W * K).reshape(W, K)
            col_lum += np.where(lit, lum, 0.0).sum(axis=0, dtype=np.float64)
            lit_lum_sum += float(lum[lit].sum(dtype=np.float64))
            base_count += int((lum > BASELINE_THRESHOLD).sum())
            # ---- per-region counts (same pixels, same tiers; only the bookkeeping is split by region)
            rb = rmap[r:r + bh]
            ridx = np.where(rb == RG.NONE, R, rb).astype(np.int64)
            rf = ridx.ravel()
            reg_t += np.bincount(rf * K + t.ravel(), minlength=(R + 1) * K).reshape(R + 1, K)
            reg_col += np.bincount(((ridx * W + col_idx[None, :]) * K + t).ravel(), minlength=(R + 1) * W * K).reshape(R + 1, W, K)
            reg_collum += np.bincount((ridx * W + col_idx[None, :]).ravel(), weights=np.where(lit, lum, 0.0).ravel().astype(np.float64),
                                      minlength=(R + 1) * W).reshape(R + 1, W)
            reg_litlum += np.bincount(rf[lit.ravel()], weights=lum[lit].astype(np.float64), minlength=R + 1)
            reg_base += np.bincount(rf[(lum > BASELINE_THRESHOLD).ravel()], minlength=R + 1)
            if prev is not None:
                pp = prev[r:r + bh]
                reg_chg += np.bincount(rf[(pp != t).ravel()], minlength=R + 1)
                reg_grew += np.bincount(rf[(t > pp).ravel()], minlength=R + 1)
                reg_fad += np.bincount(rf[(t < pp).ravel()], minlength=R + 1)
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
        regions = {}
        for ri, name in enumerate(RG.NAMES):
            info = rinfo[ri]
            npr = info["pixelCount"]
            bx = info["pixelBox"]
            redges = np.linspace(bx["x0"], bx["x1"], STRIPS + 1).round().astype(int)
            rstrips = []
            for si in range(STRIPS):
                c = reg_col[ri, redges[si]:redges[si + 1]].sum(axis=0)
                rstrips.append([r6(v) for v in c / c.sum()] if c.sum() else None)
            rlit = int(reg_t[ri, 1:].sum())
            cl = reg_collum[ri]
            regions[name] = {
                "tierShares": [r6(v) for v in reg_t[ri] / npr],
                "litShare": r6(rlit / npr),
                "meanBrightness": r6(reg_litlum[ri] / rlit / 255.0) if rlit else 0.0,
                "centroidLon": r6(-180.0 + 360.0 * (cl * xs).sum() / cl.sum()) if cl.sum() > 0 else None,
                "changeVsPrev": None if prev is None else r6(reg_chg[ri] / npr),
                "grewShare": None if prev is None else r6(reg_grew[ri] / npr),
                "fadedShare": None if prev is None else r6(reg_fad[ri] / npr),
                "strips": rstrips,
                "baselineLitShare": r6(reg_base[ri] / npr),
            }
        frames.append({
            "frameId": f"nl-{y}",
            "year": y,
            "image": f"nl-{y}.webp",
            "alt": "TODO",
            "tierShares": [r6(v) for v in tier_count / n],
            "litShare": r6(lit_n / n),
            "meanBrightness": r6(lit_lum_sum / lit_n / 255.0) if lit_n else 0.0,
            "centroidX": r6((col_lum * xs).sum() / col_lum.sum()) if col_lum.sum() > 0 else None,
            "changeVsPrev": None if prev is None else r6(change / n),
            "grewShare": None if prev is None else r6(grew / n),
            "fadedShare": None if prev is None else r6(faded / n),
            "strips": strips,
            "baselineLitShare": r6(base_count / n),
            "regions": regions,
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
        "method": METHOD,
        "k": K,
        "seed": SEED,
        "stripCount": STRIPS,
        "cropBox": cfg["cropBox"],
        "analysisResolution": f"{W}x{H}",
        "lightThreshold": LIGHT_THRESHOLD,
        "regionMethod": "lon/lat boxes on the equirectangular map (see regions.py); every pixel belongs to the first matching region; "
                        "same tiers as the whole map, numbers are shares of the REGION's own pixels; strips run west to east across the region's pixel box",
        "regions": rinfo,
        "tierFeature": "log(1 + brightness 0-255)",
        "tierCentroidBrightness": [None] + [round(float(v), 1) for v in centroid_luma],
        "frames": frames,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "features.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    for y, arr in tier_preview.items():
        Image.fromarray(arr).save(DIAG / f"tiers_{y}.png")

    # ---- comparison with the version before the lights-only fix
    old = {f["year"]: f for f in json.loads((DIAG / "features_before_lights_fix.json").read_text())["frames"]}
    print("\nyear  litShare(new)  litShare(old)   tier1     tier2     tier3    | changeVsPrev(new)")
    for f in frames:
        o = old[f["year"]]
        ts = f["tierShares"]
        print(f"{f['year']}  {f['litShare']:.6f}      {o['litShare']:.6f}      {ts[1]:.6f}  {ts[2]:.6f}  {ts[3]:.6f} | {f['changeVsPrev']}")
    print("\nanalysis resolution:", W, "x", H)


if __name__ == "__main__":
    main()
