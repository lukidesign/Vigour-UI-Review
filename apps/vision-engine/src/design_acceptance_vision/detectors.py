from __future__ import annotations

import math

import cv2
import numpy as np

from .models import Box, Component, DetectionIssue


def _background_lab(image: np.ndarray) -> np.ndarray:
    border = np.concatenate((image[0], image[-1], image[:, 0], image[:, -1]), axis=0)
    median_rgb = np.median(border, axis=0).astype(np.uint8).reshape(1, 1, 3)
    return cv2.cvtColor(median_rgb, cv2.COLOR_RGB2LAB).reshape(3).astype(np.float32)


def components(image: np.ndarray, minimum_area: int = 16) -> list[Component]:
    lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB).astype(np.float32)
    distance = np.linalg.norm(lab - _background_lab(image), axis=2)
    mask = np.uint8(distance > 10) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    result: list[Component] = []
    for label in range(1, count):
        x, y, width, height, area = (int(value) for value in stats[label])
        if area < minimum_area or width < 2 or height < 2:
            continue
        pixels = lab[labels == label]
        result.append(Component(Box(x, y, width, height), np.median(pixels, axis=0), area))
    return result


def _match(reference: list[Component], candidate: list[Component], diagonal: float) -> tuple[list[tuple[Component, Component]], list[Component], list[Component]]:
    possibilities: list[tuple[float, int, int]] = []
    for left_index, left in enumerate(reference):
        for right_index, right in enumerate(candidate):
            dx = left.box.center[0] - right.box.center[0]
            dy = left.box.center[1] - right.box.center[1]
            center_cost = math.hypot(dx, dy) / max(diagonal, 1)
            size_cost = abs(math.log(max(right.box.area, 1) / max(left.box.area, 1)))
            color_cost = float(np.linalg.norm(left.color_lab - right.color_lab)) / 100
            cost = center_cost * 3 + size_cost * 0.5 + color_cost * 0.15
            if center_cost < 0.2 and size_cost < 1.5:
                possibilities.append((cost, left_index, right_index))
    used_left: set[int] = set()
    used_right: set[int] = set()
    matches: list[tuple[Component, Component]] = []
    for _, left_index, right_index in sorted(possibilities):
        if left_index in used_left or right_index in used_right:
            continue
        used_left.add(left_index)
        used_right.add(right_index)
        matches.append((reference[left_index], candidate[right_index]))
    return (
        matches,
        [item for index, item in enumerate(reference) if index not in used_left],
        [item for index, item in enumerate(candidate) if index not in used_right],
    )


def _severity(delta: float, major: float, critical: float) -> str:
    return "critical" if delta >= critical else "major" if delta >= major else "minor"


def detect_stable(reference: np.ndarray, candidate: np.ndarray, *, position_px: float = 2, size_px: float = 2, color_delta: float = 8) -> list[DetectionIssue]:
    if reference.shape != candidate.shape:
        raise ValueError("IMAGE_DIMENSION_MISMATCH")
    height, width = reference.shape[:2]
    matched, missing, extra = _match(components(reference), components(candidate), math.hypot(width, height))
    issues: list[DetectionIssue] = []
    for expected, actual in matched:
        dx = actual.box.center[0] - expected.box.center[0]
        dy = actual.box.center[1] - expected.box.center[1]
        position_delta = math.hypot(dx, dy)
        if position_delta > position_px:
            horizontal = f"向右偏了 {abs(round(dx))} 像素" if dx > 0 else f"向左偏了 {abs(round(dx))} 像素" if dx < 0 else ""
            vertical = f"向下偏了 {abs(round(dy))} 像素" if dy > 0 else f"向上偏了 {abs(round(dy))} 像素" if dy < 0 else ""
            description = "，".join(part for part in (horizontal, vertical) if part)
            issues.append(DetectionIssue("position", _severity(position_delta, 8, 24), "high", "元素位置不一致", description, actual.box, delta=round(position_delta, 2), unit="px"))
        dw = actual.box.width - expected.box.width
        dh = actual.box.height - expected.box.height
        size_delta = max(abs(dw), abs(dh))
        if size_delta > size_px:
            parts = []
            if dw: parts.append(f"宽度{'多' if dw > 0 else '少'}了 {abs(dw)} 像素")
            if dh: parts.append(f"高度{'多' if dh > 0 else '少'}了 {abs(dh)} 像素")
            issues.append(DetectionIssue("size", _severity(size_delta, 8, 24), "high", "元素尺寸不一致", "，".join(parts), actual.box, delta=float(size_delta), unit="px"))
        delta_e = float(np.linalg.norm(expected.color_lab - actual.color_lab))
        if delta_e > color_delta:
            issues.append(DetectionIssue("color", _severity(delta_e, 18, 35), "medium", "元素颜色不一致", f"颜色差异约为 {delta_e:.1f}", actual.box, delta=round(delta_e, 2), unit="color-distance"))
    for item in missing:
        issues.append(DetectionIssue("missing", "critical", "medium", "页面缺少元素", "设计稿中的这个元素没有出现在开发页面", item.box))
    for item in extra:
        issues.append(DetectionIssue("extra", "major", "medium", "页面多出元素", "开发页面比设计稿多出了这个元素", item.box))
    return issues


def make_diff_overlay(reference: np.ndarray, candidate: np.ndarray) -> np.ndarray:
    delta = cv2.absdiff(reference, candidate)
    intensity = np.max(delta, axis=2)
    overlay = candidate.copy()
    overlay[intensity > 18] = np.array([242, 76, 91], dtype=np.uint8)
    return cv2.addWeighted(candidate, 0.55, overlay, 0.45, 0)
