import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export const NATIVE_PROTOCOL = 1;
export const IDLE_TIMEOUT_MS = 15 * 60_000;
const LEASE_MS = 3 * 60_000;
const TICKET_MS = 60_000;

export class LocalSession {
  readonly instanceId = randomUUID();
  private tickets = new Map<string, number>();
  private leases = new Map<string, number>();
  private active = new Set<string>();
  private lastActivity: number;
  private lastCheck: number;
  constructor(readonly token: string, readonly nativeMode = false, private readonly now = Date.now) {
    this.lastActivity = now();
    this.lastCheck = now();
  }
  touch() { this.lastActivity = this.now(); }
  issueTicket() {
    for (const [ticket, expires] of this.tickets) if (expires <= this.now()) this.tickets.delete(ticket);
    if (this.tickets.size >= 100) throw new Error('TICKET_LIMIT');
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(ticket, this.now() + TICKET_MS);
    this.touch();
    return { ticket, expiresInSeconds: 60 };
  }
  exchange(ticket: string) {
    const expires = this.tickets.get(ticket);
    this.tickets.delete(ticket); // Consume before returning: replay is never accepted.
    if (!expires || expires <= this.now()) throw new Error('TICKET_INVALID');
    this.touch();
    return { sessionToken: this.token, instanceId: this.instanceId };
  }
  lease(id: string, open: boolean) {
    for (const [key, expires] of this.leases) if (expires <= this.now()) this.leases.delete(key);
    if (open) {
      if (!this.leases.has(id) && this.leases.size >= 1000) throw new Error('LEASE_LIMIT');
      this.leases.set(id, this.now() + LEASE_MS);
      this.touch();
    } else if (this.leases.delete(id)) this.touch();
  }
  reportTabs(ids: number[]) {
    const hadTabs = [...this.leases.keys()].some((key) => key.startsWith('tab:'));
    for (const key of this.leases.keys()) if (key.startsWith('tab:')) this.leases.delete(key);
    for (const id of ids) this.leases.set(`tab:${id}`, this.now() + LEASE_MS);
    if (ids.length || hadTabs) this.touch(); // Empty keepalives must NOT prevent idle exit.
  }
  begin(id: string) { this.active.add(id); this.touch(); }
  end(id: string) { if (this.active.delete(id)) this.touch(); }
  hasOtherRequests(id: string) { return [...this.active].some((active) => active !== id); }
  shouldExit() {
    // After OS sleep, give open pages time to resume their throttled heartbeats.
    if (this.leases.size && this.now() - this.lastCheck > 2 * 60_000) {
      for (const id of this.leases.keys()) this.leases.set(id, this.now() + LEASE_MS);
      this.touch();
    }
    this.lastCheck = this.now();
    for (const [id, expires] of this.leases) if (expires <= this.now()) this.leases.delete(id);
    return this.nativeMode && !this.active.size && !this.leases.size && this.now() - this.lastActivity >= IDLE_TIMEOUT_MS;
  }
}

export function registerLocalSession(app: FastifyInstance, session: LocalSession, stop?: () => Promise<void>) {
  const maintenance = new Set(['/api/v1/native/activity', '/api/v1/native/status', '/api/v1/session/lease']);
  app.addHook('onRequest', async (request) => {
    if (request.url.startsWith('/api/') && !maintenance.has(request.routeOptions.url ?? '')) session.begin(request.id);
  });
  app.addHook('onResponse', async (request) => { session.end(request.id); });
  app.addHook('onError', async (request) => { session.end(request.id); });
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/v1/session/') || request.url.startsWith('/api/v1/native/')) reply.header('cache-control', 'no-store');
    return payload;
  });
  app.post('/api/v1/session/tickets', async (_request, reply) => {
    try { return session.issueTicket(); }
    catch { return reply.code(429).send({ code: 'TICKET_LIMIT' }); }
  });
  app.post('/api/v1/session/exchange', async (request, reply) => {
    const input = z.object({ ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().safeParse(request.body);
    if (!input.success) return reply.code(400).send({ code: 'TICKET_INVALID' });
    try { return session.exchange(input.data.ticket); }
    catch { return reply.code(401).send({ code: 'TICKET_INVALID' }); }
  });
  app.post('/api/v1/session/lease', async (request, reply) => {
    const input = z.object({ id: z.string().uuid(), open: z.boolean() }).strict().safeParse(request.body);
    if (!input.success) return reply.code(400).send({ code: 'INVALID_LEASE' });
    try { session.lease(`page:${input.data.id}`, input.data.open); return { ok: true }; }
    catch { return reply.code(429).send({ code: 'LEASE_LIMIT' }); }
  });
  app.post('/api/v1/native/activity', async (request, reply) => {
    const input = z.object({ tabIds: z.array(z.number().int().nonnegative()).max(500) }).strict().safeParse(request.body);
    if (!input.success) return reply.code(400).send({ code: 'INVALID_ACTIVITY' });
    session.reportTabs(input.data.tabIds);
    return { ok: true };
  });
  app.get('/api/v1/native/status', async () => ({ protocol: NATIVE_PROTOCOL, instanceId: session.instanceId, nativeMode: session.nativeMode }));
  app.post('/api/v1/native/connect', async () => {
    session.touch();
    return { protocol: NATIVE_PROTOCOL, instanceId: session.instanceId, nativeMode: session.nativeMode };
  });
  app.post('/api/v1/native/shutdown', async (request, reply) => {
    const input = z.object({ instanceId: z.string().uuid() }).strict().safeParse(request.body);
    if (!input.success || input.data.instanceId !== session.instanceId) return reply.code(409).send({ code: 'INSTANCE_MISMATCH' });
    if (!session.nativeMode || !stop) return reply.code(409).send({ code: 'MANUAL_SERVICE' });
    if (session.hasOtherRequests(request.id)) return reply.code(409).send({ code: 'SERVICE_BUSY' });
    // Auth + CSRF were checked first. The installer explicitly confirms this action.
    setImmediate(() => { void stop().catch(() => undefined); });
    return { ok: true };
  });
}
