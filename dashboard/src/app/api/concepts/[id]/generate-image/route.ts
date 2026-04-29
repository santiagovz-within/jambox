import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { matchProductInCopy, findPDPForProduct, downloadDriveFile } from '@/lib/google-drive';

export const maxDuration = 120;

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface PDPRef { buffer: Buffer; mimeType: string; filename: string }

async function generateAndUpload(
  supabase: ReturnType<typeof getSupabase>,
  prompt: string,
  conceptId: string,
  pdp?: PDPRef
): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-preview-image-generation' });

  const parts: any[] = [];
  if (pdp) {
    parts.push({ inlineData: { mimeType: pdp.mimeType, data: pdp.buffer.toString('base64') } });
    parts.push({ text: `Using the product image above as the hero product (keep it recognizable), create a premium social media visual: ${prompt}` });
  } else {
    parts.push({ text: prompt });
  }

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as any,
  });

  const imagePart = result.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData) as any;
  if (!imagePart?.inlineData) return null;

  const { data: base64, mimeType } = imagePart.inlineData;
  const ext = mimeType?.includes('png') ? 'png' : 'jpg';
  const fileName = `concepts/${conceptId}/${Date.now()}.${ext}`;
  const imageBuffer = Buffer.from(base64, 'base64');

  const { error: uploadError } = await supabase.storage
    .from('concept-images')
    .upload(fileName, imageBuffer, { contentType: mimeType || 'image/jpeg' });

  if (uploadError) {
    console.error('[ImageGen] Upload failed:', uploadError.message);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from('concept-images').getPublicUrl(fileName);
  return publicUrl;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const supabase = getSupabase();

    // Return existing image if already generated (one image per concept)
    const { data: existing } = await supabase
      .from('generated_images')
      .select('image_url')
      .eq('concept_id', params.id)
      .limit(1)
      .maybeSingle();

    if (existing?.image_url) {
      return NextResponse.json({ image_url: existing.image_url, already_generated: true });
    }

    const { data: concept } = await supabase
      .from('concepts')
      .select('image_gen_prompt, copy, brand_id')
      .eq('id', params.id)
      .single();

    if (!concept) return NextResponse.json({ error: 'Concept not found' }, { status: 404 });

    // Try to find a PDP from Google Drive (skip if slow — hard 15s timeout)
    let pdpRef: PDPRef | undefined;
    const { data: brand } = await supabase
      .from('brands')
      .select('config, creative_variables')
      .eq('brand_id', concept.brand_id)
      .single();

    const pdpFolderUrl: string = brand?.config?.pdp_folder_url || '';
    const menuItems: string[] = brand?.creative_variables?.menu_items || [];

    if (pdpFolderUrl && menuItems.length > 0 && concept.copy) {
      const matchedProduct = matchProductInCopy(concept.copy, menuItems);
      if (matchedProduct) {
        console.log(`[ImageGen] Matched product: "${matchedProduct}"`);
        try {
          const pdpFile = await Promise.race([
            findPDPForProduct(pdpFolderUrl, matchedProduct),
            new Promise<null>(res => setTimeout(() => res(null), 10000)), // 10s timeout
          ]);
          if (pdpFile) {
            const downloaded = await Promise.race([
              downloadDriveFile(pdpFile.fileId),
              new Promise<null>(res => setTimeout(() => res(null), 10000)),
            ]);
            if (downloaded) {
              pdpRef = { buffer: downloaded.buffer, mimeType: downloaded.mimeType, filename: pdpFile.name };
              console.log(`[ImageGen] Using PDP: ${pdpFile.name}`);
            }
          }
        } catch (e: any) {
          console.warn('[ImageGen] PDP lookup failed, continuing without it:', e.message);
        }
      }
    }

    const prompt = concept.image_gen_prompt || `Premium product photography for social media: ${concept.copy}`;
    const imageUrl = await generateAndUpload(supabase, prompt, params.id, pdpRef);

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image generation failed — check GEMINI_API_KEY and concept-images Supabase bucket' }, { status: 500 });
    }

    await supabase.from('generated_images').insert({
      concept_id: params.id,
      brand_id: concept.brand_id,
      image_url: imageUrl,
      variation_label: 'A',
      selected: true,
    });

    return NextResponse.json({ image_url: imageUrl, pdp_matched: pdpRef?.filename || null });
  } catch (e: any) {
    console.error('[ImageGen] Unhandled error:', e.message);
    return NextResponse.json({ error: e.message || 'Image generation failed' }, { status: 500 });
  }
}
