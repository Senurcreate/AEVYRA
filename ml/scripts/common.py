"""Shared helpers for the Aevyra night-lights preprocessing."""
from pathlib import Path
import json
import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DIAG = ROOT / "diagnostics"
OUT = ROOT / "output"
FRAMES = OUT / "frames"
YEARS = list(range(2012, 2024))
CROP_FILE = DIAG / "crop_box.json"


def raw_path(year):
    return RAW / f"nightlights_{year}.tif"


def _convert_block(a, alpha):
    """Convert one block of rows to uint8 RGB (same maths whatever the block size)."""
    if a.dtype == np.uint8:
        out = a
    elif a.dtype == np.uint16:
        out = np.rint(a.astype(np.float32) * (255.0 / 65535.0)).astype(np.uint8)
    elif np.issubdtype(a.dtype, np.floating):
        out = np.rint(np.clip(a, 0.0, 1.0) * 255.0).astype(np.uint8)
    else:
        info = np.iinfo(a.dtype)
        out = np.rint((a.astype(np.float32) - info.min) * (255.0 / (info.max - info.min))).astype(np.uint8)
    if alpha is not None:
        if alpha.dtype == np.uint8:
            amax = 255.0
        elif alpha.dtype.kind in "ui":
            amax = float(np.iinfo(alpha.dtype).max)
        else:
            amax = 1.0
        out = np.rint(out.astype(np.float32) * (alpha[..., None].astype(np.float32) / amax)).astype(np.uint8)
    return out


def load_rgb8(path, block_rows=256):
    """Read a TIFF and return an (H, W, 3) uint8 RGB array.

    Handles grayscale, RGBA (alpha composited on black), channel-first layouts, and 16-bit / float data
    (scaled by the dtype range, not truncated). Converts in row blocks to keep peak memory low.
    """
    a = np.squeeze(tifffile.imread(str(path)))
    if a.ndim == 2:
        a = np.stack([a] * 3, axis=-1)
    elif a.ndim == 3 and a.shape[0] in (1, 2, 3, 4) and a.shape[-1] not in (1, 2, 3, 4):
        a = np.moveaxis(a, 0, -1)
    if a.shape[-1] == 1:
        a = np.repeat(a, 3, axis=-1)
    if a.shape[-1] == 2:  # gray + alpha
        a = np.concatenate([np.repeat(a[..., :1], 3, axis=-1), a[..., 1:]], axis=-1)
    has_alpha = a.shape[-1] == 4
    out = np.empty(a.shape[:2] + (3,), np.uint8)
    for r in range(0, a.shape[0], block_rows):
        blk = a[r:r + block_rows]
        out[r:r + block_rows] = _convert_block(blk[..., :3], blk[..., 3] if has_alpha else None)
    return out


def luminance(rgb):
    """Rec.709 luma in 0-255 float32 from an (..., 3) uint8 array."""
    r = rgb.astype(np.float32)
    return r[..., 0] * 0.2126 + r[..., 1] * 0.7152 + r[..., 2] * 0.0722


def load_crop():
    return json.loads(CROP_FILE.read_text())
