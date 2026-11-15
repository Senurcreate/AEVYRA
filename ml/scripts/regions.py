"""Region definitions for "explore by region". Identical copy lives in ml_aerosols/scripts (datasets stay separate).

Both flat maps are equirectangular and stretched to fill the whole image:
    lon = -180 + 360 * (x + 0.5) / W      lat = 90 - 180 * (y + 0.5) / H
(checked on the images: Greenwich and the equator fall on the image centre lines).

A region is a list of lon/lat boxes (lon_min, lon_max, lat_min, lat_max). Regions are tested in the order below and each
pixel belongs to the FIRST region that matches, so regions never overlap. Pixels matching no region (open ocean far from
land) are simply not in any region. The boxes are rectangles, so they include nearby sea and are NOT exact coastlines.
"""
import numpy as np

REGIONS = {
    "antarctica":   {"label": "Antarctica",    "boxes": [(-180, 180, -90, -60)]},
    "africa":       {"label": "Africa",        "boxes": [(-20, 52, -36, 12), (-20, 35, 12, 36)]},
    "europe":       {"label": "Europe",        "boxes": [(-25, 30, 36, 72), (30, 40, 45, 72)]},
    "southAmerica": {"label": "South America", "boxes": [(-82, -34, -56, 12)]},
    "northAmerica": {"label": "North America", "boxes": [(-170, -50, 12, 84), (-50, -10, 58, 84)]},
    "oceania":      {"label": "Oceania",       "boxes": [(110, 180, -50, -10), (141, 180, -12, 5)]},
    "asia":         {"label": "Asia",          "boxes": [(25, 180, 5, 80), (92, 141, -11, 5)]},
}
NAMES = list(REGIONS)
NONE = 255


def region_map(H, W):
    """(H, W) uint8 array: index into NAMES, or 255 for no region."""
    lon = -180.0 + 360.0 * (np.arange(W) + 0.5) / W
    lat = 90.0 - 180.0 * (np.arange(H) + 0.5) / H
    rmap = np.full((H, W), NONE, np.uint8)
    for i, name in enumerate(NAMES):
        for (lo0, lo1, la0, la1) in REGIONS[name]["boxes"]:
            cols = (lon >= lo0) & (lon < lo1)
            rows = (lat >= la0) & (lat < la1)
            sub = rmap[np.ix_(rows, cols)]
            sub[sub == NONE] = i
            rmap[np.ix_(rows, cols)] = sub
    return rmap


def region_of(lon, lat):
    """Region index (255 = none) for arrays of lon/lat in degrees. Same rules as region_map (first matching region wins)."""
    lon = np.asarray(lon, float)
    lat = np.asarray(lat, float)
    lon = (lon + 180.0) % 360.0 - 180.0
    out = np.full(lon.shape, NONE, np.uint8)
    for i, name in enumerate(NAMES):
        for (lo0, lo1, la0, la1) in REGIONS[name]["boxes"]:
            out[(out == NONE) & (lon >= lo0) & (lon < lo1) & (lat >= la0) & (lat < la1)] = i
    return out


def region_info(rmap):
    """Per region: pixel count, share of the map, pixel bounding box (x0, y0, x1, y1 exclusive)."""
    H, W = rmap.shape
    out = []
    for i, name in enumerate(NAMES):
        m = rmap == i
        ys, xs = np.nonzero(m.any(axis=1))[0], np.nonzero(m.any(axis=0))[0]
        out.append({
            "id": name,
            "label": REGIONS[name]["label"],
            "boxesLonLat": [list(b) for b in REGIONS[name]["boxes"]],
            "pixelCount": int(m.sum()),
            "mapShare": round(float(m.sum()) / (H * W), 6),
            "pixelBox": {"x0": int(xs[0]), "y0": int(ys[0]), "x1": int(xs[-1]) + 1, "y1": int(ys[-1]) + 1},
        })
    return out
