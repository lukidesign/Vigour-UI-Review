import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { HOST_NAME, validateOrigin } from '../apps/native-host/protocol.mjs';

// Development registration; distribution installers will invoke the same contract.
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]; const value = process.argv[index + 1];
  if (!['--package', '--extension-id', '--manifest-dir', '--data-dir'].includes(key) || !value) throw new Error('Invalid registration arguments');
  options.set(key, value);
}
if (process.platform !== 'darwin') throw new Error('Registration currently validated on macOS only.');
if (!options.has('--package') || !options.has('--extension-id')) throw new Error('--package and --extension-id are required');
const packageRoot = resolve(options.get('--package'));
const extensionId = options.get('--extension-id');
validateOrigin(`chrome-extension://${extensionId}/`, extensionId);
const binary = resolve(packageRoot, 'native/vigour-ui-review-host');
for (const path of [binary, resolve(packageRoot, 'runtime/node'), resolve(packageRoot, 'service/main.js')]) {
  if (!(await stat(path)).isFile()) throw new Error('Native companion package is incomplete');
}
const manifestDirectory = resolve(options.get('--manifest-dir') ?? resolve(homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts'));
const dataRoot = resolve(options.get('--data-dir') ?? resolve(homedir(), 'Library/Application Support/Vigour UI Review'));
const manifestPath = resolve(manifestDirectory, `${HOST_NAME}.json`);
try {
  const previous = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (previous.path !== binary) throw new Error('Another companion is registered. Unregister it explicitly before replacing its location.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(manifestDirectory, { recursive: true, mode: 0o700 });
async function atomic(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temporary, path);
}
await atomic(resolve(packageRoot, 'native/host-config.json'), { extensionId, dataRoot });
await atomic(manifestPath, { name: HOST_NAME, description: 'Vigour UI Review local companion', path: binary,
  type: 'stdio', allowed_origins: [`chrome-extension://${extensionId}/`] });
console.log('Native Host registered for the specified extension. No service was started.');
