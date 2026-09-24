// Isolated developer integration test. Never registers with the user's Chrome.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, cp, readFile, symlink, rm, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { encodeFrame } from '../apps/native-host/protocol.mjs';

const source = resolve(import.meta.dirname, '..');
const base = 'http://127.0.0.1:4179';
const extensionId = 'a'.repeat(32);
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function occupy() {
  const server = createServer((_request, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"service":"unrelated"}'); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(4179, '127.0.0.1', done); });
  return server;
}
const closeServer = (server) => new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
// Refuse to run if any existing process owns the normal service port.
await closeServer(await occupy());
const root = await mkdtemp(join(tmpdir(), 'vigour-native-smoke-'));
const dataRoot = join(root, 'test-data');
let ownedPid;
let ownedInstance;
let occupied;
async function command(executable, args, options = {}) {
  return await new Promise((done, reject) => {
    const child = spawn(executable, args, { cwd: source, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let output = ''; child.stdout.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? done(output) : reject(new Error(`Test helper exited (${code})`)));
  });
}
async function host(origin = `chrome-extension://${extensionId}/`, request = { protocol: 1, command: 'connect' }) {
  const bytes = await new Promise((done, reject) => {
    const child = spawn(join(root, 'native/vigour-ui-review-host'), [origin], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let total = 0;
    const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Native smoke timeout')); }, 70_000);
    child.stdout.on('data', (chunk) => { total += chunk.length; if (total > 32768) { child.kill('SIGTERM'); reject(new Error('Oversized host response')); } chunks.push(chunk); });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); if (code === 0) done(Buffer.concat(chunks)); else reject(new Error(`Host exit (${code})`)); });
    child.stdin.on('error', () => {}); child.stdin.end(encodeFrame(request));
  });
  assert(bytes.length >= 4 && bytes.readUInt32LE(0) === bytes.length - 4, 'Host must emit one clean protocol frame');
  return JSON.parse(bytes.subarray(4).toString());
}
async function rememberOwnProcess() {
  const state = JSON.parse(await readFile(join(dataRoot, 'native-state.json'), 'utf8'));
  ownedPid = state.pid; ownedInstance = state.instanceId;
}
async function stopOwnProcess() {
  if (!ownedPid) return;
  let state;
  try { state = JSON.parse(await readFile(join(dataRoot, 'native-state.json'), 'utf8')); }
  catch { ownedPid = undefined; return; }
  assert(state.pid === ownedPid && state.instanceId === ownedInstance, 'Refuse to stop an unrecognized process');
  process.kill(ownedPid, 'SIGTERM');
  for (let attempt = 0; attempt < 100; attempt++) {
    try { process.kill(ownedPid, 0); } catch (error) { if (error.code === 'ESRCH') { ownedPid = undefined; return; } }
    await delay(100);
  }
  throw new Error('Own service did not stop gracefully');
}
function auth(connection) { return { authorization: `Bearer ${connection.sessionToken}`, 'x-csrf-token': connection.sessionToken, origin: `chrome-extension://${extensionId}` }; }
try {
  await mkdir(join(root, 'service')); await mkdir(join(root, 'runtime')); await mkdir(join(root, 'vision-engine'));
  await cp(join(source, 'apps/local-service/dist/main.js'), join(root, 'service/main.js'));
  await cp(join(source, 'apps/native-host/dist'), join(root, 'native'), { recursive: true });
  await cp(join(source, 'apps/workbench/dist'), join(root, 'workbench'), { recursive: true });
  await cp(process.execPath, join(root, 'runtime/node'));
  await symlink(join(source, 'apps/vision-engine/.venv/bin/vigour-ui-review-vision'), join(root, 'vision-engine/run'));
  await command(process.execPath, ['scripts/register-native.mjs', '--package', root, '--extension-id', extensionId, '--manifest-dir', join(root, 'test-manifests'), '--data-dir', dataRoot]);
  const manifest = JSON.parse(await readFile(join(root, 'test-manifests/com.vigour_ui_review.local.json'), 'utf8'));
  assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${extensionId}/`]);
  assert.equal((await host(`chrome-extension://${'b'.repeat(32)}/`)).code, 'NATIVE_FORBIDDEN');
  assert.equal((await host(undefined, { protocol: 1, command: 'exec' })).code, 'NATIVE_BAD_REQUEST');
  occupied = await occupy();
  assert.equal((await host()).code, 'NATIVE_PORT_OCCUPIED');
  assert.equal((await (await fetch(`${base}/health`)).json()).service, 'unrelated');
  await closeServer(occupied); occupied = undefined;
  const [first, duplicate] = await Promise.all([host(), host()]);
  await rememberOwnProcess();
  assert(first.ok === true && duplicate.ok === true, 'Both concurrent host requests must connect');
  assert(first.instanceId === duplicate.instanceId, 'Concurrent requests must reuse a single instance');
  assert(first.sessionToken === duplicate.sessionToken, 'Concurrent requests must share the same session');
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.instanceId, first.instanceId);
  const capabilities = await fetch(`${base}/api/v1/capabilities`, { headers: auth(first) });
  assert.equal(capabilities.status, 200);
  assert.equal((await capabilities.json()).localVision, true);
  const issued = await fetch(`${base}/api/v1/session/tickets`, { method: 'POST', headers: { ...auth(first), 'content-type': 'application/json' }, body: '{}' });
  assert.equal(issued.status, 200); const ticket = (await issued.json()).ticket;
  const exchange = () => fetch(`${base}/api/v1/session/exchange`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ ticket }) });
  const accepted = await exchange(); assert.equal(accepted.status, 200);
  assert((await accepted.json()).sessionToken === first.sessionToken, 'Single-use ticket must transfer the correct session');
  assert.equal((await exchange()).status, 401);
  assert.equal((await fetch(`${base}/`)).status, 200);
  if (process.env.VIGOUR_SMOKE_PLAYWRIGHT) {
    const { verifyWorkbench } = await import('./smoke-native-ui.mjs');
    await verifyWorkbench({ base, headers: auth(first) });
  }
  const deadPid = ownedPid;
  await stopOwnProcess();
  // Exercise recovery of a dead launcher's lock using a PID known to have exited.
  await writeFile(join(dataRoot, 'native-launch.lock'), JSON.stringify({ pid: deadPid }), { mode: 0o600 });
  const old = new Date(Date.now() - 10_000); await utimes(join(dataRoot, 'native-launch.lock'), old, old);
  const second = await host(); await rememberOwnProcess();
  assert(second.ok && second.instanceId !== first.instanceId, 'Restart must have a fresh instance');
  assert(second.sessionToken !== first.sessionToken, 'Restart must rotate credentials');
  assert.equal((await fetch(`${base}/api/v1/capabilities`, { headers: auth(first) })).status, 401);
  assert.equal((await fetch(`${base}/api/v1/capabilities`, { headers: auth(second) })).status, 200);
  console.log('Native smoke passed: exact origin, bounded commands, occupied port untouched, concurrent single instance, vision ready, tickets/replay, restart/rotation, stale-lock recovery. No Chrome registration changed.');
} finally {
  if (occupied) await closeServer(occupied);
  await stopOwnProcess();
  await rm(root, { recursive: true, force: true });
}
