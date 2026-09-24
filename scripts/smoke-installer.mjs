// Real offline runtime, isolated home and registration. Never uses the user's Chrome profile.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInstaller } from '../apps/companion-installer/installer-core.mjs';
import { encodeFrame } from '../apps/native-host/protocol.mjs';

const source = process.env.VIGOUR_INSTALLER_PAYLOAD;
assert(source, 'Set VIGOUR_INSTALLER_PAYLOAD to a sealed companion payload');
const probe = createServer();
await new Promise((done, reject) => { probe.once('error', reject); probe.listen(4179, '127.0.0.1', done); });
await new Promise((done) => probe.close(done));
const home = await realpath(await mkdtemp(join(tmpdir(), 'vigour-installer-smoke-')));
const support = join(home, 'Library/Application Support');
const root = join(support, 'Vigour UI Review Companion');
const data = join(support, 'Vigour UI Review');
const registry = join(support, 'Google/Chrome/NativeMessagingHosts/com.vigour_ui_review.local.json');
const installer = await createInstaller(home);
const extensionId = 'a'.repeat(32);
const base = 'http://127.0.0.1:4179';
let connected = false;
async function record() { return JSON.parse(await readFile(join(root, 'current.json'), 'utf8')); }
async function host() {
  const manifest = JSON.parse(await readFile(registry, 'utf8'));
  assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${extensionId}/`]);
  const bytes = await new Promise((done, reject) => {
    const child = spawn(manifest.path, [`chrome-extension://${extensionId}/`], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let total = 0;
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Own test host timeout')); }, 70_000);
    child.stdout.on('data', (chunk) => { total += chunk.length; if (total > 32768) { child.kill('SIGTERM'); reject(new Error('Oversize frame')); } chunks.push(chunk); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => { clearTimeout(timer); code === 0 ? done(Buffer.concat(chunks)) : reject(new Error(`Host exit ${code}`)); });
    child.stdin.on('error', () => {}); child.stdin.end(encodeFrame({ protocol: 1, command: 'connect' }));
  });
  assert(bytes.length >= 4 && bytes.readUInt32LE(0) === bytes.length - 4);
  const response = JSON.parse(bytes.subarray(4)); assert.equal(response.ok, true, response.code);
  connected = true;
  const state = JSON.parse(await readFile(join(data, 'native-state.json'), 'utf8'));
  assert.equal(state.installationRoot, join(root, 'versions', (await record()).active.directory));
  assert.equal(state.instanceId, response.instanceId);
  const capability = await fetch(`${base}/api/v1/capabilities`, { headers: { authorization: `Bearer ${response.sessionToken}` } });
  assert.equal((await capability.json()).localVision, true);
  return response;
}
try {
  await installer.perform('install', { source: resolve(source), extensionId });
  const firstRecord = await record();
  await writeFile(join(data, 'user-project-preservation.txt'), 'keep this user data');
  const first = await host();
  console.log('Isolated offline install + actual Native host + bundled vision: passed');
  await installer.perform('install', { source: resolve(source), extensionId }); connected = false;
  const secondRecord = await record();
  assert.equal(secondRecord.previous.directory, firstRecord.active.directory);
  const second = await host();
  assert.notEqual(first.instanceId, second.instanceId); assert.notEqual(first.sessionToken, second.sessionToken);
  assert.equal((await fetch(`${base}/api/v1/capabilities`, { headers: { authorization: `Bearer ${first.sessionToken}` } })).status, 401);
  console.log('Authenticated stop + update + credential rotation: passed');
  await installer.perform('rollback'); connected = false;
  assert.equal((await record()).active.directory, firstRecord.active.directory);
  await installer.perform('repair');
  await host();
  await installer.perform('uninstall'); connected = false;
  await assert.rejects(readFile(registry), { code: 'ENOENT' });
  await assert.rejects(readFile(join(root, 'current.json')), { code: 'ENOENT' });
  assert.equal(await readFile(join(data, 'user-project-preservation.txt'), 'utf8'), 'keep this user data');
  assert((await readdir(join(home, '.Trash'))).some((name) => name.startsWith('Vigour UI Review Companion-')));
  console.log('Rollback (same schema) + repair + live uninstall + data retained in isolated home: passed');
} finally {
  // Retain evidence if cleanup cannot verify ownership; never kill unrelated processes.
  if (connected) { await installer.perform('uninstall'); connected = false; }
  await rm(home, { recursive: true, force: true });
}
