import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });

  const { action, edited_copy } = await req.json();

  if (!['approve', 'reject', 'edit'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const dbStatus = action === 'reject' ? 'rejected' : 'approved';
  const updatePayload: Record<string, any> = { status: dbStatus };
  if (action === 'edit' && edited_copy) {
    updatePayload.edited_copy = edited_copy;
  }

  const { error: updateErr } = await supabase
    .from('concepts')
    .update(updatePayload)
    .eq('id', params.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log to feedback table for the learning loop
  const { error: feedbackErr } = await supabase.from('feedback').insert({
    concept_id: params.id,
    action: dbStatus,
    reviewer_slack_id: 'web_ui',
    reviewer_name: 'Dashboard User',
    edit_diff: action === 'edit' && edited_copy ? { edited_copy } : null,
  });

  if (feedbackErr) {
    console.warn(`[Action] Feedback log failed: ${feedbackErr.message}`);
  }

  return NextResponse.json({ success: true, status: dbStatus });
}
