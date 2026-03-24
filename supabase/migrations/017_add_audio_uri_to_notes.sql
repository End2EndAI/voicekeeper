-- Add nullable audio_uri column to notes (backwards-compatible)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS audio_uri TEXT;
