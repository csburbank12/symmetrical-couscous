# WageLeak launch checklist

The product code, anonymous Supabase backend, waitlist, result sharing, and Stripe checkout handlers are implemented. Two account-level switches remain before the site can be publicly monetized.

## 1. Make the Vercel production project public

1. Import `csburbank12/symmetrical-couscous` as a new Vercel project, or open the existing WageLeak deployment inspector.
2. In **Project Settings → Deployment Protection**, disable Vercel Authentication for the production domain. Preview deployments may remain protected.
3. Deploy the `main` branch.
4. Verify the homepage, calculation flow, share-card download, waitlist submission, `/api/checkout`, and `/api/verify`.

The repository already contains `vercel.json`, a reproducible build, and serverless checkout handlers.

## 2. Connect Stripe

Set these Vercel production environment variables:

```text
STRIPE_SECRET_KEY=sk_live_...
PUBLIC_SITE_URL=https://your-production-domain
```

Then redeploy. Until the secret is present, checkout intentionally returns HTTP 503 rather than pretending payments are available.

## 3. Domain

`wageleak.com` was available when checked on August 6, 2026. Availability and pricing can change. Purchase only after confirming the name and budget, then attach it to the Vercel production project.

## 4. Launch sequence

1. Run ten real-device calculations and confirm the arithmetic manually.
2. Recruit 10–20 private testers from different hourly professions.
3. Fix confusing wording before promoting.
4. Launch first as a free utility and disclose the optional $9 pack.
5. Follow each community’s current self-promotion rules. Do not ask for coordinated votes or repost removed submissions.
6. Track completed calculations, share-card downloads, waitlist joins, and paid conversion.

## Initial target metrics

- 1,000 completed calculations
- 10% share-card download rate
- 3% founding-list conversion
- 0.5%–1.5% Evidence Pack conversion

A Reddit front-page result cannot be guaranteed. The strategy is to make the free output useful and specific enough that workers choose to share it.
