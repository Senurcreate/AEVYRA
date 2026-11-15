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
from common import FRAMES, OUT, DIAG, ROOT, load_rgb8
import regions as RG
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


RG_LIMB = 960.0                      # assumed true limb radius in px (see fit_camera.py)
CAM_FILE = ROOT / "scripts" / "camera.json"
RNAMES = RG.NAMES
NR = len(RNAMES)
R_LO = np.array([min(b[0] for b in RG.REGIONS[n]["boxes"]) for n in RNAMES] + [0.0])
R_HI = np.array([max(b[1] for b in RG.REGIONS[n]["boxes"]) for n in RNAMES] + [1.0])
# 0.25-degree grid of the whole Earth, used only to measure how much of each region faces the camera
_glat = 90.0 - 0.25 * (np.arange(720) + 0.5)
_glon = -180.0 + 0.25 * (np.arange(1440) + 0.5)
GLON, GLAT = np.meshgrid(_glon, _glat)
G_REGION = RG.region_of(GLON, GLAT)
G_W = np.cos(np.radians(GLAT))


def pixel_lonlat(xs, ys, cam):
    """Orthographic inverse projection: disc pixel -> (lon, lat) in degrees, using the estimated camera."""
    u0 = (xs - CX) / RG_LIMB
    v0 = (CY - ys) / RG_LIMB
    c, sn = np.cos(np.radians(cam["roll"])), np.sin(np.radians(cam["roll"]))
    u = c * u0 + sn * v0
    v = -sn * u0 + c * v0
    z = np.sqrt(np.clip(1 - u * u - v * v, 0, 1))
    p0 = np.radians(cam["lat"])
    lat = np.degrees(np.arcsin(np.clip(z * np.sin(p0) + v * np.cos(p0), -1, 1)))
    lon = cam["lon"] + np.degrees(np.arctan2(u, z * np.cos(p0) - v * np.sin(p0)))
    return (lon + 180.0) % 360.0 - 180.0, lat


def visible_fraction(cam):
    """Share of each region's area (cos-latitude weighted) on the hemisphere facing the camera."""
    zc = (np.sin(np.radians(GLAT)) * np.sin(np.radians(cam["lat"])) +
          np.cos(np.radians(GLAT)) * np.cos(np.radians(cam["lat"])) * np.cos(np.radians(GLON - cam["lon"])))
    vis = zc > 0
    out = []
    for i in range(NR):
        m = G_REGION == i
        out.append(float(G_W[m & vis].sum() / G_W[m].sum()))
    return out


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
    CAMS = json.loads(CAM_FILE.read_text(encoding="utf-8"))["frames"]
    frames, prev_share, prev_rshare, previews = [], None, None, {}
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
        # ---- per-region numbers (same pixels, same groups; only the bookkeeping is split by region)
        cam = CAMS[str(n)]
        lon, lat = pixel_lonlat(xs, ys, cam)
        rr = RG.region_of(lon, lat).astype(np.int64)
        rr[rr == RG.NONE] = NR
        rg = rr * G + g
        reg_clu = np.bincount(rr * K + lab, minlength=(NR + 1) * K).reshape(NR + 1, K)
        reg_g = np.bincount(rg, minlength=(NR + 1) * G).reshape(NR + 1, G)
        npx_r = reg_g.sum(axis=1)
        lumv = pix.astype(np.float32) @ LUMA
        reg_lum = np.bincount(rr[over], weights=lumv[over].astype(np.float64), minlength=NR + 1)
        reg_over = np.bincount(rr[over], minlength=NR + 1)
        sn = np.bincount(rg, weights=np.sin(np.radians(lon)), minlength=(NR + 1) * G).reshape(NR + 1, G)
        cs = np.bincount(rg, weights=np.cos(np.radians(lon)), minlength=(NR + 1) * G).reshape(NR + 1, G)
        sl = np.bincount(rg, weights=lat, minlength=(NR + 1) * G).reshape(NR + 1, G)
        sb = np.clip(((lon - R_LO[rr]) / (R_HI[rr] - R_LO[rr]) * STRIPS).astype(np.int64), 0, STRIPS - 1)
        reg_strip = np.bincount((rr * STRIPS + sb) * G + g, minlength=(NR + 1) * STRIPS * G).reshape(NR + 1, STRIPS, G)
        vis = visible_fraction(cam)
        regions, rshare = {}, {}
        for ri, name in enumerate(RNAMES):
            npr = int(npx_r[ri])
            entry = {"visibleFraction": r6(vis[ri]), "reliable": bool(vis[ri] >= 0.5), "pixelCount": npr}
            if npr == 0:
                entry.update({"clusterShares": None, "groupShares": None, "meanBrightness": None, "groupCentroidLon": None,
                              "groupCentroidLat": None, "groupShareDeltaVsPrev": None, "strips": None})
                rshare[name] = None
            else:
                gs = reg_g[ri] / npr
                rshare[name] = gs
                gc = reg_g[ri]
                entry.update({
                    "clusterShares": [r6(v) for v in reg_clu[ri] / npr],
                    "groupShares": [r6(v) for v in gs],
                    "meanBrightness": r6(reg_lum[ri] / reg_over[ri] / 255.0 / 1.0) if reg_over[ri] else 0.0,
                    "groupCentroidLon": [r6(np.degrees(np.arctan2(sn[ri, k], cs[ri, k]))) if gc[k] else None for k in range(G)],
                    "groupCentroidLat": [r6(sl[ri, k] / gc[k]) if gc[k] else None for k in range(G)],
                    "groupShareDeltaVsPrev": None if (prev_rshare is None or prev_rshare[name] is None)
                    else [r6(a - b) for a, b in zip(gs, prev_rshare[name])],
                    "strips": [[r6(v) for v in row / row.sum()] if row.sum() else None for row in reg_strip[ri]],
                })
            regions[name] = entry
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
            "camera": {"centerLon": cam["lon"], "centerLat": cam["lat"], "rollDeg": cam["roll"], "fitScore": cam["score"],
                       "refitted": cam["refitted"]},
            "regions": regions,
            "verified": False,
        })
        prev_share = gshare
        prev_rshare = rshare
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
        "regionMethod": ("The globe rotates, so the camera centre (lon/lat) of every frame was ESTIMATED by matching an orthographic "
                         "projection of a flat world map to the frame (scripts/fit_camera.py, error about a few degrees; coastlines checked "
                         "on all 12 frames). Each disc pixel is converted to lon/lat and given a region from lon/lat boxes (scripts/regions.py, "
                         "first matching region wins, boxes include nearby sea). Region numbers describe only the VISIBLE part of the region: "
                         "`visibleFraction` = share of the region's area facing the camera, `reliable` = visibleFraction >= 0.5. "
                         "Pixels near the globe edge are squashed and count the same as centre pixels. Strips run west to east in longitude "
                         "across the region's box (48 strips); a strip with no visible pixels is null."),
        "regions": [{"id": n, "label": RG.REGIONS[n]["label"], "boxesLonLat": [list(b) for b in RG.REGIONS[n]["boxes"]]} for n in RNAMES],
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
