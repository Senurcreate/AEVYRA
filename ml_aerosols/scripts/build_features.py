"""Aerosol-colour K-means features for NASA SVS 5572 "GEOS Aerosols", computed at FULL resolution (6480x3240).

Separate from the night-lights pipeline in ../ml. Run (from ml_aerosols/scripts, after download.py):
    python build_features.py
Output: ml_aerosols/output/frames/aer-NNNN.webp (1600 px, display only), ml_aerosols/output/features.json,
        ml_aerosols/diagnostics/groups_*.png

Method
  1. Take the 12 downloaded frames (random frames of the 2208-frame series, first 12 skipped).
  2. ONE K-means (K=10, n_init=10, random_state=42) on RGB pixels pooled from all 12 frames.
  3. Group the 10 clusters into 5 groups from each cluster's centroid colour (hue / saturation / value):
     background, sulfate, smoke, seaSalt, dust (rules in group_of()). Colours in the NASA rendering:
     sea salt = blue/white-gray, dust = pink/lilac, smoke = orange/red, sulfate = green; the dark ocean and
     gray land (Antarctica, Greenland, continents) are the base map = background.
  4. Classify every pixel of every frame in row blocks; compute shares, centroids, strips, change vs previous frame.

These are shares of RENDERED image colours from a model visualization. They are NOT measured aerosol amounts,
concentrations or optical depth.
"""
import colorsys
import json
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from common import FRAMES, OUT, DIAG, load_rgb8
from download import picked_indices, raw_path, FIRST_ALLOWED, LAST, SEED as PICK_SEED

K = 10
SEED = 42
STRIPS = 48
SAMPLE_PER_FRAME = 40_000
BLOCK_PIXELS = 2_000_000
DISPLAY_W = 1600
WEBP_QUALITY = 90
GROUPS = ["background", "sulfate", "smoke", "seaSalt", "dust"]
G = len(GROUPS)
GROUP_COLORS = np.array([[10, 10, 20], [60, 200, 60], [255, 120, 30], [80, 170, 255], [235, 90, 235]], np.uint8)
SOURCE_URL = "https://svs.gsfc.nasa.gov/5572/"
LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)


def r6(x):
    return None if x is None else round(float(x), 6)


