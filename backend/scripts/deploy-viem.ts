import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Constants for Base Sepolia
const POOL_MANAGER = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408';
const WETH = '0x4200000000000000000000000000000000000006';
const DEPLOY_FEE = parseEther('0.0005');

// Helper to load artifacts
const loadArtifact = (name: string, fileName?: string) => {
    const filePath = path.join(
        process.cwd(),
        '../contracts/out',
        fileName || `${name}.sol`,
        `${name}.json`
    );
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
        abi: content.abi,
        bytecode: content.bytecode.object as `0x${string}`
    };
};

async function main() {
    console.log('🚀 Starting Viem Deployment to Base Sepolia...');

    if (!process.env.BOT_PRIVATE_KEY) {
        throw new Error('Missing BOT_PRIVATE_KEY');
    }

    const account = privateKeyToAccount(`0x${process.env.BOT_PRIVATE_KEY}` as `0x${string}`);
    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(process.env.RPC_URL || 'https://sepolia.base.org')
    });

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.RPC_URL || 'https://sepolia.base.org')
    });

    console.log(`👤 Deployer: ${account.address}`);
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`💰 Balance: ${formatEther(balance)} ETH`);

    try {
        // 1. Deploy TokenFactory
        console.log('\n📄 Deploying TokenFactory...');
        const tfArtifact = loadArtifact('TokenFactory');
        const tfHash = await walletClient.deployContract({
            abi: tfArtifact.abi,
            bytecode: tfArtifact.bytecode,
            args: [] // No args
        });
        console.log(`   Tx Hash: ${tfHash}`);
        const tfReceipt = await publicClient.waitForTransactionReceipt({ hash: tfHash });
        if (!tfReceipt.contractAddress) throw new Error('TokenFactory deployment failed');
        console.log(`   ✅ TokenFactory: ${tfReceipt.contractAddress}`);

        // 2. Deploy FeeForwarderHook
        console.log('\n📄 Deploying FeeForwarderHook...');
        const hookArtifact = loadArtifact('FeeForwarderHook');
        const hookHash = await walletClient.deployContract({
            abi: hookArtifact.abi,
            bytecode: hookArtifact.bytecode,
            args: [POOL_MANAGER]
        });
        console.log(`   Tx Hash: ${hookHash}`);
        const hookReceipt = await publicClient.waitForTransactionReceipt({ hash: hookHash });
        if (!hookReceipt.contractAddress) throw new Error('FeeHook deployment failed');
        console.log(`   ✅ FeeForwarderHook: ${hookReceipt.contractAddress}`);

        // 3. Deploy DeploymentOrchestrator
        console.log('\n📄 Deploying DeploymentOrchestrator...');
        const orchArtifact = loadArtifact('DeploymentOrchestrator');
        const orchHash = await walletClient.deployContract({
            abi: orchArtifact.abi,
            bytecode: orchArtifact.bytecode,
            args: [
                POOL_MANAGER,
                tfReceipt.contractAddress,
                hookReceipt.contractAddress,
                WETH,
                DEPLOY_FEE
            ]
        });
        console.log(`   Tx Hash: ${orchHash}`);
        const orchReceipt = await publicClient.waitForTransactionReceipt({ hash: orchHash });
        if (!orchReceipt.contractAddress) throw new Error('Orchestrator deployment failed');
        console.log(`   ✅ DeploymentOrchestrator: ${orchReceipt.contractAddress}`);

        // Summary
        console.log('\n==========================================');
        console.log('🎉 DEPLOYMENT COMPLETE');
        console.log('==========================================');
        console.log(`TOKEN_FACTORY_ADDRESS=${tfReceipt.contractAddress}`);
        console.log(`FEE_HOOK_ADDRESS=${hookReceipt.contractAddress}`);
        console.log(`ORCHESTRATOR_ADDRESS=${orchReceipt.contractAddress}`);
        console.log('==========================================');
        console.log('👉 Please update your backend/.env file with these values.');

    } catch (error) {
        console.error('❌ Deployment Failed:', error);
        process.exit(1);
    }
}

main();
