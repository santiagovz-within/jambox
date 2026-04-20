import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });

  const { data: concept, error } = await supabase
    .from('concepts')
    .select('*, generated_images(id, image_url, variation_label, selected)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ concept });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });

  const { error } = await supabase.from('concepts').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
