import { computed, effectScope, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { useOneTimeConsent } from './ai-consent';

describe('AI one-time UI consent', () => {
  it('requires a new confirmation for every attempt, including retries', () => {
    const owner = effectScope();
    owner.run(() => {
      const consent = useOneTimeConsent(computed(() => 'request'));
      expect(consent.consume()).toBeUndefined();
      consent.confirmed.value = true;
      expect(consent.consume()?.scope).toBe('request');
      expect(consent.confirmed.value).toBe(false);
      expect(consent.consume()).toBeUndefined();
      consent.confirmed.value = true;
      expect(consent.consume()?.scope).toBe('request');
    });
    owner.stop();
  });

  it.each(['provider', 'model', 'task', 'run', 'issues', 'image', 'open'])('invalidates confirmation immediately when %s changes', (field) => {
    const owner = effectScope();
    owner.run(() => {
      const request = reactive<Record<string, string>>({ provider: 'openai', model: 'model-a', task: 'explain', run: 'run-a', issues: 'issue-a', image: 'false', open: 'true' });
      const scope = computed(() => JSON.stringify(request));
      const consent = useOneTimeConsent(scope);
      consent.confirmed.value = true;
      const inFlight = consent.consume()!;
      expect(consent.isCurrent(inFlight)).toBe(true);
      consent.confirmed.value = true;
      const oldValue = request[field]!;
      request[field] = 'changed';
      expect(consent.consume()).toBeUndefined();
      request[field] = oldValue;
      expect(consent.consume()).toBeUndefined();
      expect(consent.isCurrent(inFlight)).toBe(false);
    });
    owner.stop();
  });
});
