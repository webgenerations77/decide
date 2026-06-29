# Beta Tester Access + Feedback System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one authorized beta tester (`dwaynephil@gmail.com`, role `beta_tester`) plus a beta banner, a floating feedback button/modal, a `/api/feedback` endpoint that emails submissions via Resend, and an in-app beta guide ("wiki").

**Architecture:** Role derives from auth via a single allowlist + helper, surfaced on `AuthContext`. Beta UI (banner, feedback button) renders in the app shell (`app/_layout.js`) gated by `isBetaTester` + route. Feedback posts to a Vercel function (`api/feedback.js`, the prod path) mirrored as an Expo route, which sends email through Resend. The guide is a brand-styled screen, auto-shown once then reachable from Settings.

**Tech Stack:** Expo SDK 56, expo-router, Firebase Auth, React Native, Resend (Node SDK), Vercel serverless functions.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-29-beta-tester-feedback-design.md` (Appendix A = guide copy).
- **No unit-test runner exists.** Verify each task with `npx expo export --platform web` (expect a final `Exported: dist` line, no errors) plus the manual/curl check named in the task. Do NOT add jest.
- **Token discipline:** no raw hex in components — all colors come from `constants/theme.js`.
- **Fonts:** use `FONTS.*` variants; never set `fontWeight` alongside `fontFamily: FONTS.*`.
- **Naming:** all user-facing copy says **"Cheddar"**, never "AI" / "artificial intelligence".
- **Role-based, not email-based:** no component may compare against an email literal — only `isBetaTester(user)` / `useAuth().isBetaTester`. The email lives solely in `constants/betaTesters.js`.
- **npm installs:** always `--legacy-peer-deps`.
- **Email is server-side only:** `RESEND_API_KEY` / `FEEDBACK_RECIPIENT_EMAIL` have NO `EXPO_PUBLIC_` prefix.
- **Branch:** do this work on `feat/beta-tester-feedback` off `main`; one commit per task.

---

### Task 1: Role plumbing (allowlist + helper + context)

**Files:**
- Create: `constants/betaTesters.js`
- Create: `utils/betaTester.js`
- Modify: `context/AuthContext.js` (add role/isBetaTester to context value)

**Interfaces:**
- Produces: `BETA_TESTERS` (object, lowercased email → role string); `getRole(user) → string|null`; `isBetaTester(user) → boolean`; `useAuth()` value gains `role: string|null` and `isBetaTester: boolean`.

- [ ] **Step 1: Create the allowlist**

`constants/betaTesters.js`:

```js
// Authorized beta testers, keyed by LOWERCASED email → role.
// Add a tester by adding one line here. All gating is role-based (see utils/betaTester.js);
// never compare against an email literal anywhere else in the app.
export const BETA_TESTERS = {
  'dwaynephil@gmail.com': 'beta_tester',
};
```

- [ ] **Step 2: Create the helper**

`utils/betaTester.js`:

```js
import { BETA_TESTERS } from '../constants/betaTesters';

// Beta role for a Firebase user, or null. Email match is lowercased + trimmed.
export function getRole(user) {
  const email = user?.email?.toLowerCase?.().trim();
  if (!email) return null;
  return BETA_TESTERS[email] || null;
}

export function isBetaTester(user) {
  return getRole(user) === 'beta_tester';
}
```

- [ ] **Step 3: Surface role on the auth context**

In `context/AuthContext.js`, add the import after the existing `authService` import (line 2):

```js
import { getRole, isBetaTester } from '../utils/betaTester';
```

Replace the `value` object (currently line 18):

```js
  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    role: getRole(user),
    isBetaTester: isBetaTester(user),
  };
```

- [ ] **Step 4: Verify build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors. (Confirms the new modules import cleanly.)

- [ ] **Step 5: Commit**

```bash
git add constants/betaTesters.js utils/betaTester.js context/AuthContext.js
git commit -m "feat: add dwaynephil@gmail.com as authorized beta tester"
```

---

### Task 2: Beta banner + theme token + shell gating

**Files:**
- Modify: `constants/theme.js` (add `COLORS.beta`)
- Create: `utils/betaRoutes.js`
- Create: `components/BetaBanner.js`
- Modify: `app/_layout.js` (render gated banner, stacking, imports)

**Interfaces:**
- Consumes: `useAuth().isBetaTester` (Task 1).
- Produces: `COLORS.beta`; `isPublicRoute(pathname) → boolean`; `<BetaBanner onDismiss topOffset />` default export. Shell computes `showBeta = isBetaTester && !isPublicRoute(pathname)` (later tasks reuse this gate concept).

- [ ] **Step 1: Add the beta color token**

In `constants/theme.js`, in the "Accent" block, add a line after `gold` / `goldText` (after the `goldText` line):

```js
  beta:       '#7C3AED',   // violet — beta-tester banner/badge (distinct from gold warning & cobalt primary; ~5.7:1 with white text)
