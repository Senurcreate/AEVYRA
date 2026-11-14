"""NASA SVS 5196 "DYAMOND Global Carbon Dioxide", globe ORBIT animation (Jan-Mar 2020).

Downloads the 4K orbit video and extracts 12 frames into ml_co2/data/raw/.

Why this video: the camera distance is constant (the globe keeps the same size and position, so the zoom problem of the
zoom animations does not apply). The globe slowly rotates, so different continents face the camera over time.

The video has 1176 frames (frame numbers 1-1176 = position in the video). We skip the first 12 (1-12) and pick 12 at
random (seeded, same 12 every run) from 13-1176, kept in frame order. Frames are saved as lossless PNG
co2_NNNNN.png. Note the video itself is lossy (compressed), unlike the PNG frame sets of other NASA pages.
"""
import subprocess, sys
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
VIDEO_URL = ("https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/"
             "dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_2160p30.mp4")
VIDEO = RAW / "co2_orbit_2160p30.mp4"
FIRST_ALLOWED, LAST, COUNT, SEED = 13, 1176, 12, 42


def picked_indices():
    rng = np.random.default_rng(SEED)
    return sorted(int(i) for i in rng.choice(np.arange(FIRST_ALLOWED, LAST + 1), COUNT, replace=False))


def raw_path(i):
    return RAW / f"co2_{i:05d}.png"


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    idx = picked_indices()
    print("frames:", idx)
    if not (VIDEO.exists() and VIDEO.stat().st_size > 10_000_000):
        r = subprocess.run(["curl", "-L", "-f", "-C", "-", "--retry", "3", "-o", str(VIDEO), VIDEO_URL])
        if r.returncode != 0:
            sys.exit("video download failed")
    cap = cv2.VideoCapture(str(VIDEO))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print("video frames:", n, "size", int(cap.get(3)), "x", int(cap.get(4)))
    assert n == LAST, f"expected {LAST} frames, video has {n}"
    want = set(idx)
    k = 0                                            # sequential read: exact frame numbers (1-based)
    while True:
        ok, f = cap.read()
        if not ok:
            break
        k += 1
        if k in want:
            cv2.imwrite(str(raw_path(k)), f)         # BGR -> PNG, lossless
            print("saved", k, flush=True)
    assert all(raw_path(i).exists() for i in idx), "some frames were not extracted"


if __name__ == "__main__":
    main()
