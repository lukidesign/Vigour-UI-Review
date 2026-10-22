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
const legacySource = process.env.VIGOUR_LEGACY_INSTALLER_PAYLOAD;
if (legacySource) assert.equal(process.arch, 'arm64', 'Published beta.1 upgrade fixture is arm64 only');
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
async function api(token, path, body) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'x-csrf-token': token, 'content-type': 'application/json', origin: base },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120_000) });
  assert(response.ok, `${path}: ${response.status}`);
  return response;
}
async function seedLegacyData(token) {
  const demo = resolve(import.meta.dirname, '../examples/demo');
  const design = await readFile(join(demo, 'design.png'));
  const implementation = await readFile(join(demo, 'implementation.png'));
  const project = await (await api(token, '/api/v1/projects', { name: 'Synthetic beta.1 upgrade fixture', description: 'No user data or secrets' })).json();
  const reference = await (await api(token, '/api/v1/assets/images', { kind: 'design', filename: 'design.png', dataUrl: `data:image/png;base64,${design.toString('base64')}` })).json();
  const capture = await (await api(token, '/api/v1/captures', { pageUrl: 'https://example.test/', title: 'Synthetic preserved capture', mode: 'viewport',
    viewport: { width: implementation.readUInt32BE(16), height: implementation.readUInt32BE(20), deviceScaleFactor: 1 },
    page: { width: implementation.readUInt32BE(16), height: implementation.readUInt32BE(20) }, dom: [],
    segments: [{ y: 0, dataUrl: `data:image/png;base64,${implementation.toString('base64')}` }], capturedAt: new Date().toISOString() })).json();
  assert.equal(capture.analysisReady, true);
  const result = await (await api(token, '/api/v1/runs/analyze', { projectId: project.id, referenceAssetId: reference.id, candidateAssetId: capture.imageAssetId, useOcr: false })).json();
  const saved = await (await api(token, `/api/v1/runs/${result.run.id}`)).json();
  const evidence = Buffer.from(await (await api(token, `/api/v1/assets/images/${saved.evidenceAssetId}/content`)).arrayBuffer());
  return { project, capture, saved, evidence, implementation };
}
async function assertLegacyData(token, fixture) {
  const projects = await (await api(token, '/api/v1/projects')).json();
  assert.deepEqual(projects.find((project) => project.id === fixture.project.id), fixture.project);
  const saved = await (await api(token, `/api/v1/runs/${fixture.saved.run.id}`)).json();
  assert.deepEqual(saved, fixture.saved, 'Upgrade must retain run, issue IDs/content and evidence relationship');
  const evidence = Buffer.from(await (await api(token, `/api/v1/assets/images/${saved.evidenceAssetId}/content`)).arrayBuffer());
  assert.deepEqual(evidence, fixture.evidence, 'Existing evidence PNG must remain byte-identical');
  const captures = await (await api(token, '/api/v1/captures')).json();
  const capture = captures.find((item) => item.id === fixture.capture.id);
  assert.equal(capture?.processingState, 'ready', 'Legacy usable captures must migrate to ready');
  assert.equal(capture.imageAssetId, fixture.capture.imageAssetId);
  assert.deepEqual(Buffer.from(await (await api(token, `/api/v1/assets/images/${capture.imageAssetId}/content`)).arrayBuffer()), fixture.implementation);
  const json = await (await api(token, `/api/v1/runs/${saved.run.id}/export/json`)).json();
  assert.deepEqual(json.issues, saved.issues);
  const markdown = await (await api(token, `/api/v1/runs/${saved.run.id}/export/markdown`)).text();
  assert(markdown.includes(`${saved.run.id}-annotated.png`) && markdown.includes('## 问题详情'));
  const capabilities = await (await api(token, '/api/v1/capabilities')).json();
  assert.equal(capabilities.localOcr, true, 'Upgrade must retain the Apple Silicon OCR dependency profile');
}
try {
  await installer.perform('install', { source: resolve(legacySource ?? source), extensionId });
  const firstRecord = await record();
  await writeFile(join(data, 'user-project-preservation.txt'), 'keep this user data');
  const first = await host();
  const legacyData = legacySource ? await seedLegacyData(first.sessionToken) : undefined;
  console.log('Isolated offline install + actual Native host + bundled vision: passed');
  await installer.perform('install', { source: resolve(source), extensionId }); connected = false;
  const secondRecord = await record();
  assert.equal(secondRecord.previous.directory, firstRecord.active.directory);
  const second = await host();
  assert.notEqual(first.instanceId, second.instanceId); assert.notEqual(first.sessionToken, second.sessionToken);
  assert.equal((await fetch(`${base}/api/v1/capabilities`, { headers: { authorization: `Bearer ${first.sessionToken}` } })).status, 401);
  console.log('Authenticated stop + update + credential rotation: passed');
  let rollbackDirectory = firstRecord.active.directory;
  if (legacyData) {
    await assertLegacyData(second.sessionToken, legacyData);
    console.log('Published beta.1 -> current: project/capture/run/issues/PNG retained, migrated capture state, Markdown/JSON exports and OCR dependencies passed');
    // Do not downgrade the migrated database to beta.1. Exercise rollback only
    // between two current-schema installations, as documented by the installer.
    await installer.perform('install', { source: resolve(source), extensionId }); connected = false;
    rollbackDirectory = secondRecord.active.directory;
    await host();
  }
  await installer.perform('rollback'); connected = false;
  assert.equal((await record()).active.directory, rollbackDirectory);
  await installer.perform('repair');
  const repaired = await host();
  if (legacyData) await assertLegacyData(repaired.sessionToken, legacyData);
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
