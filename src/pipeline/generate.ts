import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { IngestedData, GeneratedConcept, CreativeVariables } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const conceptSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "A list of social media content concepts",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      platform: { type: SchemaType.STRING, description: "instagram or tiktok" },
      content_type: { type: SchemaType.STRING, description: "reel, tiktok_video, or carousel" },
      copy: { type: SchemaType.STRING, description: "The actual post copy / caption" },
      visual_direction: { type: SchemaType.STRING, description: "Detailed description of the image or video to create" },
      image_gen_prompt: { type: SchemaType.STRING, description: "Optimized prompt for an image generation AI model" },
      product_reference: { type: SchemaType.STRING, description: "Which product from the catalog to feature", nullable: true },
      trend_hook: { type: SchemaType.STRING, description: "Which trend this concept leverages and why" },
      rationale: { type: SchemaType.STRING, description: "1-2 sentences on why this will perform well (WHY THIS WORKS)" },
      sprout_data_notes: { type: SchemaType.STRING, description: "Data-backed supporting notes from Sprout Social insights — cite specific engagement rates, audience behaviors, or trend signals that back this concept" },
      confidence_score: { type: SchemaType.NUMBER, description: "0.0 - 1.0 confidence score" }
    },
    required: ["platform", "content_type", "copy", "visual_direction", "image_gen_prompt", "trend_hook", "rationale", "sprout_data_notes", "confidence_score"]
  }
};

function buildDateContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dow = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const dayOfMonth = now.getDate();

  const upcomingWeekend = [5, 6].includes(now.getDay()) ? 'This is the weekend.' : `Weekend is ${6 - now.getDay()} days away.`;

  return `TODAY: ${dateStr}
Day of week: ${dow} — factor in day-of-week posting patterns (e.g., Taco Tuesday, Friday drops, Monday motivation)
Month: ${month}, Day ${dayOfMonth}
${upcomingWeekend}
Consider: national days, upcoming holidays, cultural calendar, retail calendar, and current events relevant to this date.`;
}

export async function generateConcepts(
  brandIdentity: string,
  variables: CreativeVariables,
  data: IngestedData,
  feedbackPattern: string,
  numConcepts: number = 3
): Promise<GeneratedConcept[]> {
  console.log(`[Generate] Prompting Gemini for concepts for ${brandIdentity}...`);

  if (!process.env.GEMINI_API_KEY) {
    console.warn("No GEMINI_API_KEY found, returning mock concepts.");
    return mockConcepts();
  }

  const temporalCtx = variables.temporal_context?.map(t => `- ${t.label}${t.date ? ` (${t.date})` : ''}`).join('\n') || 'None configured.';
  const trendSignals = variables.trend_signals?.map(t => `- [${t.strength.toUpperCase()}] ${t.signal} (${t.source})`).join('\n') || 'None configured.';

  const prompt = `
SYSTEM: You are a senior social media creative strategist.

${buildDateContext()}

BRAND VOICE: ${brandIdentity}

CURRENT CREATIVE DIRECTION (hard constraints):
- Tone: ${variables.tone}
- Topics to PUSH: ${(variables.push_topics || []).join(", ")}
- Topics to AVOID: ${(variables.avoid_topics || []).join(", ")}
- Visual style: ${variables.visual_style}
- Platform priority: ${(variables.platforms_priority || []).join(", ")}
- Creativity level: ${variables.creativity ?? 0.8} (0=conservative, 1=wild)
- Trend weight: ${variables.trend_weight ?? 0.6} (0=evergreen, 1=trendy)
- Locations/markets: ${(variables.locations || []).join(", ") || 'General'}
- Public topic alignment: ${(variables.public_topic_alignment || []).join(", ") || 'None specified'}

UPCOMING TEMPORAL CONTEXT:
${temporalCtx}

TREND SIGNALS:
${trendSignals}

SPROUT SOCIAL DATA (${data.sprout_connected ? 'LIVE' : 'mock — connect Sprout API for real data'}):
Trends: ${JSON.stringify(data.trends, null, 2)}
Top performing posts: ${JSON.stringify(data.top_performing_posts, null, 2)}
Audience insights: ${JSON.stringify(data.audience_snapshot, null, 2)}

FEEDBACK PATTERN:
${feedbackPattern}

TASK: Generate exactly 3 social post concepts. The mix MUST include:
1. One Instagram Reel (platform: "instagram", content_type: "reel")
2. One TikTok video (platform: "tiktok", content_type: "tiktok_video")
3. One Instagram Carousel or Image post (platform: "instagram", content_type: "carousel" or "static")

For sprout_data_notes: Reference specific data points from the Sprout Social data above (engagement rates, audience insights, trend signals). If Sprout data is mock, still write realistic-sounding data backing notes grounded in the concept's platform and content type best practices.
`;

  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro"];
  let result: any = null;
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    console.log(`[Generate] Attempting with model: ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: conceptSchema,
          temperature: variables.creativity ?? 0.8,
        }
      });
      result = await model.generateContent(prompt);
      console.log(`[Generate] Success with ${modelName}`);
      break;
    } catch (err: any) {
      console.warn(`[Generate] Model ${modelName} failed (${err.message}). Falling back...`);
      lastError = err;
    }
  }

  if (!result) {
    console.error("Error generating concepts after exhausting all models:", lastError);
    throw lastError;
  }

  try {
    const responseText = result.response.text();
    const concepts: GeneratedConcept[] = JSON.parse(responseText);
    return concepts;
  } catch (error) {
    console.error("Error parsing concept JSON:", error);
    throw error;
  }
}

function mockConcepts(): GeneratedConcept[] {
  return [
    {
      platform: "instagram",
      content_type: "reel",
      copy: "Your Tuesday needs more queso. Ours always does. 🧀 #FuzzysTacoShop",
      visual_direction: "Overhead slow-motion of queso dip being poured, steam rising, chips in frame. Warm golden-hour lighting. Brand colors in background.",
      image_gen_prompt: "Overhead shot of delicious yellow queso dip in a black bowl surrounded by crispy tortilla chips. Warm, vibrant lighting. Tex-Mex restaurant aesthetic.",
      product_reference: "Queso",
      trend_hook: "Tuesday engagement peaks for food brands; ASMR food Reels 3x avg reach",
      rationale: "Queso content consistently earns highest saves and shares. Lunch-hour posting window aligns with audience peak at 11am-1pm.",
      sprout_data_notes: "Carousel posts featuring food close-ups average 5.8% engagement rate vs 3.2% category benchmark. Audience in TX/CO/OK peaks on weekday lunches. Similar queso content drove 2.1x saves last quarter.",
      confidence_score: 0.87
    }
  ];
}
