import './popup.css';
import type { CaptureStatus } from './capture-controller';

interface ConnectionState { connected: boolean; connecting: boolean; text: string }
type State = CaptureStatus & { connection: ConnectionState };
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const connectionText = document.querySelector<HTMLParagraphElement>('#connection')!;
const captureButtons = [document.querySelector<HTMLButtonElement>('#viewport')!, document.querySelector<HTMLButtonElement>('#fullpage')!];
const cancelButton = document.querySelector<HTMLButtonElement>('#cancel')!;
const openButton = document.querySelector<HTMLButtonElement>('#open-workbench')!;
const retryButton = document.querySelector<HTMLButtonElement>('#retry')!;
let starting = false;
let refreshing = false;
let opening = false;
let lastError: string | undefined;
let locallyConnecting = false;

function showState(state: State) {
  const connecting = locallyConnecting || state.connection.connecting;
  captureButtons.forEach((button) => { button.disabled = starting || state.busy || connecting || !state.connection.connected; });
  openButton.disabled = opening || state.busy || connecting || !state.connection.connected;
  retryButton.disabled = state.busy || connecting || opening;
  cancelButton.hidden = !state.busy;
  cancelButton.disabled = !state.canCancel;
  connectionText.textContent = connecting ? '正在启动或连接本地程序…' : state.connection.text;
  status.textContent = state.busy || !lastError ? state.text : lastError;
}
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_STATUS' });
    if (response?.ok) showState(response as State);
    else status.textContent = response?.error ?? '请从浏览器工具栏打开扩展。';
  } catch { status.textContent = '扩展连接已中断，请关闭弹窗并重新打开。'; }
  finally { refreshing = false; }
}
async function connect() {
  if (locallyConnecting) return;
  locallyConnecting = true;
  lastError = undefined;
  await refresh();
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CONNECT_SERVICE' });
    if (!response?.ok) lastError = response?.error ?? '本地程序连接失败。';
  } catch { lastError = '无法连接扩展，请关闭弹窗后重试。'; }
  finally { locallyConnecting = false; await refresh(); }
}
document.querySelector('#extension-id')!.textContent = chrome.runtime.id;
void connect();
const polling = setInterval(() => void refresh(), 500);
addEventListener('pagehide', () => clearInterval(polling));

async function capture(mode: 'viewport' | 'full-page') {
  if (starting) return;
  starting = true;
  lastError = undefined;
  captureButtons.forEach((button) => { button.disabled = true; });
  status.textContent = '正在准备采集…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_PAGE', mode });
    if (!response?.ok) lastError = response?.error ?? '采集未完成，请重试。';
  } catch { lastError = '扩展连接已中断。页面将自动恢复，请重新打开扩展检查状态。'; }
  finally { starting = false; await refresh(); }
}
openButton.addEventListener('click', () => {
  if (opening) return;
  opening = true;
  lastError = undefined;
  void refresh();
  void chrome.runtime.sendMessage({ type: 'OPEN_WORKBENCH' }).then((response) => {
    if (!response?.ok) lastError = response?.error ?? '无法打开工作台，请重试。';
  }).catch(() => { lastError = '连接中断，请重试。'; }).finally(() => { opening = false; void refresh(); });
});
retryButton.addEventListener('click', () => void connect());
cancelButton.addEventListener('click', () => {
  cancelButton.disabled = true;
  void chrome.runtime.sendMessage({ type: 'CANCEL_CAPTURE' }).then(refresh).catch(() => {
    status.textContent = '未能确认取消，请刷新目标页面后重新打开扩展。';
  });
});
document.querySelector('#viewport')?.addEventListener('click', () => void capture('viewport'));
document.querySelector('#fullpage')?.addEventListener('click', () => void capture('full-page'));
