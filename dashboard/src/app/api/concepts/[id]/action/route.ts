import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebClient } from '@slack/web-api';

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
  if (action === 'edit' && edited_copy) updatePayload.copy = edited_copy;

  let updated: any[] | null = null;

  if (action === 'edit') {
    // Edit & Approve is always allowed — it's the explicit override path
    const { data, error: updateErr } = await supabase
      .from('concepts')
      .update(updatePayload)
      .eq('id', params.id)
      .select('id, slack_channel_id, slack_message_ts');
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    updated = data;
  } else {
    // YES / NO: conditional update — only if still pending (first click wins)
    const { data, error: updateErr } = await supabase
      .from('concepts')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('status', 'pending')
      .select('id, slack_channel_id, slack_message_ts');
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    if (!data || data.length === 0) {
      const { data: current } = await supabase
        .from('concepts')
        .select('status')
        .eq('id', params.id)
        .single();
      return NextResponse.json(
        { error: 'already_decided', status: current?.status ?? 'unknown' },
        { status: 409 }
      );
    }
    updated = data;
  }

  // Log to feedback table
  await supabase.from('feedback').insert({
    concept_id: params.id,
    action: dbStatus,
    reviewer_slack_id: 'web_ui',
    reviewer_name: 'Dashboard User',
    edit_diff: action === 'edit' && edited_copy ? { edited_copy } : null,
  }).then(({ error }) => {
    if (error) console.warn('[Action] Feedback log failed:', error.message);
  });

  // Update the Slack message to replace buttons with status (if ref stored)
  const { slack_channel_id, slack_message_ts } = updated[0] || {};
  if (slack_channel_id && slack_message_ts && process.env.SLACK_BOT_TOKEN) {
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const statusLabel = dbStatus === 'approved' ? '✅ *Approved* via Dashboard' : '❌ *Rejected* via Dashboard';
    try {
      // Fetch the current message to preserve its blocks
      const history = await slack.conversations.history({
        channel: slack_channel_id,
        latest: slack_message_ts,
        limit: 1,
        inclusive: true,
      });
      const originalBlocks = (history.messages?.[0]?.blocks || []).filter(
        (b: any) => b.type !== 'actions'
      ) as any[];
      await slack.chat.update({
        channel: slack_channel_id,
        ts: slack_message_ts,
        text: 'Concept updated',
        blocks: [
          ...originalBlocks,
          { type: 'context', elements: [{ type: 'mrkdwn', text: statusLabel }] },
        ],
      });
    } catch (e: any) {
      console.warn('[Action] Slack message update failed:', e.message);
    }
  }

  return NextResponse.json({ success: true, status: dbStatus });
}
