import * as dotenv from "dotenv";
dotenv.config();

import { ingestData } from "./ingest";
import { generateConcepts } from "./generate";
import { proposeConcepts } from "./propose";
import { saveConceptsToDb } from "./database";
import { CreativeVariables } from "../types";

import { getSupabase } from "./database";

// Fetch Live Brands from Supabase
async function getActiveBrands() {
  const supabase = getSupabase();
  if (!supabase) {
      console.warn("⚠️ No Supabase configured, cannot fetch brands.");
      return [];
  }
  let { data, error } = await supabase.from('brands').select('*');
  
  if (error) {
     console.error("Error fetching active brands from Supabase:", error);
     return [];
  }
  
  // Auto-seed table if the user hasn't run the schema.sql INSERT statements locally
  if (!data || data.length === 0) {
      console.log("⚠️ Supabase 'brands' table is empty. Auto-seeding initial testing brands (Fuzzy's & Vans)...");
      const seedBrands = [
        {
          brand_id: 'fuzzys_taco_shop',
          brand_name: "Fuzzy's Taco Shop",
          config: { "channel_id": process.env.SLACK_CHANNEL_ID || "C0123456789", "industry": "food" },
          creative_variables: { "tone": "witty and playful", "push_topics": ["brisket taco", "margaritas"], "avoid_topics": ["diet culture"], "platforms_priority": ["instagram", "tiktok"], "visual_style": "warm, overhead, real food" }
        },
        {
          brand_id: 'vans',
          brand_name: 'Vans',
          config: { "channel_id": "C_VANS_MOCK", "industry": "fashion/skate" },
          creative_variables: { "tone": "rebellious, raw, authentic", "push_topics": ["skate videos", "new half cab drops", "house of vans events"], "avoid_topics": ["corporate lingo", "discount pushing"], "platforms_priority": ["instagram", "tiktok"], "visual_style": "flash photography, motion blur, gritty skate edits" }
        }
      ];

      const res = await supabase.from('brands').insert(seedBrands).select('*');
      if (res.error) {
         console.error("Failed to auto-seed database:", res.error);
         return [];
      }
      return res.data || [];
  }

  return data;
}

// Internal pipeline runner for a single brand
async function runBrandPipeline(brand: any) {
  console.log(`🚀 Starting JamBox pipeline for ${brand.brand_id}...`);
  try {
    // Step 1: Ingest
    const data = await ingestData(brand.brand_id);

    // Step 2: Feedback (mocked for now, will pull from Supabase later per brand)
    const feedbackSummary = "The team generally approves high-energy posts that match the brand tone.";

    // Step 3: Generate Concepts
    const concepts = await generateConcepts(
      brand.brand_name || brand.brand_id, // Identity fallback
      brand.creative_variables as CreativeVariables,
      data,
      feedbackSummary,
      3
    );

    console.log(`✅ Generated ${concepts.length} concepts for ${brand.brand_id}.`);

    // Step 3 (Db): Save them to getting UUIDs
    const dbConcepts = await saveConceptsToDb(brand.brand_id, concepts);

    const channelId = brand.config?.channel_id || "C0123456789";

    // Step 4: Propose via Slack
    await proposeConcepts(channelId, dbConcepts as any);
    console.log(`🎉 Pipeline complete for ${brand.brand_id}.`);

  } catch (error) {
    console.error(`❌ Pipeline failed for ${brand.brand_id}:`, error);
  }
}

// Start the daily concurrent pipeline
async function runConcurrentPipeline() {
  console.log("🌟 Initializing JamBox Multi-Brand Engine...");
  
  const activeBrands = await getActiveBrands();
  console.log(`Found ${activeBrands.length} active brands to process from Supabase.`);

  // Execute all brand pipelines concurrently
  await Promise.all(activeBrands.map(brand => runBrandPipeline(brand)));

  console.log("🏁 All active brand pipelines have completed for today.");
}

// Execute if run directly
if (require.main === module) {
  runConcurrentPipeline();
}
