import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrCreateSessionToken } from './security.js';

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
