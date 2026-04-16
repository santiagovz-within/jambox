import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebClient } from '@slack/web-api';

export const maxDuration = 60;

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: Request) {
  try {
    const { brand_id } = await req.json();
    const supabase = getSupabase();

    // 1. Fetch brands from Supabase
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
      const channelId = brand.config?.channel_id || process.env.SLACK_CHANNEL_ID || '';
      if (!channelId || channelId.startsWith('C_')) {
        console.log(`[Generate] Skipping ${brand.brand_id} — no valid Slack channel.`);
        continue;
      }

      const prompt = `
You are a social media strategist for ${brand.brand_name}.
Brand tone: ${vars.tone || 'engaging'}
Topics to push: ${(vars.push_topics || []).join(', ')}
Topics to avoid: ${(vars.avoid_topics || []).join(', ')}
Visual style: ${vars.visual_style || 'clean, modern'}

Generate exactly 3 social media content concepts. Return a JSON array with this structure:
[{
  "platform": "instagram",
  "content_type": "reel",
  "copy": "caption text here",
  "visual_direction": "description of visual",
  "image_gen_prompt": "detailed prompt for image AI",
  "rationale": "why this will perform well",
  "confidence_score": 0.85
}]
Only return the JSON array, no other text.`;

      let concepts: any[] = [];
      const models = ['gemini-2.5-flash-preview-04-17', 'gemini-2.0-flash', 'gemini-1.5-flash'];

      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          concepts = JSON.parse(text);
          console.log(`[Generate] Got ${concepts.length} concepts for ${brand.brand_id} via ${modelName}`);
          break;
        } catch (e) {
          console.warn(`[Generate] Model ${modelName} failed, trying next...`);
        }
      }

      if (concepts.length === 0) {
        console.error(`[Generate] All models failed for ${brand.brand_id}`);
        continue;
      }

      // Save concepts to Supabase and post to Slack
      const today = new Date().toISOString().split('T')[0];
      for (let i = 0; i < concepts.length; i++) {
        const concept = concepts[i];
        const { data: saved } = await supabase.from('concepts').insert({
          brand_id: brand.brand_id,
          date: today,
          concept_index: i + 1,
          status: 'pending',
          platform: concept.platform,
          content_type: concept.content_type,
          copy: concept.copy,
          visual_direction: concept.visual_direction,
          image_gen_prompt: concept.image_gen_prompt,
          rationale: concept.rationale,
          confidence_score: concept.confidence_score,
        }).select().single();

        const conceptId = saved?.id || 'unknown';

        await slack.chat.postMessage({
          channel: channelId,
          text: `New concept for ${brand.brand_name}`,
          blocks: [
            { type: "header", text: { type: "plain_text", text: `🎯 ${brand.brand_name} — Concept ${i + 1}` } },
            { type: "section", text: { type: "mrkdwn", text: `*Platform:* ${concept.platform} | *Type:* ${concept.content_type}\n\n*Copy:*\n${concept.copy}` } },
            { type: "section", text: { type: "mrkdwn", text: `*Visual:* ${concept.visual_direction}` } },
            { type: "section", text: { type: "mrkdwn", text: `*Why it works:* ${concept.rationale}\n*Confidence:* ${Math.round((concept.confidence_score || 0.8) * 100)}%` } },
            { type: "actions", elements: [
              { type: "button", style: "primary", text: { type: "plain_text", text: "✅ YES", emoji: true }, value: `approve_${conceptId}` },
              { type: "button", style: "danger", text: { type: "plain_text", text: "❌ NO", emoji: true }, value: `reject_${conceptId}` },
              { type: "button", text: { type: "plain_text", text: "✏️ EDIT & APPROVE", emoji: true }, value: `edit_${conceptId}` }
            ]}
          ]
        });
      }
      results.push(`${brand.brand_name}: ${concepts.length} concepts posted to Slack`);
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    console.error("[Generate API] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
