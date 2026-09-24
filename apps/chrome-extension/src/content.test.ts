import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const script = ts.transpileModule(readFileSync(new URL('./content.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const id = 'session-aaaaaaaa-1111';

function setup() {
  const styles = new Set<unknown>();
  const listeners: Array<(message: unknown, sender: unknown, reply: (response: any) => void) => unknown> = [];
  const documentEvents = new Map<string, () => void>();
  const windowEvents = new Map<string, () => void>();
  const document = {
    title: 'Fixture', hidden: false, body: { scrollWidth: 1200, scrollHeight: 1600 },
    documentElement: { scrollWidth: 1200, scrollHeight: 1600, append: vi.fn((style: unknown) => styles.add(style)) },
    createElement: () => { const style = { textContent: '', remove: () => styles.delete(style) }; return style; },
    querySelectorAll: vi.fn(() => []),
    addEventListener: (name: string, listener: () => void) => documentEvents.set(name, listener),
  };
  const sandbox = {
    document, location: { href: 'https://example.test/design' }, scrollX: 70, scrollY: 200,
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
    setTimeout, clearTimeout,
    scrollTo: vi.fn((options: { left: number; top: number }) => { sandbox.scrollX = options.left; sandbox.scrollY = options.top; }),
    addEventListener: (name: string, listener: () => void) => windowEvents.set(name, listener),
    chrome: { runtime: { id: 'our-extension', onMessage: { addListener: (listener: typeof listeners[number]) => listeners.push(listener) } } },
  };
  const context = createContext(sandbox);
  runInContext(script, context);
  const send = (type: string, extra = {}, sender: unknown = { id: 'our-extension' }) => {
    const reply = vi.fn();
    for (const listener of listeners) listener({ type, sessionId: id, ...extra }, sender, reply);
    return reply;
  };
  return { styles, sandbox, context, listeners, document, documentEvents, windowEvents, send };
}
afterEach(() => vi.useRealTimers());

describe('content capture recovery', () => {
  it('installs once even when injected repeatedly', () => {
    const h = setup();
    runInContext(script, h.context);
    expect(h.listeners).toHaveLength(1);
  });
  it('restores both axes and removes only its own temporary style', async () => {
    vi.useFakeTimers();
    const h = setup();
    const pageStyle = {};
    h.styles.add(pageStyle);
    expect(h.send('PREPARE_CAPTURE').mock.calls[0]![0]).toMatchObject({ ok: true });
    const moved = h.send('SCROLL_CAPTURE', { y: 800 });
    await vi.advanceTimersByTimeAsync(600);
    expect(moved.mock.calls[0]![0]).toMatchObject({ ok: true });
    expect(h.sandbox.scrollX).toBe(70);
    h.send('RESTORE_CAPTURE');
    expect(h.sandbox.scrollX).toBe(70);
    expect(h.sandbox.scrollY).toBe(200);
    expect([...h.styles]).toEqual([pageStyle]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rolls back partial preparation on snapshot failure', () => {
    vi.useFakeTimers();
    const h = setup();
    h.document.querySelectorAll.mockImplementationOnce(() => { throw new Error('DOM unavailable'); });
    expect(h.send('PREPARE_CAPTURE').mock.calls[0]![0]).toMatchObject({ ok: false });
    expect(h.styles.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('recovers when the worker never sends restore', async () => {
    vi.useFakeTimers();
    const h = setup();
    h.send('PREPARE_CAPTURE');
    h.sandbox.scrollY = 800;
    await vi.advanceTimersByTimeAsync(20_001);
    expect(h.styles.size).toBe(0);
    expect(h.sandbox.scrollY).toBe(200);
    expect(h.send('CHECK_CAPTURE').mock.calls[0]![0]).toMatchObject({ ok: false });
  });
  it('does not let a delayed scroll response resurrect a cancelled session', async () => {
    vi.useFakeTimers();
    const h = setup();
    h.send('PREPARE_CAPTURE');
    const reply = h.send('SCROLL_CAPTURE', { y: 800 });
    h.send('RESTORE_CAPTURE');
    await vi.advanceTimersByTimeAsync(600);
    expect(reply.mock.calls[0]![0]).toMatchObject({ ok: false });
    expect(h.sandbox.scrollY).toBe(200);
    expect(h.styles.size).toBe(0);
  });
  it('ignores restore requests from an old job', () => {
    vi.useFakeTimers();
    const h = setup();
    h.send('PREPARE_CAPTURE');
    h.send('RESTORE_CAPTURE', { sessionId: 'old-session-bbbbbbb' });
    expect(h.styles.size).toBe(1);
    h.send('RESTORE_CAPTURE');
  });
  it('restores immediately when the document becomes hidden or leaves', () => {
    vi.useFakeTimers();
    const h = setup();
    h.send('PREPARE_CAPTURE');
    h.document.hidden = true;
    h.documentEvents.get('visibilitychange')!();
    expect(h.styles.size).toBe(0);
    h.document.hidden = false;
    h.send('PREPARE_CAPTURE');
    h.windowEvents.get('pagehide')!();
    expect(h.styles.size).toBe(0);
  });
  it('rejects foreign senders and invalid scroll coordinates', () => {
    vi.useFakeTimers();
    const h = setup();
    expect(h.send('PREPARE_CAPTURE', {}, { id: 'another-extension' })).not.toHaveBeenCalled();
    expect(h.styles.size).toBe(0);
    h.send('PREPARE_CAPTURE');
    expect(h.send('SCROLL_CAPTURE', { y: Number.NaN }).mock.calls[0]![0]).toMatchObject({ ok: false });
    expect(h.sandbox.scrollTo).not.toHaveBeenCalled();
    h.send('RESTORE_CAPTURE');
  });
});
