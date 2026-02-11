import axios from 'axios';
import { ethers } from 'ethers';
import { config } from '../config/index.js';

export interface FourMemeCreateResponse {
    createArg: string;
    signature: string;
}

export class FourMemeService {
    private baseURL = 'https://bscfourapi.emit.tools';
    private accessToken: string | null = null;

    constructor() { }

    /**
     * Login to Four.Meme using the bot wallet or user wallet (custodial)
     */
    async login(wallet: ethers.Wallet): Promise<string> {
        console.log(`🔐 Logging into Four.Meme with address: ${wallet.address}`);

        // 1. Get Nonce
        // SDK: POST /v1/private/user/nonce/generate
        const nonceRes = await axios.post(`${this.baseURL}/v1/private/user/nonce/generate`, {
            accountAddress: wallet.address,
            verifyType: 'LOGIN',
            networkCode: 'BSC'
        });

        if (nonceRes.data.code !== 0 && nonceRes.data.code !== '0') {
            throw new Error(`Failed to get nonce: ${JSON.stringify(nonceRes.data)}`);
        }
        const nonce = nonceRes.data.data;

        // 2. Sign Message
        // SDK: "You are sign in Meme ${nonce}"
        const message = `You are sign in Meme ${nonce}`;
        const signature = await wallet.signMessage(message);

        // 3. Login
        // SDK: POST /v1/private/user/login/dex
        const loginRes = await axios.post(`${this.baseURL}/v1/private/user/login/dex`, {
            region: 'WEB',
            langType: 'EN',
            walletName: 'MetaMask',
            verifyInfo: {
                address: wallet.address,
                networkCode: 'BSC',
                signature: signature,
                verifyType: 'LOGIN'
            }
        });

        if (loginRes.data.code !== 0 && loginRes.data.code !== '0') {
            throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
        }

        this.accessToken = loginRes.data.data;
        if (!this.accessToken) throw new Error('Failed to get accessToken from Four.Meme');

        return this.accessToken;
    }

    /**
     * Get the signed createArg and signature for on-chain deployment
     */
    async getTokenCreatePayload(params: {
        name: string;
        symbol: string;
        description: string;
        image: string; // URL
        twitter?: string;
        telegram?: string;
        website?: string;
    }): Promise<FourMemeCreateResponse> {
        if (!this.accessToken) {
            throw new Error('Not authenticated with Four.Meme. Call login() first.');
        }

        console.log(`📦 Requesting token creation payload for: ${params.symbol}`);

        const payload = {
            name: params.name,
            shortName: params.symbol,
            desc: params.description,
            imgUrl: params.image,
            launchTime: 0,
            label: 'Meme',
            webUrl: params.website || '',
            twitterUrl: params.twitter || '',
            telegramUrl: params.telegram || '',

            // Default constants matching type definition
            preSale: '0',
            onlyMPC: false,
            lpTradingFee: 0.0025,
            symbol: 'BNB',
            totalSupply: 1000000000,
            raisedAmount: 24,
            saleRate: 0.8,
            reserveRate: 0,
            funGroup: false,
            clickFun: false
        };

        const response = await axios.post(
            `${this.baseURL}/v1/private/token/create`,
            payload,
            {
                headers: {
                    'meme-web-access': this.accessToken,
                    'Content-Type': 'application/json'
                },
            }
        );

        if (response.data.code !== 0 && response.data.code !== '0') {
            throw new Error(`Create token failed: ${JSON.stringify(response.data)}`);
        }

        return {
            createArg: response.data.data.createArg,
            signature: response.data.data.signature,
        };
    }
}

export const fourMemeService = new FourMemeService();
