// Exercises the real Windows launchers without registering a browser host.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const projectRoot = resolve(import.meta.dirname, '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 only');
const project = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
const packageRoot = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(projectRoot, 'release', `Vigour-UI-Review-v${project.version}-windows-x64-dev`);

async function invoke(executable, args, input = '') {
  return await new Promise((done, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    const parts = []; let bytes = 0;
    child.stdout.on('data', (part) => { bytes += part.length; if (bytes > 8192) { child.kill(); reject(new Error('Unexpected oversized native output')); } else parts.push(part); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? done(Buffer.concat(parts)) : reject(new Error(`Native helper exited ${code}`)));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}

const credentials = resolve(packageRoot, 'native/vigour-ui-review-credentials.exe');
const existing = await invoke(credentials, ['read', 'self-test']);
if (existing.length) throw new Error('Refusing to replace an existing self-test credential');
const secret = randomBytes(32).toString('hex');
try {
  await invoke(credentials, ['save', 'self-test'], secret);
  assert.equal((await invoke(credentials, ['read', 'self-test'])).toString(), secret);
} finally { await invoke(credentials, ['remove', 'self-test']); }
assert.equal((await invoke(credentials, ['read', 'self-test'])).length, 0);

const temporary = await mkdtemp(join(tmpdir(), 'vigour-win-native-'));
try {
  await mkdir(join(temporary, 'native'));
  await mkdir(join(temporary, 'runtime'));
  await cp(resolve(packageRoot, 'runtime/node.exe'), join(temporary, 'runtime/node.exe'));
  for (const name of ['vigour-ui-review-host.exe', 'host.mjs', 'protocol.mjs', 'runtime.mjs']) {
    await cp(resolve(packageRoot, 'native', name), join(temporary, 'native', name));
  }
  await writeFile(join(temporary, 'native/host-config.json'), JSON.stringify({ extensionId: 'a'.repeat(32), dataRoot: temporary }));
  const frame = await invoke(join(temporary, 'native/vigour-ui-review-host.exe'), [`chrome-extension://${'b'.repeat(32)}/`]);
  assert(frame.length >= 4 && frame.readUInt32LE(0) === frame.length - 4, 'Windows Native Messaging framing is corrupt');
  assert.equal(JSON.parse(frame.subarray(4).toString()).code, 'NATIVE_FORBIDDEN');
  console.log('Windows Credential Manager and binary Native Messaging framing passed. No Chrome registration changed.');
} finally { await rm(temporary, { recursive: true, force: true }); }
