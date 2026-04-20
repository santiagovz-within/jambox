import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

// GET — fetch current temporal context + trend signals for a brand
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand_id = searchParams.get('brand_id') || 'fuzzys_taco_shop';

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing DB credentials' }, { status: 500 });

  const { data: brand } = await supabase
    .from('brands')
    .select('creative_variables')
    .eq('brand_id', brand_id)
    .single();

  const vars = brand?.creative_variables || {};
  return NextResponse.json({
    temporal_context: vars.temporal_context || [],
    trend_signals: vars.trend_signals || [],
    last_updated: vars.context_last_updated || null,
  });
}

// POST — auto-generate temporal context + trend signals using Gemini, then save to brand
export async function POST(req: Request) {
  const { brand_id, brand_name, industry } = await req.json();

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing DB credentials' }, { status: 500 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are a cultural calendar and trend analyst for a social media agency.

TODAY: ${dateStr}
BRAND: ${brand_name || brand_id}
INDUSTRY: ${industry || 'general'}

Generate:

1. TEMPORAL CONTEXT — 8-12 upcoming calendar events, observances, or cultural moments relevant in the next 6 weeks.
Cover: national days, cultural events (award shows, sports playoffs, album releases), retail calendar (payday, shopping windows), day-of-week patterns, weather/seasonal notes.
Prioritize relevance to ${industry || 'this brand'}.

2. TREND SIGNALS — 6-8 current trend signals this brand should factor in.
Based on what's happening in social media right now as of ${dateStr}: platform algorithm changes, content format trends, cultural conversations, viral topics.

Return ONLY valid JSON with this structure:
{
  "temporal_context": [
    {
      "date": "YYYY-MM-DD or null",
      "label": "National Taco Day",
      "type": "national_day",
      "relevance": "Why this matters for the brand"
    }
  ],
  "trend_signals": [
    {
      "signal": "Short-form vertical video engagement up 35% on Instagram",
      "source": "Platform analytics",
      "strength": "high"
    }
  ]
}
Types for temporal_context: "national_day", "cultural", "retail", "weather", "day_pattern"
Strength for trend_signals: "high", "medium", "low"
`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const generated = JSON.parse(raw);

    // Fetch existing custom entries to preserve them
    const { data: brand } = await supabase.from('brands').select('creative_variables').eq('brand_id', brand_id).single();
    const existingVars = brand?.creative_variables || {};
    const existingTemporal = (existingVars.temporal_context || []).filter((t: any) => t.custom);
    const existingSignals = (existingVars.trend_signals || []).filter((t: any) => t.custom);

    const newTemporal = [...generated.temporal_context, ...existingTemporal];
    const newSignals = [...generated.trend_signals, ...existingSignals];

    const newVars = {
      ...existingVars,
      temporal_context: newTemporal,
      trend_signals: newSignals,
      context_last_updated: now.toISOString(),
    };

    await supabase.from('brands').update({ creative_variables: newVars }).eq('brand_id', brand_id);

    return NextResponse.json({ temporal_context: newTemporal, trend_signals: newSignals });
  } catch (e: any) {
    console.error('[Context] Generation failed:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
