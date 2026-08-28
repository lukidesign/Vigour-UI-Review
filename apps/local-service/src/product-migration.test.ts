import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATABASE_FILENAME, LEGACY_DATABASE_FILENAME, resolveDatabasePath } from './product-migration.js';

describe('database product migration', () => {
  it('uses the branded filename for a new data directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vigour-ui-review-db-'));
    expect(resolveDatabasePath(directory)).toBe(join(directory, DATABASE_FILENAME));
  });

  it('moves a legacy database and sidecars to the branded filename', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vigour-ui-review-db-'));
    const legacy = join(directory, LEGACY_DATABASE_FILENAME);
    writeFileSync(legacy, 'database'); writeFileSync(`${legacy}-wal`, 'wal'); writeFileSync(`${legacy}-shm`, 'shm');
    const current = resolveDatabasePath(directory);
    expect(readFileSync(current, 'utf8')).toBe('database');
    expect(readFileSync(`${current}-wal`, 'utf8')).toBe('wal');
    expect(readFileSync(`${current}-shm`, 'utf8')).toBe('shm');
    expect(existsSync(legacy)).toBe(false);
  });

  it('never overwrites a current database when both versions exist', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vigour-ui-review-db-'));
    const current = join(directory, DATABASE_FILENAME); const legacy = join(directory, LEGACY_DATABASE_FILENAME);
    writeFileSync(current, 'current'); writeFileSync(legacy, 'legacy');
    expect(resolveDatabasePath(directory)).toBe(current);
    expect(readFileSync(current, 'utf8')).toBe('current');
    expect(readFileSync(legacy, 'utf8')).toBe('legacy');
  });
});