```

- [ ] **Step 2: Create the public-route helper**

`utils/betaRoutes.js`:

```js
// Routes where beta UI (banner, feedback button) must NOT appear.
// A beta tester is authenticated, so we gate on the route, not just auth.
const PUBLIC_PREFIXES = ['/auth', '/onboarding', '/terms'];

export function isPublicRoute(pathname) {
  if (!pathname) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
```

- [ ] **Step 3: Create the banner component**

`components/BetaBanner.js` (mirrors the existing `DemoBanner` pattern in `app/_layout.js`):

```js
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../constants/theme';

// Persistent beta banner. `topOffset` stacks it below the demo banner when both show.
export default function BetaBanner({ onDismiss, topOffset = 0 }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.banner, { top: insets.top + topOffset }]} pointerEvents="box-none">
      <View style={styles.side} />
      <Text style={styles.text} numberOfLines={2}>
        🧪 You're a Cheddar Beta Tester — thanks for helping us build something great!
      </Text>
      <TouchableOpacity
        style={styles.side}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text style={styles.x}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', left: 0, right: 0,
    minHeight: 32, zIndex: 9998, elevation: 19,
    backgroundColor: COLORS.beta,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
  },
  side: { width: 28, alignItems: 'flex-end', justifyContent: 'center' },
  text: { flex: 1, fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.white, textAlign: 'center' },
  x:    { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.white },
});
```

- [ ] **Step 4: Wire the banner into the shell**

In `app/_layout.js`:

(a) Add imports. Update the expo-router import (line 3) to include `usePathname`:

```js
import { Stack, useRouter, usePathname } from 'expo-router';
```

After the `OfflineBanner` import (line 26) add:

```js
import BetaBanner from '../components/BetaBanner';
import { isPublicRoute } from '../utils/betaRoutes';
```

(b) In `RootLayoutInner`, extend the auth destructure (line 64) and add pathname + dismiss state. Replace line 64:

```js
  const { user, loading: authLoading, isBetaTester } = useAuth();
  const pathname = usePathname();
  const [betaBannerDismissed, setBetaBannerDismissed] = useState(false);
