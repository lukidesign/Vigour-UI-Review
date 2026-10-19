import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, open, readFile, realpath, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { PRODUCT, verify, within } from './payload.mjs';

const HOST = 'com.vigour_ui_review.local';
const REGISTRY_KEY = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST}`;
const BASE = 'http://127.0.0.1:4179';
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
async function optional(path) { try { return await readFile(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } }
async function atomic(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, value, { mode: 0o600, flag: 'wx' }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}

export class WindowsNativeRegistry {
  constructor(executable = resolve(process.env.SystemRoot || 'C:\\Windows', 'System32/reg.exe')) { this.executable = executable; }
  async command(args) {
    return await new Promise((done, reject) => {
      const child = spawn(this.executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      let output = ''; let overflow = false;
      child.stdout.on('data', (part) => { output += String(part); if (output.length > 8192) { overflow = true; child.kill(); } });
      child.once('error', reject);
      child.once('exit', (code) => overflow ? reject(new Error('FOREIGN_NATIVE_REGISTRATION')) : done({ code, output }));
    });
  }
  async read() {
    const value = await this.command(['query', REGISTRY_KEY, '/ve']);
    if (value.code === 0) {
      const match = value.output.match(/\bREG_SZ\s+([^\r\n]+)/i);
      if (!match) throw new Error('FOREIGN_NATIVE_REGISTRATION');
      return match[1].trim();
    }
    const key = await this.command(['query', REGISTRY_KEY]);
    if (key.code === 0) throw new Error('FOREIGN_NATIVE_REGISTRATION');
    return undefined;
  }
  async write(path) {
    const result = await this.command(['add', REGISTRY_KEY, '/ve', '/t', 'REG_SZ', '/d', path, '/f']);
    if (result.code !== 0) throw new Error('REGISTRATION_FAILED');
  }
  async remove() {
    const result = await this.command(['delete', REGISTRY_KEY, '/f']);
    if (result.code !== 0) throw new Error('REGISTRATION_FAILED');
  }
}

export async function createWindowsInstaller(localAppData, { registry = new WindowsNativeRegistry(), request = fetch } = {}) {
  if (!isAbsolute(localAppData)) throw new Error('UNSAFE_INSTALL_PATH');
  localAppData = await realpath(localAppData);
  const root = join(localAppData, 'Vigour UI Review Companion');
  const data = join(localAppData, 'Vigour UI Review');
  const marker = join(root, 'ownership.json');
  const current = join(root, 'current.json');
  const pending = join(root, 'pending.json');
  async function safePath(path) {
    if (!within(localAppData, path)) throw new Error('UNSAFE_INSTALL_PATH');
    for (let cursor = path; cursor !== localAppData; cursor = dirname(cursor)) {
      try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error('UNSAFE_INSTALL_PATH'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  async function directory(path) { await safePath(path); await mkdir(path, { recursive: true, mode: 0o700 }); await safePath(path); }
  function slot(active) {
    if (!active || !/^\d+\.\d+\.\d+-[a-f0-9-]{36}$/.test(active.directory) || !/^[a-p]{32}$/.test(active.extensionId)) throw new Error('INVALID_INSTALL_RECORD');
    return join(root, 'versions', active.directory);
  }
  function manifestPath(active) { return join(slot(active), 'native/native-messaging.json'); }
  async function readRecord(path = current) {
    await safePath(path); const text = await optional(path);
    if (!text) return undefined;
    const value = JSON.parse(text);
    if (value.product !== PRODUCT || value.schema !== 1) throw new Error('INVALID_INSTALL_RECORD');
    slot(value.active); if (value.previous) slot(value.previous);
    return value;
  }
  async function owned() {
    await safePath(root); await safePath(marker);
    const text = await optional(marker);
    if (!text || JSON.parse(text).product !== PRODUCT) throw new Error('INSTALL_NOT_OWNED');
  }
  async function initialize() {
    await safePath(root);
    try { await lstat(root); await owned(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await directory(root); await atomic(marker, json({ product: PRODUCT, schema: 1 }));
    }
  }
  async function checkRegistration(record) {
    const path = await registry.read();
    if (path && (!record || path.toLowerCase() !== manifestPath(record.active).toLowerCase())) throw new Error('FOREIGN_NATIVE_REGISTRATION');
    if (path) {
      await safePath(path);
      const entry = JSON.parse(await readFile(path, 'utf8'));
      if (entry.name !== HOST || entry.path !== join(slot(record.active), 'native/vigour-ui-review-host.exe')
        || JSON.stringify(entry.allowed_origins) !== JSON.stringify([`chrome-extension://${record.active.extensionId}/`])) throw new Error('FOREIGN_NATIVE_REGISTRATION');
    }
    return path;
  }
  async function recoverPending() {
    const next = await readRecord(pending);
    if (!next) return;
    const registered = await registry.read();
    const before = await readRecord();
    const nextPath = manifestPath(next.active);
    if (registered?.toLowerCase() === nextPath.toLowerCase()) {
      await verify(slot(next.active), { installed: true, expectedPlatform: 'win32-x64' });
      await checkRegistration(next);
      await atomic(current, json(next));
    } else if (registered && (!before || registered.toLowerCase() !== manifestPath(before.active).toLowerCase())) {
      throw new Error('FOREIGN_NATIVE_REGISTRATION');
    }
    await unlink(pending);
  }
  async function stopManagedService(record) {
    let health;
    try { health = await request(`${BASE}/health`, { signal: AbortSignal.timeout(1500) }); }
    catch (error) { if (error?.cause?.code === 'ECONNREFUSED') return; throw new Error('SERVICE_NOT_OWNED'); }
    const identity = await health.json().catch(() => ({}));
    const text = await optional(join(data, 'native-state.json'));
    const state = text ? JSON.parse(text) : undefined;
    if (!record || !health.ok || identity.service !== 'vigour-ui-review-local' || !state?.nativeMode
      || identity.instanceId !== state.instanceId || state.installationRoot !== slot(record.active)) throw new Error('SERVICE_NOT_OWNED');
    const token = (await readFile(join(data, 'session-token'), 'utf8')).trim();
    const response = await request(`${BASE}/api/v1/native/shutdown`, { method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-csrf-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ instanceId: state.instanceId }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(response.status === 409 ? 'SERVICE_BUSY' : 'SERVICE_STOP_FAILED');
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try { await request(`${BASE}/health`, { signal: AbortSignal.timeout(500) }); }
      catch (error) { if (error?.cause?.code === 'ECONNREFUSED') return; }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error('SERVICE_STOP_FAILED');
  }
  async function lock(path) {
    await safePath(path);
    let handle;
    try { handle = await open(path, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') throw new Error('INSTALL_BUSY'); throw error; }
    await handle.writeFile(json({ pid: process.pid })); await handle.close();
    return async () => { try { if (JSON.parse(await readFile(path, 'utf8')).pid === process.pid) await unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; } };
  }
  async function activate(next, before) {
    const active = slot(next.active); await safePath(active);
    await verify(active, { installed: true, expectedPlatform: 'win32-x64' });
    await atomic(join(active, 'native/host-config.json'), json({ extensionId: next.active.extensionId, dataRoot: data }));
    await atomic(manifestPath(next.active), json({ name: HOST, description: 'Vigour UI Review local companion',
      path: join(active, 'native/vigour-ui-review-host.exe'), type: 'stdio',
      allowed_origins: [`chrome-extension://${next.active.extensionId}/`] }));
    const oldPath = await checkRegistration(before);
    await atomic(pending, json(next));
    try {
      await registry.write(manifestPath(next.active)); // This is the switch Chrome observes.
      await atomic(current, json(next));
      await unlink(pending);
    } catch (error) {
      if (oldPath) await registry.write(oldPath); else if ((await registry.read()) === manifestPath(next.active)) await registry.remove();
      await rm(pending, { force: true });
      throw error;
    }
  }
  async function status() {
    await safePath(root); if (!(await optional(marker))) return { installed: false };
    await owned();
    if (await optional(pending)) throw new Error('INSTALL_BUSY');
    const record = await readRecord();
    if (record) await checkRegistration(record);
    return { installed: !!record, extensionId: record?.active.extensionId, canRollback: !!record?.previous };
  }
  async function perform(action, { source, extensionId } = {}) {
    if (!['install', 'repair', 'rollback', 'uninstall'].includes(action)) throw new Error('INVALID_ACTION');
    if (action === 'install' && !/^[a-p]{32}$/.test(extensionId ?? '')) throw new Error('INVALID_EXTENSION_ID');
    const packageManifest = action === 'install' ? await verify(source, { expectedPlatform: 'win32-x64' }) : undefined;
    if (action === 'install') await initialize(); else await owned();
    await directory(data);
    const releaseInstall = await lock(join(root, 'install.lock'));
    let releaseLaunch;
    try {
      releaseLaunch = await lock(join(data, 'native-launch.lock'));
      await recoverPending();
      const before = await readRecord(); await checkRegistration(before);
      await stopManagedService(before);
      if (action === 'install') {
        await directory(join(root, 'versions'));
        const active = { directory: `${packageManifest.version}-${randomUUID()}`, extensionId };
        const target = slot(active); const staging = `${target}.staging`;
        try {
          await cp(source, staging, { recursive: true, dereference: false, errorOnExist: true, force: false });
          await verify(staging, { expectedPlatform: 'win32-x64' });
          await rename(staging, target);
          await activate({ product: PRODUCT, schema: 1, active, ...(before ? { previous: before.active } : {}) }, before);
        } finally { await rm(staging, { recursive: true, force: true }); }
      } else {
        if (!before) throw new Error('NOT_INSTALLED');
        if (action === 'repair') await activate(before, before);
        if (action === 'rollback') {
          if (!before.previous) throw new Error('NO_ROLLBACK');
          await activate({ ...before, active: before.previous, previous: before.active }, before);
        }
        if (action === 'uninstall') {
          const oldPath = await checkRegistration(before);
          if (oldPath) await registry.remove();
          const retired = join(localAppData, `Vigour UI Review Companion Removed-${randomUUID()}`);
          try { await rename(root, retired); }
          catch (error) { if (oldPath) await registry.write(oldPath); throw error; }
          // If a file is locked, leave the unregistered retired directory for
          // inspection rather than restoring a pointer to a partially deleted tree.
          await rm(retired, { recursive: true, force: false });
        }
      }
      return { ok: true, action, dataPreserved: true };
    } finally {
      if (releaseLaunch) await releaseLaunch();
      await releaseInstall();
    }
  }
  return { status, perform };
}
