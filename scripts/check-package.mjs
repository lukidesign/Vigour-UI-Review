import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, readlink, realpath, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageName = `Vigour-UI-Review-v${manifest.version}-macos-arm64`;
const packageRoot = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(root, 'release', packageName);
const realPackageRoot = await realpath(packageRoot);
const failures = [];
const files = [];
let totalBytes = 0;

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    const projectPath = relative(packageRoot, path);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      const target = await readlink(path);
      if (target.startsWith('/')) failures.push(`Absolute symlink: ${projectPath} -> ${target}`);
      else {
        try {
          const destination = await realpath(resolve(directory, target));
          if (destination !== realPackageRoot && !destination.startsWith(`${realPackageRoot}/`)) failures.push(`Symlink escapes package: ${projectPath} -> ${target}`);
        } catch { failures.push(`Broken symlink: ${projectPath} -> ${target}`); }
      }
    } else if (metadata.isDirectory()) await walk(path);
    else if (metadata.isFile()) { files.push({ path, projectPath, size: metadata.size }); totalBytes += metadata.size; }
  }
}
await walk(packageRoot);

const privateMarkers = [root, tmpdir(), process.env.GITHUB_WORKSPACE, process.env.RUNNER_TEMP, process.env.CI ? undefined : homedir(), 'codex-clipboard-']
  .filter(Boolean).map((value) => Buffer.from(value));
const overlapSize = Math.max(...privateMarkers.map((value) => value.length)) - 1;
for (const file of files) {
  let previous = Buffer.alloc(0);
  for await (const chunk of createReadStream(file.path)) {
    const combined = Buffer.concat([previous, chunk]);
    if (privateMarkers.some((marker) => combined.includes(marker))) {
      failures.push(`Build-machine path leaked into ${file.projectPath}`);
      break;
    }
    previous = combined.subarray(Math.max(0, combined.length - overlapSize));
  }
}

const version = (await readFile(resolve(packageRoot, 'VERSION'), 'utf8')).trim();
if (version !== manifest.version) failures.push(`VERSION contains ${version}, expected ${manifest.version}`);
for (const required of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES/Node.js-LICENSE.txt', 'THIRD_PARTY_LICENSES/Python-LICENSE.txt', 'THIRD_PARTY_LICENSES/javascript/SPDX-MIT.txt', 'THIRD_PARTY_LICENSES/javascript/DEPENDENCIES.json', 'INSTALL.md', 'start.command', 'runtime/node', 'runtime/python/bin/python3.12', 'service/main.js', 'vision-engine/run', 'workbench/index.html', 'chrome-extension/manifest.json']) {
  try { await stat(resolve(packageRoot, required)); } catch { failures.push(`Missing packaged file: ${required}`); }
}
if (files.some(({ projectPath }) => projectPath.endsWith('.pyc') || projectPath.endsWith('.map'))) failures.push('Package contains build-only .pyc or .map files');
if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'ok', version, files: files.length, bytes: totalBytes, absoluteSymlinks: 0, privatePathLeaks: 0 }, null, 2));
