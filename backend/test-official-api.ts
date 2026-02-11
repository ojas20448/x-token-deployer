
import { TwitterApi } from 'twitter-api-v2';
import { config } from './src/config';

async function testOfficialApi() {
    console.log('Testing Official X API Credentials...');

    // Initialize client with credentials from .env
    const client = new TwitterApi({
        appKey: config.X_API_KEY!,
        appSecret: config.X_API_SECRET!,
        accessToken: config.X_ACCESS_TOKEN!,
        accessSecret: config.X_ACCESS_SECRET!,
    });

    try {
        // Test 1: Verify Credentials (me())
        console.log('🔐 Verifying credentials...');
        const me = await client.v2.me();
        console.log(`✅ Logged in as: @${me.data.username} (ID: ${me.data.id})`);

        // Test 2: Post a Tweet
        const tweetText = `Test tweet via Official API ${new Date().toISOString()}`;
        console.log(`📤 Attempting to post tweet: "${tweetText}"`);

        const tweet = await client.v2.tweet(tweetText);
        console.log(`✅ Tweet posted! ID: ${tweet.data.id}`);
        console.log(`https://twitter.com/user/status/${tweet.data.id}`);

    } catch (error: any) {
        console.error('❌ API Error:', error);
        if (error.code === 403) {
            console.error('   -> 403 Forbidden usually means Free Tier limitations (no Read access) or write permission issues.');
        }
    }
}

testOfficialApi();
