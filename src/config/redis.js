/**
 * Redis Configuration
 * Used for caching, sessions, rate limiting, and vote tokens
 */
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Create and initialize Redis connection
 */
function createRedisClient() {
    if (redisClient) return redisClient;

    const config = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        retryStrategy: (times) => {
            const delay = Math.min(times * 100, 3000);
            logger.warn(`Redis reconnecting... attempt ${times}`, { delay });
            return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
    };

    if (process.env.REDIS_PASSWORD) {
        config.password = process.env.REDIS_PASSWORD;
    }

    if (process.env.REDIS_TLS === 'true') {
        config.tls = {};
    }

    redisClient = new Redis(config);

    redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
    });

    redisClient.on('close', () => {
        logger.warn('Redis connection closed');
    });

    return redisClient;
}

/**
 * Get the Redis client instance
 */
function getRedisClient() {
    if (!redisClient) {
        return createRedisClient();
    }
    return redisClient;
}

/**
 * Test Redis connection
 */
async function testRedisConnection() {
    try {
        const client = getRedisClient();
        // Add a timeout so server doesn't hang if Redis is unavailable
        const connectPromise = client.connect();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis connection timeout (3s)')), 3000)
        );
        await Promise.race([connectPromise, timeoutPromise]);
        const pong = await client.ping();
        logger.info('Redis ping successful', { response: pong });
        return true;
    } catch (error) {
        logger.warn('Redis connection failed - running without cache', {
            error: error.message,
        });
        // Disconnect to stop retry attempts
        if (redisClient) {
            try { redisClient.disconnect(); } catch (e) { /* ignore */ }
            redisClient = null;
        }
        return false;
    }
}

/**
 * Cache helpers
 */
const cache = {
    /**
     * Get cached value
     * @param {string} key
     * @returns {Promise<object|null>}
     */
    async get(key) {
        try {
            const client = getRedisClient();
            const data = await client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.debug('Cache get error', { key, error: error.message });
            return null;
        }
    },

    /**
     * Set cached value with TTL
     * @param {string} key
     * @param {object} value
     * @param {number} ttlSeconds
     */
    async set(key, value, ttlSeconds = 300) {
        try {
            const client = getRedisClient();
            await client.setex(key, ttlSeconds, JSON.stringify(value));
        } catch (error) {
            logger.debug('Cache set error', { key, error: error.message });
        }
    },

    /**
     * Delete cached value
     * @param {string} key
     */
    async del(key) {
        try {
            const client = getRedisClient();
            await client.del(key);
        } catch (error) {
            logger.debug('Cache del error', { key, error: error.message });
        }
    },

    /**
     * Check if key exists
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async exists(key) {
        try {
            const client = getRedisClient();
            const result = await client.exists(key);
            return result === 1;
        } catch (error) {
            return false;
        }
    },

    /**
     * Increment a counter
     * @param {string} key
     * @param {number} ttlSeconds - TTL on first increment
     * @returns {Promise<number>}
     */
    async incr(key, ttlSeconds = 60) {
        try {
            const client = getRedisClient();
            const count = await client.incr(key);
            if (count === 1 && ttlSeconds) {
                await client.expire(key, ttlSeconds);
            }
            return count;
        } catch (error) {
            logger.debug('Cache incr error', { key, error: error.message });
            return 0;
        }
    },
};

module.exports = {
    createRedisClient,
    getRedisClient,
    testRedisConnection,
    cache,
};
