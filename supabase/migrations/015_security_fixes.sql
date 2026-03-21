-- Security fixes (audit 2026-03-21)

-- Fix 1: Audit log INSERT policy
-- The previous policy was named "Service role can insert audit log" but used
-- WITH CHECK (true), which allows ANY authenticated user to insert arbitrary rows.
-- Replace with a policy that only allows users to insert their own audit entries.
-- (Server-side SECURITY DEFINER functions use the service role and bypass RLS entirely.)
DROP POLICY IF EXISTS "Service role can insert audit log" ON audit_log;

CREATE POLICY "Users can insert their own audit log entries"
  ON audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- Fix 2: Drop residual FOR ALL policy on notes
-- Migration 001 created "Users can only access their own notes" (FOR ALL).
-- Migration 010 tried to drop "Users can view their own notes" — a name mismatch,
-- so the FOR ALL policy was never removed. This bypasses archive/trash view isolation.
DROP POLICY IF EXISTS "Users can only access their own notes" ON notes;


-- Fix 3: Block users from self-promoting to admin
-- The user_preferences UPDATE policy currently allows users to write any column,
-- including is_admin. Replace it with a column-restricted UPDATE policy.
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- is_admin can only be set by the service role (via admin_set_user_role SECURITY DEFINER)
    -- This CHECK fails if an authenticated user tries to change their own is_admin value.
    AND is_admin = (SELECT is_admin FROM user_preferences WHERE user_id = auth.uid())
  );
