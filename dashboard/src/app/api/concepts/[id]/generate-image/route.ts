import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { matchProductInCopy, findPDPForProduct, downloadDriveFile } from '@/lib/google-drive';

export const maxDuration = 60;

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface PDPRef { buffer: Buffer; mimeType: string; filename: string }

async function generateAndUpload(
  supabase: ReturnType<typeof getSupabase>,
  prompt: string,
  conceptId: string,
  label: string,
  pdp?: PDPRef
): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image-preview' });

  const parts: any[] = [];
  if (pdp) {
    // Include PDP as visual reference for the product
    parts.push({ inlineData: { mimeType: pdp.mimeType, data: pdp.buffer.toString('base64') } });
    parts.push({ text: `Using the product image above as the hero product to feature (keep the product recognizable), create a premium social media image: ${prompt}` });
  } else {
    parts.push({ text: prompt });
  }

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
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

  // Fetch concept and brand config in parallel
  const [conceptRes, _] = await Promise.all([
    supabase.from('concepts')
      .select('image_gen_prompt, copy, brand_id')
      .eq('id', params.id)
      .single(),
    Promise.resolve(),
  ]);

  const concept = conceptRes.data;
  if (!concept) return NextResponse.json({ error: 'Concept not found' }, { status: 404 });

  // Fetch brand to get pdp_folder_url and menu_items
  const { data: brand } = await supabase
    .from('brands')
    .select('config, creative_variables')
    .eq('brand_id', concept.brand_id)
    .single();

  const pdpFolderUrl: string = brand?.config?.pdp_folder_url || '';
  const menuItems: string[] = brand?.creative_variables?.menu_items || [];

  // Try to find a matching PDP image from Google Drive
  let pdpRef: PDPRef | undefined;
  if (pdpFolderUrl && menuItems.length > 0 && concept.copy) {
    const matchedProduct = matchProductInCopy(concept.copy, menuItems);
    if (matchedProduct) {
      console.log(`[ImageGen] Matched product in copy: "${matchedProduct}"`);
      const pdpFile = await findPDPForProduct(pdpFolderUrl, matchedProduct);
      if (pdpFile) {
        const downloaded = await downloadDriveFile(pdpFile.fileId);
        if (downloaded) {
          pdpRef = { buffer: downloaded.buffer, mimeType: downloaded.mimeType, filename: pdpFile.name };
          console.log(`[ImageGen] Using PDP: ${pdpFile.name}`);
        }
      }
    } else {
      console.log('[ImageGen] No menu item matched in copy — using prompt-only generation');
    }
  }

  const prompt = concept.image_gen_prompt || `Premium product photography: ${concept.copy}`;
  const variations = ['A', 'B', 'C'];
  const images: { url: string; label: string; pdp_used?: string }[] = [];

  for (const label of variations) {
    try {
      const url = await generateAndUpload(supabase, prompt, params.id, label, pdpRef);
      if (url) {
        images.push({ url, label, pdp_used: pdpRef?.filename });
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
    return NextResponse.json({ error: 'Image generation failed — check GEMINI_API_KEY and concept-images bucket' }, { status: 500 });
  }

  return NextResponse.json({ images, pdp_matched: pdpRef?.filename || null });
}
