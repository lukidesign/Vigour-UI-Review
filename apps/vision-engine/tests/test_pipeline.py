from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from design_acceptance_vision.pipeline import analyze


def test_pipeline_rejects_unknown_or_non_finite_rules(tmp_path: Path) -> None:
    image = np.full((20, 20, 3), 255, dtype=np.uint8)
    Image.fromarray(image).save(tmp_path / "a.png")
    with pytest.raises(ValueError, match="INVALID_RULES"):
        analyze(tmp_path / "a.png", tmp_path / "a.png", tmp_path / "out.png", {"unknown": 1})
    with pytest.raises(ValueError, match="INVALID_RULES"):
        analyze(tmp_path / "a.png", tmp_path / "a.png", tmp_path / "out.png", {"color_delta": float("nan")})
