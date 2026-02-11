import { walletService } from '../src/services/WalletService.js';
import { ethers } from 'ethers';

async function main() {
    console.log('🧪 Testing WalletService...');

    // 1. Generate
    const { address, privateKey } = walletService.createWallet();
    console.log(`✅ Generated: ${address}`);

    // 2. Encrypt
    const encrypted = walletService.encrypt(privateKey);
    console.log(`🔒 Encrypted: ${encrypted.substring(0, 50)}...`);

    // 3. Decrypt
    const decrypted = walletService.decrypt(encrypted);
    console.log(`🔓 Decrypted matches original: ${decrypted === privateKey}`);

    if (decrypted !== privateKey) {
        throw new Error('Encryption/Decryption mismatch!');
    }

    // 4. Test Sign
    const wallet = new ethers.Wallet(decrypted);
    const message = "Verify me";
    const signature = await wallet.signMessage(message);
    const recovered = ethers.verifyMessage(message, signature);
    console.log(`✍️ Signature valid: ${recovered === address}`);

    console.log('\n✨ WalletService verification PASSED!');
}

main().catch(error => {
    console.error('\n❌ Verification FAILED:');
    console.error(error);
    process.exit(1);
});
