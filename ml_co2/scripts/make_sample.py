"""Write ml_co2/output/features.sample.json - same structure, 3 frames, PLACEHOLDER values (not real results)."""
import json
import numpy as np
from common import OUT

rng = np.random.default_rng(0)
STRIPS, G, K = 48, 5, 10
GROUPS = ["clear", "brownDark", "brownLight", "grayWhite", "hot"]

def shares(n):
    v = rng.dirichlet([30, 12, 10, 3, 1][:n] if n == G else [1] * n)
    return [round(float(x), 6) for x in v]

frames, prev = [], None
for o, (n, dt) in enumerate([(112, "2020-01-19T13:00"), (513, "2020-02-05T06:00"), (1148, "2020-03-02T17:00")]):
    gs = shares(G)
    frames.append({
        "frameId": f"co2-{n:05d}", "frameNumber": n, "order": o, "dateTime": dt, "image": f"co2-{n:05d}.webp", "alt": "TODO",
        "clusterShares": shares(K), "groupShares": gs, "meanBrightness": 0.3,
        "groupCentroidX": [round(float(x), 6) for x in rng.uniform(0.3, 0.7, G)],
        "groupCentroidY": [round(float(x), 6) for x in rng.uniform(0.3, 0.7, G)],
        "groupShareDeltaVsPrev": None if prev is None else [round(a - b, 6) for a, b in zip(gs, prev)],
        "strips": [shares(G) for _ in range(STRIPS)], "verified": False,
    })
    prev = gs
doc = {"storyId": "co2", "sourceUrl": "https://svs.gsfc.nasa.gov/5196/", "method": "kmeans-pooled-colour-groups-in-globe-disc",
       "k": K, "seed": 42, "stripCount": STRIPS, "analysisResolution": "3840x2160",
       "globeDisc": {"centerX": 1918, "centerY": 1077, "radius": 955, "note": "only pixels inside this circle are analysed"},
       "frameSelection": {"picked": [112, 513, 1148], "note": "PLACEHOLDER sample"},
       "groups": GROUPS,
       "clusterCentroidRGB": [[5, 4, 3], [16, 13, 8], [31, 25, 17], [48, 40, 27], [67, 56, 40], [87, 75, 61],
                              [122, 75, 35], [114, 101, 88], [180, 93, 41], [145, 135, 123]],
       "clusterGroup": ["clear", "clear", "brownDark", "brownDark", "brownLight", "brownLight", "hot", "grayWhite", "hot", "grayWhite"],
       "_note": "PLACEHOLDER VALUES - structure only, not real results. Replaced by features.json from build_features.py.",
       "frames": frames}
(OUT / "features.sample.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print("wrote features.sample.json")
