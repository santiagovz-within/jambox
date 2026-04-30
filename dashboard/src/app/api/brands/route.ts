import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing DB credentials' }, { status: 500 });

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brands: data });
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing DB credentials' }, { status: 500 });

  try {
    const body = await req.json();
    const { action, brand_id, brand_name, creative_variables, config, logo_url } = body;

    // CREATE new brand
    if (action === 'create') {
      if (!brand_name?.trim()) return NextResponse.json({ error: 'brand_name is required' }, { status: 400 });

      const newBrandId = slugify(brand_name);

      const { data: existing } = await supabase
        .from('brands')
        .select('brand_id')
        .eq('brand_id', newBrandId)
        .single();

      if (existing) return NextResponse.json({ error: `Brand ID "${newBrandId}" already exists` }, { status: 409 });

      const defaultVars = {
        tone: 'witty',
        creativity: 0.7,
        trend_weight: 0.6,
        push_topics: [],
        avoid_topics: [],
        visual_style: '',
        menu_items: [],
        locations: [],
        ...(creative_variables || {}),
      };

      const defaultConfig = {
        industry: '',
        channel_id: '',
        ...(config || {}),
      };

      const { data, error } = await supabase
        .from('brands')
        .insert({
          brand_id: newBrandId,
          brand_name: brand_name.trim(),
          active: true,
          config: defaultConfig,
          creative_variables: defaultVars,
          logo_url: logo_url || null,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, brand: data });
    }

    // UPDATE existing brand
    const { data: existing, error: fetchErr } = await supabase
      .from('brands')
      .select('creative_variables, config')
      .eq('brand_id', brand_id)
      .single();

    if (fetchErr) throw fetchErr;

    const updatePayload: Record<string, any> = {};
    if (creative_variables) updatePayload.creative_variables = { ...existing.creative_variables, ...creative_variables };
    if (config) updatePayload.config = { ...existing.config, ...config };
    if (brand_name) updatePayload.brand_name = brand_name.trim();
    if (logo_url !== undefined) updatePayload.logo_url = logo_url;

    const { data, error } = await supabase
      .from('brands')
      .update(updatePayload)
      .eq('brand_id', brand_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, brand: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
