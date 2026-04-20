-- Run this in your Supabase SQL editor:
-- Dashboard → SQL Editor → New query → paste → Run

ALTER TABLE concepts ADD COLUMN IF NOT EXISTS sprout_data_notes TEXT;
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS generated_video_url TEXT;
