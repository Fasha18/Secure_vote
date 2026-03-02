/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized responses
 */
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Erreur interne du serveur';

    // Log error
    if (statusCode >= 500) {
        logger.error('Server error', {
            error: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userId: req.user?.id || 'anonymous',
        });

        // Mask specific internal messages in production for 500 errors
        if (process.env.NODE_ENV === 'production') {
            message = 'Une erreur interne est survenue. Veuillez réessayer plus tard.';
        }
    } else {
        logger.warn('Client error', {
            error: err.message,
            url: req.originalUrl,
            method: req.method,
            statusCode,
        });
    }

    // PostgreSQL unique constraint violation
    if (err.code === '23505') {
        statusCode = 409;
        message = 'Cette ressource existe déjà';
        if (err.constraint) {
            if (err.constraint.includes('email')) {
                message = 'Cet email est déjà utilisé';
            } else if (err.constraint.includes('phone')) {
                message = 'Ce numéro de téléphone est déjà utilisé';
            }
        }
    }

    // PostgreSQL foreign key violation
    if (err.code === '23503') {
        statusCode = 400;
        message = 'Référence invalide - la ressource liée n\'existe pas';
    }

    // PostgreSQL check constraint violation
    if (err.code === '23514') {
        statusCode = 400;
        message = 'Contrainte de validation non respectée';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Session invalide ou expirée';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Session expirée, veuillez vous reconnecter';
    }

    // Build response
    const response = {
        success: false,
        message,
    };

    // Include validation details if present
    if (err.details) {
        response.errors = err.details;
    }

    // Include stack trace only in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.internal = err.message; // Detailed message for dev
    }

    res.status(statusCode).json(response);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
    const error = new AppError(`Route non trouvée: ${req.originalUrl}`, 404);
    next(error);
};

module.exports = { errorHandler, notFoundHandler };
