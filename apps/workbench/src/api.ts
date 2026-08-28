const BASE_URL = 'http://127.0.0.1:4179';
const TOKEN_KEY = 'vigourUiReviewToken';

interface ImageDimensions { width: number; height: number }
interface ApiErrorDetail {
  code?: string;
  thresholdPercent?: number;
  differencePercent?: number;
  reference?: ImageDimensions;
  candidate?: ImageDimensions;
  target?: ImageDimensions;
}

function errorMessage(detail: ApiErrorDetail, status: number): string {
  if (detail.code === 'IMAGE_ASPECT_RATIO_MISMATCH' && detail.reference && detail.candidate) {
    const difference = detail.differencePercent?.toFixed(2) ?? '--';
    const threshold = detail.thresholdPercent ?? 1;
    return `设计图为 ${detail.reference.width}×${detail.reference.height}，开发图为 ${detail.candidate.width}×${detail.candidate.height}，宽高比相差 ${difference}%，超过 ${threshold}% 的安全范围。请按设计稿 ${detail.reference.width}×${detail.reference.height} 的画面比例重新采集。`;
  }
  if (detail.code === 'ANALYSIS_FAILED') return '分析引擎未能完成处理，请检查图片是否完整后重试。';
  return detail.code ?? `HTTP_${status}`;
}

export class ApiError extends Error {
  readonly code: string;
  constructor(readonly status: number, readonly detail: ApiErrorDetail) {
    super(errorMessage(detail, status));
    this.name = 'ApiError';
    this.code = detail.code ?? `HTTP_${status}`;
  }
}

export function sessionToken(): string {
  const current = sessionStorage.getItem(TOKEN_KEY);
  if (current) return current;
  const legacy = sessionStorage.getItem('designAcceptanceToken') ?? '';
  if (legacy) sessionStorage.setItem(TOKEN_KEY, legacy);
  return legacy;
}
export function setSessionToken(token: string) { sessionStorage.setItem(TOKEN_KEY, token); }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = sessionToken();
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('x-csrf-token', token);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as ApiErrorDetail;
    throw new ApiError(response.status, detail);
  }
  return await response.json() as T;
}

export async function download(path: string, filename: string) {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { authorization: `Bearer ${sessionToken()}` } });
  if (!response.ok) throw new Error(`EXPORT_${response.status}`);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fileDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function assetContentUrl(id: string) {
  return `${BASE_URL}/api/v1/assets/images/${id}/content`;
}

export async function assetBlobUrl(id: string): Promise<string> {
  const response = await fetch(assetContentUrl(id), { headers: { authorization: `Bearer ${sessionToken()}` } });
  if (!response.ok) throw new Error('IMAGE_LOAD_FAILED');
  return URL.createObjectURL(await response.blob());
}
