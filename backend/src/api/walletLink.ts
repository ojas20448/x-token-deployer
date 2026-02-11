import express from 'express';
import { SiweMessage, generateNonce } from 'siwe';
import { config } from '../config/index.js';
import { db } from '../db/client.js';

const router = express.Router();

// In-memory nonce storage (use Redis in production)
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

/**
 * POST /api/link/challenge
 * Generate SIWE challenge for wallet linking
 */
router.post('/challenge', async (req, res) => {
    try {
        const { twitterId, address } = req.body;

        if (!twitterId || !address) {
            return res.status(400).json({ error: 'Missing twitterId or address' });
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({ error: 'Invalid address format' });
        }

        const nonce = generateNonce();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store nonce
        nonceStore.set(`${twitterId}:${address}`, { nonce, expiresAt });

        // Create SIWE message
        const message = new SiweMessage({
            domain: 'xdeploybot.com', // Update with actual domain
            address,
            statement: `Link this wallet to Twitter account ${twitterId} for X Deploy Bot`,
            uri: `https://xdeploybot.com/api/link`,
            version: '1',
            chainId: config.CHAIN_ID,
            nonce,
            expirationTime: new Date(expiresAt).toISOString(),
        });

        return res.json({
            message: message.prepareMessage(),
            nonce,
        });

    } catch (error) {
        console.error('Challenge generation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/link/verify
 * Verify SIWE signature and link wallet
 */
router.post('/verify', async (req, res) => {
    try {
        const { message, signature, twitterId } = req.body;

        if (!message || !signature || !twitterId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Parse and verify the message
        const siweMessage = new SiweMessage(message);

        // Verify signature
        const { success, data, error } = await siweMessage.verify({ signature });

        if (!success || error) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const address = data.address;
        const storedNonce = nonceStore.get(`${twitterId}:${address}`);

        // Verify nonce
        if (!storedNonce || storedNonce.nonce !== data.nonce) {
            return res.status(401).json({ error: 'Invalid or expired nonce' });
        }

        // Check expiration
        if (Date.now() > storedNonce.expiresAt) {
            nonceStore.delete(`${twitterId}:${address}`);
            return res.status(401).json({ error: 'Challenge expired' });
        }

        // Link wallet to Twitter ID
        const user = await db.upsertUser(twitterId, address);

        // Clean up nonce
        nonceStore.delete(`${twitterId}:${address}`);

        console.log(`✅ Wallet linked: ${twitterId} -> ${address}`);

        return res.json({
            success: true,
            twitterId: user.twitter_id,
            walletAddress: user.wallet_address,
        });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/link/status/:twitterId
 * Check if a Twitter ID has a linked wallet
 */
router.get('/status/:twitterId', async (req, res) => {
    try {
        const { twitterId } = req.params;
        const user = await db.getUserByTwitterId(twitterId);

        if (!user) {
            return res.json({ linked: false });
        }

        return res.json({
            linked: true,
            walletAddress: user.wallet_address,
            verifiedAt: user.verified_at,
        });

    } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export { router as walletLinkRouter };
