import { TwitterApi, ETwitterStreamEvent, TweetV2SingleStreamResult } from 'twitter-api-v2';
import { config } from '../config/index.js';
import { db } from '../db/client.js';
import { deploymentQueue } from '../workers/queue.js';
import { CommandParser } from './CommandParser.js';
import { ParentTweetResolver } from './ParentTweetResolver.js';
import { TwitterApiIoClient, type TwitterApiIoTweet } from './TwitterApiIoClient.js';
import type { TweetMention } from '../types/index.js';
import { processDeploymentJob } from '../workers/deploymentWorker.js';
import { ethers } from 'ethers';
import { walletService } from './WalletService.js';
import { blockchainDeployer } from './BlockchainDeployer.js';

/**
 * XListener - Listens for mentions of the bot on X (Twitter)
 * Supports three modes:
 * 1. Mock Mode (MOCK_X_API=true) - Simulates tweets for testing
 * 2. TwitterAPI.io Mode (TWITTERAPI_IO_KEY set) - Polls third-party API
 * 3. Official X API Mode - Uses X API v2 Filtered Stream ($100/mo)
 */
export class XListener {
    private client: TwitterApi;
    private appClient: TwitterApi;
    private botUsername: string;
    private commandParser: CommandParser;
    private parentResolver: ParentTweetResolver;
    private isRunning = false;

    // For twitterapi.io polling
    private twitterApiIoClient?: TwitterApiIoClient;
    private lastSeenTweetId?: string;
    private lastProcessedDmId?: string;
    private pollInterval?: NodeJS.Timeout;

    constructor() {
        if (config.MOCK_X_API) {
            this.client = new TwitterApi({
                appKey: 'mock_key',
                appSecret: 'mock_secret',
                accessToken: 'mock_token',
                accessSecret: 'mock_secret',
            });
            this.appClient = this.client;
        } else {
            this.client = new TwitterApi({
                appKey: config.X_API_KEY!,
                appSecret: config.X_API_SECRET!,
                accessToken: config.X_ACCESS_TOKEN!,
                accessSecret: config.X_ACCESS_SECRET!,
            });
            this.appClient = new TwitterApi(config.X_BEARER_TOKEN!);
        }

        this.botUsername = config.X_BOT_USERNAME;
        this.commandParser = new CommandParser(this.botUsername);
        this.parentResolver = new ParentTweetResolver(this.client);

        // Initialize twitterapi.io client if key is configured
        if (config.TWITTERAPI_IO_KEY) {
            this.twitterApiIoClient = new TwitterApiIoClient();
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ XListener already running');
            return;
        }

        // Priority 1: Mock Mode
        if (config.MOCK_X_API) {
            console.log('🎭 Starting X Listener in MOCK MODE...');
            this.startMockStream();
            return;
        }

        // Priority 2: twitterapi.io Mode (cheaper alternative)
        if (this.twitterApiIoClient) {
            console.log('🌐 Starting X Listener in TWITTERAPI.IO MODE...');
            await this.startTwitterApiIoPolling();
            return;
        }

        // Priority 3: Official X API (requires Basic tier)
        console.log('🐦 Starting X API Filtered Stream...');
        await this.startOfficialStream();
    }

    /**
     * Start polling twitterapi.io for tweets
     */
    private async startTwitterApiIoPolling(): Promise<void> {
        if (!this.twitterApiIoClient) return;

        try {
            // Register the bot username for monitoring
            await this.twitterApiIoClient.registerUserForMonitoring(this.botUsername);

            this.isRunning = true;
            console.log(`✅ Polling twitterapi.io for @${this.botUsername} mentions every 12s...`);

            let isOddPoll = true; // Alternate between mentions and DMs

            // Poll every 12 seconds, alternating between mentions and DMs
            // This ensures we respect the 1 req/5sec limit (12s > 5s * 2)
            this.pollInterval = setInterval(async () => {
                try {
                    if (isOddPoll) {
                        await this.pollTwitterApiIo();
                    } else {
                        await this.pollDMs();
                    }
                    isOddPoll = !isOddPoll; // Alternate
                } catch (error) {
                    console.error('❌ Poll error:', error);
                }
            }, 12000);

            // Initial poll
            await this.pollTwitterApiIo();
        } catch (error) {
            console.error('❌ Failed to start twitterapi.io polling:', error);
            throw error;
        }
    }

