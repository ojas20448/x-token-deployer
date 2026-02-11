import { TwitterApi } from 'twitter-api-v2';
import { config } from './src/config/index.js';

async function testReply() {
    console.log('🧪 Testing Twitter reply with new credentials...');

    const client = new TwitterApi({
        appKey: config.X_API_KEY!,
        appSecret: config.X_API_SECRET!,
        accessToken: config.X_ACCESS_TOKEN!,
        accessSecret: config.X_ACCESS_SECRET!,
    });

    // The tweet ID from the screenshot (NEWTEST tweet)
    const tweetId = '2019508519691592101'; // Approximate ID for the new tweet

    try {
        // First, let's just try to post a simple tweet to test write access
        const result = await client.v2.tweet({
            text: '🧪 Test reply - credentials working! (This is a test, will delete)',
        });

        console.log('✅ Successfully posted tweet!');
        console.log('   Tweet ID:', result.data.id);
        console.log('   Text:', result.data.text);

        // Delete the test tweet
        await client.v2.deleteTweet(result.data.id);
        console.log('🗑️ Test tweet deleted');

    } catch (error: any) {
        console.error('❌ Failed to post:', error.message);
        if (error.data) {
            console.error('   Error details:', JSON.stringify(error.data, null, 2));
        }
    }
}

testReply();
