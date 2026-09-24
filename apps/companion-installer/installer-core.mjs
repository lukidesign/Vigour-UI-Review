import { cp, lstat, mkdir, open, readFile, realpath, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PRODUCT, verify, within } from './payload.mjs';

const HOST = 'com.vigour_ui_review.local';
const BASE = 'http://127.0.0.1:4179';
async function optional(path) { try { return await readFile(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } }
async function atomic(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, value, { mode: 0o600, flag: 'wx' }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function createInstaller(home, { request = fetch } = {}) {
  home = await realpath(home);
  const support = join(home, 'Library/Application Support');
  const root = join(support, 'Vigour UI Review Companion');
  const data = join(support, 'Vigour UI Review');
  const registry = join(support, `Google/Chrome/NativeMessagingHosts/${HOST}.json`);
  const marker = join(root, 'ownership.json'); const current = join(root, 'current.json');
  async function safePath(path) {
    if (!within(home, path)) throw new Error('UNSAFE_INSTALL_PATH');
    for (let cursor = path; cursor !== home; cursor = dirname(cursor)) {
      try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error('UNSAFE_INSTALL_PATH'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  async function directory(path) { await safePath(path); await mkdir(path, { recursive: true, mode: 0o700 }); await safePath(path); }
  function slot(record) {
    if (!record || !/^\d+\.\d+\.\d+-[a-f0-9-]{36}$/.test(record.directory) || !/^[a-p]{32}$/.test(record.extensionId)) throw new Error('INVALID_INSTALL_RECORD');
    return join(root, 'versions', record.directory);
  }
  async function readRecord() {
    await safePath(current); const raw = await optional(current); if (!raw) return undefined;
    const record = JSON.parse(raw); slot(record.active); if (record.previous) slot(record.previous);
    if (record.product !== PRODUCT || record.schema !== 1) throw new Error('INVALID_INSTALL_RECORD');
    return record;
  }
  async function owned() {
    await safePath(root); await safePath(marker); const text = await optional(marker);
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
  async function checkRegistry(record) {
    await safePath(registry); const raw = await optional(registry);
    if (raw) {
      const entry = JSON.parse(raw);
      if (!record || entry.name !== HOST || entry.path !== join(slot(record.active), 'native/vigour-ui-review-host')) throw new Error('FOREIGN_NATIVE_REGISTRATION');
    }
    return raw;
  }
  async function stopManagedService(record) {
    let health;
    try { health = await request(`${BASE}/health`, { signal: AbortSignal.timeout(1500) }); }
    catch (error) { if (error?.cause?.code === 'ECONNREFUSED') return; throw new Error('SERVICE_NOT_OWNED'); }
    const identity = await health.json().catch(() => ({}));
    await safePath(join(data, 'native-state.json')); await safePath(join(data, 'session-token'));
    const text = await optional(join(data, 'native-state.json')); const state = text ? JSON.parse(text) : undefined;
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
    await safePath(path); let handle;
    try { handle = await open(path, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') throw new Error('INSTALL_BUSY'); throw error; }
    await handle.writeFile(json({ pid: process.pid })); await handle.close();
    return async () => { if (JSON.parse(await readFile(path, 'utf8')).pid === process.pid) await unlink(path); };
  }
  async function activate(next, before) {
    const active = slot(next.active); await safePath(active);
    await verify(active, { installed: true });
    await safePath(join(active, 'native/host-config.json'));
    await atomic(join(active, 'native/host-config.json'), json({ extensionId: next.active.extensionId, dataRoot: data }));
    // The program tree stays immutable after installation except its private pairing config.
    const oldRegistry = await checkRegistry(before); const oldRecord = await optional(current);
    await directory(dirname(registry));
    const nativeManifest = { name: HOST, description: 'Vigour UI Review local companion', path: join(active, 'native/vigour-ui-review-host'), type: 'stdio', allowed_origins: [`chrome-extension://${next.active.extensionId}/`] };
    try {
      await atomic(current, json(next));
      await atomic(registry, json(nativeManifest)); // Last write switches Chrome to the ready program.
    } catch (error) {
      if (oldRecord) await atomic(current, oldRecord); else await rm(current, { force: true });
      if (oldRegistry) await atomic(registry, oldRegistry); else await rm(registry, { force: true });
      throw error;
    }
  }
  async function status() {
    await safePath(root); if (!(await optional(marker))) return { installed: false };
    await owned(); const record = await readRecord();
    return { installed: !!record, extensionId: record?.active.extensionId, canRollback: !!record?.previous };
  }
  async function perform(action, { source, extensionId } = {}) {
    if (!['install', 'repair', 'rollback', 'uninstall'].includes(action)) throw new Error('INVALID_ACTION');
    if (action === 'install' && !/^[a-p]{32}$/.test(extensionId ?? '')) throw new Error('INVALID_EXTENSION_ID');
    const packageManifest = action === 'install' ? await verify(source) : undefined;
    if (action === 'install') await initialize(); else await owned();
    await directory(data);
    const releaseInstall = await lock(join(root, 'install.lock'));
    let releaseLaunch;
    try {
      releaseLaunch = await lock(join(data, 'native-launch.lock'));
      const before = await readRecord(); await checkRegistry(before);
      await stopManagedService(before);
      if (action === 'install') {
        await directory(join(root, 'versions'));
        const active = { directory: `${packageManifest.version}-${randomUUID()}`, extensionId };
        const target = slot(active); const staging = `${target}.staging`;
        try {
          await cp(source, staging, { recursive: true, dereference: false, verbatimSymlinks: true, errorOnExist: true, force: false });
          await verify(staging);
          await atomic(join(staging, 'native/host-config.json'), json({ extensionId, dataRoot: data }));
          await rename(staging, target);
          await activate({ product: PRODUCT, schema: 1, active, ...(before ? { previous: before.active } : {}) }, before);
        } finally { await rm(staging, { recursive: true, force: true }); }
      } else {
        if (!before) throw new Error('NOT_INSTALLED');
        if (action === 'repair') await activate(before, before);
        if (action === 'rollback') {
          if (!before.previous) throw new Error('NO_ROLLBACK');
          await safePath(slot(before.previous));
          if (!(await lstat(join(slot(before.previous), 'native/vigour-ui-review-host'))).isFile()) throw new Error('INCOMPLETE_PACKAGE');
          await activate({ ...before, active: before.previous, previous: before.active }, before);
        }
        if (action === 'uninstall') {
          const trash = join(home, '.Trash'); await directory(trash);
          const oldRegistry = await optional(registry);
          if (oldRegistry) await unlink(registry);
          const destination = join(trash, `Vigour UI Review Companion-${randomUUID()}`);
          try { await rename(root, destination); }
          catch (error) { if (oldRegistry) await atomic(registry, oldRegistry); throw error; }
          await unlink(join(destination, 'install.lock'));
        }
      }
      return { ok: true, action, dataPreserved: true };
    } finally {
      if (releaseLaunch) await releaseLaunch();
      try { await releaseInstall(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return { status, perform };
}
