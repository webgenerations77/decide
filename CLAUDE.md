@AGENTS.md
# Decide App — Project Context

## Stack
- Expo SDK 56, expo-router (file-based routing)
- Firebase (auth + Firestore)
- Google Places API (nearby search + geocoding)
- Anthropic API (itinerary + decision engine)
- OpenWeatherMap API (weather-aware scheduling)
- Ticketmaster API (local events)
- RevenueCat (subscriptions, Phase 4)

## Color Theme
- Background: #0d0d0d
- Surface/cards: #1a1a2e
- Primary purple: #7c3aed
- Accent purple: #a855f7
- Text primary: #ffffff
- Text secondary: #9ca3af
- Tab bar: #12121f

## App Structure
- app/_layout.js — root tab navigator
- app/index.js — Home screen (DECIDE button, category pills, location)
- app/result.js — Decision result card
- app/fallback.js — Fallback trio screen
- app/(tabs)/plan.js — Day itinerary timeline (in progress)
- app/api/itinerary+api.js — Server-side itinerary API route (in progress)

## Key Decisions
- All screens mobile-first, max 390px centered on web
- expo-router for all navigation
- EXPO_PUBLIC_ prefix required for all client-side env vars
- Use --legacy-peer-deps for all npm installs on this project

## Anthropic Key — Security Note (Dev Only)
EXPO_PUBLIC_ANTHROPIC_API_KEY is currently client-side so the itinerary feature
works in both web and mobile dev without a server. This is intentional and
acknowledged. Before production launch, move the Claude call behind a Firebase
Cloud Function and remove EXPO_PUBLIC_ANTHROPIC_API_KEY from the bundle.
app/api/itinerary+api.js is kept for the future EAS/server deployment path.

## Itinerary Spec
- Runs 11am–8pm
- Includes: morning activity, lunch ~noon-1pm, afternoon mix, dinner 6:30-8pm
- Returns JSON array, each stop has: time, duration_mins, category, name, place_id, address, reason, excitement_score
- Weather-aware: rain swaps outdoor to indoor
- Day-of-week aware: weekday vs weekend scheduling differs

## Excitement Index Formula
excitementScore = (rating * 20)
  + (Math.min(userRatingsTotal, 500) / 5)
  + (openNow ? 15 : 0)
  - (distanceKm * 5)

## Monetization
- Free tier: 5 decisions/day, 3 quick spins/day
- Pro: $3.99/mo — unlimited decisions, full itinerary, history
- Payments via RevenueCat (Phase 4)

## User Preferences (stored in AsyncStorage)
- groupType: solo | couple | family | friends
- pace: relaxed | moderate | packed
- budget: $ | $$ | $$$
- cuisines: array of preferences
- dietaryRestrictions: array
- maxDistanceMiles: number

## Environment Variables
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=
EXPO_PUBLIC_ANTHROPIC_API_KEY= (dev only — client-side, see security note above)
ANTHROPIC_API_KEY= (kept in .env for future server-side use)
EXPO_PUBLIC_OPENWEATHER_API_KEY=
EXPO_PUBLIC_TICKETMASTER_API_KEY=
## Cost Management
- Prefer claude-haiku-4-5 for routine edits and file reads
- Use claude-sonnet-4-6 only for complex logic