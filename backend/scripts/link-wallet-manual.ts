/**
 * Manual wallet linking script for testing
 * Usage: npx tsx scripts/link-wallet-manual.ts <twitter_id> <wallet_address>
 */
import { db } from '../src/db/client.js';

async function linkWallet() {
    // Get Twitter ID from the bot logs or user input
    // From logs: "From: @OjasNarang" - we need the Twitter ID (numeric)
    // The deploymentWorker uses author_id which is the numeric ID

    // For now, let's hardcode the known Twitter ID for @OjasNarang
    // We'll need to get this from the tweet data or API
    const twitterId = process.argv[2];
    const walletAddress = process.argv[3];

    if (!twitterId || !walletAddress) {
        console.log('Usage: npx tsx scripts/link-wallet-manual.ts <twitter_id> <wallet_address>');
        console.log('Example: npx tsx scripts/link-wallet-manual.ts 123456789 0x1234...');
        process.exit(1);
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        console.error('Invalid wallet address format');
        process.exit(1);
    }

    try {
        await db.upsertUser(twitterId, walletAddress);
        console.log(`✅ Wallet linked: ${twitterId} -> ${walletAddress}`);

        // Verify
        const user = await db.getUserByTwitterId(twitterId);
        console.log('Verification:', user);
    } catch (error) {
        console.error('Error linking wallet:', error);
    }
}

linkWallet();
