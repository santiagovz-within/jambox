-- Brand configurations
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id TEXT UNIQUE NOT NULL,         -- "fuzzys_taco_shop"
  brand_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  config JSONB NOT NULL,                 -- Full brand config object
  creative_variables JSONB NOT NULL,     -- Editable variables
  brand_identity_doc TEXT,
  product_catalog JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock testing data for Fuzzy's
INSERT INTO brands (brand_id, brand_name, config, creative_variables)
VALUES (
  'fuzzys_taco_shop',
  'Fuzzy''s Taco Shop',
  '{"channel_id": "C0123456789", "industry": "food"}'::jsonb,
  '{"tone": "witty and playful", "push_topics": ["brisket taco", "margaritas"], "avoid_topics": ["diet culture"], "platforms_priority": ["instagram", "tiktok"], "visual_style": "warm, overhead, real food"}'::jsonb
) ON CONFLICT (brand_id) DO NOTHING;

-- Mock testing data for Vans
INSERT INTO brands (brand_id, brand_name, config, creative_variables)
VALUES (
  'vans',
  'Vans',
  '{"channel_id": "C_VANS_MOCK", "industry": "fashion/skate"}'::jsonb,
  '{
    "tone": "rebellious, raw, authentic",
    "push_topics": ["skate videos", "new half cab drops", "house of vans events"],
    "avoid_topics": ["corporate lingo", "discount pushing"],
    "platforms_priority": ["instagram", "tiktok"],
    "visual_style": "flash photography, motion blur, gritty skate edits"
  }'::jsonb
) ON CONFLICT (brand_id) DO NOTHING;

-- Daily generated concepts
CREATE TABLE concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id TEXT REFERENCES brands(brand_id),
  date DATE NOT NULL,
  concept_index INT NOT NULL,            -- 1, 2, 3, 4, 5
  status TEXT DEFAULT 'pending',         -- pending, approved, rejected, edited
  platform TEXT,
  content_type TEXT,
  copy TEXT,
  edited_copy TEXT,                      -- If modified during approval
  visual_direction TEXT,
  image_gen_prompt TEXT,
  product_reference TEXT,
  trend_hook TEXT,
  rationale TEXT,
  confidence_score FLOAT,
  slack_message_ts TEXT,                 -- For updating the message
  slack_channel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback log (every approval/rejection)
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID REFERENCES concepts(id),
  brand_id TEXT REFERENCES brands(brand_id),
  action TEXT NOT NULL,                  -- approved, rejected, edited
  reviewer_slack_id TEXT,
  reviewer_name TEXT,
  rejection_reason TEXT,
  edit_diff JSONB,                       -- What was changed
  tags TEXT[],                           -- Auto-generated tags for learning
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated images
CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID REFERENCES concepts(id),
  brand_id TEXT REFERENCES brands(brand_id),
  image_url TEXT,                        -- Drive URL or CDN URL
  drive_file_id TEXT,
  variation_label TEXT,                  -- "A", "B", "C"
  selected BOOLEAN DEFAULT false,        -- Was this the one they picked?
  fal_request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creative variable change log (audit trail)
CREATE TABLE variable_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id TEXT REFERENCES brands(brand_id),
  changed_by TEXT,                       -- User who made the change
  variable_name TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
