import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

export const DATABASE_FILENAME = 'vigour-ui-review.sqlite3';
export const LEGACY_DATABASE_FILENAME = 'design-acceptance.sqlite3';

export function resolveDatabasePath(dataDir: string): string {
  const current = resolve(dataDir, DATABASE_FILENAME);
  const legacy = resolve(dataDir, LEGACY_DATABASE_FILENAME);
  if (existsSync(current) || !existsSync(legacy)) return current;

  for (const suffix of ['-wal', '-shm']) {
    const legacySidecar = `${legacy}${suffix}`;
    if (existsSync(legacySidecar)) renameSync(legacySidecar, `${current}${suffix}`);
  }
  renameSync(legacy, current);
  return current;
}
