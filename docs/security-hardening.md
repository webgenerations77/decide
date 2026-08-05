# Security hardening — 2026-07-29

Audit of what a stranger can read or spend, what was changed in code, and what is left that only
you can do (console access, credential revocation).

Everything below was verified against the **live deployed bundle** at
`decide-app-six.vercel.app`, not just source — the deployed bundle is the only thing that
actually answers "is this public?".

---

## What was and was not exposed

Scanned the live bundle for every credential value in `.env`, then again by *pattern*
(`AIza…`, `sk-…`, `fc-…`, `re_…`) to catch keys whose Vercel value differs from the local one.

**Not in the bundle** — Anthropic, Google Places, Firecrawl, Resend, Firebase admin private key,
Gemini, OpenWeather, Ticketmaster, Eventbrite, NPS, RIDB, OpenRoute, and the QA password. All are
read only inside `api/*` and `app/api/*`, which run server-side. `.env` is untracked and
gitignored; only `.env.example` is committed and its values are blank.

**In the bundle, by design** — `EXPO_PUBLIC_FIREBASE_API_KEY`. Google intends this to be public;
it is an identifier, not a credential. Its safety rests entirely on Firestore rules (below).

**In the bundle, and genuinely defeated** — `EXPO_PUBLIC_FEEDBACK_SHARED_SECRET`. Anyone can lift
it and POST to `/api/feedback`. `.env.example` already admitted this is "not a true secret", so
nothing here is a surprise; just don't count on the gate.

**Also in the bundle** — `test@frank.com`, via `constants/betaTesters.js`. The password is not
there. Low severity, but it names a real account.

### The near miss

Six server-only keys carried the `EXPO_PUBLIC_` prefix (`NPS`, `RIDB`, `OPENWEATHER`,
`TICKETMASTER`, `EVENTBRITE`, `OPENROUTE`), and `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is set in
Vercel production and reached through a fallback in 18 files. They stay out of the bundle only
because nothing under `app/` or `components/` imports them — Metro inlines an `EXPO_PUBLIC_` value
wherever it appears in a *client* module. That is luck of the import graph, not a design. One
stray import and the Places key ships to every browser permanently.

---

## The bigger hole: the endpoint, not the key

`POST /api/itinerary` and `/api/itinerary-swap` read the uid for usage attribution and **never
rejected**. They were open to the internet. Nobody needed to steal the Anthropic key — a plan
costs ~$0.22 loaded (Places + Anthropic + Routes + Firecrawl) and anyone with `curl` could buy
one, forever. The 3-plans-a-month cap in `services/subscriptionService.js` lives in the client's
AsyncStorage and never applied to anything that skipped the app.

A leaked key is rotated in thirty seconds. An open endpoint bills you until you notice.

---

## Changed in code (done)

| Change | Files |
|---|---|
| Hard 401 for any caller without a verified Firebase ID token | `api/itinerary.js`, `app/api/itinerary+api.js`, `api/itinerary-swap.js`, `app/api/itinerary-swap+api.js` |
| `getAuthIdentity()` — rejecting counterpart to the never-rejecting `getUidFromAuth()` | `lib/admin/auth.js` |
| Server-side quota: 25 plans/month + 8 requests/hour per account, admins exempt | `lib/apiQuota.js` (new) |
| `authHeader()` no longer fires requests with no header when `getIdToken()` fails | `services/itineraryService.js` |
| `NPS_API_KEY` / `RIDB_API_KEY` read first, `EXPO_PUBLIC_` names kept as a fallback | both itinerary twins |
| Intended Firestore policy put under version control | `firestore.rules` (new, **not deployed**) |
| 31 unit tests for the quota decision | `__tests__/api-quota.mjs` (new) |

Two design notes worth keeping straight:

- **The server cap is not the product cap.** The client allows 3 free plans a month plus up to 3
  earned by reviewing a trip (`MAX_REVIEW_BONUS_PER_PERIOD`), banked in AsyncStorage where the
  server cannot see them. A server that stopped at 3 would 403 someone who had legitimately earned
  a 4th. So the ceiling sits at 25 — far above honest usage, there only to bound worst-case spend
  per account (~$5.50/month instead of unbounded). The hourly cap is the half that actually stops a
  script, since 25 can otherwise be spent in ninety seconds.
- **The quota fails open.** A Firestore outage must not become a product outage. That is safe
  because the 401 sits in front of it — an attacker still needs a verified account. This is the
  opposite of the transport module's fail-conservative rule, and deliberately so: there a wrong
  answer strands someone mid-trip, here it is a refund.

Weighting: a full generation costs 1 against the monthly ceiling. Swap, clarify and transport-leg
cost 0 — they are a fraction of a plan and must not spend an allowance the traveller paid for —
but all of them pay into the hourly burst counter.

---

## Left for you

### 1. Review, commit, deploy — nothing above is live

The changes are **on disk and uncommitted**. Production still has the open endpoint. Two reasons I
stopped short: this is a security-sensitive diff that deserves your eyes before it ships, and a
commit on `main` triggers a Vercel deploy — a 401 regression with nobody watching would take the
app down for real users.

```
cd decide-app && git diff                      # review
git checkout -b security/endpoint-auth         # main is the deploy branch; branch first
git add -A && git commit -m "Gate the itinerary endpoints behind auth and a per-account quota"
git push -u origin security/endpoint-auth      # merge when you can watch the deploy
```

Then confirm the gate is on, from a signed-out shell:

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://decide-app-six.vercel.app/api/itinerary \
  -H 'Content-Type: application/json' -d '{"latitude":38.4,"longitude":-75.05}'
```

