from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from design_acceptance_vision import pipeline
from design_acceptance_vision.pipeline import analyze


def test_pipeline_rejects_unknown_or_non_finite_rules(tmp_path: Path) -> None:
    image = np.full((20, 20, 3), 255, dtype=np.uint8)
    Image.fromarray(image).save(tmp_path / "a.png")
    with pytest.raises(ValueError, match="INVALID_RULES"):
        analyze(tmp_path / "a.png", tmp_path / "a.png", tmp_path / "out.png", {"unknown": 1})
    with pytest.raises(ValueError, match="INVALID_RULES"):
        analyze(tmp_path / "a.png", tmp_path / "a.png", tmp_path / "out.png", {"color_delta": float("nan")})


def test_pipeline_normalizes_proportional_images_without_overwriting_sources(tmp_path: Path) -> None:
    reference = np.full((40, 80, 3), 255, dtype=np.uint8)
    candidate = np.full((80, 160, 3), 255, dtype=np.uint8)
    reference_path = tmp_path / "reference.png"
    candidate_path = tmp_path / "candidate.png"
    Image.fromarray(reference).save(reference_path)
    Image.fromarray(candidate).save(candidate_path)

    result = analyze(reference_path, candidate_path, tmp_path / "out.png")

    assert result["normalization"] == {
        "applied": True,
        "reference": {"width": 80, "height": 40},
        "candidate": {"width": 160, "height": 80},
        "target": {"width": 80, "height": 40},
        "aspect_ratio_difference_percent": 0.0,
        "scale_x": 0.5,
        "scale_y": 0.5,
    }
    assert Image.open(candidate_path).size == (160, 80)
    assert Image.open(tmp_path / "out.png").size == (80, 40)


def test_pipeline_blocks_aspect_ratio_difference_over_one_percent(tmp_path: Path) -> None:
    Image.fromarray(np.full((100, 100, 3), 255, dtype=np.uint8)).save(tmp_path / "reference.png")
    Image.fromarray(np.full((100, 102, 3), 255, dtype=np.uint8)).save(tmp_path / "candidate.png")

    with pytest.raises(ValueError, match="IMAGE_ASPECT_RATIO_MISMATCH"):
        analyze(tmp_path / "reference.png", tmp_path / "candidate.png", tmp_path / "out.png")


def test_ocr_uses_normalized_temporary_candidate_and_cleans_it_up(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    Image.fromarray(np.full((40, 80, 3), 255, dtype=np.uint8)).save(tmp_path / "reference.png")
    Image.fromarray(np.full((80, 160, 3), 255, dtype=np.uint8)).save(tmp_path / "candidate.png")
    observed: list[tuple[Path, tuple[int, int]]] = []

    class RecordingOcr:
        def recognize(self, path: Path) -> list[object]:
            with Image.open(path) as image:
                observed.append((path, image.size))
            return []

    monkeypatch.setattr(pipeline, "PaddleOcrEngine", RecordingOcr)
    analyze(tmp_path / "reference.png", tmp_path / "candidate.png", tmp_path / "out.png", use_ocr=True)

    assert observed[0] == (tmp_path / "reference.png", (80, 40))
    assert observed[1][0] != tmp_path / "candidate.png"
    assert observed[1][1] == (80, 40)
    assert not observed[1][0].exists()
