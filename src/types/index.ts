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
  creativity?: number;
  trend_weight?: number;
  public_topic_alignment?: string[];
  locations?: string[];
  temporal_context?: TemporalContextEntry[];
  trend_signals?: TrendSignal[];
}

export interface TemporalContextEntry {
  date?: string;
  label: string;
  type: 'national_day' | 'cultural' | 'retail' | 'weather' | 'day_pattern' | 'custom';
  relevance?: string;
  custom?: boolean;
}

export interface TrendSignal {
  signal: string;
  source: string;
  strength: 'high' | 'medium' | 'low';
  custom?: boolean;
}

export interface IngestedData {
  brand_id: string;
  ingested_at: string;
  trends: TrendData[];
  top_performing_posts: PostPerformance[];
  audience_snapshot: AudienceSnapshot;
  sprout_connected: boolean;
}

export interface GeneratedConcept {
  platform: "instagram" | "tiktok" | "twitter" | "facebook";
  content_type: "static" | "carousel" | "reel" | "tiktok_video" | "video_script" | "story";
  copy: string;
  visual_direction: string;
  image_gen_prompt: string;
  product_reference: string | null;
  trend_hook: string;
  rationale: string;
  sprout_data_notes: string;
  confidence_score: number;
}
