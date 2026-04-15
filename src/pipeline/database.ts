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
  
  const rows = concepts.map(c => ({
    brand_id: brandId,
    platform: c.platform,
    content_type: c.content_type,
    copy: c.copy,
    visual_direction: c.visual_direction,
    product_reference: c.product_reference,
    trend_hook: c.trend_hook,
    rationale: c.rationale,
    confidence_score: c.confidence_score,
    status: 'proposed'
  }));

  const { data, error } = await supabase.from('concepts').insert(rows).select();
  if (error) {
    console.error("[DB] Error saving concepts to Supabase:", error);
    return concepts;
  } else {
    console.log(`[DB] Successfully saved ${data?.length} concepts into Supabase for ${brandId}.`);
    return data;
  }
}
