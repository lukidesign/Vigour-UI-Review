import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
async function png(path, width, height, opaque = false) {
  const bytes = await readFile(join(root, path));
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${path}: invalid PNG`);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes.readUInt32BE(16), width, `${path}: width`);
  assert.equal(bytes.readUInt32BE(20), height, `${path}: height`);
  assert.equal(bytes[24], 8, `${path}: bit depth`);
  if (opaque) assert.equal(bytes[25], 2, `${path}: must be RGB without alpha`);
}
const manifest = JSON.parse(await readFile(join(root, 'apps/chrome-extension/public/manifest.json'), 'utf8'));
for (const size of [16, 32, 48, 128]) {
  assert.equal(manifest.icons[size], `icons/icon-${size}.png`);
  await png(`apps/chrome-extension/public/${manifest.icons[size]}`, size, size);
}
await png('docs/store/assets/small-promo.png', 440, 280, true);
await png('docs/store/assets/marquee.png', 1400, 560, true);
for (const name of ['01-annotated', '02-side-by-side', '03-overlay']) await png(`docs/store/assets/screenshots/${name}.png`, 1280, 800, true);
await png('docs/store/assets/screenshots/qa-workbench-1920x1080.png', 1920, 1080, true);
const provenance = JSON.parse(await readFile(join(root, 'docs/store/assets/screenshots/provenance.json'), 'utf8'));
assert(provenance.issueCount > 0 && provenance.analysis.includes('actual local engine'));
const listing = await readFile(join(root, 'docs/store/LISTING.md'), 'utf8');
assert(listing.includes('发布商名称（Publisher name）：LukiDesign'), 'Publisher name must match the approved attribution');
assert(listing.includes('工程版权署名：LukiDesign'), 'Store copyright attribution must match LICENSE');
for (const path of ['LICENSE', 'README.md', 'README.zh-CN.md', 'docs/PRIVACY.md', 'docs/store/PRIVACY.zh-CN.md', 'docs/store/README.md', 'docs/store/REVIEWER-NOTES.md', 'scripts/package-store-materials.mjs']) {
  const content = await readFile(join(root, path), 'utf8');
  assert(content.includes('LukiDesign'), `${path}: missing approved attribution`);
  assert(!/\bLuki\b|Vigour UI(?! Review)/.test(content), `${path}: stale publisher or copyright attribution`);
}
assert.equal(manifest.name, 'Vigour UI Review', 'The product name must not be renamed with the publisher');
for (const heading of ['中文简介', 'English short description']) {
  const description = listing.split(`## ${heading}\n\n`)[1]?.split('\n')[0];
  assert(description && [...description].length <= 132, `${heading}: short description limit`);
}
console.log('Store checks passed: LukiDesign attribution, unchanged product name, 4 icons, 2 promotional images, 3 actual product screenshots, 1920x1080 QA evidence and short descriptions. Not a store approval.');
