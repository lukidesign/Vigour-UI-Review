import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageName = `Vigour-UI-Review-v${manifest.version}-macos-arm64`;
const packageRoot = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(root, 'release', packageName);
const expectedFiles = ['VERSION', 'service/main.js', 'vision-engine/run', 'runtime/node', 'runtime/python/bin/python3.12', 'workbench/index.html'];
for (const file of expectedFiles) await stat(resolve(packageRoot, file));
const packagedVersion = (await readFile(resolve(packageRoot, 'VERSION'), 'utf8')).trim();
if (packagedVersion !== manifest.version) throw new Error(`Package version ${packagedVersion} does not match ${manifest.version}`);

const baseUrl = 'http://127.0.0.1:4179';
try {
  const existing = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1_000) });
  if (existing.ok) throw new Error('Port 4179 is already occupied by a Vigour UI Review service');
} catch (error) {
  if (error instanceof Error && error.message.includes('already occupied')) throw error;
}

const dataRoot = await mkdtemp(resolve(tmpdir(), 'vigour-ui-review-package-smoke-'));
const logs = [];
const child = spawn(resolve(packageRoot, 'runtime/node'), [resolve(packageRoot, 'service/main.js')], {
  cwd: packageRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    VIGOUR_UI_REVIEW_DATA_DIR: dataRoot,
    VIGOUR_UI_REVIEW_VISION_COMMAND: resolve(packageRoot, 'vision-engine/run'),
    VIGOUR_UI_REVIEW_WORKBENCH_ROOT: resolve(packageRoot, 'workbench'),
    PYTHONDONTWRITEBYTECODE: '1',
  },
});
for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
  logs.push(String(chunk));
  if (logs.length > 80) logs.shift();
});

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const waitForExit = (timeout) => Promise.race([
  new Promise((resolveExit) => child.once('exit', resolveExit)),
  delay(timeout).then(() => 'timeout'),
]);
async function stop() {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  if (await waitForExit(10_000) === 'timeout') {
    child.kill('SIGKILL');
    await waitForExit(5_000);
  }
}
async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(120_000) });
  const body = await response.text();
  let data;
  try { data = JSON.parse(body); } catch { data = body; }
  return { response, data };
}

try {
  let health;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Packaged service exited early (${child.exitCode})\n${logs.join('')}`);
    try {
      const result = await request('/health');
      if (result.response.ok) { health = result.data; break; }
    } catch { /* service and bundled vision engine are still starting */ }
    await delay(250);
  }
  if (!health) throw new Error(`Packaged service did not become healthy\n${logs.join('')}`);
  if (health.version !== manifest.version || health.service !== 'vigour-ui-review-local') throw new Error('Packaged health metadata is inconsistent');

  const unauthorized = await request('/api/v1/capabilities');
  if (unauthorized.response.status !== 401) throw new Error(`Unauthenticated API returned ${unauthorized.response.status}, expected 401`);
  const token = (await readFile(resolve(dataRoot, 'session-token'), 'utf8')).trim();
  const authHeaders = { authorization: `Bearer ${token}`, 'x-csrf-token': token, 'content-type': 'application/json' };
  const capabilities = await request('/api/v1/capabilities', { headers: { authorization: `Bearer ${token}` } });
  if (!capabilities.response.ok || capabilities.data.localVision !== true) throw new Error('Bundled local vision engine is unavailable');

  async function upload(kind, filename) {
    const bytes = await readFile(resolve(root, 'examples/demo', filename));
    const result = await request('/api/v1/assets/images', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ kind, filename, dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }),
    });
    if (result.response.status !== 201 || !result.data.id) throw new Error(`Demo ${kind} upload failed: ${result.response.status}`);
    return result.data.id;
  }
  const referenceAssetId = await upload('design', 'design.png');
  const candidateAssetId = await upload('implementation', 'implementation.png');
  const analysis = await request('/api/v1/vision/analyze', {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ referenceAssetId, candidateAssetId, useOcr: false }),
  });
  if (!analysis.response.ok || !analysis.data.evidenceAssetId || !Array.isArray(analysis.data.issues)) {
    throw new Error(`Packaged analysis failed: ${analysis.response.status} ${JSON.stringify(analysis.data)}`);
  }
  const workbench = await request('/');
  if (!workbench.response.ok || typeof workbench.data !== 'string' || !workbench.data.includes('Vigour UI Review')) throw new Error('Packaged workbench did not load');
  console.log(JSON.stringify({
    status: 'ok', version: health.version, localVision: true,
    issueCount: analysis.data.issues.length, evidenceAssetId: analysis.data.evidenceAssetId,
  }, null, 2));
} finally {
  await stop();
  await rm(dataRoot, { recursive: true, force: true });
}
