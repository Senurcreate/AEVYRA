"""Step 8: write ml/output/features.sample.json - same structure, 3 years, PLACEHOLDER values (not real results)."""
import json
import numpy as np
from common import OUT

rng = np.random.default_rng(0)
STRIPS = 48

def shares():
    """Placeholder tier shares shaped like the real data: tier 0 (no light) is ~99 %, light tiers are tiny."""
    light = rng.dirichlet([14, 10, 6]) * rng.uniform(0.005, 0.009)
    return [round(float(1 - light.sum()), 6)] + [round(float(x), 6) for x in light]

frames = []
for i, y in enumerate([2012, 2013, 2014]):
    t = shares()
    frames.append({
        "frameId": f"nl-{y}", "year": y, "image": f"nl-{y}.webp", "alt": "TODO",
        "tierShares": t,
        "litShare": round(1 - t[0], 6),
        "meanBrightness": round(0.35 + 0.004 * i, 6),
        "centroidX": round(0.5 + 0.005 * i, 6),
        "changeVsPrev": None if i == 0 else 0.0011,
        "grewShare": None if i == 0 else 0.0008,
        "fadedShare": None if i == 0 else 0.0003,
        "strips": [shares() for _ in range(STRIPS)],
        "baselineLitShare": 0.26,
        "verified": False,
    })
doc = {"storyId": "night-lights", "sourceUrl": "https://svs.gsfc.nasa.gov/5276/", "method": "kmeans-lights-log",
       "k": 4, "seed": 42, "stripCount": STRIPS,
       "cropBox": {"x0": 0, "y0": 0, "x1": 7680, "y1": 4320},
       "analysisResolution": "7680x4320",
       "lightThreshold": 55.0,
       "tierFeature": "log(1 + brightness 0-255)",
       "tierCentroidBrightness": [None, 66.4, 105.2, 185.3],
       "_note": "PLACEHOLDER VALUES - structure only, not real results. Replaced by features.json from build_features.py.",
       "frames": frames}
(OUT / "features.sample.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print("wrote features.sample.json")
