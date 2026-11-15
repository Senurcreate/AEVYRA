"""Shared helpers for the aerosol preprocessing (separate from the night-lights pipeline in ../ml)."""
from pathlib import Path
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DIAG = ROOT / "diagnostics"
OUT = ROOT / "output"
FRAMES = OUT / "frames"


def load_rgb8(path):
    """PNG -> (H, W, 3) uint8 RGB. These frames are 8-bit RGBA with alpha 255 everywhere; alpha is dropped
    after compositing on black (a no-op for fully opaque frames)."""
    im = Image.open(path)
    a = np.asarray(im)
    if a.ndim == 2:
        a = np.stack([a] * 3, axis=-1)
    if a.dtype == np.uint16:
        a = np.rint(a.astype(np.float32) * (255.0 / 65535.0)).astype(np.uint8)
    if a.shape[-1] == 4:
        alpha = a[..., 3]
        rgb = a[..., :3]
        if alpha.min() < 255:
            rgb = np.rint(rgb.astype(np.float32) * (alpha[..., None] / 255.0)).astype(np.uint8)
        return np.ascontiguousarray(rgb)
    return np.ascontiguousarray(a[..., :3])
