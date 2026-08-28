from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

import numpy as np


@dataclass(frozen=True)
class Box:
    x: int
    y: int
    width: int
    height: int

    @property
    def center(self) -> tuple[float, float]:
        return self.x + self.width / 2, self.y + self.height / 2

    @property
    def area(self) -> int:
        return self.width * self.height

    def to_dict(self) -> dict[str, int]:
        return asdict(self)


@dataclass(frozen=True)
class Component:
    box: Box
    color_lab: np.ndarray
    area: int


@dataclass(frozen=True)
class Alignment:
    matrix: np.ndarray
    confidence: float
    mode: Literal["orb", "phase", "identity"]

    def to_dict(self) -> dict[str, object]:
        return {
            "matrix": self.matrix.round(6).tolist(),
            "confidence": round(float(self.confidence), 4),
            "mode": self.mode,
        }


@dataclass(frozen=True)
class DetectionIssue:
    type: Literal["position", "size", "color", "text", "missing", "extra"]
    severity: Literal["critical", "major", "minor"]
    confidence: Literal["high", "medium", "low"]
    title: str
    plain_description: str
    box: Box
    expected: str | None = None
    actual: str | None = None
    delta: float | None = None
    unit: str | None = None

    def to_dict(self) -> dict[str, object]:
        value = asdict(self)
        value["box"] = self.box.to_dict()
        return {key: item for key, item in value.items() if item is not None}
