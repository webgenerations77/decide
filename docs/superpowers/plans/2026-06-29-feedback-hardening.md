# /api/feedback Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight, zero-infra abuse protection to `/api/feedback`, make the Resend sender configurable, and hide the BetaBanner on `/beta-guide`.

**Architecture:** All gating logic (secret gate, length caps, best-effort rate limit) lives in the shared `api/feedbackEmail.js` module so both handlers — `api/feedback.js` (Vercel/prod) and `app/api/feedback+api.js` (Expo) — inherit identical behavior. Each handler reads headers/IP using its own request shape and translates failures to HTTP 401/429. The client attaches the secret header. Sender becomes an env override.

**Tech Stack:** Node (ESM) serverless handlers, Resend SDK, Expo SDK 56 / expo-router, React Native.

## Global Constraints

- Expo SDK 56 — reference https://docs.expo.dev/versions/v56.0.0/ before writing app code.
- All npm installs use `--legacy-peer-deps` (none needed in this plan — no new deps).
- Client env vars MUST use the `EXPO_PUBLIC_` prefix; server-only vars must NOT.
- No hardcoded hex / no `fontWeight` beside `fontFamily: FONTS.*` (token discipline) — only the JSX-condition change in `_layout.js` touches a component here, no new styles.
- User-facing strings say "Cheddar", never "AI".
- No RN test runner exists. Verification = a throwaway Node smoke script (Task 1) + `npx expo export --platform web` clean build.
- Secret gate must **fail open** when `FEEDBACK_SHARED_SECRET` is unset (keeps dev/beta working).
- Rate limit is **best-effort / per-warm-instance** — comment it honestly, don't oversell it.

---

### Task 1: Harden the shared feedback module (`feedbackEmail.js`)

**Files:**
- Modify: `api/feedbackEmail.js` (whole file rewrite — caps in `validateFeedback`, two new exports, configurable sender, unverified-sender label)
- Test: throwaway Node script in scratch (not committed)

**Interfaces:**
- Consumes: nothing new.
- Produces (imported by Task 2 handlers):
  - `validateFeedback(body) -> { ok: true, data } | { ok: false, error }` (unchanged signature; adds length-cap rejections)
  - `gateFeedbackRequest(secretHeader) -> { ok: boolean }`
  - `checkFeedbackRate(key) -> { ok: boolean, limited?: true }`
  - `sendFeedbackEmail(data) -> Promise<void>` (unchanged signature)

- [ ] **Step 1: Rewrite `api/feedbackEmail.js`**

```js
import { Resend } from 'resend';

const MAX = { message: 4000, field: 200 };

// Validates a feedback payload. Returns { ok:true, data } or { ok:false, error }.
// Over-cap fields are REJECTED (not truncated) so garbage never reaches Resend.
export function validateFeedback(body = {}) {
  const {
    page = '', feedbackType = '', message = '',
    rating = null, userEmail = '', userName = '', timestamp = '',
  } = body;

  const msg = String(message ?? '');
  if (!msg.trim()) return { ok: false, error: 'message is required' };
  if (msg.length > MAX.message) return { ok: false, error: 'message too long' };

  for (const [k, v] of Object.entries({ page, feedbackType, userEmail, userName, timestamp })) {
    if (String(v ?? '').length > MAX.field) return { ok: false, error: `${k} too long` };
  }

  const email = String(userEmail ?? '');
  return {
    ok: true,
    data: {
      page: String(page) || 'unknown',
      feedbackType: String(feedbackType) || 'General Impression',
      message: msg.trim(),
      rating: rating || null,
      userEmail: email,
      userName: String(userName) || (email.split('@')[0] || 'a beta tester'),
      timestamp: String(timestamp) || new Date().toISOString(),
    },
  };
}

// Shared-secret gate. FAILS OPEN when FEEDBACK_SHARED_SECRET is unset (keeps dev/beta working).
// NOTE: the client's copy of this secret ships in the EXPO_PUBLIC bundle and is extractable —
// this raises the bar against casual abuse, it is NOT cryptographic protection.
export function gateFeedbackRequest(secretHeader) {
  const expected = process.env.FEEDBACK_SHARED_SECRET;
  if (!expected) return { ok: true };
  return { ok: secretHeader === expected };
}

// Best-effort in-memory rate limit: 5 sends / 10 min per key. State lives only within a warm
// serverless instance (resets on cold start) — it stops obvious tight-loop spam, not a
// distributed attacker. When the shared secret is set, all clients share one key/bucket.
const RATE = { max: 5, windowMs: 10 * 60 * 1000 };
const hits = new Map();

export function checkFeedbackRate(key = 'anon') {
  const now = Date.now();
  const fresh = (hits.get(key) || []).filter((t) => now - t < RATE.windowMs);
  if (fresh.length >= RATE.max) {
    hits.set(key, fresh);
    return { ok: false, limited: true };
  }
  fresh.push(now);
  hits.set(key, fresh);
  return { ok: true };
}

// Sends the feedback email via Resend. Throws on misconfig or send failure.
export async function sendFeedbackEmail(data) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_RECIPIENT_EMAIL;
  if (!apiKey || !to) throw new Error('RESEND_API_KEY and FEEDBACK_RECIPIENT_EMAIL must be set');

  // Configurable verified-domain sender; falls back to the Resend sandbox address.
  const from = process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev';

  const resend = new Resend(apiKey);
  const ratingLine = data.rating ? `Rating: ${data.rating}/5\n` : '';
  const subject = `🧪 Beta Feedback — ${data.feedbackType} on ${data.page}`;
  // Email/name are client-supplied with no server-side identity — label them unverified.
  const text =
    `New feedback from ${data.userName} (claimed: ${data.userEmail || 'no email'} — unverified)\n\n` +
    `Page: ${data.page}\n` +
    `Type: ${data.feedbackType}\n` +
    ratingLine +
    `Submitted: ${data.timestamp}\n\n` +
    `---\n${data.message}\n`;

  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) throw new Error(error.message || 'Resend send failed');
}
```

