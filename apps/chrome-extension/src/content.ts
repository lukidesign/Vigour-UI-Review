// Self-contained classic script: executeScript injects it repeatedly into the
// isolated world, so install exactly one listener per document.
(() => {
  const scope = globalThis as typeof globalThis & { __vigourCaptureInstalled?: boolean };
  if (scope.__vigourCaptureInstalled) return;
  scope.__vigourCaptureInstalled = true;
  type Session = {
    id: string; x: number; y: number; pageUrl: string; width: number; height: number; dpr: number;
    style: HTMLStyleElement; watchdog?: ReturnType<typeof setTimeout>;
  };
  let current: Session | undefined;
  const properties = [
    'display', 'position', 'z-index', 'box-sizing', 'width', 'height', 'margin', 'padding',
    'color', 'background-color', 'border', 'border-radius', 'box-shadow', 'opacity',
    'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
  ];

  function restore() {
    const session = current;
    if (!session) return;
    current = undefined; // Invalidate delayed scroll replies before changing the DOM.
    clearTimeout(session.watchdog);
    session.style.remove();
    scrollTo({ left: session.x, top: session.y, behavior: 'instant' });
  }
  function touch(session: Session) {
    clearTimeout(session.watchdog);
    // Recover even if the worker is terminated, the popup closes, or IPC fails.
    session.watchdog = setTimeout(restore, 20_000);
  }
  function requireSession(id: string) {
    const session = current;
    if (!session || session.id !== id || document.hidden || session.pageUrl !== location.href
      || session.width !== innerWidth || session.height !== innerHeight || session.dpr !== devicePixelRatio) {
      throw new Error('PAGE_CHANGED');
    }
    touch(session);
    return session;
  }
  function snapshotDom() {
    const nodes: Array<Record<string, unknown>> = [];
    const ids = new Map<Element, string>();
    const elements = document.querySelectorAll('body *');
    for (let index = 0; index < Math.min(elements.length, 20_000); index += 1) {
      const element = elements[index]!;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') continue;
      const nodeId = `node_${index}`;
      ids.set(element, nodeId);
      const text = element.children.length === 0 ? element.textContent?.trim().slice(0, 2000) : undefined;
      nodes.push({
        nodeId,
        ...(element.parentElement && ids.has(element.parentElement) ? { parentId: ids.get(element.parentElement) } : {}),
        tag: element.tagName.toLowerCase(),
        ...(element.getAttribute('role') ? { role: element.getAttribute('role') } : {}),
        ...(text ? { text } : {}),
        rect: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height },
        styles: Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)])),
      });
    }
    return nodes;
  }
  function prepare(id: string) {
    if (current) throw new Error('CAPTURE_BUSY');
    if (document.hidden) throw new Error('PAGE_CHANGED');
    const style = document.createElement('style');
    const session: Session = { id, x: scrollX, y: scrollY, pageUrl: location.href,
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio, style };
    current = session;
    try {
      style.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}';
      document.documentElement.append(style);
      touch(session);
      return {
        title: document.title, pageUrl: session.pageUrl,
        viewport: { width: session.width, height: session.height, deviceScaleFactor: session.dpr },
        page: {
          width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0, innerWidth),
          height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, innerHeight),
        },
        scroll: { x: session.x, y: session.y },
        dom: snapshotDom(),
      };
    } catch (error) { restore(); throw error; }
  }
  async function moveTo(id: string, y: number) {
    const session = requireSession(id);
    scrollTo({ left: session.x, top: y, behavior: 'instant' });
    // No requestAnimationFrame: background tabs may never dispatch it. Also respect
    // captureVisibleTab's rate limit even when the viewport did not move.
    await new Promise((resolve) => setTimeout(resolve, 600));
    requireSession(id);
    return { y: Math.round(scrollY) };
  }
  const fail = () => ({ ok: false, code: 'PAGE_UNAVAILABLE' });
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || sender.tab) return;
    if (!message || typeof message !== 'object') return;
    const input = message as { type?: unknown; sessionId?: unknown; y?: unknown };
    if (typeof input.sessionId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(input.sessionId)) return;
    const id = input.sessionId;
    try {
      if (input.type === 'RESTORE_CAPTURE') {
        if (current?.id === id) restore();
        sendResponse({ ok: true }); return;
      }
      if (input.type === 'PREPARE_CAPTURE') { sendResponse({ ok: true, data: prepare(id) }); return; }
      if (input.type === 'CHECK_CAPTURE') {
        const session = requireSession(id);
        sendResponse({ ok: true, data: { pageUrl: session.pageUrl, width: innerWidth, height: innerHeight, dpr: devicePixelRatio } }); return;
      }
      if (input.type === 'SCROLL_CAPTURE') {
        if (typeof input.y !== 'number' || !Number.isFinite(input.y) || input.y < 0) { sendResponse(fail()); return; }
        void moveTo(id, input.y).then((data) => sendResponse({ ok: true, data }), () => sendResponse(fail()));
        return true;
      }
    } catch { sendResponse(fail()); }
  });
  addEventListener('pagehide', restore);
  document.addEventListener('visibilitychange', () => { if (document.hidden) restore(); });
})();
