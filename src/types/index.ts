export interface TrendData {
  topic: string;
  velocity: string;
  relevance_score: number;
  source: string;
}

export interface PostPerformance {
  post_id: string;
  platform: string;
  type: string;
  theme: string;
  engagement_rate: number;
  copy_excerpt: string;
}

export interface AudienceSnapshot {
  peak_hours: string[];
  top_demographics: string[];
  sentiment_trend: string;
  emerging_interests: string[];
}

export interface CreativeVariables {
  tone: string;
  avoid_topics: string[];
  push_topics: string[];
  visual_style: string;
  platforms_priority: string[];
}

export interface IngestedData {
  brand_id: string;
  ingested_at: string;
  trends: TrendData[];
  top_performing_posts: PostPerformance[];
  audience_snapshot: AudienceSnapshot;
}

export interface GeneratedConcept {
  platform: "instagram" | "tiktok" | "twitter" | "facebook";
  content_type: "static" | "carousel" | "video_script" | "story";
  copy: string;
  visual_direction: string;
  image_gen_prompt: string;
  product_reference: string | null;
  trend_hook: string;
  rationale: string;
  confidence_score: number;
}
