import type { VisionClient } from './vision-client.js';

export async function probeVision(vision: Pick<VisionClient, 'request'>) {
  await vision.request('ping', {}, 30_000);
  // OCR probing must not turn a usable core-only engine into an unavailable engine.
  try {
    const capabilities = await vision.request('capabilities', {}, 30_000) as { ocr?: { available?: boolean } };
    return { localVision: true, localOcr: capabilities?.ocr?.available === true };
  } catch { return { localVision: true, localOcr: false }; }
}
