import { ref, watch, type ComputedRef } from 'vue';

// UI confirmation is scoped to exactly one request, independently of the
// server's single-use receipt. Reset synchronously before a changed scope can send.
export function useOneTimeConsent(scope: ComputedRef<string>) {
  const confirmed = ref(false);
  let revision = 0;
  watch(scope, () => { confirmed.value = false; revision += 1; }, { flush: 'sync' });
  function consume() {
    if (!confirmed.value) return undefined;
    confirmed.value = false;
    return { scope: scope.value, revision };
  }
  function isCurrent(ticket: { scope: string; revision: number }) {
    return ticket.revision === revision && ticket.scope === scope.value;
  }
  return { confirmed, consume, isCurrent };
}
