-- Phase 3: Marketplace - Tasks, Services, Search & Discovery, Dispute Resolution
-- Migration: 00003_marketplace.sql

-- ============================================================================
-- 1. CUSTOM TYPES
-- ============================================================================

CREATE TYPE task_status AS ENUM (
  'open', 'claimed', 'submitted', 'approved', 'disputed', 'cancelled'
);

CREATE TYPE price_type AS ENUM ('fixed', 'hourly');

CREATE TYPE dispute_status AS ENUM ('open', 'resolved');

CREATE TYPE dispute_vote AS ENUM ('approve_worker', 'return_poster', 'split');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES auth.users(id),
  worker_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  description TEXT NOT NULL CHECK (char_length(description) >= 10),
  bounty_amount NUMERIC(12,2) NOT NULL CHECK (bounty_amount > 0 AND bounty_amount <= 10000),
  status task_status NOT NULL DEFAULT 'open',
  category TEXT NOT NULL DEFAULT 'general',
  escrow_tx_id UUID REFERENCES transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  description TEXT NOT NULL CHECK (char_length(description) >= 10),
  category TEXT NOT NULL DEFAULT 'general',
  price_tc NUMERIC(12,2) NOT NULL CHECK (price_tc > 0),
  price_type price_type NOT NULL DEFAULT 'fixed',
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service reviews table
CREATE TABLE service_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL CHECK (char_length(review_text) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, reviewer_id)
);

-- Disputes table
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (char_length(reason) >= 10),
  status dispute_status NOT NULL DEFAULT 'open',
  resolution TEXT,
  jury_members UUID[] NOT NULL DEFAULT '{}',
  jury_votes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_tasks_poster_id ON tasks(poster_id);
