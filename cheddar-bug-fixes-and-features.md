# Cheddar – Bug Fixes, Features & UX Improvements
### Multi-Session Claude Code Prompt Document

This batch is split across 6 focused sessions. Complete all tasks in a session before moving to the next. Commit after each logical change within a session.

---

---

# SESSION 1 OF 6 — CORS Infrastructure Fix

**Start this session with:**
> "We're fixing critical CORS failures that are breaking manual location search and Quick Spin. Both features are failing because client-side calls are routing through corsproxy.io, which is rejecting the preflight requests. We need to move all Google Places API calls server-side. Audit all files that reference corsproxy.io before making any changes."

---

## Task 1: Fix CORS Errors for Google Places API (Manual Location + Quick Spin)

**Bug:** Both manual location search and Quick Spin fail with CORS errors when routing through `corsproxy.io`. The preflight request is being rejected.

**Errors seen:**
```
Access to fetch at 'https://corsproxy.io/?https%3A%2F%2Fplaces.googleapis.com/v1/places:searchText'
from origin 'https://decide-app-six.vercel.app' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check: It does not have HTTP ok status.

POST https://corsproxy.io/?https%3A%2F%2Fplaces.googleapis.com/v1/places:searchNearby net::ERR_FAILED
```

**Fix:** Replace the `corsproxy.io` proxy approach with server-side Next.js API routes. This keeps the API key server-side and eliminates CORS issues entirely.

- Create `/api/places/search-text` — proxies requests to `places.googleapis.com/v1/places:searchText`
- Create `/api/places/search-nearby` — proxies requests to `places.googleapis.com/v1/places:searchNearby`
- Update all client-side calls that currently use `corsproxy.io` to point to these internal routes instead
- Ensure the API key (`GOOGLE_PLACES_API_KEY`) is only referenced server-side and never exposed to the client

**Commit:** `fix: replace corsproxy.io with server-side Places API routes`

---

**✅ End of Session 1**
**Before closing:** Confirm manual location search and Quick Spin both work without CORS errors.

---

---

# SESSION 2 OF 6 — Itinerary Generation Quality

**Start this session with:**
> "We're doing a focused pass on itinerary generation quality. There are several bugs and missing features in how itineraries are built and displayed: activity type bias, missing live music detection, missing website/phone links on stops, missing pricing advisor coverage, weather date mismatch, alcohol over-representation, and a navigation starting point bug. Audit CLAUDE.md and the itinerary stop card component before making any changes."

---

## Task 2: Fix Itinerary Bias Toward Suggested Activities

**Bug:** When a user suggests "pinball and live music," the itinerary over-indexes on pinball, filling most of the day with pinball stops while ignoring live music entirely.

**Fix:** Audit the itinerary generation prompt in CLAUDE.md and relevant generation logic.

- Cap any single activity type at a maximum of 1–2 stops per day regardless of how prominently it was mentioned in the user's prompt
- Treat all user-suggested activity types as equal in weight
- If multiple activity types are suggested, each must be represented proportionally
- If a suggested activity type cannot be reliably sourced, flag it explicitly in the itinerary rather than silently omitting it

**Commit:** `fix: cap activity type repetition and enforce proportional representation in itinerary generation`

---

## Task 3: Live Music Detection at Stops

**Context:** When a stop regularly hosts live music (e.g. Burley Oak), the itinerary should surface whether live music is scheduled on the itinerary date and, if known, who is performing.

**Fix:**

- During itinerary generation, flag stops that are known live music venues
- Use Firecrawl to attempt to scrape the venue's events page or social feed for the itinerary date
- If live music is confirmed: include the artist/act name and show time in the stop detail
- If live music cannot be confirmed but the venue regularly hosts it, include a note: *"Live music likely — check [venue website] for the current schedule"*

**Commit:** `feat: add live music detection and artist info to qualifying itinerary stops`

---

## Task 4: Restore Website & Phone Links on Every Itinerary Stop

**Bug:** Website and phone call links that previously appeared on each itinerary stop are missing.

**Fix:** Audit the itinerary stop card component. Restore both:
- A **Website** link (opens in new tab)
- A **Call** link (`tel:` href)

These should appear on every stop. If Places data is missing a phone number or website for a specific stop, omit that individual link gracefully — but do not remove the UI elements entirely.

**Commit:** `fix: restore website and phone call links on all itinerary stop cards`

