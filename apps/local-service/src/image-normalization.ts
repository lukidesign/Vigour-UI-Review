export const MAX_ASPECT_RATIO_DIFFERENCE_PERCENT = 1;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageNormalizationPlan {
  compatible: boolean;
  applied: boolean;
  reference: ImageDimensions;
  candidate: ImageDimensions;
  target: ImageDimensions;
  aspectRatioDifferencePercent: number;
  scaleX: number;
  scaleY: number;
}

export function planImageNormalization(reference: ImageDimensions, candidate: ImageDimensions): ImageNormalizationPlan {
  const safeReference = { width: reference.width, height: reference.height };
  const safeCandidate = { width: candidate.width, height: candidate.height };
  const referenceRatio = safeReference.width / safeReference.height;
  const candidateRatio = safeCandidate.width / safeCandidate.height;
  const aspectRatioDifferencePercent = Math.abs(candidateRatio - referenceRatio) / referenceRatio * 100;
  return {
    compatible: aspectRatioDifferencePercent <= MAX_ASPECT_RATIO_DIFFERENCE_PERCENT + 1e-9,
    applied: safeReference.width !== safeCandidate.width || safeReference.height !== safeCandidate.height,
    reference: safeReference,
    candidate: safeCandidate,
    target: { ...safeReference },
    aspectRatioDifferencePercent,
    scaleX: safeReference.width / safeCandidate.width,
    scaleY: safeReference.height / safeCandidate.height,
  };
}

export function incompatibleImageResponse(plan: ImageNormalizationPlan) {
  return {
    code: 'IMAGE_ASPECT_RATIO_MISMATCH',
    thresholdPercent: MAX_ASPECT_RATIO_DIFFERENCE_PERCENT,
    differencePercent: Number(plan.aspectRatioDifferencePercent.toFixed(2)),
    reference: plan.reference,
    candidate: plan.candidate,
    target: plan.target,
  };
}
