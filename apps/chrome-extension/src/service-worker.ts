import { createCaptureController, trustedPopup } from './capture-controller';
import { CaptureError, captureFailure } from './capture-errors';
import { createNativeClient, NativeError } from './native-client';

const native = createNativeClient(chrome);
const controller = createCaptureController(chrome, fetch, async () => (await native.connect()).sessionToken);
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === native.alarmName) void native.reportActivity().catch(() => undefined); });

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!trustedPopup(chrome, sender)) {
    sendResponse(captureFailure(new CaptureError('FORBIDDEN_SENDER')));
    return;
  }
  const request = message as { type?: unknown; mode?: unknown } | null;
  if (request?.type === 'CAPTURE_PAGE') {
    void controller.capture(request.mode).then(sendResponse);
    return true;
  }
  if (request?.type === 'CANCEL_CAPTURE') { sendResponse(controller.cancel()); return; }
  if (request?.type === 'CAPTURE_STATUS') { sendResponse({ ok: true, ...controller.status(), connection: native.state() }); return; }
  if (request?.type === 'CONNECT_SERVICE' || request?.type === 'OPEN_WORKBENCH') {
    const operation = request.type === 'CONNECT_SERVICE' ? native.connect() : native.openWorkbench();
    void operation.then(() => sendResponse({ ok: true, connection: native.state() }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof NativeError ? error.message : '无法连接本地工作台，请重试。', connection: native.state() }));
    return true;
  }
  sendResponse(captureFailure(new CaptureError('INVALID_REQUEST')));
});
