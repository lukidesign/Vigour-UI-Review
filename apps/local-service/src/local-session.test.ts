import { describe, expect, it, vi } from 'vitest';
import { LocalSession, IDLE_TIMEOUT_MS } from './local-session.js';
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newSessionToken, persistSessionToken } from './security.js';
import { buildApp } from './app.js';
import { openDatabase } from './db.js';

function clock() {
  let now = 1000;
  const session = new LocalSession('test-token', true, () => now);
  return { session, advance: (ms: number) => { now += ms; },
    ticks: (ms: number) => { for (let elapsed = 0; elapsed < ms; elapsed += 10_000) { now += 10_000; session.shouldExit(); } } };
}

describe('local session lifecycle', () => {
  it('requires auth, CSRF, exact instance and no active task before installer shutdown', async () => {
    const token = newSessionToken(); const session = new LocalSession(token, true); const stop = vi.fn(async () => {});
    const db = openDatabase(':memory:'); const root = mkdtempSync(join(tmpdir(), 'vigour-shutdown-test-'));
    const app = buildApp(db, { sessionToken: token, allowedOrigins: new Set(['http://127.0.0.1:4179']) }, root, undefined, { session, stopNative: stop });
    const payload = { instanceId: session.instanceId }; const headers = { authorization: `Bearer ${token}`, 'x-csrf-token': token };
    try {
      expect((await app.inject({ method: 'POST', url: '/api/v1/native/shutdown', payload })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: '/api/v1/native/shutdown', payload, headers: { authorization: headers.authorization } })).statusCode).toBe(403);
      session.begin('long-analysis');
      expect((await app.inject({ method: 'POST', url: '/api/v1/native/shutdown', payload, headers })).statusCode).toBe(409); expect(stop).not.toHaveBeenCalled();
      session.end('long-analysis');
      expect((await app.inject({ method: 'POST', url: '/api/v1/native/shutdown', payload, headers })).statusCode).toBe(200);
      await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
    } finally { await app.close(); db.close(); rmSync(root, { recursive: true, force: true }); }
  });
  it('consumes tickets once, expires at 60 seconds and bounds pending tickets', () => {
    const h = clock();
    const first = h.session.issueTicket();
    expect(first.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(h.session.exchange(first.ticket).sessionToken).toBe('test-token');
    expect(() => h.session.exchange(first.ticket)).toThrow('TICKET_INVALID');
    const expired = h.session.issueTicket(); h.advance(60_000);
    expect(() => h.session.exchange(expired.ticket)).toThrow('TICKET_INVALID');
    for (let i = 0; i < 100; i++) h.session.issueTicket();
    expect(() => h.session.issueTicket()).toThrow('TICKET_LIMIT');
    h.advance(60_000); expect(() => h.session.issueTicket()).not.toThrow();
  });
  it('empty tab polling does not keep a service alive', () => {
    const h = clock();
    for (let i = 0; i < 15; i++) { h.advance(60_000); h.session.reportTabs([]); }
    expect(h.session.shouldExit()).toBe(true);
  });
  it('open background tabs and active requests block idle exit, close starts idle interval', () => {
    const h = clock();
    for (let i = 0; i < 30; i++) { h.advance(60_000); h.session.reportTabs([7]); expect(h.session.shouldExit()).toBe(false); }
    h.session.reportTabs([]); h.ticks(IDLE_TIMEOUT_MS - 10_000);
    expect(h.session.shouldExit()).toBe(false);
    h.session.begin('analysis'); h.ticks(IDLE_TIMEOUT_MS * 2);
    expect(h.session.shouldExit()).toBe(false);
    h.session.end('analysis'); h.ticks(IDLE_TIMEOUT_MS);
    expect(h.session.shouldExit()).toBe(true);
  });
  it('eventually drops abandoned leases but grants a sleep-resume grace period', () => {
    const h = clock(); h.session.lease('page:one', true); h.advance(IDLE_TIMEOUT_MS * 2);
    expect(h.session.shouldExit()).toBe(false);
    h.ticks(IDLE_TIMEOUT_MS);
    expect(h.session.shouldExit()).toBe(true);
  });
  it('never auto-exits a manually launched service', () => {
    let now = 0; const session = new LocalSession('token', false, () => now);
    now = IDLE_TIMEOUT_MS * 100; expect(session.shouldExit()).toBe(false);
  });
  it('rotates private disk credentials atomically', () => {
    const root = mkdtempSync(join(tmpdir(), 'vigour-token-test-'));
    try {
      const path = join(root, 'session-token'); const first = newSessionToken(); const second = newSessionToken();
      expect(first).not.toBe(second); persistSessionToken(path, first); persistSessionToken(path, second);
      expect(readFileSync(path, 'utf8').trim()).toBe(second);
      if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('only exchanges tickets from the allowed workbench origin; all other routes retain auth and CSRF', async () => {
    const token = newSessionToken(); const db = openDatabase(':memory:');
    const root = mkdtempSync(join(tmpdir(), 'vigour-session-test-'));
    const extension = `chrome-extension://${'a'.repeat(32)}`;
    const app = buildApp(db, { sessionToken: token, allowedOrigins: new Set(['http://127.0.0.1:4179', extension]) }, root);
    try {
      expect((await app.inject({ method: 'POST', url: '/api/v1/session/tickets' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: '/api/v1/native/connect', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(403);
      const ticketResponse = await app.inject({ method: 'POST', url: '/api/v1/session/tickets', headers: { authorization: `Bearer ${token}`, 'x-csrf-token': token, origin: extension } });
      expect(ticketResponse.statusCode).toBe(200);
      expect(ticketResponse.headers['cache-control']).toBe('no-store');
      const payload = { ticket: ticketResponse.json().ticket };
      for (const origin of [undefined, 'null', extension, 'https://evil.example']) {
        expect((await app.inject({ method: 'POST', url: '/api/v1/session/exchange', headers: origin ? { origin } : {}, payload })).statusCode).toBe(403);
      }
      const exchange = () => app.inject({ method: 'POST', url: '/api/v1/session/exchange', headers: { origin: 'http://127.0.0.1:4179' }, payload });
      const accepted = await exchange(); expect(accepted.statusCode).toBe(200);
      expect(accepted.json().sessionToken).toBe(token); expect(accepted.headers['cache-control']).toBe('no-store');
      expect((await exchange()).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/v1/native/status' })).statusCode).toBe(401);
    } finally { await app.close(); db.close(); rmSync(root, { recursive: true, force: true }); }
  });
});
