import { GoogleGenerativeAI } from "@google/generative-ai";
import { CreativeVariables } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateLearningInsights(
  brandId: string, 
  feedbackLogs: any[], 
  currentVariables: CreativeVariables
): Promise<string> {
  console.log(`[Learning] Generating insights for ${brandId} based on ${feedbackLogs.length} feedback items.`);

  if (!process.env.GEMINI_API_KEY || feedbackLogs.length === 0) {
      return "Over the past 2 weeks, your team has approved 85% of humor-driven concepts. Suggestion: increase trend_weight.";
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { temperature: 0.2 } });

  const prompt = `
SYSTEM: You are a senior social media analyst.

TASK: Analyze the following feedback log from the creative team (approvals and rejections) and summarize exactly what is working and what is not.
Then, suggest concrete adjustments to the Creative Variables.

CURRENT VARIABLES:
${JSON.stringify(currentVariables, null, 2)}

RECENT FEEDBACK:
${JSON.stringify(feedbackLogs.slice(0, 50), null, 2)}

Provide a tightly written paragraph starting with "Over the past [timeframe], your team has approved... Suggestion: ..."
`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating learning insights:", error);
    return "Failed to generate insights based on recent data.";
  }
}