---

## Task 5: Pricing Advisor for All Itinerary Types

**Context:** A pricing advisor was planned. Confirm whether it has been implemented and verify it appears consistently across all itinerary types.

**Fix:**

- Audit all itinerary result views for the presence of pricing/cost estimates
- If the pricing advisor is missing from any itinerary type (standard, Quick Spin, etc.), implement it there
- Each stop should include an estimated cost tier (Free / $ / $$ / $$$) pulled from Places data or inferred by Cheddar
- A day-total estimated cost range should appear in the itinerary summary header

**Commit:** `feat: ensure pricing advisor is present on all itinerary types`

---

## Task 6: Verify Weather is Tied to Itinerary Date (Not Current Day)

**Bug:** Confirm whether the weather shown on itinerary results reflects the actual itinerary date or defaults to today's weather.

**Fix:**

- Audit the weather fetch logic and confirm it uses the itinerary's selected date as the query date
- If it is using today's date, update it to use the itinerary date
- If the itinerary date is beyond the forecast window, display: *"Extended forecast not available — check back closer to your trip"*

**Commit:** `fix: ensure weather reflects itinerary date, not current day`

---

## Task 7: Fix Navigation – Include User's Starting Point

**Bug:** When adding an itinerary to navigation, the starting point is not included — navigation begins from the first stop rather than the user's actual origin.

**Fix:**

- When the user initiates navigation, prompt for or confirm their starting point (current location, hotel, or custom address)
- Pass the starting point as the first waypoint in the Google Maps / Apple Maps deep link
- Default to the user's current location if no custom starting point is set

**Commit:** `fix: include user starting point as first waypoint in itinerary navigation`

---

## Task 8: Reduce Alcohol Bias in Itinerary Generation

**Bug:** Nearly every generated itinerary includes a bar or drinking stop, even when the user has not requested it.

**Fix:** Audit the itinerary generation prompt in CLAUDE.md.

- Remove any implicit bias toward bar/brewery/drinking stops as default filler stops
- Drinking stops should only appear when the user has explicitly requested them (e.g. selected "Bars & Breweries" as an activity style, or mentioned drinks in their prompt)
- Add a hard negative constraint to the generation prompt: *"Do not include bars, breweries, or alcohol-serving venues as stops unless the user has explicitly requested them."*

**Commit:** `fix: remove alcohol bias from itinerary generation prompt`

---

**✅ End of Session 2**
**Before closing:** Test a multi-activity itinerary prompt (e.g. "pinball and live music"), verify stop cards show website/phone links, confirm pricing appears, and check that weather matches the itinerary date.

---

---

# SESSION 3 OF 6 — Itinerary Results UX & History

**Start this session with:**
> "We're adding two UX improvements to the itinerary experience: the ability to adjust the time window directly from the results page and regenerate, and making History items clickable into their full itinerary detail view. Audit the itinerary results page component and the History list component before making any changes."

---

## Task 9: Time Window Adjustment from Results Page

**Feature:** Allow users to adjust the itinerary time window (start/end time) directly from the results page and regenerate without starting over.

**Implementation:**

- Add an editable time range control (start time / end time) to the itinerary results header or summary section
- When the user changes either time, display a **"Refresh Itinerary"** button
- On confirm, re-run itinerary generation with the updated time window while preserving all other preferences and inputs
- Show a loading/regenerating state during the refresh

**Commit:** `feat: add time window editor and refresh to itinerary results page`

---

## Task 10: History – Clickable Itinerary Detail View

**Bug:** Itineraries in History are not tappable into their full detail view.

**Fix:**

- Make each itinerary entry in the History list tappable
- Tapping should navigate to or expand the full itinerary detail view (same view shown after generation)
- All stop cards, website/phone links, pricing, and weather should render identically to the live results view

**Commit:** `feat: make History items tappable with full itinerary detail view`

---

**✅ End of Session 3**
**Before closing:** Verify time window adjustment regenerates correctly and History items open to full detail.

---

---

# SESSION 4 OF 6 — Admin Section

**Start this session with:**
> "We're building a protected Admin section accessible only to webgenerations77@gmail.com. It should follow the same role-check pattern used by the beta tester system (e.g. useIsBetaTester()). Audit the existing role/permission utility before building anything."

---

## Task 11: Admin Section

**Feature:** Add a protected Admin dashboard accessible only to `webgenerations77@gmail.com`.

