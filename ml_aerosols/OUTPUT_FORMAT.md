# Aevyra aerosols – ML output format

Separate from the night-lights data in `../ml`. Source: NASA SVS 5572 "GEOS Aerosols" (https://svs.gsfc.nasa.gov/5572/),
a model visualization of aerosols, 2024-08-01 to 2024-09-14 (2208 frames, 6480×3240). Everything here describes
**shares of rendered image colours** from that visualization. The values are **not** measured aerosol amounts,
concentrations or optical depth.

Colours in the NASA rendering: **sea salt** = blue / blue-gray, **dust** = pink / lilac, **smoke** = orange / red,
**sulfate** = green. The dark ocean and gray land (Antarctica, Greenland, continents) are the base map.

## Files

| Path | What |
|---|---|
| `output/features.json` | real features for 12 frames |
| `output/features.sample.json` | same structure, 3 frames, **placeholder random values** (top-level `_note` says so); for UI work only |
| `output/frames/aer-NNNN.webp` | 1600×800 images **for display only** (lossy, downsampled); no number comes from them. NNNN = frame index |
| `diagnostics/` | `groups_0200.png`, `groups_1443.png`, `groups_2154.png`: each pixel coloured by group, to check the grouping. Not for the app |

## Frame selection (important)

The source has 2208 frames, index 0000–2207 in time order. The first 12 (index 0–11) are skipped and 12 are picked at
random (seeded, so the same 12 every run) from index 12–2207: **200, 207, 218, 453, 959, 972, 1167, 1443, 1540, 1703,
1892, 2154**. They are **not evenly spaced in time** (200, 207 and 218 are close together). `order` (0–11) is the
time order; `frameIndex` is the index in the source series. The exact date/time of a frame is not recorded here.

## features.json

Top level:

| Field | Type | Value |
|---|---|---|
| `storyId` | string | `"aerosols"` |
| `sourceUrl` | string | `"https://svs.gsfc.nasa.gov/5572/"` |
| `method` | string | `"kmeans-pooled-hue-groups"` |
| `k` | int | `10` K-means clusters |
| `seed` | int | `42` |
| `stripCount` | int | `48` |
| `analysisResolution` | string | `"6480x3240"`: every number is computed on the full-size frames |
| `cropBox` | object | `{x0:0,y0:0,x1:6480,y1:3240}`: the map fills the whole frame; these frames have no title, legend or black bars |
| `frameSelection` | object | `picked` (12 frame indices), `skippedFirst` (12), `pickSeed`, `sourceFrames`, `note` |
| `groups` | string[5] | group order used by every `groupShares`-style array: `["background","sulfate","smoke","seaSalt","dust"]` |
| `clusterCentroidRGB` | number[10][3] | colour of each K-means cluster, sorted dark → bright |
| `clusterGroup` | string[10] | which group each cluster belongs to (same order as above) |
| `frames` | array | 12 records in time order |

Per frame (shares are fractions of pixels, **0–1**; floats rounded to 6 decimals):

| Field | Type | Range / notes |
|---|---|---|
| `frameId` | string | `"aer-NNNN"` |
| `frameIndex` | int | 200–2154, index in the 2208-frame source series |
| `order` | int | 0–11, time order of the picked frames |
| `image` | string | file name only, e.g. `"aer-0200.webp"` (in `output/frames/`) |
| `alt` | string | `"TODO"` placeholder |
| `clusterShares` | number[10] | share of pixels per K-means cluster (order as `clusterCentroidRGB`). Sums to 1 |
| `groupShares` | number[5] | share per group, order = top-level `groups`. Sums to 1. Index 0 is background (≈0.83–0.88) |
| `aerosolShare` | number | 0–1, `1 − groupShares[0]`: share of non-background pixels (≈0.12–0.17) |
| `meanBrightness` | number | 0–1, mean Rec.709 luma (÷255) of non-background pixels |
| `groupCentroidX` | (number\|null)[5] | 0–1, mean horizontal position of each group's pixels (0 = left, 1 = right); `null` if the group is empty |
| `groupCentroidY` | (number\|null)[5] | 0–1, mean vertical position (0 = top/north, 1 = bottom/south) |
| `changeVsPrev` | number \| null | 0–1, share of pixels whose group differs from the **previous picked frame**; `null` for the first. Frames are not adjacent in time, so this is large (≈0.08–0.19) |
| `groupShareDeltaVsPrev` | number[5] \| null | signed change of each `groupShares` entry vs the previous picked frame; `null` for the first |
| `strips` | number[48][5] | 48 equal-width vertical strips, left → right; each is the group shares (order = `groups`) within that strip. Sums to 1 |
| `verified` | boolean | `false` until a human has checked the frame |

What moves (12 frames): `smoke` varies most (≈0.004–0.013, about 107 % of its mean), `dust` (≈0.021–0.048, 69 %),
`sulfate` (36 %), `seaSalt` (31 %); `background` hardly moves (6 %). Smoke and dust are the best signals for anything
that needs clear gaps between frames.

## How it was made

1. `scripts/download.py` – picks the 12 frames (seeded) and downloads them with curl into `data/raw/` (~26 MB each).
2. `scripts/verify_inputs.py` – confirms all 12 open (8-bit RGBA, fully opaque).
3. `scripts/build_features.py` – full resolution, one frame in memory at a time:
   - Pass 1: seeded random sample of 40 000 pixels per frame (480 000 total); fit **one**
     `KMeans(k=10, n_init=10, random_state=42)` on RGB; sort clusters by brightness.
   - Group each cluster by its centroid colour (hue / saturation / value) into background, sulfate, smoke, sea salt
     or dust: rules are in `group_of()` in `build_features.py`. Checked against the pictures: gray land
     (Antarctica, Greenland) lands in background; the Sahara/Asia plume is dust; central African and South
     American fires are smoke.
   - Pass 2: classify every pixel in blocks of ~2 million pixels and compute the features above.
   - Saves the 1600×800 Lanczos WebP (q90) for display. Resizing/compression never feeds the numbers.
4. `scripts/make_sample.py` – writes the placeholder sample file.

Deterministic: two consecutive full runs give byte-identical `features.json` and WebP files
(`scripts/run_twice_check.py`).

## Regions (explore by region)

Top level `regions` lists 7 regions: `antarctica, africa, europe, southAmerica, northAmerica, oceania, asia`, each with
its lon/lat boxes, `pixelCount`, `mapShare` and `pixelBox` (x0, y0, x1, y1 on the full map).
Every frame has `frames[i].regions.<id>` with the same kind of numbers as the whole map, but computed from that
region's pixels only (full resolution, same K-means, nothing resampled):
`clusterShares, groupShares, aerosolShare, meanBrightness, groupCentroidLon / groupCentroidLat (degrees), changeVsPrev, groupShareDeltaVsPrev, strips`

Rules and limits:
- Regions are lon/lat RECTANGLES on the flat map (`scripts/regions.py`), not coastlines: they include nearby sea.
  Each pixel belongs to the first matching region, so regions never overlap. Open ocean far from land is in no region.
- Shares are shares of the region's own pixels (not of the whole map).
- Strips run west to east across the region's pixel box (48 strips). A strip with no region pixels is `null`.
- Old whole-map fields are unchanged (checked: identical to the version before regions were added).
- Same colour/brightness caveats as above: shares of a rendered image, not measured amounts.

## Known limits

- The grouping rules are a judgment on cluster colours, not a physical aerosol classification. The thin bluish
  edge of dust plumes falls into `seaSalt`, and very faint haze looks like the dark background, so group borders are
  approximate.
- Only 12 frames of 2208, and not evenly spaced in time: not a continuous time series.
- Shares of a coloured picture, not amounts of aerosol.

## Rerun

```
cd ml_aerosols
pip install -r requirements.txt
cd scripts
python download.py          # ~320 MB into ../data/raw (skips files already present)
python verify_inputs.py
python build_features.py    # frames, features.json, group diagnostics (~1 min)
python make_sample.py       # features.sample.json
python run_twice_check.py   # optional determinism check
```
