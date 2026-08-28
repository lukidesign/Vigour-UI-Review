import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureApplicationDataRoot } from './app-paths.mjs';

const cleanup = [];
afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixtureRoots() {
  const root = await mkdtemp(join(tmpdir(), 'vigour-ui-review-migration-'));
  cleanup.push(root);
  return { current: join(root, 'Vigour UI Review'), legacy: join(root, 'Design Acceptance 2.0') };
}

describe('application data migration', () => {
  it('creates a new private data root when no legacy data exists', async () => {
    const roots = await fixtureRoots();
    const result = await ensureApplicationDataRoot({ roots });
    expect(result).toMatchObject({ path: roots.current, migrated: false });
  });

  it('copies legacy data atomically and preserves the legacy directory', async () => {
    const roots = await fixtureRoots();
    await mkdir(join(roots.legacy, 'assets'), { recursive: true });
    await writeFile(join(roots.legacy, 'assets', 'evidence.png'), 'safe-fixture');
    const result = await ensureApplicationDataRoot({ roots });
    expect(result.migrated).toBe(true);
    expect(await readFile(join(roots.current, 'assets', 'evidence.png'), 'utf8')).toBe('safe-fixture');
    expect(await readFile(join(roots.legacy, 'assets', 'evidence.png'), 'utf8')).toBe('safe-fixture');
    expect(JSON.parse(await readFile(join(roots.current, 'migration.json'), 'utf8'))).toMatchObject({ legacyPreserved: true });
    expect((await stat(roots.current)).mode & 0o777).toBe(0o700);
    expect((await stat(join(roots.current, 'assets', 'evidence.png'))).mode & 0o777).toBe(0o600);
  });

  it('never overwrites an existing current data root', async () => {
    const roots = await fixtureRoots();
    await mkdir(roots.current); await mkdir(roots.legacy);
    await writeFile(join(roots.current, 'state'), 'current');
    await writeFile(join(roots.legacy, 'state'), 'legacy');
    const result = await ensureApplicationDataRoot({ roots });
    expect(result.migrated).toBe(false);
    expect(await readFile(join(roots.current, 'state'), 'utf8')).toBe('current');
  });

  it('rejects symlinks without creating a partial current directory', async () => {
    const roots = await fixtureRoots();
    await mkdir(roots.legacy);
    await symlink('/tmp', join(roots.legacy, 'unsafe-link'));
    await expect(ensureApplicationDataRoot({ roots })).rejects.toThrow('LEGACY_DATA_CONTAINS_SYMLINK');
    const { access } = await import('node:fs/promises');
    await expect(access(roots.current)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
