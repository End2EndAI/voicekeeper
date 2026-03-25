-- Migration: Add text note support
-- - raw_transcription becomes nullable (text notes have no transcription)
-- - source column distinguishes voice vs text notes

ALTER TABLE notes
  ALTER COLUMN raw_transcription DROP NOT NULL;

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'voice'
  CHECK (source IN ('voice', 'text'));

-- Backfill existing notes as voice notes (already the default, but explicit)
UPDATE notes SET source = 'voice' WHERE source IS NULL;
