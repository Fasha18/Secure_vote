/**
 * Rate Limiting Middleware
 * Protects against brute-force and DDoS attacks
 */
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create a rate limiter with custom configuration
 * @param {object} options
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
    const {
        windowMs = 15 * 60 * 1000,
        max = 1000,
        message = 'Trop de requêtes, veuillez réessayer plus tard',
        skipSuccessfulRequests = false,
        keyGenerator = null,
    } = options;

    const config = {
        windowMs,
        max,
        message: { success: false, message },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.originalUrl,
                userId: req.user?.id,
            });
            res.status(429).json({ success: false, message });
        },
    };

    if (keyGenerator) {
        config.keyGenerator = keyGenerator;
    }

    return rateLimit(config);
}

// Global rate limiter (1000 requests per 15 min)
const globalLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
});

// Login rate limiter (10 attempts per 15 min)
const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: 'Trop de tentatives de connexion, veuillez patienter 15 minutes',
});

// Vote rate limiter (10 submissions per minute)
const voteLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: 'Trop de tentatives de vote, veuillez patienter',
});

// Registration rate limiter (10 per hour)
const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Trop de tentatives d\'inscription, veuillez réessayer plus tard',
});

// Token request rate limiter
const tokenRequestLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: 'Trop de demandes de token, veuillez patienter',
});

module.exports = {
    globalLimiter,
    loginLimiter,
    voteLimiter,
    registerLimiter,
    tokenRequestLimiter,
    createRateLimiter,
};
