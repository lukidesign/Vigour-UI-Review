export const HOST_NAME = 'com.vigour_ui_review.local';
export const PROTOCOL = 1;
export const MAX_FRAME_BYTES = 16 * 1024;

export function validateRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.protocol !== PROTOCOL || value.command !== 'connect'
    || Object.keys(value).some((key) => !['protocol', 'command'].includes(key))) throw new Error('NATIVE_BAD_REQUEST');
  return value;
}
export function validateOrigin(origin, extensionId) {
  if (!/^[a-p]{32}$/.test(extensionId) || ![`chrome-extension://${extensionId}`, `chrome-extension://${extensionId}/`].includes(origin)) throw new Error('NATIVE_FORBIDDEN');
}
export function encodeFrame(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  if (body.length > MAX_FRAME_BYTES) throw new Error('NATIVE_FRAME_TOO_LARGE');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}
export function readFrame(input, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let expected;
    const finish = (error, value) => {
      clearTimeout(timer); input.off('data', data); input.off('end', ended); input.off('error', failed);
      input.pause();
      if (error) reject(error); else resolve(value);
    };
    const ended = () => finish(new Error('NATIVE_INCOMPLETE_FRAME'));
    const failed = () => finish(new Error('NATIVE_BAD_REQUEST'));
    const data = (chunk) => {
      if (buffer.length + chunk.length > MAX_FRAME_BYTES + 4) { finish(new Error('NATIVE_FRAME_TOO_LARGE')); return; }
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= 4 && expected === undefined) {
        expected = buffer.readUInt32LE(0);
        if (!expected || expected > MAX_FRAME_BYTES) { finish(new Error('NATIVE_FRAME_TOO_LARGE')); return; }
      }
      if (expected !== undefined && buffer.length >= expected + 4) {
        try {
          if (buffer.length !== expected + 4) throw new Error('NATIVE_BAD_REQUEST');
          const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(4));
          finish(undefined, validateRequest(JSON.parse(text)));
        } catch { finish(new Error('NATIVE_BAD_REQUEST')); }
      }
    };
    const timer = setTimeout(() => finish(new Error('NATIVE_READ_TIMEOUT')), timeoutMs);
    input.on('data', data); input.on('end', ended); input.on('error', failed);
  });
}
