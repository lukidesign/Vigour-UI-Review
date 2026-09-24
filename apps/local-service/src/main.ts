import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { openDatabase } from './db.js';
import { newSessionToken, persistSessionToken, parseAllowedOrigins } from './security.js';
import { LocalSession, NATIVE_PROTOCOL } from './local-session.js';
import { VisionClient } from './vision-client.js';
import { resolveDatabasePath } from './product-migration.js';

const dataDir = process.env.VIGOUR_UI_REVIEW_DATA_DIR ?? process.env.DESIGN_ACCEPTANCE_DATA_DIR ?? resolve(process.cwd(), '.data');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const db = openDatabase(resolveDatabasePath(dataDir));
const sessionToken = newSessionToken();
const session = new LocalSession(sessionToken, process.env.VIGOUR_UI_REVIEW_NATIVE_MODE === '1');
const configuredOrigins = parseAllowedOrigins(process.env.VIGOUR_UI_REVIEW_ALLOWED_ORIGINS ?? process.env.DESIGN_ACCEPTANCE_ALLOWED_ORIGINS);
const visionCommand = process.env.VIGOUR_UI_REVIEW_VISION_COMMAND ?? process.env.DESIGN_ACCEPTANCE_VISION_COMMAND ?? resolve(import.meta.dirname, '../../vision-engine/.venv/bin/vigour-ui-review-vision');
const vision = new VisionClient(visionCommand, ['--data-root', dataDir]);
let visionAvailable = false;
try {
  await vision.request('ping', {}, 30_000);
  visionAvailable = true;
} catch {
  await vision.close();
}
const staticRoot = process.env.VIGOUR_UI_REVIEW_WORKBENCH_ROOT ?? process.env.DESIGN_ACCEPTANCE_WORKBENCH_ROOT ?? resolve(import.meta.dirname, '../../workbench/dist');
const app = buildApp(db, { sessionToken, allowedOrigins: configuredOrigins }, resolve(dataDir, 'assets'), visionAvailable ? vision : undefined, { staticRoot, session, stopNative: () => close() });
const statePath = resolve(dataDir, 'native-state.json');
let closing = false;
let idleTimer: ReturnType<typeof setInterval> | undefined;

const close = async () => {
  if (closing) return;
  closing = true;
  clearInterval(idleTimer);
  await app.close();
  await vision.close();
  db.close();
  try {
    if (JSON.parse(readFileSync(statePath, 'utf8')).instanceId === session.instanceId) unlinkSync(statePath);
  } catch { /* A failed startup may never have published its own state. */ }
};
process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

try {
  await app.listen({ host: '127.0.0.1', port: 4179 });
  // Only the process that actually acquired the port may rotate disk credentials.
  persistSessionToken(resolve(dataDir, 'session-token'), sessionToken);
  const temporary = `${statePath}.${session.instanceId}.tmp`;
  writeFileSync(temporary, JSON.stringify({ protocol: NATIVE_PROTOCOL, instanceId: session.instanceId,
    pid: process.pid, nativeMode: session.nativeMode, installationRoot: process.env.VIGOUR_UI_REVIEW_INSTALLATION_ROOT,
    allowedOrigins: [...configuredOrigins] }), { mode: 0o600, flag: 'wx' });
  renameSync(temporary, statePath);
  if (session.nativeMode) {
    idleTimer = setInterval(() => { if (session.shouldExit()) void close(); }, 10_000);
    idleTimer.unref();
  }
} catch (error) {
  await close();
  throw error;
}
