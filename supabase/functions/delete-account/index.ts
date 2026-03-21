// @ts-nocheck - Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://voicekeeper.vercel.app',
  'https://voicekeeper.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create authenticated client to get user info
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // User client (to verify identity)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Admin client (to delete user data)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Delete user notes (will cascade via FK, but explicit for audit)
    const { error: notesError } = await adminClient.from('notes').delete().eq('user_id', user.id);
    if (notesError) {
      throw new Error(`Failed to delete notes: ${notesError.message}`);
    }

    // 2. Delete user preferences
    const { error: prefsError } = await adminClient.from('user_preferences').delete().eq('user_id', user.id);
    if (prefsError) {
      throw new Error(`Failed to delete preferences: ${prefsError.message}`);
    }

    // 3. Log the deletion in audit_log
    const { error: auditError } = await adminClient.from('audit_log').insert({
      user_id: user.id,
      action: 'account_deleted',
      metadata: { email: user.email },
    });
    if (auditError) {
      console.error('Audit log error (non-fatal):', auditError.message);
    }

    // 4. Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account and all data deleted successfully' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Account deletion error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to delete account' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
