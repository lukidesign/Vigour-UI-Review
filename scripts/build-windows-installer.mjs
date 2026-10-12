import { spawn } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verify } from '../apps/companion-installer/payload.mjs';

const root = resolve(import.meta.dirname, '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build the Windows installer on Windows x64');
const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageRoot = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(root, 'release', `Vigour-UI-Review-v${project.version}-windows-x64-dev`);
await verify(packageRoot, { expectedPlatform: 'win32-x64' });
const extensionId = process.env.VIGOUR_STORE_EXTENSION_ID ?? 'dmkfgmpbomjjhalgnfhcpalobdnklchh';
if (!/^[a-p]{32}$/.test(extensionId)) throw new Error('Invalid Chrome extension ID');
const output = resolve(root, 'release/windows-setup');
await mkdir(output, { recursive: true });
const candidates = [process.env.VIGOUR_ISCC, 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe', 'C:\\Program Files\\Inno Setup 6\\ISCC.exe'].filter(Boolean);
let compiler;
for (const candidate of candidates) {
  try { if ((await stat(candidate)).isFile()) { compiler = candidate; break; } }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!compiler) throw new Error('Inno Setup 6 compiler missing; set VIGOUR_ISCC to ISCC.exe');
const argumentsList = [
  `/DSourceDir=${packageRoot}`, `/DRepoDir=${root}`, `/DAppVersion=${project.version}`,
  `/DExtensionId=${extensionId}`, `/O${output}`, resolve(root, 'apps/companion-installer/WindowsSetup.iss'),
];
await new Promise((done, reject) => {
  const child = spawn(compiler, argumentsList, { cwd: root, stdio: 'inherit', windowsHide: true });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? done() : reject(new Error(`Inno Setup failed (${code})`)));
});
console.log(`Windows x64 development installer created in ${output}`);
