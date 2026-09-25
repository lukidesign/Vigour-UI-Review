// Development payload builder. Run only on a Windows x64 build machine.
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { seal } from '../apps/companion-installer/payload.mjs';

const root = resolve(import.meta.dirname, '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows 11 x64 build machine required');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const target = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(root, 'release', `Vigour-UI-Review-v${manifest.version}-windows-x64-dev`);
try { await stat(target); throw new Error(`Refusing to overwrite ${target}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

async function command(executable, args, capture = false) {
  return await new Promise((done, reject) => {
    const child = spawn(executable, args, { cwd: root, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', windowsHide: true });
    let output = ''; if (capture) child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? done(output.trim()) : reject(new Error(`${executable} exited ${code}`)));
  });
}
async function pnpm(args, capture = false) {
  if (!process.env.npm_execpath) throw new Error('Run this builder through pnpm package:windows');
  return command(process.execPath, [process.env.npm_execpath, ...args], capture);
}
async function firstFile(paths) {
  for (const path of paths) { try { if ((await stat(path)).isFile()) return path; } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  throw new Error(`Bundled runtime license missing: ${paths.join(', ')}`);
}
async function stripBuildFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if ((entry.isDirectory() && entry.name === '__pycache__') || (entry.isFile() && (entry.name.endsWith('.pyc') || entry.name.endsWith('.map') || entry.name === 'direct_url.json'))) {
      await rm(path, { recursive: entry.isDirectory(), force: true });
    } else if (entry.isDirectory()) await stripBuildFiles(path);
  }
}

await pnpm(['build']);
await pnpm(['build:native']);
await mkdir(resolve(target, 'service'), { recursive: true });
await mkdir(resolve(target, 'vision-engine'), { recursive: true });
await mkdir(resolve(target, 'runtime'), { recursive: true });
await cp(resolve(root, 'apps/local-service/dist/main.js'), resolve(target, 'service/main.js'));
await cp(resolve(root, 'apps/workbench/dist'), resolve(target, 'workbench'), { recursive: true });
await cp(resolve(root, 'apps/chrome-extension/dist'), resolve(target, 'chrome-extension'), { recursive: true });
await mkdir(resolve(target, 'native'), { recursive: true });
for (const name of ['host.mjs', 'protocol.mjs', 'runtime.mjs', 'vigour-ui-review-host.exe', 'vigour-ui-review-credentials.exe']) {
  await cp(resolve(root, 'apps/native-host/dist', name), resolve(target, 'native', name));
}
await cp(resolve(root, 'apps/native-host/dist/vision-run.exe'), resolve(target, 'vision-engine/run.exe'));
await cp(process.execPath, resolve(target, 'runtime/node.exe'));

await command('uv', ['python', 'install', '3.12', '--managed-python']);
const pythonExecutable = await command('uv', ['python', 'find', '3.12', '--managed-python', '--resolve-links'], true);
if (!pythonExecutable.toLowerCase().endsWith('python.exe')) throw new Error('Managed Windows Python not found');
const pythonRoot = dirname(pythonExecutable);
await cp(pythonRoot, resolve(target, 'runtime/python'), { recursive: true });
const requirements = await command('uv', ['export', '--project', 'apps/vision-engine', '--extra', 'ocr', '--no-dev', '--no-emit-project', '--format', 'requirements-txt', '--frozen'], true);
const requirementsPath = resolve(target, 'vision-engine/requirements.lock.txt');
await writeFile(requirementsPath, `${requirements}\n`);
await command('uv', ['pip', 'install', '--python', resolve(target, 'runtime/python/python.exe'), '--target', resolve(target, 'vision-engine/site-packages'), '--require-hashes', '--no-deps', '-r', requirementsPath]);
await command('uv', ['pip', 'install', '--python', resolve(target, 'runtime/python/python.exe'), '--target', resolve(target, 'vision-engine/site-packages'), '--no-deps', resolve(root, 'apps/vision-engine')]);
await rm(resolve(target, 'vision-engine/site-packages/Scripts'), { recursive: true, force: true });
await rm(resolve(target, 'vision-engine/site-packages/bin'), { recursive: true, force: true });
await stripBuildFiles(target);

await cp(resolve(root, 'LICENSE'), resolve(target, 'LICENSE'));
await cp(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(target, 'THIRD_PARTY_NOTICES.md'));
const licenses = resolve(target, 'THIRD_PARTY_LICENSES');
await mkdir(resolve(licenses, 'javascript'), { recursive: true });
await cp(await firstFile([resolve(dirname(process.execPath), 'LICENSE'), resolve(dirname(process.execPath), '../LICENSE')]), resolve(licenses, 'Node.js-LICENSE.txt'));
await cp(await firstFile([resolve(pythonRoot, 'LICENSE.txt'), resolve(pythonRoot, 'LICENSE')]), resolve(licenses, 'Python-LICENSE.txt'));
await cp(resolve(root, 'licenses/MIT.txt'), resolve(licenses, 'javascript/SPDX-MIT.txt'));
const rustSysroot = await command(process.env.VIGOUR_RUSTC ?? 'rustc', ['--print', 'sysroot'], true);
await mkdir(resolve(licenses, 'rust'), { recursive: true });
await cp(resolve(rustSysroot, 'share/doc/rust/COPYRIGHT-library.html'), resolve(licenses, 'rust/COPYRIGHT-library.html'));
await cp(resolve(rustSysroot, 'share/doc/rust/licenses'), resolve(licenses, 'rust/licenses'), { recursive: true });
const licenseReport = JSON.parse(await pnpm(['licenses', 'list', '--prod', '--json'], true));
const dependencies = []; const copied = new Set();
for (const [reportedLicense, entries] of Object.entries(licenseReport)) {
  for (const entry of entries) for (const path of entry.paths) {
    const metadata = JSON.parse(await readFile(resolve(path, 'package.json'), 'utf8'));
    const key = `${metadata.name}@${metadata.version}`;
    if (copied.has(key)) continue;
    copied.add(key);
    const directory = resolve(licenses, 'javascript', key.replace(/^@/, '').replaceAll('/', '__'));
    await mkdir(directory, { recursive: true });
    const files = [];
    for (const file of await readdir(path, { withFileTypes: true })) {
      if (!/^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(file.name)) continue;
      if (file.isSymbolicLink()) throw new Error(`Dependency license is a link: ${key}/${file.name}`);
      await cp(resolve(path, file.name), resolve(directory, file.name), { recursive: file.isDirectory() });
      files.push(file.name);
    }
    dependencies.push({ name: metadata.name, version: metadata.version, license: metadata.license ?? reportedLicense, licenseFiles: files });
  }
}
dependencies.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
await writeFile(resolve(licenses, 'javascript/DEPENDENCIES.json'), `${JSON.stringify(dependencies, null, 2)}\n`);
await writeFile(resolve(target, 'VERSION'), `${manifest.version}\n`);
await seal(target, { platform: 'win32-x64' });
console.log(`Windows x64 developer payload: ${target}`);
