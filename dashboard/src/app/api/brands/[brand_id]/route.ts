import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function DELETE(_req: Request, { params }: { params: { brand_id: string } }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing DB credentials' }, { status: 500 });

  const { brand_id } = params;

  const { error } = await supabase
    .from('brands')
    .update({ active: false })
    .eq('brand_id', brand_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
