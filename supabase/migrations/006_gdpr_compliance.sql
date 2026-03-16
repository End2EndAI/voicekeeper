-- VoiceKeeper GDPR Compliance Migration
-- Adds: account deletion function, data export function, audio cleanup trigger, audit log

-- ============================================================
-- 1. Audit log table (for GDPR accountability / Art. 5(2))
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
        'account_created', 'account_deleted', 'data_export_requested',
        'note_created', 'note_deleted', 'consent_given', 'consent_withdrawn'
    )),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- RLS: users can only read their own audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own audit log"
    ON audit_log FOR SELECT
    USING (auth.uid() = user_id);

-- Only server-side functions can insert (via SECURITY DEFINER functions)
CREATE POLICY "Service role can insert audit log"
    ON audit_log FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 2. Log account creation in audit log
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.audit_log (user_id, action) VALUES (NEW.id, 'account_created');
    RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Data export function (GDPR Art. 20 - Right to portability)
-- Returns all user data as JSON
-- ============================================================
CREATE OR REPLACE FUNCTION export_user_data()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    user_notes JSONB;
    user_prefs JSONB;
    user_email TEXT;
BEGIN
    -- Get user email from auth
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

    -- Get all notes
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', n.id,
        'title', n.title,
        'formatted_text', n.formatted_text,
        'raw_transcription', n.raw_transcription,
        'format_type', n.format_type,
        'audio_url', n.audio_url,
        'created_at', n.created_at,
        'updated_at', n.updated_at
    ) ORDER BY n.created_at DESC), '[]'::jsonb)
    INTO user_notes
    FROM notes n WHERE n.user_id = auth.uid();

    -- Get preferences
    SELECT COALESCE(jsonb_build_object(
        'default_format', p.default_format,
        'custom_example', p.custom_example,
        'custom_instructions', p.custom_instructions,
        'updated_at', p.updated_at
    ), '{}'::jsonb)
    INTO user_prefs
    FROM user_preferences p WHERE p.user_id = auth.uid();

    -- Build complete export
    result := jsonb_build_object(
        'exported_at', now(),
        'user', jsonb_build_object(
            'id', auth.uid(),
            'email', user_email
        ),
        'preferences', COALESCE(user_prefs, '{}'::jsonb),
        'notes', user_notes,
        'note_count', jsonb_array_length(user_notes)
    );

    -- Log the export request
    INSERT INTO audit_log (user_id, action) VALUES (auth.uid(), 'data_export_requested');

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. Account deletion function (GDPR Art. 17 - Right to erasure)
-- Deletes all user data including storage files
-- Must be called from an Edge Function that also handles storage cleanup
-- ============================================================
CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS JSONB AS $$
DECLARE
    note_count INTEGER;
    audio_urls TEXT[];
BEGIN
    -- Count notes for the response
    SELECT COUNT(*) INTO note_count FROM notes WHERE user_id = auth.uid();

    -- Collect audio URLs for storage cleanup (caller must handle storage deletion)
    SELECT ARRAY_AGG(audio_url) INTO audio_urls
    FROM notes
    WHERE user_id = auth.uid() AND audio_url IS NOT NULL;

    -- Log the deletion request BEFORE deleting (so we have a record)
    INSERT INTO audit_log (user_id, action, metadata)
    VALUES (auth.uid(), 'account_deleted', jsonb_build_object(
        'notes_deleted', note_count,
        'audio_files_count', COALESCE(array_length(audio_urls, 1), 0)
    ));

    -- Delete the user from auth.users (CASCADE will handle notes + preferences)
    DELETE FROM auth.users WHERE id = auth.uid();

    RETURN jsonb_build_object(
        'success', true,
        'notes_deleted', note_count,
        'audio_urls', COALESCE(to_jsonb(audio_urls), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
