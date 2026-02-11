
import { replyPublisher } from './src/services/ReplyPublisher';
import { config } from './src/config';

async function testReplyPublisher() {
    console.log('🧪 Testing ReplyPublisher...');

    if (!config.TWITTERAPI_IO_KEY) {
        console.error('❌ TWITTERAPI_IO_KEY is missing in .env');
        return;
    }

    console.log('📝 Posting a test Success Reply...');

    // Use a recent tweet ID if possible, or a random one (might fail if tweet not found)
    // For this test, we accept if it fails with "Tweet not found" or "422", as long as it TRIES.
    const mockTweetId = '1888327986060599525'; // Replace with a real tweet ID from the bot's mentions if available

    const result = await replyPublisher.postSuccess({
        replyToTweetId: mockTweetId,
        tokenTicker: 'TEST',
        tokenName: 'Test Token',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        poolId: '0xabc123...',
        feeRecipientUsername: 'test_user',
    });

    console.log('Result:', result);
}

testReplyPublisher().catch(console.error);
