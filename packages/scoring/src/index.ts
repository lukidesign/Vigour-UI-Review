import type { Issue, Severity } from '@vigour-ui-review/contracts';

export const DEFAULT_PASS_SCORE = 95;
export const SEVERITY_PENALTY: Readonly<Record<Severity, number>> = {
  critical: 12,
  major: 4,
  minor: 1,
};

export interface ScoreResult {
  score: number;
  passed: boolean;
  criticalCount: number;
  penalty: number;
  consideredIssueCount: number;
}

export function scoreIssues(issues: readonly Issue[], passScore = DEFAULT_PASS_SCORE): ScoreResult {
  if (!Number.isFinite(passScore) || passScore < 0 || passScore > 100) {
    throw new RangeError('passScore must be between 0 and 100');
  }

  const considered = issues.filter((issue) => issue.confidence !== 'low');
  const criticalCount = considered.filter((issue) => issue.severity === 'critical').length;
  const penalty = considered.reduce((sum, issue) => {
    const confidenceMultiplier = issue.confidence === 'medium' ? 0.5 : 1;
    const tierMultiplier = issue.detectorTier === 'experimental' ? 0.5 : 1;
    return sum + SEVERITY_PENALTY[issue.severity] * confidenceMultiplier * tierMultiplier;
  }, 0);
  const score = Math.max(0, Math.round((100 - penalty) * 10) / 10);

  return {
    score,
    passed: score >= passScore && criticalCount === 0,
    criticalCount,
    penalty: Math.round(penalty * 10) / 10,
    consideredIssueCount: considered.length,
  };
}
