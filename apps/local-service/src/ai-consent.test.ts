import { describe, expect, it } from 'vitest';
import { openDatabase } from './db.js';
import { AIConsentStore, payloadHash } from './ai-consent.js';

describe('AIConsentStore', () => {
  it('binds consent to provider, model, task and exact payload, then consumes it once', () => {
    const db = openDatabase(':memory:'); const store = new AIConsentStore(db);
    const hash = payloadHash({ issueIds: ['a'] });
    const receipt = store.create('openai', 'gpt-5', 'explain', ['structured-differences'], hash);
    expect(() => store.consume(receipt.id, 'openai', 'gpt-5', 'explain', hash)).not.toThrow();
    expect(() => store.consume(receipt.id, 'openai', 'gpt-5', 'explain', hash)).toThrow('CONSENT_INVALID_OR_EXPIRED');
    db.close();
  });
});
