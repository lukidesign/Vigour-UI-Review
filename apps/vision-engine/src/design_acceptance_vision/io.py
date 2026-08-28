from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps


MAX_PIXELS = 40_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def safe_path(root: Path, value: str, *, must_exist: bool = True) -> Path:
    root = root.resolve()
    path = Path(value).resolve()
    if not path.is_relative_to(root):
        raise ValueError("PATH_OUTSIDE_DATA_ROOT")
    if must_exist and (not path.is_file() or path.is_symlink()):
        raise ValueError("INPUT_FILE_NOT_FOUND")
    return path


def read_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        if image.width * image.height > MAX_PIXELS:
            raise ValueError("IMAGE_LIMIT_EXCEEDED")
        return np.asarray(image).copy()


def write_rgb(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(path.suffix + ".tmp")
    Image.fromarray(image.astype(np.uint8), mode="RGB").save(temporary, format="PNG")
    temporary.chmod(0o600)
    temporary.replace(path)


def stitch_segments(manifest_path: Path, output_path: Path, page_width: int, page_height: int, dpr: float) -> dict[str, object]:
    if not (0.5 <= dpr <= 4):
        raise ValueError("INVALID_DPR")
    width = round(page_width * dpr)
    height = round(page_height * dpr)
    if width < 1 or height < 1 or width * height > MAX_PIXELS:
        raise ValueError("IMAGE_LIMIT_EXCEEDED")
    manifest = json.loads(manifest_path.read_text("utf-8"))
    if not isinstance(manifest, list) or not 1 <= len(manifest) <= 100:
        raise ValueError("INVALID_SEGMENT_MANIFEST")
    canvas = np.zeros((height, width, 3), dtype=np.uint8)
    coverage = np.zeros(height, dtype=np.bool_)
    capture_dir = manifest_path.parent.resolve()
    for entry in manifest:
        if not isinstance(entry, dict) or not isinstance(entry.get("filename"), str) or not isinstance(entry.get("y"), int):
            raise ValueError("INVALID_SEGMENT_MANIFEST")
        segment_path = safe_path(capture_dir, str(capture_dir / entry["filename"]))
        segment = read_rgb(segment_path)
        target_y = round(entry["y"] * dpr)
        if segment.shape[1] != width or target_y < 0 or target_y >= height:
            raise ValueError("SEGMENT_DIMENSION_MISMATCH")
        copy_height = min(segment.shape[0], height - target_y)
        canvas[target_y : target_y + copy_height] = segment[:copy_height]
        coverage[target_y : target_y + copy_height] = True
    if not bool(np.all(coverage)):
        raise ValueError("SEGMENT_COVERAGE_GAP")
    write_rgb(output_path, canvas)
    return {"width": width, "height": height, "segments": len(manifest), "output": str(output_path)}


def encode_png(path: Path, image: np.ndarray) -> None:
    success, data = cv2.imencode(".png", cv2.cvtColor(image, cv2.COLOR_RGB2BGR))
    if not success:
        raise RuntimeError("PNG_ENCODE_FAILED")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(data.tobytes())
    temporary.chmod(0o600)
    temporary.replace(path)
