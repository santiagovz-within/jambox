import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) { return null; }
    return createClient(supabaseUrl, supabaseKey);
};

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing DB Credentials" }, { status: 500 });
  const { data, error } = await supabase.from('brands').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brands: data });
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing DB Credentials" }, { status: 500 });
  
  try {
    const body = await req.json();
    const { brand_id, creative_variables, config } = body;

    const { data: existing, error: fetchErr } = await supabase
      .from('brands')
      .select('creative_variables, config')
      .eq('brand_id', brand_id)
      .single();
    if (fetchErr) throw fetchErr;

    const updatePayload: Record<string, any> = {};
    if (creative_variables) {
      updatePayload.creative_variables = { ...existing.creative_variables, ...creative_variables };
    }
    if (config) {
      updatePayload.config = { ...existing.config, ...config };
    }

    const { data, error } = await supabase.from('brands').update(updatePayload).eq('brand_id', brand_id).select();
    if (error) throw error;

    return NextResponse.json({ success: true, brand: data[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
