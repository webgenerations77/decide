import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

// Run fn within a context carrying the caller's userId. logUsage calls made
// anywhere inside fn (including across awaits) attribute to this user.
export function runWithUser(userId, fn) {
  return storage.run({ userId: userId ?? null }, fn);
}

// The userId for the current request, or null outside any runWithUser scope.
export function currentUserId() {
  return storage.getStore()?.userId ?? null;
}
