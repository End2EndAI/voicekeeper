-- Create default tags for every new user at signup
CREATE OR REPLACE FUNCTION create_default_tags_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tags (user_id, name, color) VALUES
    (NEW.user_id, 'Travail',        '#4F8EF7'),
    (NEW.user_id, 'Personnel',      '#F76F4F'),
    (NEW.user_id, 'Start-up',       '#A259FF'),
    (NEW.user_id, 'Investissement', '#27AE60'),
    (NEW.user_id, 'Idées',          '#F7C948')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_create_default_tags
  AFTER INSERT ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION create_default_tags_for_user();

-- Backfill: create default tags for existing users who have none
INSERT INTO tags (user_id, name, color)
SELECT p.user_id, t.name, t.color
FROM user_preferences p
CROSS JOIN (VALUES
  ('Travail',        '#4F8EF7'),
  ('Personnel',      '#F76F4F'),
  ('Start-up',       '#A259FF'),
  ('Investissement', '#27AE60'),
  ('Idées',          '#F7C948')
) AS t(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM tags WHERE user_id = p.user_id
)
ON CONFLICT DO NOTHING;
