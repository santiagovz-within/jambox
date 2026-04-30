import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function GET(req: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const brand_id = searchParams.get('brand_id');
  const month = searchParams.get('month'); // expects 'YYYY-MM'
  const category = searchParams.get('category');

  let query = supabase
    .from('concepts')
    .select('*, generated_images(image_url, variation_label)')
    .order('created_at', { ascending: false });

  if (brand_id) query = query.eq('brand_id', brand_id);
  if (category) query = query.eq('category', category);

  if (month) {
    const [year, mon] = month.split('-').map(Number);
    const start = `${year}-${String(mon).padStart(2, '0')}-01`;
    const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
    query = query.gte('date', start).lt('date', nextMonth);
  }

  const { data: concepts, error } = await query.limit(50);

  if (error) {
    console.error('[concepts] Supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ concepts });
}
