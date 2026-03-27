-- Add default_tag_id preference so users can land on their most-used filter
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS default_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL;
