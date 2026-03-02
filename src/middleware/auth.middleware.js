/**
 * Authentication Middleware
 * JWT verification and role-based access control
 */
const jwtService = require('../services/jwt.service');
const { query } = require('../config/database');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Verify JWT access token
 * Attaches user object to req.user
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('Token d\'accès manquant');
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwtService.verifyAccessToken(token);

        // Verify user still exists and is active
        const result = await query(
            'SELECT id, email, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            throw new UnauthorizedError('Utilisateur non trouvé');
        }

        const user = result.rows[0];

        if (!user.is_active) {
            throw new UnauthorizedError('Compte désactivé');
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Token expiré'));
        }
        if (error.name === 'JsonWebTokenError') {
            return next(new UnauthorizedError('Token invalide'));
        }
        next(error);
    }
};

/**
 * Optional authentication - attaches user if token present, continues otherwise
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwtService.verifyAccessToken(token);

        const result = await query(
            'SELECT id, email, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length > 0 && result.rows[0].is_active) {
            req.user = {
                id: result.rows[0].id,
                email: result.rows[0].email,
                role: result.rows[0].role,
            };
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        // On optional auth, don't throw - just set user to null
        req.user = null;
        next();
    }
};

/**
 * Role-based access control middleware factory
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentification requise'));
        }

        if (!roles.includes(req.user.role)) {
            logger.warn('Unauthorized access attempt', {
                userId: req.user.id,
                requiredRoles: roles,
                userRole: req.user.role,
                path: req.originalUrl,
            });
            return next(new ForbiddenError('Vous n\'avez pas les permissions nécessaires'));
        }

        next();
    };
};

module.exports = { authenticate, optionalAuth, authorize };
