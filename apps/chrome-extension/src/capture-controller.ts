import { CaptureError, captureFailure } from './capture-errors';

interface Prepared {
  title: string;
  pageUrl: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  page: { width: number; height: number };
  scroll: { x: number; y: number };
  dom: Array<Record<string, unknown>>;
}
export interface CaptureStatus {
  busy: boolean;
  phase: 'idle' | 'preparing' | 'capturing' | 'uploading' | 'finished';
  text: string;
  canCancel: boolean;
}

// Bound Chrome callbacks too: late replies cannot resume a cancelled job.
export function bounded<T>(promise: Promise<T>, signal: AbortSignal, timeoutMs = 8_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => finish(() => reject(signal.reason ?? new CaptureError('CAPTURE_CANCELLED')));
    const timer = setTimeout(() => finish(() => reject(new CaptureError('CAPTURE_TIMEOUT'))), timeoutMs);
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
      settle();
    };
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    promise.then((value) => finish(() => resolve(value)), (error: unknown) => finish(() => reject(error)));
  });
}

export function trustedPopup(browser: typeof chrome, sender: chrome.runtime.MessageSender): boolean {
  return sender.id === browser.runtime.id && !sender.tab && sender.url === browser.runtime.getURL('popup.html');
}

export function createCaptureController(browser: typeof chrome, request: typeof fetch = fetch,
  getToken: () => Promise<unknown> = async () => {
    const { nativeConnection } = await browser.storage.session.get('nativeConnection');
    return nativeConnection && typeof nativeConnection === 'object' && 'sessionToken' in nativeConnection ? nativeConnection.sessionToken : undefined;
  }) {
  let job: AbortController | undefined;
  let status: CaptureStatus = { busy: false, phase: 'idle', text: '准备就绪', canCancel: false };
  const setStatus = (phase: CaptureStatus['phase'], text: string, canCancel = false) => {
    status = { busy: phase !== 'finished' && phase !== 'idle', phase, text, canCancel };
  };

  async function capture(mode: unknown) {
    if (mode !== 'viewport' && mode !== 'full-page') return captureFailure(new CaptureError('INVALID_REQUEST'));
    if (job) return captureFailure(new CaptureError('CAPTURE_BUSY'));
    const activeJob = new AbortController();
    job = activeJob;
    const signal = activeJob.signal;
    const sessionId = crypto.randomUUID();
    let target: { id: number; windowId: number; url: string; documentId: string } | undefined;
    let prepared: Prepared | undefined;
    let restoreRequired = false;
    let watching = false;
    let uploading = false;
    const deadline = setTimeout(() => activeJob.abort(new CaptureError('CAPTURE_TIMEOUT')), 180_000);
    const stopForChange = () => activeJob.abort(new CaptureError('PAGE_CHANGED'));
    const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
      if (target && info.windowId === target.windowId && info.tabId !== target.id) stopForChange();
    };
    const onUpdated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
      if (target?.id === id && (change.status === 'loading' || change.url !== undefined)) stopForChange();
    };
    const onRemoved = (id: number) => { if (target?.id === id) stopForChange(); };
    const unwatch = () => {
      if (!watching) return;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
      watching = false;
    };
    const send = async <T>(type: string, extra: Record<string, unknown> = {}, cleanup = false): Promise<T> => {
      if (!target) throw new CaptureError('PAGE_UNAVAILABLE');
      const response = await bounded(browser.tabs.sendMessage(target.id, { type, sessionId, ...extra },
        { documentId: target.documentId }), cleanup ? new AbortController().signal : signal, cleanup ? 2_000 : 8_000);
      if (!response || response.ok !== true) throw new CaptureError('PAGE_UNAVAILABLE');
      return response.data as T;
    };
    const ensureTarget = async () => {
      signal.throwIfAborted();
      const [current] = await bounded(browser.tabs.query({ active: true, windowId: target!.windowId }), signal);
      if (current?.id !== target!.id || current.url !== target!.url || current.status === 'loading') throw new CaptureError('PAGE_CHANGED');
      const identity = await send<{ pageUrl: string; width: number; height: number; dpr: number }>('CHECK_CAPTURE');
      if (identity.pageUrl !== target!.url || (prepared && (identity.width !== prepared.viewport.width
        || identity.height !== prepared.viewport.height || identity.dpr !== prepared.viewport.deviceScaleFactor))) throw new CaptureError('PAGE_CHANGED');
    };
    const restore = async () => {
      if (!restoreRequired) return;
      await send('RESTORE_CAPTURE', {}, true);
      restoreRequired = false;
    };
    try {
      setStatus('preparing', '正在检查本地服务和目标页面…', true);
      // Capture the user's intended tab BEFORE any network/preflight wait.
      const [tab] = await bounded(browser.tabs.query({ active: true, currentWindow: true }), signal);
      if (tab?.id === undefined || tab.windowId === undefined || !tab.url?.match(/^https?:\/\//)) throw new CaptureError('UNSUPPORTED_PAGE');
      target = { id: tab.id, windowId: tab.windowId, url: tab.url, documentId: '' };
      browser.tabs.onActivated.addListener(onActivated);
      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.onRemoved.addListener(onRemoved);
      watching = true;
      const sessionToken = await bounded(getToken(), signal, 65_000);
      if (typeof sessionToken !== 'string' || !sessionToken.trim()) throw new CaptureError('TOKEN_REQUIRED');
      const headers = { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}`, 'x-csrf-token': sessionToken };
      let preflight: Response;
      try {
        preflight = await request('http://127.0.0.1:4179/api/v1/capabilities', {
          headers, signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
        });
      } catch { signal.throwIfAborted(); throw new CaptureError('SERVICE_UNAVAILABLE'); }
      if (preflight.status === 401) throw new CaptureError('UNAUTHORIZED');
      if (preflight.status === 403) throw new CaptureError('ORIGIN_NOT_ALLOWED');
      if (!preflight.ok) throw new CaptureError('SERVICE_UNAVAILABLE');
      // Bind to the exact document; never reinject into a new document on error.
      signal.throwIfAborted();
      const results = await bounded(browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }), signal);
      const documentId = results.find((result) => result.frameId === 0)?.documentId;
      if (!documentId) throw new CaptureError('PAGE_UNAVAILABLE');
      target.documentId = documentId;
      restoreRequired = true; // Prepare can mutate the page before failing or timing out.
      prepared = await send<Prepared>('PREPARE_CAPTURE');
      if (prepared.pageUrl !== target.url) throw new CaptureError('PAGE_CHANGED');
      await ensureTarget();
      const { width, height, deviceScaleFactor } = prepared.viewport;
      if (![width, height, deviceScaleFactor, prepared.page.height, prepared.page.width].every((n) => Number.isFinite(n) && n > 0)) throw new CaptureError('PAGE_UNAVAILABLE');
      if (width > 7680 || height > 4320 || deviceScaleFactor > 4 || deviceScaleFactor < 0.5
        || prepared.page.height > 100_000 || prepared.page.width > 20_000) throw new CaptureError('CAPTURE_LIMIT');
      const count = mode === 'viewport' ? 1 : Math.ceil(prepared.page.height / height);
      if (count > 100) throw new CaptureError('CAPTURE_LIMIT');
      const maxY = Math.max(0, prepared.page.height - height);
      const positions = mode === 'viewport' ? [prepared.scroll.y]
        : [...new Set(Array.from({ length: count }, (_, index) => Math.min(index * height, maxY)))];
      const segments: Array<{ y: number; dataUrl: string }> = [];
      let totalBytes = 0;
      for (const y of positions) {
        await ensureTarget();
        setStatus('capturing', `正在采集 ${segments.length + 1} / ${positions.length}…请勿切换页面`, true);
        const position = await send<{ y: number }>('SCROLL_CAPTURE', { y });
        await ensureTarget();
        const dataUrl = await bounded(browser.tabs.captureVisibleTab(target.windowId, { format: 'png' }), signal);
        await ensureTarget(); // Discard if the target changed while Chrome captured the image.
        if (!Number.isFinite(position.y) || !dataUrl.startsWith('data:image/png;base64,')) throw new CaptureError('CAPTURE_FAILED');
        totalBytes += Math.ceil((dataUrl.length - 'data:image/png;base64,'.length) * 3 / 4);
        if (totalBytes > 25 * 1024 * 1024) throw new CaptureError('CAPTURE_LIMIT');
        if (!segments.some((segment) => segment.y === position.y)) segments.push({ y: position.y, dataUrl });
      }
      try { await restore(); } catch { throw new CaptureError('RESTORE_FAILED'); }
      signal.throwIfAborted();
      unwatch();
      // Abort cannot roll back a submitted request. Disable cancellation during upload.
      uploading = true;
      setStatus('uploading', '正在提交到本地工作台…', false);
      const response = await request('http://127.0.0.1:4179/api/v1/captures', {
        method: 'POST', headers, signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
        body: JSON.stringify({ ...prepared, mode, segments, capturedAt: new Date().toISOString() }),
      });
      if (response.status === 401) throw new CaptureError('UNAUTHORIZED');
      if (response.status === 403) throw new CaptureError('ORIGIN_NOT_ALLOWED');
      if (!response.ok) throw new CaptureError('UPLOAD_FAILED');
      const result = await response.json() as { id?: unknown; analysisReady?: boolean; segmentCount?: number };
      if (typeof result.id !== 'string') throw new CaptureError('UPLOAD_FAILED');
      setStatus('finished', result.analysisReady ? '采集完成，请到工作台“最近采集”中查看。' : '采集已保存，请到工作台“最近采集”查看处理状态。');
      return { ok: true as const, id: result.id };
    } catch (error) {
      const failure = captureFailure(uploading && !(error instanceof CaptureError) ? new CaptureError('UPLOAD_FAILED')
        : signal.aborted && !uploading ? signal.reason : error);
      setStatus('finished', failure.error);
      return failure;
    } finally {
      clearTimeout(deadline);
      unwatch();
      try { await restore(); } catch { /* Content-script watchdog is the last recovery path. */ }
      if (job === activeJob) job = undefined;
    }
  }

  return {
    capture,
    status: () => ({ ...status, busy: !!job }),
    cancel: () => {
      if (job && status.canCancel) job.abort(new CaptureError('CAPTURE_CANCELLED'));
      return { ok: true, ...status };
    },
  };
}
