import { describe, expect, it } from 'vitest';
import { incompatibleImageResponse, planImageNormalization } from './image-normalization.js';

describe('image normalization planning', () => {
  it('allows proportional images and reports a non-destructive resize', () => {
    expect(planImageNormalization({ width: 1000, height: 500 }, { width: 2000, height: 1000 })).toMatchObject({
      compatible: true,
      applied: true,
      scaleX: 0.5,
      scaleY: 0.5,
      target: { width: 1000, height: 500 },
    });
  });

  it('includes the one-percent boundary', () => {
    const plan = planImageNormalization({ width: 100, height: 100 }, { width: 101, height: 100 });
    expect(plan.compatible).toBe(true);
    expect(plan.aspectRatioDifferencePercent).toBeCloseTo(1);
  });

  it('blocks larger aspect-ratio differences with safe structured details', () => {
    const plan = planImageNormalization({ width: 1724, height: 888 }, { width: 2562, height: 1404 });
    expect(plan.compatible).toBe(false);
    expect(incompatibleImageResponse(plan)).toEqual({
      code: 'IMAGE_ASPECT_RATIO_MISMATCH',
      thresholdPercent: 1,
      differencePercent: 6.01,
      reference: { width: 1724, height: 888 },
      candidate: { width: 2562, height: 1404 },
      target: { width: 1724, height: 888 },
    });
  });
});
