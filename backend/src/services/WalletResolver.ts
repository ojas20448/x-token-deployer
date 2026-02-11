import { db } from '../db/client.js';

/**
 * WalletResolver - Maps Twitter IDs to wallet addresses
 */
export class WalletResolver {
    /**
     * Get wallet address for a Twitter ID
     * @param twitterId The Twitter user ID
     * @returns Wallet address or null if not linked
     */
    async resolve(twitterId: string): Promise<string | null> {
        return db.getWalletByTwitterId(twitterId);
    }

    /**
     * Check if a Twitter ID has a linked wallet
     * @param twitterId The Twitter user ID
     */
    async hasWallet(twitterId: string): Promise<boolean> {
        const wallet = await this.resolve(twitterId);
        return wallet !== null;
    }

    /**
     * Link a wallet to a Twitter ID
     * @param twitterId The Twitter user ID
     * @param walletAddress The wallet address (checksummed)
     */
    async link(twitterId: string, walletAddress: string): Promise<void> {
        await db.upsertUser(twitterId, walletAddress);
    }
}

export const walletResolver = new WalletResolver();
