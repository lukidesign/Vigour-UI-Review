import { spawn } from 'node:child_process';
import { open, readFile, mkdir, lstat, unlink, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROTOCOL } from './protocol.mjs';

const BASE = 'http://127.0.0.1:4179';
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

export async function inspectService(dataRoot, extensionId, request = fetch) {
  let response;
  try { response = await request(`${BASE}/health`, { signal: AbortSignal.timeout(1500) }); }
  catch (error) {
    // A connection refusal means absent. A nonresponsive occupied port is not ours.
    if (error?.cause?.code === 'ECONNREFUSED') return undefined;
    throw new Error('NATIVE_PORT_OCCUPIED');
  }
  let health;
  try { health = await response.json(); } catch { throw new Error('NATIVE_PORT_OCCUPIED'); }
  let state;
  try { state = JSON.parse(await readFile(resolve(dataRoot, 'native-state.json'), 'utf8')); }
  catch { throw new Error('NATIVE_PORT_OCCUPIED'); }
  if (!response.ok || health.service !== 'vigour-ui-review-local' || health.protocol !== PROTOCOL
    || health.instanceId !== state.instanceId || state.protocol !== PROTOCOL) throw new Error('NATIVE_PORT_OCCUPIED');
  if (!state.nativeMode) throw new Error('NATIVE_MANUAL_SERVICE');
  const origin = `chrome-extension://${extensionId}`;
  if (!state.allowedOrigins?.includes(origin)) throw new Error('NATIVE_PAIRING_MISMATCH');
  const token = (await readFile(resolve(dataRoot, 'session-token'), 'utf8')).trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('NATIVE_SESSION_INVALID');
  const authenticated = await request(`${BASE}/api/v1/native/connect`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-csrf-token': token, origin }, signal: AbortSignal.timeout(1500),
  });
  const identity = await authenticated.json();
  if (!authenticated.ok || identity.instanceId !== state.instanceId || identity.protocol !== PROTOCOL) throw new Error('NATIVE_SESSION_INVALID');
  return { protocol: PROTOCOL, serviceVersion: health.version, instanceId: state.instanceId, sessionToken: token };
}

async function acquireLock(path, until) {
  while (Date.now() < until) {
    try {
      const handle = await open(path, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      await handle.close();
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        // Serialize stale-lock recovery: two waiters must not delete each other's new lock.
        const recoveryPath = `${path}.recovery`;
        const recovery = await open(recoveryPath, 'wx', 0o600);
        try {
          const metadata = await lstat(path);
          if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('unsafe lock');
          const lock = JSON.parse(await readFile(path, 'utf8'));
          if (Number.isSafeInteger(lock.pid) && lock.pid > 0) {
            try { process.kill(lock.pid, 0); }
            catch (probe) {
              if (probe.code === 'ESRCH' && Date.now() - metadata.mtimeMs > 1000) await unlink(path);
            }
          }
        } finally { await recovery.close(); await unlink(recoveryPath); }
      } catch { /* A live writer may not yet have written its PID; wait, fail closed. */ }
      await delay(250);
    }
  }
  throw new Error('NATIVE_START_TIMEOUT');
}

export async function ensureService(root, config) {
  const { dataRoot, extensionId } = config;
  await mkdir(dataRoot, { recursive: true, mode: 0o700 });
  if ((await lstat(dataRoot)).isSymbolicLink()) throw new Error('NATIVE_START_FAILED');
  await chmod(dataRoot, 0o700);
  const until = Date.now() + 60_000;
  const lockPath = resolve(dataRoot, 'native-launch.lock');
  await acquireLock(lockPath, until);
  try {
    const existing = await inspectService(dataRoot, extensionId);
    if (existing) return existing;
    const logPath = resolve(dataRoot, 'native-service.log');
    // Bound logs on startup; never print tokens, tickets or page data from the host.
    try {
      const metadata = await lstat(logPath);
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('NATIVE_START_FAILED');
      if (metadata.size > 2 * 1024 * 1024) await (await open(logPath, 'w', 0o600)).close();
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const log = await open(logPath, 'a', 0o600);
    await log.chmod(0o600);
    let child;
    try {
      child = spawn(process.execPath, [resolve(root, 'service/main.js')], {
        cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd],
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', PYTHONDONTWRITEBYTECODE: '1',
          VIGOUR_UI_REVIEW_DATA_DIR: dataRoot, VIGOUR_UI_REVIEW_NATIVE_MODE: '1',
          VIGOUR_UI_REVIEW_INSTALLATION_ROOT: root,
          VIGOUR_UI_REVIEW_ALLOWED_ORIGINS: `http://127.0.0.1:4173,http://127.0.0.1:4179,chrome-extension://${extensionId}`,
          VIGOUR_UI_REVIEW_VISION_COMMAND: resolve(root, 'vision-engine/run'),
          VIGOUR_UI_REVIEW_WORKBENCH_ROOT: resolve(root, 'workbench') },
      });
      await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject); });
      child.unref();
    } finally { await log.close(); }
    while (Date.now() < until) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('NATIVE_START_FAILED');
      try {
        const ready = await inspectService(dataRoot, extensionId);
        if (ready) return ready;
      } catch (error) {
        // Allow the new process to publish its private state immediately after bind.
        if (!['NATIVE_PORT_OCCUPIED', 'NATIVE_SESSION_INVALID'].includes(error.message)) throw error;
      }
      await delay(250);
    }
    // Only stop the child created by this attempt; never kill an unrelated PID.
    child.kill('SIGTERM');
    throw new Error('NATIVE_START_TIMEOUT');
  } finally {
    try {
      const lock = JSON.parse(await readFile(lockPath, 'utf8'));
      if (lock.pid === process.pid) await unlink(lockPath);
    } catch { /* A crash leaves a stale PID lock that the next attempt can recover. */ }
  }
}
