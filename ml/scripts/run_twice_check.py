"""Step 9: run build_features.py twice and confirm features.json and the webp frames are byte-identical."""
import hashlib, subprocess, sys
from common import OUT, FRAMES

def digest():
    h = {"features.json": hashlib.sha256((OUT / "features.json").read_bytes()).hexdigest()}
    for p in sorted(FRAMES.glob("*.webp")):
        h[p.name] = hashlib.sha256(p.read_bytes()).hexdigest()
    return h

runs = []
for i in range(2):
    subprocess.run([sys.executable, "build_features.py"], check=True, stdout=subprocess.DEVNULL)
    runs.append(digest())
print("IDENTICAL" if runs[0] == runs[1] else "DIFFERENT",
      [k for k in runs[0] if runs[0][k] != runs[1].get(k)])