    /**
     * Poll for new tweets from twitterapi.io
     */
    private async pollTwitterApiIo(): Promise<void> {
        if (!this.twitterApiIoClient) return;

        const tweets = await this.twitterApiIoClient.getTweets(this.botUsername);

        if (!tweets.length) {
            console.log('📭 No new tweets');
            return;
        }

        console.log(`📬 Found ${tweets.length} tweet(s)`);

        for (const tweet of tweets) {
            // Skip if we've already seen this tweet
            if (this.lastSeenTweetId && tweet.id <= this.lastSeenTweetId) {
                continue;
            }

            // Must contain our bot mention
            if (!tweet.text.toLowerCase().includes(`@${this.botUsername.toLowerCase()}`)) {
                continue;
            }

            await this.handleTwitterApiIoTweet(tweet);
            this.lastSeenTweetId = tweet.id;
        }
    }

    /**
     * Handle a tweet from twitterapi.io
     */
    private async handleTwitterApiIoTweet(tweet: TwitterApiIoTweet): Promise<void> {
        console.log(`📨 Processing tweet: ${tweet.id}`);
        console.log(`   From: @${tweet.author.userName}`);
        console.log(`   Text: ${tweet.text.substring(0, 100)}...`);

        try {
            const mention: TweetMention = {
                tweet_id: tweet.id,
                author_id: tweet.author.id,
                author_username: tweet.author.userName,
                text: tweet.text,
                in_reply_to_tweet_id: tweet.inReplyToId || null,
                created_at: tweet.createdAt,
            };

            // Parse deploy command
            const command = this.commandParser.parse(mention.text);
            if (!command) {
                console.log(`⏭️ No valid deploy command in tweet ${tweet.id}`);
                return;
            }

            // Determine fee recipient:
            // - If reply: fee goes to parent tweet author
            // - If direct mention: fee goes to tweet author (self-deploy)
            let feeRecipient: { author_id: string; author_username: string };

            if (mention.in_reply_to_tweet_id) {
                // It's a reply - use parent tweet author
                const parentTweet = await this.parentResolver.resolve(mention.in_reply_to_tweet_id);
                if (!parentTweet) {
                    console.log(`⚠️ Could not resolve parent tweet, using self as fee recipient`);
                    feeRecipient = { author_id: tweet.author.id, author_username: tweet.author.userName };
                } else {
                    feeRecipient = { author_id: parentTweet.author_id, author_username: parentTweet.author_username };
                }
            } else {
                // Direct mention - use tweet author as fee recipient
                feeRecipient = { author_id: tweet.author.id, author_username: tweet.author.userName };
                console.log(`📣 Direct mention - deployer is fee recipient`);
            }

            console.log(`✅ Valid deploy: ${command.ticker} (${command.name})`);
            console.log(`   Fee recipient: @${feeRecipient.author_username}`);

            // Create a parentTweet-like object for the queue
            const parentTweet = {
                tweet_id: mention.in_reply_to_tweet_id || mention.tweet_id,
                author_id: feeRecipient.author_id,
                author_username: feeRecipient.author_username,
            };

            // Queue or process directly
            if (config.MOCK_QUEUE) {
                await processDeploymentJob({ mention, command, parentTweet });
            } else {
                await deploymentQueue.add('deploy', { mention, command, parentTweet });
                console.log(`📤 Queued deployment job for tweet ${tweet.id}`);
            }
        } catch (error) {
            console.error(`❌ Error processing tweet ${tweet.id}:`, error);
        }
    }

    /**
     * Poll for DMs
     */
    private async pollDMs(): Promise<void> {
        if (!this.twitterApiIoClient) return;

        try {
            const dms = await this.twitterApiIoClient.getDMs();

            if (!dms.length) return;

            // Sort by creation time ascending (oldest first)
            dms.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            for (const dm of dms) {
                // Skip if handled
                if (this.lastProcessedDmId && dm.id <= this.lastProcessedDmId) {
                    continue;
                }

                await this.handleDM(dm);
                this.lastProcessedDmId = dm.id;
            }
        } catch (error) {
            console.error('❌ Error polling DMs:', error);
        }
    }

    /**
     * Handle a parsed DM
     */
    private async handleDM(dm: { id: string; sender_id: string; text: string; created_at: string }): Promise<void> {
        const text = dm.text.trim();

        // 1. START Command
        if (text.toLowerCase() === 'start') {
            await this.handleStartCommand(dm.sender_id);
            return;
        }

        // 2. DEPLOY Command
        // Format: "deploy" (interactive not supported yet) or multiline
        if (text.toLowerCase().startsWith('deploy')) {
            await this.handleDeployCommand(dm.sender_id, text);
            return;
        }

        // 3. LINK Command (Legacy/Optional)
        // Regex: /link\s+(0x[a-fA-F0-9]{40})/i
        const match = text.match(/link\s+(0x[a-fA-F0-9]{40})/i);
        if (match) {
            const walletAddress = match[1];
            console.log(`📩 Processing DM from ${dm.sender_id}: Link request for ${walletAddress}`);

            try {
                // If linking external wallet, we might wipe encrypted key? 
                // For now, let's allow linking external but prefer internal if 'start' used.
                await db.upsertUser(dm.sender_id, walletAddress, null); // Nullifies encrypted key
                console.log(`✅ Wallet linked: ${dm.sender_id} -> ${walletAddress}`);
                await this.sendDM(dm.sender_id, `✅ External wallet linked: ${walletAddress}`);
            } catch (error) {
                console.error('❌ Error handling DM link:', error);
                await this.sendDM(dm.sender_id, `❌ Failed to link wallet.`);
            }
            return;
        }

        console.log(`📩 Ignoring unknown DM from ${dm.sender_id}: "${text.substring(0, 50)}..."`);
    }

