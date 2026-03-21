-- Ajouter archived_at et deleted_at à la table notes
ALTER TABLE notes ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index pour les requêtes fréquentes
CREATE INDEX idx_notes_deleted_at ON notes(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_notes_archived_at ON notes(archived_at) WHERE archived_at IS NOT NULL;

-- Mise à jour des RLS policies pour exclure les notes supprimées/archivées de la vue principale
-- Supprimer l'ancienne policy select
DROP POLICY IF EXISTS "Users can view their own notes" ON notes;

-- Nouvelle policy : vue principale (active notes seulement)
CREATE POLICY "Users can view their active notes" ON notes
  FOR SELECT USING (
    auth.uid() = user_id
    AND deleted_at IS NULL
    AND archived_at IS NULL
  );

-- Policy pour voir les notes archivées
CREATE POLICY "Users can view their archived notes" ON notes
  FOR SELECT USING (
    auth.uid() = user_id
    AND deleted_at IS NULL
    AND archived_at IS NOT NULL
  );

-- Policy pour voir les notes en corbeille
CREATE POLICY "Users can view their trashed notes" ON notes
  FOR SELECT USING (
    auth.uid() = user_id
    AND deleted_at IS NOT NULL
  );

-- Supprimer l'ancienne policy delete
DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;

-- Nouvelle policy delete (pour suppression permanente, ex. depuis la corbeille)
CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- Function pour nettoyer les notes en corbeille depuis plus de 30 jours
CREATE OR REPLACE FUNCTION cleanup_trashed_notes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notes
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Scheduled cleanup (nécessite pg_cron activé sur Supabase)
-- À activer manuellement dans le dashboard Supabase si pg_cron est disponible
-- SELECT cron.schedule('cleanup-trashed-notes', '0 2 * * *', 'SELECT cleanup_trashed_notes()');
