"""Estimate where the camera looks (centre longitude / latitude / roll) in each of the 12 CO2 frames.

Why: the orbit video rotates the globe, so "region" boxes (Asia, Africa ...) only make sense once we know which
longitude faces the camera in every frame. NASA does not publish this, so it is ESTIMATED here.

Method: orthographic projection of a flat Earth map. The map used is the night-lights picture
(../../ml/output/frames/nl-2023.webp, land is brighter than ocean). For each frame the camera (lon, lat, roll) is searched so
that the projected map best matches the frame's brightness (normalised cross-correlation, Nelder-Mead refinement).
The camera in this video stays close to the equator and almost north-up, so lat and roll are limited to +-8 degrees.
Frames whose longitude disagrees (>12 deg) with the straight-line trend of the other frames (night-side frames with
little visible land can lock on a wrong place) are refitted inside +-16 degrees of that trend.
Checked by eye: the projected coastlines sit on the real coastlines in all 12 frames; expected error is a few degrees.
Not used for any CO2 number; only for assigning pixels to regions.

Run (from ml_co2/scripts, after download.py):  python fit_camera.py     -> writes camera.json (about 10 minutes)
"""
import json
import numpy as np
import cv2
from scipy.optimize import minimize
from common import ROOT, RAW, load_rgb8
from download import picked_indices

CX, CY, R = 1918, 1077, 955
RG = 960.0                      # assumed true limb radius in pixels (mask radius R is a few px inside it)
S = 6                           # fit at 1/6 scale
LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)
REF_PATH = ROOT.parent / "ml" / "output" / "frames" / "nl-2023.webp"
OUT_FILE = ROOT / "scripts" / "camera.json"
rad = R // S
n = 2 * rad
_yy, _xx = np.mgrid[0:n, 0:n].astype(np.float32)
U = (_xx + 0.5 - rad) * S / RG
V = (rad - _yy - 0.5) * S / RG
INSIDE = np.hypot(U, V) < 0.88
REF = np.minimum(cv2.imread(str(REF_PATH), cv2.IMREAD_GRAYSCALE).astype(np.float32), 60)   # lights saturate; keep land/ocean contrast
RH, RW = REF.shape


def project(lon0, lat0, roll, u_=None, v_=None):
    u_ = U if u_ is None else u_
    v_ = V if v_ is None else v_
    c, s = np.cos(np.radians(roll)), np.sin(np.radians(roll))
    u = c * u_ + s * v_
    v = -s * u_ + c * v_
    z = np.sqrt(np.clip(1 - u * u - v * v, 0, 1))
    p0 = np.radians(lat0)
    lat = np.arcsin(np.clip(z * np.sin(p0) + v * np.cos(p0), -1, 1))
    lon = np.radians(lon0) + np.arctan2(u, z * np.cos(p0) - v * np.sin(p0))
    return np.degrees(lon), np.degrees(lat)


def render(p):
    lon, lat = project(*p)
    mx = ((lon + 180) % 360) / 360 * RW - 0.5
    my = (90 - lat) / 180 * RH - 0.5
    return cv2.remap(REF, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)


def ncc(a, b):
    a = a[INSIDE]
    b = b[INSIDE]
    a = a - a.mean()
    b = b - b.mean()
    return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))


def frame_small(fn):
    img = load_rgb8(RAW / f"co2_{fn:05d}.png")[CY - R:CY + R, CX - R:CX + R]
    g = img.astype(np.float32) @ LUMA
    return np.minimum(cv2.resize(g, (n, n), interpolation=cv2.INTER_AREA), 120)


def fit(f, lons, lats, rolls):
    best = (-2.0, None)
    for lon0 in lons:
        for lat0 in lats:
            for roll in rolls:
                sc = ncc(f, render((lon0, lat0, roll)))
                if sc > best[0]:
                    best = (sc, (lon0, lat0, roll))
    start = np.array(best[1], float)
    r = minimize(lambda p: -ncc(f, render(p)), start, method="Nelder-Mead",
                 options=dict(xatol=0.05, fatol=1e-5, initial_simplex=start + np.vstack([np.zeros(3), np.eye(3) * 4])))
    return [float(x) for x in r.x], -float(r.fun)


def main():
    idx = picked_indices()
    small = {fn: frame_small(fn) for fn in idx}
    res = {}
    for fn in idx:
        p, sc = fit(small[fn], range(-180, 180, 4), range(-8, 9, 4), range(-8, 9, 4))
        res[fn] = dict(lon=p[0], lat=p[1], roll=p[2], score=sc, refitted=False)
        print("pass 1", fn, res[fn], flush=True)
    # straight-line trend of longitude against frame number, dropping outliers until all agree within 12 deg
    keep = list(idx)
    while True:
        x = np.array(keep, float)
        y = np.degrees(np.unwrap(np.radians([res[k]["lon"] for k in keep])))
        a = np.polyfit(x, y, 1)
        resid = np.abs(y - np.polyval(a, x))
        if resid.max() <= 12 or len(keep) <= 4:
            break
        keep.pop(int(resid.argmax()))
    print("trend deg/frame:", round(float(a[0]), 4), "frames used for trend:", keep, flush=True)
    for fn in idx:
        pred = float(np.polyval(a, fn))
        diff = (res[fn]["lon"] - pred + 180) % 360 - 180
        if abs(diff) > 12:
            lo = int(round(pred)) - 16
            p, sc = fit(small[fn], range(lo, lo + 33, 2), range(-10, 11, 4), range(-10, 11, 4))
            res[fn] = dict(lon=p[0], lat=p[1], roll=p[2], score=sc, refitted=True)
            print("refit", fn, res[fn], flush=True)
    doc = {"note": "estimated camera per frame, see fit_camera.py; lon/lat = point at the centre of the globe disc (degrees), roll = image rotation (degrees)",
           "trendDegPerFrame": float(a[0]),
           "frames": {str(fn): {k: (round(v, 3) if isinstance(v, float) else v) for k, v in res[fn].items()} for fn in idx}}
    OUT_FILE.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT_FILE)


if __name__ == "__main__":
    main()
