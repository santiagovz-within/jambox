import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(req: Request) {
  // Verify the request comes from Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Guard: only run when it is actually 10 AM in New York.
  // Two cron entries fire (14:00 UTC for EDT, 15:00 UTC for EST); this check
  // ensures only the correct one proceeds regardless of DST.
  const nyHour = parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }),
    10
  );
  if (nyHour !== 10) {
    return NextResponse.json({ skipped: true, reason: `NY time is ${nyHour}:xx — waiting for 10am` });
  }

  // Resolve the base URL: prefer explicit env var, fall back to VERCEL_URL
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  console.log(`[Cron] 10am NY — triggering daily generation via ${baseUrl}/api/generate`);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // no brand_id = runs for all brands
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Cron] Generation failed:', data);
      return NextResponse.json({ success: false, error: data.error }, { status: 500 });
    }

    console.log('[Cron] Generation complete:', data.results);
    return NextResponse.json({ success: true, results: data.results });
  } catch (e: any) {
    console.error('[Cron] Request failed:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
