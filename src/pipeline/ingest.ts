import { IngestedData, TrendData, PostPerformance, AudienceSnapshot } from "../types";

const SPROUT_BASE = 'https://api.sproutsocial.com/v1';

interface SproutProfile {
  id: string;
  name: string;
  network: string;
  handle: string;
}

async function fetchSproutProfiles(token: string): Promise<SproutProfile[]> {
  const res = await fetch(`${SPROUT_BASE}/profiles`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Sprout profiles failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data || [];
}

async function fetchSproutAnalytics(token: string, profileId: string): Promise<{
  top_posts: PostPerformance[];
  audience: AudienceSnapshot;
}> {
  // Fetch recent post analytics from Sprout Social
  // Docs: https://api.sproutsocial.com/docs/#sprout-api-overview
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const res = await fetch(
    `${SPROUT_BASE}/analytics/profiles/${profileId}/metrics?` +
    `start_time=${startDate}T00:00:00&end_time=${endDate}T23:59:59&` +
    `metrics[]=impressions&metrics[]=engagements&metrics[]=link_clicks`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    console.warn(`[Ingest] Sprout analytics failed for profile ${profileId}: ${res.status}`);
    return { top_posts: mockTopPosts(), audience: mockAudienceSnapshot() };
  }

  const data = await res.json();

  const top_posts: PostPerformance[] = (data.data?.posts || []).slice(0, 5).map((p: any) => ({
    post_id: p.id,
    platform: p.network_type?.toLowerCase() || 'instagram',
    type: p.post_type || 'static',
    theme: p.tags?.[0] || 'general',
    engagement_rate: p.engagement_rate || 0,
    copy_excerpt: (p.text || '').slice(0, 120),
  }));

  const audience: AudienceSnapshot = {
    peak_hours: data.data?.audience?.peak_hours || ['11:00-13:00', '17:00-19:00'],
    top_demographics: data.data?.audience?.demographics || ['25-34'],
    sentiment_trend: data.data?.audience?.sentiment || 'positive',
    emerging_interests: data.data?.audience?.interests || [],
  };

  return { top_posts, audience };
}

async function fetchSproutListening(token: string, profileId: string): Promise<TrendData[]> {
  const res = await fetch(`${SPROUT_BASE}/listening/topics?profile_id=${profileId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    console.warn(`[Ingest] Sprout listening failed for profile ${profileId}: ${res.status}`);
    return mockTrends();
  }

  const data = await res.json();
  return (data.data || []).slice(0, 5).map((t: any) => ({
    topic: t.name || t.keyword,
    velocity: t.trend === 'up' ? 'rising' : t.trend === 'down' ? 'falling' : 'steady',
    relevance_score: Math.min(1, (t.volume || 50) / 100),
    source: 'sprout_listening',
  }));
}

export async function ingestData(brandId: string, brandConfig?: any): Promise<IngestedData> {
  console.log(`[Ingest] Fetching data for ${brandId}...`);

  const token = process.env.SPROUT_API_TOKEN;
  // Support per-brand profile IDs: SPROUT_PROFILE_ID_FUZZYS_TACO_SHOP, etc.
  const envKey = `SPROUT_PROFILE_ID_${brandId.toUpperCase().replace(/-/g, '_')}`;
  const profileId = process.env[envKey] || process.env.SPROUT_PROFILE_ID || brandConfig?.sprout_profile_id;

  if (!token || !profileId) {
    console.log(`[Ingest] Sprout Social not configured for ${brandId} — using mock data. Set SPROUT_API_TOKEN + ${envKey} to enable.`);
    return {
      brand_id: brandId,
      ingested_at: new Date().toISOString(),
      trends: mockTrends(),
      top_performing_posts: mockTopPosts(),
      audience_snapshot: mockAudienceSnapshot(),
      sprout_connected: false,
    };
  }

  try {
    console.log(`[Ingest] Calling Sprout Social API for profile ${profileId}...`);
    const [{ top_posts, audience }, trends] = await Promise.all([
      fetchSproutAnalytics(token, profileId),
      fetchSproutListening(token, profileId),
    ]);

    console.log(`[Ingest] Sprout data fetched: ${trends.length} trends, ${top_posts.length} posts`);
    return {
      brand_id: brandId,
      ingested_at: new Date().toISOString(),
      trends,
      top_performing_posts: top_posts,
      audience_snapshot: audience,
      sprout_connected: true,
    };
  } catch (e: any) {
    console.error(`[Ingest] Sprout Social error for ${brandId}: ${e.message}. Falling back to mock data.`);
    return {
      brand_id: brandId,
      ingested_at: new Date().toISOString(),
      trends: mockTrends(),
      top_performing_posts: mockTopPosts(),
      audience_snapshot: mockAudienceSnapshot(),
      sprout_connected: false,
    };
  }
}

function mockTrends(): TrendData[] {
  const today = new Date();
  const dow = today.toLocaleDateString('en-US', { weekday: 'long' });
  return [
    {
      topic: `${dow} food content performing above average`,
      velocity: "rising",
      relevance_score: 0.88,
      source: "mock_sprout_listening"
    },
    {
      topic: "Short-form video engagement up 22% this week",
      velocity: "rising",
      relevance_score: 0.91,
      source: "mock_sprout_listening"
    },
    {
      topic: "User-generated content driving highest saves",
      velocity: "steady",
      relevance_score: 0.79,
      source: "mock_sprout_listening"
    }
  ];
}

function mockTopPosts(): PostPerformance[] {
  return [
    {
      post_id: "mock_post_001",
      platform: "instagram",
      type: "reel",
      theme: "product_hero",
      engagement_rate: 5.8,
      copy_excerpt: "Your Tuesday needs more queso. Ours always does. 🧀"
    },
    {
      post_id: "mock_post_002",
      platform: "tiktok",
      type: "video",
      theme: "behind_the_scenes",
      engagement_rate: 7.2,
      copy_excerpt: "POV: It's Friday and you need this"
    }
  ];
}

function mockAudienceSnapshot(): AudienceSnapshot {
  return {
    peak_hours: ["11:00-13:00", "17:00-19:00", "20:00-22:00"],
    top_demographics: ["25-34", "F", "TX/CO/OK"],
    sentiment_trend: "positive",
    emerging_interests: ["spicy food challenges", "late night cravings", "Friday rituals"]
  };
}
