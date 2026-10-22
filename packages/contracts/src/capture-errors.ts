// Only these static, non-sensitive diagnostics may cross the API/UI boundary.
export const captureProcessingErrors = {
  SEGMENT_DIMENSION_MISMATCH: '截图分段尺寸不一致。请保持页面缩放和窗口大小不变，重新采集。',
  SEGMENT_COVERAGE_GAP: '截图分段未覆盖完整页面。请等待页面加载稳定后重新采集。',
  IMAGE_LIMIT_EXCEEDED: '图片超过处理上限。请缩小采集范围，或改用当前视口采集。',
  VISION_UNAVAILABLE: '本地图像引擎未就绪。请重新打开工作台后再次采集。',
  VISION_TIMEOUT: '本地图像处理超时。请缩小采集范围后重试。',
  CAPTURE_INTERRUPTED: '上次图像处理被中断。请重新采集。',
  LEGACY_CAPTURE_FAILED: '旧版采集未生成可用图片，未记录具体原因。请使用新版重新采集。',
  CAPTURE_PROCESSING_FAILED: '本地图像处理失败。请重新采集；仍失败时反馈采集编号和错误码。',
} as const;
export type CaptureProcessingError = keyof typeof captureProcessingErrors;
export function safeCaptureProcessingError(value: unknown): CaptureProcessingError {
  return typeof value === 'string' && Object.hasOwn(captureProcessingErrors, value)
    ? value as CaptureProcessingError : 'CAPTURE_PROCESSING_FAILED';
}
