import './popup.css';

const tokenInput = document.querySelector<HTMLInputElement>('#token')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];

void chrome.storage.local.get('sessionToken').then(({ sessionToken }) => {
  if (typeof sessionToken === 'string') tokenInput.value = sessionToken;
});

async function capture(mode: 'viewport' | 'full-page') {
  const sessionToken = tokenInput.value.trim();
  if (!sessionToken) { status.textContent = '请先填写会话令牌'; tokenInput.focus(); return; }
  await chrome.storage.local.set({ sessionToken });
  buttons.forEach((button) => { button.disabled = true; });
  status.textContent = mode === 'viewport' ? '正在采集当前视口…' : '正在滚动采集完整页面…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_PAGE', mode });
    if (!response?.ok) throw new Error(response?.error ?? '采集失败');
    status.textContent = response.analysisReady ? `采集完成：${response.segmentCount} 张分段，可直接分析` : `采集已保存：${response.processingError ?? '等待处理'}`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : '采集失败';
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

document.querySelector('#viewport')?.addEventListener('click', () => void capture('viewport'));
document.querySelector('#fullpage')?.addEventListener('click', () => void capture('full-page'));
