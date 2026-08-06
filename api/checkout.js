const STRIPE_API = 'https://api.stripe.com/v1';

function getOrigin(req) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function safeCalculation(value) {
  if (!value || typeof value !== 'object') return null;
  const fields = ['hourlyRate', 'minutesPerDay', 'daysPerWeek', 'weeksPerYear', 'years'];
  const result = {};
  for (const field of fields) {
    const parsed = Number(value[field]);
    if (!Number.isFinite(parsed)) return null;
    result[field] = Math.round(parsed * 100) / 100;
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: 'Checkout is not configured yet.' });

  try {
    const calculation = safeCalculation(req.body?.calculation);
    const origin = getOrigin(req);
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${origin}/?paid={CHECKOUT_SESSION_ID}#evidence-pack`);
    params.set('cancel_url', `${origin}/#evidence-pack`);
    params.set('allow_promotion_codes', 'true');
    params.set('billing_address_collection', 'auto');
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', '900');
    params.set('line_items[0][price_data][product_data][name]', 'WageLeak Evidence Pack');
    params.set('line_items[0][price_data][product_data][description]', 'Printable wage documentation worksheets and records checklist. One-time purchase.');
    if (calculation) params.set('metadata[calculation]', JSON.stringify(calculation));

    const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || 'Stripe checkout failed.');
    return res.status(200).json({ url: payload.url });
  } catch (error) {
    console.error('checkout_error', error);
    return res.status(500).json({ error: 'Unable to create checkout.' });
  }
}
