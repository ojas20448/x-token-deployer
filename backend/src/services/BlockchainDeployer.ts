import {
    createWalletClient,
    createPublicClient,
    http,
    parseEther,
    keccak256,
    toBytes,
    type Address,
    type Hash,
    type WalletClient,
    type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains'; // Changed to bsc
import { ethers } from 'ethers';
import { config } from '../config/index.js';
import type { DeploymentResult } from '../types/index.js';
import { fourMemeService } from './FourMemeService.js';

/**
 * BlockchainDeployer - Handles on-chain token deployment
 * Uses ethers for Four.Meme interaction (via Service) and viem for general ops
 */
export class BlockchainDeployer {
    private walletClient: any;
    private publicClient: any;
    private account: ReturnType<typeof privateKeyToAccount>;
    private deployFee: bigint;

    constructor() {
        // Set up account from private key
        this.account = privateKeyToAccount(`0x${config.BOT_PRIVATE_KEY}` as `0x${string}`);

        // Set up clients
        // Use BSC chain
        this.publicClient = createPublicClient({
            chain: bsc,
            transport: http(config.RPC_URL),
        });

        this.walletClient = createWalletClient({
            account: this.account,
            chain: bsc,
            transport: http(config.RPC_URL),
        });

        this.deployFee = config.DEPLOY_FEE_WEI;
    }

    /**
     * Deploy a token on Four.Meme
     */
    async deploy(
        params: {
            name: string;
            symbol: string;
            description: string;
            image: string;
            twitter?: string;
            telegram?: string;
            website?: string;
            feeRecipient?: Address;
        },
        signer: ethers.Wallet
    ): Promise<DeploymentResult> {
        if (config.MOCK_CHAIN) {
            console.log(`🎭 Mock Deploying: ${params.symbol} (${params.name})`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
            return {
                success: true,
                tokenAddress: '0xMockTokenAddress12345678901234567890123456',
                poolId: '0xMockPoolId12345678901234567890123456789012',
                txHash: '0xMockTxHash12345678901234567890123456789012',
            };
        }

        try {
            console.log(`🚀 Deploying token on Four.Meme: ${params.symbol} (${params.name})`);
            console.log(`   Signer: ${signer.address}`);

            // 1. Authenticate with Four.Meme
            await fourMemeService.login(signer);

            // 2. Get Payload
            const { createArg, signature } = await fourMemeService.getTokenCreatePayload({
                name: params.name,
                symbol: params.symbol,
                description: params.description,
                image: params.image,
                twitter: params.twitter,
                telegram: params.telegram,
                website: params.website
            });

            // 3. Execute Transaction
            // Factory Address: 0x5c952063c7fc8610FFDB798152D69F0B9550762b
            const factoryAddress = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
            const abi = [
                "function createToken(bytes code, bytes poolsCode) payable returns (address token)"
            ];

            const contract = new ethers.Contract(factoryAddress, abi, signer);

            console.log('📝 Submitting createToken transaction...');
            // 0.01 BNB creation fee
            const tx = await contract.createToken(createArg, signature, {
                value: parseEther('0.01')
            });
            console.log(`✅ Transaction submitted: ${tx.hash}`);

            // 4. Wait for receipt
            const receipt = await tx.wait();

            // 5. Success
            // We return the hash. Token address parsing from logs can be added if needed,
            // but for now success is sufficient.

            return {
                success: true,
                tokenAddress: '0xPENDING_LOG_PARSE',
                poolId: '0x0',
                txHash: tx.hash,
            };

        } catch (error: any) {
            console.error('❌ Deployment failed:', error);
            return {
                success: false,
                error: error.message || 'Unknown error',
            };
        }
    }

    /**
     * Get bot wallet balance
     */
    async getBalance(): Promise<bigint> {
        if (config.MOCK_CHAIN) {
            return parseEther('1.0'); // Mock 1 ETH
        }
        return this.publicClient.getBalance({ address: this.account.address });
    }

    /**
     * Get bot wallet address
     */
    getAddress(): Address {
        return this.account.address;
    }
}

export const blockchainDeployer = new BlockchainDeployer();
