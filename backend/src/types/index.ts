export interface User {
    twitter_id: string;
    wallet_address: string;
    private_key_encrypted: string | null;
    verified_at: Date;
}

export interface Deployment {
    id: number;
    deploy_tweet_id: string;
    parent_tweet_id: string;
    deployer_twitter_id: string;
    fee_recipient_twitter_id: string;
    fee_recipient_wallet: string;
    token_address: string | null;
    pool_id: string | null;
    tx_hash: string | null;
    status: DeploymentStatus;
    created_at: Date;
}

export type DeploymentStatus =
    | 'pending'
    | 'processing'
    | 'deployed'
    | 'failed'
    | 'wallet_missing';

export interface DeployCommand {
    ticker: string;
    name: string;
}

export interface TweetMention {
    tweet_id: string;
    author_id: string;
    author_username: string;
    text: string;
    in_reply_to_tweet_id: string | null;
    created_at: string;
}

export interface ParentTweetInfo {
    tweet_id: string;
    author_id: string;
    author_username: string;
}

export interface DeploymentJob {
    mention: TweetMention;
    command: DeployCommand;
    parentTweet: ParentTweetInfo;
}

export interface DeploymentResult {
    success: boolean;
    tokenAddress?: string;
    poolId?: string;
    txHash?: string;
    error?: string;
}
