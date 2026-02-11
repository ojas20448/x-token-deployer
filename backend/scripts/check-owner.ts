import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.RPC_URL)
    });

    const tfAddress = process.env.TOKEN_FACTORY_ADDRESS as `0x${string}`;
    if (!tfAddress) throw new Error('Missing TOKEN_FACTORY_ADDRESS');

    const abi = [{
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }];

    const owner = await publicClient.readContract({
        address: tfAddress,
        abi: abi,
        functionName: 'owner',
    });

    console.log(`Current TokenFactory Owner: ${owner}`);
    console.log(`Expected Orchestrator:       ${process.env.ORCHESTRATOR_ADDRESS}`);
    console.log(`Deployer Wallet:            0x829bcd939A5cFF23553Edbb31776566E9f557fba`);
}

main().catch(console.error);
