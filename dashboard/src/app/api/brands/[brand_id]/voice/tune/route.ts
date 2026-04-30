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

interface VoiceSample {
  text: string;
  decision: 'yes' | 'no' | null;
  reasoning: string;
}

interface VoiceRound {
  round: number;
  samples: VoiceSample[];
}

export async function POST(req: Request, { params }: { params: { brand_id: string } }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Missing DB credentials' }, { status: 500 });

  try {
    const { brand_name, description, tone, creativity, trend_weight, rounds } = await req.json() as {
      brand_name: string;
      description: string;
      tone: string;
      creativity: number;
      trend_weight: number;
      rounds: VoiceRound[];
    };

    // Save rounds to voice_profile in DB
    const { data: existing } = await supabase
      .from('brands')
      .select('voice_profile')
      .eq('brand_id', params.brand_id)
      .single();

    await supabase
      .from('brands')
      .update({
        voice_profile: { ...(existing?.voice_profile || {}), rounds, locked: false },
        brand_identity_doc: description,
      })
      .eq('brand_id', params.brand_id);

    // Build feedback history for the prompt
    const feedbackHistory = rounds.map((r) => {
      const approved = r.samples.filter(s => s.decision === 'yes');
      const rejected = r.samples.filter(s => s.decision === 'no');
      return `Round ${r.round} feedback:
  APPROVED: ${approved.map(s => `"${s.text}" — ${s.reasoning || 'no reason given'}`).join('; ') || 'none'}
  REJECTED: ${rejected.map(s => `"${s.text}" — ${s.reasoning || 'no reason given'}`).join('; ') || 'none'}`;
    }).join('\n\n');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a brand voice expert refining the voice for ${brand_name || params.brand_id}.

Brand voice description: "${description}"
Settings: Tone = ${tone || 'witty'}, Creativity = ${Math.round((creativity ?? 0.7) * 10)}/10, Trend weight = ${Math.round((trend_weight ?? 0.6) * 10)}/10

${feedbackHistory}

Based on the approved examples (what's working) and rejection reasons (what's off), generate 5 new sample captions that better match the intended voice. Directly address the rejection feedback — if something was "too formal", be looser; if "too slangy", pull back.

Return a JSON array of exactly 5 strings. No other text.
["caption 1", "caption 2", "caption 3", "caption 4", "caption 5"]`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const samples: string[] = JSON.parse(raw);

    return NextResponse.json({ samples });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
