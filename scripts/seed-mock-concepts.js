require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const today = new Date().toISOString().split('T')[0];

const mockConcepts = [
  // Fuzzy's Taco Shop
  {
    brand_id: 'fuzzys_taco_shop',
    date: today,
    concept_index: 1,
    status: 'pending',
    platform: 'instagram',
    content_type: 'reel',
    copy: "Brisket so good it should be illegal 🌮🔥 Our slow-smoked brisket taco is the move this week. Come in and find out why it sells out every Friday.",
    visual_direction: "Close-up slow motion of brisket being sliced, steam rising, then quick cut to the taco being assembled with bright toppings. Warm, moody lighting.",
    image_gen_prompt: "Close-up food photography of a brisket taco on a rustic wooden board, steam rising, vibrant toppings of cilantro and onion, warm golden-hour lighting, bokeh background",
    rationale: "Brisket tacos are the top-performing SKU in your feedback data. Reels with food ASMR content get 3x engagement on Instagram right now.",
    confidence_score: 0.91
  },
  {
    brand_id: 'fuzzys_taco_shop',
    date: today,
    concept_index: 2,
    status: 'pending',
    platform: 'tiktok',
    content_type: 'video',
    copy: "POV: You just found your new Friday ritual 🍹 Our house margarita hits different after a long week. Tag someone who needs this.",
    visual_direction: "First-person POV of picking up a salted-rim margarita, clinking glasses with friends at a lively table, then a sip reaction. Upbeat trending audio.",
    image_gen_prompt: "Vibrant margarita cocktail in a salted-rim glass with lime wedge, colorful Mexican restaurant background, warm candlelight, top-down flat lay style",
    rationale: "TikTok POV format is driving massive reach for restaurant brands. Margaritas + relatable Friday content = high share rate.",
    confidence_score: 0.87
  },
  {
    brand_id: 'fuzzys_taco_shop',
    date: today,
    concept_index: 3,
    status: 'pending',
    platform: 'instagram',
    content_type: 'carousel',
    copy: "The vibe check ✅ Whether you're rolling in solo or deep with the crew, Fuzzy's is always the right call. Swipe to see why people keep coming back.",
    visual_direction: "Carousel of 4 shots: full table spread, laughing group of friends, bartender pouring margarita, close-up of chips and queso. Consistent warm filter.",
    image_gen_prompt: "Lively Mexican restaurant interior with a group of friends laughing around a table full of tacos and margaritas, warm ambient lighting, authentic and welcoming atmosphere",
    rationale: "Atmosphere content builds brand loyalty and earns saves. High-performing for brands with strong community identity like Fuzzy's.",
    confidence_score: 0.82
  },

  // Vans
  {
    brand_id: 'vans',
    date: today,
    concept_index: 1,
    status: 'pending',
    platform: 'instagram',
    content_type: 'reel',
    copy: "No rules. Just rails. 🛹 Watch what happens when you put a Half Cab on a ledge that wasn't meant to be skated.",
    visual_direction: "Flash-photography style edit of a skater approaching a concrete ledge, grinds it, lands clean. Slow-motion on the landing. Raw, gritty look. No color grading.",
    image_gen_prompt: "Gritty skate photography, skater grinding a concrete ledge in an urban setting, flash photography, motion blur on the wheels, raw authentic street style, black and white with high contrast",
    rationale: "Raw skate content without heavy production outperforms polished ads 4:1 on Instagram for Vans' audience. Flash photography aesthetic is trending in skate communities.",
    confidence_score: 0.93
  },
  {
    brand_id: 'vans',
    date: today,
    concept_index: 2,
    status: 'pending',
    platform: 'tiktok',
    content_type: 'video',
    copy: "New Half Cab just dropped and we're not taking questions 🤫👟 Link in bio.",
    visual_direction: "Quick cut unboxing: hands removing tissue paper, first look at the shoe from multiple angles, then cut to someone skating in them immediately. No voiceover — just music and natural sound.",
    image_gen_prompt: "Overhead flat lay of new Vans Half Cab sneakers on concrete with worn skate wheels beside them, natural daylight, minimalist composition, authentic skate culture aesthetic",
    rationale: "Product drop TikToks with instant 'in action' cuts drive 5x higher CTR than standard product shots. The mystery angle ('not taking questions') drives comment engagement.",
    confidence_score: 0.89
  },
  {
    brand_id: 'vans',
    date: today,
    concept_index: 3,
    status: 'pending',
    platform: 'instagram',
    content_type: 'post',
    copy: "House of Vans Tokyo is open. Come for the skate park, stay for everything else. 📍",
    visual_direction: "Wide architectural shot of the House of Vans interior — half-pipe, art installations, low lighting. One skater mid-trick in the background, slightly out of focus. Minimal caption overlay.",
    image_gen_prompt: "Wide angle interior of a modern skate park inside an industrial building, half-pipe ramps, neon accents, one skater airborne in mid-trick, moody dramatic lighting, editorial photography style",
    rationale: "House of Vans events create cultural moments — content from these drives massive organic reach and press coverage. Tokyo opening is peak relevance right now.",
    confidence_score: 0.88
  }
];

async function seedConcepts() {
  console.log(`Inserting ${mockConcepts.length} mock concepts for ${today}...`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`Key type: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15)}...`);

  const { data, error } = await supabase.from('concepts').insert(mockConcepts).select();

  if (error) {
    console.error('Insert failed:', error.message);
    console.error('Hint:', error.hint || '(none)');
    process.exit(1);
  }

  console.log(`Successfully inserted ${data.length} concepts:`);
  data.forEach(c => console.log(`  - [${c.brand_id}] Concept ${c.concept_index}: ${c.platform} ${c.content_type} (id: ${c.id})`));
}

seedConcepts();
