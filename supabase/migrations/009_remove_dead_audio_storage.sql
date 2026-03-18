-- Remove dead audio storage infrastructure.
-- Audio recordings are sent directly to OpenAI Whisper for transcription
-- and are never persisted to Supabase storage. The recordings bucket,
-- its RLS policies, and the audio_url column are unused.

-- Drop storage RLS policies
DROP POLICY IF EXISTS "Users upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users read own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own files" ON storage.objects;

-- Delete any objects in the bucket (should be empty) and drop the bucket
DELETE FROM storage.objects WHERE bucket_id = 'recordings';
DELETE FROM storage.buckets WHERE id = 'recordings';

-- Drop unused audio_url column from notes
ALTER TABLE notes DROP COLUMN IF EXISTS audio_url;

-- Update export_user_data to remove audio_url from note export
CREATE OR REPLACE FUNCTION export_user_data()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    user_notes JSONB;
    user_prefs JSONB;
    user_email TEXT;
BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', n.id,
        'title', n.title,
        'formatted_text', n.formatted_text,
        'raw_transcription', n.raw_transcription,
        'format_type', n.format_type,
        'created_at', n.created_at,
        'updated_at', n.updated_at
    ) ORDER BY n.created_at DESC), '[]'::jsonb)
    INTO user_notes
    FROM notes n WHERE n.user_id = auth.uid();

    SELECT COALESCE(jsonb_build_object(
        'default_format', p.default_format,
        'custom_example', p.custom_example,
        'custom_instructions', p.custom_instructions,
        'updated_at', p.updated_at
    ), '{}'::jsonb)
    INTO user_prefs
    FROM user_preferences p WHERE p.user_id = auth.uid();

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

    INSERT INTO audit_log (user_id, action) VALUES (auth.uid(), 'data_export_requested');

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update request_account_deletion to remove audio URL collection
CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS JSONB AS $$
DECLARE
    note_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO note_count FROM notes WHERE user_id = auth.uid();

    INSERT INTO audit_log (user_id, action, metadata)
    VALUES (auth.uid(), 'account_deleted', jsonb_build_object(
        'notes_deleted', note_count
    ));

    DELETE FROM auth.users WHERE id = auth.uid();

    RETURN jsonb_build_object(
        'success', true,
        'notes_deleted', note_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
