"""Write ml_aerosols/output/features.sample.json - same structure, 3 frames, PLACEHOLDER values (not real results)."""
import json
import numpy as np
from common import OUT

rng = np.random.default_rng(0)
STRIPS, G, K = 48, 5, 10
GROUPS = ["background", "sulfate", "smoke", "seaSalt", "dust"]

def shares(n, scale=(0.0,)):
    v = rng.dirichlet([40, 6, 1, 3, 4][:n]) if n == G else rng.dirichlet([1] * n)
    return [round(float(x), 6) for x in v]

frames, prev = [], None
for n, idx in enumerate([200, 959, 1892]):
    gs = shares(G)
    frames.append({
        "frameId": f"aer-{idx:04d}", "frameIndex": idx, "order": n, "image": f"aer-{idx:04d}.webp", "alt": "TODO",
        "clusterShares": shares(K),
        "groupShares": gs,
        "aerosolShare": round(1 - gs[0], 6),
        "meanBrightness": 0.4,
        "groupCentroidX": [round(float(x), 6) for x in rng.uniform(0.3, 0.7, G)],
        "groupCentroidY": [round(float(x), 6) for x in rng.uniform(0.3, 0.7, G)],
        "changeVsPrev": None if prev is None else 0.15,
        "groupShareDeltaVsPrev": None if prev is None else [round(a - b, 6) for a, b in zip(gs, prev)],
        "strips": [shares(G) for _ in range(STRIPS)],
        "verified": False,
    })
    prev = gs
doc = {"storyId": "aerosols", "sourceUrl": "https://svs.gsfc.nasa.gov/5572/", "method": "kmeans-pooled-hue-groups",
       "k": K, "seed": 42, "stripCount": STRIPS, "analysisResolution": "6480x3240",
       "cropBox": {"x0": 0, "y0": 0, "x1": 6480, "y1": 3240},
       "frameSelection": {"sourceFrames": "0-2207", "skippedFirst": 12, "picked": [200, 959, 1892], "pickSeed": 42,
                          "note": "PLACEHOLDER sample"},
       "groups": GROUPS,
       "clusterCentroidRGB": [[9, 20, 12], [19, 37, 27], [38, 53, 41], [61, 68, 63], [41, 96, 35], [86, 105, 110],
                              [171, 106, 65], [145, 144, 172], [78, 183, 58], [203, 189, 211]],
       "clusterGroup": ["background"] * 4 + ["sulfate", "seaSalt", "smoke", "dust", "sulfate", "dust"],
       "_note": "PLACEHOLDER VALUES - structure only, not real results. Replaced by features.json from build_features.py.",
       "frames": frames}
(OUT / "features.sample.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print("wrote features.sample.json")
