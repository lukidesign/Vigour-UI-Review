import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import type { DatabaseSync } from 'node:sqlite';
import { captureUploadSchema, taskKindSchema } from '@vigour-ui-review/contracts';
import { z } from 'zod';
import { TaskStore } from './task-machine.js';
import { registerSecurity, type SecurityConfig } from './security.js';
import { CaptureStore } from './capture-store.js';
import { ImageStore } from './image-store.js';
import type { VisionClient } from './vision-client.js';
import { readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ProjectStore } from './project-store.js';
import { normalizeVisionIssues } from './analysis-normalizer.js';
import { SecretStore } from './keychain.js';
import { FigmaClient, parseFigmaUrl } from './figma.js';
import { FigmaStore } from './figma-store.js';
import { AIConsentStore, payloadHash, type AIProvider, type AITask } from './ai-consent.js';
import { createProviderRegistry, type AIAdapter } from './ai-providers.js';
import { buildAIContext, makeAIPrompt } from './ai-context.js';
import { incompatibleImageResponse, planImageNormalization } from './image-normalization.js';

const createTaskBody = z.object({ kind: taskKindSchema });

interface ExternalIntegrations { secrets?: SecretStore; figma?: Pick<FigmaClient, 'importFrame'>; aiProviders?: Record<AIProvider, AIAdapter>; staticRoot?: string }
export function buildApp(db: DatabaseSync, security: SecurityConfig, assetRoot = '.data/assets', vision?: Pick<VisionClient, 'request'>, integrations: ExternalIntegrations = {}) {
  const app = Fastify({ logger: false, bodyLimit: 40 * 1024 * 1024 });
  const tasks = new TaskStore(db);
  const captures = new CaptureStore(db, assetRoot);
  const images = new ImageStore(db, assetRoot);
  const projects = new ProjectStore(db);
  const secrets = integrations.secrets ?? new SecretStore();
  const figma = integrations.figma ?? new FigmaClient();
  const figmaImports = new FigmaStore(db);
  const consents = new AIConsentStore(db);
  const aiProviders = integrations.aiProviders ?? createProviderRegistry();
  if (integrations.staticRoot) {
    void app.register(fastifyStatic, { root: integrations.staticRoot, wildcard: false, index: 'index.html' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ code: 'API_NOT_FOUND' });
      return reply.sendFile('index.html');
    });
  }
  registerSecurity(app, security);

  app.get('/health', async () => ({ status: 'ok', service: 'vigour-ui-review-local', version: '0.0.1' }));
  app.get('/api/v1/capabilities', async () => ({
    capture: true,
    localVision: Boolean(vision),
    localOcr: Boolean(vision),
    figmaPat: false,
    aiProviders: [],
  }));
  app.get('/api/v1/tolerance-profiles', async () => projects.listProfiles());
  app.get('/api/v1/settings/secrets/figma', async (_request, reply) => {
    try { return { configured: await secrets.hasFigmaPat() }; }
    catch { return reply.code(503).send({ code: 'KEYCHAIN_UNAVAILABLE' }); }
  });
  app.post('/api/v1/settings/secrets/figma', async (request, reply) => {
    const parsed = z.object({ token: z.string().trim().min(20).max(1000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_FIGMA_TOKEN' });
    try { await secrets.saveFigmaPat(parsed.data.token); return { configured: true }; }
    catch (error) { return reply.code(503).send({ code: error instanceof Error && error.message === 'KEYCHAIN_LOCKED' ? 'KEYCHAIN_LOCKED' : 'KEYCHAIN_UNAVAILABLE' }); }
  });
  app.delete('/api/v1/settings/secrets/figma', async (_request, reply) => {
    try { await secrets.removeFigmaPat(); return { configured: false }; }
    catch { return reply.code(503).send({ code: 'KEYCHAIN_UNAVAILABLE' }); }
  });
  app.post('/api/v1/figma/import', async (request, reply) => {
    const parsed = z.object({ url: z.string().url().max(2000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_FIGMA_URL' });
    try {
      const token = await secrets.readFigmaPat();
      if (!token) return reply.code(409).send({ code: 'FIGMA_TOKEN_NOT_CONFIGURED' });
      const source = parseFigmaUrl(parsed.data.url);
      const imported = await figma.importFrame(source, token);
      const asset = images.create('design', `${imported.nodeName || 'Figma Frame'}.png`, `data:image/png;base64,${imported.image.toString('base64')}`);
      const record = figmaImports.create(asset.id, source, imported.fileName, imported.nodeName, imported.nodes);
      return reply.code(201).send({ import: record, asset: { ...asset, path: undefined } });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const safeCodes = new Set(['INVALID_FIGMA_URL', 'FIGMA_NODE_URL_REQUIRED', 'FIGMA_TOKEN_INVALID', 'FIGMA_NODE_NOT_FOUND', 'FIGMA_RATE_LIMITED', 'FIGMA_RENDER_FAILED', 'FIGMA_RESPONSE_TOO_LARGE', 'FIGMA_NODE_LIMIT_EXCEEDED']);
      const code = safeCodes.has(message) ? message : 'FIGMA_IMPORT_FAILED';
      return reply.code(code === 'FIGMA_TOKEN_INVALID' ? 401 : code === 'FIGMA_NODE_NOT_FOUND' ? 404 : code === 'FIGMA_RATE_LIMITED' ? 429 : 400).send({ code });
    }
  });
  const providerSchema = z.enum(['openai', 'gemini', 'kimi', 'deepseek']);
  const aiRequestSchema = z.object({
    provider: providerSchema, model: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
    task: z.enum(['explain', 'business-logic']), runId: z.string().min(1).max(128),
    issueIds: z.array(z.string().min(1).max(128)).max(20).default([]), includeImage: z.boolean().default(false),
  });
  const prepareAI = (input: z.infer<typeof aiRequestSchema>) => {
    const run = projects.getRun(input.runId);
    const context = buildAIContext(input.provider, input.model, input.task, run, projects.listIssues(run.id), input.issueIds, input.includeImage);
    const adapter = aiProviders[input.provider];
    if (input.includeImage && !adapter.capabilities.imageInput) throw new Error('AI_PROVIDER_NO_IMAGE');
    return { run, context, adapter, hash: payloadHash(context) };
  };
  app.get('/api/v1/settings/secrets/ai', async (_request, reply) => {
    try {
      const entries = await Promise.all((providerSchema.options as AIProvider[]).map(async (provider) => [provider, await secrets.hasProviderKey(provider)] as const));
      return Object.fromEntries(entries);
    } catch { return reply.code(503).send({ code: 'KEYCHAIN_UNAVAILABLE' }); }
  });
  app.post('/api/v1/settings/secrets/ai/:provider', async (request, reply) => {
    const params = z.object({ provider: providerSchema }).safeParse(request.params);
    const body = z.object({ apiKey: z.string().trim().min(10).max(1000) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_AI_KEY' });
    try { await secrets.saveProviderKey(params.data.provider, body.data.apiKey); return { provider: params.data.provider, configured: true }; }
    catch { return reply.code(503).send({ code: 'KEYCHAIN_UNAVAILABLE' }); }
  });
  app.delete('/api/v1/settings/secrets/ai/:provider', async (request, reply) => {
    const params = z.object({ provider: providerSchema }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_PROVIDER' });
    try { await secrets.removeProviderKey(params.data.provider); return { provider: params.data.provider, configured: false }; }
    catch { return reply.code(503).send({ code: 'KEYCHAIN_UNAVAILABLE' }); }
  });
  app.get('/api/v1/ai/capabilities', async () => Object.fromEntries(Object.entries(aiProviders).map(([id, adapter]) => [id, adapter.capabilities])));
  app.post('/api/v1/ai/consents', async (request, reply) => {
    const parsed = aiRequestSchema.extend({ confirmed: z.literal(true) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'EXPLICIT_CONSENT_REQUIRED' });
    try {
      const prepared = prepareAI(parsed.data);
      const dataTypes = ['structured-differences', ...(parsed.data.includeImage ? ['annotated-image'] : [])];
      return reply.code(201).send(consents.create(parsed.data.provider, parsed.data.model, parsed.data.task, dataTypes, prepared.hash));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return reply.code(message.endsWith('_NOT_FOUND') ? 404 : 400).send({ code: message.startsWith('AI_') ? message : 'AI_CONTEXT_INVALID' });
    }
  });
  app.post('/api/v1/ai/analyze', async (request, reply) => {
    const parsed = aiRequestSchema.extend({ receiptId: z.string().min(1).max(128) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_AI_REQUEST' });
    try {
      const prepared = prepareAI(parsed.data);
      const apiKey = await secrets.readProviderKey(parsed.data.provider);
      if (!apiKey) return reply.code(409).send({ code: 'AI_KEY_NOT_CONFIGURED' });
      consents.consume(parsed.data.receiptId, parsed.data.provider, parsed.data.model, parsed.data.task as AITask, prepared.hash);
      let imageDataUrl: string | undefined;
      if (parsed.data.includeImage) {
        const evidenceId = projects.getEvidenceAssetId(prepared.run.id);
        if (!evidenceId) throw new Error('AI_IMAGE_NOT_AVAILABLE');
        const asset = images.get(evidenceId);
        imageDataUrl = `data:${asset.mimeType};base64,${readFileSync(asset.path).toString('base64')}`;
      }
      const prompt = makeAIPrompt(prepared.context);
      const payloadBytes = Buffer.byteLength(prompt) + (imageDataUrl ? Buffer.byteLength(imageDataUrl) : 0);
      if (payloadBytes > prepared.adapter.capabilities.maxPayloadBytes) throw new Error('AI_PAYLOAD_TOO_LARGE');
      const result = await prepared.adapter.analyze({
        model: parsed.data.model, task: parsed.data.task, prompt,
        ...(imageDataUrl ? { imageDataUrl } : {}),
      }, apiKey);
      return { provider: parsed.data.provider, model: parsed.data.model, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const safe = new Set(['CONSENT_INVALID_OR_EXPIRED', 'AI_KEY_INVALID', 'AI_RATE_LIMITED', 'AI_PROVIDER_FAILED', 'AI_PROVIDER_NO_IMAGE', 'AI_IMAGE_NOT_AVAILABLE', 'AI_RESPONSE_TOO_LARGE', 'AI_PAYLOAD_TOO_LARGE']);
      const code = safe.has(message) ? message : 'AI_ANALYSIS_FAILED';
      return reply.code(code === 'CONSENT_INVALID_OR_EXPIRED' ? 409 : code === 'AI_KEY_INVALID' ? 401 : code === 'AI_RATE_LIMITED' ? 429 : 502).send({ code });
    }
  });
  app.get('/api/v1/projects', async () => projects.listProjects());
  app.post('/api/v1/projects', async (request, reply) => {
    const parsed = z.object({
      name: z.string().trim().min(1).max(120), description: z.string().max(1000).default(''),
      toleranceProfileId: z.string().min(1).max(128).default('profile_balanced'),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_PROJECT' });
    try {
      return reply.code(201).send(projects.createProject(parsed.data.name, parsed.data.description, parsed.data.toleranceProfileId));
    } catch {
      return reply.code(400).send({ code: 'INVALID_TOLERANCE_PROFILE' });
    }
  });
  app.get('/api/v1/projects/:id/runs', async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1).max(128) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    return projects.listRuns(parsed.data.id);
  });
  app.post('/api/v1/assets/images', async (request, reply) => {
    const schema = z.object({
      kind: z.enum(['design', 'implementation']),
      filename: z.string().min(1).max(255),
      dataUrl: z.string().max(35_000_000),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_IMAGE_UPLOAD' });
    try {
      const asset = images.create(parsed.data.kind, parsed.data.filename, parsed.data.dataUrl);
      return reply.code(201).send({ ...asset, path: undefined });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'IMAGE_STORE_FAILED';
      return reply.code(['IMAGE_TOO_LARGE', 'IMAGE_LIMIT_EXCEEDED'].includes(code) ? 413 : 400).send({ code });
    }
  });
  app.post('/api/v1/vision/analyze', async (request, reply) => {
    if (!vision) return reply.code(503).send({ code: 'VISION_UNAVAILABLE' });
    const schema = z.object({
      referenceAssetId: z.string().min(1).max(128),
      candidateAssetId: z.string().min(1).max(128),
      rules: z.object({
        position_px: z.number().min(0).max(100).optional(),
        size_px: z.number().min(0).max(100).optional(),
        color_delta: z.number().min(0).max(255).optional(),
      }).optional(),
      useOcr: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_ANALYSIS_REQUEST' });
    let evidencePath: string | undefined;
    try {
      const reference = images.get(parsed.data.referenceAssetId);
      const candidate = images.get(parsed.data.candidateAssetId);
      const normalization = planImageNormalization(reference, candidate);
      if (!normalization.compatible) return reply.code(409).send(incompatibleImageResponse(normalization));
      const evidence = images.reserveEvidence(reference);
      evidencePath = evidence.path;
      const result = await vision.request('analyze', {
        reference_path: reference.path,
        candidate_path: candidate.path,
        evidence_path: evidence.path,
        use_ocr: parsed.data.useOcr,
        ...(parsed.data.rules ? { rules: parsed.data.rules } : {}),
      });
      const evidenceAsset = images.commitEvidence(evidence, reference);
      return { ...(result as object), evidenceAssetId: evidenceAsset.id, evidence_path: undefined };
    } catch (error) {
      if (evidencePath) rmSync(evidencePath, { force: true });
      const message = error instanceof Error ? error.message : '';
      const knownCodes = new Set(['IMAGE_ASSET_NOT_FOUND', 'IMAGE_DIMENSION_MISMATCH', 'VISION_TIMEOUT', 'INVALID_RULES']);
      const code = knownCodes.has(message) ? message : 'ANALYSIS_FAILED';
      return reply.code(code === 'IMAGE_ASSET_NOT_FOUND' ? 404 : code === 'VISION_TIMEOUT' ? 504 : 500).send({ code });
    }
  });
  app.post('/api/v1/runs/analyze', async (request, reply) => {
    if (!vision) return reply.code(503).send({ code: 'VISION_UNAVAILABLE' });
    const parsed = z.object({
      projectId: z.string().min(1).max(128), referenceAssetId: z.string().min(1).max(128),
      candidateAssetId: z.string().min(1).max(128), useOcr: z.boolean().default(false),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_ANALYSIS_REQUEST' });
    let runId: string | undefined;
    let evidencePath: string | undefined;
    try {
      const reference = images.get(parsed.data.referenceAssetId);
      const candidate = images.get(parsed.data.candidateAssetId);
      const normalization = planImageNormalization(reference, candidate);
      if (!normalization.compatible) return reply.code(409).send(incompatibleImageResponse(normalization));
      const profile = projects.getProfileForProject(parsed.data.projectId);
      const run = projects.createRun(parsed.data.projectId, reference.id, candidate.id);
      runId = run.id;
      const evidence = images.reserveEvidence(reference);
      evidencePath = evidence.path;
      const raw = await vision.request('analyze', {
        reference_path: reference.path, candidate_path: candidate.path, evidence_path: evidence.path,
        rules: { position_px: profile.positionPx, size_px: profile.sizePx, color_delta: profile.colorDeltaE },
        use_ocr: parsed.data.useOcr,
      });
      const normalized = normalizeVisionIssues(run.id, raw);
      const evidenceAsset = images.commitEvidence(evidence, reference);
      const completed = projects.completeRun(run.id, normalized.issues, evidenceAsset.id);
      const rawNormalization = normalized.result.normalization;
      return reply.code(201).send({
        run: completed,
        issues: projects.listIssues(run.id),
        evidenceAssetId: evidenceAsset.id,
        alignment: normalized.result.alignment,
        normalization: {
          applied: rawNormalization.applied,
          reference: rawNormalization.reference,
          candidate: rawNormalization.candidate,
          target: rawNormalization.target,
          aspectRatioDifferencePercent: rawNormalization.aspect_ratio_difference_percent,
          scaleX: rawNormalization.scale_x,
          scaleY: rawNormalization.scale_y,
        },
      });
    } catch (error) {
      if (evidencePath) rmSync(evidencePath, { force: true });
      if (runId) projects.failRun(runId);
      const message = error instanceof Error ? error.message : '';
      const code = ['PROJECT_NOT_FOUND', 'IMAGE_ASSET_NOT_FOUND'].includes(message) ? message : message === 'VISION_TIMEOUT' ? message : 'ANALYSIS_FAILED';
      return reply.code(code.endsWith('_NOT_FOUND') ? 404 : code === 'VISION_TIMEOUT' ? 504 : 500).send({ code });
    }
  });
  app.get('/api/v1/runs/:id', async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1).max(128) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    try {
      const run = projects.getRun(parsed.data.id);
      return { run, issues: projects.listIssues(run.id), evidenceAssetId: projects.getEvidenceAssetId(run.id) };
    } catch { return reply.code(404).send({ code: 'RUN_NOT_FOUND' }); }
  });
  app.patch('/api/v1/issues/:id', async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1).max(128) }).safeParse(request.params);
    const body = z.object({ status: z.enum(['open', 'resolved', 'ignored']) }).safeParse(request.body);
    if (!parsed.success || !body.success) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    try { projects.updateIssueStatus(parsed.data.id, body.data.status); return { ok: true }; }
    catch { return reply.code(404).send({ code: 'ISSUE_NOT_FOUND' }); }
  });
  app.get('/api/v1/assets/images/:id/content', async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1).max(128) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    try {
      const asset = images.get(parsed.data.id);
      return reply.type(asset.mimeType).header('cache-control', 'private, max-age=300').send(readFileSync(asset.path));
    } catch { return reply.code(404).send({ code: 'IMAGE_ASSET_NOT_FOUND' }); }
  });
  app.get('/api/v1/runs/:id/export/:format', async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1).max(128), format: z.enum(['json', 'markdown']) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    try {
      const run = projects.getRun(parsed.data.id);
      const issues = projects.listIssues(run.id);
      if (parsed.data.format === 'json') {
        return reply.type('application/json; charset=utf-8').header('content-disposition', `attachment; filename="${run.id}.json"`)
          .send({ schemaVersion: '1.0', run, issues });
      }
      const escape = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
      const rows = issues.map((issue) => `| ${issue.severity} | ${issue.type} | ${escape(issue.plainDescription)} | ${issue.status} |`).join('\n');
      const markdown = `# Vigour UI Review 验收报告\n\n- 评分：${run.score ?? '-'}\n- 结果：${run.passed ? '通过' : '未通过'}\n- 问题数：${issues.length}\n\n| 严重度 | 类型 | 问题 | 状态 |\n| --- | --- | --- | --- |\n${rows}\n`;
      return reply.type('text/markdown; charset=utf-8').header('content-disposition', `attachment; filename="${run.id}.md"`).send(markdown);
    } catch { return reply.code(404).send({ code: 'RUN_NOT_FOUND' }); }
  });
  app.post('/api/v1/captures', async (request, reply) => {
    const parsed = captureUploadSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_CAPTURE', issues: parsed.error.issues });
    try {
      const capture = captures.create(parsed.data);
      let imageAssetId: string | undefined;
      let processingError: string | undefined;
      try {
        if (parsed.data.mode === 'viewport') {
          const asset = images.create('implementation', `${parsed.data.title || '页面'}-视口.png`, parsed.data.segments[0]!.dataUrl);
          imageAssetId = asset.id;
        } else if (vision) {
          const stored = captures.get(capture.id);
          const stitchedPath = join(assetRoot, `.stitched-${randomUUID().replaceAll('-', '')}.png`);
          try {
            await vision.request('stitch', {
              manifest_path: stored.manifestPath, output_path: stitchedPath,
              page_width: stored.viewport.width, page_height: stored.page.height, dpr: stored.viewport.deviceScaleFactor,
            });
            const dataUrl = `data:image/png;base64,${readFileSync(stitchedPath).toString('base64')}`;
            imageAssetId = images.create('implementation', `${parsed.data.title || '页面'}-整页.png`, dataUrl).id;
          } finally { rmSync(stitchedPath, { force: true }); }
        } else processingError = 'VISION_UNAVAILABLE';
        if (imageAssetId) captures.attachImage(capture.id, imageAssetId);
      } catch (error) {
        processingError = error instanceof Error && ['IMAGE_LIMIT_EXCEEDED', 'SEGMENT_COVERAGE_GAP', 'VISION_TIMEOUT'].includes(error.message) ? error.message : 'CAPTURE_PROCESSING_FAILED';
      }
      return reply.code(201).send({ ...capture, imageAssetId, analysisReady: Boolean(imageAssetId), ...(processingError ? { processingError } : {}) });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CAPTURE_STORE_FAILED';
      const status = ['CAPTURE_TOO_LARGE', 'IMAGE_LIMIT_EXCEEDED'].includes(code) ? 413 : 400;
      return reply.code(status).send({ code });
    }
  });
  app.get('/api/v1/captures', async () => captures.list().map(({ manifestPath: _manifestPath, ...capture }) => capture));
  app.post('/api/v1/tasks', async (request, reply) => {
    const parsed = createTaskBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', issues: parsed.error.issues });
    return reply.code(201).send(tasks.create(parsed.data.kind));
  });
  app.get('/api/v1/tasks/:id', async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1).max(128) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    try {
      return tasks.get(parsed.data.id);
    } catch {
      return reply.code(404).send({ code: 'TASK_NOT_FOUND' });
    }
  });

  return app;
}
