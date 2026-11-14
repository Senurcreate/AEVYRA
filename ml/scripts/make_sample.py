"""Step 8: write ml/output/features.sample.json - same structure, 3 years, PLACEHOLDER values (not real results)."""
import json
import numpy as np
from common import OUT

rng = np.random.default_rng(0)
STRIPS = 48

def shares():
    v = rng.dirichlet([40, 4, 2, 1])
    return [round(float(x), 6) for x in v]

frames = []
for i, y in enumerate([2012, 2013, 2014]):
    t = shares()
    frames.append({
        "frameId": f"nl-{y}", "year": y, "image": f"nl-{y}.webp", "alt": "TODO",
        "tierShares": t,
        "litShare": round(1 - t[0], 6),
        "meanBrightness": round(0.3 + 0.01 * i, 6),
        "centroidX": round(0.5 + 0.005 * i, 6),
        "changeVsPrev": None if i == 0 else round(0.02 + 0.001 * i, 6),
        "grewShare": None if i == 0 else 0.012,
        "fadedShare": None if i == 0 else 0.008,
        "strips": [shares() for _ in range(STRIPS)],
        "baselineLitShare": round(1 - t[0] - 0.01, 6),
        "verified": False,
    })
doc = {"storyId": "night-lights", "sourceUrl": "https://svs.gsfc.nasa.gov/5276/", "method": "kmeans-pooled",
       "k": 4, "seed": 42, "stripCount": STRIPS,
       "cropBox": {"x0": 0, "y0": 0, "x1": 7680, "y1": 4320},
       "analysisResolution": "7680x4320",
       "_note": "PLACEHOLDER VALUES - structure only, not real results. Replaced by features.json from build_features.py.",
       "frames": frames}
(OUT / "features.sample.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print("wrote features.sample.json")
