import { ethers } from 'ethers';
import { fourMemeService } from '../src/services/FourMemeService.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    const dummyPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const wallet = new ethers.Wallet(dummyPrivateKey);

    console.log('--- Testing Four.Meme Login ---');
    try {
        const token = await fourMemeService.login(wallet);
        console.log('✅ Access Token obtained:', token.substring(0, 10) + '...');

        // Note: Creation test would require real metadata and might actually cost if we hit the wrong endpoint
        // but we'll stop here for initial verification.
    } catch (error: any) {
        console.error('❌ Login failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

test().catch(console.error);
