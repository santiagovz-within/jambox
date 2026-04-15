import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { IngestedData, GeneratedConcept, CreativeVariables } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Using a structured schema ensures the model returns exactly the JSON format we need
const conceptSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "A list of social media content concepts",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      platform: { type: SchemaType.STRING, description: "instagram, tiktok, twitter, or facebook" },
      content_type: { type: SchemaType.STRING, description: "static, carousel, video_script, or story" },
      copy: { type: SchemaType.STRING, description: "The actual post copy" },
      visual_direction: { type: SchemaType.STRING, description: "Detailed description of the image/video to create" },
      image_gen_prompt: { type: SchemaType.STRING, description: "optimized prompt for an image generation model like FLUX" },
      product_reference: { type: SchemaType.STRING, description: "Which product from the catalog to feature", nullable: true },
      trend_hook: { type: SchemaType.STRING, description: "Which trend this concept leverages and why" },
      rationale: { type: SchemaType.STRING, description: "1-2 sentences on why this will perform well" },
      confidence_score: { type: SchemaType.NUMBER, description: "0.0 - 1.0 confidence score" }
    },
    required: ["platform", "content_type", "copy", "visual_direction", "image_gen_prompt", "trend_hook", "rationale", "confidence_score"]
  }
};

export async function generateConcepts(
  brandIdentity: string,
  variables: CreativeVariables,
  data: IngestedData,
  feedbackPattern: string,
  numConcepts: number = 3
): Promise<GeneratedConcept[]> {
  console.log(`[Generate] Prompting Gemini for ${numConcepts} concepts...`);
  
  if (!process.env.GEMINI_API_KEY) {
      console.warn("No GEMINI_API_KEY found, returning mock concepts.");
      return mockConcepts();
  }

  const prompt = `
SYSTEM: You are a senior social media creative strategist.

BRAND VOICE: ${brandIdentity}

CURRENT CREATIVE DIRECTION (respect these as hard constraints):
- Tone: ${variables.tone}
- Topics to PUSH: ${variables.push_topics.join(", ")}
- Topics to AVOID: ${variables.avoid_topics.join(", ")}
- Visual style preference: ${variables.visual_style}
- Platform priority: ${variables.platforms_priority.join(", ")}

TODAY'S TREND DATA:
${JSON.stringify(data.trends, null, 2)}

RECENT PERFORMANCE DATA (what's working):
${JSON.stringify(data.top_performing_posts, null, 2)}

AUDIENCE INSIGHTS:
${JSON.stringify(data.audience_snapshot, null, 2)}

FEEDBACK PATTERN (the creative team has historically approved concepts like X and rejected concepts like Y - weight your generation accordingly):
${feedbackPattern}

TASK: Generate exactly ${numConcepts} social post concepts based on the provided inputs.
`;

  const modelsToTry = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.0-flash-preview"];
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
          temperature: 0.8,
        }
      });
      result = await model.generateContent(prompt);
      console.log(`[Generate] Success with ${modelName}`);
      break; 
    } catch (err: any) {
      console.warn(`[Generate] Model ${modelName} failed (${err.status || err.message}). Falling back...`);
      lastError = err;
    }
  }

  if (!result) {
    console.error("Error generating concepts after exhausting all fallback models:", lastError);
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
      content_type: "static",
      copy: "Your Tuesday needs more queso. Ours always does. 🧀 #FuzzysTacoShop",
      visual_direction: "Overhead shot of queso dip with chips, warm lighting, steam rising, brand colors in background.",
      image_gen_prompt: "Overhead shot of delicious yellow queso dip in a black bowl surrounded by crispy tortilla chips. Warm, vibrant lighting. Tex-Mex restaurant aesthetic.",
      product_reference: "Queso",
      trend_hook: "Lunch cravings based on peak hours",
      rationale: "Queso content has high engagement. Audience peak at lunch.",
      confidence_score: 0.82
    }
  ];
}
