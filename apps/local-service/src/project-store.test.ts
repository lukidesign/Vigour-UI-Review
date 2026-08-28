import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Issue } from '@vigour-ui-review/contracts';
import { openDatabase } from './db.js';
import { ProjectStore } from './project-store.js';

let db: DatabaseSync;
let store: ProjectStore;
beforeEach(() => { db = openDatabase(':memory:'); store = new ProjectStore(db); });
afterEach(() => db.close());

describe('ProjectStore', () => {
  it('persists run issues atomically and applies pass rules', () => {
    const project = store.createProject('结算页');
    db.prepare(`INSERT INTO image_assets (id, kind, filename, mime_type, path, width, height, created_at)
      VALUES ('evidence_1','evidence','e.png','image/png','/tmp/e.png',1,1,?)`).run(new Date().toISOString());
    const run = store.createRun(project.id, 'design_1', 'implementation_1');
    const issue: Issue = {
      id: 'issue_1', runId: run.id, groupId: 'group_1', type: 'position', severity: 'minor', confidence: 'high',
      detectorTier: 'stable', title: '偏移', plainDescription: '向右偏了 3 像素', rect: { x: 1, y: 2, width: 3, height: 4 },
      createdAt: new Date().toISOString(),
    };
    const completed = store.completeRun(run.id, [issue], 'evidence_1');
    expect(completed).toMatchObject({ state: 'ready', score: 99, passed: true });
    expect(store.listIssues(run.id)).toHaveLength(1);
  });
});
