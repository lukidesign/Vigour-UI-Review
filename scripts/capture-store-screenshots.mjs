import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Called only by the isolated Native smoke test, never against a user's database.
export async function captureStoreScreenshots({ browser, base, headers }) {
  const root = resolve(import.meta.dirname, '..'); const output = join(root, 'docs/store/assets/screenshots');
  await mkdir(output, { recursive: true });
  async function post(path, body) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    assert(response.ok, `Store demo setup failed (${response.status})`); return response.json();
  }
  const project = await post('/api/v1/projects', { name: '商店演示 · 示例数据', description: '仓库自带示例，不含客户数据' });
  const image = async (kind, name) => post('/api/v1/assets/images', { kind, filename: name, dataUrl: `data:image/png;base64,${(await readFile(join(root, 'examples/demo', name))).toString('base64')}` });
  const design = await image('design', 'design.png'); const implementation = await image('implementation', 'implementation.png');
  const analysis = await post('/api/v1/runs/analyze', { projectId: project.id, referenceAssetId: design.id, candidateAssetId: implementation.id, useOcr: false });
  assert(analysis.issues.length > 0, 'Demo must show real detected issues');
  const ticket = await post('/api/v1/session/tickets', {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/#ticket=${ticket.ticket}`);
  await page.waitForFunction(() => { const images = [...document.querySelectorAll('.canvas-stage img')]; return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0); });
  assert.equal(new URL(page.url()).hash, '', 'Store screenshots must not expose a ticket');
  async function checkCanvas() {
    assert(await page.evaluate(() => {
      const stage = document.querySelector('.canvas-stage').getBoundingClientRect();
      return [...document.querySelectorAll('.canvas-stage img')].every((image) => {
        const rect = image.getBoundingClientRect(); return rect.left >= stage.left && rect.right <= stage.right;
      });
    }), 'Default canvas must show both horizontal image edges');
  }
  async function settleMode(label) {
    await page.waitForFunction((text) => [...document.querySelectorAll('.canvas-toolbar .ant-segmented-item-selected')].some((item) => item.textContent === text), label);
    await page.evaluate(async () => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
    });
  }
  const modes = [['01-annotated', '开发图标注'], ['02-side-by-side', '平铺对比'], ['03-overlay', '透明度叠加']];
  for (const [name, label] of modes) {
    await page.getByText(label, { exact: true }).click();
    await settleMode(label);
    await page.waitForFunction(() => [...document.querySelectorAll('.canvas-stage img')].every((image) => image.complete));
    await checkCanvas();
    await page.screenshot({ path: join(output, `${name}.png`), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByText('平铺对比', { exact: true }).click();
  await settleMode('平铺对比');
  await checkCanvas();
  await page.screenshot({ path: join(output, 'qa-workbench-1920x1080.png'), animations: 'disabled' });
  for (let index = 0; index < 13; index++) await page.getByRole('button', { name: '放大画布', exact: true }).click();
  assert(await page.evaluate(() => {
    const stage = document.querySelector('.canvas-stage'); const compare = document.querySelector('.side-by-side');
    return compare.getBoundingClientRect().left >= stage.getBoundingClientRect().left && stage.scrollWidth > stage.clientWidth;
  }), 'Zoomed canvas must scroll without losing the left edge');
  const responsive = [];
  for (const width of [1920, 1440, 900, 720]) {
    await page.setViewportSize({ width, height: 1080 });
    responsive.push({ width, fitsViewport: await page.evaluate(() => document.querySelector('.app-shell').getBoundingClientRect().width <= innerWidth) });
  }
  await writeFile(join(output, 'responsive-qa.json'), `${JSON.stringify(responsive, null, 2)}\n`);
  await writeFile(join(output, 'provenance.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'unreleased stage-C source build', browser: browser.version(), data: 'examples/demo/design.png + implementation.png', analysis: 'actual local engine; OCR disabled; no AI', issueCount: analysis.issues.length, dimensions: { store: [1280, 800], qaOnly: [1920, 1080] }, note: 'Actual workbench screenshots; not proof of Chrome toolbar capture or store approval.' }, null, 2)}\n`);
  await page.close(); console.log('Generated three real demo workbench screenshots and one 1920x1080 QA screenshot.');
}
