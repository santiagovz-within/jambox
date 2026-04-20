import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('[Slack] SLACK_SIGNING_SECRET not set — skipping signature check');
    return true; // allow in dev; set secret in prod
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.warn('[Slack] Replay attack detected — timestamp too old');
    return false;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const computed = `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') || '';
  const signature = req.headers.get('x-slack-signature') || '';

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get('payload');
  if (!payloadStr) return new NextResponse('', { status: 200 });

  let payload: any;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return new NextResponse('', { status: 200 });
  }

  const action = payload.actions?.[0];
  if (!action?.value) return new NextResponse('', { status: 200 });

  // value format: "approve_<uuid>", "reject_<uuid>", "edit_<uuid>"
  const underscoreIdx = action.value.indexOf('_');
  const actionType = action.value.slice(0, underscoreIdx);
  const conceptId = action.value.slice(underscoreIdx + 1);

  const responseUrl: string | undefined = payload.response_url;
  const userId: string | undefined = payload.user?.id;
  const userName: string = payload.user?.name || payload.user?.username || 'Slack User';

  const supabase = getSupabase();

  if (actionType === 'approve' || actionType === 'reject') {
    const dbStatus = actionType === 'reject' ? 'rejected' : 'approved';

    // Conditional update — only if still pending (first click wins)
    const { data: updated, error: updateErr } = await supabase
      .from('concepts')
      .update({ status: dbStatus })
      .eq('id', conceptId)
      .eq('status', 'pending')
      .select('id');

    if (updateErr) {
      console.error(`[Slack] DB update failed: ${updateErr.message}`);
    }

    if (!updated || updated.length === 0) {
      // Already decided elsewhere — send ephemeral to the clicker
      const { data: current } = await supabase.from('concepts').select('status').eq('id', conceptId).single();
      const currentLabel = current?.status === 'approved' ? '✅ Approved' : current?.status === 'rejected' ? '❌ Rejected' : current?.status ?? 'decided';
      if (responseUrl) {
        await fetch(responseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            response_type: 'ephemeral',
            text: `This concept is already *${currentLabel}*. To change it, open the JamBox dashboard.`,
          }),
        });
      }
      return new NextResponse('', { status: 200 });
    }

    await supabase.from('feedback').insert({
      concept_id: conceptId,
      action: dbStatus,
      reviewer_slack_id: userId || 'slack',
      reviewer_name: userName,
    }).then(({ error }) => {
      if (error) console.warn(`[Slack] Feedback log failed: ${error.message}`);
    });

    if (responseUrl) {
      const statusLabel = dbStatus === 'approved' ? '✅ *Approved*' : '❌ *Rejected*';
      const originalBlocks = (payload.message?.blocks || []).filter(
        (b: any) => b.type !== 'actions'
      );
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replace_original: true,
          blocks: [
            ...originalBlocks,
            {
              type: 'context',
              elements: [{ type: 'mrkdwn', text: `${statusLabel} by ${userName}` }],
            },
          ],
        }),
      });
    }
  } else if (actionType === 'edit') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const editUrl = appUrl ? `${appUrl}/concepts/${conceptId}` : `concept ID: ${conceptId}`;

    if (responseUrl) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: `To edit this concept, open the JamBox dashboard: ${editUrl}`,
        }),
      });
    }
  }

  return new NextResponse('', { status: 200 });
}
