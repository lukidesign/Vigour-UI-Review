import cv2
import numpy as np

from design_acceptance_vision.detectors import detect_stable


def canvas() -> np.ndarray:
    return np.full((300, 420, 3), 250, dtype=np.uint8)


def test_stable_detectors_find_position_size_color_missing_and_extra() -> None:
    reference = canvas()
    candidate = canvas()
    cv2.rectangle(reference, (20, 20), (80, 70), (40, 100, 220), -1)
    cv2.rectangle(candidate, (29, 24), (89, 74), (40, 100, 220), -1)
    cv2.rectangle(reference, (120, 20), (180, 70), (30, 180, 100), -1)
    cv2.rectangle(candidate, (120, 20), (192, 78), (30, 180, 100), -1)
    cv2.rectangle(reference, (220, 20), (280, 70), (190, 80, 50), -1)
    cv2.rectangle(candidate, (220, 20), (280, 70), (60, 100, 210), -1)
    cv2.rectangle(reference, (20, 140), (80, 190), (130, 80, 160), -1)
    cv2.rectangle(candidate, (320, 140), (380, 190), (220, 160, 30), -1)
    issue_types = {issue.type for issue in detect_stable(reference, candidate)}
    assert {"position", "size", "color", "missing", "extra"}.issubset(issue_types)


def test_identical_images_have_no_issues() -> None:
    image = canvas()
    cv2.rectangle(image, (20, 20), (80, 70), (40, 100, 220), -1)
    assert detect_stable(image, image) == []
