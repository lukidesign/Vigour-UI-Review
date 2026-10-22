import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { verify } from '../apps/companion-installer/payload.mjs';
import { macPlatform } from '../apps/companion-installer/platform.mjs';

assert(process.platform === 'darwin' && process.arch === 'arm64', 'Native arm64 build required');
const root = resolve(import.meta.dirname, '..');
const tag = 'v0.0.2-beta.4';
const app = resolve(process.env.VIGOUR_INSTALLER_OUTPUT);
const stage = dirname(app);
assert.equal(app, join(root, 'release/arm64-stage/Vigour UI Review Setup.app'));
const payload = join(app, 'Contents/Resources/companion');
const sealed = await verify(payload, { expectedPlatform: 'darwin-arm64' });
const profile = JSON.parse(await readFile(join(payload, 'PLATFORM.json'), 'utf8'));
assert.equal(profile.localOcr, true, 'Apple Silicon must retain OCR dependencies');
assert.equal(profile.minimumMacOS, macPlatform().minimumMacOS);
const extension = JSON.parse(await readFile(join(payload, 'chrome-extension/manifest.json'), 'utf8'));
assert.equal(sealed.version, '0.0.2');
assert.equal(extension.version, sealed.version);
assert(!extension.key && !extension.update_url);
const sourceCommit = process.env.VIGOUR_SOURCE_COMMIT;
assert.match(sourceCommit ?? '', /^[a-f0-9]{40}$/);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceCommit);
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim(), '', 'Tracked source must be clean');
assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/);
await cp(join(payload, 'chrome-extension'), join(stage, 'chrome-extension'), { recursive: true, errorOnExist: true, force: false });
await cp(join(root, 'docs/APPLE-SILICON-TESTER-GUIDE.md'), join(stage, 'START-HERE.md'));
await cp(join(root, 'LICENSE'), join(stage, 'LICENSE'));
const provenance = { product: 'Vigour UI Review', tag, applicationVersion: sealed.version,
  platform: 'darwin-arm64', minimumMacOS: profile.minimumMacOS, ocrDependenciesBundled: true, offlineOcrAcceptance: 'pending', unsigned: true,
  appleSiliconRealMachineRetest: 'pending', cleanMachineAcceptance: 'pending', minimumOSAcceptance: 'pending',
  windows11Acceptance: 'pending', intelRealMachineAcceptance: 'pending', sourceCommit,
  buildRun: process.env.GITHUB_RUN_ID, buildPlatform: 'GitHub Actions macos-15 arm64',
  sourceBuild: `https://github.com/lukidesign/Vigour-UI-Review/actions/runs/${process.env.GITHUB_RUN_ID}`,
  extensionVersion: extension.version, builtAt: new Date().toISOString(),
  limitations: ['Unsigned and not notarized', 'OCR dependencies included; model availability and offline recognition not accepted',
    'Real Chrome, clean-machine, macOS 14.5 and idle/sleep retesting pending', 'Chrome Web Store approval not claimed'] };
await writeFile(join(stage, 'CANDIDATE.json'), JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
const output = join(root, 'release-artifacts/arm64-candidate');
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const name = `Vigour-UI-Review-Setup-${tag}-macos-arm64-unsigned.zip`;
execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', stage, join(output, name)]);
execFileSync('/usr/bin/unzip', ['-t', join(output, name)], { stdio: 'ignore' });
const digest = createHash('sha256');
for await (const chunk of createReadStream(join(output, name))) digest.update(chunk);
const sha256 = digest.digest('hex');
await writeFile(join(output, 'BUILD-PROVENANCE.json'), JSON.stringify({ ...provenance, assets: [{ name, bytes: (await stat(join(output, name))).size, sha256 }] }, null, 2) + '\n', { flag: 'wx' });
const provenanceHash = createHash('sha256').update(await readFile(join(output, 'BUILD-PROVENANCE.json'))).digest('hex');
await writeFile(join(output, 'SHA256SUMS.txt'), `${sha256}  ${name}\n${provenanceHash}  BUILD-PROVENANCE.json\n`, { flag: 'wx' });
console.log(JSON.stringify({ output, name, sha256, sourceCommit }));
