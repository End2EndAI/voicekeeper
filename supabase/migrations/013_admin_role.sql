-- Ajouter is_admin à user_preferences
ALTER TABLE user_preferences ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Mettre à jour check_note_allowance pour inclure les admins (illimités)
CREATE OR REPLACE FUNCTION check_note_allowance(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_is_admin BOOLEAN;
  v_daily_count INTEGER;
  v_daily_limit INTEGER := 5;
BEGIN
  SELECT tier, is_admin INTO v_tier, v_is_admin
  FROM user_preferences
  WHERE user_id = p_user_id;

  -- Admins et unlimited ont accès illimité
  IF v_tier = 'unlimited' OR v_is_admin = true THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', v_tier,
      'is_admin', v_is_admin,
      'daily_count', 0,
      'daily_limit', -1
    );
  END IF;

  v_daily_count := get_daily_note_count(p_user_id);

  RETURN jsonb_build_object(
    'allowed', v_daily_count < v_daily_limit,
    'tier', v_tier,
    'is_admin', v_is_admin,
    'daily_count', v_daily_count,
    'daily_limit', v_daily_limit
  );
END;
$$;

-- Fonction admin : liste tous les users avec leurs stats
-- Accessible uniquement aux admins (vérifié dans la fonction)
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT is_admin INTO v_is_admin
  FROM user_preferences
  WHERE user_id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', u.id,
      'email', u.email,
      'created_at', u.created_at,
      'tier', COALESCE(p.tier, 'free'),
      'is_admin', COALESCE(p.is_admin, false),
      'note_count_30d', (
        SELECT COUNT(*) FROM notes n
        WHERE n.user_id = u.id
          AND n.created_at >= NOW() - INTERVAL '30 days'
          AND n.deleted_at IS NULL
      ),
      'note_count_total', (
        SELECT COUNT(*) FROM notes n
        WHERE n.user_id = u.id
          AND n.deleted_at IS NULL
      )
    ) ORDER BY u.created_at DESC
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN user_preferences p ON p.user_id = u.id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Fonction admin : modifier le rôle d'un user
CREATE OR REPLACE FUNCTION admin_set_user_role(
  p_target_user_id UUID,
  p_tier TEXT,
  p_is_admin BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT is_admin INTO v_is_admin
  FROM user_preferences
  WHERE user_id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- Valider le tier
  IF p_tier NOT IN ('free', 'unlimited') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  UPDATE user_preferences
  SET tier = p_tier, is_admin = p_is_admin, updated_at = NOW()
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_target_user_id;
  END IF;
END;
$$;
