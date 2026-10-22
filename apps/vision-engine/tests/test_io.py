import json
import math
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from design_acceptance_vision.io import safe_path, stitch_segments


@pytest.mark.parametrize("dpr", [1, 1.25, 1.5, 1.3875])
@pytest.mark.parametrize("count", [1, 3, 10])
def test_stitch_fractional_rasterization_preserves_pixels(tmp_path: Path, dpr: float, count: int) -> None:
    css_width, viewport = 1387, 732
    page_height = viewport * count - 37
    width = math.floor(css_width * dpr + 0.5) + 1
    height = math.floor(page_height * dpr + 0.5)
    segment_height = math.ceil(viewport * dpr)
    manifest = []
    for index in range(count):
        y = min(index * viewport, max(0, page_height - viewport))
        top = math.floor(y * dpr + 0.5)
        pixels = np.zeros((segment_height, width, 3), dtype=np.uint8)
        pixels[:, :, 0] = ((np.arange(segment_height) + top) % 251)[:, None]
        pixels[:, -1, 2] = 255
        filename = f"segment-{index}.png"
        Image.fromarray(pixels).save(tmp_path / filename)
        manifest.append({"filename": filename, "y": y})
    (tmp_path / "segments.json").write_text(json.dumps(manifest), encoding="utf-8")
    result = stitch_segments(tmp_path / "segments.json", tmp_path / "result.png", css_width, page_height, dpr, viewport)
    assert result["width"] == width
    assert result["height"] == height
    with Image.open(tmp_path / "result.png") as image:
        actual = np.asarray(image)
        assert np.array_equal(actual[:, 0, 0], np.arange(height) % 251)
        assert np.all(actual[:, -1, 2] == 255)  # right edge neither cropped nor resampled


@pytest.mark.parametrize("second_width,y,error", [
    (104, 50, "SEGMENT_DIMENSION_MISMATCH"),  # beyond the +/-2 tolerance
    (100, 50, "SEGMENT_DIMENSION_MISMATCH"),  # viewport changes between segments
    (101, 51, "SEGMENT_COVERAGE_GAP"),
    (101, -1, "SEGMENT_DIMENSION_MISMATCH"),
])
def test_stitch_still_rejects_invalid_segments(tmp_path: Path, second_width: int, y: int, error: str) -> None:
    for filename, width in [("first.png", 101), ("second.png", second_width)]:
        Image.fromarray(np.zeros((50, width, 3), dtype=np.uint8)).save(tmp_path / filename)
    (tmp_path / "segments.json").write_text(json.dumps([
        {"filename": "first.png", "y": 0}, {"filename": "second.png", "y": y},
    ]), encoding="utf-8")
    with pytest.raises(ValueError, match=error):
        stitch_segments(tmp_path / "segments.json", tmp_path / "result.png", 100, 100, 1, 50)


def test_stitch_segments_handles_last_overlap(tmp_path: Path) -> None:
    first = np.full((60, 100, 3), (255, 0, 0), dtype=np.uint8)
    second = np.full((60, 100, 3), (0, 0, 255), dtype=np.uint8)
    Image.fromarray(first).save(tmp_path / "first.png")
    Image.fromarray(second).save(tmp_path / "second.png")
    manifest = [{"filename": "first.png", "y": 0}, {"filename": "second.png", "y": 40}]
    (tmp_path / "segments.json").write_text(json.dumps(manifest), "utf-8")
    output = tmp_path / "stitched.png"
    result = stitch_segments(tmp_path / "segments.json", output, 100, 100, 1)
    pixels = np.asarray(Image.open(output))
    assert result["segments"] == 2
    assert tuple(pixels[20, 20]) == (255, 0, 0)
    assert tuple(pixels[50, 20]) == (0, 0, 255)


def test_safe_path_blocks_traversal_and_symlink(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside.txt"
    outside.write_text("secret", "utf-8")
    with pytest.raises(ValueError, match="PATH_OUTSIDE_DATA_ROOT"):
        safe_path(tmp_path, str(outside))
    link = tmp_path / "link"
    link.symlink_to(outside)
    with pytest.raises(ValueError):
        safe_path(tmp_path, str(link))
