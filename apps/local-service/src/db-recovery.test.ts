import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './db.js';
import { ProjectStore } from './project-store.js';

describe('database recovery', () => {
  it('reopens persisted projects and applies migrations idempotently', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'design-acceptance-recovery-')), 'db.sqlite3');
    const first = openDatabase(path);
    const project = new ProjectStore(first).createProject('断电恢复测试');
    first.close();
    const second = openDatabase(path);
    expect(new ProjectStore(second).getProject(project.id).name).toBe('断电恢复测试');
    const versions = second.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number };
    expect(versions.count).toBeGreaterThan(10);
    second.close();
  });
});
