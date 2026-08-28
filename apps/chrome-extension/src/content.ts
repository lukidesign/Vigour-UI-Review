const CAPTURE_STYLE_ID = '__vigour_ui_review_capture_style__';
let originalScroll = { x: 0, y: 0 };

const STYLE_PROPERTIES = [
  'display', 'position', 'z-index', 'box-sizing', 'width', 'height', 'margin', 'padding',
  'color', 'background-color', 'border', 'border-radius', 'box-shadow', 'opacity',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
] as const;

function visible(element: Element, rect: DOMRect): boolean {
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function snapshotDom() {
  const nodes: Array<Record<string, unknown>> = [];
  const ids = new Map<Element, string>();
  const elements = [...document.querySelectorAll('body *')].slice(0, 20_000);
  for (const [index, element] of elements.entries()) {
    const rect = element.getBoundingClientRect();
    if (!visible(element, rect)) continue;
    const nodeId = `node_${index}`;
    ids.set(element, nodeId);
    const style = getComputedStyle(element);
    const styles = Object.fromEntries(STYLE_PROPERTIES.map((property) => [property, style.getPropertyValue(property)]));
    const text = element.children.length === 0 ? element.textContent?.trim().slice(0, 2000) : undefined;
    nodes.push({
      nodeId,
      ...(element.parentElement && ids.has(element.parentElement) ? { parentId: ids.get(element.parentElement) } : {}),
      tag: element.tagName.toLowerCase(),
      ...(element.getAttribute('role') ? { role: element.getAttribute('role') } : {}),
      ...(text ? { text } : {}),
      rect: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height },
      styles,
    });
  }
  return nodes;
}

function prepare() {
  originalScroll = { x: scrollX, y: scrollY };
  const style = document.createElement('style');
  style.id = CAPTURE_STYLE_ID;
  style.textContent = `*,*::before,*::after{animation-play-state:paused!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}`;
  document.documentElement.append(style);
  const root = document.documentElement;
  const body = document.body;
  return {
    title: document.title,
    pageUrl: location.href,
    viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
    page: {
      width: Math.max(root.scrollWidth, body?.scrollWidth ?? 0, innerWidth),
      height: Math.max(root.scrollHeight, body?.scrollHeight ?? 0, innerHeight),
    },
    scroll: { x: originalScroll.x, y: originalScroll.y },
    dom: snapshotDom(),
  };
}

async function moveTo(y: number) {
  scrollTo(0, y);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  // Chrome throttles captureVisibleTab; this also gives lazy-loaded content time to settle.
  await new Promise((resolve) => setTimeout(resolve, 550));
  return { y: Math.round(scrollY) };
}

function restore() {
  document.getElementById(CAPTURE_STYLE_ID)?.remove();
  scrollTo(originalScroll.x, originalScroll.y);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PREPARE_CAPTURE') { sendResponse(prepare()); return; }
  if (message.type === 'SCROLL_CAPTURE') { void moveTo(message.y).then(sendResponse); return true; }
  if (message.type === 'RESTORE_CAPTURE') { restore(); sendResponse({ ok: true }); }
});
