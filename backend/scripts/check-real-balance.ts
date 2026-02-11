import { createPublicClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
    console.log('🔍 Checking Real Wallet Balance (Base Sepolia)...');

    if (!process.env.BOT_PRIVATE_KEY) {
        console.error('❌ Missing BOT_PRIVATE_KEY in .env');
        process.exit(1);
    }

    const account = privateKeyToAccount(`0x${process.env.BOT_PRIVATE_KEY}` as `0x${string}`);
    console.log(`👤 Wallet Address: ${account.address}`);

    const rpcs = [
        process.env.RPC_URL,
        'https://sepolia.base.org',
        'https://base-sepolia-rpc.publicnode.com',
        'https://base-sepolia.blockpi.network/v1/rpc/public'
    ].filter(Boolean) as string[];

    console.log(`\n🔍 Checking Address: ${account.address}`);
    console.log(`👉 PLEASE VERIFY: Does this address match the one in your screenshot?\n`);

    for (const rpc of rpcs) {
        try {
            console.log(`Testing RPC: ${rpc}`);
            const client = createPublicClient({
                chain: baseSepolia,
                transport: http(rpc)
            });
            const balance = await client.getBalance({ address: account.address });
            console.log(`✅ Balance: ${formatEther(balance)} ETH`);

            if (balance > 0n) {
                console.log('🎉 FOUND FUNDS!');
                process.exit(0);
            }
        } catch (e) {
            console.log(`❌ RPC Failed: ${e instanceof Error ? e.message.split('\n')[0] : 'Unknown error'}`);
        }
    }

    console.log('\n⚠️  Balance is 0 on all tested RPCs.');
    console.log('Likely cause: The PRIVATE_KEY in .env belongs to a different wallet than the one in your screenshot.');
}

main();
