# Aevyra CO₂ – ML output format

Separate from `../ml` (night lights) and `../ml_aerosols` (aerosols). Source: NASA SVS 5196 "DYAMOND Global Carbon Dioxide"
(https://svs.gsfc.nasa.gov/5196/), a model visualization (GEOS-MITgcm) of CO₂ from January to March 2020, shown on a
rotating 3D globe. Everything here describes **shares of rendered image colours** from that visualization. The values are
**not** measured CO₂ amounts or ppm.

## Read this first: what the numbers can and cannot tell you

1. **Only `hot` is a CO₂ signal.** In the NASA colour bar (380 to 460 ppm), low CO₂ is transparent and high CO₂ is
   orange/red. The `hot` group is the saturated orange/red pixels. The other groups (`brownDark`, `brownLight`,
   `grayWhite`) mix the base-map land (desert, forest, snow) with thin CO₂ haze and cannot be separated by colour: they
   mostly follow **which land faces the camera**.
2. **The globe rotates.** Over the 49 days the view turns from Asia and Australia, through Africa, to the Americas, so
   different land is visible in different frames. Shares therefore mix real change with the visible continent. Pixel-by-pixel
   comparison between frames is meaningless, so there is no `changeVsPrev` field.
3. **Day/night cycle.** The frames are hourly and the model has strong daily swings. Example: central Africa is bright
   orange in frame 513 (5 Feb 06:00) and almost gone in frame 520 (5 Feb 13:00). That drop is large and looks like the
   model's daily cycle (not verified), so `hot` can change a lot within one day.
4. **Source is a lossy video**, not a PNG frame set (the orbit animation has no PNG frames). Colours are slightly
   altered by video compression.

## Files

| Path | What |
|---|---|
| `output/features.json` | real features for 12 frames |
| `output/features.sample.json` | same structure, 3 frames, **placeholder random values** (top-level `_note` says so); for UI work only |
| `output/frames/co2-NNNNN.webp` | 1600×900 images **for display only** (lossy, downsampled; the date stamp is visible in the picture). NNNNN = frame number. No number comes from them |
| `diagnostics/` | `groups_00112.png`, `groups_00513.png`, `groups_01148.png`: each pixel coloured by group. Not for the app |

## Frame selection and dates

The orbit video has 1176 frames (frame number = position in the video, 1-based). The first 12 are skipped and 12 are picked
at random (seeded) from 13–1176, kept in order: **112, 115, 122, 246, 513, 520, 625, 769, 821, 906, 1007, 1148**.
They are **not evenly spaced** (112, 115 and 122 are close together).

Frames are **hourly**: frame *n* is `2020-01-19T13:00 + (n − 112) hours` (`dateTime` field). This was checked against the
date stamp printed in the picture for all 12 frames (stamps read from the images; they all agree). The time zone is not stated
on the frames. The full animation runs about 14 Jan to 3 Mar 2020.

## features.json

Top level:

| Field | Type | Value |
|---|---|---|
| `storyId` | string | `"co2"` |
| `sourceUrl` | string | `"https://svs.gsfc.nasa.gov/5196/"` |
| `method` | string | `"kmeans-pooled-colour-groups-in-globe-disc"` |
| `k` | int | `10` K-means clusters |
| `seed` | int | `42` |
| `stripCount` | int | `48` |
| `analysisResolution` | string | `"3840x2160"`: every number is computed on the full 4K frames |
| `globeDisc` | object | `{centerX:1918, centerY:1077, radius:955}` in frame pixels. Only pixels inside this circle are analysed (the globe keeps the same size and place in every frame). Black space and the date stamp are outside it |
| `frameSelection` | object | `picked`, `skippedFirst`, `pickSeed`, `timeRule`, `source`, `note` |
| `groups` | string[5] | group order for every group-shaped array: `["clear","brownDark","brownLight","grayWhite","hot"]` |
| `clusterCentroidRGB` | number[10][3] | colour of each K-means cluster, sorted dark → bright |
| `clusterGroup` | string[10] | group of each cluster (same order) |
| `frames` | array | 12 records in time order |

Per frame (shares are fractions of the **globe-disc pixels**, **0–1**; about 2.87 million pixels per frame):

| Field | Type | Range / notes |
|---|---|---|
| `frameId` | string | `"co2-NNNNN"` |
| `frameNumber` | int | 112–1148, position in the video |
| `order` | int | 0–11, time order |
| `dateTime` | string | `"2020-01-19T13:00"` style; time zone not stated |
| `image` | string | file name only, e.g. `"co2-00112.webp"` |
| `alt` | string | `"TODO"` placeholder |
| `clusterShares` | number[10] | share per K-means cluster. Sums to 1 |
| `groupShares` | number[5] | share per group, order = top-level `groups`. Sums to 1 |
| `meanBrightness` | number | 0–1, mean Rec.709 luma (÷255) of the non-`clear` pixels (mostly land, see limits) |
| `groupCentroidX` / `groupCentroidY` | (number\|null)[5] | 0–1, mean **screen** position of each group inside the disc's bounding box (0 = left/top). Not geographic, because the globe rotates |
| `groupShareDeltaVsPrev` | number[5] \| null | signed change of each `groupShares` entry vs the previous picked frame; `null` for the first |
| `strips` | number[48][5] | 48 equal-width vertical strips across the disc, left → right; each is the group shares of the disc pixels in that strip. Sums to 1 |
| `verified` | boolean | `false` until a human has checked the frame |

What moves (12 frames): `hot` about 0.0003–0.054 (the clearest signal, but mixed with rotation and the daily cycle),
`grayWhite` about 0.005–0.092 (Sahara facing the camera drives it: rotation, not CO₂), `brownDark` 0.14–0.25,
`brownLight` 0.07–0.14, `clear` 0.56–0.72.

## Regions (explore by region) - approximate

Top level `regions` lists 7 regions (`antarctica, africa, europe, southAmerica, northAmerica, oceania, asia`) with their
lon/lat boxes. Every frame has `frames[i].regions.<id>` and `frames[i].camera`.

How it works: the globe rotates, so which region faces the camera changes. NASA does not publish the camera angle, so
`scripts/fit_camera.py` ESTIMATED the centre longitude/latitude of every frame by matching a flat world map (the night-lights
picture, used only as a geometry reference) to the frame. Coastlines were checked by eye on all 12 frames and sit on the real
coastlines; expected error is a few degrees (up to about 7 on the dark night-side frame 513). Each disc pixel is then turned
into lon/lat and given a region (same box rules as the other datasets, `scripts/regions.py`).

Per region per frame:
`visibleFraction` (share of the region's area facing the camera), `reliable` (`visibleFraction >= 0.5`), `pixelCount`,
`clusterShares, groupShares, meanBrightness, groupCentroidLon / groupCentroidLat (degrees), groupShareDeltaVsPrev, strips`.
If no pixel of the region is visible, the numbers are `null`.

Rules and limits:
- Numbers describe only the VISIBLE part of a region, as a share of the visible pixels. A region seen at 25% shows only that quarter.
  Use `reliable` (or `visibleFraction`) before showing or sonifying a region; many regions are not reliable in many frames.
- Pixels near the globe edge are squashed, and still count the same as centre pixels.
- `groupShareDeltaVsPrev` per region mixes real change with rotation (different parts of the region come into view).
- `strips` run west to east in longitude across the region's box (48 strips); a strip with no visible pixels is `null`.
- Boxes are rectangles, not coastlines, and include nearby sea.
- Whole-globe fields are unchanged (checked identical to the version before regions).
- Of all the groups, only `hot` is a real CO2 signal (see the top of this file). In regions, `hot` is the one to use.

## How it was made

1. `scripts/download.py` – downloads the 4K orbit video (`...orbit_2160p30.mp4`, ~70 MB) and extracts the 12 frames as
   lossless PNG into `data/raw/` (video frame numbers are exact; read sequentially).
2. `scripts/verify_inputs.py` – confirms all 12 open and that the date stamp lies outside the disc.
3. `scripts/build_features.py`:
   - Pass 1: seeded random sample of 40 000 disc pixels per frame (480 000 total); fit **one**
     `KMeans(k=10, n_init=10, random_state=42)` on RGB; sort clusters by brightness.
   - Group each cluster by its centroid colour into clear / brownDark / brownLight / grayWhite / hot (rules in
     `group_of()`): clear = very dark, hot = saturated orange/red, grayWhite = bright low-saturation, brownDark /
     brownLight = the brown range split by brightness.
   - Pass 2: classify every disc pixel of every frame; compute the features above.
   - Saves the 1600×900 Lanczos WebP (q90) for display only.
4. `scripts/make_sample.py` – writes the placeholder sample.

Deterministic: two consecutive full runs give byte-identical `features.json` and WebP files (`scripts/run_twice_check.py`).

## Known limits

- Only 12 of 1176 frames, unevenly spaced, from a video (lossy).
- Rotation and time of day change what is visible, so frame-to-frame differences are not pure CO₂ change.
- The brown and gray groups are mostly base map, not CO₂.
- The group rules are a judgment on colours, not a physical CO₂ classification.

## Rerun

```
cd ml_co2
pip install -r requirements.txt
cd scripts
python download.py          # ~70 MB video into ../data/raw, extracts 12 frames
python verify_inputs.py
python fit_camera.py        # camera angles -> camera.json (~10 min; camera.json is already included)
python build_features.py    # frames, features.json, diagnostics (~30 s)
python make_sample.py
python run_twice_check.py   # optional determinism check
```
