# Aevyra night-lights – ML output format

Offline preprocessing for the "night-lights" story. Everything here describes **rendered image brightness tiers**
of NASA's SVS visualization (https://svs.gsfc.nasa.gov/5276/). The values are **not** measured radiance,
temperature or emissions.

> **Known limitation (read first).** The source frames are a *rendered* map: a daytime-style land/ice base layer
> plus city lights. K-means on pixel colour therefore groups the base map too:
> tier 1 ≈ dark land, tier 2 ≈ bright land / desert / snow / ice (e.g. Sahara, Greenland, Antarctica),
> tier 3 ≈ actual bright lights. Only tier 3 (≈0.24–0.32 % of pixels) is clearly "lights".
> Consequently `litShare` (≈0.318) is mostly land/ice and is **not** a lights metric, and the dim/medium tiers are not
> pure light levels. The base layer is the same every year, so year-to-year *change* fields
> (`changeVsPrev`, `grewShare`, `fadedShare`, per-strip differences) still reflect changes in the rendered lights.
> Do not present `litShare` / tier 1–2 as "how much of Earth is lit" until this is resolved.

## Files

| Path | What |
|---|---|
| `output/features.json` | real per-year features (12 frames) |
| `output/features.sample.json` | same structure, 3 years, **placeholder random values** (top-level `_note` says so); for UI work only |
| `output/frames/nl-YEAR.webp` | 1600×900 images **for display only** (lossy WebP, downsampled); no number in features.json comes from them. YEAR 2012–2023 |
| `diagnostics/` | `crop_check.png`, `tiers_2012.png`, `tiers_2023.png`, `crop_box.json`, `features_resized_1600.json` (earlier 1600 px run, kept only for comparison). Not for the app |

## features.json

Top level:

| Field | Type | Value |
|---|---|---|
| `storyId` | string | `"night-lights"` |
| `sourceUrl` | string | `"https://svs.gsfc.nasa.gov/5276/"` |
| `method` | string | `"kmeans-pooled"` |
| `k` | int | `4` |
| `seed` | int | `42` |
| `stripCount` | int | `48` |
| `analysisResolution` | string | `"7680x4320"`: every number in the file is computed on the full-size frames, not on the 1600 px display images |
| `cropBox` | object | `{x0,y0,x1,y1}` in source pixels of the 7680×4320 frame: `{0,0,7680,4320}` (the map fills the whole frame; no black bars). A year caption inside the map (x 3250–3800, y 2600–2820 in source pixels) is painted over with the surrounding ocean colour, identically in every year. |
| `frames` | array | 12 records, ascending by year |

Per frame (all shares are fractions of pixels, **0–1**; floats rounded to 6 decimals):

| Field | Type | Range / notes |
|---|---|---|
| `frameId` | string | `"nl-YEAR"` |
| `year` | int | 2012–2023 |
| `image` | string | file name only, e.g. `"nl-2012.webp"` (lives in `output/frames/`) |
| `alt` | string | `"TODO"` placeholder |
| `tierShares` | number[4] | index = tier: `[0]` dark background, `[1]` dim, `[2]` medium, `[3]` bright. Sums to 1 |
| `litShare` | number | 0–1, share of tiers 1–3 (= 1 − tierShares[0]). See limitation above |
| `meanBrightness` | number | 0–1, mean Rec.709 luma (÷255) of tier 1–3 pixels |
| `centroidX` | number | 0–1, luma-weighted mean horizontal position over all pixels (0 = left edge, 1 = right edge) |
| `changeVsPrev` | number \| null | 0–1, share of pixels whose tier differs from the previous year; `null` for 2012 |
| `grewShare` | number \| null | 0–1, share of pixels moved to a higher tier vs previous year; `null` for 2012 |
| `fadedShare` | number \| null | 0–1, share moved to a lower tier; `null` for 2012. `grewShare + fadedShare = changeVsPrev` |
| `strips` | number[48][4] | 48 equal-width vertical strips, left→right; each is `[tier0..tier3]` shares within that strip (sums to 1) |
| `baselineLitShare` | number | 0–1, share of pixels with luma > 25/255 (simple threshold, for comparison) |
| `verified` | boolean | `false` until a human has checked the frame |

## How it was made

1. `scripts/download.py` – curl of the 12 TIFFs (16-bit RGBA, 7680×4320) into `data/raw/`.
2. `scripts/common.py` – loads TIFF → 8-bit RGB (16-bit scaled by 255/65535, alpha composited on black; alpha is
   effectively opaque everywhere).
3. `scripts/crop_check.py` – writes the shared crop box and caption mask + `diagnostics/crop_check.png`.
4. `scripts/build_features.py` – works at **full resolution (7680×4320)**, one frame in memory at a time:
   - Pass 1: mask the caption, crop, and take a seeded random sample of ~200 000 pixels pooled evenly from all 12
     full-size frames (16 666 per year); fit **one** `KMeans(k=4, n_init=10, random_state=42)` on their RGB values;
     sort clusters by centroid luma so tier 0 = darkest.
   - Pass 2: for each frame, classify every pixel in blocks of ~2 million pixels and compute all features above from
     the full-size tier map (the previous year's tier map is kept for the change fields).
   - Separately saves the 1600×900 Lanczos-resized WebP (q90) for display. Resizing/compression never feeds the numbers.
5. `scripts/make_sample.py` – writes the placeholder sample file.

Deterministic: two consecutive full runs give byte-identical `features.json` and WebP files
(`scripts/run_twice_check.py`).

## Rerun

```
cd ml
pip install -r requirements.txt
cd scripts
python download.py          # ~780 MB into ../data/raw (skips files already present)
python crop_check.py        # writes crop box + diagnostics/crop_check.png
python build_features.py    # frames, features.json, tier diagnostics (~2.5 min on my machine)
python make_sample.py       # features.sample.json
python run_twice_check.py   # optional determinism check
```
