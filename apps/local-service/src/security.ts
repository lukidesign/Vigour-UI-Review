import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export interface SecurityConfig {
  sessionToken: string;
  allowedOrigins: ReadonlySet<string>;
}

export function loadOrCreateSessionToken(path: string): string {
  if (existsSync(path)) {
    const token = readFileSync(path, 'utf8').trim();
    if (token.length < 43) throw new Error('Stored session token is invalid');
    return token;
  }
  const token = randomBytes(32).toString('base64url');
  writeFileSync(path, `${token}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return token;
}

function equalSecret(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function bearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return undefined;
  return authorization.slice('Bearer '.length);
}

export function registerSecurity(app: FastifyInstance, config: SecurityConfig): void {
  const isOriginAllowed = (origin: string | undefined) => {
    const extensionWildcard = config.allowedOrigins.has('chrome-extension://*');
    return !origin || config.allowedOrigins.has(origin) || (extensionWildcard && origin.startsWith('chrome-extension://'));
  };

  app.addHook('onSend', async (request, reply, payload) => {
    const origin = request.headers.origin;
    if (origin && isOriginAllowed(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('vary', 'Origin');
    }
    return payload;
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;

    const origin = request.headers.origin;
    if (!isOriginAllowed(origin)) {
      return reply.code(403).send({ code: 'ORIGIN_NOT_ALLOWED' });
    }
    if (request.method === 'OPTIONS') {
      reply.header('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      reply.header('access-control-allow-headers', 'authorization,content-type,x-csrf-token');
      reply.header('access-control-max-age', '600');
      return reply.code(204).send();
    }
    if (!equalSecret(bearerToken(request), config.sessionToken)) {
      return reply.code(401).send({ code: 'UNAUTHORIZED' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const csrf = request.headers['x-csrf-token'];
      if (Array.isArray(csrf) || !equalSecret(csrf, config.sessionToken)) {
        return reply.code(403).send({ code: 'CSRF_CHECK_FAILED' });
      }
    }
  });
}