    private async handleStartCommand(senderId: string): Promise<void> {
        console.log(`🚀 Processing START command for ${senderId}`);
        try {
            const user = await db.getUserByTwitterId(senderId);
            if (user?.private_key_encrypted) {
                await this.sendDM(senderId, `ℹ️ You already have a wallet.\nAddress: ${user.wallet_address}\n\nTo deploy, send:\ndeploy\nname: <Token Name>\nsymbol: <Ticker>\ndesc: <Description>\nimage: <Image URL>`);
                return;
            }

            const { address, privateKey } = walletService.createWallet();
            const encryptedKey = walletService.encrypt(privateKey);

            await db.upsertUser(senderId, address, encryptedKey);

            await this.sendDM(senderId, `✅ Wallet Generated!\n\nAddress: ${address}\n\nPlease deposit ~0.02 BNB to cover deployment fees.\n\nTo deploy, send:\ndeploy\nname: Your Token\nsymbol: TICKER\ndesc: Description\nimage: https://...`);
        } catch (error) {
            console.error('❌ Error in start command:', error);
            await this.sendDM(senderId, '❌ Failed to create wallet. Please try again.');
        }
    }

    private async handleDeployCommand(senderId: string, text: string): Promise<void> {
        console.log(`🚀 Processing DEPLOY command for ${senderId}`);

        // Parse params from text
        // Expecting key: value format
        const lines = text.split('\n');
        const params: any = {};
        for (const line of lines) {
            const [key, ...parts] = line.split(':');
            if (key && parts.length > 0) {
                params[key.trim().toLowerCase()] = parts.join(':').trim();
            }
        }

        if (!params.name || !params.symbol || !params.image) {
            await this.sendDM(senderId, `❌ Missing required fields.\nPlease provide:\nname: ...\nsymbol: ...\nimage: ...\n(desc is optional)`);
            return;
        }

        try {
            const user = await db.getUserByTwitterId(senderId);
            if (!user || !user.private_key_encrypted) {
                await this.sendDM(senderId, `❌ No wallet found. Send 'start' to create one.`);
                return;
            }

            const provider = new ethers.JsonRpcProvider(config.RPC_URL);
            const wallet = walletService.getWallet(user.private_key_encrypted, provider);

            // Check balance
            const balance = await provider.getBalance(wallet.address);
            const required = ethers.parseEther('0.015'); // 0.01 fee + gas
            if (balance < required) {
                await this.sendDM(senderId, `❌ Insufficient funds.\nBalance: ${ethers.formatEther(balance)} BNB\nRequired: 0.015 BNB`);
                return;
            }

            await this.sendDM(senderId, `⏳ Deploying ${params.symbol}... This may take a moment.`);

            const result = await blockchainDeployer.deploy({
                name: params.name,
                symbol: params.symbol,
                description: params.desc || '',
                image: params.image,
                twitter: params.twitter,
                telegram: params.telegram,
                website: params.website
            }, wallet);

            if (result.success) {
                await this.sendDM(senderId, `✅ Deployment Successful!\n\nToken: ${result.tokenAddress}\nHash: ${result.txHash}\n\nView on BscScan: https://bscscan.com/tx/${result.txHash}`);
            } else {
                await this.sendDM(senderId, `❌ Deployment Failed: ${result.error}`);
            }

        } catch (error: any) {
            console.error('❌ Error in deploy command:', error);
            await this.sendDM(senderId, `❌ Error: ${error.message}`);
        }
    }

    private async sendDM(recipientId: string, text: string): Promise<void> {
        if (!this.twitterApiIoClient) {
            console.log(`[Mock DM] To ${recipientId}: ${text}`);
            return;
        }
        await this.twitterApiIoClient.sendDM(recipientId, text);
    }

