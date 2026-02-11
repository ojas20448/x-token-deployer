import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { SiweMessage } from 'siwe';

// Config
const API_URL = 'http://localhost:3000/api/link';
const MOCK_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234'; // Dummy, but valid format
const MOCK_TWITTER_ID = 'test_user_integration';

async function main() {
    console.log('🧪 Starting Wallet Link Integration Test...');

    // 1. Setup Wallet
    const account = privateKeyToAccount(MOCK_PRIVATE_KEY);
    const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    });

    console.log(`👤 Mock Wallet: ${account.address}`);
    console.log(`👤 Mock Twitter: @${MOCK_TWITTER_ID}`);

    try {
        // 2. Request Challenge
        console.log('\nPlease ensure backend is running (npm start) on port 3000.');
        console.log('1️⃣  Requesting SIWE Challenge...');

        const challengeRes = await fetch(`${API_URL}/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                twitterId: MOCK_TWITTER_ID,
                address: account.address
            })
        });

        if (!challengeRes.ok) throw new Error(`Challenge failed: ${challengeRes.status}`);
        const { message: messageStr, nonce } = await challengeRes.json();
        console.log('   ✅ Received Challenge & Nonce');
        console.log(`   Nonce: ${nonce}`);

        // 3. Sign Message
        console.log('\n2️⃣  Signing Message...');
        const signature = await client.signMessage({
            message: messageStr
        });
        console.log('   ✅ Message Signed');
        // console.log(`   Signature: ${signature}`);

        // 4. Verify Signature
        console.log('\n3️⃣  Verifying via API...');
        const verifyRes = await fetch(`${API_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messageStr,
                signature,
                twitterId: MOCK_TWITTER_ID
            })
        });

        if (!verifyRes.ok) throw new Error(`Verify failed: ${verifyRes.status}`);
        const verifyData = await verifyRes.json();

        if (verifyData.success) {
            console.log('   ✅ Verification Successful!');
            console.log(`   Linked: ${verifyData.twitterId} <-> ${verifyData.walletAddress}`);
        } else {
            console.error('   ❌ Verification Failed:', verifyData);
            process.exit(1);
        }

        // 5. Check Status
        console.log('\n4️⃣  Checking Link Status...');
        const statusRes = await fetch(`${API_URL}/status/${MOCK_TWITTER_ID}`);
        if (!statusRes.ok) throw new Error(`Status check failed: ${statusRes.status}`);
        const statusData = await statusRes.json();

        if (statusData.linked && statusData.walletAddress === account.address) {
            console.log('   ✅ Status Confirmed: Linked');
        } else {
            console.error('   ❌ Status Check Failed:', statusData);
            process.exit(1);
        }

        console.log('\n🎉 Integration Test PASSED');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
