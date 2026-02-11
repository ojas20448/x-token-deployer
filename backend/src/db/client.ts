import { Pool, PoolClient } from 'pg';
import { config } from '../config/index.js';
import type { User, Deployment, DeploymentStatus } from '../types/index.js';

class Database {
    private pool: Pool;
    private mockUsers: Map<string, User> = new Map();
    private mockDeployments: Map<string, Deployment> = new Map();
    private mockRateLimits: Map<string, Date> = new Map();

    constructor() {
        if (config.MOCK_DB) {
            console.log('🎭 MOCK DB enabled - Postgres disabled');
            this.seedMockData();
            this.pool = {} as Pool; // Mock pool to satisfy type
        } else {
            this.pool = new Pool({
                connectionString: config.DATABASE_URL,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
        }
    }

    private seedMockData() {
        // Seed original author with wallet
        this.mockUsers.set('987654321', {
            twitter_id: '987654321',
            wallet_address: '0x829bcd939A5cFF23553Edbb31776566E9f557fba',
            private_key_encrypted: null,
            verified_at: new Date(),
        });
    }

    async getClient(): Promise<PoolClient> {
        if (config.MOCK_DB) return {} as any;
        return this.pool.connect();
    }

    // ============ User Operations ============

    async getUserByTwitterId(twitterId: string): Promise<User | null> {
        if (config.MOCK_DB) {
            return this.mockUsers.get(twitterId) || null;
        }
        const result = await this.pool.query<User>(
            'SELECT twitter_id, wallet_address, private_key_encrypted, verified_at FROM users WHERE twitter_id = $1',
            [twitterId]
        );
        return result.rows[0] || null;
    }

    async getWalletByTwitterId(twitterId: string): Promise<string | null> {
        if (config.MOCK_DB) {
            return this.mockUsers.get(twitterId)?.wallet_address || null;
        }
        const result = await this.pool.query<{ wallet_address: string }>(
            'SELECT wallet_address FROM users WHERE twitter_id = $1',
            [twitterId]
        );
        return result.rows[0]?.wallet_address || null;
    }

    async upsertUser(twitterId: string, walletAddress: string, encryptedKey: string | null = null): Promise<User> {
        if (config.MOCK_DB) {
            const user: User = {
                twitter_id: twitterId,
                wallet_address: walletAddress.toLowerCase(),
                private_key_encrypted: encryptedKey,
                verified_at: new Date(),
            };
            this.mockUsers.set(twitterId, user);
            return user;
        }
        const result = await this.pool.query<User>(
            `INSERT INTO users (twitter_id, wallet_address, private_key_encrypted, verified_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (twitter_id) 
       DO UPDATE SET wallet_address = $2, private_key_encrypted = $3, verified_at = NOW()
       RETURNING twitter_id, wallet_address, private_key_encrypted, verified_at`,
            [twitterId, walletAddress.toLowerCase(), encryptedKey]
        );
        return result.rows[0];
    }

    // ============ Deployment Operations ============

    async createDeployment(params: {
        deployTweetId: string;
        parentTweetId: string;
        deployerTwitterId: string;
        feeRecipientTwitterId: string;
        feeRecipientWallet: string;
        tokenName: string;
        tokenSymbol: string;
    }): Promise<Deployment> {
        if (config.MOCK_DB) {
            const deployment: Deployment = {
                id: this.mockDeployments.size + 1,
                deploy_tweet_id: params.deployTweetId,
                parent_tweet_id: params.parentTweetId,
                deployer_twitter_id: params.deployerTwitterId,
                fee_recipient_twitter_id: params.feeRecipientTwitterId,
                fee_recipient_wallet: params.feeRecipientWallet,
                token_address: null, // Mapped to snake_case as per DB
                pool_id: null,
                tx_hash: null,
                status: 'pending',
                created_at: new Date(),
            } as any; // Type mismatch between DB snake_case and interface camelCase if interface is mixed. 
            // Wait, types/index.ts has camelCase properties or snake_case?
            // Checking types again... types/index.ts usually matches DB columns if using pg directly?
            // Let's assume types match DB column names based on previous file View.

            // Re-checking types/index.ts from earlier log:
            /*
            export interface Deployment {
                id: number;
                deploy_tweet_id: string;
                parent_tweet_id: string;
                deployer_twitter_id: string;
                fee_recipient_twitter_id: string;
                fee_recipient_wallet: string;
                token_address: string | null;
                pool_id: string | null;
                tx_hash: string | null;
                status: DeploymentStatus;
                created_at: Date;
            }
            */
            // Yes, snake_case.

            this.mockDeployments.set(params.deployTweetId, deployment);
            return deployment;
        }

        const result = await this.pool.query<Deployment>(
            `INSERT INTO deployments (
        deploy_tweet_id, parent_tweet_id, deployer_twitter_id,
        fee_recipient_twitter_id, fee_recipient_wallet,
        token_name, token_symbol, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *`,
            [
                params.deployTweetId,
                params.parentTweetId,
                params.deployerTwitterId,
                params.feeRecipientTwitterId,
                params.feeRecipientWallet,
                params.tokenName,
                params.tokenSymbol,
            ]
        );
        return result.rows[0];
    }

    async updateDeploymentStatus(
        deployTweetId: string,
        status: DeploymentStatus,
        data?: {
            tokenAddress?: string;
            poolId?: string;
            txHash?: string;
            errorMessage?: string;
        }
    ): Promise<void> {
        if (config.MOCK_DB) {
            const deployment = this.mockDeployments.get(deployTweetId);
            if (deployment) {
                deployment.status = status;
                if (data?.tokenAddress) deployment.token_address = data.tokenAddress;
                if (data?.poolId) deployment.pool_id = data.poolId;
                if (data?.txHash) deployment.tx_hash = data.txHash;
                // error_message not in interface? I should check interface. Assuming okay for mock.
            }
            return;
        }

        const updates: string[] = ['status = $2'];
        const values: (string | null)[] = [deployTweetId, status];
        let paramIndex = 3;

        if (data?.tokenAddress) {
            updates.push(`token_address = $${paramIndex++}`);
            values.push(data.tokenAddress);
        }
        if (data?.poolId) {
            updates.push(`pool_id = $${paramIndex++}`);
            values.push(data.poolId);
        }
        if (data?.txHash) {
            updates.push(`tx_hash = $${paramIndex++}`);
            values.push(data.txHash);
        }
        if (data?.errorMessage) {
            updates.push(`error_message = $${paramIndex++}`);
            values.push(data.errorMessage);
        }
        if (status === 'deployed') {
            updates.push(`deployed_at = NOW()`);
        }

        await this.pool.query(
            `UPDATE deployments SET ${updates.join(', ')} WHERE deploy_tweet_id = $1`,
            values
        );
    }

    async getDeploymentByTweetId(deployTweetId: string): Promise<Deployment | null> {
        if (config.MOCK_DB) {
            return this.mockDeployments.get(deployTweetId) || null;
        }
        const result = await this.pool.query<Deployment>(
            'SELECT * FROM deployments WHERE deploy_tweet_id = $1',
            [deployTweetId]
        );
        return result.rows[0] || null;
    }

    async deploymentExists(deployTweetId: string): Promise<boolean> {
        if (config.MOCK_DB) {
            return this.mockDeployments.has(deployTweetId);
        }
        const result = await this.pool.query<{ exists: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM deployments WHERE deploy_tweet_id = $1) as exists',
            [deployTweetId]
        );
        return result.rows[0].exists;
    }

    // ============ Rate Limiting ============

    async checkRateLimit(twitterId: string, cooldownMs: number): Promise<boolean> {
        if (config.MOCK_DB) {
            const lastDeploy = this.mockRateLimits.get(twitterId);
            if (!lastDeploy) return true;
            return Date.now() - lastDeploy.getTime() >= cooldownMs;
        }
        const result = await this.pool.query<{ last_deploy_at: Date }>(
            'SELECT last_deploy_at FROM rate_limits WHERE twitter_id = $1',
            [twitterId]
        );

        if (!result.rows[0]) return true; // No previous deploy

        const lastDeploy = result.rows[0].last_deploy_at.getTime();
        return Date.now() - lastDeploy >= cooldownMs;
    }

    async recordDeployAttempt(twitterId: string): Promise<void> {
        if (config.MOCK_DB) {
            this.mockRateLimits.set(twitterId, new Date());
            return;
        }
        await this.pool.query(
            `INSERT INTO rate_limits (twitter_id, last_deploy_at, deploy_count_24h)
       VALUES ($1, NOW(), 1)
       ON CONFLICT (twitter_id)
       DO UPDATE SET last_deploy_at = NOW(), deploy_count_24h = rate_limits.deploy_count_24h + 1`,
            [twitterId]
        );
    }

    async close(): Promise<void> {
        if (config.MOCK_DB) return;
        await this.pool.end();
    }
}

export const db = new Database();
