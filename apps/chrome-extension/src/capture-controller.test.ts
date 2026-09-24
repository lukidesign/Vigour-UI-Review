import { afterEach, describe, expect, it, vi } from 'vitest';
import { bounded, createCaptureController, trustedPopup } from './capture-controller';
import { CaptureError } from './capture-errors';

function event() {
  const listeners = new Set<(...args: any[]) => void>();
  return { listeners, addListener: (fn: (...args: any[]) => void) => listeners.add(fn),
    removeListener: (fn: (...args: any[]) => void) => listeners.delete(fn),
    emit: (...args: any[]) => { for (const listener of listeners) listener(...args); } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup() {
  const state = { tabId: 11, url: 'https://example.test/design', token: 'test-token', width: 1200 };
  const data = {
    title: 'Test page', pageUrl: state.url,
    viewport: { width: 1200, height: 800, deviceScaleFactor: 1 },
    page: { width: 1200, height: 1600 }, scroll: { x: 100, y: 200 }, dom: [],
  };
  const browser = {
    runtime: { id: 'test-extension', getURL: (path: string) => `chrome-extension://test-extension/${path}` },
    storage: { session: { get: vi.fn(async () => ({ nativeConnection: { sessionToken: state.token } })) } },
    tabs: {
      query: vi.fn(async () => [{ id: state.tabId, windowId: 1, url: state.url, status: 'complete' }]),
      sendMessage: vi.fn(async (_id: number, message: { type: string; y?: number }, _options: unknown): Promise<unknown> => {
        if (message.type === 'PREPARE_CAPTURE') return { ok: true, data };
        if (message.type === 'CHECK_CAPTURE') return { ok: true, data: { pageUrl: state.url, width: state.width, height: 800, dpr: 1 } };
        if (message.type === 'SCROLL_CAPTURE') return { ok: true, data: { y: message.y } };
        return { ok: true };
      }),
      captureVisibleTab: vi.fn(async () => 'data:image/png;base64,AAAA'),
      onActivated: event(), onUpdated: event(), onRemoved: event(),
    },
    scripting: { executeScript: vi.fn(async () => [{ frameId: 0, documentId: 'document-one' }]) },
  };
  const request = vi.fn(async (url: string | URL | Request, _options?: RequestInit) => String(url).endsWith('/capabilities')
    ? Response.json({ localVision: true }) : Response.json({ id: 'capture_one', analysisReady: true, segmentCount: 1 }));
  const chromeApi = browser as unknown as typeof chrome;
  const controller = createCaptureController(chromeApi, request);
  const uploads = () => request.mock.calls.filter(([url]) => String(url).endsWith('/captures'));
  return { state, data, browser, chromeApi, request, controller, uploads };
}
afterEach(() => vi.useRealTimers());

describe('capture safety', () => {
  it('checks service before injection, binds messages to a document and restores before upload', async () => {
    const h = setup();
    expect(await h.controller.capture('viewport')).toMatchObject({ ok: true });
    expect(h.browser.scripting.executeScript.mock.invocationCallOrder[0]).toBeGreaterThan(h.request.mock.invocationCallOrder[0]!);
    expect(h.browser.tabs.sendMessage.mock.calls.every(([, , options]) => (options as { documentId: string }).documentId === 'document-one')).toBe(true);
    const restoreIndex = h.browser.tabs.sendMessage.mock.calls.findIndex(([, message]) => message.type === 'RESTORE_CAPTURE');
    expect(h.browser.tabs.sendMessage.mock.invocationCallOrder[restoreIndex]).toBeLessThan(h.request.mock.invocationCallOrder[1]!);
    expect(h.uploads()).toHaveLength(1);
    expect(h.controller.status().busy).toBe(false);
    expect(h.browser.tabs.onActivated.listeners.size).toBe(0);
  });

  it('captures full pages with bounded positions', async () => {
    const h = setup();
    expect(await h.controller.capture('full-page')).toMatchObject({ ok: true });
    const body = JSON.parse(h.uploads()[0]![1]!.body as string);
    expect(body.segments.map((segment: { y: number }) => segment.y)).toEqual([0, 800]);
  });

  it.each([undefined, null, 'bad', {}, 3])('rejects invalid mode without side effects: %s', async (mode) => {
    const h = setup();
    expect(await h.controller.capture(mode)).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(h.browser.tabs.query).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
  });

  it('accepts only the exact popup sender, not a content script or another extension', () => {
    const { chromeApi } = setup();
    const sender = { id: 'test-extension', url: chromeApi.runtime.getURL('popup.html') };
    expect(trustedPopup(chromeApi, sender)).toBe(true);
    expect(trustedPopup(chromeApi, { ...sender, tab: { id: 11 } as chrome.tabs.Tab })).toBe(false);
    expect(trustedPopup(chromeApi, { ...sender, id: 'other' })).toBe(false);
    expect(trustedPopup(chromeApi, { ...sender, url: 'https://example.test/' })).toBe(false);
  });

  it('rejects a second capture while the first is preparing', async () => {
    const h = setup();
    const pending = deferred<Response>();
    h.request.mockImplementationOnce(() => pending.promise);
    const first = h.controller.capture('viewport');
    expect(await h.controller.capture('full-page')).toMatchObject({ code: 'CAPTURE_BUSY' });
    pending.resolve(Response.json({}));
    expect(await first).toMatchObject({ ok: true });
    expect(h.uploads()).toHaveLength(1);
  });

  it('does not change the intended tab during a slow service preflight', async () => {
    const h = setup();
    h.request.mockImplementationOnce(async () => {
      h.state.tabId = 22;
      h.browser.tabs.onActivated.emit({ tabId: 22, windowId: 1 });
      return Response.json({});
    });
    expect(await h.controller.capture('viewport')).toMatchObject({ code: 'PAGE_CHANGED' });
    expect(h.browser.scripting.executeScript).not.toHaveBeenCalled();
    expect(h.uploads()).toHaveLength(0);
  });

  it('discards screenshots when a tab switches away and back during capture', async () => {
    const h = setup();
    h.browser.tabs.captureVisibleTab.mockImplementationOnce(async () => {
      h.browser.tabs.onActivated.emit({ tabId: 22, windowId: 1 });
      h.browser.tabs.onActivated.emit({ tabId: 11, windowId: 1 });
      return 'data:image/png;base64,OTHER_PAGE';
    });
    expect(await h.controller.capture('viewport')).toMatchObject({ code: 'PAGE_CHANGED' });
    expect(h.uploads()).toHaveLength(0);
    expect(h.browser.tabs.sendMessage.mock.calls.some(([, message]) => message.type === 'RESTORE_CAPTURE')).toBe(true);
  });

  it.each(['navigate', 'close', 'resize'])('rejects a changed target: %s', async (change) => {
    const h = setup();
    h.browser.tabs.captureVisibleTab.mockImplementationOnce(async () => {
      if (change === 'navigate') h.browser.tabs.onUpdated.emit(11, { status: 'loading' });
      if (change === 'close') h.browser.tabs.onRemoved.emit(11);
      if (change === 'resize') h.state.width = 900;
      return 'data:image/png;base64,AAAA';
    });
    expect(await h.controller.capture('viewport')).toMatchObject({ code: 'PAGE_CHANGED' });
    expect(h.uploads()).toHaveLength(0);
  });

  it('restores even when prepare fails after modifying the page', async () => {
    const h = setup();
    h.browser.tabs.sendMessage.mockRejectedValueOnce(new Error('/Users/private/secret'));
    const result = await h.controller.capture('viewport');
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain('/Users/');
    expect(h.browser.tabs.sendMessage.mock.calls.some(([, message]) => message.type === 'RESTORE_CAPTURE')).toBe(true);
    expect(h.uploads()).toHaveLength(0);
  });

  it('cancels a pending scroll; late replies never upload or retain the lock', async () => {
    const h = setup();
    const scroll = deferred<unknown>();
    const started = deferred<void>();
    const original = h.browser.tabs.sendMessage.getMockImplementation()!;
    h.browser.tabs.sendMessage.mockImplementation((id, message, options) => {
      if (message.type === 'SCROLL_CAPTURE') { started.resolve(); return scroll.promise; }
      return original(id, message, options);
    });
    const running = h.controller.capture('viewport');
    await started.promise;
    h.controller.cancel();
    expect(await running).toMatchObject({ code: 'CAPTURE_CANCELLED' });
    scroll.resolve({ ok: true, data: { y: 200 } });
    await Promise.resolve();
    expect(h.uploads()).toHaveLength(0);
    expect(h.controller.status().busy).toBe(false);
    expect(h.browser.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])('fails preflight without touching the page: HTTP %s', async (status) => {
    const h = setup();
    h.request.mockResolvedValueOnce(new Response(null, { status }));
    expect(await h.controller.capture('viewport')).toMatchObject({ code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'ORIGIN_NOT_ALLOWED' : 'SERVICE_UNAVAILABLE' });
    expect(h.browser.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('does not mutate the page when the service is offline or the token is missing', async () => {
    const h = setup();
    h.request.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await h.controller.capture('viewport')).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    h.state.token = '';
    expect(await h.controller.capture('viewport')).toMatchObject({ code: 'TOKEN_REQUIRED' });
    expect(h.browser.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('bounds full-page capture before taking screenshots', async () => {
    const h = setup();
    h.data.page.height = 100_000;
    expect(await h.controller.capture('full-page')).toMatchObject({ code: 'CAPTURE_LIMIT' });
    expect(h.browser.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('does not claim a timed-out upload was discarded', async () => {
    const h = setup();
    h.request.mockResolvedValueOnce(Response.json({})).mockRejectedValueOnce(new Error('timeout'));
    expect(await h.controller.capture('viewport')).toMatchObject({ code: 'UPLOAD_FAILED' });
    expect(h.controller.status().text).toContain('最近采集');
  });

  it('disables cancellation after submission; the response determines success', async () => {
    const h = setup();
    h.request.mockResolvedValueOnce(Response.json({})).mockImplementationOnce(async () => {
      expect(h.controller.status().canCancel).toBe(false);
      h.controller.cancel();
      return Response.json({ id: 'saved' });
    });
    expect(await h.controller.capture('viewport')).toMatchObject({ ok: true, id: 'saved' });
  });

  it('does not submit if restoration cannot be confirmed', async () => {
    const h = setup();
    const original = h.browser.tabs.sendMessage.getMockImplementation()!;
    h.browser.tabs.sendMessage.mockImplementation((id, message, options) => message.type === 'RESTORE_CAPTURE'
      ? Promise.reject(new Error('disconnected')) : original(id, message, options));
    expect(await h.controller.capture('viewport')).toMatchObject({ code: 'RESTORE_FAILED' });
    expect(h.uploads()).toHaveLength(0);
  });
});

describe('bounded callbacks', () => {
  it('times out without waiting for a Chrome reply', async () => {
    vi.useFakeTimers();
    const result = bounded(new Promise(() => {}), new AbortController().signal, 100);
    const assertion = expect(result).rejects.toMatchObject({ code: 'CAPTURE_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
  });
  it('aborts immediately with the original reason', async () => {
    const controller = new AbortController();
    controller.abort(new CaptureError('PAGE_CHANGED'));
    await expect(bounded(Promise.resolve('late'), controller.signal)).rejects.toMatchObject({ code: 'PAGE_CHANGED' });
  });
});
