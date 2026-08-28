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

beforeEach(() => {
  db = openDatabase(':memory:');
  app = buildApp(db, security, mkdtempSync(join(tmpdir(), 'capture-assets-')));
});
afterEach(async () => {
  await app.close();
  db.close();
});

describe('local API', () => {
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

  it('permits a paired Chrome extension only when the wildcard is explicitly configured', async () => {
    const extensionApp = buildApp(db, {
      sessionToken: token,
      allowedOrigins: new Set(['chrome-extension://*']),
    }, mkdtempSync(join(tmpdir(), 'capture-assets-extension-')));
    const response = await extensionApp.inject({
      method: 'GET', url: '/api/v1/capabilities',
      headers: { authorization: `Bearer ${token}`, origin: 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef' },
    });
    expect(response.statusCode).toBe(200);
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
});
