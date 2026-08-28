import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from design_acceptance_vision.io import safe_path, stitch_segments


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
