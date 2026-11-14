"""Step 1: download the 12 TIFF frames with curl (resumable) into ml/data/raw/."""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
BASE = ("http://svs.gsfc.nasa.gov/vis/a000000/a005200/a005276/frames/"
        "7680x4320_16x9_3p/nightlights_flat_2012-2023/"
        "nightlights_flat_series_stills_8k.0{year}.tif")
YEARS = list(range(2012, 2024))

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    for y in YEARS:
        dest = RAW / f"nightlights_{y}.tif"
        if dest.exists() and dest.stat().st_size > 1_000_000:
            print(f"{y}: exists ({dest.stat().st_size/1e6:.1f} MB)")
            continue
        print(f"{y}: downloading...", flush=True)
        r = subprocess.run(["curl", "-L", "-f", "-C", "-", "--retry", "3", "-o", str(dest), BASE.format(year=y)])
        if r.returncode != 0:
            sys.exit(f"download failed for {y}")

if __name__ == "__main__":
    main()
