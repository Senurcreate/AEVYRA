"""CO2 colour K-means features for NASA SVS 5196 "DYAMOND Global Carbon Dioxide" (globe orbit animation).

Separate from ml/ (night lights) and ml_aerosols/ (aerosols). Run (from ml_co2/scripts, after download.py):
    python build_features.py
Output: ml_co2/output/frames/co2-NNNNN.webp (1600 px, display only), ml_co2/output/features.json,
        ml_co2/diagnostics/groups_*.png

Method
  1. 12 frames extracted from the 4K orbit video (3840x2160). The globe is a disc of fixed size and position
     (camera distance is constant), so ONE disc mask is used for every frame. Everything outside the disc (black
     space and the date stamp at the bottom right) is ignored.
  2. ONE K-means (K=10, n_init=10, random_state=42) on RGB pixels inside the disc, pooled from all 12 frames.
  3. Group the 10 clusters into 5 groups from each cluster's centroid colour (hue / saturation / value):
     clear, brownDark, brownLight, grayWhite, hot (rules in group_of()).
     ONLY `hot` (saturated orange/red = high end of the NASA colour bar) is a clear CO2 signal. The brown and gray
     groups mix the base-map land (desert, forest, snow) with thin CO2 haze and cannot be separated by colour, so they
     mostly follow which land faces the camera.
  4. Classify every disc pixel of every frame; compute shares, screen centroids, 48 vertical strips.

The globe ROTATES slowly (Asia/Australia -> Africa -> the Americas over the 49 days), so different continents face the
camera in different frames. Shares therefore mix real CO2 change with which land is visible.
These are shares of RENDERED image colours from a model visualization. They are NOT measured CO2 amounts or ppm.
"""
import colorsys
import json
from datetime import datetime, timedelta
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from common import FRAMES, OUT, DIAG, load_rgb8
from download import picked_indices, raw_path, FIRST_ALLOWED, LAST, SEED as PICK_SEED

K = 10
SEED = 42
STRIPS = 48
SAMPLE_PER_FRAME = 40_000
DISPLAY_W = 1600
WEBP_QUALITY = 90
CX, CY, R = 1918, 1077, 955          # globe disc in the 3840x2160 frame (measured; mask radius is a few px inside the limb)
GROUPS = ["clear", "brownDark", "brownLight", "grayWhite", "hot"]
G = len(GROUPS)
GROUP_COLORS = np.array([[10, 10, 20], [120, 90, 40], [210, 170, 90], [200, 200, 205], [255, 70, 20]], np.uint8)
SOURCE_URL = "https://svs.gsfc.nasa.gov/5196/"
LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)

# Frames are hourly. Frame 112 is stamped "19 Jan 2020 13:00"; all 12 stamps were read off the images and agree with this
# rule (see STAMPS_READ). Time zone is not stated on the frames.
T0_FRAME, T0 = 112, datetime(2020, 1, 19, 13, 0)
STAMPS_READ = {112: "19 Jan 2020 13:00", 115: "19 Jan 2020 16:00", 122: "19 Jan 2020 23:00", 246: "25 Jan 2020 03:00",
               513: "05 Feb 2020 06:00", 520: "05 Feb 2020 13:00", 625: "09 Feb 2020 22:00", 769: "15 Feb 2020 22:00",
               821: "18 Feb 2020 02:00", 906: "21 Feb 2020 15:00", 1007: "25 Feb 2020 20:00", 1148: "02 Mar 2020 17:00"}


def r6(x):
    return None if x is None else round(float(x), 6)


def frame_time(n):
    return T0 + timedelta(hours=n - T0_FRAME)


def group_of(rgb):
    """Group index for a cluster centroid colour (0-255 RGB)."""
    h, s, v = colorsys.rgb_to_hsv(*(float(x) / 255 for x in rgb))
    if v < 0.10:
        return 0                      # clear: dark ocean / space-dark, no visible overlay
    if s > 0.6:
        return 4                      # hot: saturated orange/red = high end of the NASA colour bar (CO2 signal)
    if s < 0.28 and v >= 0.38:
        return 3                      # grayWhite: low-saturation bright (desert, snow; mostly base map)
    if v < 0.22:
        return 1                      # brownDark: dark brown (dark land and/or thin haze)
    return 2                          # brownLight: brighter tan/brown (land and/or haze)


