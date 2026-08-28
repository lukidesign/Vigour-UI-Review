import { randomUUID } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const APP_NAME = 'Vigour UI Review';
export const APP_VERSION = '0.0.1';
export const LEGACY_APP_NAME = 'Design Acceptance 2.0';

export function applicationDataRoots(homeDirectory = homedir()) {
  const applicationSupport = resolve(homeDirectory, 'Library/Application Support');
  return {
    current: resolve(applicationSupport, APP_NAME),
    legacy: resolve(applicationSupport, LEGACY_APP_NAME),
  };
}

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

async function copyPrivateTree(source, target) {
  const metadata = await lstat(source);
  if (metadata.isSymbolicLink()) throw new Error('LEGACY_DATA_CONTAINS_SYMLINK');
  if (metadata.isDirectory()) {
    await mkdir(target, { mode: 0o700 });
    for (const entry of await readdir(source)) await copyPrivateTree(join(source, entry), join(target, entry));
    await chmod(target, 0o700);
    return;
  }
  if (!metadata.isFile()) throw new Error('LEGACY_DATA_CONTAINS_UNSUPPORTED_ENTRY');
  await copyFile(source, target);
  await chmod(target, 0o600);
}

export async function ensureApplicationDataRoot(options = {}) {
  const roots = options.roots ?? applicationDataRoots(options.homeDirectory);
  if (await exists(roots.current)) {
    await mkdir(roots.current, { recursive: true, mode: 0o700 });
    await chmod(roots.current, 0o700);
    return { path: roots.current, migrated: false, legacyPath: roots.legacy };
  }
  await mkdir(dirname(roots.current), { recursive: true, mode: 0o700 });
  if (!(await exists(roots.legacy))) {
    await mkdir(roots.current, { mode: 0o700 });
    await chmod(roots.current, 0o700);
    return { path: roots.current, migrated: false, legacyPath: roots.legacy };
  }

  const temporary = `${roots.current}.migrating-${process.pid}-${randomUUID()}`;
  try {
    await copyPrivateTree(roots.legacy, temporary);
    await writeFile(join(temporary, 'migration.json'), `${JSON.stringify({
      from: LEGACY_APP_NAME,
      to: APP_NAME,
      migratedAt: new Date().toISOString(),
      legacyPreserved: true,
    }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, roots.current);
    return { path: roots.current, migrated: true, legacyPath: roots.legacy };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
