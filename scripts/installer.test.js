import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInstaller } from '../apps/companion-installer/installer-core.mjs';
import { seal, verify, REQUIRED } from '../apps/companion-installer/payload.mjs';

const roots = [];
const id = 'a'.repeat(32);
const offline = async () => { throw Object.assign(new Error('offline'), { cause: { code: 'ECONNREFUSED' } }); };
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'vigour-installer-test-'))); roots.push(root);
  const home = join(root, 'home'); const source = join(root, 'package'); await mkdir(home); await mkdir(source);
  for (const file of REQUIRED) { const path = join(source, file); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, file === 'VERSION' ? '0.0.1\n' : `fixture:${file}`, { mode: 0o755 }); }
  await seal(source);
  const installer = await createInstaller(home, { request: offline });
  const managed = join(home, 'Library/Application Support/Vigour UI Review Companion');
  const registry = join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.vigour_ui_review.local.json');
  const data = join(home, 'Library/Application Support/Vigour UI Review');
  return { root, home, source, installer, managed, registry, data, record: async () => JSON.parse(await readFile(join(managed, 'current.json'), 'utf8')) };
}
describe('companion installer safety', () => {
  it('installs an immutable version, updates, rolls back, repairs and uninstalls without deleting data', async () => {
    const h = await fixture(); expect(await h.installer.status()).toEqual({ installed: false });
    await h.installer.perform('install', { source: h.source, extensionId: id });
    await writeFile(join(h.data, 'user-project.json'), '{"keep":true}');
    const first = await h.record();
    expect(JSON.parse(await readFile(h.registry, 'utf8')).allowed_origins).toEqual([`chrome-extension://${id}/`]);
    await h.installer.perform('install', { source: h.source, extensionId: 'b'.repeat(32) });
    const second = await h.record(); expect(second.previous).toEqual(first.active); expect(second.active.directory).not.toBe(first.active.directory);
    await h.installer.perform('rollback'); expect((await h.record()).active).toEqual(first.active);
    await rm(h.registry); await h.installer.perform('repair'); expect(JSON.parse(await readFile(h.registry, 'utf8')).allowed_origins[0]).toContain(id);
    await h.installer.perform('uninstall'); expect(await h.installer.status()).toEqual({ installed: false });
    expect(await readFile(join(h.data, 'user-project.json'), 'utf8')).toBe('{"keep":true}');
    await expect(readFile(h.registry)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await readdir(join(h.home, '.Trash')))).toHaveLength(1);
  });
  it('rejects corrupted or incomplete packages before installing', async () => {
    const h = await fixture(); await writeFile(join(h.source, 'service/main.js'), 'changed');
    await expect(h.installer.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('PACKAGE_INTEGRITY_FAILED');
    expect(await h.installer.status()).toEqual({ installed: false });
  });
  it('rejects personal configs and external package symlinks', async () => {
    const h = await fixture(); await symlink(join(h.home, '..'), join(h.source, 'outside'));
    await expect(seal(h.source)).rejects.toThrow('UNSAFE_PACKAGE_LINK'); await rm(join(h.source, 'outside'));
    await writeFile(join(h.source, 'native/host-config.json'), '{}'); await expect(seal(h.source)).rejects.toThrow('PERSONAL_CONFIG_IN_PACKAGE');
  });
  it('accepts safe internal relative runtime symlinks', async () => {
    const h = await fixture(); await symlink('python3.12', join(h.source, 'runtime/python/bin/python3'));
    await seal(h.source); await expect(verify(h.source)).resolves.toMatchObject({ schema: 1 });
  });
  it('refuses to overwrite another Native Host registration', async () => {
    const h = await fixture(); await mkdir(join(h.registry, '..'), { recursive: true }); const foreign = '{"name":"com.vigour_ui_review.local","path":"/other/program"}';
    await writeFile(h.registry, foreign);
    await expect(h.installer.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('FOREIGN_NATIVE_REGISTRATION');
    expect(await readFile(h.registry, 'utf8')).toBe(foreign);
  });
  it('does not adopt an unowned directory or follow an install symlink', async () => {
    const h = await fixture(); await mkdir(h.managed, { recursive: true });
    await expect(h.installer.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('INSTALL_NOT_OWNED');
    await rm(h.managed, { recursive: true }); await symlink(h.source, h.managed);
    await expect(h.installer.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('UNSAFE_INSTALL_PATH');
  });
  it('validates extension IDs and preserves the active registration when a package is damaged', async () => {
    const h = await fixture(); await expect(h.installer.perform('install', { source: h.source, extensionId: '*'})).rejects.toThrow('INVALID_EXTENSION_ID');
    await h.installer.perform('install', { source: h.source, extensionId: id }); const before = await readFile(h.registry, 'utf8');
    const record = await h.record(); await writeFile(join(h.managed, 'versions', record.active.directory, 'service/main.js'), 'damaged');
    await expect(h.installer.perform('repair')).rejects.toThrow('PACKAGE_INTEGRITY_FAILED'); expect(await readFile(h.registry, 'utf8')).toBe(before);
  });
  it('never sends shutdown to an unrelated service', async () => {
    const h = await fixture(); const requests = [];
    const installer = await createInstaller(h.home, { request: async (url) => { requests.push(url); return Response.json({ service: 'other' }); } });
    await expect(installer.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('SERVICE_NOT_OWNED');
    expect(requests).toEqual(['http://127.0.0.1:4179/health']);
  });
  it('stops only a matching installation and refuses updates during active jobs', async () => {
    const h = await fixture(); await h.installer.perform('install', { source: h.source, extensionId: id }); const before = await h.record();
    const state = { nativeMode: true, instanceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', installationRoot: join(h.managed, 'versions', before.active.directory) };
    await writeFile(join(h.data, 'native-state.json'), JSON.stringify(state)); await writeFile(join(h.data, 'session-token'), 'a'.repeat(43));
    const requests = [];
    const installer = await createInstaller(h.home, { request: async (url, options) => {
      requests.push(url); if (url.endsWith('/health')) return Response.json({ service: 'vigour-ui-review-local', instanceId: state.instanceId });
      expect(JSON.parse(options.body).instanceId).toBe(state.instanceId); return Response.json({ code: 'SERVICE_BUSY' }, { status: 409 });
    } });
    await expect(installer.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('SERVICE_BUSY');
    expect(await h.record()).toEqual(before); expect(requests).toHaveLength(2);
  });
  it('does not steal an active launcher lock', async () => {
    const h = await fixture(); await h.installer.perform('install', { source: h.source, extensionId: id });
    await writeFile(join(h.data, 'native-launch.lock'), JSON.stringify({ pid: process.pid }));
    await expect(h.installer.perform('repair')).rejects.toThrow('INSTALL_BUSY');
    expect(JSON.parse(await readFile(join(h.data, 'native-launch.lock'), 'utf8')).pid).toBe(process.pid);
  });
});
