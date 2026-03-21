-- Fix missing INSERT and UPDATE policies on notes
-- Migration 015 dropped the FOR ALL policy from 001, but 010 only added
-- SELECT and DELETE policies — INSERT and UPDATE were never replaced.

CREATE POLICY "Users can insert their own notes" ON notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
