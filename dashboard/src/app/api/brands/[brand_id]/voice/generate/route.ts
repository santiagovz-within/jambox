import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: { brand_id: string } }) {
  try {
    const { brand_name, description, tone, creativity, trend_weight } = await req.json();

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Voice description is required' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a brand voice expert helping calibrate the voice for ${brand_name || params.brand_id}.

Brand voice description from the team:
"${description}"

Settings: Tone = ${tone || 'witty'}, Creativity = ${Math.round((creativity ?? 0.7) * 10)}/10, Trend weight = ${Math.round((trend_weight ?? 0.6) * 10)}/10

Generate 5 short social media captions (1–3 sentences each) that perfectly match this voice description.
Make them feel genuinely different from each other — vary format, hook style, and energy.
Do NOT add hashtags or emojis unless the voice description implies them.

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
