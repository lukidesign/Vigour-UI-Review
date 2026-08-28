interface CaptureMessage { type: 'CAPTURE_PAGE'; mode: 'viewport' | 'full-page' }

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.windowId || !tab.url?.match(/^https?:\/\//)) throw new Error('当前页面不支持采集');
  return tab;
}

async function messageTab<T>(tabId: number, message: unknown): Promise<T> {
  try {
    return await chrome.tabs.sendMessage(tabId, message) as T;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tabId, message) as T;
  }
}

async function capturePage(mode: CaptureMessage['mode']) {
  const tab = await activeTab();
  const tabId = tab.id!;
  const prepared = await messageTab<{
    title: string; pageUrl: string;
    viewport: { width: number; height: number; deviceScaleFactor: number };
    page: { width: number; height: number };
    scroll: { x: number; y: number };
    dom: Array<Record<string, unknown>>;
  }>(tabId, { type: 'PREPARE_CAPTURE' });
  const segments: Array<{ y: number; dataUrl: string }> = [];
  try {
    const maxY = Math.max(0, prepared.page.height - prepared.viewport.height);
    const positions = mode === 'viewport' ? [prepared.scroll.y]
      : [...new Set(Array.from({ length: Math.ceil(prepared.page.height / prepared.viewport.height) }, (_, index) => Math.min(index * prepared.viewport.height, maxY)))];
    const capturedPositions = new Set<number>();
    for (const requestedY of positions) {
      const { y } = await messageTab<{ y: number }>(tabId, { type: 'SCROLL_CAPTURE', y: requestedY });
      if (capturedPositions.has(y)) continue;
      capturedPositions.add(y);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'png' });
      segments.push({ y, dataUrl });
    }
  } finally {
    await messageTab(tabId, { type: 'RESTORE_CAPTURE' }).catch(() => undefined);
  }
  const { sessionToken } = await chrome.storage.local.get('sessionToken');
  if (typeof sessionToken !== 'string') throw new Error('会话令牌未配置');
  const response = await fetch('http://127.0.0.1:4179/api/v1/captures', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}`, 'x-csrf-token': sessionToken },
    body: JSON.stringify({ ...prepared, mode, segments, capturedAt: new Date().toISOString() }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.code ?? '本地服务拒绝了采集');
  return result;
}

chrome.runtime.onMessage.addListener((message: CaptureMessage, _sender, sendResponse) => {
  if (message.type !== 'CAPTURE_PAGE') return;
  void capturePage(message.mode)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : '采集失败' }));
  return true;
});
