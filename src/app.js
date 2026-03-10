/**
 * Express Application Setup
 * Security middleware, routes, error handling
 */
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const hpp = require('hpp');

const config = require('./config/app');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { globalLimiter } = require('./middleware/ratelimit.middleware');
const { swaggerUi, swaggerDocs } = require('./config/swagger');
const logger = require('./utils/logger');

const app = express();

// Trust proxy for Render/production environments
app.set('trust proxy', 1);

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// Helmet - Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            connectSrc: ["'self'", ...config.cors.allowedOrigins],
        },
    },
    crossOriginEmbedderPolicy: config.isProd,
}));

// CORS
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);

        // Allow if '*' is in allowed origins
        if (config.cors.allowedOrigins.includes('*')) {
            return callback(null, true);
        }

        // In production, strictly use allowed origins
        if (config.isProd) {
            if (config.cors.allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            logger.warn('CORS blocked request in production', { origin });
            return callback(new Error('Not allowed by CORS'));
        }

        // In development, allow localhost and others
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }

        if (config.cors.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked request', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Vote-Token', 'X-Device-Type'],
};
app.use(cors(corsOptions));

// HPP - Prevent HTTP Parameter Pollution
app.use(hpp());

// ===========================================
// PARSING & COMPRESSION
// ===========================================

// Body parsing
app.use(express.json({ limit: '5mb' })); // Reduced limit for production
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Compression
app.use(compression());

// ===========================================
// LOGGING
// ===========================================

// HTTP request logging
if (config.isDev) {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim()),
        },
        skip: (req, res) => req.url === '/health' // Skip health checks in logs
    }));
}

// ===========================================
// RATE LIMITING
// ===========================================
app.use('/api/', globalLimiter);

// ===========================================
// SWAGGER DOCUMENTATION
// ===========================================
if (config.features.swagger) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
        customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { font-size: 2em; }
    `,
        customSiteTitle: 'Voting App API Documentation',
        swaggerOptions: {
            persistAuthorization: true,
            docExpansion: 'none',
            filter: true,
            showRequestDuration: true,
        },
    }));
}

// ===========================================
// HEALTH CHECK
// ===========================================
app.get('/health', async (req, res) => {
    const { testConnection } = require('./config/database');
    const { testRedisConnection } = require('./config/redis');

    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('../package.json').version,
        checks: {},
    };

    try {
        const dbOk = await testConnection();
        health.checks.database = dbOk ? 'ok' : 'error';
        if (!dbOk) health.status = 'degraded';
    } catch {
        health.checks.database = 'error';
        health.status = 'degraded';
    }

    try {
        const redisOk = await testRedisConnection();
        health.checks.redis = redisOk ? 'ok' : 'warning';
    } catch {
        health.checks.redis = 'warning';
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    health.checks.memory = {
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    };

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

// ===========================================
// API ROUTES
// ===========================================
app.use('/api', routes);


// ===========================================
// FRONTEND STATIC FILES
// ===========================================
app.use('/dashboard', express.static(path.join(__dirname, '..', 'frontend')));
app.use('/dashboard/v2', express.static(path.join(__dirname, '..', 'frontend', 'v2')));
app.use('/vote', express.static(path.join(__dirname, '..', 'frontend', 'voter')));


// ===========================================
// ROOT
// ===========================================
app.get('/', (req, res) => {
    res.redirect('/vote');
});


// ===========================================
// ERROR HANDLING
// ===========================================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
