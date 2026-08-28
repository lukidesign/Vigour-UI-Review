from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import cv2

from . import __version__
from .alignment import align_images, warp_candidate
from .detectors import detect_stable, make_diff_overlay
from .io import encode_png, read_rgb, write_rgb
from .ocr import PaddleOcrEngine, compare_text


MAX_ASPECT_RATIO_DIFFERENCE = 0.01


def _normalize_candidate(reference: np.ndarray, candidate: np.ndarray) -> tuple[np.ndarray, dict[str, object]]:
    reference_height, reference_width = reference.shape[:2]
    candidate_height, candidate_width = candidate.shape[:2]
    reference_ratio = reference_width / reference_height
    candidate_ratio = candidate_width / candidate_height
    ratio_difference = abs(candidate_ratio - reference_ratio) / reference_ratio
    if ratio_difference > MAX_ASPECT_RATIO_DIFFERENCE + 1e-12:
        raise ValueError("IMAGE_ASPECT_RATIO_MISMATCH")

    applied = reference.shape != candidate.shape
    scale_x = reference_width / candidate_width
    scale_y = reference_height / candidate_height
    if applied:
        interpolation = cv2.INTER_AREA if candidate_width * candidate_height > reference_width * reference_height else cv2.INTER_LINEAR
        candidate = cv2.resize(candidate, (reference_width, reference_height), interpolation=interpolation)

    return candidate, {
        "applied": applied,
        "reference": {"width": reference_width, "height": reference_height},
        "candidate": {"width": candidate_width, "height": candidate_height},
        "target": {"width": reference_width, "height": reference_height},
        "aspect_ratio_difference_percent": round(ratio_difference * 100, 4),
        "scale_x": round(scale_x, 8),
        "scale_y": round(scale_y, 8),
    }


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
    candidate, normalization = _normalize_candidate(reference, candidate)
    alignment = align_images(reference, candidate)
    aligned = warp_candidate(candidate, alignment, reference.shape[:2])
    issues = detect_stable(reference, aligned, **active_rules)
    serialized_issues = [issue.to_dict() for issue in issues]
    if use_ocr:
        ocr = PaddleOcrEngine()
        ocr_candidate_path = candidate_path
        temporary_ocr_path: Path | None = None
        if normalization["applied"]:
            temporary_ocr_path = evidence_path.with_name(f".{evidence_path.stem}.ocr-candidate.png")
            write_rgb(temporary_ocr_path, candidate)
            ocr_candidate_path = temporary_ocr_path
        try:
            text_issues = compare_text(ocr.recognize(reference_path), ocr.recognize(ocr_candidate_path))
        finally:
            if temporary_ocr_path is not None:
                temporary_ocr_path.unlink(missing_ok=True)
        for item in text_issues:
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
        "normalization": normalization,
        "issues": serialized_issues,
        "evidence_path": str(evidence_path),
    }
