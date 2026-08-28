import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageName = `Vigour-UI-Review-v${manifest.version}-macos-arm64`;
const packageRoot = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR) : resolve(root, 'release', packageName);
await stat(resolve(packageRoot, 'VERSION'));
const artifactRoot = resolve(root, 'release-artifacts');
await mkdir(artifactRoot, { recursive: true });
const archive = resolve(artifactRoot, `${packageName}.zip`);
try { await stat(archive); throw new Error(`Archive already exists: ${archive}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }

const code = await new Promise((resolveExit, reject) => {
  const child = spawn('/usr/bin/ditto', ['-c', '-k', '--keepParent', packageRoot, archive], { cwd: root, stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } });
  child.once('error', reject); child.once('exit', resolveExit);
});
if (code !== 0) throw new Error(`ditto failed with ${code}`);
const archiveStat = await stat(archive);
if (archiveStat.size >= 2 * 1024 * 1024 * 1024) throw new Error(`Archive exceeds GitHub's 2 GiB per-file release limit: ${archiveStat.size}`);

const hash = createHash('sha256');
for await (const chunk of createReadStream(archive)) hash.update(chunk);
const digest = hash.digest('hex');
const checksum = `${archive}.sha256`;
await writeFile(checksum, `${digest}  ${basename(archive)}\n`, { mode: 0o644, flag: 'wx' });
console.log(JSON.stringify({ archive, checksum, bytes: archiveStat.size, sha256: digest }, null, 2));
