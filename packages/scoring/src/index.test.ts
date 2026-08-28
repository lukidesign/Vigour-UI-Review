import { describe, expect, it } from 'vitest';
import type { Issue } from '@vigour-ui-review/contracts';
import { scoreIssues } from './index.js';

const baseIssue: Issue = {
  id: 'issue_1', runId: 'run_1', groupId: 'group_1', type: 'position',
  severity: 'minor', confidence: 'high', detectorTier: 'stable',
  title: '向右偏移', plainDescription: '向右偏了 3 像素',
  rect: { x: 0, y: 0, width: 10, height: 10 },
  createdAt: '2026-08-28T00:00:00.000Z',
};

describe('scoreIssues', () => {
  it('requires both score threshold and no critical issue', () => {
    expect(scoreIssues([])).toMatchObject({ score: 100, passed: true });
    expect(scoreIssues([{ ...baseIssue, severity: 'critical' }], 80)).toMatchObject({ passed: false, criticalCount: 1 });
  });

  it('discounts medium-confidence experimental findings and ignores low confidence', () => {
    const issues: Issue[] = [
      { ...baseIssue, id: 'a', severity: 'major', confidence: 'medium', detectorTier: 'experimental' },
      { ...baseIssue, id: 'b', severity: 'critical', confidence: 'low' },
    ];
    expect(scoreIssues(issues)).toMatchObject({ score: 99, penalty: 1, consideredIssueCount: 1, passed: true });
  });

  it('rejects invalid thresholds', () => {
    expect(() => scoreIssues([], 101)).toThrow(RangeError);
  });
});
