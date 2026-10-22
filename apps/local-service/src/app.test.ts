import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from './app.js';
import { openDatabase } from './db.js';

let db: DatabaseSync;
let app: ReturnType<typeof buildApp>;
const token = 'test-session-token-that-is-long-enough-123456789';
const security = { sessionToken: token, allowedOrigins: new Set(['http://127.0.0.1:4173']) };
const authenticatedHeaders = { authorization: `Bearer ${token}`, 'x-csrf-token': token };

function pngDataUrl(width: number, height: number): string {
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5Y2WQAAAABJRU5ErkJggg==', 'base64');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

beforeEach(() => {
  db = openDatabase(':memory:');
  app = buildApp(db, security, mkdtempSync(join(tmpdir(), 'capture-assets-')));
});
afterEach(async () => {
  await app.close();
  db.close();
});

describe('local API', () => {
  it('does not report ready when image attachment fails', async () => {
    db.exec("CREATE TRIGGER fail_capture_attach BEFORE UPDATE OF image_asset_id ON captures BEGIN SELECT RAISE(FAIL, 'private database detail'); END");
    const response = await app.inject({ method: 'POST', url: '/api/v1/captures', headers: authenticatedHeaders, payload: {
      title: 'Synthetic', pageUrl: 'https://example.test/', mode: 'viewport',
      viewport: { width: 1, height: 1, deviceScaleFactor: 1 }, page: { width: 1, height: 1 },
      dom: [], segments: [{ y: 0, dataUrl: pngDataUrl(1, 1) }], capturedAt: new Date().toISOString(),
    } });
    expect(response.json()).toMatchObject({ analysisReady: false, processingState: 'failed', processingError: 'CAPTURE_PROCESSING_FAILED' });
    expect(response.json().imageAssetId).toBeUndefined();
    const refreshed = await app.inject({ method: 'GET', url: '/api/v1/captures', headers: authenticatedHeaders });
    expect(refreshed.json()[0]).toMatchObject({ processingState: 'failed' });
    expect(refreshed.body).not.toContain('private database detail');
  });
  it.each(['SEGMENT_DIMENSION_MISMATCH', 'VISION_TIMEOUT', 'SEGMENT_COVERAGE_GAP', 'decoder failed at /Users/private/session-token'])('persists safe capture processing failures: %s', async (failure) => {
    const failing = buildApp(db, security, mkdtempSync(join(tmpdir(), 'capture-failed-')), { request: async () => { throw new Error(failure); } });
    try {
      const created = await failing.inject({ method: 'POST', url: '/api/v1/captures', headers: authenticatedHeaders, payload: {
        title: 'Synthetic', pageUrl: 'https://example.test/', mode: 'full-page',
        viewport: { width: 1, height: 1, deviceScaleFactor: 1 }, page: { width: 1, height: 1 },
        dom: [], segments: [{ y: 0, dataUrl: pngDataUrl(1, 1) }], capturedAt: new Date().toISOString(),
      } });
      expect(created.statusCode).toBe(201);
      const expected = failure.startsWith('decoder') ? 'CAPTURE_PROCESSING_FAILED' : failure;
      expect(created.json()).toMatchObject({ analysisReady: false, processingState: 'failed', processingError: expected });
      const refreshed = await failing.inject({ method: 'GET', url: '/api/v1/captures', headers: authenticatedHeaders });
      expect(refreshed.json()[0]).toMatchObject({ id: created.json().id, processingState: 'failed', processingError: expected });
      expect(refreshed.body).not.toMatch(/session-token|manifestPath|\/Users\/|decoder/);
    } finally { await failing.close(); }
  });

  it('marks viewport captures ready and full pages without an engine failed', async () => {
    const payload = { title: 'Synthetic', pageUrl: 'https://example.test/', mode: 'viewport',
      viewport: { width: 1, height: 1, deviceScaleFactor: 1 }, page: { width: 1, height: 1 },
      dom: [], segments: [{ y: 0, dataUrl: pngDataUrl(1, 1) }], capturedAt: new Date().toISOString() };
    const ready = await app.inject({ method: 'POST', url: '/api/v1/captures', headers: authenticatedHeaders, payload });
    expect(ready.json()).toMatchObject({ analysisReady: true, processingState: 'ready' });
    const failed = await app.inject({ method: 'POST', url: '/api/v1/captures', headers: authenticatedHeaders, payload: { ...payload, mode: 'full-page' } });
    expect(failed.json()).toMatchObject({ analysisReady: false, processingState: 'failed', processingError: 'VISION_UNAVAILABLE' });
  });
  it('answers health checks', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('validates task creation and does not expose internal errors', async () => {
    const headers = { authorization: `Bearer ${token}`, 'x-csrf-token': token, origin: 'http://127.0.0.1:4173' };
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/tasks', headers, payload: { kind: 'shell' } });
    expect(invalid.statusCode).toBe(400);
    const created = await app.inject({ method: 'POST', url: '/api/v1/tasks', headers, payload: { kind: 'capture' } });
    expect(created.statusCode).toBe(201);
    const task = created.json();
    const fetched = await app.inject({ method: 'GET', url: `/api/v1/tasks/${task.id}`, headers: { authorization: `Bearer ${token}` } });
    expect(fetched.json()).toMatchObject({ kind: 'capture', state: 'queued' });
  });

  it('blocks cross-origin, unauthenticated and CSRF-less API calls', async () => {
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/v1/capabilities' });
    expect(unauthenticated.statusCode).toBe(401);
    const hostile = await app.inject({
      method: 'GET', url: '/api/v1/capabilities',
      headers: { authorization: `Bearer ${token}`, origin: 'https://hostile.example' },
    });
    expect(hostile).toMatchObject({ statusCode: 403 });
    const csrfLess = await app.inject({
      method: 'POST', url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${token}` }, payload: { kind: 'capture' },
    });
    expect(csrfLess).toMatchObject({ statusCode: 403 });
  });

  it('answers allowed browser preflights without exposing credentials', async () => {
    const response = await app.inject({
      method: 'OPTIONS', url: '/api/v1/assets/images',
      headers: { origin: 'http://127.0.0.1:4173', 'access-control-request-method': 'POST' },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:4173');
    expect(response.headers['access-control-allow-headers']).toContain('x-csrf-token');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('permits only the explicitly paired Chrome extension, including preflights', async () => {
    const origin = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
    const extensionApp = buildApp(db, {
      sessionToken: token,
      allowedOrigins: new Set([origin]),
    }, mkdtempSync(join(tmpdir(), 'capture-assets-extension-')));
    const response = await extensionApp.inject({
      method: 'GET', url: '/api/v1/capabilities',
      headers: { authorization: `Bearer ${token}`, origin },
    });
    expect(response.statusCode).toBe(200);
    const allowed = await extensionApp.inject({ method: 'OPTIONS', url: '/api/v1/captures', headers: { origin } });
    expect(allowed.statusCode).toBe(204);
    for (const untrusted of ['chrome-extension://pppppppppppppppppppppppppppppppp', `${origin}.evil`, 'null', '']) {
      const rejected = await extensionApp.inject({ method: 'OPTIONS', url: '/api/v1/captures', headers: { origin: untrusted } });
      expect(rejected.statusCode).toBe(403);
      expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    }
    await extensionApp.close();
  });

  it('never exposes vision worker errors or local paths', async () => {
    const failingVision = { request: async () => { throw new Error('decoder failed at /Users/private/secret.png'); } };
    const visionApp = buildApp(db, security, mkdtempSync(join(tmpdir(), 'vision-error-')), failingVision);
    const headers = { authorization: `Bearer ${token}`, 'x-csrf-token': token };
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5Y2WQAAAABJRU5ErkJggg==';
    const first = await visionApp.inject({ method: 'POST', url: '/api/v1/assets/images', headers, payload: { kind: 'design', filename: 'a.png', dataUrl: png } });
    const second = await visionApp.inject({ method: 'POST', url: '/api/v1/assets/images', headers, payload: { kind: 'implementation', filename: 'b.png', dataUrl: png } });
    const response = await visionApp.inject({ method: 'POST', url: '/api/v1/vision/analyze', headers, payload: {
      referenceAssetId: first.json().id, candidateAssetId: second.json().id,
    } });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: 'ANALYSIS_FAILED' });
    expect(response.body).not.toContain('/Users/');
    await visionApp.close();
  });

  it('blocks incompatible aspect ratios before creating a failed run', async () => {
    const vision = { request: async () => { throw new Error('vision should not run'); } };
    const visionApp = buildApp(db, security, mkdtempSync(join(tmpdir(), 'vision-mismatch-')), vision);
    const project = await visionApp.inject({ method: 'POST', url: '/api/v1/projects', headers: authenticatedHeaders, payload: { name: '尺寸预检' } });
    const reference = await visionApp.inject({ method: 'POST', url: '/api/v1/assets/images', headers: authenticatedHeaders, payload: { kind: 'design', filename: 'design.png', dataUrl: pngDataUrl(1724, 888) } });
    const candidate = await visionApp.inject({ method: 'POST', url: '/api/v1/assets/images', headers: authenticatedHeaders, payload: { kind: 'implementation', filename: 'implementation.png', dataUrl: pngDataUrl(2562, 1404) } });

    const response = await visionApp.inject({ method: 'POST', url: '/api/v1/runs/analyze', headers: authenticatedHeaders, payload: {
      projectId: project.json().id,
      referenceAssetId: reference.json().id,
      candidateAssetId: candidate.json().id,
    } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: 'IMAGE_ASPECT_RATIO_MISMATCH', thresholdPercent: 1, differencePercent: 6.01,
      reference: { width: 1724, height: 888 }, candidate: { width: 2562, height: 1404 }, target: { width: 1724, height: 888 },
    });
    expect((db.prepare('SELECT COUNT(*) AS count FROM runs').get() as unknown as { count: number }).count).toBe(0);
    await visionApp.close();
  });

  it('returns normalization details for proportional images', async () => {
    const vision = { request: async (_method: string, params: Record<string, unknown>) => ({
      engine_version: 'test', rules_hash: 'hash', alignment: { matrix: [[1, 0, 0], [0, 1, 0]], confidence: 1, mode: 'identity' },
      normalization: {
        applied: true,
        reference: { width: 100, height: 50 }, candidate: { width: 200, height: 100 }, target: { width: 100, height: 50 },
        aspect_ratio_difference_percent: 0, scale_x: 0.5, scale_y: 0.5,
      },
      issues: [], evidence_path: params.evidence_path,
    }) };
    const visionApp = buildApp(db, security, mkdtempSync(join(tmpdir(), 'vision-normalize-')), vision);
    const project = await visionApp.inject({ method: 'POST', url: '/api/v1/projects', headers: authenticatedHeaders, payload: { name: '自动对齐' } });
    const reference = await visionApp.inject({ method: 'POST', url: '/api/v1/assets/images', headers: authenticatedHeaders, payload: { kind: 'design', filename: 'design.png', dataUrl: pngDataUrl(100, 50) } });
    const candidate = await visionApp.inject({ method: 'POST', url: '/api/v1/assets/images', headers: authenticatedHeaders, payload: { kind: 'implementation', filename: 'implementation.png', dataUrl: pngDataUrl(200, 100) } });

    const response = await visionApp.inject({ method: 'POST', url: '/api/v1/runs/analyze', headers: authenticatedHeaders, payload: {
      projectId: project.json().id,
      referenceAssetId: reference.json().id,
      candidateAssetId: candidate.json().id,
    } });

    expect(response.statusCode).toBe(201);
    expect(response.json().normalization).toEqual({
      applied: true,
      reference: { width: 100, height: 50 }, candidate: { width: 200, height: 100 }, target: { width: 100, height: 50 },
      aspectRatioDifferencePercent: 0, scaleX: 0.5, scaleY: 0.5,
    });
    await visionApp.close();
  });
});
