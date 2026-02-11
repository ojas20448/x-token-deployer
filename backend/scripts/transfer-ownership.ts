import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const loadArtifact = (name: string, fileName?: string) => {
    const filePath = path.join(process.cwd(), '../contracts/out', fileName || `${name}.sol`, `${name}.json`);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return content.abi;
};

async function main() {
    console.log('🔧 Transferring TokenFactory ownership...');

    const account = privateKeyToAccount(`0x${process.env.BOT_PRIVATE_KEY}` as `0x${string}`);
    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(process.env.RPC_URL)
    });
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.RPC_URL)
    });

    const tfAddress = process.env.TOKEN_FACTORY_ADDRESS as `0x${string}`;
    const orchAddress = process.env.ORCHESTRATOR_ADDRESS as `0x${string}`;

    if (!tfAddress || !orchAddress) throw new Error('Missing addresses in .env');

    // ABI snippet for transferOwnership (Ownable)
    const abi = [{
        "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }];

    const hash = await walletClient.writeContract({
        address: tfAddress,
        abi: abi,
        functionName: 'transferOwnership',
        args: [orchAddress]
    });

    console.log(`📝 Transfer tx hash: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Ownership transferred to Orchestrator');
}

main().catch(console.error);
