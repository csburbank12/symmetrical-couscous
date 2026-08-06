const STRIPE_API = 'https://api.stripe.com/v1';

function parseCalculation(metadata) {
  try {
    const value = JSON.parse(metadata || 'null');
    if (!value || typeof value !== 'object') return null;
    return value;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const sessionId = String(req.query?.session_id || '');
  if (!secret) return res.status(503).json({ error: 'Payment verification is not configured.' });
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return res.status(400).json({ error: 'Invalid checkout session.' });

  try {
    const response = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || 'Stripe verification failed.');
    const paid = payload.payment_status === 'paid' && payload.status === 'complete';
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      paid,
      calculation: paid ? parseCalculation(payload.metadata?.calculation) : null
    });
  } catch (error) {
    console.error('verify_error', error);
    return res.status(500).json({ error: 'Unable to verify payment.' });
  }
}