- [ ] **Step 2: Write a throwaway Node smoke test in scratch**

Create `C:\Users\webge\AppData\Local\Temp\claude\C--Users-webge-OneDrive-Desktop-Decide\7e6face7-95a2-4da1-9a11-cdeda725db18\scratchpad\feedback-smoke.mjs`:

```js
import { validateFeedback, gateFeedbackRequest, checkFeedbackRate } from '../../../../../OneDrive/Desktop/Decide/decide-app/api/feedbackEmail.js';

let fails = 0;
const ok = (cond, label) => { if (!cond) { fails++; console.error('FAIL:', label); } else console.log('pass:', label); };

// validateFeedback
ok(validateFeedback({}).ok === false, 'empty body rejected (message required)');
ok(validateFeedback({ message: '   ' }).ok === false, 'whitespace message rejected');
ok(validateFeedback({ message: 'x'.repeat(4001) }).error === 'message too long', 'over-cap message rejected');
ok(validateFeedback({ message: 'hi', page: 'p'.repeat(201) }).error === 'page too long', 'over-cap page rejected');
const v = validateFeedback({ message: ' hi ', userEmail: 'a@b.com' });
ok(v.ok && v.data.message === 'hi' && v.data.userName === 'a', 'valid payload trims + derives name');

// gateFeedbackRequest — fail open
delete process.env.FEEDBACK_SHARED_SECRET;
ok(gateFeedbackRequest(undefined).ok === true, 'gate open when secret unset');
process.env.FEEDBACK_SHARED_SECRET = 'sekret';
ok(gateFeedbackRequest('sekret').ok === true, 'gate passes matching secret');
ok(gateFeedbackRequest('nope').ok === false, 'gate rejects wrong secret');
ok(gateFeedbackRequest(undefined).ok === false, 'gate rejects missing secret');

// checkFeedbackRate — 5 allowed, 6th blocked
const key = 'test';
let allowed = 0;
for (let i = 0; i < 6; i++) if (checkFeedbackRate(key).ok) allowed++;
ok(allowed === 5, `rate limit allows 5 then blocks (got ${allowed})`);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
```

