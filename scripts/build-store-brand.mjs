import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const { chromium } = await import(process.env.VIGOUR_SMOKE_PLAYWRIGHT ? pathToFileURL(process.env.VIGOUR_SMOKE_PLAYWRIGHT).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.VIGOUR_SMOKE_CHROME ? { executablePath: process.env.VIGOUR_SMOKE_CHROME } : {}) });
const svg = await readFile(join(root, 'docs/store/assets/brand.svg'), 'utf8');
const iconDirectory = join(root, 'apps/chrome-extension/public/icons'); await mkdir(iconDirectory, { recursive: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:100vw;height:100vh;display:block}</style>${svg}`);
    await page.screenshot({ path: join(iconDirectory, `icon-${size}.png`), omitBackground: true });
  }
  // A conceptual comparison graphic, not a fake product screenshot.
  for (const [name, width, height] of [['small-promo', 440, 280], ['marquee', 1400, 560]]) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0}body{width:${width}px;height:${height}px;background:radial-gradient(ellipse at 75% 15%,#253c72,transparent 60%),#0f1728;color:#e9f1ff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:space-around;padding:${width === 440 ? 24 : 64}px;gap:28px}.brand{flex:none}.brand svg{width:${width === 440 ? 94 : 200}px;height:auto;display:block}.title{font-size:${width === 440 ? 17 : 37}px;font-weight:650;letter-spacing:-.04em;line-height:1.2}.comparison{position:relative;display:flex;gap:10px;transform:rotate(-4deg)}.card{width:${width === 440 ? 96 : 270}px;height:${width === 440 ? 144 : 350}px;background:#1b2943;border:1px solid #405679;border-radius:12px;padding:${width === 440 ? 12 : 25}px;box-shadow:0 18px 50px #0005}.bar{height:7px;margin:10px 0;background:#506789;border-radius:3px}.bar:nth-child(2){width:64%}.block{height:${width === 440 ? 43 : 115}px;background:#91b6ff;border-radius:6px;margin:14px 0}.candidate .block{transform:translateX(5px);outline:2px solid #ffb867;outline-offset:5px}.candidate:after{content:'+';position:absolute;right:-8px;top:26%;display:grid;place-items:center;background:#ffb867;color:#17213a;border-radius:50%;width:24px;height:24px;font-size:18px}</style><div class="brand">${svg}<div class="title">Vigour<br>UI Review</div></div><div class="comparison"><div class="card"><div class="bar"></div><div class="bar"></div><div class="block"></div><div class="bar"></div><div class="bar"></div></div><div class="card candidate"><div class="bar"></div><div class="bar"></div><div class="block"></div><div class="bar"></div><div class="bar"></div></div></div>`);
    await page.screenshot({ path: join(root, `docs/store/assets/${name}.png`) });
  }
  console.log('Store brand assets generated: icon sizes 16/32/48/128; promos 440x280 and 1400x560.');
} finally { await browser.close(); }
