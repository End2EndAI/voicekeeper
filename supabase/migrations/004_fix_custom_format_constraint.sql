-- Idempotent fix: ensure 'custom' is allowed in user_preferences.default_format
-- Safe to run even if migration 003 was already applied.
-- Drops all CHECK constraints on default_format (regardless of auto-generated name)
-- and re-adds the correct one.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'user_preferences'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%default_format%'
  LOOP
    EXECUTE format('ALTER TABLE user_preferences DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_default_format_check
  CHECK (default_format IN ('bullet_list', 'paragraph', 'action_items', 'meeting_notes', 'custom'));
