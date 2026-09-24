import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrCreateSessionToken, parseAllowedOrigins } from './security.js';

describe('session token', () => {
  it('creates a high-entropy, owner-only token and reuses it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'design-acceptance-'));
    const path = join(directory, 'session-token');
    const first = loadOrCreateSessionToken(path);
    const second = loadOrCreateSessionToken(path);
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(readFileSync(path, 'utf8').trim()).toBe(first);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});

describe('origin configuration', () => {
  it('defaults to loopback workbenches, never extension wildcards', () => {
    expect([...parseAllowedOrigins()]).toEqual(['http://127.0.0.1:4173', 'http://127.0.0.1:4179']);
    expect([...parseAllowedOrigins('http://127.0.0.1:4179, chrome-extension://abcdefghijklmnopabcdefghijklmnop')]).toHaveLength(2);
  });
  it.each(['chrome-extension://*', 'https://example.com', 'http://localhost:4179', 'null', '',
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop/evil', 'http://127.0.0.1:4179.evil'])('rejects unsafe configuration: %s', (value) => {
    expect(() => parseAllowedOrigins(value)).toThrow('INVALID_ALLOWED_ORIGIN');
  });
});
