# Decide

An Expo app that plans your day — where to eat, what to do, in what order.

## Dev server

```bash
cd decide-app && npx expo start
```

## Environment variables

Client-side variables use the `EXPO_PUBLIC_` prefix. Server-side variables do **not**.

### Required for beta feedback (Resend)

| Variable | Side | Description |
|---|---|---|
| `RESEND_API_KEY` | server-side | API key from [resend.com](https://resend.com) — used to send feedback emails |
| `FEEDBACK_RECIPIENT_EMAIL` | server-side | Email address where beta feedback is delivered |

Both must also be set in the **Vercel project environment variables** for production (Dashboard → Project → Settings → Environment Variables). They are never exposed to the client.

### Other required variables

See `CLAUDE.md` → "Environment Variables" for the full list (Google Places, Anthropic, NPS, RIDB, etc.).
