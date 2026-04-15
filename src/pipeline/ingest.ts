import { IngestedData } from "../types";

export async function ingestData(brandId: string): Promise<IngestedData> {
  console.log(`[Ingest] Fetching recent data for ${brandId}...`);
  // Mocking Sprout Social API data for Phase 1 MVP
  
  return {
    brand_id: brandId,
    ingested_at: new Date().toISOString(),
    trends: [
      {
        topic: "National Taco Day hype starting early",
        velocity: "rising",
        relevance_score: 0.92,
        source: "sprout_listening"
      },
      {
        topic: "Late night cravings & studying",
        velocity: "steady",
        relevance_score: 0.85,
        source: "sprout_listening"
      }
    ],
    top_performing_posts: [
      {
        post_id: "post_123",
        platform: "instagram",
        type: "carousel",
        theme: "product_hero",
        engagement_rate: 4.2,
        copy_excerpt: "Your Tuesday needs more queso. Ours always does. 🧀 #FuzzysTacoShop"
      }
    ],
    audience_snapshot: {
      peak_hours: ["11:00-13:00", "17:00-19:00"],
      top_demographics: ["25-34", "F", "TX/CO/OK"],
      sentiment_trend: "positive",
      emerging_interests: ["spicy food challenges", "late night cravings"]
    }
  };
}
