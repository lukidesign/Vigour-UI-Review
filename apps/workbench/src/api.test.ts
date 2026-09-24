import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeSessionFromLocation, sessionToken, startWorkbenchLease } from './api';

function setup(hash: string) {
  const store = new Map<string, string>([['designAcceptanceToken', 'old-token']]);
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) });
  vi.stubGlobal('location', { href: `http://127.0.0.1:4179/${hash}` });
  const history = { replaceState: vi.fn() }; vi.stubGlobal('history', history);
  return { store, history };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('workbench session handoff', () => {
  it('removes the ticket from history before exchanging and drops stale credentials', async () => {
    const h = setup(`#ticket=${'a'.repeat(43)}`);
    vi.stubGlobal('fetch', vi.fn(async () => {
      expect(h.history.replaceState).toHaveBeenCalledOnce(); expect(sessionToken()).toBe('');
      expect(String(h.history.replaceState.mock.calls[0]![2])).toBe('http://127.0.0.1:4179/');
      return Response.json({ sessionToken: 'fresh-token' });
    }));
    await initializeSessionFromLocation(); expect(sessionToken()).toBe('fresh-token');
    expect(h.store.has('designAcceptanceToken')).toBe(false);
  });
  it('does not fall back to an old token after an expired ticket', async () => {
    setup(`#ticket=${'a'.repeat(43)}`);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'TICKET_INVALID' }, { status: 401 })));
    await expect(initializeSessionFromLocation()).rejects.toMatchObject({ code: 'TICKET_INVALID' }); expect(sessionToken()).toBe('');
  });
  it('renews a workbench lease and releases it on page exit without releasing on backgrounding', async () => {
    vi.useFakeTimers(); setup('');
    const handlers = new Map<string, (event?: unknown) => void>();
    vi.stubGlobal('addEventListener', (key: string, fn: (event?: unknown) => void) => handlers.set(key, fn));
    vi.stubGlobal('removeEventListener', (key: string) => handlers.delete(key));
    const request = vi.fn(async () => Response.json({ ok: true })); vi.stubGlobal('fetch', request);
    const stop = startWorkbenchLease(); await vi.advanceTimersByTimeAsync(30_000);
    expect(request).toHaveBeenCalledTimes(2); expect(handlers.has('visibilitychange')).toBe(false);
    handlers.get('pagehide')!({ persisted: false });
    expect(JSON.parse((request.mock.calls as unknown as [string, RequestInit][]).at(-1)![1].body as string).open).toBe(false);
    stop(); expect(handlers.size).toBe(0);
  });
});