- [ ] **Step 3: Run the smoke test — expect it to FAIL first (module not yet rewritten if running out of order; otherwise confirms)**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && node "$SCRATCH/feedback-smoke.mjs"` (substitute the scratch path above for `$SCRATCH`).
Expected after Step 1: `ALL PASS`. If any line FAILs, fix `feedbackEmail.js` and rerun.

- [ ] **Step 4: Commit**

```bash
git add api/feedbackEmail.js
git commit -m "feat: harden feedback module — secret gate, length caps, rate limit, configurable sender"
```

---

### Task 2: Wire gating into both handlers

**Files:**
- Modify: `api/feedback.js` (whole file)
- Modify: `app/api/feedback+api.js` (whole file)

**Interfaces:**
- Consumes from Task 1: `gateFeedbackRequest`, `checkFeedbackRate`, `validateFeedback`, `sendFeedbackEmail`.
- Produces: HTTP behavior — `401` on bad secret, `429` on rate limit, `400` on invalid body, `200 {success:true}` on send, `500` on send failure.

- [ ] **Step 1: Rewrite `api/feedback.js` (Vercel `req`/`res` shape)**

```js
import {
  validateFeedback, sendFeedbackEmail, gateFeedbackRequest, checkFeedbackRate,
} from './feedbackEmail.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json({ status: 'ok', message: 'Feedback API is running' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const secret = req.headers['x-feedback-secret'];
  if (!gateFeedbackRequest(secret).ok) return res.status(401).json({ success: false, error: 'unauthorized' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  const rateKey = process.env.FEEDBACK_SHARED_SECRET ? `s:${secret}` : `ip:${ip}`;
  if (!checkFeedbackRate(rateKey).ok) return res.status(429).json({ success: false, error: 'rate limited' });

  const { ok, data, error } = validateFeedback(req.body);
  if (!ok) return res.status(400).json({ success: false, error });

  try {
    await sendFeedbackEmail(data);
    return res.json({ success: true });
  } catch (e) {
    console.error('[feedback] send failed:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
```

- [ ] **Step 2: Rewrite `app/api/feedback+api.js` (Expo `Request` shape)**

```js
import {
  validateFeedback, sendFeedbackEmail, gateFeedbackRequest, checkFeedbackRate,
} from '../../api/feedbackEmail.js';

export async function POST(request) {
  const secret = request.headers.get('x-feedback-secret');
  if (!gateFeedbackRequest(secret).ok) {
    return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  const rateKey = process.env.FEEDBACK_SHARED_SECRET ? `s:${secret}` : `ip:${ip}`;
  if (!checkFeedbackRate(rateKey).ok) {
    return Response.json({ success: false, error: 'rate limited' }, { status: 429 });
  }

  let body = {};
  try { body = await request.json(); } catch {}

  const { ok, data, error } = validateFeedback(body);
  if (!ok) return Response.json({ success: false, error }, { status: 400 });

  try {
    await sendFeedbackEmail(data);
    return Response.json({ success: true });
  } catch (e) {
    console.error('[feedback] send failed:', e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && npx expo export --platform web`
Expected: completes with no errors (the `app/api/*` route compiles).

- [ ] **Step 4: Commit**

```bash
git add api/feedback.js app/api/feedback+api.js
git commit -m "feat: gate /api/feedback handlers with secret + rate limit"
```

---

### Task 3: Send the secret header from the client

**Files:**
- Modify: `services/feedbackService.js:13-23` (build a headers object, attach secret when present)

**Interfaces:**
- Consumes: `process.env.EXPO_PUBLIC_FEEDBACK_SHARED_SECRET` (added to env in Task 5).
- Produces: POST now includes `x-feedback-secret` header when the env var is set.

- [ ] **Step 1: Replace the `fetch` call's header construction in `submitFeedback`**

Change the existing block:

```js
    const res = await fetch(`${getApiBase()}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
```

to:

```js
    const headers = { 'Content-Type': 'application/json' };
    // Shared secret raises the bar on the open endpoint. EXPO_PUBLIC vars are bundle-extractable,
    // so this is best-effort, not a true secret. Blank env var → header omitted (gate fails open).
    const secret = process.env.EXPO_PUBLIC_FEEDBACK_SHARED_SECRET;
    if (secret) headers['x-feedback-secret'] = secret;
    const res = await fetch(`${getApiBase()}/api/feedback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && npx expo export --platform web`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add services/feedbackService.js
git commit -m "feat: send x-feedback-secret header from client"
```

---

### Task 4: Hide BetaBanner on `/beta-guide`

**Files:**
- Modify: `app/_layout.js:136` (add route exclusion to the banner condition)

**Interfaces:**
- Consumes: existing `showBeta`, `pathname`, `betaBannerDismissed` in scope.
- Produces: banner no longer renders on `/beta-guide` (matches the feedback button on line 139).

- [ ] **Step 1: Edit the banner render condition**

Change:

```js
      {showBeta && !betaBannerDismissed && (
        <BetaBanner onDismiss={() => setBetaBannerDismissed(true)} topOffset={demoMode ? 32 : 0} />
      )}
```

to:

```js
      {showBeta && pathname !== '/beta-guide' && !betaBannerDismissed && (
        <BetaBanner onDismiss={() => setBetaBannerDismissed(true)} topOffset={demoMode ? 32 : 0} />
      )}
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && npx expo export --platform web`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.js
git commit -m "feat: hide beta banner on /beta-guide"
```

---

### Task 5: Add env vars (`.env`, `.env.example`, `decide.env.txt`)

**Files:**
- Modify: `.env` (after line 22)
- Modify: `.env.example` (server section after line 14; client section after line 25)
- Modify: `../decide.env.txt` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: the four env vars referenced by Tasks 1–3 are documented and present (blank) so the gate stays disabled until the user fills them in.

- [ ] **Step 1: Append to `.env` after line 22 (`FEEDBACK_RECIPIENT_EMAIL=...`)**

```
# Verified-domain sender (e.g. feedback@yourdomain.com). Blank = Resend sandbox.
FEEDBACK_FROM_EMAIL=
# Shared secret gating /api/feedback. Blank = gate disabled (open endpoint).
FEEDBACK_SHARED_SECRET=
# Client copy of the gate secret — must match FEEDBACK_SHARED_SECRET. Blank = no header sent.
EXPO_PUBLIC_FEEDBACK_SHARED_SECRET=
```

- [ ] **Step 2: Edit `.env.example` — append to the server-side section (after line 14, `FEEDBACK_RECIPIENT_EMAIL=`)**

```
# Verified-domain sender for feedback emails (e.g. feedback@yourdomain.com).
# Leave blank to use the Resend sandbox (onboarding@resend.dev — only delivers to the Resend
# account owner). To switch: verify a domain at resend.com → Domains, add the DNS records, then
# set this to feedback@<your-verified-domain> in Vercel env + local .env. No code change needed.
FEEDBACK_FROM_EMAIL=
# Shared secret gating /api/feedback. Leave BLANK to disable the gate (open endpoint).
# When set, the client must send the same value — see EXPO_PUBLIC_FEEDBACK_SHARED_SECRET below.
FEEDBACK_SHARED_SECRET=
```

- [ ] **Step 3: Edit `.env.example` — append to the client-side section (after line 25, `EXPO_PUBLIC_OPENROUTE_API_KEY=`)**

```
# Must match FEEDBACK_SHARED_SECRET. Sent as the x-feedback-secret header on feedback POSTs.
# NOTE: EXPO_PUBLIC vars are baked into the app bundle and extractable — this raises the bar
# against casual abuse, it is not a true secret. Blank = no header sent (gate stays open).
EXPO_PUBLIC_FEEDBACK_SHARED_SECRET=
```

- [ ] **Step 4: Append to `../decide.env.txt`**

```
# Verified-domain sender for feedback emails — blank = Resend sandbox
FEEDBACK_FROM_EMAIL=
# Shared secret gating /api/feedback — blank = gate disabled
FEEDBACK_SHARED_SECRET=
# Client copy of the gate secret (EXPO_PUBLIC) — must match FEEDBACK_SHARED_SECRET
EXPO_PUBLIC_FEEDBACK_SHARED_SECRET=
```

- [ ] **Step 5: Commit**

```bash
git add .env.example ../decide.env.txt
git commit -m "docs: document feedback gating + sender env vars"
```

Note: `.env` and `decide.env.txt` are gitignored / outside the repo respectively — only `.env.example` is committed. The `git add ../decide.env.txt` will no-op if it's outside the repo; that's expected. Confirm with `git status` before committing.

---

### Task 6: Final verification & audit

**Files:** none (verification only).

- [ ] **Step 1: Clean build**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && npx expo export --platform web`
Expected: completes with no errors.

- [ ] **Step 2: Re-run the Task 1 smoke test**

Run: `node "$SCRATCH/feedback-smoke.mjs"` → expect `ALL PASS`.

- [ ] **Step 3: Grep audit for leftover sandbox hardcode and "AI" strings**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && grep -rn "onboarding@resend.dev" api/ && grep -rni "\\bAI\\b" components/BetaBanner.js services/feedbackService.js`
Expected: `onboarding@resend.dev` appears ONLY as the fallback in `feedbackEmail.js`; no user-facing "AI" strings.

- [ ] **Step 4: Confirm gate fail-open behavior is intact**

Manually confirm: with `FEEDBACK_SHARED_SECRET` blank in `.env`, `gateFeedbackRequest` returns `{ ok: true }` (Task 1 smoke test already covers this). This means the current beta keeps working with no secret set.

- [ ] **Step 5: No commit** — verification only. If anything fails, return to the relevant task.

---

## Self-Review

**Spec coverage:**
- Part 1 secret gate → Task 1 (1a) + Task 2 wiring + Task 3 client header. ✓
- Part 1 length caps → Task 1 (1b). ✓
- Part 1 rate limit → Task 1 (1c) + Task 2 wiring. ✓
- Part 1 unverified-sender label → Task 1 `sendFeedbackEmail`. ✓
- Part 2 configurable sender → Task 1 `from` + Task 5 env. ✓
- Part 3 hide banner → Task 4. ✓
- Env additions (.env/.env.example/decide.env.txt) → Task 5. ✓
- Verification (build + smoke) → Tasks 1, 2, 3, 4, 6. ✓
- Collective-bucket caveat → commented in Task 1 `checkFeedbackRate`. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type consistency:** `gateFeedbackRequest(secretHeader) -> {ok}`, `checkFeedbackRate(key) -> {ok, limited?}`, `validateFeedback(body) -> {ok, data?, error?}` used identically in Task 1 definitions and Task 2 call sites. Header name `x-feedback-secret` consistent across Tasks 2 (read) and 3 (write). Env var names `FEEDBACK_SHARED_SECRET` / `EXPO_PUBLIC_FEEDBACK_SHARED_SECRET` / `FEEDBACK_FROM_EMAIL` consistent across Tasks 1, 2, 3, 5. ✓
