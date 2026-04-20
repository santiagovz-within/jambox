import { createHmac, timingSafeEqual } from 'crypto';
import { WebClient } from '@slack/web-api';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Disable Vercel's body parser so we can read the raw body for signature verification
export const config = { api: { bodyParser: false } };

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function readRawBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('[Slack] SLACK_SIGNING_SECRET not set — skipping verification');
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;
  const computed = `v0=${createHmac('sha256', signingSecret)
    .update(`v0:${timestamp}:${body}`)
    .digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function generateAndUploadImage(
  supabase: ReturnType<typeof getSupabase>,
  prompt: string,
  conceptId: string,
  label: string
): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image-preview' });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] } as any,
  });

  const imagePart = result.response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  ) as any;
  if (!imagePart?.inlineData) return null;

  const { data: base64, mimeType } = imagePart.inlineData;
  const ext = mimeType?.includes('png') ? 'png' : 'jpg';
  const fileName = `concepts/${conceptId}/${label}-${Date.now()}.${ext}`;
  const imageBuffer = Buffer.from(base64, 'base64');

  const { error: uploadError } = await supabase.storage
    .from('concept-images')
    .upload(fileName, imageBuffer, { contentType: mimeType || 'image/png' });

  if (uploadError) {
    console.error(`[Images] Upload failed for ${label}:`, uploadError.message);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('concept-images')
    .getPublicUrl(fileName);

  return publicUrl;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);
  const timestamp = req.headers['x-slack-request-timestamp'] || '';
  const signature = req.headers['x-slack-signature'] || '';

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return res.status(401).json({ error: 'Invalid Slack signature' });
  }

  const params = new URLSearchParams(rawBody);

  // Handle Slack URL verification challenge
  if (!params.get('payload')) {
    try {
      const body = JSON.parse(rawBody);
      if (body.type === 'url_verification') return res.status(200).json({ challenge: body.challenge });
    } catch {}
    return res.status(400).json({ error: 'No payload' });
  }

  let payload: any;
  try {
    payload = JSON.parse(params.get('payload')!);
  } catch {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Respond to Slack immediately (must be within 3 seconds)
  res.status(200).end();

  if (payload.type !== 'block_actions') return;

  const action = payload.actions?.[0];
  if (!action?.value) return;

  const underscoreIdx = action.value.indexOf('_');
  const actionType = action.value.slice(0, underscoreIdx);
  const conceptId = action.value.slice(underscoreIdx + 1);

  const channelId = payload.channel?.id;
  const messageTs = payload.message?.ts;
  const userId = payload.user?.id;
  const userName = payload.user?.name || payload.user?.username || 'Slack User';

  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const supabase = getSupabase();

  let dbStatus = 'proposed';
  let statusText = '';
  let requireImages = false;
  let imageGenPrompt = '';

  if (actionType === 'approve') {
    dbStatus = 'approved';
    statusText = `✅ *APPROVED* by <@${userId}>. Generating images... ⏳`;
    requireImages = true;
  } else if (actionType === 'reject') {
    dbStatus = 'rejected';
    statusText = `❌ *REJECTED* by <@${userId}>. Noted for learning.`;
  } else if (actionType === 'edit') {
    dbStatus = 'approved';
    statusText = `✏️ *EDIT & APPROVE* by <@${userId}>. Generating images... ⏳`;
    requireImages = true;
  }

  if (conceptId) {
    // Conditional update — only if still pending (first click wins)
    const { data: updated } = await supabase
      .from('concepts')
      .update({ status: dbStatus })
      .eq('id', conceptId)
      .eq('status', 'pending')
      .select('id, image_gen_prompt, copy');

    if (!updated || updated.length === 0) {
      // Already decided — send ephemeral to the clicker
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
      return;
    }

    const concept = updated[0];
    imageGenPrompt = concept?.image_gen_prompt || (concept?.copy ? `Premium product photography: ${concept.copy}` : '');

    await supabase.from('feedback').insert({
      concept_id: conceptId,
      action: dbStatus,
      reviewer_slack_id: userId || 'slack',
      reviewer_name: userName,
    }).then(({ error }) => {
      if (error) console.warn('[Slack] Feedback log failed:', error.message);
    });
  }

  // Update Slack message — replace action buttons with status line
  if (channelId && messageTs) {
    const newBlocks = (payload.message?.blocks || []).filter((b: any) => b.type !== 'actions');
    newBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: statusText } });
    await slack.chat.update({ channel: channelId, ts: messageTs, text: 'Concept updated', blocks: newBlocks })
      .catch(e => console.error('[Slack] Message update failed:', e.message));
  }

  // Background image generation after approve
  if (requireImages && imageGenPrompt && conceptId) {
    Promise.resolve().then(async () => {
      try {
        const generated: { url: string; label: string }[] = [];
        for (const label of ['A', 'B', 'C']) {
          const url = await generateAndUploadImage(supabase, imageGenPrompt, conceptId, label)
            .catch(e => { console.error(`[Images] Variation ${label} failed:`, e.message); return null; });
          if (url) generated.push({ url, label });
        }

        if (generated.length === 0) {
          await slack.chat.postMessage({ channel: channelId, thread_ts: messageTs, text: '⚠️ Image generation failed — check GEMINI_API_KEY and the `concept-images` Supabase Storage bucket.' });
          return;
        }

        await supabase.from('generated_images').insert(
          generated.map(img => ({ concept_id: conceptId, image_url: img.url, variation_label: img.label, selected: false }))
        );

        await slack.chat.postMessage({
          channel: channelId,
          thread_ts: messageTs,
          text: 'Generated images ready',
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: '*🖼️ Generated Images Ready!*' } },
            ...generated.map(img => ({ type: 'image', image_url: img.url, alt_text: `Variation ${img.label}` })),
          ],
        });
      } catch (e: any) {
        console.error('[Images] Pipeline failed:', e.message);
        await slack.chat.postMessage({ channel: channelId, thread_ts: messageTs, text: `⚠️ Image generation error: ${e.message}` }).catch(() => {});
      }
    });
  }
}
