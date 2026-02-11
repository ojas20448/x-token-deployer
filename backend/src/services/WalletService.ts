import { ethers } from 'ethers';
import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * WalletService - Handles generation and secure storage of custodial wallets
 */
export class WalletService {
    private encryptionKey: Buffer;

    constructor() {
        if (!config.ENCRYPTION_KEY) {
            throw new Error('ENCRYPTION_KEY not set in environment');
        }
        // Key should be 32 bytes for AES-256
        this.encryptionKey = Buffer.from(config.ENCRYPTION_KEY, 'hex');
        if (this.encryptionKey.length !== 32) {
            throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
        }
    }

    /**
     * Create a new random wallet
     * @returns The wallet address and raw private key
     */
    createWallet(): { address: string; privateKey: string } {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
        };
    }

    /**
     * Encrypt a sensitive string (like a private key)
     */
    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    }

    /**
     * Decrypt a sensitive string
     */
    decrypt(encryptedData: string): string {
        try {
            const [ivHex, encryptedText] = encryptedData.split(':');
            if (!ivHex || !encryptedText) {
                throw new Error('Invalid encrypted data format');
            }
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('❌ Decryption failed:', error);
            throw new Error('Failed to decrypt data. Check ENCRYPTION_KEY.');
        }
    }

    /**
     * Get a wallet instance from an encrypted private key
     */
    getWallet(encryptedPrivateKey: string, provider?: ethers.Provider): ethers.Wallet {
        const privateKey = this.decrypt(encryptedPrivateKey);
        return new ethers.Wallet(privateKey, provider);
    }
}

export const walletService = new WalletService();
