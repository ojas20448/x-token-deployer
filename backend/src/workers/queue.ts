import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import type { DeploymentJob } from '../types/index.js';

// Redis connection
let connection: Redis | undefined;
let deploymentQueue: Queue<DeploymentJob> | any;
let queueEvents: QueueEvents | any;

if (config.MOCK_QUEUE) {
    console.log('🎭 MOCK QUEUE enabled - Redis disabled');
    connection = undefined;

    // Mock Queue interface
    deploymentQueue = {
        add: async (name: string, data: any) => {
            console.log('🎭 Mock Queue Add:', name);
            return { id: 'mock_job_id' };
        },
        getJobCounts: async () => ({ active: 0, completed: 0, failed: 0 }),
    };

    queueEvents = {
        on: (event: string, cb: Function) => { },
    };

} else {
    connection = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
    });

    // Deployment queue
    deploymentQueue = new Queue<DeploymentJob>('deployments', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: {
                count: 1000,
                age: 24 * 60 * 60, // 24 hours
            },
            removeOnFail: {
                count: 5000,
                age: 7 * 24 * 60 * 60, // 7 days
            },
        },
    });

    // Queue events for monitoring
    queueEvents = new QueueEvents('deployments', { connection });

    queueEvents.on('completed', ({ jobId }: { jobId: string }) => {
        console.log(`✅ Job ${jobId} completed`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string, failedReason: string }) => {
        console.error(`❌ Job ${jobId} failed: ${failedReason}`);
    });
}

export { deploymentQueue, queueEvents, connection as redisConnection };
