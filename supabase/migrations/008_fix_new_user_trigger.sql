-- Fix "Database error saving new user" regression introduced in migration 006.
--
-- Root cause: 006_gdpr_compliance.sql replaced handle_new_user() without
-- preserving the fixes from 002_fix_new_user_trigger.sql:
--   - SET search_path = public  (required for SECURITY DEFINER RLS bypass)
--   - ON CONFLICT (user_id) DO NOTHING  (idempotency)
--   - public. schema prefix on all tables
--
-- At trigger time auth.uid() is NULL (no session yet), so without
-- SET search_path = public the postgres owner's RLS bypass does not apply
-- and the INSERT fails with "Database error saving new user".

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

-- Re-attach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
