import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildApp } from '../apps/local-service/src/app.js';
import { openDatabase } from '../apps/local-service/src/db.js';
import { CaptureStore } from '../apps/local-service/src/capture-store.js';
import { VisionClient } from '../apps/local-service/src/vision-client.js';

// Real API, engine and compiled UI. In-memory HTTP bridge, temporary data only.
// No installed Chrome extension, system registration, existing service or secrets.
const root = resolve(import.meta.dirname, '..');
const modulePath = process.env.VIGOUR_SMOKE_PLAYWRIGHT;
const chromePath = process.env.VIGOUR_SMOKE_CHROME;
assert(modulePath && chromePath, 'Set VIGOUR_SMOKE_PLAYWRIGHT and VIGOUR_SMOKE_CHROME');
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const scratch = await mkdtemp(join(tmpdir(), 'vigour-capture-smoke-'));
const screenshots = await mkdtemp(join(tmpdir(), 'vigour-capture-qa-'));
const db = openDatabase(join(scratch, 'test.sqlite'));
const token = randomBytes(32).toString('hex');
const base = 'http://127.0.0.1:4179';
const vision = new VisionClient(join(root, 'apps/vision-engine/.venv/bin/vigour-ui-review-vision'), ['--data-root', scratch]);
let failNext = false;
const app = buildApp(db, { sessionToken: token, allowedOrigins: new Set([base]) }, join(scratch, 'assets'), {
  request: async (method, params) => {
    if (failNext) { failNext = false; throw new Error('SEGMENT_DIMENSION_MISMATCH'); }
    return vision.request(method, params);
  },
}, { staticRoot: join(root, 'apps/workbench/dist') });
let browser;
try {
  async function post(url: string, payload: object) {
    const response = await app.inject({ method: 'POST', url, payload,
      headers: { authorization: `Bearer ${token}`, 'x-csrf-token': token, origin: base } });
    assert(response.statusCode >= 200 && response.statusCode < 300, `${url}: ${response.statusCode}`);
    return response.json();
  }
  const png = await readFile(join(root, 'examples/demo/implementation.png'));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const payload = { title: '正常采集合成示例', pageUrl: 'https://example.test/', mode: 'full-page' as const,
    viewport: { width: width - 1, height, deviceScaleFactor: 1 }, page: { width: width - 1, height },
    dom: [], segments: [{ y: 0, dataUrl: `data:image/png;base64,${png.toString('base64')}` }], capturedAt: new Date().toISOString() };
  const ready = await post('/api/v1/captures', payload);
  assert.equal(ready.analysisReady, true, 'Real stitch must tolerate one pixel of raster rounding');
  assert.equal(ready.processingState, 'ready');
  failNext = true;
  const failed = await post('/api/v1/captures', { ...payload, title: '失败采集合成示例' });
  assert.equal(failed.processingError, 'SEGMENT_DIMENSION_MISMATCH');
  const pending = new CaptureStore(db, join(scratch, 'assets')).create({ ...payload, title: '处理中合成示例' });
  await post('/api/v1/projects', { name: 'Core-only UI validation', description: 'Synthetic test data' });
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const results = [];
  for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript((value: string) => localStorage.setItem('vigourUiReviewTheme', value), theme);
    const errors: string[] = [];
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { errors.push(`external: ${url.origin}`); return route.abort(); }
      const response = await app.inject({ method: request.method(), url: url.pathname + url.search,
        headers: request.headers(), payload: request.postDataBuffer() ?? undefined });
      const headers = Object.fromEntries(Object.entries(response.headers)
        .filter(([key]) => !['content-length', 'transfer-encoding', 'connection'].includes(key))
        .map(([key, value]) => [key, String(value)]));
      if (response.statusCode >= 400) errors.push(`${url.pathname}: ${response.statusCode}`);
      await route.fulfill({ status: response.statusCode, headers, body: response.rawPayload });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const ticket = await post('/api/v1/session/tickets', {});
    await page.goto(`${base}/#ticket=${ticket.ticket}`);
    await page.getByRole('button', { name: '最近采集', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '选择浏览器采集' });
    await modal.getByText('SEGMENT_DIMENSION_MISMATCH', { exact: false }).waitFor();
    const failedRow = modal.locator('.ant-list-item').filter({ hasText: '失败采集合成示例' });
    assert(await failedRow.getByRole('button', { name: '处理失败' }).isDisabled());
    assert((await failedRow.innerText()).includes(failed.id));
    assert(await modal.locator('.ant-list-item').filter({ hasText: '正常采集合成示例' }).getByRole('button', { name: /^使\s*用$/ }).isEnabled());
    const pendingRow = modal.locator('.ant-list-item').filter({ hasText: '处理中合成示例' });
    assert(await pendingRow.getByRole('button', { name: '处理中', exact: true }).isDisabled());
    for (const width of [1920, 1440, 900, 720]) {
      await page.setViewportSize({ width, height: 1000 });
      await modal.screenshot({ path: join(screenshots, `${theme}-${width}.png`), animations: 'disabled' });
      const box = await modal.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width, 'Modal must remain within viewport');
      assert(await modal.locator('.ant-modal-body').evaluate((el: HTMLElement) => el.scrollWidth <= el.clientWidth + 1), 'Modal body must not overflow horizontally');
      const textBox = await failedRow.locator('.ant-list-item-meta').boundingBox();
      const buttonBox = await failedRow.getByRole('button', { name: '处理失败' }).boundingBox();
      assert(textBox && buttonBox && textBox.x + textBox.width + 8 <= buttonBox.x, 'Failure explanation must not overlap its button');
      results.push({ theme, width, modalFits: true });
    }
    // A real API refresh must replace the in-progress state with the saved error.
    new CaptureStore(db, join(scratch, 'assets')).fail(pending.id, 'VISION_TIMEOUT');
    await modal.getByRole('button', { name: '刷新状态' }).click();
    await pendingRow.getByText('VISION_TIMEOUT', { exact: false }).waitFor();
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden' });
    await page.locator('input[type="file"]').nth(0).setInputFiles(join(root, 'examples/demo/design.png'));
    await page.locator('input[type="file"]').nth(1).setInputFiles(join(root, 'examples/demo/implementation.png'));
    for (const width of [1920, 1440, 900, 720]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('.analysis-button').hover();
      const ocr = page.getByRole('menuitem', { name: '本地 OCR 不可用（当前安装包）' });
      await ocr.waitFor();
      assert.equal(await ocr.getAttribute('aria-disabled'), 'true');
      const menu = page.getByRole('menu');
      const menuBox = await menu.boundingBox();
      assert(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= width);
      await menu.screenshot({ path: join(screenshots, `core-menu-${theme}-${width}.png`) });
      await page.locator('.brand').hover();
      await ocr.waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, []);
    // Restore test state for the next theme only, never touch user data.
    db.prepare("UPDATE captures SET processing_state = 'processing', processing_error = NULL WHERE id = ?").run(pending.id);
    await context.close();
  }
  console.log(JSON.stringify({ status: 'ok', realStitch: true, safeFailure: true, refresh: true, escape: true, screenshots, results }, null, 2));
} finally {
  await browser?.close(); await app.close(); await vision.close(); db.close();
  await rm(scratch, { recursive: true, force: true });
}
