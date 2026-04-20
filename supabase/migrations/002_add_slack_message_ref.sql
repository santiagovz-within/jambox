-- Store the Slack message channel + timestamp so the dashboard can update
-- the Slack message in place when a decision is made from the web UI.
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS slack_message_ts  TEXT;
