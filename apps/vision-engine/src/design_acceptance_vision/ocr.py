from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class OcrLine:
    text: str
    confidence: float
    box: tuple[int, int, int, int]


class OcrEngine(Protocol):
    def recognize(self, path: Path) -> list[OcrLine]: ...


class PaddleOcrEngine:
    """Lazily imports PaddleOCR so the deterministic pixel pipeline remains usable offline."""

    def __init__(self, language: str = "ch") -> None:
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        try:
            from paddleocr import PaddleOCR  # type: ignore[import-not-found]
        except ImportError as error:
            raise RuntimeError("PADDLE_OCR_NOT_INSTALLED") from error
        self._engine = PaddleOCR(lang=language, use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False)

    def recognize(self, path: Path) -> list[OcrLine]:
        results = self._engine.predict(str(path))
        lines: list[OcrLine] = []
        for result in results:
            data = result.json.get("res", result.json)
            texts = data.get("rec_texts", [])
            scores = data.get("rec_scores", [])
            boxes = data.get("rec_boxes", [])
            for text, score, box in zip(texts, scores, boxes, strict=False):
                x1, y1, x2, y2 = (int(value) for value in box)
                lines.append(OcrLine(str(text), float(score), (x1, y1, x2 - x1, y2 - y1)))
        return lines


def compare_text(reference: list[OcrLine], candidate: list[OcrLine]) -> list[dict[str, object]]:
    issues: list[dict[str, object]] = []
    remaining = list(candidate)
    for expected in reference:
        if not remaining:
            issues.append({"type": "text", "expected": expected.text, "actual": "", "box": expected.box, "confidence": "medium"})
            continue
        actual = min(remaining, key=lambda item: abs(item.box[0] - expected.box[0]) + abs(item.box[1] - expected.box[1]))
        remaining.remove(actual)
        if expected.text != actual.text:
            issues.append({"type": "text", "expected": expected.text, "actual": actual.text, "box": actual.box, "confidence": "high" if min(expected.confidence, actual.confidence) >= 0.9 else "medium"})
    return issues
