import { createClient } from "@supabase/supabase-js";
import { GeneratedConcept } from "../types";

export const getSupabase = () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) { return null; }
    return createClient(supabaseUrl, supabaseKey);
};

export async function saveConceptsToDb(brandId: string, concepts: GeneratedConcept[]) {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("[DB] Skipping database save (No Supabase keys found in .env).");
    return concepts;
  }

  const today = new Date().toISOString().split('T')[0];

  const rows = concepts.map((c, i) => ({
    brand_id: brandId,
    date: today,
    concept_index: i + 1,
    status: 'pending',
    platform: c.platform,
    content_type: c.content_type,
    copy: c.copy,
    visual_direction: c.visual_direction,
    image_gen_prompt: c.image_gen_prompt,
    product_reference: c.product_reference,
    trend_hook: c.trend_hook,
    rationale: c.rationale,
    confidence_score: c.confidence_score,
  }));

  const { data, error } = await supabase.from('concepts').insert(rows).select();
  if (error) {
    console.error("[DB] Error saving concepts to Supabase:", error);
    return concepts;
  }

  // Save sprout_data_notes separately (requires migration 001_add_concept_fields.sql)
  if (data) {
    for (let i = 0; i < data.length; i++) {
      const sproutNotes = concepts[i]?.sprout_data_notes;
      if (sproutNotes && data[i]?.id) {
        const { error: updateErr } = await supabase
          .from('concepts')
          .update({ sprout_data_notes: sproutNotes })
          .eq('id', data[i].id);
        if (updateErr) {
          console.warn(`[DB] sprout_data_notes not saved — run supabase/migrations/001_add_concept_fields.sql: ${updateErr.message}`);
        }
      }
    }
  }

  console.log(`[DB] Saved ${data?.length} concepts for ${brandId}`);
  return data;
}
