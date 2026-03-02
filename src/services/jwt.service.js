/**
 * JWT Service
 * Access token (short-lived) and Refresh token (long-lived) management
 */
const jwt = require('jsonwebtoken');
const config = require('../config/app');
const logger = require('../utils/logger');

class JWTService {
    /**
     * Generate a short-lived access token
     * @param {object} user - User object with id, email, role
     * @returns {string} JWT access token
     */
    generateAccessToken(user) {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                type: 'access',
            },
            config.jwt.accessSecret,
            {
                expiresIn: config.jwt.accessExpiresIn,
                issuer: config.jwt.issuer,
                audience: config.jwt.audience,
            }
        );
    }

    /**
     * Generate a long-lived refresh token
     * @param {object} user - User object with id
     * @returns {string} JWT refresh token
     */
    generateRefreshToken(user) {
        return jwt.sign(
            {
                userId: user.id,
                type: 'refresh',
            },
            config.jwt.refreshSecret,
            {
                expiresIn: config.jwt.refreshExpiresIn,
                issuer: config.jwt.issuer,
            }
        );
    }

    /**
     * Generate both tokens
     * @param {object} user
     * @returns {object} { accessToken, refreshToken }
     */
    generateTokenPair(user) {
        return {
            accessToken: this.generateAccessToken(user),
            refreshToken: this.generateRefreshToken(user),
        };
    }

    /**
     * Verify and decode an access token
     * @param {string} token
     * @returns {object} Decoded token payload
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, config.jwt.accessSecret, {
                issuer: config.jwt.issuer,
                audience: config.jwt.audience,
            });
        } catch (error) {
            logger.debug('Access token verification failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Verify and decode a refresh token
     * @param {string} token
     * @returns {object} Decoded token payload
     */
    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, config.jwt.refreshSecret, {
                issuer: config.jwt.issuer,
            });
        } catch (error) {
            logger.debug('Refresh token verification failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Decode token without verification (for expired token info)
     * @param {string} token
     * @returns {object|null}
     */
    decode(token) {
        return jwt.decode(token);
    }
}

module.exports = new JWTService();
