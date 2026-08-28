from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from . import __version__
from .alignment import align_images, warp_candidate
from .detectors import detect_stable, make_diff_overlay
from .io import encode_png, read_rgb
from .ocr import PaddleOcrEngine, compare_text


def analyze(reference_path: Path, candidate_path: Path, evidence_path: Path, rules: dict[str, float] | None = None, use_ocr: bool = False) -> dict[str, object]:
    active_rules = {"position_px": 2.0, "size_px": 2.0, "color_delta": 8.0, **(rules or {})}
    allowed_ranges = {"position_px": (0.0, 100.0), "size_px": (0.0, 100.0), "color_delta": (0.0, 255.0)}
    if set(active_rules) != set(allowed_ranges):
        raise ValueError("INVALID_RULES")
    for key, value in active_rules.items():
        minimum, maximum = allowed_ranges[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
            raise ValueError("INVALID_RULES")
    reference = read_rgb(reference_path)
    candidate = read_rgb(candidate_path)
    if reference.shape != candidate.shape:
        raise ValueError("IMAGE_DIMENSION_MISMATCH")
    alignment = align_images(reference, candidate)
    aligned = warp_candidate(candidate, alignment, reference.shape[:2])
    issues = detect_stable(reference, aligned, **active_rules)
    serialized_issues = [issue.to_dict() for issue in issues]
    if use_ocr:
        ocr = PaddleOcrEngine()
        for item in compare_text(ocr.recognize(reference_path), ocr.recognize(candidate_path)):
            expected = str(item["expected"])
            actual = str(item["actual"])
            x, y, width, height = item["box"]  # type: ignore[misc]
            serialized_issues.append({
                "type": "text",
                "severity": "major",
                "confidence": item["confidence"],
                "title": "文字内容不一致",
                "plain_description": f"文字应为“{expected}”，实际是“{actual}”",
                "box": {"x": x, "y": y, "width": width, "height": height},
                "expected": expected,
                "actual": actual,
                "unit": "text",
            })
    encode_png(evidence_path, make_diff_overlay(reference, aligned))
    rules_hash = hashlib.sha256(json.dumps(active_rules, sort_keys=True).encode()).hexdigest()
    return {
        "engine_version": __version__,
        "rules_hash": rules_hash,
        "alignment": alignment.to_dict(),
        "issues": serialized_issues,
        "evidence_path": str(evidence_path),
    }
