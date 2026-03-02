/**
 * Server Entry Point
 * Initializes database, Redis, migrations, seeds admin, and starts HTTP server
 */
require('dotenv').config();

const app = require('./app');
const config = require('./config/app');
const { testConnection, query } = require('./config/database');
const { testRedisConnection } = require('./config/redis');
const { runMigration } = require('./db/migrations/001_initial_schema');
const logger = require('./utils/logger');

/**
 * Crée ou réinitialise le compte admin.
 * - Si FORCE_RESET_ADMIN=true → réinitialise le mot de passe même si l'admin existe
 * - Sinon → crée seulement si aucun admin n'existe
 */
async function seedAdminIfNeeded() {
    try {
        const bcrypt = require('bcryptjs');

        const forceReset = process.env.FORCE_RESET_ADMIN === 'true';
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@securevote.com').toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@SecureVote2024!';
        const adminFirst = process.env.ADMIN_FIRSTNAME || 'Super';
        const adminLast = process.env.ADMIN_LASTNAME || 'Admin';

        // Check if any admin exists
        const result = await query(
            "SELECT id, email FROM users WHERE role IN ('admin', 'super_admin') AND is_active = TRUE LIMIT 1"
        );

        if (result.rows.length > 0 && !forceReset) {
            logger.info('✅ Admin account already exists — skipping seed');
            return;
        }

        const passwordHash = await bcrypt.hash(adminPassword, 12);

        if (forceReset && result.rows.length > 0) {
            logger.warn('🔄 FORCE_RESET_ADMIN=true — Resetting admin password...');

            await query(
                `UPDATE users
                 SET password_hash         = $1,
                     is_active             = TRUE,
                     failed_login_attempts = 0,
                     locked_until          = NULL,
                     updated_at            = NOW()
                 WHERE role IN ('admin', 'super_admin')`,
                [passwordHash]
            );

            if (process.env.ADMIN_EMAIL) {
                await query(
                    `UPDATE users
                     SET email      = $1,
                         first_name = $2,
                         last_name  = $3
                     WHERE role IN ('admin', 'super_admin')`,
                    [adminEmail, adminFirst, adminLast]
                );
            }

            logger.info('✅ Admin password reset successfully!');
        } else {
            logger.warn('⚠️  No active admin found. Seeding default admin...');

            const insertResult = await query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, failed_login_attempts)
                 VALUES ($1, $2, $3, $4, 'admin', TRUE, TRUE, 0)
                 ON CONFLICT (email) DO UPDATE
                   SET password_hash         = EXCLUDED.password_hash,
                       role                  = 'admin',
                       is_active             = TRUE,
                       failed_login_attempts = 0,
                       locked_until          = NULL,
                       updated_at            = NOW()
                 RETURNING id, email`,
                [adminEmail, passwordHash, adminFirst, adminLast]
            );

            const newAdmin = insertResult.rows[0];

            await query(
                'INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
                [newAdmin.id]
            );

            logger.info('✅ Default admin account prepared', { email: newAdmin.email });
        }

    } catch (error) {
        logger.error('❌ Admin seed failed (non-blocking)', { error: error.message });
    }
}

function checkRequiredEnv() {
    const required = [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'ENCRYPTION_KEY',
        'HASH_SALT'
    ];

    if (process.env.NODE_ENV === 'production') {
        const missing = required.filter(key => !process.env[key]);
        if (missing.length > 0) {
            logger.error('❌ CRITICAL: Missing required environment variables in production!', { missing });
            process.exit(1);
        }

        if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
            logger.error('❌ CRITICAL: ENCRYPTION_KEY must be at least 32 characters in production!');
            process.exit(1);
        }
    }
}

async function startServer() {
    logger.info('=================================================');
    logger.info('🗳️  VOTING APP BACKEND - Starting...');
    logger.info('=================================================');
    logger.info(`Environment : ${config.nodeEnv}`);
    logger.info(`Port        : ${config.port}`);

    // 0. Check critical env
    checkRequiredEnv();

    // 1. Test database connection
    logger.info('Connecting to PostgreSQL...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
        logger.error('❌ Database connection failed. Server cannot start.');
        process.exit(1);
    }
    logger.info('✅ PostgreSQL connected');

    // 2. Run migrations
    try {
        logger.info('Running database migrations...');
        await runMigration();
        logger.info('✅ Migrations completed');
    } catch (error) {
        logger.error('❌ Migration failed', { error: error.message });
        process.exit(1);
    }

    // 3. Seed admin account
    await seedAdminIfNeeded();

    // 4. Initialize Background Workers (Scalability)
    if (config.isProd || process.env.START_WORKER === 'true') {
        logger.info('Initializing background workers...');
        require('./services/vote.worker');
    }

    // 5. Test Redis connection
    logger.info('Connecting to Redis...');
    const redisConnected = await testRedisConnection();
    if (redisConnected) {
        logger.info('✅ Redis connected');
    } else {
        logger.warn('⚠️  Redis not available - running without cache');
    }

    // 5. Start HTTP server
    const server = app.listen(config.port, () => {
        logger.info('=================================================');
        logger.info(`🚀 Server running on port ${config.port}`);
        if (!config.isProd) {
            logger.info(`📚 API Docs: http://localhost:${config.port}/docs`);
        }
        logger.info('=================================================');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
        logger.info(`${signal} received. Shutting down gracefully...`);
        server.close(() => {
            logger.info('HTTP server closed');
            const { pool } = require('./config/database');
            pool.end().then(() => {
                logger.info('Database pool closed');
                process.exit(0);
            });
        });
        setTimeout(() => {
            logger.warn('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled Rejection', { reason: reason?.stack || reason });
    });

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
        process.exit(1);
    });
}


startServer();