Expect **401**. If it returns 200, the deploy did not take. Then open the installed PWA and
generate a plan end to end — that is the check that matters, because it exercises the token path
the 401 depends on.

### 2. Firestore rules — verify, then deploy

Already verified: unauthenticated REST reads of `/users`, `/betaInvites`, `/apiQuota` and
`/users/{uid}/itineraries` all return `403 PERMISSION_DENIED`. **The database is not open to the
public**, so the Firebase key being in the bundle is not currently costing you anything.

Not verified: whether one *signed-in* user can read another's documents. Testing that needs a real
sign-in with stored credentials, which I was blocked from doing — correctly. Run it yourself:

```bash
K=<EXPO_PUBLIC_FIREBASE_API_KEY>
R=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$K" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@frank.com","password":"<TEST_ACCOUNT_PASSWORD>","returnSecureToken":true}')
TOKEN=$(echo "$R" | jq -r .idToken)
B="https://firestore.googleapis.com/v1/projects/decide-211b1/databases/(default)/documents"
# Reading a DIFFERENT user's subtree must be denied:
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" "$B/users/someoneElsesUid/itineraries"
```

**403 is the pass.** A **404** is the failure to care about — it means the rules allowed the read
and the document merely does not exist, i.e. any signed-in user can read any other user's trips.

`firestore.rules` in the repo root is the intended policy. **Diff it against the console before
deploying** — the live rules were never checked in, and if the console is more permissive in a way
something quietly depends on, deploying this will break it with a silent fallback rather than an
error (`services/rolesService.js` swallows a denied read and falls back to the hardcoded map).

```
npx firebase deploy --only firestore:rules
```

### 3. Restrict the Firebase web key

Firebase console → Project settings → API keys → the browser key → **Application restrictions →
HTTP referrers**, allowing only:

```
decide-app-six.vercel.app/*
localhost/*
```

This does not make the key secret — it stays in the bundle — it stops it being usable from
anyone else's origin.

### 4. Rename the Vercel variables

Production has **no `GOOGLE_PLACES_API_KEY`** — it runs entirely on
`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` through the fallback. Removing the fallback before doing this
would take the app down instantly. The code now prefers the unprefixed name and falls back, so the
migration is zero-downtime in this order:

1. In Vercel, add `GOOGLE_PLACES_API_KEY`, `NPS_API_KEY`, `RIDB_API_KEY` with the **same values**
   as their `EXPO_PUBLIC_` counterparts. (I could not do this for you: `vercel env pull` returns
   `[SENSITIVE]` rather than the values, and guessing them from the local `.env` risked setting a
   *different* key — which the new code would then prefer, breaking Places in production.)
2. Redeploy and confirm a plan still generates.
3. Delete the three `EXPO_PUBLIC_` originals.
4. Delete the `|| process.env.EXPO_PUBLIC_…` fallbacks from both itinerary twins.

### 5. Revoke five dead credentials

No code in the repo reads any of these, but all five are live keys sitting in Vercel and `.env`.
A key nothing uses is pure liability — revoke at the issuer, don't just delete the variable.

| Variable | Where to revoke |
|---|---|
| `EXPO_PUBLIC_OPENWEATHER_API_KEY` | openweathermap.org (weather comes from Open-Meteo, which needs no key) |
| `EXPO_PUBLIC_TICKETMASTER_API_KEY` | developer.ticketmaster.com |
| `EXPO_PUBLIC_EVENTBRITE_API_KEY` | eventbrite.com developer portal |
| `EXPO_PUBLIC_OPENROUTE_API_KEY` | openrouteservice.org |
| `GEMINI_API_KEY` | Google AI Studio |

The values are commented out in `.env` so you can find them; delete those lines once revoked, and
remove the variables from the Vercel project.

### 6. Optional — rotate the two bundled values

Neither is a real secret, so this is housekeeping, not urgency:

- `EXPO_PUBLIC_FEEDBACK_SHARED_SECRET` — rotating changes nothing while it ships in the bundle.
  A real fix is rate-limiting `/api/feedback` per uid, the same way `lib/apiQuota.js` does.
- `test@frank.com` — consider moving it out of `constants/betaTesters.js` into
  `EXPO_PUBLIC_BETA_TESTER_EMAILS`, which is what that variable exists for.

---

## Found, not fixed

`services/itineraryService.js` — `swapStop()` and `getLegAlternatives()` have **no demo-mode
check**, unlike `generateItinerary()` and `getClarifyingQuestion()`. Tapping swap or a leg chip on
a demo itinerary fires a real, paid API call. Not a security hole (the caller is signed in), but it
spends money on a mode that is supposed to be free, and it contradicts "demo mode uses sample
data". Left alone because fixing it means deciding what a demo swap should *return*, which is a
product call, not a mechanical one. Logged in `.trellis/report.json` as `demo-mode-paid-calls`.
