import { TwitterApi } from 'twitter-api-v2';
import type { ParentTweetInfo } from '../types/index.js';
import { config } from '../config/index.js';

/**
 * ParentTweetResolver - Fetches parent tweet to identify fee recipient
 */
export class ParentTweetResolver {
    private client: TwitterApi;

    constructor(client: TwitterApi) {
        this.client = client;
    }

    /**
     * Resolve parent tweet info
     * @param tweetId The ID of the parent tweet
     * @returns Parent tweet info or null if not found
     */
    async resolve(tweetId: string): Promise<ParentTweetInfo | null> {
        if (config.MOCK_X_API) {
            console.log(`🎭 Resolving mock parent tweet ${tweetId}`);
            return {
                tweet_id: tweetId,
                author_id: '987654321', // Mock parent author
                author_username: 'original_author',
            };
        }

        try {
            const tweet = await this.client.v2.singleTweet(tweetId, {
                'tweet.fields': ['author_id'],
                'user.fields': ['username'],
                expansions: ['author_id'],
            });

            if (!tweet.data) {
                console.warn(`⚠️ Parent tweet ${tweetId} not found`);
                return null;
            }

            const authorId = tweet.data.author_id;
            if (!authorId) {
                console.warn(`⚠️ Parent tweet ${tweetId} has no author`);
                return null;
            }

            const user = tweet.includes?.users?.find((u) => u.id === authorId);

            return {
                tweet_id: tweetId,
                author_id: authorId,
                author_username: user?.username || 'unknown',
            };

        } catch (error) {
            console.error(`❌ Error resolving parent tweet ${tweetId}:`, error);
            return null;
        }
    }
}
