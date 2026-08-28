import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const migrations = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS tolerance_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tolerance_profile_id TEXT NOT NULL REFERENCES tolerance_profiles(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    state TEXT NOT NULL CHECK (state IN ('draft','capturing','aligning','analyzing','ready','failed','cancelled')),
    design_asset_id TEXT,
    implementation_asset_id TEXT,
    score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    passed INTEGER CHECK (passed IS NULL OR passed IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('queued','running','succeeded','failed','cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status_text TEXT NOT NULL DEFAULT '',
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_runs_project_created ON runs(project_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_state_created ON tasks(state, created_at ASC)`,
  `CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    page_url TEXT NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('viewport','full-page')),
    viewport_json TEXT NOT NULL,
    page_json TEXT NOT NULL,
    dom_path TEXT NOT NULL,
    segment_manifest_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_captures_created ON captures(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS image_assets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('design','implementation','evidence')),
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg')),
    path TEXT NOT NULL UNIQUE,
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    created_at TEXT NOT NULL
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_image_assets_kind_created ON image_assets(kind, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical','major','minor')),
    confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
    detector_tier TEXT NOT NULL CHECK (detector_tier IN ('stable','experimental')),
    title TEXT NOT NULL,
    plain_description TEXT NOT NULL,
    bbox_json TEXT NOT NULL,
    expected TEXT,
    actual TEXT,
    delta REAL,
    unit TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_issues_run_severity ON issues(run_id, severity, created_at)`,
  `CREATE TABLE IF NOT EXISTS run_artifacts (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES image_assets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('evidence','annotated')),
    PRIMARY KEY (run_id, asset_id)
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS figma_imports (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES image_assets(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL,
    node_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    node_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    nodes_json TEXT NOT NULL,
    imported_at TEXT NOT NULL
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_figma_imports_asset ON figma_imports(asset_id)`,
  `CREATE TABLE IF NOT EXISTS ai_consent_receipts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('openai','gemini','kimi','deepseek')),
    model TEXT NOT NULL,
    task TEXT NOT NULL CHECK (task IN ('explain','business-logic')),
    data_types_json TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_ai_consent_expiry ON ai_consent_receipts(expires_at, used_at)`,
  `ALTER TABLE issues ADD COLUMN suggested_css_patch TEXT`,
  `ALTER TABLE captures ADD COLUMN image_asset_id TEXT REFERENCES image_assets(id)`,
] as const;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(migrations[0]);
    const select = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
    const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
    migrations.slice(1).forEach((sql, index) => {
      const version = index + 1;
      if (!select.get(version)) {
        db.exec(sql);
        insert.run(version, new Date().toISOString());
      }
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
