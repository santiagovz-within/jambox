import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 30;

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function POST(req: Request, { params }: { params: { brand_id: string } }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing DB credentials' }, { status: 500 });

  try {
    const { brand_name, description, rounds } = await req.json();

    const allYesSamples: string[] = (rounds ?? []).flatMap((r: any) =>
      r.samples.filter((s: any) => s.decision === 'yes').map((s: any) => s.text as string)
    );
    const allNoReasons: string[] = (rounds ?? []).flatMap((r: any) =>
      r.samples.filter((s: any) => s.decision === 'no' && s.reasoning).map((s: any) => s.reasoning as string)
    );

    // Synthesize a voice brief via Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const briefPrompt = `You are a brand voice strategist. Write a concise 3–4 sentence voice brief for ${brand_name || params.brand_id} based on the following inputs.

Original description from the team:
"${description}"

Approved example captions (what sounds right):
${allYesSamples.map(s => `- "${s}"`).join('\n') || '(none yet)'}

Things to avoid (patterns from rejections):
${allNoReasons.map(r => `- ${r}`).join('\n') || '(none)'}

Write the brief in second-person imperative ("You are...", "Speak as...", "Avoid..."). It will be injected into AI content generation prompts, so make it precise and actionable. Return only the brief text, no preamble.`;

    const result = await model.generateContent(briefPrompt);
    const voiceBrief = result.response.text().trim();

    // Save locked voice profile
    await supabase
      .from('brands')
      .update({
        voice_profile: {
          locked: true,
          locked_examples: allYesSamples,
          rounds,
        },
        brand_identity_doc: voiceBrief,
      })
      .eq('brand_id', params.brand_id);

    return NextResponse.json({ success: true, voice_brief: voiceBrief });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
