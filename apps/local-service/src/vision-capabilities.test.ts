import { describe, expect, it } from 'vitest';
import { probeVision } from './vision-capabilities.js';
describe('vision capability probing', () => {
  it.each([true, false])('uses capabilities, not ping, for OCR (%s)', async (available) => {
    const calls: string[] = [];
    const result = await probeVision({ request: async (method) => {
      calls.push(method); return method === 'ping' ? { status: 'ok' } : { ocr: { available } };
    } });
    expect(calls).toEqual(['ping', 'capabilities']);
    expect(result).toEqual({ localVision: true, localOcr: available });
  });
  it('preserves core functionality when OCR probing fails', async () => {
    expect(await probeVision({ request: async (method) => {
      if (method === 'capabilities') throw new Error('OCR dependency failure');
      return { status: 'ok' };
    } })).toEqual({ localVision: true, localOcr: false });
  });
  it('does not report an unavailable core engine as usable', async () => {
    await expect(probeVision({ request: async () => { throw new Error('VISION_UNAVAILABLE'); } })).rejects.toThrow('VISION_UNAVAILABLE');
  });
});
