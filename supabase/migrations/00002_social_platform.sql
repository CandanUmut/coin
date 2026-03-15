-- TimeCoin Phase 2: Social Platform Schema
-- Posts, interactions, notifications, reputation, earning engine, anti-spam

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE post_type AS ENUM ('text', 'image', 'video');
CREATE TYPE interaction_type AS ENUM ('like', 'comment', 'tip', 'flag');
CREATE TYPE notification_type AS ENUM (
  'post_liked', 'post_commented', 'post_tipped', 'post_earned',
  'tax_deducted', 'transfer_received', 'welcome_bonus',
  'post_flagged', 'post_hidden'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_text TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  post_type post_type NOT NULL DEFAULT 'text',
  quality_score INTEGER NOT NULL DEFAULT 0,
  engagement_count INTEGER NOT NULL DEFAULT 0,
  earning_eligible BOOLEAN NOT NULL DEFAULT true,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post interactions table
CREATE TABLE post_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type interaction_type NOT NULL,
  comment_text TEXT,
  tip_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate likes/flags per user per post
CREATE UNIQUE INDEX idx_unique_like ON post_interactions(post_id, user_id, type)
  WHERE type IN ('like', 'flag');

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_quality ON posts(quality_score DESC);
CREATE INDEX idx_posts_not_hidden ON posts(created_at DESC) WHERE NOT is_hidden;
CREATE INDEX idx_interactions_post ON post_interactions(post_id);
CREATE INDEX idx_interactions_user ON post_interactions(user_id);
CREATE INDEX idx_interactions_type ON post_interactions(post_id, type);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT read;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Posts: anyone can read non-hidden, authors + moderators can read hidden
CREATE POLICY "Anyone can read non-hidden posts"
  ON posts FOR SELECT
  USING (NOT is_hidden OR author_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  ));

-- Posts: only author can insert (through RPC)
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Posts: author can update own post text/media, moderators can update is_hidden
CREATE POLICY "Authors can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  ));

-- Interactions: anyone authenticated can read
CREATE POLICY "Authenticated users can read interactions"
  ON post_interactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Interactions: authenticated users can insert
CREATE POLICY "Authenticated users can create interactions"
  ON post_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Interactions: users can delete own (for unlike)
CREATE POLICY "Users can delete own interactions"
  ON post_interactions FOR DELETE
  USING (auth.uid() = user_id);

