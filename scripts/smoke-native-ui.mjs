import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Optional real-browser workbench check; not a substitute for toolbar/Native Messaging E2E.
export async function verifyWorkbench({ base, headers }) {
  const { chromium } = await import(pathToFileURL(process.env.VIGOUR_SMOKE_PLAYWRIGHT).href);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.VIGOUR_SMOKE_CHROME });
  const evidence = await mkdtemp(join(tmpdir(), 'vigour-native-ui-'));
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = []; page.on('pageerror', (error) => errors.push(error.name));
    const issued = await fetch(`${base}/api/v1/session/tickets`, { method: 'POST', headers });
    assert.equal(issued.status, 200); const { ticket } = await issued.json();
    await page.goto(`${base}/#ticket=${ticket}`);
    await page.getByText('项目', { exact: true }).waitFor();
    await page.waitForFunction(() => !location.hash && !!sessionStorage.getItem('vigourUiReviewToken'));
    assert.equal(await page.getByRole('dialog').count(), 0, 'Valid ticket must not show a manual-token dialog');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Workbench overflows at 1920 width');
    await page.screenshot({ path: join(evidence, 'workbench-1920x1080.png'), animations: 'disabled' });
    const expired = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await expired.goto(`${base}/#ticket=${ticket}`);
    await expired.getByRole('dialog').waitFor();
    await expired.evaluate(async () => {
      await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
    });
    assert.equal(await expired.locator('input[type=password]:visible').count(), 0, 'Manual token input must be collapsed by default');
    assert.equal(new URL(expired.url()).hash, '', 'Expired ticket must be removed from URL too');
    await expired.screenshot({ path: join(evidence, 'expired-ticket-guidance.png'), animations: 'disabled' });
    assert.deepEqual(errors, [], 'Workbench must not have browser runtime errors');
    if (process.env.VIGOUR_STORE_CAPTURE === '1') {
      const { captureStoreScreenshots } = await import('./capture-store-screenshots.mjs');
      await captureStoreScreenshots({ browser, base, headers });
    }
    console.log(`Workbench UI verified at 1920x1080; screenshots: ${evidence}`);
  } finally { await browser.close(); }
}
