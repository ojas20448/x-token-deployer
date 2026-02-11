import { TwitterApiIoClient } from './src/services/TwitterApiIoClient.js';

async function testLogin() {
    console.log('🧪 Testing twitterapi.io login...');

    const client = new TwitterApiIoClient();

    const success = await client.login();

    if (success) {
        console.log('✅ Login successful!');

        // Wait 6 seconds to respect free tier rate limit (1 req/5s)
        console.log('⏳ Waiting 6s for rate limit...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Try to post a test tweet
        const randomId = Math.random().toString(36).substring(7);
        console.log('\n📤 Attempting to post a test tweet...');
        const result = await client.postTweet(`Test tweet via API integration ${new Date().toISOString()} [${randomId}]`);

        if (result.success) {
            console.log('🎉 Tweet posted successfully!');
            console.log('   Tweet ID:', result.tweetId);
        } else {
            console.log('❌ Tweet posting failed:', result.error);
        }
    } else {
        console.log('❌ Login failed');
    }
}

testLogin();
