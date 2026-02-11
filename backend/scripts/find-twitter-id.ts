/**
 * Query deployment by tweet ID to find Twitter user ID
 */
import { db } from '../src/db/client.js';

async function findTwitterId() {
    const tweetId = process.argv[2] || '2020768682591625465'; // TEST4 tweet

    console.log(`Looking up deployment for tweet ${tweetId}...`);

    try {
        const deployment = await db.getDeploymentByTweetId(tweetId);

        if (deployment) {
            console.log('Found deployment:');
            console.log(`  Deployer Twitter ID: ${deployment.deployer_twitter_id}`);
            console.log(`  Fee Recipient Twitter ID: ${deployment.fee_recipient_twitter_id}`);
            console.log(`  Status: ${deployment.status}`);
        } else {
            console.log('No deployment found for this tweet');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

findTwitterId();
