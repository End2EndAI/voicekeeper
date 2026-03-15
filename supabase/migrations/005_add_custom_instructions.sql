-- Add custom_instructions column to user_preferences
-- This field applies to ALL LLM calls regardless of format template
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT DEFAULT NULL;
