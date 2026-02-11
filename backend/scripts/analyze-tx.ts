import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

async function main() {
    console.log('Fetching TX...');
    const client = createPublicClient({
        chain: bsc,
        transport: http('https://bsc-dataseed.binance.org/')
    });

    const txHash = '0xab0017875fa5b356f0a6ce67c6cf139b4b6dae61404f73010925c0f2b7243a4c';
    try {
        const [tx, receipt] = await Promise.all([
            client.getTransaction({ hash: txHash as `0x${string}` }),
            client.getTransactionReceipt({ hash: txHash as `0x${string}` })
        ]);

        console.log('To:', tx.to);
        console.log('Value:', tx.value.toString());
        console.log('Input:', tx.input);
        console.log('\nLogs:');
        receipt.logs.forEach((log, i) => {
            console.log(`Log ${i} Topic 0:`, log.topics[0]);
            console.log(`Log ${i} Data:`, log.data);
        });
    } catch (e) {
        console.error('Error fetching tx:', e);
    }
}

main().catch(console.error);