def disc_pixels(img):
    H, W = img.shape[:2]
    yy, xx = np.ogrid[:H, :W]
    ys, xs = np.nonzero((xx - CX) ** 2 + (yy - CY) ** 2 <= R ** 2)
    return ys, xs


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    idx = picked_indices()
    for n in idx:
        assert frame_time(n).strftime("%d %b %Y %H:%M") == STAMPS_READ[n], f"date rule disagrees with stamp for frame {n}"

    # ---- pass 1: sample disc pixels from each frame, fit ONE K-means
    rng = np.random.default_rng(SEED)
    samples = []
    for n in idx:
        img = load_rgb8(raw_path(n))
        ys, xs = disc_pixels(img)
        pick = np.sort(rng.choice(ys.size, SAMPLE_PER_FRAME, replace=False))
        samples.append(img[ys[pick], xs[pick]].copy())
        print("sampled", n, flush=True)
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

    # ---- pass 2: classify every disc pixel of every frame
    frames, prev_share, previews = [], None, {}
    for o, n in enumerate(idx):
        img = load_rgb8(raw_path(n))
        H, W = img.shape[:2]
        Image.fromarray(img).resize((DISPLAY_W, round(H * DISPLAY_W / W)), Image.LANCZOS).save(
            FRAMES / f"co2-{n:05d}.webp", "WEBP", quality=WEBP_QUALITY, method=6)   # display only (keeps the date stamp)
        ys, xs = disc_pixels(img)
        pix = img[ys, xs]
        lab = rank[km.predict(pix.astype(np.float32))]
        g = cluster_group[lab]
        N = g.size
        clu = np.bincount(lab, minlength=K) / N
        gshare = np.bincount(g, minlength=G) / N
        sidx = np.minimum(((xs - (CX - R)) * STRIPS) // (2 * R + 1), STRIPS - 1)
        sg = np.bincount(sidx * G + g, minlength=STRIPS * G).reshape(STRIPS, G)
        strips = [[r6(v) for v in row / row.sum()] for row in sg]
        xn, yn = (xs - (CX - R)) / (2 * R), (ys - (CY - R)) / (2 * R)
        cx = [r6(xn[g == k].mean()) if (g == k).any() else None for k in range(G)]
        cy = [r6(yn[g == k].mean()) if (g == k).any() else None for k in range(G)]
        over = g != 0
        mean_b = float((pix[over].astype(np.float32) @ LUMA).mean() / 255.0) if over.any() else 0.0
        frames.append({
            "frameId": f"co2-{n:05d}",
            "frameNumber": n,
            "order": o,
            "dateTime": frame_time(n).strftime("%Y-%m-%dT%H:%M"),
            "image": f"co2-{n:05d}.webp",
            "alt": "TODO",
            "clusterShares": [r6(v) for v in clu],
            "groupShares": [r6(v) for v in gshare],
            "meanBrightness": r6(mean_b),
            "groupCentroidX": cx,
            "groupCentroidY": cy,
            "groupShareDeltaVsPrev": None if prev_share is None else [r6(a - b) for a, b in zip(gshare, prev_share)],
            "strips": strips,
            "verified": False,
        })
        prev_share = gshare
        if o in (0, len(idx) - 1) or n == 513:
            m = np.zeros((H, W, 3), np.uint8)
            m[ys, xs] = GROUP_COLORS[g]
            previews[n] = np.asarray(Image.fromarray(m).resize((1600, 900), Image.NEAREST))
        print("features", n, flush=True)

    doc = {
        "storyId": "co2",
        "sourceUrl": SOURCE_URL,
        "method": "kmeans-pooled-colour-groups-in-globe-disc",
        "k": K,
        "seed": SEED,
        "stripCount": STRIPS,
        "analysisResolution": f"{W}x{H}",
        "globeDisc": {"centerX": CX, "centerY": CY, "radius": R, "note": "only pixels inside this circle are analysed"},
        "frameSelection": {
            "source": "orbit video, 4K, 1176 frames (frame number = position in the video, 1-based)",
            "skippedFirst": FIRST_ALLOWED - 1,
            "picked": idx,
            "pickSeed": PICK_SEED,
            "timeRule": "hourly: frame n is 2020-01-19T13:00 + (n - 112) hours; checked against the date stamp printed on all 12 frames; time zone not stated",
            "note": "random frames, not evenly spaced in time; `order` is time order",
        },
        "groups": GROUPS,
        "clusterCentroidRGB": [np.rint(c).astype(int).tolist() for c in centers],
        "clusterGroup": [GROUPS[x] for x in cluster_group],
        "frames": frames,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "features.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    for n, arr in previews.items():
        Image.fromarray(arr).save(DIAG / f"groups_{n:05d}.png")

    print("\nframe   dateTime          " + "  ".join("%9s" % g for g in GROUPS))
    for f in frames:
        print("%5d   %s   " % (f["frameNumber"], f["dateTime"]) + "  ".join("%9.5f" % v for v in f["groupShares"]) +
              "")
    tab = np.array([f["groupShares"] for f in frames])
    print("\nrelative range across frames ((max-min)/mean):",
          {gname: round(float((tab[:, k].max() - tab[:, k].min()) / tab[:, k].mean()), 2) for k, gname in enumerate(GROUPS)})
    print("analysis resolution:", W, "x", H, "| disc pixels per frame:", N)


if __name__ == "__main__":
    main()
