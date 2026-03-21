-- Table des tags (par user)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Index
CREATE INDEX idx_tags_user_id ON tags(user_id);

-- Table de jonction note_tags
CREATE TABLE note_tags (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (note_id, tag_id)
);

-- Index
CREATE INDEX idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);

-- RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tags" ON tags
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage note_tags for their notes" ON note_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
    )
  );
