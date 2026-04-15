import { VercelRequest, VercelResponse } from "@vercel/node";
import { WebClient } from "@slack/web-api";
import { generateImagesForConcept } from "../src/pipeline/generateImages";
import { fetchProductReferenceUrl, uploadGeneratedImage } from "../src/pipeline/drive";
import { createClient } from "@supabase/supabase-js";
// Assuming supabase client might be imported here later

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Parse the payload from Slack
    const payloadBuffer = req.body.payload;
    if (!payloadBuffer) {
      // Slack URL verification or other requests
      if (req.body.type === "url_verification") {
        return res.status(200).json({ challenge: req.body.challenge });
      }
      return res.status(400).json({ error: "No payload found" });
    }

    const payload = JSON.parse(payloadBuffer);

    // Slack expects a 200 OK within 3 seconds, so we respond immediately
    res.status(200).send("");

    // 2. Handle block_actions (button clicks)
    if (payload.type === "block_actions") {
      const action = payload.actions[0];
      const actionId = action.value; // e.g. "approve_123e4567..."

      const channelId = payload.channel.id;
      const messageTs = payload.message.ts;
      const userId = payload.user.id;

      // Extract DB UUID
      const actionType = actionId.split('_')[0];
      const conceptId = actionId.replace(`${actionType}_`, "");

      console.log(`User ${userId} clicked ${actionType} on message ${messageTs} for concept: ${conceptId}`);

      const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
      const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '');

      let statusText = "";
      let requireImageGeneration = false;
      let promptToGenerate = "";
      let productRef = "";
      let dbStatus = "proposed";

      if (actionType === "approve") {
        statusText = "✅ *APPROVED* by <@" + userId + ">. Generating images... ⏳";
        requireImageGeneration = true;
        promptToGenerate = "High quality product shot showcasing vibrant colors"; 
        productRef = "Style";
        dbStatus = "approved";

      } else if (actionType === "reject") {
        statusText = "❌ *REJECTED* by <@" + userId + ">. Noted for learning.";
        dbStatus = "rejected";
      } else if (actionType === "edit") {
        statusText = "✏️ *EDIT & APPROVE* flow triggered by <@" + userId + ">...";
        dbStatus = "approved"; // Treat as proceeding
      }

      // Live Supabase DB Logging
      if (conceptId && conceptId.length > 5) {
        await supabase.from('concepts').update({ status: dbStatus }).eq('id', conceptId);
        await supabase.from('feedback').insert({ concept_id: conceptId, action_type: dbStatus, reviewer_slack_id: userId });
      }

      // We reconstruct the blocks, removing the buttons and adding the status
      const originalBlocks = payload.message.blocks;
      const newBlocks = originalBlocks.filter((b: any) => b.type !== "actions");
      newBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: statusText
        }
      });

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: "Concept updated",
        blocks: newBlocks
      });

      // Background image generation if approved
      if (requireImageGeneration) {
        // Run asynchronously so Vercel doesn't hold up the webhook respond unless it's edge
        Promise.resolve().then(async () => {
             // 1. Get reference image
             const refImage = await fetchProductReferenceUrl("fuzzys_taco_shop", productRef);
             // 2. Generate new images
             const generatedImages = await generateImagesForConcept(promptToGenerate, refImage || "", 3);
             
             // 3. Inject Generated URLs into Supabase
             if (conceptId && conceptId.length > 5) {
                const imageRows = generatedImages.map(img => ({
                   concept_id: conceptId,
                   url: img.url,
                   variation_label: img.variation_label,
                   status: 'generated'
                }));
                const res = await supabase.from('generated_images').insert(imageRows);
                if (res.error) console.error("Db insertion error for images", res.error);
             }

             // 4. Post back to Slack thread with buttons
             const imageBlocks = [
               {
                 type: "section",
                 text: {
                   type: "mrkdwn",
                   text: \`*🖼️ Generated Images for Concept*\`
                 }
               }
             ];

             const actionElements: any[] = [];
             generatedImages.forEach((gen, idx) => {
               imageBlocks.push({
                  type: "image",
                  image_url: gen.url,
                  alt_text: \`Variation \${gen.variation_label}\`
               } as any);
               
               actionElements.push({
                 type: "button",
                 text: {
                   type: "plain_text",
                   text: \`✅ Approve Img \${gen.variation_label}\`,
                   emoji: true
                 },
                 value: \`approve_img_\${idx}\`
               });
             });

             imageBlocks.push({
                type: "actions",
                elements: actionElements
             } as any);

             // Reply in thread
             await slack.chat.postMessage({
               channel: channelId,
               thread_ts: messageTs,
               text: "Images generated",
               blocks: imageBlocks
             });

        }).catch(err => console.error("Async image gen failed:", err));
      }
    }

  } catch (error) {
    console.error("Error handling slack webhook:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}
