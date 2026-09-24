import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { readFrame, encodeFrame, validateOrigin } from './protocol.mjs';
import { ensureService } from './runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const codes = new Set(['NATIVE_FORBIDDEN', 'NATIVE_BAD_REQUEST', 'NATIVE_FRAME_TOO_LARGE', 'NATIVE_INCOMPLETE_FRAME',
  'NATIVE_READ_TIMEOUT', 'NATIVE_PORT_OCCUPIED', 'NATIVE_MANUAL_SERVICE', 'NATIVE_PAIRING_MISMATCH',
  'NATIVE_SESSION_INVALID', 'NATIVE_START_TIMEOUT', 'NATIVE_START_FAILED']);
let result;
try {
  const config = JSON.parse(await readFile(resolve(import.meta.dirname, 'host-config.json'), 'utf8'));
  validateOrigin(process.argv[2], config.extensionId);
  if (typeof config.dataRoot !== 'string' || !isAbsolute(config.dataRoot)) throw new Error('NATIVE_BAD_REQUEST');
  await readFrame(process.stdin);
  result = { ok: true, ...await ensureService(root, config) };
} catch (error) {
  result = { ok: false, code: codes.has(error?.message) ? error.message : 'NATIVE_START_FAILED' };
}
process.stdout.write(encodeFrame(result), () => process.exit(0));
