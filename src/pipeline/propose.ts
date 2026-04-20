import { WebClient } from "@slack/web-api";
import { GeneratedConcept } from "../types";

export async function proposeConcepts(
  channelId: string,
  concepts: GeneratedConcept[]
): Promise<void> {
  console.log(`[Propose] Posting ${concepts.length} concepts to Slack channel ${channelId}...`);

  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("No SLACK_BOT_TOKEN found. Preview:");
    console.log(JSON.stringify(concepts, null, 2));
    return;
  }

  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    const platformLabel = `${capitalize(concept.platform)} ${formatContentType(concept.content_type)}`;
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🎯 Concept #${i + 1} — ${platformLabel}`,
          emoji: true
        }
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `Generated for *${today}* · Confidence: *${Math.round(concept.confidence_score * 100)}%*` }]
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 COPY:*\n>${concept.copy.replace(/\n/g, "\n>")}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎨 VISUAL DIRECTION:*\n${concept.visual_direction}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💡 WHY THIS WORKS:*\n${concept.rationale}\n_Trend hook:_ ${concept.trend_hook}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📊 SPROUT AI DATA BACKING NOTES:*\n${concept.sprout_data_notes || '_No Sprout data — connect SPROUT_API_TOKEN to enable_'}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ YES", emoji: true },
            style: "primary",
            value: `approve_${(concept as any).id || i}`
          },
          {
            type: "button",
            text: { type: "plain_text", text: "❌ NO", emoji: true },
            style: "danger",
            value: `reject_${(concept as any).id || i}`
          },
          {
            type: "button",
            text: { type: "plain_text", text: "✏️ EDIT & APPROVE", emoji: true },
            value: `edit_${(concept as any).id || i}`
          }
        ]
      }
    ];

    try {
      await slack.chat.postMessage({
        channel: channelId,
        text: `New ${platformLabel} concept`,
        blocks,
      });
    } catch (e) {
      console.error(`[Propose] Failed to post concept ${i + 1}:`, e);
    }
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatContentType(ct: string) {
  const map: Record<string, string> = {
    reel: 'Reel',
    tiktok_video: 'Video',
    carousel: 'Carousel',
    static: 'Post',
    video_script: 'Video',
    story: 'Story',
  };
  return map[ct] || capitalize(ct);
}
