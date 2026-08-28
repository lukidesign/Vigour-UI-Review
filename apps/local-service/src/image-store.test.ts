import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './db.js';
import { ImageStore } from './image-store.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5Y2WQAAAABJRU5ErkJggg==';
let db: DatabaseSync;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => db.close());

describe('ImageStore', () => {
  it('normalizes filenames and keeps paths internal', () => {
    const store = new ImageStore(db, mkdtempSync(join(tmpdir(), 'images-')));
    const asset = store.create('design', '../../design.png', png);
    expect(asset.filename).toBe('design.png');
    expect(store.get(asset.id).path).toBe(asset.path);
  });

  it('rejects declared MIME that differs from bytes', () => {
    const store = new ImageStore(db, mkdtempSync(join(tmpdir(), 'images-')));
    expect(() => store.create('design', 'fake.jpg', png.replace('image/png', 'image/jpeg'))).toThrow('MIME_MISMATCH');
  });
});