    /**
     * Start official X API filtered stream
     */
    private async startOfficialStream(): Promise<void> {
        try {
            if (!config.X_API_KEY || !config.X_BEARER_TOKEN) {
                throw new Error('Missing X API credentials');
            }

            await this.setupStreamRules();

            const stream = await this.appClient.v2.searchStream({
                'tweet.fields': ['author_id', 'created_at', 'in_reply_to_user_id', 'referenced_tweets'],
                'user.fields': ['username'],
                expansions: ['author_id', 'referenced_tweets.id'],
            });

            this.isRunning = true;
            console.log('✅ Filtered stream connected.');

            stream.on(ETwitterStreamEvent.Data, (tweet) => this.handleTweet(tweet));
            stream.on(ETwitterStreamEvent.Error, (error) => this.handleError(error));
            stream.on(ETwitterStreamEvent.ConnectionClosed, () => this.handleDisconnect());
            stream.autoReconnect = true;

        } catch (error) {
            console.error('❌ Failed to start stream:', error);
            throw error;
        }
    }

    private startMockStream() {
        this.isRunning = true;
        console.log('🎭 Starting X Listener in MOCK MODE...');
        console.log('   (Simulating incoming tweets. ONE-SHOT mode.)');

        setTimeout(() => {
            const mockTweet: TweetV2SingleStreamResult = {
                data: {
                    id: '1234567890',
                    text: `@${this.botUsername} deploy\nticker: OJAS\nname: Ojas Narang`,
                    author_id: '123456789',
                    created_at: new Date().toISOString(),
                    referenced_tweets: [{ type: 'replied_to', id: '987654321' }],
                    edit_history_tweet_ids: ['1234567890'],
                },
                includes: {
                    users: [
                        { id: '123456789', name: 'Test User', username: 'testuser', verified: false, protected: false, created_at: new Date().toISOString() },
                        { id: '987654321', username: 'original_author', name: 'Original Author', verified: false, protected: false, created_at: new Date().toISOString() }
                    ]
                },
                matching_rules: [{ id: 'mock_rule', tag: 'deploy_command' }]
            };

            console.log('\n🐦 Mock Tweet Received:', mockTweet.data.text);
            this.handleTweet(mockTweet);
        }, 10000);
    }

    private async setupStreamRules(): Promise<void> {
        const rules = await this.appClient.v2.streamRules();
        if (rules.data?.length) {
            await this.appClient.v2.updateStreamRules({
                delete: { ids: rules.data.map((rule) => rule.id) },
            });
        }
        await this.appClient.v2.updateStreamRules({
            add: [{ value: `@${this.botUsername} deploy`, tag: 'deploy_command' }],
        });
        console.log(`📋 Stream rules set for @${this.botUsername}`);
    }

    private async handleTweet(data: TweetV2SingleStreamResult): Promise<void> {
        const tweet = data.data;
        console.log(`📨 Received tweet: ${tweet.id}`);

        try {
            const mention: TweetMention = {
                tweet_id: tweet.id,
                author_id: tweet.author_id!,
                author_username: this.extractUsername(data, tweet.author_id!),
                text: tweet.text,
                in_reply_to_tweet_id: this.extractParentTweetId(tweet),
                created_at: tweet.created_at!,
            };

            if (!mention.in_reply_to_tweet_id) {
                console.log(`⏭️ Skipping non-reply tweet ${tweet.id}`);
                return;
            }

            const command = this.commandParser.parse(mention.text);
            if (!command) {
                console.log(`⏭️ Skipping invalid command in tweet ${tweet.id}`);
                return;
            }

            const parentTweet = await this.parentResolver.resolve(mention.in_reply_to_tweet_id);
            if (!parentTweet) {
                console.log(`❌ Could not resolve parent tweet for ${tweet.id}`);
                return;
            }

            console.log(`✅ Valid deploy command: ${command.ticker} (${command.name})`);
            console.log(`   Fee recipient: @${parentTweet.author_username}`);

            if (config.MOCK_QUEUE) {
                processDeploymentJob({ mention, command, parentTweet }).catch(err => console.error('Error:', err));
            } else {
                await deploymentQueue.add('deploy', { mention, command, parentTweet });
                console.log(`📤 Queued deployment job for tweet ${tweet.id}`);
            }
        } catch (error) {
            console.error(`❌ Error processing tweet ${tweet.id}:`, error);
        }
    }

    private extractUsername(data: TweetV2SingleStreamResult, authorId: string): string {
        return data.includes?.users?.find((u) => u.id === authorId)?.username || 'unknown';
    }

    private extractParentTweetId(tweet: TweetV2SingleStreamResult['data']): string | null {
        return tweet.referenced_tweets?.find((ref) => ref.type === 'replied_to')?.id || null;
    }

    private handleError(error: any): void {
        console.error('❌ Stream error:', error.message || error);
    }

    private handleDisconnect(): void {
        console.log('🔌 Stream disconnected');
        this.isRunning = false;
    }
}