**Implementation:**

- Create an `/admin` route with email-based access control enforced on both client and server — all other users are redirected to home
- Use the same centralized role/permission utility pattern as `useIsBetaTester()` — create an `useIsAdmin()` hook
- Do not surface any admin navigation links or UI to non-admin users
- Admin dashboard sections:
  - **API Usage** — token consumption, request counts, and estimated cost breakdowns by day/week/month
  - **User Administration** — user list with the ability to view and edit roles (including assigning/removing beta tester status) and view account status

**Commit:** `feat: add protected admin section with API usage and user administration`

---

**✅ End of Session 4**
**Before closing:** Verify `/admin` redirects non-admin users and that the dashboard renders correctly for webgenerations77@gmail.com.

---

---

# SESSION 5 OF 6 — Settings Page

**Start this session with:**
> "We're making several improvements to the Settings page: adding a dark mode toggle, reordering cards, adding a Coming Soon label to Notifications, and making the main cards collapsible. Audit the Settings page component and all child card components before making any changes."

---

## Task 12: Dark Mode Toggle

**Feature:** Add a dark mode toggle to Settings.

**Implementation:**

- Add a **Dark Mode** toggle to the Settings UI (Appearance section or near the top)
- Persist the preference to localStorage and/or the user's profile
- Apply a `dark` class to the root element; ensure all components use Tailwind's `dark:` variant
- Default to the system preference (`prefers-color-scheme`) on first load if no saved preference exists

**Commit:** `feat: add dark mode toggle to Settings`

---

## Task 13: Move Subscription Above Account

**Fix:** Reorder the Settings page so **Subscription** appears just above **Account**.

**Commit:** `fix: reorder Settings — move Subscription above Account`

---

## Task 14: Add "Coming Soon" to Notifications

**Fix:** Add a "Coming Soon" badge or label to the Notifications section so users know it is not yet functional.

**Commit:** `feat: add Coming Soon label to Notifications in Settings`

---

## Task 15: Make Settings Cards Collapsible

**Feature:** The following Settings cards should be individually collapsible:
- Subscription
- Account
- About & Data
- Preferences

**Implementation:**

- Add a chevron icon toggle to each card header
- Default state: expanded
- Animate the expand/collapse transition
- Persist each card's collapsed state in localStorage

**Commit:** `feat: make Settings cards collapsible with persisted state`

---

**✅ End of Session 5**
**Before closing:** Verify dark mode applies globally, card order is correct, Notifications shows Coming Soon, and all four cards collapse and persist their state.

---

---

# SESSION 6 OF 6 — Preferences Additions

**Start this session with:**
> "We're adding new options to the Preferences section: a neurodivergent-friendly Environmental option, four new Activity Styles (Live Music, Arcades, Theme Parks, Mini-Golf), and Chinese as a cuisine option. Audit the preferences data model and all relevant UI components before making any changes."

---

## Task 16: Add Neurodivergent Option to Environmental Preferences

**Feature:** Add a sensory-friendly option to the Environmental section of preferences.

**Implementation:**

- Add **"Sensory-friendly / Neurodivergent-friendly"** as a selectable option under Environmental preferences
- When selected, inject a constraint into Cheddar's itinerary generation prompt: deprioritize loud, crowded, overstimulating, or unpredictable environments; favor venues that are quieter, structured, and sensory-friendly
- Ensure the label is clear and non-stigmatizing

**Commit:** `feat: add neurodivergent-friendly option to Environmental preferences`

---

## Task 17: Add New Activity Style Options

**Feature:** Add the following to Activity Styles:
- Live Music
- Arcades
- Theme Parks
- Mini-Golf

**Implementation:**

- Add all four to the Activity Styles selection UI
- Map each to appropriate Google Places types and/or Cheddar prompt keywords for itinerary generation
- Ensure "Live Music" connects to the live music detection logic built in Session 2, Task 3

**Commit:** `feat: add Live Music, Arcades, Theme Parks, and Mini-Golf to Activity Styles`

---

## Task 18: Add Chinese as a Cuisine Option

**Fix:** Chinese cuisine is missing from the cuisine preferences list. Add it.

**Commit:** `fix: add Chinese as a cuisine preference option`

---

**✅ End of Session 6 — Batch Complete**
**Before closing:** Test all three new preference types flow through correctly into itinerary generation.

---
