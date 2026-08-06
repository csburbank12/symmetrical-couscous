# WageLeak

WageLeak is a mobile-first calculator that turns recurring unpaid minutes into a clear annual and multi-year dollar estimate.

The launch premise is simple: workers rarely lose a dramatic block of time. They lose five minutes opening, ten minutes during an interrupted break, four minutes answering messages, and three minutes closing. WageLeak makes the cumulative cost visible and produces a privacy-safe share card.

## Product loop

1. A visitor enters hourly rate, schedule, and recurring unpaid minutes.
2. WageLeak calculates daily loss, annual hours, annual value, and projected multi-year value.
3. The visitor downloads a 1200×630 share card or copies a Reddit-ready post.
4. An anonymous aggregate is saved through a rate-limited Supabase Edge Function.
5. The visitor can join the founding list or purchase the $9 Evidence Pack when Stripe is enabled.

## Revenue model

- **$9 Evidence Pack:** printable incident log, pay-period audit, records checklist, neutral conversation script, and escalation worksheet.
- **Tips / sponsorship:** add after traffic proves demand.
- **Employment-law referrals:** only after compliance review and signed referral relationships.
- **B2B / union version:** private team dashboards and exportable aggregate reports.

The calculator should remain free. Making the viral utility worse to force subscriptions would reduce distribution and trust.

## Stack

- Static HTML, CSS, and browser JavaScript
- Vercel static hosting and Node serverless functions
- Supabase Postgres and an anonymous Edge Function
- Stripe Checkout through direct server-side REST calls

## Local checks

```bash
npm run check
python -m http.server 3000
```

Then open `http://localhost:3000`.

## Supabase

The migration creates only prefixed WageLeak tables:

- `public.wageleak_calculations`
- `public.wageleak_stats`
- `public.wageleak_waitlist`

All three tables have RLS enabled. `anon` and `authenticated` have no table privileges. Only the Edge Function's service role can read or write. A private trigger updates public aggregate totals atomically.

Deploy the `wageleak-submit` Edge Function with JWT verification disabled because it is an intentionally public endpoint. The function implements input validation, email validation, per-IP hashing, and rate limits. It never stores a raw IP address.

## Stripe

Set this environment variable in Vercel:

```bash
STRIPE_SECRET_KEY=sk_live_...
```

Optional:

```bash
PUBLIC_SITE_URL=https://wageleak.com
```

Checkout is one-time, $9, and uses Stripe-hosted Checkout. The evidence pack download is released only after the server verifies the Checkout Session is complete and paid.

## Privacy boundary

Do not add employer names, manager names, patient information, student information, screenshots, or document uploads to the anonymous calculator flow. The initial product stores numeric aggregates, broad industry/state context, a source tag, and a monthly-rotating one-way IP hash for abuse prevention.

## Disclaimer boundary

WageLeak estimates the value of time. It does not determine employee classification, overtime eligibility, compensability, damages, penalties, statutes of limitation, or whether a law was violated.