```

(c) Just before the `return (` in `RootLayoutInner` (the one rendering `<Stack/>`, around line 112), add:

```js
  const showBeta = isBetaTester && !isPublicRoute(pathname);
```

(d) In that returned fragment, add the beta banner right after the `{demoMode && <DemoBanner .../>}` line:

```jsx
      {showBeta && !betaBannerDismissed && (
        <BetaBanner onDismiss={() => setBetaBannerDismissed(true)} topOffset={demoMode ? 32 : 0} />
      )}
```

- [ ] **Step 5: Verify build**

Run: `npx expo export --platform web`
Expected: `Exported: dist`, no errors.

- [ ] **Step 6: Manual check**

Run `npx expo start --web`. Sign in as `dwaynephil@gmail.com` → the violet beta banner shows at the top on the Plan/Spin/History tabs and dismisses with ✕ (returns after reload). It is absent on `/auth/login`. (Full non-beta check happens in Task 6.)

- [ ] **Step 7: Commit**

```bash
git add constants/theme.js utils/betaRoutes.js components/BetaBanner.js app/_layout.js
git commit -m "feat: add beta tester banner to app shell"
```

---

### Task 3: Floating feedback button + modal + client service

**Files:**
- Create: `services/feedbackService.js`
- Create: `components/BetaFeedback.js`
- Modify: `app/_layout.js` (render the gated feedback button)

**Interfaces:**
- Consumes: `useAuth()` (`user`, from Task 1), `showBeta` gate (Task 2).
- Produces: `submitFeedback({ page, feedbackType, message, rating, userEmail, userName }) → Promise<{ success, error? }>`; `<BetaFeedback />` default export (self-contained button + modal + toast).

- [ ] **Step 1: Create the client service**

`services/feedbackService.js` (same `getApiBase()` pattern as `services/itineraryService.js`):

```js
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getApiBase() {
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:8081`;
  return 'http://localhost:8081';
}

// Posts feedback to /api/feedback. Resolves to { success } or { success:false, error }.
export async function submitFeedback({ page, feedbackType, message, rating, userEmail, userName }) {
  try {
    const res = await fetch(`${getApiBase()}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page, feedbackType, message,
        rating: rating || null,
        userEmail, userName,
        timestamp: new Date().toISOString(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `Failed (${res.status})` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
```

- [ ] **Step 2: Create the feedback button + modal component**

`components/BetaFeedback.js`:

```js
import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { submitFeedback } from '../services/feedbackService';
import CTAButton from './brand/CTAButton';
import { COLORS, FONTS, RADII } from '../constants/theme';

const TYPES = ['Bug Report', 'Feature Suggestion', 'General Impression', 'Something Felt Off'];

function firstName(user) {
  const n = user?.displayName?.trim().split(/\s+/)[0];
  return n || 'friend';
}

export default function BetaFeedback() {
  const pathname = usePathname();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(pathname);
  const [type, setType] = useState(TYPES[0]);
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'success' | 'error', text }

  const openModal = () => { setPage(pathname); setOpen(true); };

  const onSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    const res = await submitFeedback({
      page,
      feedbackType: type,
      message: message.trim(),
      rating,
      userEmail: user?.email || '',
      userName: firstName(user),
    });
    setSubmitting(false);
    if (res.success) {
      setOpen(false);
      setMessage(''); setRating(0); setType(TYPES[0]);
      setToast({ kind: 'success', text: `Feedback sent! Thanks ${firstName(user)} 🙌` });
    } else {
      setToast({ kind: 'error', text: "Hmm, that didn't go through. Try again?" });
    }
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={openModal}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>💬 Give Feedback</Text>
      </TouchableOpacity>

      {toast && (
        <View
          style={[styles.toast, { bottom: 92 + insets.bottom }, toast.kind === 'error' && styles.toastError]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Give Feedback</Text>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.close}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>PAGE / FEATURE</Text>
              <TextInput
                style={styles.input} value={page} onChangeText={setPage}
                placeholder="Which screen?" placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>FEEDBACK TYPE</Text>
              <View style={styles.pillRow}>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t} onPress={() => setType(t)}
                    style={[styles.pill, type === t && styles.pillActive]} activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>YOUR FEEDBACK</Text>
              <TextInput
                style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage}
                placeholder="Tell us what you're thinking..." placeholderTextColor={COLORS.textMuted}
                multiline numberOfLines={4} textAlignVertical="top"
              />

              <Text style={styles.label}>RATING (OPTIONAL)</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n} onPress={() => setRating(n === rating ? 0 : n)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.star}>{n <= rating ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <CTAButton
                title="Send to Cheddar HQ" variant="cobalt" onPress={onSubmit}
                loading={submitting} disabled={!message.trim() || submitting} style={{ marginTop: 6 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 24, zIndex: 9997, elevation: 18,
    backgroundColor: COLORS.primary, borderRadius: RADII.pill,
    paddingHorizontal: 18, paddingVertical: 12,
    ...({ shadowColor: COLORS.navy, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }),
  },
  fabText: { color: COLORS.white, fontFamily: FONTS.bodyBold, fontSize: 14 },

  toast: {
    position: 'absolute', left: 20, right: 20, zIndex: 9999, elevation: 22,
    backgroundColor: COLORS.navy, borderRadius: RADII.md, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastError: { backgroundColor: COLORS.error },
  toastText: { color: COLORS.white, fontFamily: FONTS.bodySemiBold, fontSize: 13, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: RADII.lg, borderTopRightRadius: RADII.lg,
    maxHeight: '88%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 20, fontFamily: FONTS.displayHeavy, color: COLORS.textPrimary },
  close: { fontSize: 18, fontFamily: FONTS.bodyBold, color: COLORS.textMuted },

  label: { fontSize: 10, fontFamily: FONTS.monoBold, color: COLORS.goldText, letterSpacing: 1.5, textTransform: 'uppercase' },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADII.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, height: 48, fontSize: 15, color: COLORS.textPrimary, fontFamily: FONTS.body,
  },
  textarea: { height: 110, paddingTop: 12 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.textSecondary },
  pillTextActive: { color: COLORS.primaryText },

  starRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 28, color: COLORS.gold },
});
```

- [ ] **Step 3: Render the button in the shell (route-gated)**

In `app/_layout.js`, add the import after the `BetaBanner` import:

```js
import BetaFeedback from '../components/BetaFeedback';
```

In the returned fragment of `RootLayoutInner`, right after the `{showBeta && !betaBannerDismissed && ...}` block, add (hidden on the guide screen so first-read stays clean):

```jsx
      {showBeta && pathname !== '/beta-guide' && <BetaFeedback />}
```

- [ ] **Step 4: Verify build**

Run: `npx expo export --platform web`
Expected: `Exported: dist`, no errors.

- [ ] **Step 5: Manual check**

`npx expo start --web`, signed in as the beta email: the "💬 Give Feedback" pill shows bottom-right on app routes; tapping opens the modal; the submit button is disabled until the message field has text. (Email delivery is verified in Task 4.)

- [ ] **Step 6: Commit**

```bash
git add services/feedbackService.js components/BetaFeedback.js app/_layout.js
git commit -m "feat: add floating beta feedback button and modal"
```

---

### Task 4: `/api/feedback` endpoint + Resend email + env

**Files:**
- Create: `api/feedbackEmail.js` (shared validate + send, imported by both handlers)
- Create: `api/feedback.js` (Vercel `(req,res)` handler — prod)
- Create: `app/api/feedback+api.js` (Expo `POST(request)` handler — dev parity)
- Modify: `.env`, `.env.example`, `../decide.env.txt`
- Modify: `package.json` / lockfile (`resend`)

**Interfaces:**
- Consumes: `submitFeedback` POST body `{ page, feedbackType, message, rating, userEmail, userName, timestamp }` (Task 3).
- Produces: `validateFeedback(body) → { ok, data } | { ok:false, error }`; `sendFeedbackEmail(data) → Promise<void>` (throws on failure). Both handlers respond `{ success:true }` (200) or `{ success:false, error }` (400/500).

- [ ] **Step 1: Install Resend**

Run: `npm install resend --legacy-peer-deps`
Expected: `resend` appears in `package.json` dependencies.

- [ ] **Step 2: Create the shared email module**

`api/feedbackEmail.js`:

```js
import { Resend } from 'resend';

// Validates a feedback payload. Returns { ok:true, data } or { ok:false, error }.
export function validateFeedback(body = {}) {
  const {
    page = '', feedbackType = '', message = '',
    rating = null, userEmail = '', userName = '', timestamp = '',
  } = body;
  if (!message || !message.trim()) return { ok: false, error: 'message is required' };
  return {
    ok: true,
    data: {
      page: page || 'unknown',
      feedbackType: feedbackType || 'General Impression',
      message: message.trim(),
      rating: rating || null,
      userEmail,
      userName: userName || (userEmail.split('@')[0] || 'a beta tester'),
      timestamp: timestamp || new Date().toISOString(),
    },
  };
}

// Sends the feedback email via Resend. Throws on misconfig or send failure.
export async function sendFeedbackEmail(data) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_RECIPIENT_EMAIL;
  if (!apiKey || !to) throw new Error('RESEND_API_KEY and FEEDBACK_RECIPIENT_EMAIL must be set');

  const resend = new Resend(apiKey);
  const ratingLine = data.rating ? `Rating: ${data.rating}/5\n` : '';
  const subject = `🧪 Beta Feedback — ${data.feedbackType} on ${data.page}`;
  const text =
    `New feedback from ${data.userName} (${data.userEmail})\n\n` +
    `Page: ${data.page}\n` +
    `Type: ${data.feedbackType}\n` +
    ratingLine +
    `Submitted: ${data.timestamp}\n\n` +
    `---\n${data.message}\n`;

  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    subject,
    text,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
}
```

- [ ] **Step 3: Create the Vercel handler (prod)**

`api/feedback.js` (matches `api/itinerary.js` `(req,res)` style):

```js
import { validateFeedback, sendFeedbackEmail } from './feedbackEmail.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json({ status: 'ok', message: 'Feedback API is running' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

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

- [ ] **Step 4: Create the Expo handler (dev parity)**

`app/api/feedback+api.js` (web `POST(request)` style, same as `app/api/itinerary+api.js`):

```js
import { validateFeedback, sendFeedbackEmail } from '../../api/feedbackEmail.js';

export async function POST(request) {
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

- [ ] **Step 5: Add env vars**

Append to `.env` (real `RESEND_API_KEY` value will be pasted by the user — leave the value if already present, do NOT overwrite):

```dotenv

# Resend API key for beta feedback emails — get yours at resend.com
RESEND_API_KEY=
# Your email address to receive beta tester feedback
FEEDBACK_RECIPIENT_EMAIL=webgenerations77@gmail.com
```

Append to `.env.example` under the `# --- Server-side (Vercel functions) ---` block (after `FIRECRAWL_API_KEY=` / its comments):

```dotenv
# Resend API key for beta feedback emails — get yours at resend.com
RESEND_API_KEY=
# Your email address to receive beta tester feedback
FEEDBACK_RECIPIENT_EMAIL=
```

Append the same two key/comment pairs to `../decide.env.txt` (the parent-dir reference file).

- [ ] **Step 6: Verify build**

Run: `npx expo export --platform web`
Expected: `Exported: dist`, no errors (confirms the Resend import + both handlers bundle).

- [ ] **Step 7: Functional check (requires RESEND_API_KEY set in `.env`)**

With a real key in `.env`, run `npx vercel dev` (or `npx expo start --web`) and:

```bash
# Empty message → 400
curl -s -X POST http://localhost:3000/api/feedback -H "Content-Type: application/json" \
  -d '{"page":"/plan","feedbackType":"Bug Report","message":""}'
# Expected: {"success":false,"error":"message is required"}

# Valid → 200 + email arrives at webgenerations77@gmail.com
curl -s -X POST http://localhost:3000/api/feedback -H "Content-Type: application/json" \
  -d '{"page":"/plan","feedbackType":"Bug Report","message":"Test from plan","rating":4,"userEmail":"dwaynephil@gmail.com","userName":"Dwayne"}'
# Expected: {"success":true}
```

(If no key is set yet, this step is deferred until the user pastes one; the build check in Step 6 still gates the commit.)

- [ ] **Step 8: Commit** (do not commit `.env`)

```bash
git add api/feedbackEmail.js api/feedback.js app/api/feedback+api.js .env.example ../decide.env.txt package.json package-lock.json
git commit -m "feat: add /api/feedback endpoint with Resend email notification"
```

---

### Task 5: Beta guide screen + Settings entry + first-run auto-show

**Files:**
- Create: `app/beta-guide.js`
- Modify: `app/_layout.js` (auto-show-once effect)
- Modify: `screens/SettingsScreen.js` (beta-only "Beta" section row)

**Interfaces:**
- Consumes: `useAuth().isBetaTester`, AsyncStorage key `@decide/beta_guide_seen`, `@decide/onboardingComplete`.
- Produces: route `/beta-guide`.

- [ ] **Step 1: Create the guide screen**

`app/beta-guide.js` (copy = spec Appendix A; brand primitives; writes the seen-flag on dismiss):

```js
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import ScreenBackground from '../components/brand/ScreenBackground';
import GradientHeader from '../components/brand/GradientHeader';
import Card from '../components/brand/Card';
import SectionLabel from '../components/brand/SectionLabel';
import CTAButton from '../components/brand/CTAButton';
import { COLORS, FONTS } from '../constants/theme';

function firstName(user) {
  const n = user?.displayName?.trim().split(/\s+/)[0];
  return n || 'friend';
}

export default function BetaGuide() {
  const router = useRouter();
  const { user } = useAuth();

  const done = async () => {
    await AsyncStorage.setItem('@decide/beta_guide_seen', 'true').catch(() => {});
    router.back();
  };

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <GradientHeader style={styles.header}>
            <Text style={styles.eyebrow}>BETA GUIDE</Text>
            <Text style={styles.headerTitle}>Welcome to Cheddar 🧀</Text>
          </GradientHeader>

          <Text style={styles.lead}>
            You're one of the very first people inside Decide — thanks for that. Here's the deal:
            tell me roughly what you're in the mood for, and I'll plan the whole day — where to eat,
            what to do, in what order, drive times sorted. No more standing around asking "so what do
            you want to do?" We'll decide. You just go.{'\n\n'}
            This takes two minutes to read. Then go break things.
          </Text>

          <SectionLabel tone="cobalt" style={styles.section}>THREE WAYS TO DECIDE</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.h}>🗺️ Plan — the main event</Text>
            <Text style={styles.p}>
              Set your vibe — pace, budget, who's with you, a quick note like "anniversary, we love
              seafood" — and I build a full day, stop by stop, with a reason for each pick. Don't like
              one? Swap it and I'll find another.
            </Text>
            <Text style={styles.h}>🎯 Quick Spin</Text>
            <Text style={styles.p}>
              Can't even commit to planning? Hit Spin and I'll throw you one solid pick on the spot.
              Perfect for "just tell me where to eat."
            </Text>
            <Text style={styles.h}>📜 History</Text>
            <Text style={styles.p}>
              Every day I've planned and every spin lands here, so you can pull up that great taco
              place from last week.
            </Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>SET YOURSELF UP FIRST (2 MIN)</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>
              The more I know, the better the day. In Settings, set your location, your default pace
              and budget, and — this one matters — your dietary needs and sensitivities. Tell me you're
              vegetarian or allergic to shellfish and I'll plan around it every single time.
            </Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>WHAT I'D LOVE YOU TO TEST</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>• Plan a day in a few different places and dates — your hometown, then somewhere you're visiting.</Text>
            <Text style={styles.p}>• Try a weird combo on purpose (packed pace + tight budget + a picky note) and see if I hold up.</Text>
            <Text style={styles.p}>• Swap a stop or two — does the replacement actually make sense?</Text>
            <Text style={styles.p}>• Watch for the "what's happening right now" picks — events and specials tied to your real dates. Tell me when they land and when they're off.</Text>
            <Text style={styles.p}>• Push the edges. The stuff that breaks is exactly what I need to hear about.</Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>FOUND SOMETHING? TELL ME.</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>
              See the 💬 Give Feedback button floating in the corner? Tap it anytime — it's on every
              screen. The most useful reports tell me three things: what screen you were on, what you
              expected, and what actually happened. Even "this just felt off" is genuinely useful —
              don't hold back.
            </Text>
            <Text style={[styles.p, styles.signoff]}>
              Thanks for helping shape this, {firstName(user)}. Now go plan something.{'\n'}— Cheddar
            </Text>
          </Card>

          <CTAButton title="Got it — let's go" variant="go" onPress={done} style={{ marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  header: { borderRadius: 18, marginBottom: 8 },
  eyebrow: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, color: COLORS.sky200 },
  headerTitle: { fontFamily: FONTS.displayHeavy, fontSize: 26, color: COLORS.white, marginTop: 4 },
  lead: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 8 },
  section: { marginTop: 16, marginBottom: 8 },
  card: { gap: 6 },
  h: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.textPrimary, marginTop: 4 },
  p: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  signoff: { marginTop: 10, fontStyle: 'italic', color: COLORS.textPrimary },
});
```

- [ ] **Step 2: Auto-show the guide once, in the shell**

In `app/_layout.js`, add `useRef` to the React import (line 1):

```js
import { useState, useEffect, useRef } from 'react';
```

Inside `RootLayoutInner`, after the `betaBannerDismissed` state line, add a ref:

```js
  const guideCheckedRef = useRef(false);
```

Add this effect alongside the other `useEffect`s in `RootLayoutInner`:

```js
  useEffect(() => {
    if (!ready || !isBetaTester || guideCheckedRef.current) return;
    guideCheckedRef.current = true;
    (async () => {
      const seen = await AsyncStorage.getItem('@decide/beta_guide_seen').catch(() => null);
      if (seen === 'true') return;
      const onboarded = await AsyncStorage.getItem('@decide/onboardingComplete').catch(() => null);
      if (onboarded === 'true') router.push('/beta-guide');
    })();
  }, [ready, isBetaTester]);
```

- [ ] **Step 3: Add the beta-only Settings entry**

In `screens/SettingsScreen.js`:

(a) Extend the auth destructure (line 219):

```js
  const { user, signOut, isBetaTester } = useAuth();
```

(b) Immediately after the Subscription `</Card>` closing the subscription section (the `Card` opened at the `{/* ── Subscription ── */}` block, ending around line 523), add a beta-only section:

```jsx
          {isBetaTester && (
            <>
              <SectionLabel tone="cobalt" style={styles.sectionHeaderSpacing}>BETA</SectionLabel>
              <Card style={styles.card}>
                <TouchableOpacity
                  style={styles.appRow}
                  activeOpacity={0.7}
                  onPress={() => router.push('/beta-guide')}
                >
                  <Text style={styles.appRowLabel}>📖 Beta Tester Guide</Text>
                  <Text style={styles.appRowChevron}>›</Text>
                </TouchableOpacity>
              </Card>
            </>
          )}
```

- [ ] **Step 4: Verify build**

Run: `npx expo export --platform web`
Expected: `Exported: dist`, no errors.

- [ ] **Step 5: Manual check**

Signed in as the beta email with `@decide/beta_guide_seen` cleared: on launch the guide appears once; "Got it — let's go" returns to the app and it does not reappear on reload. Settings shows a "BETA" section with "📖 Beta Tester Guide" that reopens it. The feedback button is hidden while on the guide.

- [ ] **Step 6: Commit**

```bash
git add app/beta-guide.js app/_layout.js screens/SettingsScreen.js
git commit -m "feat: add beta tester guide screen with Settings entry and first-run auto-show"
```

---

### Task 6: Audit & cleanup

**Files:**
- Modify: `README.md` (or create a `docs/` secrets note if no README env section) — document the two env vars
- Verify-only: all components from Tasks 2–5

**Interfaces:** none (verification + docs).

- [ ] **Step 1: Non-beta visibility audit**

Temporarily sign in as a non-beta account (or temporarily point `BETA_TESTERS` at a throwaway email in a scratch edit — revert after). Confirm:
- No beta banner, no feedback button anywhere.
- No "BETA" section in Settings.
- No guide auto-show.
Revert any scratch edit so `constants/betaTesters.js` again contains only `dwaynephil@gmail.com`.

- [ ] **Step 2: Public-route audit (as beta user)**

Confirm banner + feedback button are absent on `/auth/login`, `/onboarding`, `/terms`, and the pre-auth splash; present on `/plan`, `/spin`, `/history`, `/result`. Confirm the feedback button is absent on `/beta-guide`.

- [ ] **Step 3: "AI" wording scan**

Run: `grep -rniE "\bAI\b|artificial intelligence" app/beta-guide.js components/BetaBanner.js components/BetaFeedback.js services/feedbackService.js api/feedback.js api/feedbackEmail.js app/api/feedback+api.js`
Expected: no matches (all assistant references say "Cheddar").

- [ ] **Step 4: Document env vars**

Add a short "Beta feedback (Resend)" note to `README.md` listing `RESEND_API_KEY` and `FEEDBACK_RECIPIENT_EMAIL` as server-side vars also required in the Vercel project env. (If `README.md` has no env section, add a brief one.)

- [ ] **Step 5: Final build**

Run: `npx expo export --platform web`
Expected: `Exported: dist`, no errors.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "chore: beta tester feature audit and cleanup"
```

---

## Self-Review notes

- **Spec coverage:** Task 1 ↔ spec §1 (role); Task 2 ↔ §2 (banner/gating) + `COLORS.beta`; Task 3 ↔ §3 (button/modal/service); Task 4 ↔ §4 (API/Resend/env); Task 5 ↔ §5 (guide/Settings/auto-show) + Appendix A copy; Task 6 ↔ §6 (audit). Data-flow, error handling, and verification sections all map to Task 3/4 code.
- **Payload note:** client + handlers use `userName` in addition to the spec's documented payload — a deliberate, minor extension so the email greeting reads "from Dwayne" without hardcoding; server falls back to the email local-part if absent.
- **Type consistency:** `isBetaTester`/`getRole` (Task 1) used identically in Tasks 2/3/5; `submitFeedback` shape (Task 3) matches `validateFeedback`/`sendFeedbackEmail` consumption (Task 4); `@decide/beta_guide_seen` written in `beta-guide.js` and read in `_layout.js` (Task 5).
- **Post-merge ops (not code):** set `RESEND_API_KEY` + `FEEDBACK_RECIPIENT_EMAIL` in the Vercel project env (mirrors the existing `FIRECRAWL_API_KEY` ops note in backlog #4).
