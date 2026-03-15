-- Add 'custom' to format_type CHECK constraints and add custom_example column

-- Drop existing CHECK constraints and re-create with 'custom' included
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_format_type_check;
ALTER TABLE notes ADD CONSTRAINT notes_format_type_check
  CHECK (format_type IN ('bullet_list', 'paragraph', 'action_items', 'meeting_notes', 'custom'));

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_default_format_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_default_format_check
  CHECK (default_format IN ('bullet_list', 'paragraph', 'action_items', 'meeting_notes', 'custom'));

-- Add custom_example column to store the user-provided example note
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS custom_example TEXT DEFAULT NULL;
