import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, readlink, realpath, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

export const PRODUCT = 'com.vigour-ui-review.companion';
export const REQUIRED = ['VERSION', 'runtime/node', 'service/main.js', 'vision-engine/run', 'runtime/python/bin/python3.12', 'workbench/index.html', 'native/vigour-ui-review-host', 'native/host.mjs', 'native/protocol.mjs', 'native/runtime.mjs'];
export function within(root, path) { const value = relative(root, path); return value !== '' && !value.startsWith('..') && !isAbsolute(value); }
export async function inventory(root, { installed = false } = {}) {
  root = await realpath(root); const entries = [];
  async function walk(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = resolve(directory, name); const key = relative(root, path);
      if (key === 'payload.json') continue;
      if (key === 'native/host-config.json') {
        if (!installed || !(await lstat(path)).isFile()) throw new Error('PERSONAL_CONFIG_IN_PACKAGE');
        continue;
      }
      const meta = await lstat(path);
      if (meta.isSymbolicLink()) {
        const link = await readlink(path);
        if (isAbsolute(link) || !within(root, await realpath(path))) throw new Error('UNSAFE_PACKAGE_LINK');
        entries.push({ path: key, link });
      } else if (meta.isDirectory()) await walk(path);
      else if (meta.isFile()) {
        const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk);
        entries.push({ path: key, size: meta.size, sha256: hash.digest('hex'), executable: !!(meta.mode & 0o111) });
      } else throw new Error('UNSAFE_PACKAGE_ENTRY');
    }
  }
  await walk(root); return entries;
}
export async function seal(root) {
  const version = (await readFile(resolve(root, 'VERSION'), 'utf8')).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('INVALID_PACKAGE_VERSION');
  for (const file of REQUIRED) if (!(await lstat(resolve(root, file))).isFile() && !(await lstat(resolve(root, file))).isSymbolicLink()) throw new Error('INCOMPLETE_PACKAGE');
  const result = { product: PRODUCT, schema: 1, version, platform: 'darwin-arm64', entries: await inventory(root) };
  await writeFile(resolve(root, 'payload.json'), `${JSON.stringify(result)}\n`, { mode: 0o644 }); return result;
}
export async function verify(root, options = {}) {
  const manifest = JSON.parse(await readFile(resolve(root, 'payload.json'), 'utf8'));
  if (manifest.product !== PRODUCT || manifest.schema !== 1 || manifest.platform !== 'darwin-arm64') throw new Error('INVALID_PACKAGE');
  if (JSON.stringify(manifest.entries) !== JSON.stringify(await inventory(root, options))) throw new Error('PACKAGE_INTEGRITY_FAILED');
  for (const file of REQUIRED) if (!manifest.entries.some((entry) => entry.path === file)) throw new Error('INCOMPLETE_PACKAGE');
  if ((await readFile(resolve(root, 'VERSION'), 'utf8')).trim() !== manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('INVALID_PACKAGE_VERSION');
  return manifest;
}
