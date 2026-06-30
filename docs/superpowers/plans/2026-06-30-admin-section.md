# Admin Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected `/admin` dashboard for `webgenerations77@gmail.com` with real API-usage stats and runtime-editable user roles, enforced on client and server.

**Architecture:** Admin status stays hardcoded + synchronous (`constants/admins.js`) so the gate never depends on a network read. Beta-tester roles migrate to Firestore (mutable at runtime), seeded from the existing hardcoded map with that map as offline fallback. `firebase-admin` verifies a Firebase ID token (Bearer header) on every `/api/admin/*` route. Usage is logged fire-and-forget from the shared Anthropic/Places call sites into a Firestore `apiUsage` collection. **Pure decision/computation logic is separated from Firebase I/O** so it can be unit-tested in this repo's existing `.mjs` style; the thin I/O wrappers and handlers get manual acceptance testing.

**Tech Stack:** Expo SDK 56, expo-router, Firebase client SDK (+ Firestore), `firebase-admin`, Anthropic SDK, Vercel serverless. Dual handler trees: `api/*.js` (prod, `export default handler(req,res)`) and `app/api/*+api.js` (dev, `export async function GET/POST(request)`).

## Global Constraints

- Expo SDK 56 — reference https://docs.expo.dev/versions/v56.0.0/ before writing app code.
- All npm installs use `--legacy-peer-deps`.
- Client-side env vars MUST use the `EXPO_PUBLIC_` prefix; server-only secrets MUST NOT.
- `ANTHROPIC_API_KEY` and the new `FIREBASE_*` admin vars are server-side only — never exposed to the client.
- No hardcoded hex in components — all colors from `constants/theme.js`; CTAs cobalt (orange only for logo dot / food category).
- AI assistant is named "Cheddar" in user-facing text — never "AI".
- Tests are plain `.mjs` files in `__tests__/`, run via `node __tests__/<name>.mjs`, exit code 0 (pass) / 1 (fail), using the inline `assert` helper pattern already in the repo.
- Every `/api/admin/*` endpoint exists in BOTH handler trees (`api/admin/*.js` and `app/api/admin/*+api.js`) and imports all real logic from `lib/admin/*`.
- Commit after each task. Run `cd decide-app` is implied — all paths below are relative to `decide-app/`.

---

### Task 1: firebase-admin init + env wiring

**Files:**
- Create: `lib/firebaseAdmin.js`
- Create: `__tests__/firebase-admin-key.mjs`
- Modify: `.env.example`
- Modify: `package.json` (via npm install)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalizePrivateKey(raw: string): string` — converts literal `\n` to real newlines.
  - `getAdminAuth(): admin.auth.Auth` — singleton.
  - `getAdminDb(): admin.firestore.Firestore` — singleton.
  - Throws `Error('firebase_admin_unconfigured')` if any of the three env vars is missing.

- [ ] **Step 1: Install firebase-admin**

Run: `npm install firebase-admin --legacy-peer-deps`
Expected: adds `firebase-admin` to `dependencies`, exits 0.

- [ ] **Step 2: Write the failing test**

Create `__tests__/firebase-admin-key.mjs`:

```javascript
// __tests__/firebase-admin-key.mjs — run: node __tests__/firebase-admin-key.mjs
import { normalizePrivateKey } from '../lib/firebaseAdmin.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('converts literal \\n to real newlines',
  normalizePrivateKey('-----BEGIN-----\\nabc\\n-----END-----') === '-----BEGIN-----\nabc\n-----END-----');
assert('leaves real newlines untouched',
  normalizePrivateKey('a\nb') === 'a\nb');
assert('handles undefined as empty string',
  normalizePrivateKey(undefined) === '');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node __tests__/firebase-admin-key.mjs`
Expected: FAIL — `Cannot find module '../lib/firebaseAdmin.js'` (or import error).

- [ ] **Step 4: Write the implementation**

Create `lib/firebaseAdmin.js`:

```javascript
import admin from 'firebase-admin';

export function normalizePrivateKey(raw) {
  return (raw || '').replace(/\\n/g, '\n');
}

let app = null;

function getApp() {
  if (app) return app;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('firebase_admin_unconfigured');
  }
  app = admin.apps.length
    ? admin.apps[0]
    : admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminAuth() { return admin.auth(getApp()); }
