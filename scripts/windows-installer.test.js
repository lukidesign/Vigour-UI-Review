import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWindowsInstaller } from '../apps/companion-installer/windows-core.mjs';
import { WINDOWS_REQUIRED, seal } from '../apps/companion-installer/payload.mjs';

const homes = [];
const id = 'a'.repeat(32);
const offline = async () => { throw Object.assign(new Error('offline'), { cause: { code: 'ECONNREFUSED' } }); };
afterEach(async () => { for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true }); });
async function fixture() {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'vigour-windows-install-test-'))); homes.push(home);
  const source = join(home, 'payload');
  await mkdir(source);
  for (const file of WINDOWS_REQUIRED) {
    const path = join(source, file);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, file === 'VERSION' ? '0.0.1\n' : file);
  }
  await seal(source, { platform: 'win32-x64' });
  const registry = { path: undefined, async read() { return this.path; }, async write(path) { this.path = path; }, async remove() { this.path = undefined; } };
  const installer = await createWindowsInstaller(home, { registry, request: offline });
  const program = join(home, 'Vigour UI Review Companion');
  const data = join(home, 'Vigour UI Review');
  const current = () => readFile(join(program, 'current.json'), 'utf8').then(JSON.parse);
  return { home, source, registry, installer, program, data, current };
}

describe('Windows current-user installer safety', () => {
  it('installs, repairs, rolls back and uninstalls while preserving projects', async () => {
    const h = await fixture();
    expect(await h.installer.status()).toEqual({ installed: false });
    await h.installer.perform('install', { source: h.source, extensionId: id });
    const first = await h.current();
    const entry = JSON.parse(await readFile(h.registry.path, 'utf8'));
    expect(entry.allowed_origins).toEqual([`chrome-extension://${id}/`]);
    expect(entry.path).toBe(join(h.program, 'versions', first.active.directory, 'native/vigour-ui-review-host.exe'));
    await writeFile(join(h.data, 'project.json'), '{"keep":true}');
    await h.installer.perform('install', { source: h.source, extensionId: 'b'.repeat(32) });
    expect((await h.current()).previous).toEqual(first.active);
    await h.installer.perform('rollback');
    expect((await h.current()).active).toEqual(first.active);
    h.registry.path = undefined;
    await h.installer.perform('repair');
    expect(h.registry.path).toContain(first.active.directory);
    await h.installer.perform('uninstall');
    expect(await h.installer.status()).toEqual({ installed: false });
    expect(h.registry.path).toBeUndefined();
    expect(await readFile(join(h.data, 'project.json'), 'utf8')).toBe('{"keep":true}');
  });

  it('does not adopt an unknown Native Messaging registration', async () => {
    const h = await fixture();
    h.registry.path = join(h.home, 'foreign.json');
    await expect(h.installer.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('FOREIGN_NATIVE_REGISTRATION');
    expect(h.registry.path).toBe(join(h.home, 'foreign.json'));
  });

  it('keeps the old registration on a failed update', async () => {
    const h = await fixture();
    await h.installer.perform('install', { source: h.source, extensionId: id });
    const before = await h.current(); const oldPath = h.registry.path;
    const write = h.registry.write.bind(h.registry);
    h.registry.write = async (path) => { await write(path); if (path !== oldPath) throw new Error('simulated registry failure'); };
    await expect(h.installer.perform('install', { source: h.source, extensionId: 'b'.repeat(32) })).rejects.toThrow('simulated registry failure');
    expect(h.registry.path).toBe(oldPath);
    expect(await h.current()).toEqual(before);
    expect((await readdir(h.program)).includes('pending.json')).toBe(false);
  });

  it('recovers a switch interrupted after Chrome changed to a verified version', async () => {
    const h = await fixture();
    await h.installer.perform('install', { source: h.source, extensionId: id });
    const first = await h.current(); const firstManifest = h.registry.path;
    await h.installer.perform('install', { source: h.source, extensionId: 'b'.repeat(32) });
    const second = await h.current();
    await writeFile(join(h.program, 'pending.json'), JSON.stringify({ ...second, active: first.active, previous: second.active }));
    h.registry.path = firstManifest;
    await h.installer.perform('repair');
    expect((await h.current()).active).toEqual(first.active);
    expect((await readdir(h.program)).includes('pending.json')).toBe(false);
  });

  it('rejects an unowned port before replacing any registration', async () => {
    const h = await fixture();
    const occupied = await createWindowsInstaller(h.home, { registry: h.registry, request: async () => Response.json({ service: 'other' }) });
    await expect(occupied.perform('install', { source: h.source, extensionId: id })).rejects.toThrow('SERVICE_NOT_OWNED');
    expect(h.registry.path).toBeUndefined();
  });
});
