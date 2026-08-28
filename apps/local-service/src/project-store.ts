import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Issue, Project, Run, ToleranceProfile } from '@vigour-ui-review/contracts';
import { scoreIssues } from '@vigour-ui-review/scoring';

const strictProfile: ToleranceProfile = {
  id: 'profile_strict', name: '严格还原', positionPx: 1, sizePx: 1, colorDeltaE: 5, textExact: true,
  enabledTypes: ['position', 'size', 'color', 'text', 'missing', 'extra'],
};
const balancedProfile: ToleranceProfile = {
  id: 'profile_balanced', name: '平衡验收', positionPx: 2, sizePx: 2, colorDeltaE: 8, textExact: true,
  enabledTypes: ['position', 'size', 'color', 'text', 'missing', 'extra'],
};

function projectFromRow(row: Record<string, unknown>): Project {
  return {
    id: String(row.id), name: String(row.name), description: String(row.description),
    toleranceProfileId: String(row.tolerance_profile_id), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function runFromRow(row: Record<string, unknown>): Run {
  return {
    id: String(row.id), projectId: String(row.project_id), state: row.state as Run['state'],
    ...(row.design_asset_id ? { designAssetId: String(row.design_asset_id) } : {}),
    ...(row.implementation_asset_id ? { implementationAssetId: String(row.implementation_asset_id) } : {}),
    ...(typeof row.score === 'number' ? { score: row.score } : {}),
    ...(typeof row.passed === 'number' ? { passed: row.passed === 1 } : {}),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export class ProjectStore {
  constructor(private readonly db: DatabaseSync) {
    this.seedProfiles();
  }

  private seedProfiles() {
    const insert = this.db.prepare(`INSERT OR IGNORE INTO tolerance_profiles (id, name, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`);
    const now = new Date().toISOString();
    for (const profile of [strictProfile, balancedProfile]) insert.run(profile.id, profile.name, JSON.stringify(profile), now, now);
  }

  listProfiles(): ToleranceProfile[] {
    return (this.db.prepare('SELECT config_json FROM tolerance_profiles ORDER BY name').all() as unknown as Array<{ config_json: string }>)
      .map((row) => JSON.parse(row.config_json) as ToleranceProfile);
  }

  createProject(name: string, description = '', toleranceProfileId = balancedProfile.id): Project {
    const id = `project_${randomUUID().replaceAll('-', '')}`;
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO projects (id, name, description, tolerance_profile_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, name, description, toleranceProfileId, now, now);
    return this.getProject(id);
  }

  getProject(id: string): Project {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as unknown as Record<string, unknown> | undefined;
    if (!row) throw new Error('PROJECT_NOT_FOUND');
    return projectFromRow(row);
  }

  listProjects(): Project[] {
    return (this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as unknown as Record<string, unknown>[]).map(projectFromRow);
  }

  getProfileForProject(projectId: string): ToleranceProfile {
    const row = this.db.prepare(`SELECT tp.config_json FROM projects p JOIN tolerance_profiles tp ON tp.id = p.tolerance_profile_id WHERE p.id = ?`)
      .get(projectId) as unknown as { config_json: string } | undefined;
    if (!row) throw new Error('PROJECT_NOT_FOUND');
    return JSON.parse(row.config_json) as ToleranceProfile;
  }

  createRun(projectId: string, designAssetId: string, implementationAssetId: string): Run {
    this.getProject(projectId);
    const id = `run_${randomUUID().replaceAll('-', '')}`;
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO runs (id, project_id, state, design_asset_id, implementation_asset_id, created_at, updated_at)
      VALUES (?, ?, 'analyzing', ?, ?, ?, ?)`)
      .run(id, projectId, designAssetId, implementationAssetId, now, now);
    return this.getRun(id);
  }

  failRun(id: string) {
    this.db.prepare("UPDATE runs SET state = 'failed', updated_at = ? WHERE id = ? AND state = 'analyzing'").run(new Date().toISOString(), id);
  }

  completeRun(id: string, issues: readonly Issue[], evidenceAssetId: string): Run {
    const score = scoreIssues(issues);
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const insert = this.db.prepare(`INSERT INTO issues
        (id, run_id, group_id, type, severity, confidence, detector_tier, title, plain_description, bbox_json,
         expected, actual, delta, unit, status, created_at, updated_at, suggested_css_patch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`);
      for (const issue of issues) insert.run(
        issue.id, id, issue.groupId, issue.type, issue.severity, issue.confidence, issue.detectorTier,
        issue.title, issue.plainDescription, JSON.stringify(issue.rect), issue.expected ?? null, issue.actual ?? null,
        issue.delta ?? null, issue.unit ?? null, now, now, issue.suggestedCssPatch ?? null,
      );
      this.db.prepare("INSERT INTO run_artifacts (run_id, asset_id, type) VALUES (?, ?, 'evidence')").run(id, evidenceAssetId);
      const update = this.db.prepare("UPDATE runs SET state = 'ready', score = ?, passed = ?, updated_at = ? WHERE id = ? AND state = 'analyzing'")
        .run(score.score, score.passed ? 1 : 0, now, id);
      if (update.changes !== 1) throw new Error('RUN_STATE_CONFLICT');
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getRun(id);
  }

  getRun(id: string): Run {
    const row = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as unknown as Record<string, unknown> | undefined;
    if (!row) throw new Error('RUN_NOT_FOUND');
    return runFromRow(row);
  }

  listRuns(projectId: string): Run[] {
    return (this.db.prepare('SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as unknown as Record<string, unknown>[]).map(runFromRow);
  }

  listIssues(runId: string): Array<Issue & { status: 'open' | 'resolved' | 'ignored' }> {
    return (this.db.prepare('SELECT * FROM issues WHERE run_id = ? ORDER BY CASE severity WHEN \'critical\' THEN 0 WHEN \'major\' THEN 1 ELSE 2 END, created_at').all(runId) as unknown as Record<string, unknown>[])
      .map((row) => ({
        id: String(row.id), runId: String(row.run_id), groupId: String(row.group_id), type: row.type as Issue['type'],
        severity: row.severity as Issue['severity'], confidence: row.confidence as Issue['confidence'], detectorTier: row.detector_tier as Issue['detectorTier'],
        title: String(row.title), plainDescription: String(row.plain_description), rect: JSON.parse(String(row.bbox_json)),
        ...(row.expected ? { expected: String(row.expected) } : {}), ...(row.actual ? { actual: String(row.actual) } : {}),
        ...(typeof row.delta === 'number' ? { delta: row.delta } : {}), ...(row.unit ? { unit: row.unit as Issue['unit'] } : {}),
        ...(row.suggested_css_patch ? { suggestedCssPatch: String(row.suggested_css_patch) } : {}),
        status: row.status as 'open' | 'resolved' | 'ignored', createdAt: String(row.created_at),
      }));
  }

  updateIssueStatus(id: string, status: 'open' | 'resolved' | 'ignored') {
    const update = this.db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
    if (update.changes !== 1) throw new Error('ISSUE_NOT_FOUND');
  }

  getEvidenceAssetId(runId: string): string | undefined {
    const row = this.db.prepare("SELECT asset_id FROM run_artifacts WHERE run_id = ? AND type = 'evidence'").get(runId) as unknown as { asset_id: string } | undefined;
    return row?.asset_id;
  }
}
