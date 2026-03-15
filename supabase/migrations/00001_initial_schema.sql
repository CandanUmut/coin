-- TimeCoin Phase 1: Foundation Schema
-- This migration creates the core tables, types, RLS policies, and functions

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE transaction_type AS ENUM ('transfer', 'earning', 'tax', 'purchase', 'escrow', 'welcome_bonus');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles table: linked to auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallets table: one per user, with balance constraints
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (balance >= 0)
    CHECK (balance <= 10000),
  lifetime_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table: immutable ledger
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type transaction_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Community treasury: single row
CREATE TABLE community_treasury (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_tax_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_fiat_revenue NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Insert the single treasury row
INSERT INTO community_treasury (total_balance, total_tax_collected, total_fiat_revenue)
VALUES (0, 0, 0);

-- Index for faster transaction lookups
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_treasury ENABLE ROW LEVEL SECURITY;

-- Profiles: read any, update own
CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Wallets: read own only
CREATE POLICY "Users can read own wallet"
  ON wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Transactions: read own (from or to)
CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  USING (
    from_wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid())
    OR to_wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid())
  );

-- Transactions: no direct insert/update/delete via client
-- All inserts happen through RPC functions with SECURITY DEFINER

-- Community treasury: anyone can read
CREATE POLICY "Anyone can read treasury"
  ON community_treasury FOR SELECT
  USING (true);

-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- CREATE PROFILE AND WALLET ON USER SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION create_profile_and_wallet()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name TEXT;
  _wallet_id UUID;
BEGIN
  -- Get display name from user metadata, fallback to email prefix
  _display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'display_name',
    split_part(NEW.email, '@', 1)
  );

  -- Create profile
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, _display_name);

  -- Create wallet with 50 TC welcome bonus
  INSERT INTO wallets (user_id, balance, lifetime_earned)
  VALUES (NEW.id, 50, 50)
  RETURNING id INTO _wallet_id;

  -- Record welcome bonus transaction
  INSERT INTO transactions (to_wallet_id, amount, type, description)
  VALUES (_wallet_id, 50, 'welcome_bonus', 'Welcome bonus for joining TimeCoin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_and_wallet();

-- ============================================================================
-- TRANSFER RPC FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_tc(
  recipient_username TEXT,
  transfer_amount NUMERIC,
  transfer_description TEXT DEFAULT ''
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_id UUID;
  _sender_wallet_id UUID;
  _sender_balance NUMERIC;
  _recipient_user_id UUID;
  _recipient_wallet_id UUID;
  _recipient_balance NUMERIC;
BEGIN
  -- Get sender info
  _sender_id := auth.uid();
  IF _sender_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Validate amount
  IF transfer_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be greater than 0');
  END IF;

  -- Get sender wallet
  SELECT id, balance INTO _sender_wallet_id, _sender_balance
  FROM wallets
  WHERE user_id = _sender_id
  FOR UPDATE;

  IF _sender_wallet_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Sender wallet not found');
  END IF;

  -- Check sender has sufficient balance
  IF _sender_balance < transfer_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient balance');
  END IF;

  -- Find recipient by display_name
  SELECT p.id INTO _recipient_user_id
  FROM profiles p
  WHERE LOWER(p.display_name) = LOWER(recipient_username);

  IF _recipient_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Recipient not found');
  END IF;

  -- Cannot send to yourself
  IF _recipient_user_id = _sender_id THEN
    RETURN jsonb_build_object('error', 'Cannot send to yourself');
  END IF;

  -- Get recipient wallet
  SELECT id, balance INTO _recipient_wallet_id, _recipient_balance
  FROM wallets
  WHERE user_id = _recipient_user_id
  FOR UPDATE;

  IF _recipient_wallet_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Recipient wallet not found');
  END IF;

  -- Check recipient won't exceed cap
  IF (_recipient_balance + transfer_amount) > 10000 THEN
    RETURN jsonb_build_object('error', 'Transfer would exceed recipient''s 10,000 TC cap');
  END IF;

  -- Perform transfer: debit sender
  UPDATE wallets
  SET balance = balance - transfer_amount,
      lifetime_spent = lifetime_spent + transfer_amount
  WHERE id = _sender_wallet_id;

  -- Credit recipient
  UPDATE wallets
  SET balance = balance + transfer_amount,
      lifetime_earned = lifetime_earned + transfer_amount
  WHERE id = _recipient_wallet_id;

  -- Create transaction record
  INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, type, description)
  VALUES (_sender_wallet_id, _recipient_wallet_id, transfer_amount, 'transfer', transfer_description);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMUNITY TAX FUNCTION (called by pg_cron or Edge Function)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_community_tax()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet RECORD;
  _tax_amount NUMERIC;
  _total_tax NUMERIC := 0;
BEGIN
  -- Loop through all wallets with balance > 100
  FOR _wallet IN
    SELECT id, balance FROM wallets WHERE balance > 100
    FOR UPDATE
  LOOP
    _tax_amount := 0;

    -- Progressive tax brackets (daily rates)
    -- 0-100: 0%
    -- 101-500: 0.01%
    -- 501-2000: 0.05%
    -- 2001-5000: 0.1%
    -- 5001-10000: 0.2%

    IF _wallet.balance > 5000 THEN
      _tax_amount := _tax_amount + (LEAST(_wallet.balance, 10000) - 5000) * 0.002;
    END IF;
    IF _wallet.balance > 2000 THEN
      _tax_amount := _tax_amount + (LEAST(_wallet.balance, 5000) - 2000) * 0.001;
    END IF;
    IF _wallet.balance > 500 THEN
      _tax_amount := _tax_amount + (LEAST(_wallet.balance, 2000) - 500) * 0.0005;
    END IF;
    IF _wallet.balance > 100 THEN
      _tax_amount := _tax_amount + (LEAST(_wallet.balance, 500) - 100) * 0.0001;
    END IF;

    -- Round to 2 decimals, skip if negligible
    _tax_amount := ROUND(_tax_amount, 2);
    IF _tax_amount < 0.01 THEN
      CONTINUE;
    END IF;

    -- Deduct tax from wallet
    UPDATE wallets
    SET balance = balance - _tax_amount,
        lifetime_spent = lifetime_spent + _tax_amount
    WHERE id = _wallet.id;

    -- Record tax transaction
    INSERT INTO transactions (from_wallet_id, amount, type, description)
    VALUES (_wallet.id, _tax_amount, 'tax', 'Daily community tax');

    _total_tax := _total_tax + _tax_amount;
  END LOOP;

  -- Credit community treasury
  IF _total_tax > 0 THEN
    UPDATE community_treasury
    SET total_balance = total_balance + _total_tax,
        total_tax_collected = total_tax_collected + _total_tax;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PG_CRON SCHEDULE (uncomment when pg_cron extension is enabled)
-- Run daily at midnight UTC
-- ============================================================================

-- SELECT cron.schedule(
--   'daily-community-tax',
--   '0 0 * * *',
--   $$ SELECT calculate_community_tax(); $$
-- );

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
