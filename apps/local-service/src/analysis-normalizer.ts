import { randomUUID } from 'node:crypto';
import { issueSchema, type Issue } from '@vigour-ui-review/contracts';
import { z } from 'zod';

const rawIssueSchema = z.object({
  type: z.enum(['position', 'size', 'color', 'text', 'missing', 'extra']),
  severity: z.enum(['critical', 'major', 'minor']),
  confidence: z.enum(['high', 'medium', 'low']),
  title: z.string().min(1).max(240),
  plain_description: z.string().min(1).max(2000),
  box: z.object({ x: z.number(), y: z.number(), width: z.number().nonnegative(), height: z.number().nonnegative() }),
  expected: z.string().max(2000).optional(), actual: z.string().max(2000).optional(),
  delta: z.number().finite().optional(), unit: z.string().max(60).optional(),
});

export const visionResultSchema = z.object({
  engine_version: z.string().min(1).max(100), rules_hash: z.string().min(1).max(128),
  alignment: z.object({ matrix: z.array(z.array(z.number())), confidence: z.number().min(0).max(1), mode: z.string() }),
  normalization: z.object({
    applied: z.boolean(),
    reference: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
    candidate: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
    target: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
    aspect_ratio_difference_percent: z.number().min(0),
    scale_x: z.number().positive(),
    scale_y: z.number().positive(),
  }),
  issues: z.array(rawIssueSchema).max(10_000), evidence_path: z.string(),
});

function patchFor(issue: z.infer<typeof rawIssueSchema>): string | undefined {
  if (issue.type === 'position') return `/* ${issue.plain_description} */\ntransform: translate(/* 按标注反向修正 */);`;
  if (issue.type === 'size') return `/* ${issue.plain_description} */\nbox-sizing: border-box;\nwidth: /* 设计稿宽度 */;\nheight: /* 设计稿高度 */;`;
  if (issue.type === 'color') return `/* ${issue.plain_description} */\ncolor: /* 取设计稿颜色 */;`;
  if (issue.type === 'extra') return `/* 确认该元素不应存在后使用 */\ndisplay: none;`;
  return undefined;
}

export function normalizeVisionIssues(runId: string, raw: unknown): { result: z.infer<typeof visionResultSchema>; issues: Issue[] } {
  const result = visionResultSchema.parse(raw);
  const createdAt = new Date().toISOString();
  const groups = new Map<string, string>();
  const issues = result.issues.map((issue) => {
    const groupKey = `${Math.round(issue.box.x / 4)}:${Math.round(issue.box.y / 4)}:${Math.round(issue.box.width / 4)}:${Math.round(issue.box.height / 4)}`;
    let groupId = groups.get(groupKey);
    if (!groupId) {
      groupId = `group_${randomUUID().replaceAll('-', '')}`;
      groups.set(groupKey, groupId);
    }
    return issueSchema.parse({
      id: `issue_${randomUUID().replaceAll('-', '')}`, runId, groupId, type: issue.type,
      severity: issue.severity, confidence: issue.confidence, detectorTier: 'stable', title: issue.title,
      plainDescription: issue.plain_description, rect: issue.box,
      ...(issue.expected !== undefined ? { expected: issue.expected } : {}),
      ...(issue.actual !== undefined ? { actual: issue.actual } : {}),
      ...(issue.delta !== undefined ? { delta: issue.delta } : {}),
      ...(['px', 'color-distance', 'text'].includes(issue.unit ?? '') ? { unit: issue.unit } : {}),
      ...(patchFor(issue) ? { suggestedCssPatch: patchFor(issue) } : {}), createdAt,
    });
  });
  return { result, issues };
}