CREATE INDEX idx_tasks_worker_id ON tasks(worker_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

CREATE INDEX idx_services_provider_id ON services(provider_id);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_rating_avg ON services(rating_avg DESC);

CREATE INDEX idx_service_reviews_service_id ON service_reviews(service_id);

CREATE INDEX idx_disputes_task_id ON disputes(task_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- ============================================================================
-- 4. FULL-TEXT SEARCH
-- ============================================================================

-- Add tsvector columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE tasks ADD COLUMN search_vector tsvector;
ALTER TABLE services ADD COLUMN search_vector tsvector;

-- GIN indexes for fast full-text search
CREATE INDEX idx_posts_search ON posts USING gin(search_vector);
CREATE INDEX idx_tasks_search ON tasks USING gin(search_vector);
CREATE INDEX idx_services_search ON services USING gin(search_vector);

-- Trigger functions to keep search vectors up to date
CREATE OR REPLACE FUNCTION update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_service_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_search_vector
  BEFORE INSERT OR UPDATE OF content_text ON posts
  FOR EACH ROW EXECUTE FUNCTION update_post_search_vector();

CREATE TRIGGER trg_tasks_search_vector
  BEFORE INSERT OR UPDATE OF title, description ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_task_search_vector();

CREATE TRIGGER trg_services_search_vector
  BEFORE INSERT OR UPDATE OF title, description ON services
  FOR EACH ROW EXECUTE FUNCTION update_service_search_vector();

-- Backfill existing posts
UPDATE posts SET search_vector = to_tsvector('english', COALESCE(content_text, ''));

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Tasks: anyone can read, authenticated can insert
CREATE POLICY "Tasks are viewable by everyone"
  ON tasks FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tasks"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = poster_id);

CREATE POLICY "Task owners and workers can update"
  ON tasks FOR UPDATE TO authenticated
  USING (auth.uid() = poster_id OR auth.uid() = worker_id);

-- Services: anyone can read, authenticated can insert own
CREATE POLICY "Services are viewable by everyone"
  ON services FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create services"
  ON services FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Service owners can update"
  ON services FOR UPDATE TO authenticated
  USING (auth.uid() = provider_id);

-- Service reviews: anyone can read, authenticated can insert
CREATE POLICY "Reviews are viewable by everyone"
  ON service_reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON service_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- Disputes: involved parties and jury can read
CREATE POLICY "Dispute participants can read"
  ON disputes FOR SELECT TO authenticated
  USING (
    auth.uid() = initiated_by
    OR auth.uid() = (SELECT poster_id FROM tasks WHERE id = task_id)
    OR auth.uid() = (SELECT worker_id FROM tasks WHERE id = task_id)
    OR auth.uid() = ANY(jury_members)
  );

CREATE POLICY "Authenticated users can create disputes"
  ON disputes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "Dispute updates by system"
  ON disputes FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(jury_members)
    OR auth.uid() = initiated_by
  );

-- ============================================================================
-- 6. UPDATED TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_task_updated_at();

-- ============================================================================
-- 7. RPC FUNCTIONS - ESCROW
-- ============================================================================

-- Create task with escrow
CREATE OR REPLACE FUNCTION create_task_with_escrow(
  p_title TEXT,
  p_description TEXT,
  p_bounty_amount NUMERIC,
  p_category TEXT DEFAULT 'general'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_wallet_id UUID;
  v_balance NUMERIC;
  v_task_id UUID;
  v_tx_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Validate inputs
  IF char_length(p_title) < 3 THEN
    RETURN jsonb_build_object('error', 'Title must be at least 3 characters');
  END IF;
  IF char_length(p_description) < 10 THEN
    RETURN jsonb_build_object('error', 'Description must be at least 10 characters');
  END IF;
  IF p_bounty_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Bounty must be greater than 0');
  END IF;

  -- Check balance
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance < p_bounty_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient balance for bounty');
  END IF;

  -- Debit poster wallet (escrow)
  UPDATE wallets
  SET balance = balance - p_bounty_amount,
      lifetime_spent = lifetime_spent + p_bounty_amount
  WHERE id = v_wallet_id;

  -- Create escrow transaction
  INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
  VALUES (v_wallet_id, NULL, p_bounty_amount, 'escrow', 'Task bounty escrow')
  RETURNING id INTO v_tx_id;

  -- Create task
  INSERT INTO tasks (poster_id, title, description, bounty_amount, category, escrow_tx_id)
  VALUES (v_user_id, p_title, p_description, p_bounty_amount, p_category, v_tx_id)
  RETURNING id INTO v_task_id;

  RETURN jsonb_build_object('task_id', v_task_id, 'tx_id', v_tx_id);
END;
$$;

-- Claim a task
CREATE OR REPLACE FUNCTION claim_task(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_task RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;
  IF v_task.status != 'open' THEN
    RETURN jsonb_build_object('error', 'Task is not available for claiming');
  END IF;
  IF v_task.poster_id = v_user_id THEN
    RETURN jsonb_build_object('error', 'Cannot claim your own task');
  END IF;

  UPDATE tasks
  SET worker_id = v_user_id, status = 'claimed'
  WHERE id = p_task_id;

  -- Notify poster
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (v_task.poster_id, 'transfer_received',
    'Task claimed',
    'Someone claimed your task: ' || v_task.title);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Submit work for a task
CREATE OR REPLACE FUNCTION submit_task_work(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_task RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;
  IF v_task.worker_id != v_user_id THEN
    RETURN jsonb_build_object('error', 'Only the assigned worker can submit');
  END IF;
  IF v_task.status != 'claimed' THEN
    RETURN jsonb_build_object('error', 'Task must be in claimed status to submit');
  END IF;

  UPDATE tasks SET status = 'submitted' WHERE id = p_task_id;

  -- Notify poster
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (v_task.poster_id, 'transfer_received',
    'Work submitted',
    'Work submitted for your task: ' || v_task.title);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Approve task and release escrow to worker
CREATE OR REPLACE FUNCTION approve_task(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_task RECORD;
  v_worker_wallet_id UUID;
  v_worker_balance NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;
  IF v_task.poster_id != v_user_id THEN
    RETURN jsonb_build_object('error', 'Only the poster can approve');
  END IF;
  IF v_task.status != 'submitted' THEN
    RETURN jsonb_build_object('error', 'Task must be in submitted status to approve');
  END IF;

  -- Get worker wallet
  SELECT id, balance INTO v_worker_wallet_id, v_worker_balance
  FROM wallets WHERE user_id = v_task.worker_id FOR UPDATE;

  IF v_worker_balance + v_task.bounty_amount > 10000 THEN
    RETURN jsonb_build_object('error', 'Worker would exceed maximum balance');
  END IF;

  -- Credit worker
  UPDATE wallets
  SET balance = balance + v_task.bounty_amount,
      lifetime_earned = lifetime_earned + v_task.bounty_amount
  WHERE id = v_worker_wallet_id;

  -- Create release transaction
  INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
  VALUES (NULL, v_worker_wallet_id, v_task.bounty_amount, 'escrow', 'Task bounty released: ' || v_task.title);

  -- Update task status
  UPDATE tasks SET status = 'approved' WHERE id = p_task_id;

  -- Notify worker
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (v_task.worker_id, 'transfer_received',
    'Task approved!',
    'You earned ' || v_task.bounty_amount || ' TC for: ' || v_task.title);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Cancel task and return escrow
CREATE OR REPLACE FUNCTION cancel_task_escrow(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_task RECORD;
  v_poster_wallet_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;
  IF v_task.poster_id != v_user_id THEN
    RETURN jsonb_build_object('error', 'Only the poster can cancel');
  END IF;
  IF v_task.status NOT IN ('open', 'claimed') THEN
    RETURN jsonb_build_object('error', 'Cannot cancel task in current status');
  END IF;

  -- Get poster wallet
  SELECT id INTO v_poster_wallet_id
  FROM wallets WHERE user_id = v_task.poster_id FOR UPDATE;

  -- Refund poster
  UPDATE wallets
  SET balance = balance + v_task.bounty_amount,
      lifetime_spent = lifetime_spent - v_task.bounty_amount
  WHERE id = v_poster_wallet_id;

  -- Create refund transaction
  INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
  VALUES (NULL, v_poster_wallet_id, v_task.bounty_amount, 'escrow', 'Task bounty refunded: ' || v_task.title);

  -- Update task status
  UPDATE tasks SET status = 'cancelled' WHERE id = p_task_id;

  -- Notify worker if any
  IF v_task.worker_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (v_task.worker_id, 'transfer_received',
      'Task cancelled',
      'The task "' || v_task.title || '" has been cancelled by the poster');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 8. RPC FUNCTIONS - DISPUTE RESOLUTION
-- ============================================================================

-- Initiate dispute
CREATE OR REPLACE FUNCTION initiate_dispute(
  p_task_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_task RECORD;
  v_jury UUID[];
  v_dispute_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;
  IF v_task.status != 'submitted' THEN
    RETURN jsonb_build_object('error', 'Can only dispute tasks with submitted work');
  END IF;
  IF v_user_id != v_task.poster_id AND v_user_id != v_task.worker_id THEN
    RETURN jsonb_build_object('error', 'Only poster or worker can dispute');
  END IF;

  -- Check no existing open dispute
  IF EXISTS (SELECT 1 FROM disputes WHERE task_id = p_task_id AND status = 'open') THEN
    RETURN jsonb_build_object('error', 'A dispute is already open for this task');
  END IF;

  -- Select 3 random jury members with reputation > 50, excluding parties
  SELECT ARRAY(
    SELECT p.id FROM profiles p
    WHERE p.reputation_score > 50
      AND p.id != v_task.poster_id
      AND p.id != v_task.worker_id
    ORDER BY random()
    LIMIT 3
  ) INTO v_jury;

  IF array_length(v_jury, 1) IS NULL OR array_length(v_jury, 1) < 3 THEN
    RETURN jsonb_build_object('error', 'Not enough eligible jury members (need 3 users with reputation > 50)');
  END IF;

  -- Update task status
  UPDATE tasks SET status = 'disputed' WHERE id = p_task_id;

  -- Create dispute
  INSERT INTO disputes (task_id, initiated_by, reason, jury_members)
  VALUES (p_task_id, v_user_id, p_reason, v_jury)
  RETURNING id INTO v_dispute_id;

  -- Notify jury members
  FOR i IN 1..array_length(v_jury, 1) LOOP
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (v_jury[i], 'transfer_received',
      'Jury duty',
      'You have been selected as a juror for a task dispute. Vote to earn 2 TC.');
  END LOOP;

  -- Notify other party
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    CASE WHEN v_user_id = v_task.poster_id THEN v_task.worker_id ELSE v_task.poster_id END,
    'transfer_received',
    'Task disputed',
    'A dispute has been opened for task: ' || v_task.title
  );

  RETURN jsonb_build_object('dispute_id', v_dispute_id);
END;
$$;

-- Cast jury vote
CREATE OR REPLACE FUNCTION cast_jury_vote(
  p_dispute_id UUID,
  p_vote dispute_vote
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_dispute RECORD;
  v_task RECORD;
  v_votes JSONB;
  v_vote_count INTEGER;
  v_approve_count INTEGER := 0;
  v_return_count INTEGER := 0;
  v_split_count INTEGER := 0;
  v_resolution TEXT;
  v_poster_wallet_id UUID;
  v_worker_wallet_id UUID;
  v_jury_wallet_id UUID;
  v_half_bounty NUMERIC;
  v_key TEXT;
  v_val TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;

  IF v_dispute IS NULL THEN
    RETURN jsonb_build_object('error', 'Dispute not found');
  END IF;
  IF v_dispute.status != 'open' THEN
    RETURN jsonb_build_object('error', 'Dispute is already resolved');
  END IF;
  IF NOT (v_user_id = ANY(v_dispute.jury_members)) THEN
    RETURN jsonb_build_object('error', 'You are not a juror for this dispute');
  END IF;

  -- Check if already voted
  IF v_dispute.jury_votes ? v_user_id::text THEN
    RETURN jsonb_build_object('error', 'You have already voted');
  END IF;

  -- Record vote
  v_votes := v_dispute.jury_votes || jsonb_build_object(v_user_id::text, p_vote::text);
  UPDATE disputes SET jury_votes = v_votes WHERE id = p_dispute_id;

  -- Pay jury member 2 TC
  SELECT id INTO v_jury_wallet_id FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  UPDATE wallets SET balance = LEAST(balance + 2, 10000), lifetime_earned = lifetime_earned + 2
  WHERE id = v_jury_wallet_id;
  INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
  VALUES (NULL, v_jury_wallet_id, 2, 'earning', 'Jury duty compensation');

  -- Check if all votes are in
  v_vote_count := (SELECT count(*) FROM jsonb_object_keys(v_votes));
  IF v_vote_count < 3 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Vote recorded, waiting for other jurors');
  END IF;

  -- Tally votes
  FOR v_key, v_val IN SELECT * FROM jsonb_each_text(v_votes) LOOP
    IF v_val = 'approve_worker' THEN v_approve_count := v_approve_count + 1;
    ELSIF v_val = 'return_poster' THEN v_return_count := v_return_count + 1;
    ELSIF v_val = 'split' THEN v_split_count := v_split_count + 1;
    END IF;
  END LOOP;

  SELECT * INTO v_task FROM tasks WHERE id = v_dispute.task_id FOR UPDATE;
  SELECT id INTO v_poster_wallet_id FROM wallets WHERE user_id = v_task.poster_id FOR UPDATE;
  SELECT id INTO v_worker_wallet_id FROM wallets WHERE user_id = v_task.worker_id FOR UPDATE;

  IF v_approve_count >= 2 THEN
    -- Approve worker: release bounty to worker
    v_resolution := 'approve_worker';
    UPDATE wallets SET balance = LEAST(balance + v_task.bounty_amount, 10000),
                       lifetime_earned = lifetime_earned + v_task.bounty_amount
    WHERE id = v_worker_wallet_id;
    INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
    VALUES (NULL, v_worker_wallet_id, v_task.bounty_amount, 'escrow', 'Dispute resolved: bounty released to worker');

    UPDATE tasks SET status = 'approved' WHERE id = v_task.id;

  ELSIF v_return_count >= 2 THEN
    -- Return to poster
    v_resolution := 'return_poster';
    UPDATE wallets SET balance = balance + v_task.bounty_amount,
                       lifetime_spent = lifetime_spent - v_task.bounty_amount
    WHERE id = v_poster_wallet_id;
    INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
    VALUES (NULL, v_poster_wallet_id, v_task.bounty_amount, 'escrow', 'Dispute resolved: bounty returned to poster');

    UPDATE tasks SET status = 'cancelled' WHERE id = v_task.id;

  ELSE
    -- Split: half to each
    v_resolution := 'split';
    v_half_bounty := ROUND(v_task.bounty_amount / 2, 2);

    UPDATE wallets SET balance = LEAST(balance + v_half_bounty, 10000),
                       lifetime_earned = lifetime_earned + v_half_bounty
    WHERE id = v_worker_wallet_id;
    INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
    VALUES (NULL, v_worker_wallet_id, v_half_bounty, 'escrow', 'Dispute resolved: split - worker share');

    UPDATE wallets SET balance = balance + (v_task.bounty_amount - v_half_bounty),
                       lifetime_spent = lifetime_spent - (v_task.bounty_amount - v_half_bounty)
    WHERE id = v_poster_wallet_id;
    INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
    VALUES (NULL, v_poster_wallet_id, v_task.bounty_amount - v_half_bounty, 'escrow', 'Dispute resolved: split - poster share');

    UPDATE tasks SET status = 'cancelled' WHERE id = v_task.id;
  END IF;

  -- Resolve dispute
  UPDATE disputes SET status = 'resolved', resolution = v_resolution WHERE id = p_dispute_id;

  -- Notify both parties
  INSERT INTO notifications (user_id, type, title, body)
  VALUES
    (v_task.poster_id, 'transfer_received', 'Dispute resolved', 'Resolution: ' || v_resolution || ' for task: ' || v_task.title),
    (v_task.worker_id, 'transfer_received', 'Dispute resolved', 'Resolution: ' || v_resolution || ' for task: ' || v_task.title);

  RETURN jsonb_build_object('success', true, 'resolution', v_resolution);
END;
$$;

-- ============================================================================
-- 9. RPC FUNCTIONS - SERVICES
-- ============================================================================

-- Create service listing
CREATE OR REPLACE FUNCTION create_service(
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_price_tc NUMERIC,
  p_price_type price_type DEFAULT 'fixed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_service_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF char_length(p_title) < 3 THEN
    RETURN jsonb_build_object('error', 'Title must be at least 3 characters');
  END IF;
  IF char_length(p_description) < 10 THEN
    RETURN jsonb_build_object('error', 'Description must be at least 10 characters');
  END IF;

  INSERT INTO services (provider_id, title, description, category, price_tc, price_type)
  VALUES (v_user_id, p_title, p_description, p_category, p_price_tc, p_price_type)
  RETURNING id INTO v_service_id;

  RETURN jsonb_build_object('service_id', v_service_id);
END;
$$;

-- Add review and update averages
CREATE OR REPLACE FUNCTION add_service_review(
  p_service_id UUID,
  p_rating INTEGER,
  p_review_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_provider_id UUID;
  v_avg NUMERIC;
  v_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Can't review own service
  SELECT provider_id INTO v_provider_id FROM services WHERE id = p_service_id;
  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Service not found');
  END IF;
  IF v_provider_id = v_user_id THEN
    RETURN jsonb_build_object('error', 'Cannot review your own service');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('error', 'Rating must be between 1 and 5');
  END IF;

  -- Insert review (unique constraint handles duplicates)
  INSERT INTO service_reviews (service_id, reviewer_id, rating, review_text)
  VALUES (p_service_id, v_user_id, p_rating, p_review_text);

  -- Recalculate averages
  SELECT AVG(rating), COUNT(*) INTO v_avg, v_count
  FROM service_reviews WHERE service_id = p_service_id;

  UPDATE services
  SET rating_avg = ROUND(v_avg, 2), review_count = v_count
  WHERE id = p_service_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 10. FULL-TEXT SEARCH RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION search_content(
  p_query TEXT,
  p_type TEXT DEFAULT 'all',
  p_category TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery;
  v_results JSONB := '[]'::jsonb;
  v_posts JSONB;
  v_tasks JSONB;
  v_services JSONB;
BEGIN
  -- Build tsquery from user input
  v_tsquery := plainto_tsquery('english', p_query);

  IF p_type = 'all' OR p_type = 'post' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_posts
    FROM (
      SELECT p.id, 'post' AS type, p.content_text AS title, '' AS description,
             p.created_at, p.engagement_count,
             pr.display_name AS author_name,
             ts_rank(p.search_vector, v_tsquery) AS rank
      FROM posts p
      JOIN profiles pr ON pr.id = p.author_id
      WHERE p.search_vector @@ v_tsquery AND p.is_hidden = false
      ORDER BY rank DESC
      LIMIT p_limit OFFSET p_offset
    ) r;
    v_results := v_results || COALESCE(v_posts, '[]'::jsonb);
  END IF;

  IF p_type = 'all' OR p_type = 'task' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_tasks
    FROM (
      SELECT t.id, 'task' AS type, t.title, t.description,
             t.created_at, t.bounty_amount, t.status::text, t.category,
             pr.display_name AS author_name,
             ts_rank(t.search_vector, v_tsquery) AS rank
      FROM tasks t
      JOIN profiles pr ON pr.id = t.poster_id
      WHERE t.search_vector @@ v_tsquery
        AND (p_category IS NULL OR t.category = p_category)
        AND (p_status IS NULL OR t.status::text = p_status)
        AND (p_min_price IS NULL OR t.bounty_amount >= p_min_price)
        AND (p_max_price IS NULL OR t.bounty_amount <= p_max_price)
      ORDER BY rank DESC
      LIMIT p_limit OFFSET p_offset
    ) r;
    v_results := v_results || COALESCE(v_tasks, '[]'::jsonb);
  END IF;

  IF p_type = 'all' OR p_type = 'service' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_services
    FROM (
      SELECT s.id, 'service' AS type, s.title, s.description,
             s.created_at, s.price_tc AS bounty_amount, s.category,
             s.rating_avg, s.review_count,
             pr.display_name AS author_name,
             ts_rank(s.search_vector, v_tsquery) AS rank
      FROM services s
      JOIN profiles pr ON pr.id = s.provider_id
      WHERE s.search_vector @@ v_tsquery AND s.is_active = true
        AND (p_category IS NULL OR s.category = p_category)
        AND (p_min_price IS NULL OR s.price_tc >= p_min_price)
        AND (p_max_price IS NULL OR s.price_tc <= p_max_price)
      ORDER BY rank DESC
      LIMIT p_limit OFFSET p_offset
    ) r;
    v_results := v_results || COALESCE(v_services, '[]'::jsonb);
  END IF;

  RETURN v_results;
END;
$$;

-- Trending content (highest engagement in last 24h)
CREATE OR REPLACE FUNCTION get_trending_content(p_limit INTEGER DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_results
  FROM (
    -- Trending posts
    SELECT p.id, 'post' AS type, p.content_text AS title,
           p.engagement_count AS score, p.created_at,
           pr.display_name AS author_name
    FROM posts p
    JOIN profiles pr ON pr.id = p.author_id
    WHERE p.created_at > now() - interval '24 hours'
      AND p.is_hidden = false
    ORDER BY p.engagement_count DESC
    LIMIT p_limit
  ) r;

  RETURN v_results;
END;
$$;

-- ============================================================================
-- 11. REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE disputes;

-- ============================================================================
-- 12. ADD NOTIFICATION TYPES FOR MARKETPLACE
-- ============================================================================

-- The notification_type enum may need extending, but since we're using 'transfer_received'
-- as a generic notification type in Phase 2, we'll continue that pattern for simplicity.
-- In production, you'd ALTER TYPE notification_type ADD VALUE 'task_claimed', etc.
