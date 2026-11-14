"""Download 12 random frames of NASA SVS 5572 "GEOS Aerosols" (Aug 1 - Sep 14, 2024) into ml_aerosols/data/raw/.

The source folder has 2208 PNG frames (index 0000-2207, time order). We skip the first 12 (index 0-11) and pick 12
at random (seeded, so the same 12 every run) from index 12-2207. Frames are saved as aerosols_NNNN.png.
Disk use: about 26 MB per frame (about 315 MB total).
"""
import subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
BASE = ("https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005572/frames/6480x3240_2x1_30p/Aerosols/"
        "Aerosols_6840x3240_30p_{i:04d}.png")
FIRST_ALLOWED, LAST, COUNT, SEED = 12, 2207, 12, 42


def picked_indices():
    rng = np.random.default_rng(SEED)
    return sorted(int(i) for i in rng.choice(np.arange(FIRST_ALLOWED, LAST + 1), COUNT, replace=False))


def raw_path(i):
    return RAW / f"aerosols_{i:04d}.png"


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    idx = picked_indices()
    print("frames:", idx)
    for i in idx:
        dest = raw_path(i)
        if dest.exists() and dest.stat().st_size > 1_000_000:
            print(i, "exists"); continue
        print(i, "downloading...", flush=True)
        r = subprocess.run(["curl", "-L", "-f", "-C", "-", "--retry", "3", "-o", str(dest), BASE.format(i=i)])
        if r.returncode != 0:
            sys.exit(f"download failed for frame {i}")


if __name__ == "__main__":
    main()
