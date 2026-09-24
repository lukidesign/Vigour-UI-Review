export const NATIVE_HOST = 'com.vigour_ui_review.local';
const BASE = 'http://127.0.0.1:4179';
const ALARM = 'vigour-native-activity';
interface Connection { protocol: number; serviceVersion: string; instanceId: string; sessionToken: string }
const errors: Record<string, string> = {
  NATIVE_MISSING: '尚未连接本地配套程序。请安装匹配的内测版本，再点击“重新连接”。旧版 v0.0.1 不支持自动启动。',
  NATIVE_FORBIDDEN: '此扩展 ID 未获本地程序授权，请重新配对安装。',
  NATIVE_PORT_OCCUPIED: '4179 端口被其他服务占用，请关闭对应服务后重试。',
  NATIVE_MANUAL_SERVICE: '检测到手动启动的工作台。请先在原启动终端按 Ctrl+C，再从扩展重新连接。',
  NATIVE_PAIRING_MISMATCH: '本地服务配对的是其他扩展，请停止旧服务并使用匹配的配套程序。',
  NATIVE_START_TIMEOUT: '本地程序启动超时，请检查安装是否完整后重试。',
  NATIVE_START_FAILED: '本地程序未能启动，请检查安装、系统安全提示及本地诊断日志。',
  NATIVE_VERSION_MISMATCH: '扩展与本地程序版本不匹配，请安装同一内测版本。',
  NATIVE_SESSION_INVALID: '本地连接已失效，请点击“重新连接”。',
};
export class NativeError extends Error {
  constructor(readonly code: string) { super(errors[code] ?? errors.NATIVE_START_FAILED); }
}
function valid(value: unknown): value is Connection {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Connection>;
  return item.protocol === 1 && typeof item.instanceId === 'string' && /^[a-f0-9-]{36}$/.test(item.instanceId)
    && typeof item.sessionToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(item.sessionToken)
    && typeof item.serviceVersion === 'string';
}

export function createNativeClient(browser: typeof chrome, request: typeof fetch = fetch) {
  let pending: Promise<Connection> | undefined;
  let connected = false;
  let text = '正在连接本地程序…';
  function nativeRequest(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Keep MV3 alive during cold startup, then release the native port immediately.
      const port = browser.runtime.connectNative(NATIVE_HOST);
      const finish = (error?: NativeError, value?: unknown) => {
        clearTimeout(timer);
        port.onMessage.removeListener(received); port.onDisconnect.removeListener(disconnected);
        port.disconnect();
        if (error) reject(error); else resolve(value);
      };
      const received = (value: unknown) => finish(undefined, value);
      const disconnected = () => { void browser.runtime.lastError; finish(new NativeError('NATIVE_MISSING')); };
      const timer = setTimeout(() => finish(new NativeError('NATIVE_START_TIMEOUT')), 65_000);
      port.onMessage.addListener(received); port.onDisconnect.addListener(disconnected);
      try { port.postMessage({ protocol: 1, command: 'connect' }); }
      catch { finish(new NativeError('NATIVE_MISSING')); }
    });
  }
  async function read() {
    const { nativeConnection } = await browser.storage.session.get('nativeConnection');
    return valid(nativeConnection) ? nativeConnection : undefined;
  }
  async function connect(): Promise<Connection> {
    if (pending) return pending;
    connected = false;
    text = '正在启动或连接本地程序，首次启动可能需要约 30 秒…';
    pending = (async () => {
      try {
        let result;
        try {
          result = await nativeRequest() as { ok?: boolean; code?: unknown };
        } catch (error) {
          if (error instanceof NativeError) throw error;
          throw new NativeError('NATIVE_MISSING');
        }
        if (!result?.ok) throw new NativeError(typeof result?.code === 'string' ? result.code : 'NATIVE_START_FAILED');
        if (!valid(result)) throw new NativeError('NATIVE_SESSION_INVALID');
        if (result.serviceVersion !== browser.runtime.getManifest().version) throw new NativeError('NATIVE_VERSION_MISMATCH');
        const connection: Connection = { protocol: result.protocol, instanceId: result.instanceId,
          serviceVersion: result.serviceVersion, sessionToken: result.sessionToken };
        await browser.storage.session.set({ nativeConnection: connection });
        await browser.storage.local.remove('sessionToken'); // Remove the legacy long-lived browser copy.
        await browser.alarms.create(ALARM, { periodInMinutes: 1 });
        connected = true;
        text = '本地程序已连接，无需填写令牌。';
        return connection;
      } catch (error) {
        await browser.storage.session.remove('nativeConnection');
        const failure = error instanceof NativeError ? error : new NativeError('NATIVE_START_FAILED');
        text = failure.message;
        throw failure;
      } finally { pending = undefined; }
    })();
    return pending;
  }
  const headers = (connection: Connection) => ({ 'content-type': 'application/json',
    authorization: `Bearer ${connection.sessionToken}`, 'x-csrf-token': connection.sessionToken });
  async function reportActivity() {
    const connection = await read();
    if (!connection) return; // Never start the service from an alarm.
    const tabs = await browser.tabs.query({ url: `${BASE}/*` });
    const tabIds = tabs.filter((tab) => {
      try { return tab.id !== undefined && new URL(tab.url ?? '').pathname === '/'; } catch { return false; }
    }).map((tab) => tab.id!);
    try {
      const response = await request(`${BASE}/api/v1/native/activity`, { method: 'POST', headers: headers(connection),
        body: JSON.stringify({ tabIds }), signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error('offline');
    } catch {
      // A slow heartbeat for an old instance must not erase a fresh reconnection.
      if ((await read())?.instanceId === connection.instanceId && !pending) {
        connected = false;
        await browser.storage.session.remove('nativeConnection');
      }
    }
  }
  async function openWorkbench() {
    const connection = await connect();
    const response = await request(`${BASE}/api/v1/session/tickets`, {
      method: 'POST', headers: headers(connection), body: '{}', signal: AbortSignal.timeout(5_000),
    });
    const result = await response.json() as { ticket?: unknown };
    if (!response.ok || typeof result.ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.ticket)) throw new NativeError('NATIVE_SESSION_INVALID');
    // Never accept a URL from the native process or expose the service token in it.
    await browser.tabs.create({ url: `${BASE}/#ticket=${encodeURIComponent(result.ticket)}` });
    await reportActivity();
  }
  return { connect, openWorkbench, reportActivity, alarmName: ALARM,
    state: () => ({ connected, connecting: !!pending, text }) };
}
