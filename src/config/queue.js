const { Queue } = require('bullmq');
const logger = require('../utils/logger');

// Redis connection options for BullMQ
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
};

// Create the vote queue
const voteQueue = new Queue('vote-queue', {
    connection,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

voteQueue.on('error', (err) => {
    logger.error('Vote Queue Error', { error: err.message });
});

module.exports = { voteQueue, connection };
