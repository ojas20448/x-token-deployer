import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { XListener } from './services/XListener.js';
import { walletLinkRouter } from './api/walletLink.js';
import { blockchainDeployer } from './services/BlockchainDeployer.js';
import { deploymentQueue } from './workers/queue.js';
import './workers/deploymentWorker.js'; // Start the worker

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
    try {
        const balance = await blockchainDeployer.getBalance();
        const queueStats = await deploymentQueue.getJobCounts();

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            botWallet: {
                address: blockchainDeployer.getAddress(),
                balance: balance.toString(),
            },
            queue: queueStats,
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// API routes
app.use('/api/link', walletLinkRouter);

// Start the server and X listener
async function main() {
    console.log('🚀 Starting X Deploy Bot...');
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   Chain ID: ${config.CHAIN_ID}`);
    console.log(`   Bot username: @${config.X_BOT_USERNAME}`);

    // Check bot wallet balance
    const balance = await blockchainDeployer.getBalance();
    console.log(`   Bot wallet: ${blockchainDeployer.getAddress()}`);
    console.log(`   Balance: ${Number(balance) / 1e18} ETH`);

    if (balance < BigInt(config.DEPLOY_FEE_WEI) * BigInt(10)) {
        console.warn('⚠️ Warning: Bot wallet balance is low!');
    }

    // Start Express server
    app.listen(config.PORT, () => {
        console.log(`📡 API server running on port ${config.PORT}`);
    });

    // Start X listener
    const xListener = new XListener();
    await xListener.start();
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    process.exit(0);
});

// Start the application
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
