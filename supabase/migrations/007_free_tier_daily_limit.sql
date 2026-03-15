-- Free tier: 5 notes per day limit
-- Users with tier = 'unlimited' bypass the restriction

-- Add tier column to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
CHECK (tier IN ('free', 'unlimited'));

-- Function to check how many notes a user created today
CREATE OR REPLACE FUNCTION get_daily_note_count(p_user_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM notes
    WHERE user_id = p_user_id
      AND created_at >= (now() AT TIME ZONE 'UTC')::date;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if a user can create a note (called by Edge Function)
CREATE OR REPLACE FUNCTION check_note_allowance(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    user_tier TEXT;
    daily_count INTEGER;
    daily_limit INTEGER := 5;
BEGIN
    -- Get user tier
    SELECT tier INTO user_tier
    FROM user_preferences
    WHERE user_id = p_user_id;

    -- Unlimited users always allowed
    IF user_tier = 'unlimited' THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'tier', 'unlimited',
            'daily_count', NULL,
            'daily_limit', NULL
        );
    END IF;

    -- Count today's notes
    SELECT get_daily_note_count(p_user_id) INTO daily_count;

    RETURN jsonb_build_object(
        'allowed', daily_count < daily_limit,
        'tier', COALESCE(user_tier, 'free'),
        'daily_count', daily_count,
        'daily_limit', daily_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
