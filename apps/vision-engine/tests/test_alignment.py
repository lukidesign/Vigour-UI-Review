import cv2
import numpy as np

from design_acceptance_vision.alignment import align_images


def test_alignment_recovers_translation() -> None:
    reference = np.full((240, 320, 3), 245, dtype=np.uint8)
    for index in range(10):
        x = 15 + index * 27
        cv2.rectangle(reference, (x, 30 + index * 13), (x + 18, 50 + index * 13), (20 + index * 15, 60, 160), -1)
    transform = np.float32([[1, 0, 7], [0, 1, -5]])
    candidate = cv2.warpAffine(reference, transform, (320, 240), borderValue=(245, 245, 245))
    alignment = align_images(reference, candidate)
    assert abs(float(alignment.matrix[0, 2]) + 7) <= 2
    assert abs(float(alignment.matrix[1, 2]) - 5) <= 2
    assert alignment.confidence > 0.3
