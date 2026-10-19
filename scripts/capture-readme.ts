import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildApp } from '../apps/local-service/src/app.js';
import { openDatabase } from '../apps/local-service/src/db.js';
import { SecretStore } from '../apps/local-service/src/keychain.js';
import { VisionClient } from '../apps/local-service/src/vision-client.js';

// Real UI + API + vision engine, with a fresh DB and no listening socket.
// Playwright routes every request into Fastify injection, never the user's service.
const root = resolve(import.meta.dirname, '..');
const base = 'http://127.0.0.1:4179';
const playwrightPath = process.env.VIGOUR_SMOKE_PLAYWRIGHT;
const chromePath = process.env.VIGOUR_SMOKE_CHROME;
assert(playwrightPath && chromePath, 'Set VIGOUR_SMOKE_PLAYWRIGHT and VIGOUR_SMOKE_CHROME (see scripts/README.md)');
const { chromium } = await import(pathToFileURL(resolve(playwrightPath)).href);
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const changes = execFileSync('git', ['status', '--porcelain', '--', 'apps', 'packages'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(changes, '', 'Commit application changes before recording screenshot provenance');
await readFile(join(root, 'apps/workbench/dist/index.html')); // Fail before creating temporary resources.
const scratch = await mkdtemp(join(tmpdir(), 'vigour-readme-'));
const db = openDatabase(join(scratch, 'demo.sqlite'));
const vision = new VisionClient(join(root, 'apps/vision-engine/.venv', process.platform === 'win32' ? 'Scripts/vigour-ui-review-vision.exe' : 'bin/vigour-ui-review-vision'), ['--data-root', scratch]);
const token = randomBytes(32).toString('base64url');
const app = buildApp(db, { sessionToken: token, allowedOrigins: new Set([base]) }, join(scratch, 'assets'), vision, {
  staticRoot: join(root, 'apps/workbench/dist'),
  secrets: new SecretStore({
    read: async () => undefined,
    save: async () => { throw new Error('SCREENSHOT_CREDENTIAL_WRITES_DISABLED'); },
    remove: async () => { throw new Error('SCREENSHOT_CREDENTIAL_WRITES_DISABLED'); },
  }),
});
let browser;
try {
  async function post(url: string, payload: object) {
    const response = await app.inject({ method: 'POST', url, payload,
      headers: { authorization: `Bearer ${token}`, 'x-csrf-token': token, origin: base } });
    assert(response.statusCode >= 200 && response.statusCode < 300, `Demo setup failed: ${url} (${response.statusCode})`);
    return response.json();
  }
  const project = await post('/api/v1/projects', { name: `Checkout Web · ${version}`, description: '公开合成示例 · 不含客户数据' });
  const upload = async (kind: string, filename: string) => post('/api/v1/assets/images', {
    kind, filename, dataUrl: `data:image/png;base64,${(await readFile(join(root, 'examples/demo', filename))).toString('base64')}`,
  });
  const design = await upload('design', 'design.png');
  const implementation = await upload('implementation', 'implementation.png');
  const analysis = await post('/api/v1/runs/analyze', { projectId: project.id, referenceAssetId: design.id, candidateAssetId: implementation.id, useOcr: false });
  assert(analysis.issues.length > 0, 'The screenshot must show actual detected issues');
  const ticket = await post('/api/v1/session/tickets', {});
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const viewport = { width: 1600, height: 1000 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const blocked: string[] = [];
  const errors: string[] = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) { blocked.push(url.origin); return route.abort(); }
    const response = await app.inject({ method: request.method(), url: url.pathname + url.search,
      headers: request.headers(), payload: request.postDataBuffer() ?? undefined });
    const headers = Object.fromEntries(Object.entries(response.headers)
      .filter(([key]) => !['content-length', 'transfer-encoding', 'connection'].includes(key))
      .map(([key, value]) => [key, String(value)]));
    if (response.statusCode >= 400) errors.push(`${request.method()} ${url.pathname}: ${response.statusCode}`);
    await route.fulfill({ status: response.statusCode, headers, body: response.rawPayload });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/#ticket=${ticket.ticket}`);
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll<HTMLImageElement>('.canvas-stage img')];
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
  await page.getByText('开发图标注', { exact: true }).click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {})));
  });
  assert.equal(new URL(page.url()).hash, '', 'Session ticket must be cleared');
  assert((await page.locator('.topbar').innerText()).includes(version), 'UI version must match the repository');
  assert.equal(await page.locator('.issue-marker').count(), analysis.issues.length, 'UI must annotate every detected issue');
  assert.equal(await page.locator('.issue-group').count(), new Set(analysis.issues.map((issue) => issue.groupId)).size, 'UI must display every issue group');
  assert.deepEqual(blocked, [], 'Screenshot must not contact external origins');
  assert.deepEqual(errors, [], 'Screenshot must not hide UI or API errors');
  const screenshot = await page.screenshot({ type: 'jpeg', quality: 92, animations: 'disabled' });
  const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  const inputs = await Promise.all(['design.png', 'implementation.png'].map(async (name) => ({
    path: `examples/demo/${name}`, sha256: sha256(await readFile(join(root, 'examples/demo', name))),
  })));
  const provenance = {
    generatedAt: new Date().toISOString(), product: 'Vigour UI Review', version, applicationSourceCommit: sourceCommit,
    browser: browser.version(), viewport, deviceScaleFactor: 1, inputs,
    analysis: 'actual local vision engine; OCR disabled; no AI', issueCount: analysis.issues.length,
    isolation: 'temporary database and assets; in-memory Fastify transport; empty credential store; external browser requests blocked',
    screenshot: 'docs/assets/workbench-overview.jpg', sha256: sha256(screenshot),
    note: 'Real workbench rendering, not proof of Chrome extension capture, clean-machine installation or Windows 11 acceptance.',
  };
  await writeFile(join(root, 'docs/assets/workbench-overview.jpg'), screenshot);
  await writeFile(join(root, 'docs/assets/workbench-overview.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`README screenshot captured: ${viewport.width}×${viewport.height}, ${analysis.issues.length} real issues, version ${version}.`);
} finally {
  try { await browser?.close(); }
  finally {
    await app.close();
    await vision.close();
    db.close();
    await rm(scratch, { recursive: true, force: true }); // Only the mkdtemp-owned directory above.
  }
}
