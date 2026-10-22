import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { verify } from '../apps/companion-installer/payload.mjs';

assert(process.platform === 'darwin' && process.arch === 'x64', 'Native Intel build required');
const root = resolve(import.meta.dirname, '..');
const tag = 'v0.0.2-beta.3';
const app = resolve(process.env.VIGOUR_INSTALLER_OUTPUT);
const stage = dirname(app);
assert(app === join(root, 'release/intel-stage/Vigour UI Review Setup.app'));
const payload = join(app, 'Contents/Resources/companion');
const sealed = await verify(payload, { expectedPlatform: 'darwin-x64' });
const extension = JSON.parse(await readFile(join(payload, 'chrome-extension/manifest.json'), 'utf8'));
assert.equal(sealed.version, '0.0.2');
assert.equal(extension.version, sealed.version);
assert(!extension.key && !extension.update_url);
const sourceCommit = process.env.VIGOUR_SOURCE_COMMIT;
assert.match(sourceCommit ?? '', /^[a-f0-9]{40}$/);
assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/);
await cp(join(payload, 'chrome-extension'), join(stage, 'chrome-extension'), { recursive: true, errorOnExist: true, force: false });
await cp(join(root, 'docs/INTEL-MAC-TESTER-GUIDE.md'), join(stage, 'START-HERE.md'));
await cp(join(root, 'LICENSE'), join(stage, 'LICENSE'));
const provenance = { product: 'Vigour UI Review', tag, applicationVersion: sealed.version,
  platform: 'darwin-x64', minimumMacOS: '14.0', localOcr: false, profile: 'core-only', unsigned: true,
  intelRealMachineAcceptance: 'pending', windows11Acceptance: 'pending', sourceCommit,
  buildRun: process.env.GITHUB_RUN_ID, buildPlatform: 'GitHub Actions macos-15-intel',
  sourceBuild: `https://github.com/lukidesign/Vigour-UI-Review/actions/runs/${process.env.GITHUB_RUN_ID}`,
  extensionVersion: extension.version, builtAt: new Date().toISOString(),
  limitations: ['No local OCR', 'Unsigned and not notarized', 'Intel user-machine and macOS 14 acceptance pending', 'Chrome Web Store approval not claimed'] };
await writeFile(join(stage, 'CANDIDATE.json'), JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
const output = join(root, 'release-artifacts/intel-candidate');
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // Refuse to overwrite earlier output.
const name = `Vigour-UI-Review-Setup-${tag}-macos-x64-core-unsigned.zip`;
execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', stage, join(output, name)]);
execFileSync('/usr/bin/unzip', ['-t', join(output, name)], { stdio: 'ignore' });
const digest = createHash('sha256');
for await (const chunk of createReadStream(join(output, name))) digest.update(chunk);
const sha256 = digest.digest('hex');
await writeFile(join(output, 'BUILD-PROVENANCE.json'), JSON.stringify({ ...provenance, assets: [{ name, bytes: (await stat(join(output, name))).size, sha256 }] }, null, 2) + '\n', { flag: 'wx' });
const provenanceHash = createHash('sha256').update(await readFile(join(output, 'BUILD-PROVENANCE.json'))).digest('hex');
await writeFile(join(output, 'SHA256SUMS.txt'), `${sha256}  ${name}\n${provenanceHash}  BUILD-PROVENANCE.json\n`, { flag: 'wx' });
console.log(JSON.stringify({ output, name, sha256, sourceCommit }));
