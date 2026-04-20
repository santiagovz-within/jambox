import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function generateAndUpload(
  supabase: ReturnType<typeof getSupabase>,
  prompt: string,
  conceptId: string,
  label: string
): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image-preview' });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] } as any,
  });

  const imagePart = result.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData) as any;
  if (!imagePart?.inlineData) return null;

  const { data: base64, mimeType } = imagePart.inlineData;
  const ext = mimeType?.includes('png') ? 'png' : 'jpg';
  const fileName = `concepts/${conceptId}/${label}-${Date.now()}.${ext}`;
  const imageBuffer = Buffer.from(base64, 'base64');

  const { error: uploadError } = await supabase.storage
    .from('concept-images')
    .upload(fileName, imageBuffer, { contentType: mimeType || 'image/png' });

  if (uploadError) {
    console.error(`[ImageGen] Upload failed for ${label}:`, uploadError.message);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from('concept-images').getPublicUrl(fileName);
  return publicUrl;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const supabase = getSupabase();

  const { data: concept } = await supabase
    .from('concepts')
    .select('image_gen_prompt, copy, brand_id')
    .eq('id', params.id)
    .single();

  if (!concept) return NextResponse.json({ error: 'Concept not found' }, { status: 404 });

  const prompt = concept.image_gen_prompt || `Premium product photography: ${concept.copy}`;
  const variations = ['A', 'B', 'C'];
  const images: { url: string; label: string }[] = [];

  for (const label of variations) {
    try {
      const url = await generateAndUpload(supabase, prompt, params.id, label);
      if (url) {
        images.push({ url, label });
        await supabase.from('generated_images').insert({
          concept_id: params.id,
          brand_id: concept.brand_id,
          image_url: url,
          variation_label: label,
          selected: false,
        });
      }
    } catch (e: any) {
      console.error(`[ImageGen] Variation ${label} failed:`, e.message);
    }
  }

  if (images.length === 0) {
    return NextResponse.json({ error: 'Image generation failed — check GEMINI_API_KEY and concept-images Supabase Storage bucket' }, { status: 500 });
  }

  return NextResponse.json({ images });
}
