import { describe, expect, it } from 'vitest';
import { KEYCHAIN_SERVICE, LEGACY_KEYCHAIN_SERVICE, SecretStore, type KeychainRunner } from './keychain.js';

class MemoryRunner implements KeychainRunner {
  value: string | undefined;
  async save(_account: string, secret: string) { this.value = secret; }
  async read() { return this.value; }
  async remove() { this.value = undefined; }
}

describe('SecretStore', () => {
  it('keeps distinct current and legacy service identifiers for safe migration', () => {
    expect(KEYCHAIN_SERVICE).toBe('com.vigour-ui-review.local');
    expect(LEGACY_KEYCHAIN_SERVICE).toBe('com.design-acceptance.local');
  });
  it('returns only configuration state, while values remain in the keychain runner', async () => {
    const runner = new MemoryRunner(); const secrets = new SecretStore(runner);
    expect(await secrets.hasFigmaPat()).toBe(false);
    await secrets.saveFigmaPat('figd_secret_value');
    expect(await secrets.hasFigmaPat()).toBe(true);
    await secrets.removeFigmaPat();
    expect(await secrets.hasFigmaPat()).toBe(false);
  });
});
