/**
 * PostgreSQL Database Configuration
 * Connection pooling with performance monitoring
 * Supporte DATABASE_URL (Render/Production) et les variables individuelles (local)
 */
const { Pool } = require('pg');
const logger = require('../utils/logger');

// ─── Choix de la configuration ───────────────────────────────────────────────
// Render.com fournit DATABASE_URL automatiquement. On l'utilise en priorité.
let poolConfig;

if (process.env.DATABASE_URL) {
  // Mode Production (Render, Heroku, Railway, etc.)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Render exige SSL
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  logger.info('🌐 DB: Using DATABASE_URL (Production mode)');
} else {
  // Mode Local (variables .env individuelles)
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'voting_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
  logger.info('🏠 DB: Using individual variables (Local mode)');
}

const pool = new Pool(poolConfig);

// Pool event listeners
pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

/**
 * Execute a database query with performance monitoring
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        query: text.substring(0, 200),
        duration: `${duration}ms`,
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    logger.error('Database query error', {
      query: text.substring(0, 200),
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get a client from the connection pool for transactions
 * @returns {Promise<object>} Database client
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Timeout to prevent leaked connections
  const timeout = setTimeout(() => {
    logger.error('Database client has been checked out for over 10s!');
  }, 10000);

  client.query = (...args) => {
    return originalQuery(...args);
  };

  client.release = () => {
    clearTimeout(timeout);
    return originalRelease();
  };

  return client;
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    logger.info('Database connected successfully', {
      time: result.rows[0].current_time,
    });
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error: error.message });
    return false;
  }
}

module.exports = { pool, query, getClient, testConnection };
