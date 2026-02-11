import { Worker, Job } from 'bullmq';
import { redisConnection } from './queue.js';
import { walletResolver } from '../services/WalletResolver.js';
import { blockchainDeployer } from '../services/BlockchainDeployer.js';
import { replyPublisher } from '../services/ReplyPublisher.js';
import { db } from '../db/client.js';
import type { DeploymentJob } from '../types/index.js';
import type { Address } from 'viem';
import { config } from '../config/index.js';

const RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Process a single deployment job
 * Decoupled from BullMQ for easier testing and mocking
 */
export async function processDeploymentJob(data: DeploymentJob): Promise<any> {
    const { mention, command, parentTweet } = data;

    console.log(`\n🔧 Processing deployment job for tweet ${mention.tweet_id}`);
    console.log(`   Token: ${command.ticker} (${command.name})`);
    console.log(`   Fee recipient: @${parentTweet.author_username}`);

    try {
        // 1. Check if deployment already exists (idempotency)
        if (await db.deploymentExists(mention.tweet_id)) {
            console.log(`⏭️ Deployment for tweet ${mention.tweet_id} already exists`);
            return { status: 'skipped', reason: 'duplicate' };
        }

        // 2. Resolve fee recipient wallet
        const feeRecipientWallet = await walletResolver.resolve(parentTweet.author_id);

        if (!feeRecipientWallet) {
            console.log(`❌ No wallet linked for @${parentTweet.author_username}`);

            // Create deployment record with wallet_missing status
            await db.createDeployment({
                deployTweetId: mention.tweet_id,
                parentTweetId: parentTweet.tweet_id,
                deployerTwitterId: mention.author_id,
                feeRecipientTwitterId: parentTweet.author_id,
                feeRecipientWallet: '',
                tokenName: command.name,
                tokenSymbol: command.ticker,
            });

            await db.updateDeploymentStatus(mention.tweet_id, 'wallet_missing');

            // Post reply requesting wallet linking
            await replyPublisher.postWalletRequired({
                replyToTweetId: mention.tweet_id,
                username: mention.author_username,
            });

            return { status: 'wallet_missing' };
        }

        // 3. Check rate limits
        const canDeploy = await db.checkRateLimit(mention.author_id, RATE_LIMIT_COOLDOWN_MS);
        if (!canDeploy) {
            console.log(`⏳ Rate limited: @${mention.author_username}`);

            await replyPublisher.postFailure({
                replyToTweetId: mention.tweet_id,
                username: mention.author_username,
                reason: 'Rate limited. Please wait before deploying again.',
            });

            return { status: 'rate_limited' };
        }

        // 4. Create deployment record
        const deployment = await db.createDeployment({
            deployTweetId: mention.tweet_id,
            parentTweetId: parentTweet.tweet_id,
            deployerTwitterId: mention.author_id,
            feeRecipientTwitterId: parentTweet.author_id,
            feeRecipientWallet: feeRecipientWallet,
            tokenName: command.name,
            tokenSymbol: command.ticker,
        });

        await db.updateDeploymentStatus(mention.tweet_id, 'processing');
        await db.recordDeployAttempt(mention.author_id);

        // 5. Execute on-chain deployment
        console.log(`⛓️ Executing on-chain deployment...`);

        const result = await blockchainDeployer.deploy({
            name: command.name,
            symbol: command.ticker,
            feeRecipient: feeRecipientWallet as Address,
            deployerTwitterId: mention.author_id,
        });

        if (!result.success) {
            console.error(`❌ Deployment failed: ${result.error}`);

            await db.updateDeploymentStatus(mention.tweet_id, 'failed', {
                txHash: result.txHash,
                errorMessage: result.error,
            });

            await replyPublisher.postFailure({
                replyToTweetId: mention.tweet_id,
                username: mention.author_username,
                reason: 'On-chain deployment failed. Please try again.',
            });

            return { status: 'failed', error: result.error };
        }

        // 6. Update deployment record with success
        await db.updateDeploymentStatus(mention.tweet_id, 'deployed', {
            tokenAddress: result.tokenAddress,
            poolId: result.poolId,
            txHash: result.txHash,
        });

        // 7. Post success reply
        await replyPublisher.postSuccess({
            replyToTweetId: mention.tweet_id,
            tokenTicker: command.ticker,
            tokenName: command.name,
            tokenAddress: result.tokenAddress!,
            poolId: result.poolId!,
            feeRecipientUsername: parentTweet.author_username,
        });

        console.log(`✅ Deployment complete for ${command.ticker}`);

        return {
            status: 'deployed',
            tokenAddress: result.tokenAddress,
            poolId: result.poolId,
            txHash: result.txHash,
        };

    } catch (error) {
        console.error(`❌ Error processing job for tweet ${mention.tweet_id}:`, error);

        // Update database if we have a deployment record
        try {
            await db.updateDeploymentStatus(mention.tweet_id, 'failed', {
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        } catch (dbError) {
            console.error('Failed to update deployment status:', dbError);
        }

        throw error;
    }
}

/**
 * Deployment Worker
 * Only initialized if Redis is available
 */
let deploymentWorker: Worker<DeploymentJob> | undefined;

if (!config.MOCK_QUEUE && redisConnection) {
    deploymentWorker = new Worker<DeploymentJob>(
        'deployments',
        async (job: Job<DeploymentJob>) => {
            return processDeploymentJob(job.data);
        },
        {
            connection: redisConnection,
            concurrency: 1, // Process one deployment at a time
            limiter: {
                max: 10,
                duration: 60000, // 10 deployments per minute max
            },
        }
    );

    // Worker event handlers
    deploymentWorker.on('completed', (job) => {
        console.log(`✅ Worker completed job ${job.id}`);
    });

    deploymentWorker.on('failed', (job, err) => {
        console.error(`❌ Worker failed job ${job?.id}:`, err.message);
    });

    deploymentWorker.on('error', (err) => {
        console.error('❌ Worker error:', err);
    });
} else {
    console.log('🎭 MOCK QUEUE enabled - Worker bypassed');
}

export { deploymentWorker };
