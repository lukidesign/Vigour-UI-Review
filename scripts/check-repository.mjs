import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ignoredNames = new Set(['.git', '.data', '.benchmark-output', '.pytest_cache', '.venv', '__pycache__', 'coverage', 'dist', 'node_modules', 'release', 'release-artifacts']);
const ignoredFiles = new Set(['.DS_Store']);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name) || ignoredFiles.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    const projectPath = relative(root, absolute);
    if (entry.isSymbolicLink()) throw new Error(`Repository source must not contain symlinks: ${projectPath}`);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.isFile()) files.push(projectPath);
  }
}
await walk(root);

const failures = [];
const fail = (message) => failures.push(message);
let totalBytes = 0;
for (const file of files) {
  const metadata = await stat(resolve(root, file)); totalBytes += metadata.size;
  if (metadata.size > 5 * 1024 * 1024) fail(`Source file exceeds 5 MiB: ${file}`);
}

const rootManifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const expectedVersion = rootManifest.version;
const packageManifests = ['apps/chrome-extension/package.json', 'apps/local-service/package.json', 'apps/workbench/package.json', 'packages/contracts/package.json', 'packages/scoring/package.json'];
for (const file of packageManifests) {
  const manifest = JSON.parse(await readFile(resolve(root, file), 'utf8'));
  if (manifest.version !== expectedVersion) fail(`${file} version ${manifest.version} does not match ${expectedVersion}`);
  if (!manifest.name.startsWith('@vigour-ui-review/')) fail(`${file} uses an unexpected package scope: ${manifest.name}`);
}

const chromeManifest = JSON.parse(await readFile(resolve(root, 'apps/chrome-extension/public/manifest.json'), 'utf8'));
if (chromeManifest.version !== expectedVersion) fail(`Chrome manifest version does not match ${expectedVersion}`);
if (chromeManifest.name !== 'Vigour UI Review') fail('Chrome extension product name is inconsistent');
const pyproject = await readFile(resolve(root, 'apps/vision-engine/pyproject.toml'), 'utf8');
if (!pyproject.includes(`version = "${expectedVersion}"`)) fail('Python project version is inconsistent');
const pythonInit = await readFile(resolve(root, 'apps/vision-engine/src/design_acceptance_vision/__init__.py'), 'utf8');
if (!pythonInit.includes(`__version__ = "${expectedVersion}"`)) fail('Python engine runtime version is inconsistent');
const appSource = await readFile(resolve(root, 'apps/local-service/src/app.ts'), 'utf8');
if (!appSource.includes(`service: 'vigour-ui-review-local', version: '${expectedVersion}'`)) fail('Local-service health version is inconsistent');
const appPaths = await readFile(resolve(root, 'scripts/app-paths.mjs'), 'utf8');
if (!appPaths.includes(`APP_VERSION = '${expectedVersion}'`)) fail('Launcher version is inconsistent');

const textExtensions = new Set(['', '.command', '.css', '.html', '.js', '.json', '.md', '.mjs', '.py', '.toml', '.ts', '.vue', '.yaml', '.yml']);
const dependencyLockFiles = new Set(['pnpm-lock.yaml', 'apps/vision-engine/uv.lock']);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bfigd_[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
];
for (const file of files) {
  if (!textExtensions.has(extname(file)) || (await stat(resolve(root, file))).size > 2 * 1024 * 1024) continue;
  const content = await readFile(resolve(root, file), 'utf8');
  const isPathChecker = file === 'scripts/check-repository.mjs' || file === 'scripts/check-package.mjs';
  if (!isPathChecker && (content.includes('/Users/lukidesign') || content.includes('/var/folders/0c/') || content.includes('codex-clipboard-'))) fail(`Local absolute path leaked into ${file}`);
  if (secretPatterns.some((pattern) => pattern.test(content))) fail(`Possible credential found in ${file}`);
  if (!isPathChecker && !dependencyLockFiles.has(file) && content.includes('0.1.0')) fail(`Stale 0.1.0 product version found in ${file}`);
  if (file.endsWith('.md')) {
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(https?:|mailto:|\.\.\/\.\.\/(?:releases|compare))/.test(target)) continue;
      try { await lstat(resolve(root, dirname(file), decodeURIComponent(target))); }
      catch { fail(`Broken Markdown link in ${file}: ${target}`); }
    }
  }
}

const requiredFiles = ['LICENSE', 'README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'THIRD_PARTY_NOTICES.md', 'docs/PRIVACY.md', 'docs/SECURITY.md', 'docs/assets/workbench-overview.jpg', 'examples/demo/design.png', 'examples/demo/implementation.png', '.github/dependabot.yml', '.github/workflows/ci.yml', '.github/workflows/release.yml'];
for (const file of requiredFiles) if (!files.includes(file)) fail(`Required public file is missing: ${file}`);
const license = await readFile(resolve(root, 'LICENSE'), 'utf8');
if (!license.includes('Copyright (c) 2026 Vigour UI')) fail('MIT copyright attribution is incorrect');

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'ok', version: expectedVersion, sourceFiles: files.length, sourceBytes: totalBytes }, null, 2));
