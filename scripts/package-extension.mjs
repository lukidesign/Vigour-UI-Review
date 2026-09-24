// Extension-only draft ZIP. Does not upload, publish or alter the installed extension.
import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'apps/chrome-extension/dist');
const output = process.env.VIGOUR_EXTENSION_ZIP;
assert(output?.endsWith('.zip'), 'Set VIGOUR_EXTENSION_ZIP to a new absolute .zip path');
assert(output === resolve(output), 'Output must be an absolute path');
for (const path of [output, `${output}.sha256`, `${output}.audit.json`]) {
  try { await stat(path); throw new Error('Refusing to overwrite an existing artifact'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function command(name, args, cwd = root, capture = false) {
  return new Promise((done, reject) => {
    const child = spawn(name, args, { cwd, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = ''; if (capture) child.stdout.on('data', (chunk) => { output += chunk; });
    child.once('error', reject); child.once('exit', (code) => code === 0 ? done(output) : reject(new Error(`Command failed (${code})`)));
  });
}
await command('pnpm', ['--filter', '@vigour-ui-review/chrome-extension', 'build']);
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'));
assert.deepEqual(manifest, JSON.parse(await readFile(join(root, 'apps/chrome-extension/public/manifest.json'), 'utf8')));
assert.equal(manifest.version, JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version);
assert.equal(manifest.manifest_version, 3); assert.equal(manifest.name, 'Vigour UI Review');
assert([...manifest.description].length <= 132);
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'alarms', 'nativeMessaging', 'scripting', 'storage']);
assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1:4179/*']);
assert(!manifest.key && !manifest.update_url && !manifest.externally_connectable);
const files = [];
async function inspect(directory) {
  for (const entry of (await readdir(directory)).sort()) {
    const path = join(directory, entry); const meta = await lstat(path); const name = relative(dist, path);
    assert(!meta.isSymbolicLink(), `Symlink not allowed: ${name}`);
    if (meta.isDirectory()) { assert(['assets', 'icons', 'chunks'].includes(name), `Unexpected directory: ${name}`); await inspect(path); continue; }
    assert(meta.isFile() && /^(manifest\.json|popup\.html|(?:popup|content|service-worker)\.js|assets\/[\w-]+\.css|chunks\/[\w-]+\.js|icons\/icon-(?:16|32|48|128)\.png)$/.test(name), `Unexpected extension file: ${name}`);
    const bytes = await readFile(path);
    if (/\.(?:js|html|css|json)$/.test(name)) {
      const text = bytes.toString();
      // Ordinary help links are navigation, not remotely hosted executable code.
      assert(!/\beval\s*\(|new\s+Function\s*\(|importScripts\s*\(|<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/|import\s*\(\s*["'](?:https?:)?\/\//i.test(text), `Executable remote/dynamic code pattern: ${name}`);
      assert(!/(?:\/Users\/|\/var\/folders\/|-----BEGIN [\w ]*PRIVATE KEY-----|\bsk-proj-[A-Za-z0-9_-]{20,})/.test(text), `Private data pattern: ${name}`);
    }
    files.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
await inspect(dist);
for (const name of ['manifest.json', manifest.action.default_popup, manifest.background.service_worker, 'popup.js', 'content.js', ...Object.values(manifest.icons)]) assert(files.some((file) => file.path === name), `Missing runtime asset: ${name}`);
const stage = await mkdtemp(join(tmpdir(), 'vigour-extension-draft-'));
try {
  for (const file of files) { await mkdir(dirname(join(stage, file.path)), { recursive: true }); await cp(join(dist, file.path), join(stage, file.path)); }
  await cp(join(root, 'LICENSE'), join(stage, 'LICENSE'));
  await mkdir(dirname(output), { recursive: true });
  await command('/usr/bin/zip', ['-q', '-X', output, ...files.map((file) => file.path), 'LICENSE'], stage);
  await command('/usr/bin/unzip', ['-t', output]);
  const entries = (await command('/usr/bin/unzip', ['-Z1', output], root, true)).trim().split('\n').sort();
  assert.deepEqual(entries, [...files.map((file) => file.path), 'LICENSE'].sort(), 'ZIP must contain runtime files at root, without a parent directory');
  assert.equal(await command('/usr/bin/unzip', ['-p', output, 'manifest.json'], root, true), await readFile(join(dist, 'manifest.json'), 'utf8'));
  const digest = createHash('sha256').update(await readFile(output)).digest('hex');
  await writeFile(`${output}.sha256`, `${digest}  ${basename(output)}\n`, { flag: 'wx' });
  await writeFile(`${output}.audit.json`, `${JSON.stringify({ generatedAt: new Date().toISOString(), product: manifest.name, publisherName: 'LukiDesign', version: manifest.version, purpose: 'Create a store draft and obtain its extension ID; not ready for review or public release', sha256: digest, files, limitations: ['Static pattern checks are not a complete security audit', 'Real Chrome toolbar/Native capture and clean-machine installation remain unverified', 'Companion requires exact extension ID pairing', 'Choose and verify a higher coordinated version before subsequent store upload'] }, null, 2)}\n`, { flag: 'wx' });
  console.log(`Extension-only draft ZIP: ${output}`);
} finally { await rm(stage, { recursive: true, force: true }); }
