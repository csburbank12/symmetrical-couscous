import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const allowedIndustries = new Set([
  'Healthcare', 'Education', 'Retail', 'Hospitality', 'Warehouse / logistics',
  'Construction / trades', 'Public safety', 'Office / professional', 'Gig work', 'Other'
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function numberInRange(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return Math.round(parsed * 100) / 100;
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeSource(value: unknown) {
  const source = String(value || 'direct').replace(/[^a-zA-Z0-9_\-./]/g, '').slice(0, 80);
  return source || 'direct';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Service configuration error.' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('wageleak_stats')
      .select('total_calculations,total_annual_loss,total_annual_hours,updated_at')
      .eq('id', 1)
      .single();
    if (error) return json({ error: 'Unable to load statistics.' }, 500);
    return json({ stats: data });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const ip = getClientIp(req);
  const monthlySalt = new Date().toISOString().slice(0, 7);
  const ipHash = await sha256(`wageleak:${monthlySalt}:${ip}`);

  if (body.type === 'waitlist') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return json({ error: 'Enter a valid email address.' }, 400);
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('wageleak_waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since);
    if ((count || 0) >= 5) return json({ error: 'Too many signup attempts. Try again later.' }, 429);

    const { error } = await supabase.from('wageleak_waitlist').insert({ email, ip_hash: ipHash, source: 'site' });
    if (error?.code === '23505') return json({ ok: true, alreadyJoined: true });
    if (error) return json({ error: 'Unable to join right now.' }, 500);
    return json({ ok: true });
  }

  if (body.type !== 'calculation') return json({ error: 'Unsupported submission type.' }, 400);

  const hourlyRate = numberInRange(body.hourlyRate, 1, 500);
  const daysPerWeek = numberInRange(body.daysPerWeek, 1, 7);
  const weeksPerYear = numberInRange(body.weeksPerYear, 1, 52);
  const years = numberInRange(body.years, 1, 50);
  const minuteInput = (body.minutes && typeof body.minutes === 'object') ? body.minutes as Record<string, unknown> : {};
  const minuteKeys = ['preShift', 'breaks', 'messages', 'postShift', 'other'];
  const minuteBreakdown: Record<string, number> = {};
  for (const key of minuteKeys) {
    const value = numberInRange(minuteInput[key] ?? 0, 0, 240);
    if (value === null) return json({ error: 'Invalid minute value.' }, 400);
    minuteBreakdown[key] = value;
  }

  if ([hourlyRate, daysPerWeek, weeksPerYear, years].some(value => value === null)) {
    return json({ error: 'Invalid calculation values.' }, 400);
  }

  const unpaidMinutesPerDay = Object.values(minuteBreakdown).reduce((sum, value) => sum + value, 0);
  if (unpaidMinutesPerDay <= 0 || unpaidMinutesPerDay > 720) return json({ error: 'Invalid unpaid-minute total.' }, 400);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('wageleak_calculations')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if ((count || 0) >= 20) return json({ error: 'Rate limit reached. Try again later.' }, 429);

  const annualHours = Math.round(((unpaidMinutesPerDay * daysPerWeek! * weeksPerYear!) / 60) * 100) / 100;
  const annualLoss = Math.round((annualHours * hourlyRate!) * 100) / 100;
  const careerLoss = Math.round((annualLoss * years!) * 100) / 100;
  const industry = allowedIndustries.has(String(body.industry)) ? String(body.industry) : null;
  const rawState = String(body.state || '').toUpperCase();
  const stateCode = /^[A-Z]{2}$/.test(rawState) ? rawState : null;

  const { data: inserted, error: insertError } = await supabase
    .from('wageleak_calculations')
    .insert({
      hourly_rate: hourlyRate,
      unpaid_minutes_per_day: unpaidMinutesPerDay,
      days_per_week: daysPerWeek,
      weeks_per_year: weeksPerYear,
      years_projected: years,
      annual_hours: annualHours,
      annual_loss: annualLoss,
      career_loss: careerLoss,
      minute_breakdown: minuteBreakdown,
      industry,
      state_code: stateCode,
      source: normalizeSource(body.source),
      ip_hash: ipHash
    })
    .select('id')
    .single();
  if (insertError) return json({ error: 'Unable to save anonymous aggregate.' }, 500);

  const { data: stats } = await supabase
    .from('wageleak_stats')
    .select('total_calculations,total_annual_loss,total_annual_hours,updated_at')
    .eq('id', 1)
    .single();

  return json({ ok: true, id: inserted.id, stats: stats || null });
});
