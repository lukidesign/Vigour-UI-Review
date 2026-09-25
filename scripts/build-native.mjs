import { spawn } from 'node:child_process';
import { mkdir, cp, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'apps/native-host/dist');
await mkdir(target, { recursive: true });
const binary = resolve(target, process.platform === 'win32' ? 'vigour-ui-review-host.exe' : 'vigour-ui-review-host');
const compiler = process.env.VIGOUR_RUSTC ?? 'rustc';
await new Promise((done, reject) => {
  const child = spawn(compiler, ['--edition=2021', '--remap-path-prefix', `${root}=vigour-ui-review`, '-C', 'opt-level=s', '-C', 'strip=symbols',
    resolve(root, 'apps/native-host/launcher.rs'), '-o', binary], { stdio: 'inherit' });
  child.once('error', () => reject(new Error('Rust compiler unavailable. Install Rust or set VIGOUR_RUSTC to a rustc executable.')));
  child.once('exit', (code) => code === 0 ? done() : reject(new Error(`Native build failed (${code})`)));
});
await chmod(binary, 0o755);
if (process.platform === 'win32') {
  for (const [source, output] of [
    ['credential-store.rs', resolve(target, 'vigour-ui-review-credentials.exe')],
    ['vision-runner.rs', resolve(root, 'apps/native-host/dist/vision-run.exe')],
  ]) {
    await new Promise((done, reject) => {
      const child = spawn(compiler, ['--edition=2021', '--remap-path-prefix', `${root}=vigour-ui-review`, '-C', 'opt-level=s', '-C', 'strip=symbols',
        resolve(root, 'apps/native-host', source), '-o', output], { stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', (code) => code === 0 ? done() : reject(new Error(`${source} build failed (${code})`)));
    });
  }
}
for (const name of ['host.mjs', 'protocol.mjs', 'runtime.mjs']) await cp(resolve(root, 'apps/native-host', name), resolve(target, name));
console.log('Native Host built (local architecture).');