-- Notifications: users can read own
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Notifications: users can update own (mark read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS: CREATE POST (with rate limiting)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_post(
  p_content_text TEXT,
  p_media_urls TEXT[] DEFAULT '{}',
  p_post_type post_type DEFAULT 'text'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _posts_today INTEGER;
  _reputation INTEGER;
  _earning_eligible BOOLEAN;
  _post_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Validate content
  IF LENGTH(TRIM(p_content_text)) < 1 THEN
    RETURN jsonb_build_object('error', 'Post content cannot be empty');
  END IF;

  -- Rate limit: max 10 posts per day
  SELECT COUNT(*) INTO _posts_today
  FROM posts
  WHERE author_id = _user_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF _posts_today >= 10 THEN
    RETURN jsonb_build_object('error', 'You have reached the daily post limit (10 posts per day)');
  END IF;

  -- Get reputation for earning eligibility
  SELECT reputation_score INTO _reputation
  FROM profiles
  WHERE id = _user_id;

  -- Users with reputation < 5 are not earning eligible
  _earning_eligible := COALESCE(_reputation, 0) >= 5;

  -- Insert post
  INSERT INTO posts (author_id, content_text, media_urls, post_type, earning_eligible)
  VALUES (_user_id, TRIM(p_content_text), p_media_urls, p_post_type, _earning_eligible)
  RETURNING id INTO _post_id;

  RETURN jsonb_build_object('success', true, 'post_id', _post_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: TIP POST AUTHOR
-- ============================================================================

CREATE OR REPLACE FUNCTION tip_post_author(
  p_post_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tipper_id UUID;
  _author_id UUID;
  _tipper_wallet_id UUID;
  _tipper_balance NUMERIC;
  _author_wallet_id UUID;
  _author_balance NUMERIC;
BEGIN
  _tipper_id := auth.uid();
  IF _tipper_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Tip amount must be greater than 0');
  END IF;

  -- Get post author
  SELECT author_id INTO _author_id FROM posts WHERE id = p_post_id AND NOT is_hidden;
  IF _author_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Post not found');
  END IF;

  IF _author_id = _tipper_id THEN
    RETURN jsonb_build_object('error', 'Cannot tip your own post');
  END IF;

  -- Get tipper wallet
  SELECT id, balance INTO _tipper_wallet_id, _tipper_balance
  FROM wallets WHERE user_id = _tipper_id FOR UPDATE;

  IF _tipper_balance < p_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient balance');
  END IF;

  -- Get author wallet
  SELECT id, balance INTO _author_wallet_id, _author_balance
  FROM wallets WHERE user_id = _author_id FOR UPDATE;

  IF (_author_balance + p_amount) > 10000 THEN
    RETURN jsonb_build_object('error', 'Tip would exceed author''s 10,000 TC cap');
  END IF;

  -- Debit tipper
  UPDATE wallets SET balance = balance - p_amount, lifetime_spent = lifetime_spent + p_amount
  WHERE id = _tipper_wallet_id;

  -- Credit author
  UPDATE wallets SET balance = balance + p_amount, lifetime_earned = lifetime_earned + p_amount
  WHERE id = _author_wallet_id;

  -- Transaction record
  INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
  VALUES (_tipper_wallet_id, _author_wallet_id, p_amount, 'transfer', 'Tip on post');

  -- Record interaction
  INSERT INTO post_interactions (post_id, user_id, type, tip_amount)
  VALUES (p_post_id, _tipper_id, 'tip', p_amount);

  -- Notify author
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (_author_id, 'post_tipped',
    'You received a tip!',
    (SELECT display_name FROM profiles WHERE id = _tipper_id) || ' tipped you ' || p_amount || ' TC on your post'
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: FLAG POST (auto-hide after 3 unique flags)
-- ============================================================================

CREATE OR REPLACE FUNCTION flag_post(
  p_post_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _flag_count INTEGER;
  _author_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Check post exists
  SELECT author_id INTO _author_id FROM posts WHERE id = p_post_id;
  IF _author_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Post not found');
  END IF;

  IF _author_id = _user_id THEN
    RETURN jsonb_build_object('error', 'Cannot flag your own post');
  END IF;

  -- Insert flag (unique constraint will prevent duplicates)
  INSERT INTO post_interactions (post_id, user_id, type)
  VALUES (p_post_id, _user_id, 'flag')
  ON CONFLICT DO NOTHING;

  -- Count flags
  SELECT COUNT(*) INTO _flag_count
  FROM post_interactions
  WHERE post_id = p_post_id AND type = 'flag';

  -- Auto-hide after 3 flags
  IF _flag_count >= 3 THEN
    UPDATE posts SET is_hidden = true WHERE id = p_post_id;

    -- Deduct reputation from author
    UPDATE profiles
    SET reputation_score = GREATEST(reputation_score - 5, 0)
    WHERE id = _author_id;

    -- Notify author
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (_author_id, 'post_hidden',
      'Your post was hidden',
      'Your post has been hidden due to multiple community flags. It will be reviewed by moderators.'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'flag_count', _flag_count);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: MODERATOR ACTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION moderate_post(
  p_post_id UUID,
  p_action TEXT  -- 'unhide' or 'hide'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _user_role user_role;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT role INTO _user_role FROM profiles WHERE id = _user_id;
  IF _user_role NOT IN ('moderator', 'admin') THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF p_action = 'unhide' THEN
    UPDATE posts SET is_hidden = false WHERE id = p_post_id;
  ELSIF p_action = 'hide' THEN
    UPDATE posts SET is_hidden = true WHERE id = p_post_id;
  ELSE
    RETURN jsonb_build_object('error', 'Invalid action');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: EARNING ENGINE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_post_earnings()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post RECORD;
  _like_count INTEGER;
  _reputation INTEGER;
  _base_reward NUMERIC := 1;
  _engagement_bonus NUMERIC;
  _rep_multiplier NUMERIC;
  _total_reward NUMERIC;
  _posts_earned_today INTEGER;
  _wallet_id UUID;
  _wallet_balance NUMERIC;
BEGIN
  -- Process earning-eligible posts created in last hour that haven't been rewarded yet
  FOR _post IN
    SELECT p.id, p.author_id
    FROM posts p
    WHERE p.earning_eligible = true
      AND p.is_hidden = false
      AND p.created_at > NOW() - INTERVAL '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t
        JOIN wallets w ON t.to_wallet_id = w.id
        WHERE w.user_id = p.author_id
          AND t.type = 'earning'
          AND t.description LIKE '%' || p.id::TEXT || '%'
      )
  LOOP
    -- Max 5 earning-eligible posts per day per user
    SELECT COUNT(*) INTO _posts_earned_today
    FROM transactions t
    JOIN wallets w ON t.to_wallet_id = w.id
    WHERE w.user_id = _post.author_id
      AND t.type = 'earning'
      AND t.created_at > NOW() - INTERVAL '24 hours';

    IF _posts_earned_today >= 5 THEN
      CONTINUE;
    END IF;

    -- Count likes
    SELECT COUNT(*) INTO _like_count
    FROM post_interactions
    WHERE post_id = _post.id AND type = 'like';

    -- Get reputation
    SELECT reputation_score INTO _reputation
    FROM profiles WHERE id = _post.author_id;

    -- Calculate reward
    _engagement_bonus := (_like_count / 10.0) * 0.5;
    _rep_multiplier := LEAST(COALESCE(_reputation, 0) / 100.0, 2.0);
    IF _rep_multiplier < 0.1 THEN _rep_multiplier := 0.1; END IF;
    _total_reward := LEAST((_base_reward + _engagement_bonus) * _rep_multiplier, 10);
    _total_reward := ROUND(_total_reward, 2);

    IF _total_reward < 0.01 THEN
      CONTINUE;
    END IF;

    -- Get wallet
    SELECT id, balance INTO _wallet_id, _wallet_balance
    FROM wallets WHERE user_id = _post.author_id FOR UPDATE;

    IF _wallet_id IS NULL THEN CONTINUE; END IF;

    -- Check cap
    IF (_wallet_balance + _total_reward) > 10000 THEN
      _total_reward := 10000 - _wallet_balance;
      IF _total_reward < 0.01 THEN CONTINUE; END IF;
    END IF;

    -- Credit wallet
    UPDATE wallets
    SET balance = balance + _total_reward,
        lifetime_earned = lifetime_earned + _total_reward
    WHERE id = _wallet_id;

    -- Record transaction
    INSERT INTO transactions (to_wallet_id, amount, type, description)
    VALUES (_wallet_id, _total_reward, 'earning', 'Content reward for post ' || _post.id);

    -- Notify author
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (_post.author_id, 'post_earned',
      'You earned TC!',
      'Your post earned ' || _total_reward || ' TC'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: REPUTATION CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_reputation()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user RECORD;
  _likes_received INTEGER;
  _flags_received INTEGER;
  _active_weeks INTEGER;
  _new_score INTEGER;
BEGIN
  FOR _user IN SELECT id FROM profiles
  LOOP
    -- Likes received on posts
    SELECT COALESCE(COUNT(*), 0) INTO _likes_received
    FROM post_interactions pi
    JOIN posts p ON pi.post_id = p.id
    WHERE p.author_id = _user.id AND pi.type = 'like';

    -- Valid spam flags on user's posts (post was hidden)
    SELECT COALESCE(COUNT(DISTINCT pi.post_id), 0) INTO _flags_received
    FROM post_interactions pi
    JOIN posts p ON pi.post_id = p.id
    WHERE p.author_id = _user.id AND pi.type = 'flag' AND p.is_hidden = true;

    -- Weeks of active participation (has at least 1 post per week)
    SELECT COUNT(DISTINCT DATE_TRUNC('week', created_at)) INTO _active_weeks
    FROM posts WHERE author_id = _user.id;

    -- Calculate score
    _new_score := (_likes_received * 1)
                + (_active_weeks * 10)
                - (_flags_received * 5);

    IF _new_score < 0 THEN _new_score := 0; END IF;

    UPDATE profiles SET reputation_score = _new_score WHERE id = _user.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Notify on like
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_on_interaction()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author_id UUID;
  _actor_name TEXT;
BEGIN
  -- Get post author
  SELECT author_id INTO _author_id FROM posts WHERE id = NEW.post_id;
  IF _author_id IS NULL OR _author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO _actor_name FROM profiles WHERE id = NEW.user_id;

  IF NEW.type = 'like' THEN
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (_author_id, 'post_liked', 'New like!', _actor_name || ' liked your post');

    -- Update engagement count
    UPDATE posts SET engagement_count = engagement_count + 1 WHERE id = NEW.post_id;
  ELSIF NEW.type = 'comment' THEN
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (_author_id, 'post_commented', 'New comment!', _actor_name || ' commented on your post');

    UPDATE posts SET engagement_count = engagement_count + 1 WHERE id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_post_interaction
  AFTER INSERT ON post_interactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_interaction();

-- ============================================================================
-- ENABLE REALTIME for notifications
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
