export const captureErrors = {
  INVALID_REQUEST: '采集参数无效，请重新打开扩展后重试。',
  FORBIDDEN_SENDER: '此操作只能从 Vigour UI Review 扩展弹窗发起。',
  CAPTURE_BUSY: '已有采集正在进行，请等待完成或先取消。',
  UNSUPPORTED_PAGE: '此页面不支持采集，请在普通 HTTP 或 HTTPS 网页上使用。',
  PAGE_CHANGED: '页面、标签页或窗口尺寸发生变化，已停止采集。请保持目标页面不变后重试。',
  PAGE_UNAVAILABLE: '无法访问目标页面，请刷新该页面并重新打开扩展。',
  CAPTURE_CANCELLED: '采集已取消，未发送截图。',
  CAPTURE_TIMEOUT: '采集超时，已停止。请使用当前视口或缩短页面后重试。',
  CAPTURE_LIMIT: '页面过长或截图超过 25 MB，请改用当前视口采集。',
  TOKEN_REQUIRED: '尚未连接本地程序，请点击“重新连接”。',
  UNAUTHORIZED: '本地连接已失效，请点击“重新连接”后重试。',
  ORIGIN_NOT_ALLOWED: '本地服务尚未授权此扩展 ID，请按安装说明配置后重启服务。',
  SERVICE_UNAVAILABLE: '无法连接本地服务，请确认工作台已启动后重试。',
  UPLOAD_FAILED: '采集提交未确认，请先检查工作台“最近采集”，避免重复提交。',
  RESTORE_FAILED: '未能确认页面恢复，已停止提交。请刷新目标页面后重试。',
  CAPTURE_FAILED: '采集未完成，请刷新目标页面后重试。',
} as const;

export type CaptureErrorCode = keyof typeof captureErrors;
export class CaptureError extends Error {
  constructor(readonly code: CaptureErrorCode) { super(code); }
}

export function captureFailure(error: unknown) {
  const code = error instanceof CaptureError ? error.code : 'CAPTURE_FAILED';
  return { ok: false as const, code, error: captureErrors[code] };
}
