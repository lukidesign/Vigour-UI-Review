import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from './db.js';

it('migrates old captures without losing data and persists processing outcomes across reopen', () => {
  const root = mkdtempSync(join(tmpdir(), 'vigour-db-migration-'));
  const path = join(root, 'test.sqlite');
  let db = openDatabase(path);
  try {
    // Reconstruct the schema immediately before the three capture-state migrations.
    const { version } = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number };
    db.prepare('DELETE FROM schema_migrations WHERE version > ?').run(version - 3);
    db.exec('ALTER TABLE captures DROP COLUMN processing_error; ALTER TABLE captures DROP COLUMN processing_state;');
    db.exec(`INSERT INTO captures (id, page_url, title, mode, viewport_json, page_json, dom_path, segment_manifest_path, created_at)
      VALUES ('legacy', 'https://example.test', 'Synthetic', 'full-page', '{}', '{}', 'dom.json', 'segments.json', '2026-10-22');`);
    db.exec(`INSERT INTO image_assets VALUES ('legacy-image', 'implementation', 'test.png', 'image/png', 'test.png', 1, 1, '2026-10-22');
      INSERT INTO captures (id, page_url, title, mode, viewport_json, page_json, dom_path, segment_manifest_path, created_at, image_asset_id)
      VALUES ('legacy-ready', 'https://example.test', 'Synthetic', 'viewport', '{}', '{}', 'dom2.json', 'segments2.json', '2026-10-22', 'legacy-image');`);
    db.close();
    db = openDatabase(path);
    expect(db.prepare('SELECT title, processing_state, processing_error FROM captures WHERE id = ?').get('legacy'))
      .toMatchObject({ title: 'Synthetic', processing_state: 'failed', processing_error: 'LEGACY_CAPTURE_FAILED' });
    expect(db.prepare('SELECT image_asset_id, processing_state, processing_error FROM captures WHERE id = ?').get('legacy-ready'))
      .toMatchObject({ image_asset_id: 'legacy-image', processing_state: 'ready', processing_error: null });
    db.exec("UPDATE captures SET processing_error = 'VISION_TIMEOUT' WHERE id = 'legacy'");
    db.close();
    db = openDatabase(path);
    expect(db.prepare('SELECT processing_state, processing_error FROM captures WHERE id = ?').get('legacy'))
      .toMatchObject({ processing_state: 'failed', processing_error: 'VISION_TIMEOUT' });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
