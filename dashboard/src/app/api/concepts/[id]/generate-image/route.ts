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

const IMAGE_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];

async function generateAndUpload(
  supabase: ReturnType<typeof getSupabase>,
  prompt: string,
  conceptId: string,
  pdp?: PDPRef
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  const parts: any[] = [];
  if (pdp) {
    parts.push({ inlineData: { mimeType: pdp.mimeType, data: pdp.buffer.toString('base64') } });
    parts.push({ text: `Using the product image above as the hero product (keep it recognizable), create a premium social media visual: ${prompt}` });
  } else {
    parts.push({ text: prompt });
  }

  let imagePart: any = null;
  const modelErrors: string[] = [];

  for (const modelName of IMAGE_MODELS) {
    try {
      console.log(`[ImageGen] Trying model ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } as any,
      });

      const allParts = result.response.candidates?.[0]?.content?.parts || [];
      const partSummary = allParts.map((p: any) => p.inlineData ? `image(${p.inlineData.mimeType})` : `text(${(p.text || '').slice(0, 120)})`).join(' | ');
      console.log(`[ImageGen] ${modelName} returned ${allParts.length} part(s): ${partSummary}`);

      imagePart = allParts.find((p: any) => p.inlineData);
      if (imagePart) { console.log(`[ImageGen] Got image from ${modelName}`); break; }

      const textParts = allParts.filter((p: any) => p.text).map((p: any) => p.text).join(' ');
      modelErrors.push(`${modelName}: no image part${textParts ? ` — model said: "${textParts.slice(0, 200)}"` : ''}`);
    } catch (e: any) {
      console.warn(`[ImageGen] Model ${modelName} failed: ${e.message}`);
      modelErrors.push(`${modelName}: ${e.message}`);
    }
  }

  if (!imagePart?.inlineData) {
    throw new Error(`No image returned. Model attempts: ${modelErrors.join(' | ')}`);
  }

  const { data: base64, mimeType } = imagePart.inlineData;
  const ext = mimeType?.includes('png') ? 'png' : 'jpg';
  const fileName = `concepts/${conceptId}/${Date.now()}.${ext}`;
  const imageBuffer = Buffer.from(base64, 'base64');

  const { error: uploadError } = await supabase.storage
    .from('concept-images')
    .upload(fileName, imageBuffer, { contentType: mimeType || 'image/jpeg' });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
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
