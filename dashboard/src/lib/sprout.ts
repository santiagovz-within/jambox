const SPROUT_BASE = 'https://api.sproutsocial.com/v1';

export interface SproutIngestedData {
  sprout_connected: boolean;
  trends: { topic: string; velocity: string; relevance_score: number; source: string }[];
  top_performing_posts: { post_id: string; platform: string; type: string; theme: string; engagement_rate: number; copy_excerpt: string }[];
  audience_snapshot: { peak_hours: string[]; top_demographics: string[]; sentiment_trend: string; emerging_interests: string[] };
}

export async function fetchSproutData(brandId: string, brandConfig?: any): Promise<SproutIngestedData> {
  const token = process.env.SPROUT_API_TOKEN;
  const envKey = `SPROUT_PROFILE_ID_${brandId.toUpperCase().replace(/-/g, '_')}`;
  const profileId = process.env[envKey] || process.env.SPROUT_PROFILE_ID || brandConfig?.sprout_profile_id;

  if (!token || !profileId) {
    console.log(`[Sprout] Not configured for ${brandId} — using mock data. Set SPROUT_API_TOKEN + ${envKey}.`);
    return mockData();
  }

  try {
    console.log(`[Sprout] Fetching live data for profile ${profileId}...`);

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [analyticsRes, listeningRes] = await Promise.allSettled([
      fetch(
        `${SPROUT_BASE}/analytics/profiles/${profileId}/metrics?` +
        `start_time=${startDate}T00:00:00&end_time=${endDate}T23:59:59&` +
        `metrics[]=impressions&metrics[]=engagements&metrics[]=link_clicks`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      ),
      fetch(
        `${SPROUT_BASE}/listening/topics?profile_id=${profileId}`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      ),
    ]);

    let top_performing_posts = mockData().top_performing_posts;
    let audience_snapshot = mockData().audience_snapshot;
    let trends = mockData().trends;

    if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
      const data = await analyticsRes.value.json();
      top_performing_posts = (data.data?.posts || []).slice(0, 5).map((p: any) => ({
        post_id: p.id,
        platform: p.network_type?.toLowerCase() || 'instagram',
        type: p.post_type || 'static',
        theme: p.tags?.[0] || 'general',
        engagement_rate: p.engagement_rate || 0,
        copy_excerpt: (p.text || '').slice(0, 120),
      }));
      audience_snapshot = {
        peak_hours: data.data?.audience?.peak_hours || mockData().audience_snapshot.peak_hours,
        top_demographics: data.data?.audience?.demographics || mockData().audience_snapshot.top_demographics,
        sentiment_trend: data.data?.audience?.sentiment || 'positive',
        emerging_interests: data.data?.audience?.interests || [],
      };
    } else {
      console.warn(`[Sprout] Analytics fetch failed for ${profileId}`);
    }

    if (listeningRes.status === 'fulfilled' && listeningRes.value.ok) {
      const data = await listeningRes.value.json();
      trends = (data.data || []).slice(0, 5).map((t: any) => ({
        topic: t.name || t.keyword,
        velocity: t.trend === 'up' ? 'rising' : t.trend === 'down' ? 'falling' : 'steady',
        relevance_score: Math.min(1, (t.volume || 50) / 100),
        source: 'sprout_listening',
      }));
    } else {
      console.warn(`[Sprout] Listening fetch failed for ${profileId}`);
    }

    console.log(`[Sprout] Live data fetched — ${trends.length} trends, ${top_performing_posts.length} posts`);
    return { sprout_connected: true, trends, top_performing_posts, audience_snapshot };

  } catch (e: any) {
    console.error(`[Sprout] Error for ${brandId}: ${e.message} — falling back to mock data`);
    return mockData();
  }
}

function mockData(): SproutIngestedData {
  const dow = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return {
    sprout_connected: false,
    trends: [
      { topic: `${dow} food/lifestyle content performing above average`, velocity: 'rising', relevance_score: 0.88, source: 'mock_sprout' },
      { topic: 'Short-form vertical video engagement up 22% this week', velocity: 'rising', relevance_score: 0.91, source: 'mock_sprout' },
      { topic: 'User-generated content driving highest saves', velocity: 'steady', relevance_score: 0.79, source: 'mock_sprout' },
    ],
    top_performing_posts: [
      { post_id: 'mock_001', platform: 'instagram', type: 'reel', theme: 'product_hero', engagement_rate: 5.8, copy_excerpt: 'Your Tuesday needs more queso. Ours always does. 🧀' },
      { post_id: 'mock_002', platform: 'tiktok', type: 'video', theme: 'behind_the_scenes', engagement_rate: 7.2, copy_excerpt: "POV: It's Friday and you need this" },
    ],
    audience_snapshot: {
      peak_hours: ['11:00-13:00', '17:00-19:00', '20:00-22:00'],
      top_demographics: ['25-34', 'F', 'TX/CO/OK'],
      sentiment_trend: 'positive',
      emerging_interests: ['spicy food challenges', 'late night cravings', 'Friday rituals'],
    },
  };
}
