-- Create contributions table with improved schema for data validation
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  contribution_type TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  title TEXT NOT NULL,
  description TEXT,
  github_link TEXT NOT NULL,
  github_analysis JSONB,
  ai_result JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  on_chain_tx TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries on user_address and status
CREATE INDEX IF NOT EXISTS idx_contributions_user_address_status ON contributions(user_address, status);
CREATE INDEX IF NOT EXISTS idx_contributions_user_score_status ON contributions(user_address, score, status);

-- Create user_tiers table
CREATE TABLE IF NOT EXISTS user_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL UNIQUE,
  current_tier TEXT NOT NULL DEFAULT 'UNRANKED' CHECK (current_tier IN ('UNRANKED', 'BUILDER', 'CONTRIBUTOR', 'LEADER')),
  total_score INTEGER NOT NULL DEFAULT 0,
  builder_achieved_at TIMESTAMP WITH TIME ZONE,
  contributor_achieved_at TIMESTAMP WITH TIME ZONE,
  leader_achieved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reputation_history table
CREATE TABLE IF NOT EXISTS reputation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  score_delta INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_contributions_user_address_status ON contributions(user_address, status);
CREATE INDEX IF NOT EXISTS idx_contributions_user_score_status ON contributions(user_address, score, status);
CREATE INDEX IF NOT EXISTS idx_user_tiers_user_address ON user_tiers(user_address);
CREATE INDEX IF NOT EXISTS idx_reputation_history_user_address ON reputation_history(user_address);
CREATE INDEX IF NOT EXISTS idx_reputation_history_created_at ON reputation_history(created_at DESC);

-- Enable RLS (Row Level Security) - optional but recommended
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read (users can see all contributions and tiers)
CREATE POLICY "contributions_public_read" ON contributions
  FOR SELECT USING (true);

CREATE POLICY "user_tiers_public_read" ON user_tiers
  FOR SELECT USING (true);

CREATE POLICY "reputation_history_public_read" ON reputation_history
  FOR SELECT USING (true);

-- Create RLS policies for inserts (need service role or authenticated user)
CREATE POLICY "contributions_insert_authenticated" ON contributions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "contributions_update_authenticated" ON contributions
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "contributions_delete_authenticated" ON contributions
  FOR DELETE USING (true);

CREATE POLICY "user_tiers_insert_authenticated" ON user_tiers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "user_tiers_update_authenticated" ON user_tiers
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "reputation_history_insert_authenticated" ON reputation_history
  FOR INSERT WITH CHECK (true);
