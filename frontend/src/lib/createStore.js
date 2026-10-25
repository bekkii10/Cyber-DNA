import { useSyncExternalStore } from 'react';

// Tiny external store (no dependency). Lets modules outside the React tree (event listeners, lazy chunks)
// share state with components without prop drilling or lost events.
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      if (next === state) return;
      state = next;
      subs.forEach((fn) => fn());
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
