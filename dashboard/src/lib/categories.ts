export interface Category {
  id: string;
  label: string;
  description: string;
  color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'meme', label: 'Meme', description: 'Leverage a current internet format or joke. Copy is punchy, minimal. Visual is a recognizable meme structure.', color: '#f59e0b' },
  { id: 'surprise_delight', label: 'Surprise & Delight', description: 'Unexpected feel-good moment. Generous, warm, joyful tone. Reward the audience.', color: '#22c55e' },
  { id: 'food_porn', label: 'Food Porn', description: 'Sensory and aspirational. Slow the reader down. Focus entirely on the product\'s look, smell, and taste.', color: '#f97316' },
  { id: 'product_push', label: 'Product Push', description: 'Clear CTA, feature the item directly, conversion-focused. Highlight what makes it worth buying now.', color: '#3b82f6' },
  { id: 'behind_the_scenes', label: 'Behind the Scenes', description: 'Raw, authentic look at the people or process behind the brand. Builds trust and humanizes.', color: '#8b5cf6' },
  { id: 'ugc_community', label: 'UGC / Community', description: 'Celebrate fans, reshare energy, build belonging. Make the audience the hero.', color: '#ec4899' },
  { id: 'educational', label: 'Educational', description: 'Teach something useful. How-to tips, insider knowledge, myth-busting. Audience leaves knowing more.', color: '#06b6d4' },
  { id: 'seasonal_timely', label: 'Seasonal / Timely', description: 'Tie directly to an upcoming event, holiday, or cultural moment. Time-sensitive urgency.', color: '#84cc16' },
  { id: 'lifestyle', label: 'Lifestyle', description: 'Aspirational context. The brand fits seamlessly into a desirable way of living.', color: '#a78bfa' },
  { id: 'announcement', label: 'Announcement', description: 'New product, event, collab, or milestone. Clear and exciting. News-style energy.', color: '#fb923c' },
];

export function getCategoryById(id: string): Category | undefined {
  return DEFAULT_CATEGORIES.find(c => c.id === id);
}

export function getCategoryLabel(id: string): string {
  return getCategoryById(id)?.label ?? id;
}
