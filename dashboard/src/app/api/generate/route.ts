import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebClient } from '@slack/web-api';

export const maxDuration = 60;

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function buildDateContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dow = now.toLocaleDateString('en-US', { weekday: 'long' });
  return `TODAY: ${dateStr}\nDay of week: ${dow} — factor in day-of-week patterns (Taco Tuesday, Friday drops, Monday motivation, etc.)`;
}

function formatContentType(ct: string) {
  const map: Record<string, string> = {
    reel: 'Reel', tiktok_video: 'Video', carousel: 'Carousel',
    static: 'Post', video_script: 'Video', story: 'Story',
  };
  return map[ct] || ct;
}

export async function POST(req: Request) {
  try {
    const { brand_id } = await req.json();
    const supabase = getSupabase();

    let query = supabase.from('brands').select('*');
    if (brand_id) query = query.eq('brand_id', brand_id);
    const { data: brands, error: brandsError } = await query;

    if (brandsError) throw new Error(`Failed to fetch brands: ${brandsError.message}`);
    if (!brands || brands.length === 0) throw new Error('No brands found in database.');

    console.log(`[Generate] Running pipeline for ${brands.length} brand(s)`);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const results: string[] = [];

    for (const brand of brands) {
      const vars = brand.creative_variables || {};
      const storedChannelId = brand.config?.channel_id || '';
      const envChannelId = process.env.SLACK_CHANNEL_ID || '';
      const isPlaceholder = !storedChannelId || storedChannelId.startsWith('C_') || storedChannelId === 'C0123456789';
      const channelId = isPlaceholder ? envChannelId : storedChannelId;

      if (!channelId) {
        const reason = `Skipped ${brand.brand_id}: no valid channel ID (stored="${storedChannelId}", env="${envChannelId ? 'SET' : 'MISSING'}")`;
        console.log(`[Generate] ${reason}`);
        results.push(reason);
        continue;
      }

      console.log(`[Generate] Using channel ${channelId} for ${brand.brand_id}`);

      const temporalCtx = (vars.temporal_context || []).map((t: any) => `- ${t.label}${t.date ? ` (${t.date})` : ''}`).join('\n') || 'None configured.';
      const trendSignals = (vars.trend_signals || []).map((t: any) => `- [${(t.strength || 'medium').toUpperCase()}] ${t.signal} (${t.source})`).join('\n') || 'None configured.';

      const prompt = `
You are a senior social media creative strategist for ${brand.brand_name}.

${buildDateContext()}

BRAND CREATIVE DIRECTION:
- Tone: ${vars.tone || 'engaging'}
- Topics to push: ${(vars.push_topics || []).join(', ')}
- Topics to avoid: ${(vars.avoid_topics || []).join(', ')}
- Visual style: ${vars.visual_style || 'clean, modern'}
- Creativity: ${vars.creativity ?? 0.8} (0=conservative, 1=wild)
- Trend weight: ${vars.trend_weight ?? 0.6} (0=evergreen, 1=trendy)
- Locations: ${(vars.locations || []).join(', ') || 'General'}
- Public topic alignment: ${(vars.public_topic_alignment || []).join(', ') || 'None'}

UPCOMING TEMPORAL CONTEXT:
${temporalCtx}

TREND SIGNALS:
${trendSignals}

Generate exactly 3 social media content concepts. The mix MUST include:
1. One Instagram Reel (platform: "instagram", content_type: "reel")
2. One TikTok video (platform: "tiktok", content_type: "tiktok_video")
3. One Instagram Carousel or Image (platform: "instagram", content_type: "carousel" or "static")

Return a JSON array with this exact structure:
[{
  "platform": "instagram",
  "content_type": "reel",
  "copy": "caption text",
  "visual_direction": "detailed visual description",
  "image_gen_prompt": "optimized AI image generation prompt",
  "trend_hook": "which trend this leverages and why",
  "rationale": "1-2 sentences on why this will perform well (WHY THIS WORKS)",
  "sprout_data_notes": "data-backed supporting notes — cite engagement rates, audience behaviors, platform benchmarks, or trend signals specific to this content type",
  "confidence_score": 0.85
}]
Only return the JSON array, no other text.`;

      let concepts: any[] = [];
      const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];

      console.log(`[Generate] GEMINI_API_KEY set: ${!!process.env.GEMINI_API_KEY}`);

      for (const modelName of models) {
        try {
          console.log(`[Generate] Trying model ${modelName} for ${brand.brand_id}...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const raw = result.response.text();
          console.log(`[Generate] Raw response (first 200): ${raw.slice(0, 200)}`);
          const text = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          concepts = JSON.parse(text);
          console.log(`[Generate] Got ${concepts.length} concepts for ${brand.brand_id} via ${modelName}`);
          break;
        } catch (e: any) {
          console.error(`[Generate] Model ${modelName} failed: ${e.message}`);
        }
      }

      if (concepts.length === 0) {
        const msg = `All Gemini models failed for ${brand.brand_name} — check GEMINI_API_KEY`;
        console.error(`[Generate] ${msg}`);
        results.push(msg);
        continue;
      }

      const today = new Date().toISOString().split('T')[0];

      for (let i = 0; i < concepts.length; i++) {
        const concept = concepts[i];

        // Save base concept (backward-compatible with existing schema)
        const { data: saved, error: insertError } = await supabase.from('concepts').insert({
          brand_id: brand.brand_id,
          date: today,
          concept_index: i + 1,
          status: 'pending',
          platform: concept.platform,
          content_type: concept.content_type,
          copy: concept.copy,
          visual_direction: concept.visual_direction,
          image_gen_prompt: concept.image_gen_prompt,
          trend_hook: concept.trend_hook,
          rationale: concept.rationale,
          confidence_score: concept.confidence_score,
        }).select().single();

        if (insertError) {
          console.error(`[Generate] Supabase insert failed: ${insertError.message}`);
          results.push(`DB save failed for ${brand.brand_id} concept ${i + 1}: ${insertError.message}`);
          continue;
        }

        const conceptId = saved?.id || 'unknown';

        // Save new fields separately (requires migration 001_add_concept_fields.sql)
        if (conceptId !== 'unknown' && concept.sprout_data_notes) {
          await supabase.from('concepts')
            .update({ sprout_data_notes: concept.sprout_data_notes })
            .eq('id', conceptId)
            .then(({ error: updateErr }) => {
              if (updateErr) console.warn(`[Generate] sprout_data_notes not saved — run migration 001: ${updateErr.message}`);
            });
        }

        const today_label = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        await slack.chat.postMessage({
          channel: channelId,
          text: `New concept for ${brand.brand_name}`,
          blocks: [
            { type: "header", text: { type: "plain_text", text: `🎯 ${brand.brand_name} — Concept ${i + 1} of 3` } },
            { type: "context", elements: [{ type: "mrkdwn", text: `${today_label} · *${concept.platform}* ${formatContentType(concept.content_type)} · Confidence: *${Math.round((concept.confidence_score || 0.8) * 100)}%*` }] },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: `*📝 COPY:*\n>${(concept.copy || '').replace(/\n/g, '\n>')}` } },
            { type: "section", text: { type: "mrkdwn", text: `*🎨 VISUAL DIRECTION:*\n${concept.visual_direction}` } },
            { type: "section", text: { type: "mrkdwn", text: `*💡 WHY THIS WORKS:*\n${concept.rationale}\n_Trend hook:_ ${concept.trend_hook || ''}` } },
            { type: "section", text: { type: "mrkdwn", text: `*📊 SPROUT AI DATA BACKING NOTES:*\n${concept.sprout_data_notes || '_No Sprout data — set SPROUT_API_TOKEN to enable_'}` } },
            {
              type: "actions", elements: [
                { type: "button", style: "primary", text: { type: "plain_text", text: "✅ YES", emoji: true }, value: `approve_${conceptId}` },
                { type: "button", style: "danger", text: { type: "plain_text", text: "❌ NO", emoji: true }, value: `reject_${conceptId}` },
                { type: "button", text: { type: "plain_text", text: "✏️ EDIT & APPROVE", emoji: true }, value: `edit_${conceptId}` }
              ]
            }
          ]
        });
      }

      results.push(`${brand.brand_name}: ${concepts.length} concepts saved + posted to Slack`);
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    console.error("[Generate API] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
