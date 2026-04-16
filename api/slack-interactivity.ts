import { WebClient } from "@slack/web-api";
import { createClient } from "@supabase/supabase-js";
import { fal } from "@fal-ai/client";

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

    // Background image generation
    if (requireImageGeneration && imageGenPrompt) {
      Promise.resolve().then(async () => {
        try {
          const result = await fal.subscribe("fal-ai/flux/schnell", {
            input: { prompt: imageGenPrompt, num_images: 3 },
            logs: false
          }) as any;

          const images = result?.images || [];

          if (conceptId && conceptId.length > 5 && images.length > 0) {
            const imageRows = images.map((img: any, idx: number) => ({
              concept_id: conceptId,
              image_url: img.url,
              variation_label: ["A", "B", "C"][idx] || String(idx + 1),
              selected: false
            }));
            await supabase.from('generated_images').insert(imageRows);
          }

          const imageBlocks: any[] = [
            { type: "section", text: { type: "mrkdwn", text: `*🖼️ Generated Images Ready!*` } }
          ];

          images.forEach((img: any, idx: number) => {
            imageBlocks.push({
              type: "image",
              image_url: img.url,
              alt_text: `Variation ${["A", "B", "C"][idx] || idx + 1}`
            });
          });

          await slack.chat.postMessage({
            channel: channelId,
            thread_ts: messageTs,
            text: "Generated images ready",
            blocks: imageBlocks
          });
        } catch (err) {
          console.error("Image generation failed:", err);
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
