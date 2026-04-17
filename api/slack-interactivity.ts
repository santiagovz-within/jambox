import { WebClient } from "@slack/web-api";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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
    console.error(`[Images] Upload failed for variation ${label}:`, uploadError.message);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('concept-images')
    .getPublicUrl(fileName);

  return publicUrl;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payloadRaw = req.body?.payload;
    if (!payloadRaw) {
      if (req.body?.type === "url_verification") {
        return res.status(200).json({ challenge: req.body.challenge });
      }
      return res.status(400).json({ error: "No payload found" });
    }

    const payload = JSON.parse(payloadRaw);

    // Respond immediately to Slack (it expects a 200 within 3 seconds)
    res.status(200).send("");

    if (payload.type !== "block_actions") return;

    const action = payload.actions[0];
    const actionId = action.value as string;
    const channelId = payload.channel.id;
    const messageTs = payload.message.ts;
    const userId = payload.user.id;

    const actionType = actionId.split('_')[0];
    const conceptId = actionId.replace(`${actionType}_`, "");

    console.log(`[Webhook] User ${userId} clicked ${actionType} on concept: ${conceptId}`);

    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const supabase = getSupabase();

    let statusText = "";
    let requireImageGeneration = false;
    let imageGenPrompt = "";
    let dbStatus = "proposed";

    if (actionType === "approve") {
      statusText = `✅ *APPROVED* by <@${userId}>. Generating images... ⏳`;
      requireImageGeneration = true;
      dbStatus = "approved";
    } else if (actionType === "reject") {
      statusText = `❌ *REJECTED* by <@${userId}>. Noted for learning.`;
      dbStatus = "rejected";
    } else if (actionType === "edit") {
      statusText = `✏️ *EDIT & APPROVE* triggered by <@${userId}>...`;
      dbStatus = "approved";
      requireImageGeneration = true;
    }

    // If we have a concept ID, pull the image gen prompt from the DB
    if (conceptId && conceptId.length > 5) {
      const { data: concept } = await supabase
        .from('concepts')
        .select('image_gen_prompt, copy')
        .eq('id', conceptId)
        .single();

      if (concept?.image_gen_prompt) {
        imageGenPrompt = concept.image_gen_prompt;
      } else if (concept?.copy) {
        imageGenPrompt = `Premium product photography: ${concept.copy}`;
      }

      await supabase.from('concepts').update({ status: dbStatus }).eq('id', conceptId);
      await supabase.from('feedback').insert({
        concept_id: conceptId,
        action: dbStatus,
        reviewer_slack_id: userId
      });
    }

    // Update the original Slack message — remove buttons, show status
    const originalBlocks = payload.message.blocks;
    const newBlocks = originalBlocks.filter((b: any) => b.type !== "actions");
    newBlocks.push({
      type: "section",
      text: { type: "mrkdwn", text: statusText }
    });

    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: "Concept updated",
      blocks: newBlocks
    });

    // Background image generation using Gemini
    if (requireImageGeneration && imageGenPrompt) {
      Promise.resolve().then(async () => {
        try {
          const variations = ['A', 'B', 'C'];
          const generatedImages: { url: string; label: string }[] = [];

          for (const label of variations) {
            const url = await generateAndUploadImage(supabase, imageGenPrompt, conceptId, label).catch(e => {
              console.error(`[Images] Variation ${label} failed:`, e.message);
              return null;
            });
            if (url) generatedImages.push({ url, label });
          }

          if (generatedImages.length === 0) {
            await slack.chat.postMessage({
              channel: channelId,
              thread_ts: messageTs,
              text: "⚠️ Image generation failed — check GEMINI_API_KEY and the `concept-images` Supabase Storage bucket.",
            });
            return;
          }

          if (conceptId && conceptId.length > 5) {
            const imageRows = generatedImages.map(img => ({
              concept_id: conceptId,
              image_url: img.url,
              variation_label: img.label,
              selected: false
            }));
            await supabase.from('generated_images').insert(imageRows);
          }

          const imageBlocks: any[] = [
            { type: "section", text: { type: "mrkdwn", text: `*🖼️ Generated Images Ready!*` } }
          ];

          generatedImages.forEach(img => {
            imageBlocks.push({
              type: "image",
              image_url: img.url,
              alt_text: `Variation ${img.label}`
            });
          });

          await slack.chat.postMessage({
            channel: channelId,
            thread_ts: messageTs,
            text: "Generated images ready",
            blocks: imageBlocks
          });
        } catch (err: any) {
          console.error("[Images] Generation pipeline failed:", err);
          await slack.chat.postMessage({
            channel: channelId,
            thread_ts: messageTs,
            text: `⚠️ Image generation error: ${err.message}`,
          }).catch(() => {});
        }
      });
    }

  } catch (error) {
    console.error("Webhook error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}
