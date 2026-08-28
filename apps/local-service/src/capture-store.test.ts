import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { CaptureUpload } from '@vigour-ui-review/contracts';
import { CaptureStore } from './capture-store.js';
import { openDatabase } from './db.js';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5Y2WQAAAABJRU5ErkJggg==';
const input: CaptureUpload = {
  pageUrl: 'https://example.com/path', title: 'Example', mode: 'viewport',
  viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
  page: { width: 1, height: 1 }, segments: [{ y: 0, dataUrl: onePixelPng }], dom: [],
  capturedAt: '2026-08-28T00:00:00.000Z',
};

let db: DatabaseSync;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => db.close());

describe('CaptureStore', () => {
  it('stores validated PNG bytes under an internally generated path', () => {
    const root = mkdtempSync(join(tmpdir(), 'capture-store-'));
    const result = new CaptureStore(db, root).create(input);
    const row = db.prepare('SELECT segment_manifest_path FROM captures WHERE id = ?').get(result.id) as { segment_manifest_path: string };
    expect(JSON.parse(readFileSync(row.segment_manifest_path, 'utf8'))).toHaveLength(1);
    expect(result.segmentCount).toBe(1);
  });

  it('rejects a forged PNG data URL', () => {
    const root = mkdtempSync(join(tmpdir(), 'capture-store-'));
    expect(() => new CaptureStore(db, root).create({ ...input, segments: [{ y: 0, dataUrl: 'data:image/png;base64,SGVsbG8=' }] }))
      .toThrow('INVALID_PNG');
  });

  it('rejects a valid PNG that lies about its viewport dimensions', () => {
    const root = mkdtempSync(join(tmpdir(), 'capture-store-'));
    expect(() => new CaptureStore(db, root).create({ ...input, viewport: { ...input.viewport, width: 100 } }))
      .toThrow('CAPTURE_DIMENSION_MISMATCH');
  });
});
