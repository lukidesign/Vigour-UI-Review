import { spawn } from 'node:child_process';
import { chmod, cp, lstat, mkdir, readFile, readlink, readdir, realpath, rm, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('The v0.0.1 offline package supports macOS arm64 only.');
const packageName = `Vigour-UI-Review-v${manifest.version}-macos-arm64`;
const target = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(root, 'release', packageName);
try { await stat(target); throw new Error(`Release target already exists: ${target}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }

const run = async (command, args) => {
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' }); child.once('error', reject); child.once('exit', resolveExit);
  });
  if (code !== 0) throw new Error(`${command} failed with ${code}`);
};
const capture = async (command, args) => await new Promise((resolveOutput, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  let output = ''; child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.once('error', reject); child.once('exit', (code) => code === 0 ? resolveOutput(output.trim()) : reject(new Error(`${command} failed with ${code}`)));
});
await run('pnpm', ['build']);
await mkdir(resolve(target, 'service'), { recursive: true });
await cp(resolve(root, 'apps/local-service/dist/main.js'), resolve(target, 'service/main.js'));
await cp(resolve(root, 'apps/workbench/dist'), resolve(target, 'workbench'), { recursive: true });
await cp(resolve(root, 'apps/chrome-extension/dist'), resolve(target, 'chrome-extension'), { recursive: true });
await mkdir(resolve(target, 'vision-engine'), { recursive: true });
await mkdir(resolve(target, 'runtime'), { recursive: true });
const pythonExecutable = await capture('uv', ['python', 'find', '3.12']);
const pythonRoot = await realpath(resolve(pythonExecutable, '../..'));
const packagedPythonRoot = resolve(target, 'runtime/python');
await cp(pythonRoot, packagedPythonRoot, { recursive: true });
async function makePythonLinksRelative(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      const destination = await readlink(path);
      if (!destination.startsWith('/')) continue;
      if (destination !== pythonRoot && !destination.startsWith(`${pythonRoot}/`)) throw new Error(`Python runtime contains an external symlink: ${path} -> ${destination}`);
      const packagedDestination = resolve(packagedPythonRoot, relative(pythonRoot, destination));
      await unlink(path);
      await symlink(relative(dirname(path), packagedDestination), path);
    } else if (metadata.isDirectory()) await makePythonLinksRelative(path);
  }
}
await makePythonLinksRelative(packagedPythonRoot);
const sysconfigPath = resolve(packagedPythonRoot, 'lib/python3.12/_sysconfigdata__darwin_darwin.py');
const sysconfig = await readFile(sysconfigPath, 'utf8');
if (!sysconfig.includes(pythonRoot)) throw new Error('Could not locate the Python build prefix for relocation');
const pythonPrefixMarker = '__VIGOUR_UI_REVIEW_PYTHON_ROOT__';
await writeFile(sysconfigPath, `${sysconfig.replaceAll(pythonRoot, pythonPrefixMarker)}
from pathlib import Path as _VigourPath
_vigour_prefix = str(_VigourPath(__file__).resolve().parents[2])
build_time_vars = {key: (value.replace("${pythonPrefixMarker}", _vigour_prefix) if isinstance(value, str) else value) for key, value in build_time_vars.items()}
del _VigourPath, _vigour_prefix
`, { mode: 0o644 });
const packagedPythonLibrary = resolve(packagedPythonRoot, 'lib/libpython3.12.dylib');
await run('/usr/bin/install_name_tool', ['-id', '@rpath/libpython3.12.dylib', packagedPythonLibrary]);
await run('/usr/bin/codesign', ['--force', '--sign', '-', packagedPythonLibrary]);
await run('uv', ['pip', 'install', '--python', resolve(target, 'runtime/python/bin/python3.12'), '--target', resolve(target, 'vision-engine/site-packages'), resolve(root, 'apps/vision-engine') + '[ocr]']);
await rm(resolve(target, 'vision-engine/site-packages/bin'), { recursive: true, force: true });
await rm(resolve(target, `vision-engine/site-packages/vigour_ui_review_vision-${manifest.version}.dist-info/direct_url.json`), { force: true });
async function removeBuildOnlyFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if ((entry.isDirectory() && entry.name === '__pycache__') || (entry.isFile() && (entry.name.endsWith('.pyc') || entry.name.endsWith('.map') || entry.name === 'direct_url.json'))) {
      await rm(path, { recursive: entry.isDirectory(), force: true });
    } else if (entry.isDirectory()) await removeBuildOnlyFiles(path);
  }
}
await removeBuildOnlyFiles(target);
await cp(resolve(root, 'scripts/vision-run'), resolve(target, 'vision-engine/run'));
await chmod(resolve(target, 'vision-engine/run'), 0o755);
await cp(resolve(root, 'scripts/start-local.mjs'), resolve(target, 'start-local.mjs'));
await cp(resolve(root, 'scripts/app-paths.mjs'), resolve(target, 'app-paths.mjs'));
await cp(process.execPath, resolve(target, 'runtime/node'));
await cp(resolve(root, 'scripts/start.command'), resolve(target, 'start.command'));
await chmod(resolve(target, 'start.command'), 0o755);
await cp(resolve(root, 'docs/INSTALL.md'), resolve(target, 'INSTALL.md'));
await cp(resolve(root, 'LICENSE'), resolve(target, 'LICENSE'));
await cp(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(target, 'THIRD_PARTY_NOTICES.md'));
const thirdPartyRoot = resolve(target, 'THIRD_PARTY_LICENSES');
await mkdir(resolve(thirdPartyRoot, 'javascript'), { recursive: true });
await cp(resolve(dirname(process.execPath), '../LICENSE'), resolve(thirdPartyRoot, 'Node.js-LICENSE.txt'));
await cp(resolve(packagedPythonRoot, 'lib/python3.12/LICENSE.txt'), resolve(thirdPartyRoot, 'Python-LICENSE.txt'));
await cp(resolve(root, 'licenses/MIT.txt'), resolve(thirdPartyRoot, 'javascript/SPDX-MIT.txt'));
const licenseReport = JSON.parse(await capture('pnpm', ['licenses', 'list', '--prod', '--json']));
const javascriptDependencies = [];
const copiedJavaScriptLicenses = new Set();
for (const [reportedLicense, dependencies] of Object.entries(licenseReport)) {
  for (const dependency of dependencies) {
    for (const dependencyPath of dependency.paths) {
      const dependencyManifest = JSON.parse(await readFile(resolve(dependencyPath, 'package.json'), 'utf8'));
      const dependencyKey = `${dependencyManifest.name}@${dependencyManifest.version}`;
      if (copiedJavaScriptLicenses.has(dependencyKey)) continue;
      copiedJavaScriptLicenses.add(dependencyKey);
      const safeDirectory = dependencyKey.replace(/^@/, '').replaceAll('/', '__');
      const destination = resolve(thirdPartyRoot, 'javascript', safeDirectory);
      await mkdir(destination, { recursive: true });
      const licenseFiles = [];
      for (const entry of await readdir(dependencyPath, { withFileTypes: true })) {
        if (!/^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(entry.name)) continue;
        if (entry.isSymbolicLink()) throw new Error(`Dependency license is a symlink: ${dependencyKey}/${entry.name}`);
        await cp(resolve(dependencyPath, entry.name), resolve(destination, entry.name), { recursive: entry.isDirectory() });
        licenseFiles.push(entry.name);
      }
      javascriptDependencies.push({
        name: dependencyManifest.name,
        version: dependencyManifest.version,
        license: dependencyManifest.license ?? reportedLicense,
        author: dependencyManifest.author ?? dependency.author ?? null,
        homepage: dependencyManifest.homepage ?? dependency.homepage ?? null,
        licenseFiles,
      });
    }
  }
}
javascriptDependencies.sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));
await writeFile(resolve(thirdPartyRoot, 'javascript/DEPENDENCIES.json'), `${JSON.stringify(javascriptDependencies, null, 2)}\n`, { mode: 0o644 });
await writeFile(resolve(target, 'VERSION'), `${manifest.version}\n`, { mode: 0o644 });
console.log(`Developer package created at ${target}`);
