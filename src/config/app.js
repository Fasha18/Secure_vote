/**
 * Application Configuration
 * Centralizes all configuration values
 */
const config = {
    // Server
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',
    isDev: process.env.NODE_ENV !== 'production',
    isProd: process.env.NODE_ENV === 'production',

    // JWT
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiresIn: '15m',
        refreshExpiresIn: '7d',
        issuer: 'voting-app',
        audience: 'voting-app-users',
    },

    // Encryption
    encryption: {
        key: process.env.ENCRYPTION_KEY,
        hashSalt: process.env.HASH_SALT,
        voteProofSecret: process.env.VOTE_PROOF_SECRET,
        algorithm: 'aes-256-gcm',
    },

    // Security
    security: {
        bcryptRounds: 12,
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes in ms
        voteTokenTTL: 3600, // 1 hour in seconds
        passwordMinLength: 8,
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 1000,
    },

    // CORS
    cors: {
        allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
    },

    // Features
    features: {
        blockchain: process.env.ENABLE_BLOCKCHAIN === 'true',
        twoFactorAuth: process.env.ENABLE_2FA === 'true',
        emailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
        swagger: process.env.ENABLE_SWAGGER === 'true',
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },

    // Pagination
    pagination: {
        defaultPage: 1,
        defaultLimit: 20,
        maxLimit: 100,
    },
};

module.exports = config;
