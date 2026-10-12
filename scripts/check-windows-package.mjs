import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { verify, WINDOWS_REQUIRED } from '../apps/companion-installer/payload.mjs';

const root = resolve(import.meta.dirname, '..');
const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageRoot = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(root, 'release', `Vigour-UI-Review-v${project.version}-windows-x64-dev`);
const payload = await verify(packageRoot, { expectedPlatform: 'win32-x64' });
const expected = [...WINDOWS_REQUIRED, 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES/Node.js-LICENSE.txt',
  'THIRD_PARTY_LICENSES/Python-LICENSE.txt', 'THIRD_PARTY_LICENSES/javascript/SPDX-MIT.txt',
  'THIRD_PARTY_LICENSES/javascript/DEPENDENCIES.json', 'chrome-extension/manifest.json'];
for (const path of expected) if (!(await stat(resolve(packageRoot, path))).isFile()) throw new Error(`Missing ${path}`);
// Prebuilt Windows wheels may contain their upstream builder's generic profile
// path. On CI, only reject paths unique to this checkout/run; match the macOS
// package check's treatment of the runner's home directory.
const markers = [root, tmpdir(), process.env.GITHUB_WORKSPACE, process.env.RUNNER_TEMP, process.env.CI ? undefined : homedir()]
  .filter(Boolean).map((value) => Buffer.from(value));
const overlap = Math.max(...markers.map((value) => value.length)) - 1;
let files = 0; let bytes = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      if (!entry.isFile()) throw new Error(`Unsafe package entry: ${relative(packageRoot, path)}`);
      if (/\.(?:pyc|map)$/i.test(path) || /(?:^|[/\\])host-config\.json$/i.test(path)) throw new Error(`Build-only file: ${path}`);
      files += 1; bytes += (await stat(path)).size;
      let previous = Buffer.alloc(0);
      for await (const part of createReadStream(path)) {
        const combined = Buffer.concat([previous, part]);
        if (markers.some((marker) => combined.includes(marker))) throw new Error(`Build path leaked: ${relative(packageRoot, path)}`);
        previous = combined.subarray(Math.max(0, combined.length - overlap));
      }
    }
  }
}
await walk(packageRoot);
console.log(JSON.stringify({ platform: payload.platform, version: payload.version, files, bytes, privatePathLeaks: 0 }, null, 2));
