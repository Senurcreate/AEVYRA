# Aevyra night-lights – ML output format

Offline preprocessing for the "night-lights" story. Everything here describes **rendered image brightness tiers**
of NASA's SVS visualization (https://svs.gsfc.nasa.gov/5276/). The values are **not** measured radiance,
temperature or emissions.

> **What the tiers mean.** The source frames are a *rendered* map: a daytime-style land/ice base layer plus city
> lights. To keep land, snow and ice out of the "lit" numbers, tiers are defined on **light pixels only**:
> tier 0 = **no light** (ocean, land, desert, snow, ice: anything with brightness ≤ `lightThreshold`, 55/255),
> tiers 1-3 = dim / medium / bright **lights** (K-means on the light pixels).
> Measured on the 2012 frame: ice/snow brightness ≈ 48-50, desert ≈ 43, so a cutoff of 55 separates lights from the
> base map.
>
> **Known limits.**
> - Lights dimmer than the cutoff are counted as tier 0 (faint rural lights, especially over bright ground such as
>   desert or snow, are lost). Sparse regions such as Africa therefore look emptier than they are in the picture.
> - Values are small: `litShare` is about 0.006-0.009 (0.6-0.9 % of the map). Scale per field across the 12 years
>   if you map them to sound or UI (min-max over years); the trend is real: +40 % from 2012 to 2023.
> - The earlier version (K-means on all pixels, `litShare` ≈ 0.318) mixed land and ice into tiers 1-2. It is kept in
>   `diagnostics/features_before_lights_fix.json` for comparison only.

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
| `method` | string | `"kmeans-lights-log"` |
| `k` | int | `4`: tier 0 (no light) + 3 light tiers |
| `seed` | int | `42` |
| `stripCount` | int | `48` |
| `analysisResolution` | string | `"7680x4320"`: every number in the file is computed on the full-size frames, not on the 1600 px display images |
| `lightThreshold` | number | `55`: brightness (0-255, Rec.709 luma) above which a pixel counts as a light |
| `tierFeature` | string | `"log(1 + brightness 0-255)"`: the value K-means clusters on |
| `tierCentroidBrightness` | (number\|null)[4] | typical brightness (0-255) of each tier; `[0]` is `null` (tier 0 is the cutoff, not a cluster). Currently `[null, 66.4, 105.2, 185.3]` |
| `cropBox` | object | `{x0,y0,x1,y1}` in source pixels of the 7680×4320 frame: `{0,0,7680,4320}` (the map fills the whole frame; no black bars). A year caption inside the map (x 3250–3800, y 2600–2820 in source pixels) is painted over with the surrounding ocean colour, identically in every year. |
| `frames` | array | 12 records, ascending by year |

Per frame (all shares are fractions of pixels, **0–1**; floats rounded to 6 decimals):

| Field | Type | Range / notes |
|---|---|---|
| `frameId` | string | `"nl-YEAR"` |
| `year` | int | 2012–2023 |
| `image` | string | file name only, e.g. `"nl-2012.webp"` (lives in `output/frames/`) |
| `alt` | string | `"TODO"` placeholder |
| `tierShares` | number[4] | index = tier: `[0]` no light (≈0.99), `[1]` dim, `[2]` medium, `[3]` bright lights. Sums to 1 |
| `litShare` | number | 0–1, share of light pixels (tiers 1–3, = 1 − tierShares[0]). About 0.0061 (2012) → 0.0085 (2023) |
| `meanBrightness` | number | 0–1, mean Rec.709 luma (÷255) of light pixels (tiers 1–3) |
| `centroidX` | number | 0–1, brightness-weighted mean horizontal position of light pixels only (0 = left edge, 1 = right edge) |
| `changeVsPrev` | number \| null | 0–1, share of pixels whose tier differs from the previous year; `null` for 2012 |
| `grewShare` | number \| null | 0–1, share of pixels moved to a higher tier vs previous year; `null` for 2012 |
| `fadedShare` | number \| null | 0–1, share moved to a lower tier; `null` for 2012. `grewShare + fadedShare = changeVsPrev` |
| `strips` | number[48][4] | 48 equal-width vertical strips, left→right; each is `[tier0..tier3]` shares within that strip (sums to 1) |
| `baselineLitShare` | number | 0–1, share of pixels with luma > 25/255 (simple threshold, for comparison; includes land/ice, so it is ≈0.26, not a lights metric) |
| `verified` | boolean | `false` until a human has checked the frame |

## How it was made

1. `scripts/download.py` – curl of the 12 TIFFs (16-bit RGBA, 7680×4320) into `data/raw/`.
2. `scripts/common.py` – loads TIFF → 8-bit RGB (16-bit scaled by 255/65535, alpha composited on black; alpha is
   effectively opaque everywhere).
3. `scripts/crop_check.py` – writes the shared crop box and caption mask + `diagnostics/crop_check.png`.
4. `scripts/build_features.py` – works at **full resolution (7680×4320)**, one frame in memory at a time:
   - Pass 1: mask the caption, crop, and take a seeded random sample of 240 000 **light** pixels (brightness > 55),
     20 000 per year from all 12 full-size frames; fit **one** `KMeans(k=3, n_init=10, random_state=42)` on
     `log(1 + brightness)`; sort clusters by brightness so tier 1 = dimmest light, tier 3 = brightest. Everything
     at or below the cutoff is tier 0.
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
