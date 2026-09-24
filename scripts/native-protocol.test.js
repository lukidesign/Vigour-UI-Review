import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { encodeFrame, readFrame, validateOrigin, validateRequest, MAX_FRAME_BYTES } from '../apps/native-host/protocol.mjs';

describe('native protocol', () => {
  it('accepts fragmented length-prefixed UTF-8 control messages', async () => {
    const stream = new PassThrough(); const reading = readFrame(stream);
    const request = { protocol: 1, command: 'connect' }; const frame = encodeFrame(request);
    stream.write(frame.subarray(0, 2)); stream.write(frame.subarray(2, 7)); stream.end(frame.subarray(7));
    expect(await reading).toEqual(request);
  });
  it.each([null, [], { protocol: 2, command: 'connect' }, { protocol: 1, command: 'exec' }, { protocol: 1, command: 'connect', path: '/tmp/file' }])('rejects unauthorized commands and extra fields: %j', (input) => {
    expect(() => validateRequest(input)).toThrow('NATIVE_BAD_REQUEST');
  });
  it('authorizes only the installed extension origin', () => {
    const id = 'a'.repeat(32);
    expect(() => validateOrigin(`chrome-extension://${id}/`, id)).not.toThrow();
    for (const input of [undefined, 'null', `chrome-extension://${'b'.repeat(32)}/`, `chrome-extension://${id}.evil/`]) expect(() => validateOrigin(input, id)).toThrow('NATIVE_FORBIDDEN');
  });
  it('rejects oversized input before concatenating unbounded bytes', async () => {
    const stream = new PassThrough(); const reading = readFrame(stream);
    const check = expect(reading).rejects.toThrow('NATIVE_FRAME_TOO_LARGE');
    stream.end(Buffer.alloc(MAX_FRAME_BYTES + 5)); await check;
  });
  it('rejects zero-length and oversized header frames', async () => {
    for (const size of [0, MAX_FRAME_BYTES + 1]) {
      const stream = new PassThrough(); const reading = readFrame(stream); const check = expect(reading).rejects.toThrow('NATIVE_FRAME_TOO_LARGE');
      const header = Buffer.alloc(4); header.writeUInt32LE(size); stream.end(header); await check;
    }
  });
  it('rejects malformed UTF-8, extra bytes, partial frames and silent hosts', async () => {
    for (const bytes of [Buffer.from([1, 0, 0, 0, 255]), Buffer.concat([encodeFrame({ protocol: 1, command: 'connect' }), Buffer.from([1])])]) {
      const stream = new PassThrough(); const reading = readFrame(stream); const check = expect(reading).rejects.toThrow('NATIVE_BAD_REQUEST'); stream.end(bytes); await check;
    }
    const partial = new PassThrough(); const incomplete = expect(readFrame(partial)).rejects.toThrow('NATIVE_INCOMPLETE_FRAME'); partial.end(Buffer.from([2])); await incomplete;
    await expect(readFrame(new PassThrough(), 5)).rejects.toThrow('NATIVE_READ_TIMEOUT');
  });
});
