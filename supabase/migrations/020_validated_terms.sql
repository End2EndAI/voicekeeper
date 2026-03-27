-- Store user-validated term corrections from transcriptions
-- Allows the app to reuse confirmed term spellings in future prompts
CREATE TABLE IF NOT EXISTS user_validated_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_term text NOT NULL,
  corrected_term text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, original_term)
);

ALTER TABLE user_validated_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own validated terms"
  ON user_validated_terms FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
