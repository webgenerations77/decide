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
  return storage.run({ userId: userId ?? null, firecrawlDegraded: null }, fn);
}

// The userId for the current request, or null outside any runWithUser scope.
export function currentUserId() {
  return storage.getStore()?.userId ?? null;
}

// Records that THIS request's live research was degraded by Firecrawl (out of credits /
// rate-limited), not that it simply found nothing. Without this, a generation that ran during an
// outage and one that ran on a genuinely quiet news day both come back with identical empty
// results — the exhausted-quota case is invisible on the one response where it actually happened,
// not just in the monthly aggregate. Last writer wins within a request; that's fine, we only need
// to know research was compromised at all, not enumerate every failure.
export function markFirecrawlDegraded(kind) {
  const store = storage.getStore();
  if (store) store.firecrawlDegraded = kind;
}

// 'firecrawl-out-of-credits' | 'firecrawl-rate-limited' | null for the current request.
export function currentFirecrawlDegraded() {
  return storage.getStore()?.firecrawlDegraded ?? null;
}
