import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
    // Bot Wallet
    BOT_PRIVATE_KEY: z.string().min(64, 'Private key must be 64 hex characters'),

    // X (Twitter) API
    X_API_KEY: z.string().optional(),
    X_API_SECRET: z.string().optional(),
    X_BEARER_TOKEN: z.string().optional(),
    X_ACCESS_TOKEN: z.string().optional(),
    X_ACCESS_SECRET: z.string().optional(),
    X_BOT_USERNAME: z.string().min(1).default('mybot'),

    // Dev flags
    MOCK_X_API: z.string().transform(val => val === 'true').default('false'),
    MOCK_QUEUE: z.string().transform(val => val === 'true').default('false'),
    MOCK_DB: z.string().transform(val => val === 'true').default('false'),
    MOCK_CHAIN: z.string().transform(val => val === 'true').default('false'),

    // Third-party Twitter API
    TWITTERAPI_IO_KEY: z.string().optional(),

    // TwitterAPI.io Login Credentials (for posting)
    TWITTER_LOGIN_USERNAME: z.string().optional(),
    TWITTER_LOGIN_EMAIL: z.string().optional(),
    TWITTER_LOGIN_PASSWORD: z.string().optional(),
    TWITTER_2FA_SECRET: z.string().optional(),
    TWITTER_PROXY: z.string().optional(),
    TWITTER_USER_ID: z.string().optional(), // Bot's Twitter ID for DM logic

    // Security
    ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be 64 hex characters (32 bytes)'),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_URL: z.string().url(),

    // Blockchain
    RPC_URL: z.string().url(),
    CHAIN_ID: z.coerce.number().default(56), // BSC Mainnet

    // Contract Addresses (populated after deployment)
    TOKEN_FACTORY_ADDRESS: z.string().optional(),
    FEE_HOOK_ADDRESS: z.string().optional(),
    ORCHESTRATOR_ADDRESS: z.string().optional(),
    FOUR_MEME_FACTORY: z.string().default('0x5c952063c7fc8610FFDB798152D69F0B9550762b'),
    WETH_ADDRESS: z.string().default('0x4200000000000000000000000000000000000006'), // Base WETH (Change to WBNB for BSC later)
    POOL_MANAGER_ADDRESS: z.string().default('0x498581ff718922c3f8e6a244956af099b2652b2b'), // Base v4 PoolManager

    // Configuration
    DEPLOY_FEE_WEI: z.coerce.bigint().default(BigInt('500000000000000')), // 0.0005 ETH (~$1)

    // Server
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.format());
    process.exit(1);
}

export const config = parsed.data;

// Contract ABIs (minimal for our use case)
export const ORCHESTRATOR_ABI = [
    {
        inputs: [
            { name: 'name', type: 'string' },
            { name: 'symbol', type: 'string' },
            { name: 'feeRecipient', type: 'address' },
            { name: 'twitterIdHash', type: 'bytes32' },
        ],
        name: 'deploy',
        outputs: [
            { name: 'token', type: 'address' },
            { name: 'poolId', type: 'bytes32' },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'deployFee',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

export const TOKEN_FACTORY_ABI = [
    {
        inputs: [
            { name: '_name', type: 'string' },
            { name: '_symbol', type: 'string' },
            { name: '_totalSupply', type: 'uint256' },
            { name: '_recipient', type: 'address' },
        ],
        name: 'deployToken',
        outputs: [{ name: 'token', type: 'address' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;