def group_of(rgb):
    """Group index for a cluster centroid colour (0-255 RGB)."""
    h, s, v = colorsys.rgb_to_hsv(*(float(x) / 255 for x in rgb))
    h *= 360
    if v < 0.30 or (s < 0.15 and v < 0.45):
        return 0                                  # background: dark ocean shades, gray land
    if 15 <= h <= 45 and s > 0.4:
        return 2                                  # smoke (orange / brown-red)
    if 95 <= h <= 130 and s > 0.4:
        return 1                                  # sulfate (green)
    if 170 <= h < 230 and s > 0.1:
        return 3                                  # sea salt (blue / blue-gray)
    if (h >= 230 or h < 15) and v > 0.55:
        return 4                                  # dust (lilac / pink / white-pink)
    raise ValueError(f"cluster colour {np.rint(rgb).astype(int).tolist()} matches no group rule")


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    idx = picked_indices()

    # ---- pass 1: sample pixels from each full-size frame, fit ONE K-means
    rng = np.random.default_rng(SEED)
    samples = []
    for i in idx:
        flat = load_rgb8(raw_path(i)).reshape(-1, 3)
        samples.append(flat[np.sort(rng.choice(flat.shape[0], SAMPLE_PER_FRAME, replace=False))].copy())
        print("sampled", i, flush=True)
    pool = np.concatenate(samples).astype(np.float32)
    km = KMeans(n_clusters=K, n_init=10, random_state=SEED).fit(pool)
    order = np.argsort(km.cluster_centers_ @ LUMA)                 # cluster 0 = darkest ... 9 = brightest
    rank = np.empty(K, np.int64)
    rank[order] = np.arange(K)
    centers = km.cluster_centers_[order]
    cluster_group = np.array([group_of(c) for c in centers], np.uint8)
    print("pooled sample:", pool.shape[0], "pixels")
    for k in range(K):
        print("  cluster %d RGB%s -> %s" % (k, np.rint(centers[k]).astype(int).tolist(), GROUPS[cluster_group[k]]))

    # ---- pass 2: classify every pixel of every full-size frame in row blocks
    frames, prev = [], None
    group_maps = {}
    for n, i in enumerate(idx):
        img = load_rgb8(raw_path(i))
        H, W = img.shape[:2]
        if n == 0:
            edges = np.linspace(0, W, STRIPS + 1).round().astype(int)
            xs = (np.arange(W, dtype=np.float64) + 0.5) / W
            rows_per_block = max(1, BLOCK_PIXELS // W)
        Image.fromarray(img).resize((DISPLAY_W, round(H * DISPLAY_W / W)), Image.LANCZOS).save(
            FRAMES / f"aer-{i:04d}.webp", "WEBP", quality=WEBP_QUALITY, method=6)   # display only

        gmap = np.empty((H, W), np.uint8)
        clu_count = np.zeros(K, np.int64)
        col_group = np.zeros((W, G), np.int64)
        row_group = np.zeros((H, G), np.int64)
        aer_lum_sum, aer_n = 0.0, 0
        change = 0
        for r in range(0, H, rows_per_block):
            blk = img[r:r + rows_per_block]
            bh = blk.shape[0]
            flat = blk.reshape(-1, 3).astype(np.float32)
            lab = rank[km.predict(flat)]
            g = cluster_group[lab].reshape(bh, W)          # lab = brightness-sorted cluster id
            gmap[r:r + bh] = g
            clu_count += np.bincount(lab, minlength=K)
            col_group += np.bincount((g + G * np.arange(W, dtype=np.int64)).ravel(), minlength=W * G).reshape(W, G)
            row_group[r:r + bh] = np.bincount((g + G * np.arange(bh, dtype=np.int64)[:, None]).ravel(),
                                              minlength=bh * G).reshape(bh, G)
            aer = g.ravel() != 0
            aer_lum_sum += float((flat[aer] @ LUMA).sum(dtype=np.float64))
            aer_n += int(aer.sum())
            if prev is not None:
                change += int((prev[r:r + bh] != g).sum())
        npx = H * W
        gcount = col_group.sum(axis=0)
        gshare = gcount / npx
        strips = []
        for s in range(STRIPS):
            c = col_group[edges[s]:edges[s + 1]].sum(axis=0)
            strips.append([r6(v) for v in c / c.sum()])
        ys = (np.arange(H, dtype=np.float64) + 0.5) / H
        cx = [r6((col_group[:, k] * xs).sum() / gcount[k]) if gcount[k] else None for k in range(G)]
        cy = [r6((row_group[:, k] * ys).sum() / gcount[k]) if gcount[k] else None for k in range(G)]
        prev_share = frames[-1]["_gshare"] if frames else None
        frames.append({
            "frameId": f"aer-{i:04d}",
            "frameIndex": i,
            "order": n,
            "image": f"aer-{i:04d}.webp",
            "alt": "TODO",
            "clusterShares": [r6(v) for v in clu_count / npx],
            "groupShares": [r6(v) for v in gshare],
            "aerosolShare": r6(aer_n / npx),
            "meanBrightness": r6(aer_lum_sum / aer_n / 255.0) if aer_n else 0.0,
            "groupCentroidX": cx,
            "groupCentroidY": cy,
            "changeVsPrev": None if prev is None else r6(change / npx),
            "groupShareDeltaVsPrev": None if prev_share is None else [r6(a - b) for a, b in zip(gshare, prev_share)],
            "strips": strips,
            "verified": False,
            "_gshare": gshare,
        })
        if n in (0, len(idx) - 1) or i == 1443:
            small = Image.fromarray(gmap).resize((1620, 810), Image.NEAREST)
            group_maps[i] = GROUP_COLORS[np.asarray(small)]
        prev = gmap
        print("features", i, flush=True)
        del img
    for f in frames:
        del f["_gshare"]

    doc = {
        "storyId": "aerosols",
        "sourceUrl": SOURCE_URL,
        "method": "kmeans-pooled-hue-groups",
        "k": K,
        "seed": SEED,
        "stripCount": STRIPS,
        "analysisResolution": f"{W}x{H}",
        "cropBox": {"x0": 0, "y0": 0, "x1": W, "y1": H},
        "frameSelection": {
            "sourceFrames": f"0-{LAST} (2208 frames, time order, 2024-08-01 to 2024-09-14 per NASA SVS)",
            "skippedFirst": FIRST_ALLOWED,
            "picked": idx,
            "pickSeed": PICK_SEED,
            "note": "random frames, NOT evenly spaced in time; `order` is time order",
        },
        "groups": GROUPS,
        "clusterCentroidRGB": [np.rint(c).astype(int).tolist() for c in centers],
        "clusterGroup": [GROUPS[g] for g in cluster_group],
        "frames": frames,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "features.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    for i, arr in group_maps.items():
        Image.fromarray(arr).save(DIAG / f"groups_{i:04d}.png")

    print("\nframe   " + "  ".join("%10s" % g for g in GROUPS) + "   aerosolShare  changeVsPrev")
    for f in frames:
        print("%5d   " % f["frameIndex"] + "  ".join("%10.5f" % v for v in f["groupShares"]) +
              "   %.5f      %s" % (f["aerosolShare"], f["changeVsPrev"]))
    tab = np.array([f["groupShares"] for f in frames])
    print("\nrelative range across frames ((max-min)/mean):",
          {g: round(float((tab[:, k].max() - tab[:, k].min()) / tab[:, k].mean()), 2) for k, g in enumerate(GROUPS)})
    print("analysis resolution:", W, "x", H)


if __name__ == "__main__":
    main()
