-- Fix "Database error saving new user" caused by RLS blocking handle_new_user().
--
-- Root cause: without SET search_path = public, Supabase cloud does not reliably
-- activate the postgres role's RLS bypass on SECURITY DEFINER functions.
-- At trigger time, auth.uid() is NULL (no session yet), so the RLS policy
-- USING (auth.uid() = user_id) evaluates to NULL (falsy) and blocks the INSERT.
--
-- Fix: pin search_path = public so the postgres owner's bypass applies correctly.
-- Also add ON CONFLICT DO NOTHING for idempotency (safe against retries).

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
    RETURN NEW;
END;
$$;

-- Re-attach the trigger (Postgres <14 has no CREATE OR REPLACE TRIGGER)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
