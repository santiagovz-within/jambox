import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120;

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 });
  }

  const { image_url } = await req.json();
  if (!image_url) return NextResponse.json({ error: 'image_url is required' }, { status: 400 });

  const supabase = getSupabase();

  const { data: concept } = await supabase
    .from('concepts')
    .select('copy, platform, content_type')
    .eq('id', params.id)
    .single();

  const isVertical = ['tiktok', 'reel', 'story'].some(t =>
    concept?.platform?.includes('tiktok') || concept?.content_type?.includes(t)
  );

  try {
    // FAL.AI Kling video generation (image-to-video)
    // Docs: https://fal.ai/models/fal-ai/kling-video
    const falRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/image-to-video', {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url,
        prompt: `A dynamic social media video, smooth motion, ${concept?.copy?.slice(0, 100) || 'engaging brand content'}`,
        duration: '5',
        aspect_ratio: isVertical ? '9:16' : '1:1',
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      throw new Error(`FAL API error ${falRes.status}: ${errText}`);
    }

    const falData = await falRes.json();
    const requestId = falData.request_id;

    if (!requestId) throw new Error('No request_id from FAL');

    // Poll for result (FAL uses async queue)
    let videoUrl: string | null = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(r => setTimeout(r, 4000));
      const pollRes = await fetch(`https://queue.fal.run/fal-ai/kling-video/v1.6/standard/image-to-video/requests/${requestId}`, {
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      });
      const pollData = await pollRes.json();
      if (pollData.status === 'COMPLETED') {
        videoUrl = pollData.video?.url || pollData.output?.video?.url;
        break;
      }
      if (pollData.status === 'FAILED') throw new Error(`FAL generation failed: ${pollData.error}`);
    }

    if (!videoUrl) throw new Error('Video generation timed out');

    // Save video URL to concepts table (requires migration 001_add_concept_fields.sql)
    await supabase
      .from('concepts')
      .update({ generated_video_url: videoUrl })
      .eq('id', params.id)
      .then(({ error: e }) => {
        if (e) console.warn(`[VideoGen] Could not save video URL — run migration 001: ${e.message}`);
      });

    return NextResponse.json({ video_url: videoUrl });
  } catch (e: any) {
    console.error('[VideoGen] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