export function getAdminDb()   { return admin.firestore(getApp()); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node __tests__/firebase-admin-key.mjs`
Expected: PASS — `3 passed, 0 failed`.

- [ ] **Step 6: Document env vars**

Add to `.env.example` (server-only section):

```
# Firebase Admin (server-only — service account; required for /admin endpoints)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add lib/firebaseAdmin.js __tests__/firebase-admin-key.mjs .env.example package.json package-lock.json
git commit -m "feat: add firebase-admin init and service-account env wiring"
```

---

### Task 2: Admin constant + isAdmin util

**Files:**
- Create: `constants/admins.js`
- Create: `utils/admin.js`
- Create: `__tests__/admin-util.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ADMINS: Record<string,'admin'>` — lowercased email → 'admin'.
  - `getAdminRole(user): 'admin'|null` — from a Firebase user object (`user.email`).
  - `isAdmin(user): boolean`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/admin-util.mjs`:

```javascript
// __tests__/admin-util.mjs — run: node __tests__/admin-util.mjs
import { isAdmin, getAdminRole } from '../utils/admin.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('admin email is admin', isAdmin({ email: 'webgenerations77@gmail.com' }) === true);
assert('match is case-insensitive', isAdmin({ email: 'WebGenerations77@Gmail.com' }) === true);
assert('match trims whitespace', isAdmin({ email: '  webgenerations77@gmail.com ' }) === true);
assert('non-admin is false', isAdmin({ email: 'dwaynephil@gmail.com' }) === false);
assert('null user is false', isAdmin(null) === false);
assert('user without email is false', isAdmin({}) === false);
assert('getAdminRole returns admin for admin', getAdminRole({ email: 'webgenerations77@gmail.com' }) === 'admin');
assert('getAdminRole returns null for non-admin', getAdminRole({ email: 'x@y.com' }) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/admin-util.mjs`
Expected: FAIL — cannot find `../utils/admin.js`.

- [ ] **Step 3: Write the implementation**

Create `constants/admins.js`:

```javascript
// Authorized admins, keyed by LOWERCASED email → role.
// Admin gating is synchronous and hardcoded on purpose (never a network read).
// Add an admin by adding one line here; never compare an email literal elsewhere.
export const ADMINS = {
  'webgenerations77@gmail.com': 'admin',
};
```

Create `utils/admin.js`:

```javascript
import { ADMINS } from '../constants/admins';

// Admin role for a Firebase user, or null. Email match is lowercased + trimmed.
export function getAdminRole(user) {
  const email = user?.email?.toLowerCase?.().trim();
  if (!email) return null;
  return ADMINS[email] || null;
}

export function isAdmin(user) {
  return getAdminRole(user) === 'admin';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/admin-util.mjs`
Expected: PASS — `8 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add constants/admins.js utils/admin.js __tests__/admin-util.mjs
git commit -m "feat: add hardcoded admin constant and isAdmin util"
```

---

### Task 3: Role migration to Firestore + AuthContext wiring

**Files:**
- Modify: `services/firebase.js` (add client Firestore `db` export)
- Create: `services/rolesService.js`
- Create: `__tests__/roles-resolve.mjs`
- Modify: `context/AuthContext.js`

**Interfaces:**
- Consumes: `isAdmin` from `utils/admin.js`; existing `BETA_TESTERS` from `constants/betaTesters.js`.
- Produces:
  - `resolveRole({ firestoreRole, fallbackMap, email }): string|null` — pure precedence logic.
  - `fetchUserRole(uid, email): Promise<string|null>` — reads `users/{uid}` via client Firestore, falls back to the hardcoded map on missing doc / error.
  - `useAuth()` value gains: `isAdmin: boolean` (sync), and `role`/`isBetaTester` now resolved async from Firestore.

- [ ] **Step 1: Add client Firestore to services/firebase.js**

Modify `services/firebase.js` — add the import and `db` export:

```javascript
import { getFirestore } from 'firebase/firestore';
// ...existing app/auth setup unchanged...
const db = getFirestore(app);

export { app, auth, db };
```

(Keep the existing `app` / `auth` exports; add `getFirestore` import at top and `db` to the export.)

- [ ] **Step 2: Write the failing test**

Create `__tests__/roles-resolve.mjs`:

```javascript
// __tests__/roles-resolve.mjs — run: node __tests__/roles-resolve.mjs
import { resolveRole } from '../services/rolesService.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const map = { 'dwaynephil@gmail.com': 'beta_tester' };

assert('firestore role wins when present',
  resolveRole({ firestoreRole: 'beta_tester', fallbackMap: {}, email: 'a@b.com' }) === 'beta_tester');
assert('firestore null (explicit revoke) wins over map',
  resolveRole({ firestoreRole: null, fallbackMap: map, email: 'dwaynephil@gmail.com', hasDoc: true }) === null);
assert('falls back to map when no firestore doc',
  resolveRole({ firestoreRole: undefined, fallbackMap: map, email: 'dwaynephil@gmail.com', hasDoc: false }) === 'beta_tester');
assert('returns null when neither present',
  resolveRole({ firestoreRole: undefined, fallbackMap: map, email: 'nobody@x.com', hasDoc: false }) === null);
assert('email match is case-insensitive in fallback',
  resolveRole({ firestoreRole: undefined, fallbackMap: map, email: 'DwaynePhil@Gmail.com', hasDoc: false }) === 'beta_tester');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node __tests__/roles-resolve.mjs`
Expected: FAIL — cannot find `../services/rolesService.js`.

- [ ] **Step 4: Write rolesService**

Create `services/rolesService.js`:

```javascript
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { BETA_TESTERS } from '../constants/betaTesters';

// Pure precedence: an existing Firestore doc is authoritative (even when role is null,
// which represents an explicit revoke). With no doc, fall back to the hardcoded seed map.
export function resolveRole({ firestoreRole, fallbackMap, email, hasDoc }) {
  if (hasDoc) return firestoreRole ?? null;
  const key = email?.toLowerCase?.().trim();
  return (key && fallbackMap[key]) || null;
}

// I/O wrapper: read users/{uid}; on any failure fall back to the hardcoded map.
export async function fetchUserRole(uid, email) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return resolveRole({
      firestoreRole: snap.exists() ? (snap.data().role ?? null) : undefined,
      fallbackMap: BETA_TESTERS,
      email,
      hasDoc: snap.exists(),
    });
  } catch (e) {
    console.warn('[rolesService] fetch failed, using fallback map:', e.message);
    return resolveRole({ firestoreRole: undefined, fallbackMap: BETA_TESTERS, email, hasDoc: false });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node __tests__/roles-resolve.mjs`
Expected: PASS — `5 passed, 0 failed`.

- [ ] **Step 6: Wire AuthContext (async role + isAdmin)**

Replace `context/AuthContext.js` with:

```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, signUp, signIn, signOut, resetPassword } from '../services/authService';
import { fetchUserRole } from '../services/rolesService';
import { isAdmin as computeIsAdmin } from '../utils/admin';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        const r = await fetchUserRole(u.uid, u.email);
        setRole(r);
      } else {
        setRole(null);
      }
    });
    return unsubscribe;
  }, []);

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    role,
    isBetaTester: role === 'beta_tester',
    isAdmin: computeIsAdmin(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useIsAdmin() {
  return useAuth().isAdmin;
}
```

- [ ] **Step 7: Manual smoke check**

Run: `npx expo start --web` and confirm the app boots, you can sign in, and existing beta-tester behavior still works (the beta banner appears for a beta account). No console errors from Firestore.
Expected: app loads; beta gate works via Firestore-with-fallback.

- [ ] **Step 8: Commit**

```bash
git add services/firebase.js services/rolesService.js context/AuthContext.js __tests__/roles-resolve.mjs
git commit -m "feat: migrate beta roles to Firestore with fallback; add isAdmin to AuthContext"
```

---

### Task 4: requireAdmin server guard

**Files:**
- Create: `lib/admin/requireAdmin.js`
- Create: `__tests__/require-admin.mjs`

**Interfaces:**
- Consumes: `ADMINS` from `constants/admins.js`; `getAdminAuth` from `lib/firebaseAdmin.js`.
- Produces:
  - `extractBearer(headerValue: string|undefined): string|null`.
  - `decideAdmin(decodedToken): { ok: true } | { ok: false, status: 401|403, error: string }`.
  - `verifyAdminRequest(authHeader: string|undefined): Promise<{ ok, status?, error?, email? }>` — verifies the token then `decideAdmin`. On missing token → 401; bad token → 401; valid-but-not-admin → 403.

- [ ] **Step 1: Write the failing test**

Create `__tests__/require-admin.mjs`:

```javascript
// __tests__/require-admin.mjs — run: node __tests__/require-admin.mjs
import { extractBearer, decideAdmin } from '../lib/admin/requireAdmin.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('extracts token from Bearer header', extractBearer('Bearer abc.def') === 'abc.def');
assert('case-insensitive scheme', extractBearer('bearer xyz') === 'xyz');
assert('returns null for missing header', extractBearer(undefined) === null);
assert('returns null for non-bearer', extractBearer('Basic abc') === null);

assert('admin token ok', decideAdmin({ email: 'webgenerations77@gmail.com' }).ok === true);
const notAdmin = decideAdmin({ email: 'someone@else.com' });
assert('non-admin denied 403', notAdmin.ok === false && notAdmin.status === 403);
const noEmail = decideAdmin({});
assert('no email denied 403', noEmail.ok === false && noEmail.status === 403);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/require-admin.mjs`
Expected: FAIL — cannot find `../lib/admin/requireAdmin.js`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin/requireAdmin.js`:

```javascript
import { ADMINS } from '../../constants/admins.js';
import { getAdminAuth } from '../firebaseAdmin.js';

export function extractBearer(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function decideAdmin(decodedToken) {
  const email = decodedToken?.email?.toLowerCase?.().trim();
  if (email && ADMINS[email]) return { ok: true, email };
  return { ok: false, status: 403, error: 'not_admin' };
}

export async function verifyAdminRequest(authHeader) {
  const token = extractBearer(authHeader);
  if (!token) return { ok: false, status: 401, error: 'missing_token' };
  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch (e) {
    if (e.message === 'firebase_admin_unconfigured') return { ok: false, status: 500, error: 'admin_unconfigured' };
    return { ok: false, status: 401, error: 'invalid_token' };
  }
  return decideAdmin(decoded);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/require-admin.mjs`
Expected: PASS — `7 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/requireAdmin.js __tests__/require-admin.mjs
git commit -m "feat: add requireAdmin server guard (token verify + admin check)"
```

---

### Task 5: Pricing table + usage logging + instrument call sites

**Files:**
- Create: `constants/pricing.js`
- Create: `lib/usageLog.js`
- Create: `__tests__/usage-cost.mjs`
- Modify: `lib/smart/synthesis.js`, `lib/smart/scout.js`, `lib/smart/anchors.js`, `lib/smart/liveMusic.js`
- Modify: `api/itinerary-swap.js`, `app/api/itinerary-swap+api.js`
- Modify: `api/itinerary.js`, `app/api/itinerary+api.js` (Places request counter)

**Interfaces:**
- Consumes: `getAdminDb` from `lib/firebaseAdmin.js`.
- Produces:
  - `PRICING` (from `constants/pricing.js`): `{ effectiveDate, anthropic: { 'claude-haiku-4-5-20251001': {inPerMTok,outPerMTok}, 'claude-sonnet-4-6': {...} }, googlePlacesPerRequest }`.
  - `computeCost({ model, inputTokens, outputTokens, requests }): number` — USD estimate.
  - `logUsage({ route, model, inputTokens, outputTokens, requests, userId }): void` — fire-and-forget Firestore write; never throws.

- [ ] **Step 1: Write the failing test**

Create `__tests__/usage-cost.mjs`:

```javascript
// __tests__/usage-cost.mjs — run: node __tests__/usage-cost.mjs
import { computeCost } from '../lib/usageLog.js';
import { PRICING } from '../constants/pricing.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);
const close = (a, b) => Math.abs(a - b) < 1e-9;

const h = PRICING.anthropic['claude-haiku-4-5-20251001'];
const expectedHaiku = (1_000_000 / 1e6) * h.inPerMTok + (500_000 / 1e6) * h.outPerMTok;
assert('haiku token cost',
  close(computeCost({ model: 'claude-haiku-4-5-20251001', inputTokens: 1_000_000, outputTokens: 500_000 }), expectedHaiku));

assert('places request cost',
  close(computeCost({ model: 'google-places', requests: 10 }), 10 * PRICING.googlePlacesPerRequest));

assert('unknown model costs 0', computeCost({ model: 'nope', inputTokens: 100, outputTokens: 100 }) === 0);
assert('missing fields default to 0', computeCost({ model: 'claude-sonnet-4-6' }) === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/usage-cost.mjs`
Expected: FAIL — cannot find `../lib/usageLog.js` / `../constants/pricing.js`.

- [ ] **Step 3: Write pricing table**

Create `constants/pricing.js`:

```javascript
// Cost-estimate rates for the admin API-usage dashboard. USD.
// Dated so dashboard figures are auditable; update when provider pricing changes.
export const PRICING = {
  effectiveDate: '2026-06-30',
  anthropic: {
    'claude-haiku-4-5-20251001': { inPerMTok: 1.00, outPerMTok: 5.00 },
    'claude-sonnet-4-6':         { inPerMTok: 3.00, outPerMTok: 15.00 },
  },
  // Rough blended estimate per Google Places (Nearby/Text/Details) request.
  googlePlacesPerRequest: 0.017,
};
```

- [ ] **Step 4: Write usageLog**

Create `lib/usageLog.js`:

```javascript
import { PRICING } from '../constants/pricing.js';
import { getAdminDb } from './firebaseAdmin.js';

export function computeCost({ model, inputTokens = 0, outputTokens = 0, requests = 0 }) {
  if (model === 'google-places') return requests * PRICING.googlePlacesPerRequest;
  const rate = PRICING.anthropic[model];
  if (!rate) return 0;
  return (inputTokens / 1e6) * rate.inPerMTok + (outputTokens / 1e6) * rate.outPerMTok;
}

// Fire-and-forget: never await in a request path; swallow all errors.
export function logUsage({ route, model, inputTokens = 0, outputTokens = 0, requests = 0, userId = null }) {
  try {
    const estCost = computeCost({ model, inputTokens, outputTokens, requests });
    const db = getAdminDb();
    db.collection('apiUsage').add({
      ts: Date.now(),
      route, model, inputTokens, outputTokens, requests, estCost, userId,
    }).catch((e) => console.warn('[usageLog] write failed:', e.message));
  } catch (e) {
    console.warn('[usageLog] skipped:', e.message);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node __tests__/usage-cost.mjs`
Expected: PASS — `4 passed, 0 failed`.

- [ ] **Step 6: Instrument the four shared Anthropic call sites**

In each of `lib/smart/synthesis.js`, `lib/smart/scout.js`, `lib/smart/anchors.js`, `lib/smart/liveMusic.js`: add the import at the top of the file:

```javascript
import { logUsage } from '../usageLog.js';
```

Then immediately after the existing `const msg = await client.messages.create({ ... })` call in each file, add (use the model literal already passed to that call — `'claude-sonnet-4-6'` in synthesis, `'claude-haiku-4-5-20251001'` in scout/anchors/liveMusic, and set `route` to the file's name):

```javascript
logUsage({
  route: 'synthesis',                    // 'scout' | 'anchors' | 'liveMusic' per file
  model: 'claude-sonnet-4-6',            // match each file's actual model literal
  inputTokens: msg.usage?.input_tokens ?? 0,
  outputTokens: msg.usage?.output_tokens ?? 0,
});
```

- [ ] **Step 7: Instrument the Anthropic swap call (dev handler only)**

Only `app/api/itinerary-swap+api.js` calls Anthropic (the prod `api/itinerary-swap.js` is a pure Places ratings-sort with no Claude call — do not add an Anthropic log there). Add `import { logUsage } from '../../lib/usageLog.js';` at the top, then after the existing `const message = await client.messages.create({ ... })`:

```javascript
logUsage({
  route: 'itinerary-swap',
  model: 'claude-haiku-4-5-20251001',
  inputTokens: message.usage?.input_tokens ?? 0,
  outputTokens: message.usage?.output_tokens ?? 0,
});
```

- [ ] **Step 8: Instrument Places request counting in all four handlers**

`lib/smart/*` does NOT call Google Places — every Places call is a `fetchPlaces` helper inside the four handler files. Add the `logUsage` import (note the per-file relative depth) and, inside each file's `fetchPlaces`, immediately after the `const res = await fetch(...)`/`const data = await res.json()` for the nearby search, add one counter line:

```javascript
logUsage({ route: 'places-nearby', model: 'google-places', requests: 1 });
```

Import path per file (prod `api/*` is one level under root, dev `app/api/*` is two):

| File | Import |
|---|---|
| `api/itinerary.js` | `import { logUsage } from '../lib/usageLog.js';` |
| `app/api/itinerary+api.js` | `import { logUsage } from '../../lib/usageLog.js';` |
| `api/itinerary-swap.js` | `import { logUsage } from '../lib/usageLog.js';` |
| `app/api/itinerary-swap+api.js` | already imported in Step 7 (`../../lib/usageLog.js`) |

- [ ] **Step 9: Re-run all unit tests**

Run: `node __tests__/usage-cost.mjs && node __tests__/smart-synthesis.mjs && node __tests__/smart-scout.mjs && node __tests__/smart-anchors.mjs`
Expected: all pass (instrumentation must not break existing pure tests — `logUsage` is import-safe because it only touches Firestore lazily inside the function body).

- [ ] **Step 10: Commit**

```bash
git add constants/pricing.js lib/usageLog.js __tests__/usage-cost.mjs lib/smart/synthesis.js lib/smart/scout.js lib/smart/anchors.js lib/smart/liveMusic.js api/itinerary-swap.js app/api/itinerary-swap+api.js api/itinerary.js app/api/itinerary+api.js
git commit -m "feat: add usage logging and instrument Anthropic + Places call sites"
```

---

### Task 6: Admin API — usage + users (logic, then endpoints)

**Files:**
- Create: `lib/admin/usage.js`
- Create: `lib/admin/users.js`
- Create: `__tests__/usage-aggregate.mjs`
- Create: `api/admin/usage.js`, `app/api/admin/usage+api.js`
- Create: `api/admin/users.js`, `app/api/admin/users+api.js`

**Interfaces:**
- Consumes: `getAdminDb` from `lib/firebaseAdmin.js`; `getAdminAuth` from `lib/firebaseAdmin.js`; `verifyAdminRequest` from `lib/admin/requireAdmin.js`; `BETA_TESTERS` from `constants/betaTesters.js`.
- Produces:
  - `rangeStartMs(range: 'day'|'week'|'month', nowMs: number): number`.
  - `aggregateUsage(rows): { totals, byModel, byRoute }` where each bucket has `{ requests, inputTokens, outputTokens, estCost }`.
  - `fetchUsage(range): Promise<aggregateUsage result>` — I/O.
  - `listUsersWithRoles(): Promise<Array<{uid,email,role,status,createdAt,lastSignIn}>>` — merges Auth list with Firestore roles; lazily seeds missing beta docs.
  - `setUserRole(uid, role): Promise<void>` — writes `users/{uid}.role` (`'beta_tester'` or `null`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/usage-aggregate.mjs`:

```javascript
// __tests__/usage-aggregate.mjs — run: node __tests__/usage-aggregate.mjs
import { aggregateUsage, rangeStartMs } from '../lib/admin/usage.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);
const close = (a, b) => Math.abs(a - b) < 1e-9;

const rows = [
  { model: 'claude-haiku-4-5-20251001', route: 'scout',     inputTokens: 100, outputTokens: 50, requests: 0, estCost: 0.5 },
  { model: 'claude-sonnet-4-6',         route: 'synthesis', inputTokens: 200, outputTokens: 80, requests: 0, estCost: 1.0 },
  { model: 'google-places',             route: 'places-nearby', inputTokens: 0, outputTokens: 0, requests: 3, estCost: 0.051 },
];
const agg = aggregateUsage(rows);

assert('totals sum requests', agg.totals.requests === 3);
assert('totals sum input tokens', agg.totals.inputTokens === 300);
assert('totals sum cost', close(agg.totals.estCost, 1.551));
assert('byModel splits sonnet', close(agg.byModel['claude-sonnet-4-6'].estCost, 1.0));
assert('byRoute splits scout', agg.byRoute['scout'].outputTokens === 50);

const now = 1_000_000_000_000;
assert('day range is 24h back', rangeStartMs('day', now) === now - 24 * 3600 * 1000);
assert('week range is 7d back', rangeStartMs('week', now) === now - 7 * 24 * 3600 * 1000);
assert('month range is 30d back', rangeStartMs('month', now) === now - 30 * 24 * 3600 * 1000);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/usage-aggregate.mjs`
Expected: FAIL — cannot find `../lib/admin/usage.js`.

- [ ] **Step 3: Write lib/admin/usage.js**

Create `lib/admin/usage.js`:

```javascript
import { getAdminDb } from '../firebaseAdmin.js';

const DAY = 24 * 3600 * 1000;
const SPAN = { day: DAY, week: 7 * DAY, month: 30 * DAY };

export function rangeStartMs(range, nowMs) {
  return nowMs - (SPAN[range] ?? DAY);
}

function emptyBucket() {
  return { requests: 0, inputTokens: 0, outputTokens: 0, estCost: 0 };
}
function add(bucket, row) {
  bucket.requests     += row.requests || 0;
  bucket.inputTokens  += row.inputTokens || 0;
  bucket.outputTokens += row.outputTokens || 0;
  bucket.estCost      += row.estCost || 0;
}

export function aggregateUsage(rows) {
  const totals = emptyBucket();
  const byModel = {};
  const byRoute = {};
  for (const row of rows) {
    add(totals, row);
    (byModel[row.model] ??= emptyBucket()), add(byModel[row.model], row);
    (byRoute[row.route] ??= emptyBucket()), add(byRoute[row.route], row);
  }
  return { totals, byModel, byRoute };
}

export async function fetchUsage(range, nowMs = Date.now()) {
  const start = rangeStartMs(range, nowMs);
  const snap = await getAdminDb().collection('apiUsage').where('ts', '>=', start).get();
  const rows = snap.docs.map((d) => d.data());
  return aggregateUsage(rows);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/usage-aggregate.mjs`
Expected: PASS — `8 passed, 0 failed`.

- [ ] **Step 5: Write lib/admin/users.js**

Create `lib/admin/users.js`:

```javascript
import { getAdminAuth, getAdminDb } from '../firebaseAdmin.js';
import { BETA_TESTERS } from '../../constants/betaTesters.js';

// List all Firebase users, merge their Firestore role, and lazily seed a users/{uid}
// doc for any hardcoded beta tester that has an account but no doc yet.
export async function listUsersWithRoles() {
  const db = getAdminDb();
  const { users } = await getAdminAuth().listUsers(1000);
  const out = [];
  for (const u of users) {
    const ref = db.collection('users').doc(u.uid);
    const snap = await ref.get();
    let role;
    if (snap.exists) {
      role = snap.data().role ?? null;
    } else {
      const seeded = BETA_TESTERS[u.email?.toLowerCase?.().trim()] || null;
      if (seeded) await ref.set({ email: u.email, role: seeded, status: 'active', updatedAt: Date.now() });
      role = seeded;
    }
    out.push({
      uid: u.uid,
      email: u.email || null,
      role,
      status: u.disabled ? 'disabled' : 'active',
      createdAt: u.metadata?.creationTime || null,
      lastSignIn: u.metadata?.lastSignInTime || null,
    });
  }
  return out;
}

// role must be 'beta_tester' (grant) or null (revoke).
export async function setUserRole(uid, role) {
  const value = role === 'beta_tester' ? 'beta_tester' : null;
  await getAdminDb().collection('users').doc(uid)
    .set({ role: value, updatedAt: Date.now() }, { merge: true });
}
```

- [ ] **Step 6: Write the usage endpoint (both trees)**

Create `app/api/admin/usage+api.js`:

```javascript
import { verifyAdminRequest } from '../../../lib/admin/requireAdmin.js';
import { fetchUsage } from '../../../lib/admin/usage.js';

export async function GET(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const range = new URL(request.url).searchParams.get('range') || 'day';
  try {
    const data = await fetchUsage(range);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: 'usage_failed', message: e.message }, { status: 500 });
  }
}
```

Create `api/admin/usage.js`:

```javascript
import { verifyAdminRequest } from '../../lib/admin/requireAdmin.js';
import { fetchUsage } from '../../lib/admin/usage.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequest(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    const data = await fetchUsage(req.query.range || 'day');
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: 'usage_failed', message: e.message });
  }
}
```

- [ ] **Step 7: Write the users endpoint (both trees, GET=list / POST=set role)**

> Note: deviates from the spec's separate `/api/admin/users/role` path — folding the role mutation into `POST /api/admin/users` avoids duplicating two more handler files across both trees. Same behavior, fewer files.

Create `app/api/admin/users+api.js`:

```javascript
import { verifyAdminRequest } from '../../../lib/admin/requireAdmin.js';
import { listUsersWithRoles, setUserRole } from '../../../lib/admin/users.js';

export async function GET(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    return Response.json({ users: await listUsersWithRoles() });
  } catch (e) {
    return Response.json({ error: 'users_failed', message: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    const { uid, role } = await request.json();
    if (!uid) return Response.json({ error: 'uid_required' }, { status: 400 });
    await setUserRole(uid, role);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'set_role_failed', message: e.message }, { status: 500 });
  }
}
```

Create `api/admin/users.js`:

```javascript
import { verifyAdminRequest } from '../../lib/admin/requireAdmin.js';
import { listUsersWithRoles, setUserRole } from '../../lib/admin/users.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequest(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method === 'POST') {
    try {
      const { uid, role } = req.body || {};
      if (!uid) return res.status(400).json({ error: 'uid_required' });
      await setUserRole(uid, role);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'set_role_failed', message: e.message });
    }
  }
  try {
    return res.json({ users: await listUsersWithRoles() });
  } catch (e) {
    return res.status(500).json({ error: 'users_failed', message: e.message });
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/admin/usage.js lib/admin/users.js __tests__/usage-aggregate.mjs api/admin app/api/admin
git commit -m "feat: add admin usage + users API (logic and endpoints)"
```

---

### Task 7: Admin dashboard UI + Settings entry point

**Files:**
- Create: `services/adminApi.js`
- Create: `app/admin/index.js`
- Modify: `screens/SettingsScreen.js` (admin-only entry card)

**Interfaces:**
- Consumes: `useAuth` / `useIsAdmin` from `context/AuthContext.js`; `auth` from `services/firebase.js`; brand primitives from `components/brand/`; `COLORS`/`FONTS`/`RADII` from `constants/theme.js`.
- Produces: `getUsage(range)`, `getUsers()`, `setUserRole(uid, role)` in `services/adminApi.js` (all attach the Firebase ID token).

- [ ] **Step 1: Write the admin API client**

Create `services/adminApi.js`:

```javascript
import { auth } from './firebase';

async function authHeader() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getUsage(range = 'day') {
  const res = await fetch(`/api/admin/usage?range=${range}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`usage_${res.status}`);
  return res.json();
}

export async function getUsers() {
  const res = await fetch('/api/admin/users', { headers: await authHeader() });
  if (!res.ok) throw new Error(`users_${res.status}`);
  return (await res.json()).users;
}

export async function setUserRole(uid, role) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ uid, role }),
  });
  if (!res.ok) throw new Error(`set_role_${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Write the admin screen**

Create `app/admin/index.js`:

```javascript
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getUsage, getUsers, setUserRole } from '../../services/adminApi';
import ScreenBackground from '../../components/brand/ScreenBackground';
import Card from '../../components/brand/Card';
import SectionLabel from '../../components/brand/SectionLabel';
import { COLORS, FONTS, RADII } from '../../constants/theme';

const RANGES = ['day', 'week', 'month'];
const money = (n) => `$${(n || 0).toFixed(2)}`;

export default function AdminScreen() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const [range, setRange] = useState('day');
  const [usage, setUsage] = useState(null);
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace('/');
  }, [loading, user, isAdmin]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    getUsage(range).then(setUsage).catch((e) => setErr(e.message));
  }, [range, loading, isAdmin]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    getUsers().then(setUsers).catch((e) => setErr(e.message));
  }, [loading, isAdmin]);

  if (loading || !isAdmin) {
    return <ScreenBackground variant="paper"><View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View></ScreenBackground>;
  }

  async function toggleBeta(u) {
    const next = u.role === 'beta_tester' ? null : 'beta_tester';
    setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, role: next } : x)));
    try { await setUserRole(u.uid, next); } catch (e) { setErr(e.message); }
  }

  return (
    <ScreenBackground variant="paper">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Admin</Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <SectionLabel tone="cobalt">API USAGE</SectionLabel>
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable key={r} onPress={() => setRange(r)} style={[styles.chip, range === r && styles.chipActive]}>
              <Text style={[styles.chipText, range === r && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <Card>
          {!usage ? <ActivityIndicator color={COLORS.primary} /> : (
            <View>
              <Row label="Requests" value={String(usage.totals.requests)} />
              <Row label="Input tokens" value={usage.totals.inputTokens.toLocaleString()} />
              <Row label="Output tokens" value={usage.totals.outputTokens.toLocaleString()} />
              <Row label="Est. cost" value={money(usage.totals.estCost)} />
              <Text style={styles.subhead}>By model</Text>
              {Object.entries(usage.byModel).map(([m, b]) => <Row key={m} label={m} value={money(b.estCost)} />)}
              <Text style={styles.subhead}>By route</Text>
              {Object.entries(usage.byRoute).map(([r, b]) => <Row key={r} label={r} value={`${b.requests || (b.inputTokens + b.outputTokens > 0 ? '—' : 0)}`} />)}
            </View>
          )}
        </Card>

        <SectionLabel tone="cobalt">USER ADMINISTRATION</SectionLabel>
        <Card>
          {!users ? <ActivityIndicator color={COLORS.primary} /> : users.map((u) => (
            <View key={u.uid} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userEmail}>{u.email}</Text>
                <Text style={styles.userMeta}>{u.role || 'user'} · {u.status}</Text>
              </View>
              <Pressable onPress={() => toggleBeta(u)} style={[styles.betaBtn, u.role === 'beta_tester' && styles.betaBtnOn]}>
                <Text style={[styles.betaBtnText, u.role === 'beta_tester' && styles.betaBtnTextOn]}>
                  {u.role === 'beta_tester' ? 'Beta ✓' : 'Grant beta'}
                </Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </ScrollView>
    </ScreenBackground>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary, marginBottom: 4 },
  err: { color: COLORS.error, fontFamily: FONTS.bodyMedium },
  rangeRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: RADII.pill, backgroundColor: COLORS.surfaceAlt },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodySemiBold, color: COLORS.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.primaryText },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontFamily: FONTS.bodyMedium, color: COLORS.textSecondary },
  rowValue: { fontFamily: FONTS.bodyBold, color: COLORS.textPrimary },
  subhead: { fontFamily: FONTS.bodyBold, color: COLORS.textPrimary, marginTop: 12, marginBottom: 4 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  userEmail: { fontFamily: FONTS.bodySemiBold, color: COLORS.textPrimary },
  userMeta: { fontFamily: FONTS.body, color: COLORS.textMuted, fontSize: 12 },
  betaBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADII.pill, backgroundColor: COLORS.surfaceAlt },
  betaBtnOn: { backgroundColor: COLORS.primary },
  betaBtnText: { fontFamily: FONTS.bodySemiBold, color: COLORS.textSecondary, fontSize: 13 },
  betaBtnTextOn: { color: COLORS.primaryText },
});
```

> Token names above are verified against `constants/theme.js`: `FONTS.{display,body,bodyMedium,bodySemiBold,bodyBold}`, `COLORS.{surfaceAlt,primaryText,textMuted,textSecondary,textPrimary,primary,error}`, `RADII.pill`. Do not introduce new tokens or hardcoded hex.

- [ ] **Step 3: Add the admin-only entry point in Settings**

In `screens/SettingsScreen.js`: import `useRouter` from `expo-router` and add `isAdmin` to the existing `useAuth()` destructure. Near the top of the settings list, render an admin-only card (place it consistently with existing card styling in that file):

```javascript
{isAdmin && (
  <Pressable onPress={() => router.push('/admin')} style={/* reuse the file's existing card/row style */}>
    <Text style={/* existing card title style */}>Admin Dashboard</Text>
    <Text style={/* existing card subtitle/muted style */}>API usage & user administration</Text>
  </Pressable>
)}
```

Match the surrounding components' style objects already defined in `SettingsScreen.js` (do not invent new styles or hex). Ensure `Pressable` and `useRouter` are imported.

- [ ] **Step 4: Manual acceptance**

Run: `npx expo start --web`
Checks:
1. Signed in as a non-admin → no "Admin Dashboard" card in Settings; navigating to `/admin` directly redirects to home.
2. Signed in as `webgenerations77@gmail.com` → card appears; `/admin` loads.
3. API Usage card shows totals for the selected range and updates when switching day/week/month (requires `FIREBASE_*` env set locally; otherwise expect a 500 surfaced as the error line — that is correct unconfigured behavior).
4. User list renders; toggling "Grant beta" flips the label and persists on reload.

Expected: gate works both directions; sections render with brand styling.

- [ ] **Step 5: Commit**

```bash
git add services/adminApi.js app/admin/index.js screens/SettingsScreen.js
git commit -m "feat: add admin dashboard UI and admin-only Settings entry"
```

---

## Notes for the implementer

- **Deploy dependency:** the admin API endpoints return 500 (`admin_unconfigured`) until `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` are set in `.env` locally and in Vercel. The UI, gate, and all unit tests pass without them. Firestore must be enabled on the Firebase project (collections `users`, `apiUsage` are created on first write).
- **Vercel:** confirm `.npmrc` keeps `legacy-peer-deps=true` (per project deploy history) so `firebase-admin` installs in CI. Verify the live build after merge — a failed build silently freezes prod.
- **Run all unit tests before finishing:** `for f in firebase-admin-key admin-util roles-resolve require-admin usage-cost usage-aggregate; do node __tests__/$f.mjs || break; done`
```
