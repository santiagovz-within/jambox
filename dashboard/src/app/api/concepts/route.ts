import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // Use keys from standard location or assume standard root .env
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase Credentials in environment" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Fetch concepts and eagerly load their generated images if any exist
  const { data: concepts, error } = await supabase
    .from('concepts')
    .select(`
      *,
      generated_images (image_url, variation_label)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[concepts] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ concepts });
}
