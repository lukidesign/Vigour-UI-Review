import { z } from 'zod';

export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const isoDateSchema = z.iso.datetime({ offset: true });

export const rectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
});

export const issueTypeSchema = z.enum([
  'position', 'size', 'color', 'text', 'missing', 'extra',
  'typography', 'spacing', 'radius', 'border', 'shadow', 'icon',
]);
export const severitySchema = z.enum(['critical', 'major', 'minor']);
export const confidenceSchema = z.enum(['high', 'medium', 'low']);
export const detectorTierSchema = z.enum(['stable', 'experimental']);

export const issueSchema = z.object({
  id: idSchema,
  runId: idSchema,
  groupId: idSchema,
  type: issueTypeSchema,
  severity: severitySchema,
  confidence: confidenceSchema,
  detectorTier: detectorTierSchema,
  title: z.string().min(1).max(240),
  plainDescription: z.string().min(1).max(2000),
  rect: rectSchema,
  expected: z.string().max(2000).optional(),
  actual: z.string().max(2000).optional(),
  delta: z.number().finite().optional(),
  unit: z.enum(['px', 'percent', 'color-distance', 'text']).optional(),
  suggestedCssPatch: z.string().max(8000).optional(),
  createdAt: isoDateSchema,
});

export const taskKindSchema = z.enum([
  'capture', 'import-design', 'analyze', 'export', 'ai-explain', 'ai-infer-logic',
]);
export const taskStateSchema = z.enum([
  'queued', 'running', 'succeeded', 'failed', 'cancelled',
]);
export const taskSchema = z.object({
  id: idSchema,
  kind: taskKindSchema,
  state: taskStateSchema,
  progress: z.number().int().min(0).max(100),
  statusText: z.string().max(500),
  errorCode: z.string().max(120).optional(),
  errorMessage: z.string().max(2000).optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const toleranceProfileSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100),
  positionPx: z.number().finite().nonnegative(),
  sizePx: z.number().finite().nonnegative(),
  colorDeltaE: z.number().finite().nonnegative(),
  textExact: z.boolean(),
  enabledTypes: z.array(issueTypeSchema).min(1),
});

export const projectSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(1000).default(''),
  toleranceProfileId: idSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const runStateSchema = z.enum([
  'draft', 'capturing', 'aligning', 'analyzing', 'ready', 'failed', 'cancelled',
]);
export const runSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  state: runStateSchema,
  designAssetId: idSchema.optional(),
  implementationAssetId: idSchema.optional(),
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const captureRequestSchema = z.object({
  url: z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP(S) URLs are supported'),
  mode: z.enum(['viewport', 'full-page']),
  viewport: z.object({ width: z.number().int().min(320).max(7680), height: z.number().int().min(240).max(4320), deviceScaleFactor: z.number().min(0.5).max(4) }),
  freezeAnimations: z.boolean().default(true),
  collectDom: z.boolean().default(true),
});

export const domNodeSnapshotSchema = z.object({
  nodeId: idSchema,
  parentId: idSchema.optional(),
  tag: z.string().min(1).max(80),
  role: z.string().max(120).optional(),
  text: z.string().max(2000).optional(),
  rect: rectSchema,
  styles: z.record(z.string(), z.string().max(1000)),
});

export const captureUploadSchema = z.object({
  pageUrl: z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
  title: z.string().max(500),
  mode: z.enum(['viewport', 'full-page']),
  viewport: z.object({
    width: z.number().int().min(1).max(7680),
    height: z.number().int().min(1).max(4320),
    deviceScaleFactor: z.number().min(0.5).max(4),
  }),
  page: z.object({
    width: z.number().int().min(1).max(20_000),
    height: z.number().int().min(1).max(100_000),
  }),
  segments: z.array(z.object({
    y: z.number().int().min(0).max(100_000),
    dataUrl: z.string().startsWith('data:image/png;base64,').max(35_000_000),
  })).min(1).max(100),
  dom: z.array(domNodeSnapshotSchema).max(20_000),
  capturedAt: isoDateSchema,
});

export type CaptureUpload = z.infer<typeof captureUploadSchema>;
export type DomNodeSnapshot = z.infer<typeof domNodeSnapshotSchema>;

export type Rect = z.infer<typeof rectSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type IssueType = z.infer<typeof issueTypeSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskKind = z.infer<typeof taskKindSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export type ToleranceProfile = z.infer<typeof toleranceProfileSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Run = z.infer<typeof runSchema>;

export const jsonSchemas = {
  issue: z.toJSONSchema(issueSchema),
  task: z.toJSONSchema(taskSchema),
  project: z.toJSONSchema(projectSchema),
  run: z.toJSONSchema(runSchema),
  captureRequest: z.toJSONSchema(captureRequestSchema),
  captureUpload: z.toJSONSchema(captureUploadSchema),
} as const;
