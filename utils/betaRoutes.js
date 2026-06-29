// Routes where beta UI (banner, feedback button) must NOT appear.
// A beta tester is authenticated, so we gate on the route, not just auth.
const PUBLIC_PREFIXES = ['/auth', '/onboarding', '/terms'];

export function isPublicRoute(pathname) {
  if (!pathname) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
