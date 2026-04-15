import { WebClient } from "@slack/web-api";
import { GeneratedConcept } from "../types";

export async function proposeConcepts(
  channelId: string, 
  concepts: GeneratedConcept[]
): Promise<void> {
  console.log(`[Propose] Posting ${concepts.length} concepts to Slack channel ${channelId}...`);

  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("No SLACK_BOT_TOKEN found. Skipping actual Slack post. See preview below:");
    console.log(JSON.stringify(concepts, null, 2));
    return;
  }

  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🌮 CONCEPT #${i + 1} — ${capitalize(concept.platform)} ${capitalize(concept.content_type)}`,
          emoji: true
        }
      },
      {
        type: "divider"
      },
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
          text: `*📊 WHY THIS WORKS:*\n${concept.rationale}\n_Trend:_ ${concept.trend_hook}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Confidence: *${Math.round(concept.confidence_score * 100)}%*`
          }
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ YES",
              emoji: true
            },
            style: "primary",
            value: `approve_${(concept as any).id || i}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "❌ NO",
              emoji: true
            },
            style: "danger",
            value: `reject_${(concept as any).id || i}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✏️ EDIT & APPROVE",
              emoji: true
            },
            value: `edit_${(concept as any).id || i}`
          }
        ]
      }
    ];

    try {
      await slack.chat.postMessage({
        channel: channelId,
        text: `New Concept: ${concept.platform}`,
        blocks: blocks
      });
    } catch (e) {
      console.error(`Failed to post concept ${i} to Slack:`, e);
    }
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
