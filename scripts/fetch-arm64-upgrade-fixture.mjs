import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { verify } from '../apps/companion-installer/payload.mjs';

assert(process.platform === 'darwin' && process.arch === 'arm64');
const root = resolve(import.meta.dirname, '..');
const target = join(root, 'release/arm64-upgrade-fixture');
await mkdir(join(root, 'release'), { recursive: true });
await mkdir(target); // Never overwrite an existing fixture or a user installation.
const archive = join(target, 'beta.1.zip');
execFileSync('/usr/bin/curl', ['--fail', '--location', '--retry', '3', '--max-time', '300', '--output', archive,
  'https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-Setup-v0.0.2-beta.1-macos-arm64-unsigned.zip'], { stdio: 'inherit' });
const hash = createHash('sha256');
for await (const chunk of createReadStream(archive)) hash.update(chunk);
assert.equal(hash.digest('hex'), '35af45dc6327c136327f064d320facdd66a999f59aa2c6ddb874fac22200162b', 'Published beta.1 hash mismatch');
execFileSync('/usr/bin/unzip', ['-t', archive], { stdio: 'ignore' });
const extracted = join(target, 'extracted');
execFileSync('/usr/bin/ditto', ['-x', '-k', archive, extracted]);
const apps = [];
async function findApps(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '__MACOSX') continue;
    const path = join(directory, entry.name);
    if (entry.name.endsWith('.app')) apps.push(path);
    else await findApps(path);
  }
}
await findApps(extracted);
assert.equal(apps.length, 1, 'Expected one published installer');
const source = join(apps[0], 'Contents/Resources/companion');
await verify(source, { expectedPlatform: 'darwin-arm64' });
await rename(source, join(target, 'payload')); // Same fresh fixture directory; avoid a second full runtime copy.
console.log('Checksum-verified published beta.1 payload ready for isolated upgrade test');
