from __future__ import annotations

import cv2
import numpy as np

from .models import Alignment


def _gray(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)


def align_images(reference: np.ndarray, candidate: np.ndarray, seed: int = 20260828) -> Alignment:
    if reference.shape != candidate.shape:
        return Alignment(np.array([[1, 0, 0], [0, 1, 0]], dtype=np.float32), 0.0, "identity")
    cv2.setRNGSeed(seed)
    orb = cv2.ORB_create(nfeatures=2500, fastThreshold=8)
    key_ref, desc_ref = orb.detectAndCompute(_gray(reference), None)
    key_candidate, desc_candidate = orb.detectAndCompute(_gray(candidate), None)
    if desc_ref is not None and desc_candidate is not None and len(key_ref) >= 8 and len(key_candidate) >= 8:
        pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(desc_candidate, desc_ref, k=2)
        good = [first for first, second in pairs if first.distance < 0.75 * second.distance]
        if len(good) >= 6:
            source = np.float32([key_candidate[item.queryIdx].pt for item in good])
            target = np.float32([key_ref[item.trainIdx].pt for item in good])
            matrix, inliers = cv2.estimateAffinePartial2D(source, target, method=cv2.RANSAC, ransacReprojThreshold=2.0)
            if matrix is not None and inliers is not None:
                confidence = float(inliers.mean())
                scale = float(np.hypot(matrix[0, 0], matrix[0, 1]))
                if 0.8 <= scale <= 1.25 and confidence >= 0.35:
                    return Alignment(matrix.astype(np.float32), confidence, "orb")

    shift, response = cv2.phaseCorrelate(np.float32(_gray(reference)), np.float32(_gray(candidate)))
    # phaseCorrelate returns the shift from reference to candidate, so invert it.
    matrix = np.array([[1, 0, -shift[0]], [0, 1, -shift[1]]], dtype=np.float32)
    confidence = max(0.0, min(1.0, float(response)))
    if confidence < 0.05:
        return Alignment(np.array([[1, 0, 0], [0, 1, 0]], dtype=np.float32), confidence, "identity")
    return Alignment(matrix, confidence, "phase")


def warp_candidate(candidate: np.ndarray, alignment: Alignment, output_shape: tuple[int, int]) -> np.ndarray:
    height, width = output_shape
    return cv2.warpAffine(candidate, alignment.matrix, (width, height), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
