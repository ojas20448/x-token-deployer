-- Database schema for X-Native Token Deployment Bot
-- Run: psql $DATABASE_URL < schema.sql

-- Users table: maps Twitter IDs to wallet addresses
CREATE TABLE IF NOT EXISTS users (
    twitter_id VARCHAR(64) PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    private_key_encrypted TEXT, -- Encrypted custodial key
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_wallet CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Index for quick wallet lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);

-- Deployments table: tracks all token deployments
CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    
    -- Tweet references
    deploy_tweet_id VARCHAR(64) NOT NULL,
    parent_tweet_id VARCHAR(64) NOT NULL,
    
    -- User references  
    deployer_twitter_id VARCHAR(64) NOT NULL,
    fee_recipient_twitter_id VARCHAR(64) NOT NULL,
    fee_recipient_wallet VARCHAR(42) NOT NULL,
    
    -- Token info
    token_name VARCHAR(100),
    token_symbol VARCHAR(20),
    
    -- On-chain data (populated after deployment)
    token_address VARCHAR(42),
    pool_id VARCHAR(66),
    tx_hash VARCHAR(66),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'deployed', 'failed', 'wallet_missing')),
    CONSTRAINT unique_deploy_tweet UNIQUE (deploy_tweet_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_deployer ON deployments(deployer_twitter_id);
CREATE INDEX IF NOT EXISTS idx_deployments_recipient ON deployments(fee_recipient_twitter_id);
CREATE INDEX IF NOT EXISTS idx_deployments_created ON deployments(created_at DESC);

-- Rate limiting table (optional - can also use Redis)
CREATE TABLE IF NOT EXISTS rate_limits (
    twitter_id VARCHAR(64) PRIMARY KEY,
    last_deploy_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deploy_count_24h INTEGER NOT NULL DEFAULT 1
);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_deployments_updated_at ON deployments;

CREATE TRIGGER update_deployments_updated_at
    BEFORE UPDATE ON deployments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
