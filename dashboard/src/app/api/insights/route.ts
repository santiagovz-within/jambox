import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getSupabase = () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) { return null; }
    return createClient(supabaseUrl, supabaseKey);
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brand_id') || 'fuzzys_taco_shop';

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ insight: "Database connection unavailable." });

  // 1. Fetch recent feedback
  const { data: feedbackLogs } = await supabase.from('feedback')
    .select('*').eq('brand_id', brandId)
    .order('created_at', { ascending: false }).limit(20);

  // 2. Fetch current brand variables
  const { data: brand } = await supabase.from('brands')
    .select('creative_variables').eq('brand_id', brandId).single();

  const currentVariables = brand?.creative_variables || {};

  if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ insight: "GEMINI_API_KEY not configured. Cannot generate insight." });
  }

  if (!feedbackLogs || feedbackLogs.length === 0) {
      return NextResponse.json({ insight: "Not enough recent feedback data to generate an intelligent learning insight." });
  }

  try {
     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
     const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { temperature: 0.2 } });

     const prompt = `
     SYSTEM: You are a senior social media analyst.
     TASK: Analyze the following feedback log from the creative team (approvals and rejections). 
     Suggest 1 concrete adjustment to the Creative Variables based on this feedback.
     
     CURRENT VARIABLES:
     ${JSON.stringify(currentVariables, null, 2)}
     
     RECENT FEEDBACK:
     ${JSON.stringify(feedbackLogs, null, 2)}
     
     Provide a tightly written paragraph starting with "Over the past week, your team..."
     `;
     const result = await model.generateContent(prompt);
     return NextResponse.json({ insight: result.response.text() });
  } catch (e: any) {
     return NextResponse.json({ insight: "Failed to generate insights: " + e.message });
  }
}
