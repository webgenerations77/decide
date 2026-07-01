import { AsyncLocalStorage } from 'node:async_hooks';

// Anchor the store on globalThis. This module can be instantiated more than once across the
// ESM/CJS import graph (the same class of bug that forced firebaseAdmin to .cjs). If
// runWithUser and currentUserId held separate AsyncLocalStorage instances, getStore() would
// always miss and every request would log as anonymous — which is exactly what the admin
// "by user" breakdown showed.
const storage = (globalThis.__decideUsageALS ??= new AsyncLocalStorage());

// Run fn within a context carrying the caller's userId. logUsage calls made
// anywhere inside fn (including across awaits) attribute to this user.
export function runWithUser(userId, fn) {
  return storage.run({ userId: userId ?? null }, fn);
}

// The userId for the current request, or null outside any runWithUser scope.
export function currentUserId() {
  return storage.getStore()?.userId ?? null;
}
