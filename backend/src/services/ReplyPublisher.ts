import { config } from '../config/index.js';
import { TwitterApiIoClient } from './TwitterApiIoClient.js';

/**
 * ReplyPublisher - Posts deployment confirmations back to X
 * Uses twitterapi.io to bypass X API Free tier restrictions
 */
export class ReplyPublisher {
    private twitterApiIoClient?: TwitterApiIoClient;

    constructor() {
        // Only initialize twitterapi.io client if key is configured
        if (config.TWITTERAPI_IO_KEY && !config.MOCK_X_API) {
            this.twitterApiIoClient = new TwitterApiIoClient();
        }
    }

    /**
     * Post a successful deployment reply
     */
    async postSuccess(params: {
        replyToTweetId: string;
        tokenTicker: string;
        tokenName: string;
        tokenAddress: string;
        poolId: string;
        feeRecipientUsername: string;
    }): Promise<string | null> {
        const text = this.formatSuccessReply(params);

        if (config.MOCK_X_API) {
            console.log(`🎭 MOCK REPLY [Success] to ${params.replyToTweetId}:`);
            console.log(text);
            return 'mock_tweet_id';
        }

        if (!this.twitterApiIoClient) {
            console.error('❌ TwitterApiIoClient not initialized');
            return null;
        }

        try {
            const result = await this.twitterApiIoClient.postReply(text, params.replyToTweetId);

            if (result.success) {
                console.log(`✅ Posted success reply: ${result.tweetId}`);
                return result.tweetId || null;
            } else {
                console.error(`❌ Failed to post success reply: ${result.error}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to post success reply:', error);
            return null;
        }
    }

    /**
     * Post a wallet linking required reply
     */
    async postWalletRequired(params: {
        replyToTweetId: string;
        username: string;
    }): Promise<string | null> {
        const text = `@${params.username} ❌ Deployment failed

The original tweet author hasn't linked their wallet yet.

They need to link their wallet at [link] before tokens can be deployed.`;

        if (config.MOCK_X_API) {
            console.log(`🎭 MOCK REPLY [Wallet Required] to ${params.replyToTweetId}`);
            return 'mock_tweet_id';
        }

        if (!this.twitterApiIoClient) {
            console.error('❌ TwitterApiIoClient not initialized');
            return null;
        }

        try {
            const result = await this.twitterApiIoClient.postReply(text, params.replyToTweetId);

            if (result.success) {
                console.log(`📝 Posted wallet required reply: ${result.tweetId}`);
                return result.tweetId || null;
            } else {
                console.error(`❌ Failed to post wallet required reply: ${result.error}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to post wallet required reply:', error);
            return null;
        }
    }

    /**
     * Post a failure reply
     */
    async postFailure(params: {
        replyToTweetId: string;
        username: string;
        reason: string;
    }): Promise<string | null> {
        const text = `@${params.username} ❌ Deployment failed

${params.reason}

Please try again later.`;

        if (config.MOCK_X_API) {
            console.log(`🎭 MOCK REPLY [Failure] to ${params.replyToTweetId}: ${params.reason}`);
            return 'mock_tweet_id';
        }

        if (!this.twitterApiIoClient) {
            console.error('❌ TwitterApiIoClient not initialized');
            return null;
        }

        try {
            const result = await this.twitterApiIoClient.postReply(text, params.replyToTweetId);

            if (result.success) {
                console.log(`📝 Posted failure reply: ${result.tweetId}`);
                return result.tweetId || null;
            } else {
                console.error(`❌ Failed to post failure reply: ${result.error}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to post failure reply:', error);
            return null;
        }
    }

    /**
     * Format success reply message
     */
    private formatSuccessReply(params: {
        tokenTicker: string;
        tokenName: string;
        tokenAddress: string;
        poolId: string;
        feeRecipientUsername: string;
    }): string {
        // Truncate addresses for display
        const shortToken = `${params.tokenAddress.slice(0, 6)}...${params.tokenAddress.slice(-4)}`;

        // Add minimal randomness to avoid "Duplicate Content" errors during testing
        const refId = Math.random().toString(36).substring(2, 7);

        // Competitor-style format (Concise)
        return `@${params.feeRecipientUsername} Token ${params.tokenName} ($${params.tokenTicker}) Deployed! 🚀
Send 'claim ${params.tokenAddress}' to my DM to take ownership.

Tx: basescan.org/tx/${params.poolId}
CA: ${params.tokenAddress}
Tax Wallet: ${config.FEE_HOOK_ADDRESS}

[Ref: ${refId}]`;
    }
}

export const replyPublisher = new ReplyPublisher();
