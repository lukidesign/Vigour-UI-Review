import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { open, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { macPlatform, macOSVersionAtMost } from '../apps/companion-installer/platform.mjs';

const platform = macPlatform();
const root = resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR ?? `release/Vigour-UI-Review-v0.0.2-macos-${platform.arch}`);
const profile = JSON.parse(await readFile(join(root, 'PLATFORM.json'), 'utf8'));
assert.equal(profile.platform, platform.platform);
assert.equal(profile.localOcr, platform.localOcr);
assert.equal(profile.minimumMacOS, platform.minimumMacOS);
let binaries = 0;
async function check(path) {
  const handle = await open(path, 'r');
  const magic = Buffer.alloc(4);
  try { await handle.read(magic, 0, 4, 0); } finally { await handle.close(); }
  if (!['cffaedfe', 'cefaedfe', 'feedfacf', 'feedface', 'cafebabe', 'cafebabf', 'bebafeca', 'bfbafeca'].includes(magic.toString('hex'))) return;
  const archs = execFileSync('/usr/bin/lipo', ['-archs', path], { encoding: 'utf8' }).trim().split(/\s+/);
  assert(archs.includes(platform.binaryArch), `Wrong binary architecture: ${path}: ${archs}`);
  const commands = execFileSync('/usr/bin/otool', ['-arch', platform.binaryArch, '-l', path], { encoding: 'utf8' });
  const targets = [...commands.matchAll(/(?:\bminos\s+|LC_VERSION_MIN_MACOSX\s+cmdsize\s+\d+\s+version\s+)(\d+\.\d+(?:\.\d+)?)/g)];
  assert(targets.length > 0, `Missing macOS deployment target: ${path}`);
  for (const match of targets) {
    assert(macOSVersionAtMost(match[1], platform.minimumMacOS), `Requires macOS ${match[1]}, newer than ${platform.minimumMacOS}: ${path}`);
  }
  binaries++;
}
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await walk(child);
    else if (entry.isFile()) await check(child);
  }
}
await walk(root);
assert(binaries >= 3, 'Missing bundled Mach-O binaries');
assert.equal(execFileSync(join(root, 'runtime/node'), ['-p', 'process.arch'], { encoding: 'utf8' }).trim(), platform.arch);
assert.equal(execFileSync(join(root, 'runtime/python/bin/python3.12'), ['-c', 'import platform; print(platform.machine())'], { encoding: 'utf8' }).trim(), platform.binaryArch);
if (!platform.localOcr) {
  execFileSync(join(root, 'runtime/python/bin/python3.12'), ['-c', 'import importlib.util; import cv2, numpy, PIL; assert importlib.util.find_spec("paddle") is None; assert importlib.util.find_spec("paddleocr") is None'],
    { env: { ...process.env, PYTHONPATH: join(root, 'vision-engine/site-packages'), PYTHONDONTWRITEBYTECODE: '1' } });
}
if (process.env.VIGOUR_INSTALLER_OUTPUT) await check(join(resolve(process.env.VIGOUR_INSTALLER_OUTPUT), 'Contents/MacOS/VigourSetup'));
console.log(JSON.stringify({ platform: platform.platform, binaries, minimumMacOS: platform.minimumMacOS, localOcr: platform.localOcr }));
