from __future__ import annotations

import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from design_acceptance_vision.detectors import detect_stable


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / ".benchmark-output"
TYPES = ("position", "size", "color", "missing", "extra")


def box(x: int, y: int, width: int = 70, height: int = 42) -> dict[str, int]:
    return {"x": x, "y": y, "width": width, "height": height}


def draw(image: np.ndarray, item: dict[str, int], color: tuple[int, int, int]) -> None:
    cv2.rectangle(image, (item["x"], item["y"]), (item["x"] + item["width"] - 1, item["y"] + item["height"] - 1), color, -1)


def make_pair(index: int) -> tuple[np.ndarray, np.ndarray, list[dict[str, object]]]:
    design = np.full((700, 1000, 3), (248, 249, 251), dtype=np.uint8)
    implementation = design.copy()
    truth: list[dict[str, object]] = []
    shift = (index % 5) * 2
    colors = [(45, 106, 220), (34, 168, 112), (221, 128, 42), (141, 80, 210), (202, 65, 94), (40, 150, 175), (115, 118, 126), (190, 150, 32)]

    # Two translated components.
    for lane in range(2):
        expected = box(60 + lane * 180, 60 + shift)
        actual = box(expected["x"] + 9 + lane, expected["y"] + 5)
        draw(design, expected, colors[lane]); draw(implementation, actual, colors[lane])
        truth.append({"type": "position", "box": actual})
    # Two centered size changes, avoiding accidental position findings.
    for lane in range(2):
        expected = box(420 + lane * 190, 60 + shift)
        actual = box(expected["x"] - 7, expected["y"] - 5, expected["width"] + 14, expected["height"] + 10)
        draw(design, expected, colors[lane + 2]); draw(implementation, actual, colors[lane + 2])
        truth.append({"type": "size", "box": actual})
    # Two color substitutions.
    for lane in range(2):
        expected = box(100 + lane * 240, 250 + shift)
        draw(design, expected, colors[lane + 4]); draw(implementation, expected, colors[lane + 6])
        truth.append({"type": "color", "box": expected})
    # Missing elements are kept far from extras so geometry matching cannot pair them.
    for lane in range(2):
        expected = box(55 + lane * 130, 480 + lane * 80)
        draw(design, expected, colors[lane + 1]); truth.append({"type": "missing", "box": expected})
    for lane in range(2):
        actual = box(820 + lane * 85, 470 + lane * 95, 62, 38)
        draw(implementation, actual, colors[lane + 3]); truth.append({"type": "extra", "box": actual})
    # Stable anchors improve realistic alignment and component matching.
    for lane in range(4):
        stable = box(100 + lane * 210, 370, 90, 34)
        draw(design, stable, (80 + lane * 20, 90, 130)); draw(implementation, stable, (80 + lane * 20, 90, 130))
    return design, implementation, truth


def center(item: dict[str, int]) -> tuple[float, float]:
    return item["x"] + item["width"] / 2, item["y"] + item["height"] / 2


def evaluate() -> dict[str, object]:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    truth_count = predicted_count = matched_count = 0
    coordinate_errors: list[float] = []
    manifest: list[dict[str, object]] = []
    for index in range(50):
        design, implementation, truth = make_pair(index)
        issues = detect_stable(design, implementation)
        predictions = [{"type": issue.type, "box": issue.box.to_dict()} for issue in issues]
        used: set[int] = set()
        for expected in truth:
            expected_center = center(expected["box"])
            candidates = []
            for prediction_index, prediction in enumerate(predictions):
                if prediction_index in used or prediction["type"] != expected["type"]:
                    continue
                actual_center = center(prediction["box"])
                candidates.append((math.dist(expected_center, actual_center), prediction_index))
            if candidates:
                error, prediction_index = min(candidates)
                if error <= 20:
                    used.add(prediction_index); matched_count += 1; coordinate_errors.append(error)
        truth_count += len(truth); predicted_count += len(predictions)
        design_path = OUTPUT / f"pair-{index:02d}-design.png"
        implementation_path = OUTPUT / f"pair-{index:02d}-implementation.png"
        Image.fromarray(design).save(design_path); Image.fromarray(implementation).save(implementation_path)
        manifest.append({"pair": index, "design": design_path.name, "implementation": implementation_path.name, "truth": truth})
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf-8")
    precision = matched_count / predicted_count if predicted_count else 0
    recall = matched_count / truth_count if truth_count else 0
    coordinate_error = sum(coordinate_errors) / len(coordinate_errors) if coordinate_errors else float("inf")
    return {
        "pairs": 50, "annotated_differences": truth_count, "predicted": predicted_count, "matched": matched_count,
        "precision": round(precision, 4), "recall": round(recall, 4), "mean_coordinate_error_px": round(coordinate_error, 3),
        "by_detector": list(TYPES), "dataset": "deterministic synthetic Web UI baseline",
    }


if __name__ == "__main__":
    metrics = evaluate()
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    if metrics["precision"] < 0.90 or metrics["recall"] < 0.85 or metrics["mean_coordinate_error_px"] > 2:
        raise SystemExit("Benchmark thresholds not met")
