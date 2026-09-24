import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNativeClient } from './native-client';

function setup() {
  let stored: Record<string, unknown> = {};
  const connection = { ok: true, protocol: 1, serviceVersion: '0.0.1', instanceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', sessionToken: 'a'.repeat(43) };
  const event = () => { const listeners = new Set<(value: unknown) => void>(); return {
    addListener: (fn: (value: unknown) => void) => listeners.add(fn), removeListener: (fn: (value: unknown) => void) => listeners.delete(fn),
    emit: (value?: unknown) => { for (const fn of listeners) fn(value); },
  }; };
  const ports: { onMessage: ReturnType<typeof event>; onDisconnect: ReturnType<typeof event>; postMessage: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const browser = {
    runtime: { connectNative: vi.fn(() => { const port = { onMessage: event(), onDisconnect: event(), postMessage: vi.fn(() => queueMicrotask(() => port.onMessage.emit(connection))), disconnect: vi.fn() }; ports.push(port); return port; }), getManifest: () => ({ version: '0.0.1' }) },
    storage: { session: { get: vi.fn(async () => stored), set: vi.fn(async (value) => { stored = value; }), remove: vi.fn(async () => { stored = {}; }) }, local: { remove: vi.fn(async () => {}) } },
    alarms: { create: vi.fn(async () => {}) },
    tabs: { query: vi.fn(async () => [{ id: 4, url: 'http://127.0.0.1:4179/' }, { id: 5, url: 'http://127.0.0.1:4179/assets/test' }]), create: vi.fn(async (_options: { url: string }) => ({})) },
  };
  const request = vi.fn(async (url: string | URL | Request, _options?: RequestInit) => String(url).endsWith('/tickets') ? Response.json({ ticket: 'b'.repeat(43), url: 'https://evil.example/' }) : Response.json({ ok: true }));
  return { browser, ports, connection, request, client: createNativeClient(browser as unknown as typeof chrome, request) };
}

afterEach(() => vi.useRealTimers());
describe('native extension connection', () => {
  it('retains the native port during cold startup but releases it on timeout', async () => {
    vi.useFakeTimers(); const h = setup();
    const original = h.browser.runtime.connectNative.getMockImplementation()!;
    h.browser.runtime.connectNative.mockImplementationOnce(() => {
      const port = original(); port.postMessage.mockImplementation(() => {}); return port;
    });
    const rejected = expect(h.client.connect()).rejects.toMatchObject({ code: 'NATIVE_START_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(30_000); expect(h.ports[0]!.disconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(35_000); await rejected; expect(h.ports[0]!.disconnect).toHaveBeenCalledOnce();
  });
  it('coalesces startup and stores secrets in session storage only', async () => {
    const h = setup(); await Promise.all([h.client.connect(), h.client.connect()]);
    expect(h.browser.runtime.connectNative).toHaveBeenCalledTimes(1);
    expect(h.ports[0]!.disconnect).toHaveBeenCalledOnce();
    expect(h.browser.storage.session.set).toHaveBeenCalledOnce();
    expect(h.browser.storage.local.remove).toHaveBeenCalledWith('sessionToken');
    expect(h.client.state().connected).toBe(true);
    expect(JSON.stringify(h.client.state())).not.toContain(h.connection.sessionToken);
  });
  it('does not launch a service from an alarm, but reports only workbench tabs after user connects', async () => {
    const h = setup(); await h.client.reportActivity(); expect(h.browser.runtime.connectNative).not.toHaveBeenCalled(); expect(h.request).not.toHaveBeenCalled();
    await h.client.connect(); await h.client.reportActivity();
    expect(JSON.parse(h.request.mock.calls[0]![1]!.body as string)).toEqual({ tabIds: [4] });
  });
  it('opens only a fixed localhost URL containing a single-use ticket, never the session token', async () => {
    const h = setup(); await h.client.openWorkbench();
    const url = h.browser.tabs.create.mock.calls[0]![0].url;
    expect(url).toBe(`http://127.0.0.1:4179/#ticket=${'b'.repeat(43)}`);
    expect(url).not.toContain(h.connection.sessionToken);
    expect(h.request.mock.calls[0]![1]!.body).toBe('{}');
  });
  it('fails closed on a version mismatch and reports missing installation without raw errors', async () => {
    const h = setup(); h.connection.serviceVersion = '0.0.9';
    await expect(h.client.connect()).rejects.toMatchObject({ code: 'NATIVE_VERSION_MISMATCH' });
    expect(h.client.state().connected).toBe(false);
    h.browser.runtime.connectNative.mockImplementationOnce(() => { throw new Error('private path /tmp/secret'); });
    await expect(h.client.connect()).rejects.toMatchObject({ code: 'NATIVE_MISSING' });
    expect(h.client.state().text).not.toContain('/tmp/secret');
  });
  it('does not clear a new session when an old heartbeat fails late', async () => {
    const h = setup(); await h.client.connect();
    let reject!: (error: Error) => void;
    h.request.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const heartbeat = h.client.reportActivity();
    await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
    h.connection.instanceId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; await h.client.connect();
    reject(new Error('offline')); await heartbeat;
    expect(h.browser.storage.session.remove).not.toHaveBeenCalled(); expect(h.client.state().connected).toBe(true);
  });
});
