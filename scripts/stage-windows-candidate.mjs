// Explicit allowlist for the short-lived, unsigned Windows 11 tester artifact.
// Never upload the whole release/ tree: it contains redundant runtimes and
// could gain locally generated configuration files in future builds.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { verify } from '../apps/companion-installer/payload.mjs';

const root = resolve(import.meta.dirname, '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 build machine required');
const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const version = project.version;
if (version !== '0.0.2') throw new Error('This tester candidate must have the approved 0.0.2 version');
const payload = resolve(root, 'release', `Vigour-UI-Review-v${version}-windows-x64-dev`);
const manifest = await verify(payload, { expectedPlatform: 'win32-x64' });
if (manifest.version !== version) throw new Error('Payload version mismatch');
const extension = resolve(payload, 'chrome-extension');
const extensionManifest = JSON.parse(await readFile(resolve(extension, 'manifest.json'), 'utf8'));
if (extensionManifest.version !== version || extensionManifest.key || extensionManifest.update_url) throw new Error('Extension version or identity mismatch');
const setupName = `Vigour-UI-Review-${version}-windows-x64-dev-setup.exe`;
const setup = resolve(root, 'release', 'windows-setup', setupName);
if (!(await stat(setup)).isFile()) throw new Error('GUI installer missing');
const output = resolve(root, 'release', 'windows-candidate');
try { await stat(output); throw new Error(`Refusing to overwrite ${output}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, { recursive: true });
await cp(setup, resolve(output, setupName));
await cp(extension, resolve(output, 'chrome-extension'), { recursive: true, dereference: false });
await cp(resolve(root, 'docs/WINDOWS-TESTER-GUIDE.md'), resolve(output, 'START-HERE.md'));
await cp(resolve(root, 'LICENSE'), resolve(output, 'LICENSE'));
await cp(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(output, 'THIRD_PARTY_NOTICES.md'));
const hash = createHash('sha256');
for await (const chunk of createReadStream(setup)) hash.update(chunk);
const sha256 = hash.digest('hex');
await writeFile(resolve(output, 'CANDIDATE.json'), `${JSON.stringify({
  product: 'Vigour UI Review', publisher: 'LukiDesign', version, platform: 'Windows 11 x64',
  unsigned: true, release: false, chromeExtensionVersion: extensionManifest.version,
  chromeExtensionId: 'Choose the actual ID shown in chrome://extensions after loading unpacked',
  setupFile: setupName, setupSha256: sha256,
  sourceCommit: process.env.VIGOUR_SOURCE_COMMIT ?? null, buildRun: process.env.GITHUB_RUN_ID ?? null,
  limitations: ['Not signed', 'Not tested on a Windows 11 user PC', 'Offline OCR model availability not verified'],
}, null, 2)}\n`, { flag: 'wx' });
const names = (await readdir(output)).sort();
if (JSON.stringify(names) !== JSON.stringify(['CANDIDATE.json', 'LICENSE', 'START-HERE.md', 'THIRD_PARTY_NOTICES.md', 'chrome-extension', setupName].sort())) throw new Error('Unexpected candidate content');
const checksums = [];
async function inventory(directory) {
  for (const name of (await readdir(directory)).sort()) {
    const path = resolve(directory, name);
    const entry = await lstat(path);
    if (entry.isDirectory()) await inventory(path);
    else {
      if (!entry.isFile()) throw new Error('Candidate contains a non-file or link');
      const digest = createHash('sha256');
      for await (const chunk of createReadStream(path)) digest.update(chunk);
      checksums.push(`${digest.digest('hex')}  ${relative(output, path).replaceAll('\\', '/')}`);
    }
  }
}
await inventory(output);
await writeFile(resolve(output, 'SHA256SUMS.txt'), `${checksums.sort().join('\n')}\n`, { flag: 'wx' });
console.log(`Unsigned tester candidate staged: ${output}`);
